import { clamp, COLLISION_EPSILON } from './geometry'
import type { Aabb3, Vec2XZ } from './types'

export interface CircleDepenetration {
  readonly normal: Vec2XZ
  readonly depth: number
}

export interface CircleSweepHit {
  readonly time: number
  readonly normal: Vec2XZ
}

interface SweepCandidate extends CircleSweepHit {
  readonly rank: number
}

/** Minimum translation that separates a horizontal circle from an AABB. */
export function circleAabbDepenetration(
  x: number,
  z: number,
  radius: number,
  bounds: Aabb3,
): CircleDepenetration | null {
  const closestX = clamp(x, bounds.min.x, bounds.max.x)
  const closestZ = clamp(z, bounds.min.z, bounds.max.z)
  const dx = x - closestX
  const dz = z - closestZ
  const distanceSquared = dx * dx + dz * dz
  const radiusSquared = radius * radius

  if (distanceSquared >= radiusSquared - COLLISION_EPSILON) return null

  if (distanceSquared > COLLISION_EPSILON * COLLISION_EPSILON) {
    const distance = Math.sqrt(distanceSquared)
    return {
      normal: Object.freeze({ x: dx / distance, z: dz / distance }),
      depth: radius - distance,
    }
  }

  // The centre is inside or exactly on the rectangle. Fixed side ranking resolves
  // perfect ties without consulting collider insertion order.
  const choices: readonly CircleDepenetration[] = [
    { normal: Object.freeze({ x: -1, z: 0 }), depth: x - (bounds.min.x - radius) },
    { normal: Object.freeze({ x: 1, z: 0 }), depth: bounds.max.x + radius - x },
    { normal: Object.freeze({ x: 0, z: -1 }), depth: z - (bounds.min.z - radius) },
    { normal: Object.freeze({ x: 0, z: 1 }), depth: bounds.max.z + radius - z },
  ]
  let best = choices[0]
  for (let index = 1; index < choices.length; index += 1) {
    const choice = choices[index]
    if (choice.depth < best.depth) best = choice
  }
  return best
}

/**
 * Exact continuous sweep of a horizontal circle against the rounded rectangle
 * produced by a circle/AABB Minkowski sum. Side and corner contacts are considered
 * separately, preventing both high-speed tunnelling and square-corner false hits.
 */
export function sweepCircleAabb(
  startX: number,
  startZ: number,
  deltaX: number,
  deltaZ: number,
  radius: number,
  bounds: Aabb3,
): CircleSweepHit | null {
  const speedSquared = deltaX * deltaX + deltaZ * deltaZ
  if (speedSquared <= COLLISION_EPSILON * COLLISION_EPSILON) return null

  const candidates: SweepCandidate[] = []
  const add = (time: number, normalX: number, normalZ: number, rank: number): void => {
    if (time < -COLLISION_EPSILON || time > 1 + COLLISION_EPSILON) return
    const approach = deltaX * normalX + deltaZ * normalZ
    if (approach >= -COLLISION_EPSILON) return
    candidates.push({
      time: clamp(time, 0, 1),
      normal: Object.freeze({ x: normalX, z: normalZ }),
      rank,
    })
  }

  if (deltaX > COLLISION_EPSILON) {
    const time = (bounds.min.x - radius - startX) / deltaX
    const z = startZ + deltaZ * time
    if (z >= bounds.min.z - COLLISION_EPSILON && z <= bounds.max.z + COLLISION_EPSILON) {
      add(time, -1, 0, 0)
    }
  } else if (deltaX < -COLLISION_EPSILON) {
    const time = (bounds.max.x + radius - startX) / deltaX
    const z = startZ + deltaZ * time
    if (z >= bounds.min.z - COLLISION_EPSILON && z <= bounds.max.z + COLLISION_EPSILON) {
      add(time, 1, 0, 1)
    }
  }

  if (deltaZ > COLLISION_EPSILON) {
    const time = (bounds.min.z - radius - startZ) / deltaZ
    const x = startX + deltaX * time
    if (x >= bounds.min.x - COLLISION_EPSILON && x <= bounds.max.x + COLLISION_EPSILON) {
      add(time, 0, -1, 2)
    }
  } else if (deltaZ < -COLLISION_EPSILON) {
    const time = (bounds.max.z + radius - startZ) / deltaZ
    const x = startX + deltaX * time
    if (x >= bounds.min.x - COLLISION_EPSILON && x <= bounds.max.x + COLLISION_EPSILON) {
      add(time, 0, 1, 3)
    }
  }

  const quadraticA = speedSquared
  const corners: ReadonlyArray<readonly [number, number, -1 | 1, -1 | 1, number]> = [
    [bounds.min.x, bounds.min.z, -1, -1, 4],
    [bounds.max.x, bounds.min.z, 1, -1, 5],
    [bounds.min.x, bounds.max.z, -1, 1, 6],
    [bounds.max.x, bounds.max.z, 1, 1, 7],
  ]
  for (const [cornerX, cornerZ, sideX, sideZ, rank] of corners) {
    const relativeX = startX - cornerX
    const relativeZ = startZ - cornerZ
    const quadraticB = 2 * (relativeX * deltaX + relativeZ * deltaZ)
    const quadraticC = relativeX * relativeX + relativeZ * relativeZ - radius * radius
    const discriminant = quadraticB * quadraticB - 4 * quadraticA * quadraticC
    if (discriminant < -COLLISION_EPSILON) continue
    const time = (-quadraticB - Math.sqrt(Math.max(0, discriminant))) / (2 * quadraticA)
    if (time < -COLLISION_EPSILON || time > 1 + COLLISION_EPSILON) continue
    const x = startX + deltaX * time
    const z = startZ + deltaZ * time
    if (sideX < 0 && x > cornerX + COLLISION_EPSILON) continue
    if (sideX > 0 && x < cornerX - COLLISION_EPSILON) continue
    if (sideZ < 0 && z > cornerZ + COLLISION_EPSILON) continue
    if (sideZ > 0 && z < cornerZ - COLLISION_EPSILON) continue
    const normalX = (x - cornerX) / radius
    const normalZ = (z - cornerZ) / radius
    const normalLength = Math.hypot(normalX, normalZ)
    if (normalLength <= COLLISION_EPSILON) continue
    add(time, normalX / normalLength, normalZ / normalLength, rank)
  }

  if (candidates.length === 0) return null
  candidates.sort((a, b) => {
    if (Math.abs(a.time - b.time) > COLLISION_EPSILON) return a.time - b.time
    return a.rank - b.rank
  })
  const first = candidates[0]
  return Object.freeze({ time: first.time, normal: first.normal })
}
