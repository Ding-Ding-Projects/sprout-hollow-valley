/** Three.js-independent world-space vector. */
export interface Vec3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** A horizontal displacement or normal in the world XZ plane. */
export interface Vec2XZ {
  readonly x: number
  readonly z: number
}

/** Immutable axis-aligned world-space bounds. */
export interface Aabb3 {
  readonly min: Vec3
  readonly max: Vec3
}

/**
 * A streamed, non-moving piece of collision geometry.
 *
 * IDs must be stable content or world-instance IDs. The collision layer sorts by
 * this ID whenever more than one collider can affect a result, so loading the same
 * world cells in a different order cannot change the simulation.
 */
export interface StaticCollider {
  readonly id: string
  readonly bounds: Aabb3
}

/** A vertical capsule approximated by a circle in XZ and an interval in Y. */
export interface HorizontalCapsule {
  /** Bottom-centre of the capsule-like player body. */
  readonly position: Vec3
  readonly radius: number
  readonly height: number
}

export type CollisionContactKind = 'overlap' | 'sweep'

export interface CollisionContact {
  readonly colliderId: string
  readonly kind: CollisionContactKind
  /** Outward-facing normal from the static collider. */
  readonly normal: Vec2XZ
  /** Normalized time along the iteration's requested displacement. */
  readonly time: number
  /** Depenetration distance for overlap contacts, otherwise zero. */
  readonly depth: number
}

export interface HorizontalMoveOptions {
  /** IDs belonging to the mover or temporarily non-solid streamed objects. */
  readonly ignoreIds?: ReadonlySet<string> | readonly string[]
  /** Maximum sweep-and-slide contacts. Defaults to four. */
  readonly maxSlides?: number
  /** Maximum deterministic initial-overlap corrections. Defaults to eight. */
  readonly maxOverlapIterations?: number
  /** Small separation maintained from contact surfaces. Defaults to 1e-5. */
  readonly skin?: number
}

export interface HorizontalMoveResult {
  readonly position: Vec3
  /** Total final displacement, including any initial depenetration. */
  readonly applied: Vec2XZ
  /** Requested motion left unapplied after exhausting slide iterations. */
  readonly remaining: Vec2XZ
  readonly contacts: readonly CollisionContact[]
}

export interface CollisionQueryOptions {
  readonly ignoreIds?: ReadonlySet<string> | readonly string[]
}

export interface RayHit {
  readonly colliderId: string
  readonly distance: number
  readonly point: Vec3
  readonly normal: Vec3
}

export interface SpatialCell {
  readonly x: number
  readonly z: number
}
