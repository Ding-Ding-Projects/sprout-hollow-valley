import type { Aabb3, StaticCollider, Vec2XZ, Vec3 } from './types'

export const COLLISION_EPSILON = 1e-9

export function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`)
}

export function assertPositive(value: number, label: string): void {
  assertFinite(value, label)
  if (value <= 0) throw new RangeError(`${label} must be greater than zero`)
}

export function vec3(x: number, y: number, z: number): Vec3 {
  assertFinite(x, 'x')
  assertFinite(y, 'y')
  assertFinite(z, 'z')
  return Object.freeze({ x, y, z })
}

export function vec2xz(x: number, z: number): Vec2XZ {
  assertFinite(x, 'x')
  assertFinite(z, 'z')
  return Object.freeze({ x, z })
}

export function aabb3(min: Vec3, max: Vec3): Aabb3 {
  const frozenMin = vec3(min.x, min.y, min.z)
  const frozenMax = vec3(max.x, max.y, max.z)
  if (frozenMin.x > frozenMax.x) throw new RangeError('bounds min.x must not exceed max.x')
  if (frozenMin.y > frozenMax.y) throw new RangeError('bounds min.y must not exceed max.y')
  if (frozenMin.z > frozenMax.z) throw new RangeError('bounds min.z must not exceed max.z')
  return Object.freeze({ min: frozenMin, max: frozenMax })
}

/** Snapshots caller-owned objects so later mutation cannot alter indexed geometry. */
export function snapshotCollider(collider: StaticCollider): StaticCollider {
  if (typeof collider.id !== 'string' || collider.id.trim().length === 0) {
    throw new TypeError('collider id must be a non-empty string')
  }
  return Object.freeze({ id: collider.id, bounds: aabb3(collider.bounds.min, collider.bounds.max) })
}

export function compareStableIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function overlapsAabb(a: Aabb3, b: Aabb3): boolean {
  return (
    a.min.x <= b.max.x &&
    a.max.x >= b.min.x &&
    a.min.y <= b.max.y &&
    a.max.y >= b.min.y &&
    a.min.z <= b.max.z &&
    a.max.z >= b.min.z
  )
}

export function verticalOverlap(bottom: number, height: number, bounds: Aabb3): boolean {
  const top = bottom + height
  return bottom < bounds.max.y - COLLISION_EPSILON && top > bounds.min.y + COLLISION_EPSILON
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function ignoredIds(
  values: ReadonlySet<string> | readonly string[] | undefined,
): ReadonlySet<string> {
  if (values === undefined) return EMPTY_IDS
  return values instanceof Set ? values : new Set(values)
}

const EMPTY_IDS: ReadonlySet<string> = new Set<string>()
