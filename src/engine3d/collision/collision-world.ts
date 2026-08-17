import {
  COLLISION_EPSILON,
  aabb3,
  assertFinite,
  assertPositive,
  compareStableIds,
  ignoredIds,
  vec2xz,
  vec3,
  verticalOverlap,
} from './geometry'
import { StableSpatialHash } from './spatial-hash'
import { circleAabbDepenetration, sweepCircleAabb } from './sweep'
import type {
  Aabb3,
  CollisionContact,
  CollisionQueryOptions,
  HorizontalCapsule,
  HorizontalMoveOptions,
  HorizontalMoveResult,
  RayHit,
  StaticCollider,
  Vec2XZ,
  Vec3,
} from './types'

interface SweepChoice {
  readonly collider: StaticCollider
  readonly time: number
  readonly normal: Vec2XZ
}

interface RayAabbHit {
  readonly distance: number
  readonly normal: Vec3
}

function integerOption(value: number | undefined, fallback: number, label: string): number {
  const result = value ?? fallback
  if (!Number.isInteger(result) || result < 0) throw new RangeError(`${label} must be a non-negative integer`)
  return result
}

function skinOption(value: number | undefined): number {
  const skin = value ?? 1e-5
  assertFinite(skin, 'collision skin')
  if (skin < 0) throw new RangeError('collision skin must not be negative')
  return skin
}

function bodyBounds(x: number, z: number, body: HorizontalCapsule): Aabb3 {
  return aabb3(
    vec3(x - body.radius, body.position.y, z - body.radius),
    vec3(x + body.radius, body.position.y + body.height, z + body.radius),
  )
}

function sweptBodyBounds(
  x: number,
  z: number,
  deltaX: number,
  deltaZ: number,
  body: HorizontalCapsule,
): Aabb3 {
  return aabb3(
    vec3(
      Math.min(x, x + deltaX) - body.radius,
      body.position.y,
      Math.min(z, z + deltaZ) - body.radius,
    ),
    vec3(
      Math.max(x, x + deltaX) + body.radius,
      body.position.y + body.height,
      Math.max(z, z + deltaZ) + body.radius,
    ),
  )
}

function validateBody(body: HorizontalCapsule): HorizontalCapsule {
  const position = vec3(body.position.x, body.position.y, body.position.z)
  assertPositive(body.radius, 'capsule radius')
  assertPositive(body.height, 'capsule height')
  return Object.freeze({ position, radius: body.radius, height: body.height })
}

function rayAabb(origin: Vec3, direction: Vec3, maxDistance: number, bounds: Aabb3): RayAabbHit | null {
  let near = 0
  let far = maxDistance
  let nearNormal = vec3(0, 0, 0)
  const axes: ReadonlyArray<{
    readonly origin: number
    readonly direction: number
    readonly min: number
    readonly max: number
    readonly minNormal: Vec3
    readonly maxNormal: Vec3
  }> = [
    {
      origin: origin.x,
      direction: direction.x,
      min: bounds.min.x,
      max: bounds.max.x,
      minNormal: vec3(-1, 0, 0),
      maxNormal: vec3(1, 0, 0),
    },
    {
      origin: origin.y,
      direction: direction.y,
      min: bounds.min.y,
      max: bounds.max.y,
      minNormal: vec3(0, -1, 0),
      maxNormal: vec3(0, 1, 0),
    },
    {
      origin: origin.z,
      direction: direction.z,
      min: bounds.min.z,
      max: bounds.max.z,
      minNormal: vec3(0, 0, -1),
      maxNormal: vec3(0, 0, 1),
    },
  ]

  for (const axis of axes) {
    if (Math.abs(axis.direction) <= COLLISION_EPSILON) {
      if (axis.origin < axis.min || axis.origin > axis.max) return null
      continue
    }
    let first = (axis.min - axis.origin) / axis.direction
    let second = (axis.max - axis.origin) / axis.direction
    let firstNormal = axis.minNormal
    if (first > second) {
      const swap = first
      first = second
      second = swap
      firstNormal = axis.maxNormal
    }
    if (first > near + COLLISION_EPSILON) {
      near = first
      nearNormal = firstNormal
    }
    far = Math.min(far, second)
    if (near > far + COLLISION_EPSILON) return null
  }

  if (far < -COLLISION_EPSILON || near > maxDistance + COLLISION_EPSILON) return null
  return Object.freeze({ distance: Math.max(0, near), normal: nearNormal })
}

/** Deterministic static-collision world fed by terrain/interior cell streaming. */
export class CollisionWorld {
  private readonly spatialHash: StableSpatialHash

  constructor(cellSize = 16) {
    this.spatialHash = new StableSpatialHash(cellSize)
  }

  get cellSize(): number {
    return this.spatialHash.cellSize
  }

  get colliderCount(): number {
    return this.spatialHash.size
  }

  addStaticCollider(collider: StaticCollider): StaticCollider {
    return this.spatialHash.add(collider)
  }

  updateStaticCollider(collider: StaticCollider): StaticCollider {
    return this.spatialHash.update(collider)
  }

  upsertStaticCollider(collider: StaticCollider): StaticCollider {
    return this.spatialHash.upsert(collider)
  }

  removeStaticCollider(id: string): boolean {
    return this.spatialHash.remove(id)
  }

  clearStaticColliders(): void {
    this.spatialHash.clear()
  }

  getStaticCollider(id: string): StaticCollider | undefined {
    return this.spatialHash.get(id)
  }

  staticColliderIds(): readonly string[] {
    return this.spatialHash.ids()
  }

  queryAabb(bounds: Aabb3, options: CollisionQueryOptions = {}): readonly StaticCollider[] {
    const ignored = ignoredIds(options.ignoreIds)
    return Object.freeze(this.spatialHash.queryAabb(bounds).filter((collider) => !ignored.has(collider.id)))
  }

  moveHorizontal(
    unvalidatedBody: HorizontalCapsule,
    displacement: Vec2XZ,
    options: HorizontalMoveOptions = {},
  ): HorizontalMoveResult {
    const body = validateBody(unvalidatedBody)
    const requested = vec2xz(displacement.x, displacement.z)
    const ignored = ignoredIds(options.ignoreIds)
    const maxSlides = integerOption(options.maxSlides, 4, 'max slides')
    const maxOverlapIterations = integerOption(
      options.maxOverlapIterations,
      8,
      'max overlap iterations',
    )
    const skin = skinOption(options.skin)

    const startX = body.position.x
    const startZ = body.position.z
    let x = startX
    let z = startZ
    const contacts: CollisionContact[] = []

    // Resolve streamed spawn/load overlaps by repeatedly taking the deepest overlap.
    // Stable ID is the explicit tie-break, independent of Map/Set insertion order.
    for (let iteration = 0; iteration < maxOverlapIterations; iteration += 1) {
      let best:
        | { readonly collider: StaticCollider; readonly normal: Vec2XZ; readonly depth: number }
        | undefined
      for (const collider of this.spatialHash.queryAabb(bodyBounds(x, z, body))) {
        if (ignored.has(collider.id)) continue
        if (!verticalOverlap(body.position.y, body.height, collider.bounds)) continue
        const overlap = circleAabbDepenetration(x, z, body.radius, collider.bounds)
        if (overlap === null) continue
        if (
          best === undefined ||
          overlap.depth > best.depth + COLLISION_EPSILON ||
          (Math.abs(overlap.depth - best.depth) <= COLLISION_EPSILON &&
            compareStableIds(collider.id, best.collider.id) < 0)
        ) {
          best = { collider, normal: overlap.normal, depth: overlap.depth }
        }
      }
      if (best === undefined) break
      x += best.normal.x * (best.depth + skin)
      z += best.normal.z * (best.depth + skin)
      contacts.push(
        Object.freeze({
          colliderId: best.collider.id,
          kind: 'overlap',
          normal: best.normal,
          time: 0,
          depth: best.depth,
        }),
      )
    }

    let remainingX = requested.x
    let remainingZ = requested.z
    for (let slide = 0; slide < maxSlides; slide += 1) {
      const length = Math.hypot(remainingX, remainingZ)
      if (length <= COLLISION_EPSILON) {
        remainingX = 0
        remainingZ = 0
        break
      }

      let first: SweepChoice | undefined
      const candidates = this.spatialHash.queryAabb(
        sweptBodyBounds(x, z, remainingX, remainingZ, body),
      )
      for (const collider of candidates) {
        if (ignored.has(collider.id)) continue
        if (!verticalOverlap(body.position.y, body.height, collider.bounds)) continue
        const hit = sweepCircleAabb(
          x,
          z,
          remainingX,
          remainingZ,
          body.radius,
          collider.bounds,
        )
        if (hit === null) continue
        if (
          first === undefined ||
          hit.time < first.time - COLLISION_EPSILON ||
          (Math.abs(hit.time - first.time) <= COLLISION_EPSILON &&
            compareStableIds(collider.id, first.collider.id) < 0)
        ) {
          first = { collider, time: hit.time, normal: hit.normal }
        }
      }

      if (first === undefined) {
        x += remainingX
        z += remainingZ
        remainingX = 0
        remainingZ = 0
        break
      }

      const travelTime = Math.max(0, first.time - skin / length)
      x += remainingX * travelTime
      z += remainingZ * travelTime

      const afterX = remainingX * (1 - first.time)
      const afterZ = remainingZ * (1 - first.time)
      const intoSurface = afterX * first.normal.x + afterZ * first.normal.z
      if (intoSurface < 0) {
        remainingX = afterX - first.normal.x * intoSurface
        remainingZ = afterZ - first.normal.z * intoSurface
      } else {
        remainingX = afterX
        remainingZ = afterZ
      }

      contacts.push(
        Object.freeze({
          colliderId: first.collider.id,
          kind: 'sweep',
          normal: first.normal,
          time: first.time,
          depth: 0,
        }),
      )
    }

    return Object.freeze({
      position: vec3(x, body.position.y, z),
      applied: vec2xz(x - startX, z - startZ),
      remaining: vec2xz(remainingX, remainingZ),
      contacts: Object.freeze(contacts),
    })
  }

  /** First stable-ID ray hit. Direction need not be normalized. */
  raycast(
    originValue: Vec3,
    directionValue: Vec3,
    maxDistance: number,
    options: CollisionQueryOptions = {},
  ): RayHit | null {
    const origin = vec3(originValue.x, originValue.y, originValue.z)
    const directionLength = Math.hypot(directionValue.x, directionValue.y, directionValue.z)
    assertPositive(directionLength, 'ray direction length')
    assertFinite(maxDistance, 'ray max distance')
    if (maxDistance < 0) throw new RangeError('ray max distance must not be negative')
    const direction = vec3(
      directionValue.x / directionLength,
      directionValue.y / directionLength,
      directionValue.z / directionLength,
    )
    const end = vec3(
      origin.x + direction.x * maxDistance,
      origin.y + direction.y * maxDistance,
      origin.z + direction.z * maxDistance,
    )
    const segmentBounds = aabb3(
      vec3(
        Math.min(origin.x, end.x),
        Math.min(origin.y, end.y),
        Math.min(origin.z, end.z),
      ),
      vec3(
        Math.max(origin.x, end.x),
        Math.max(origin.y, end.y),
        Math.max(origin.z, end.z),
      ),
    )
    const ignored = ignoredIds(options.ignoreIds)
    let nearest: { readonly collider: StaticCollider; readonly hit: RayAabbHit } | undefined
    for (const collider of this.spatialHash.queryAabb(segmentBounds)) {
      if (ignored.has(collider.id)) continue
      const hit = rayAabb(origin, direction, maxDistance, collider.bounds)
      if (hit === null) continue
      if (
        nearest === undefined ||
        hit.distance < nearest.hit.distance - COLLISION_EPSILON ||
        (Math.abs(hit.distance - nearest.hit.distance) <= COLLISION_EPSILON &&
          compareStableIds(collider.id, nearest.collider.id) < 0)
      ) {
        nearest = { collider, hit }
      }
    }
    if (nearest === undefined) return null
    return Object.freeze({
      colliderId: nearest.collider.id,
      distance: nearest.hit.distance,
      point: vec3(
        origin.x + direction.x * nearest.hit.distance,
        origin.y + direction.y * nearest.hit.distance,
        origin.z + direction.z * nearest.hit.distance,
      ),
      normal: nearest.hit.normal,
    })
  }

  /**
   * Usable camera-arm length from target to desired camera point. Returns the full
   * segment length when unobstructed and the first obstruction distance otherwise.
   */
  obstructionDistance(
    from: Vec3,
    to: Vec3,
    options: CollisionQueryOptions = {},
  ): number {
    const delta = vec3(to.x - from.x, to.y - from.y, to.z - from.z)
    const distance = Math.hypot(delta.x, delta.y, delta.z)
    if (distance <= COLLISION_EPSILON) return 0
    return this.raycast(from, delta, distance, options)?.distance ?? distance
  }
}
