import { aabb3, assertPositive, compareStableIds, overlapsAabb, snapshotCollider } from './geometry'
import type { Aabb3, SpatialCell, StaticCollider } from './types'

interface ColliderRecord {
  readonly collider: StaticCollider
  readonly cellKeys: readonly string[]
}

function cellKey(x: number, z: number): string {
  return `${x},${z}`
}

/**
 * XZ spatial hash for the active streamed collision set.
 *
 * It deliberately does not know about the global content registry: world streaming
 * adds colliders as cells become active and removes them on eviction, so thousands of
 * definitions and hundreds of interiors never need to be materialized here at once.
 */
export class StableSpatialHash {
  readonly cellSize: number

  private readonly records = new Map<string, ColliderRecord>()
  private readonly cells = new Map<string, Set<string>>()

  constructor(cellSize = 16) {
    assertPositive(cellSize, 'cell size')
    this.cellSize = cellSize
  }

  get size(): number {
    return this.records.size
  }

  has(id: string): boolean {
    return this.records.has(id)
  }

  get(id: string): StaticCollider | undefined {
    return this.records.get(id)?.collider
  }

  ids(): readonly string[] {
    return Object.freeze([...this.records.keys()].sort(compareStableIds))
  }

  /** Cell coordinates touched by bounds, ordered by Z and then X. */
  cellCoordinatesForAabb(bounds: Aabb3): readonly SpatialCell[] {
    const checked = aabb3(bounds.min, bounds.max)
    const minX = Math.floor(checked.min.x / this.cellSize)
    const maxX = Math.floor(checked.max.x / this.cellSize)
    const minZ = Math.floor(checked.min.z / this.cellSize)
    const maxZ = Math.floor(checked.max.z / this.cellSize)
    const result: SpatialCell[] = []
    for (let z = minZ; z <= maxZ; z += 1) {
      for (let x = minX; x <= maxX; x += 1) result.push(Object.freeze({ x, z }))
    }
    return Object.freeze(result)
  }

  add(collider: StaticCollider): StaticCollider {
    const snapshot = snapshotCollider(collider)
    if (this.records.has(snapshot.id)) {
      throw new Error(`static collider already exists: ${snapshot.id}`)
    }
    this.insert(snapshot)
    return snapshot
  }

  update(collider: StaticCollider): StaticCollider {
    const snapshot = snapshotCollider(collider)
    const previous = this.records.get(snapshot.id)
    if (previous === undefined) throw new Error(`static collider does not exist: ${snapshot.id}`)
    this.detach(previous)
    this.insert(snapshot)
    return snapshot
  }

  upsert(collider: StaticCollider): StaticCollider {
    return this.records.has(collider.id) ? this.update(collider) : this.add(collider)
  }

  remove(id: string): boolean {
    const record = this.records.get(id)
    if (record === undefined) return false
    this.detach(record)
    this.records.delete(id)
    return true
  }

  clear(): void {
    this.records.clear()
    this.cells.clear()
  }

  /**
   * Hash-cell candidates in stable-ID order. Callers doing their own narrow phase can
   * use this to avoid paying for an exact AABB filter.
   */
  queryCandidates(bounds: Aabb3): readonly StaticCollider[] {
    const ids = new Set<string>()
    for (const cell of this.cellCoordinatesForAabb(bounds)) {
      const bucket = this.cells.get(cellKey(cell.x, cell.z))
      if (bucket === undefined) continue
      for (const id of bucket) ids.add(id)
    }
    return Object.freeze(
      [...ids]
        .sort(compareStableIds)
        .map((id) => this.records.get(id)?.collider)
        .filter((collider): collider is StaticCollider => collider !== undefined),
    )
  }

  /** Exact AABB overlaps, still returned in stable-ID order. */
  queryAabb(bounds: Aabb3): readonly StaticCollider[] {
    const checked = aabb3(bounds.min, bounds.max)
    return Object.freeze(
      this.queryCandidates(checked).filter((collider) => overlapsAabb(collider.bounds, checked)),
    )
  }

  private insert(collider: StaticCollider): void {
    const keys = this.cellCoordinatesForAabb(collider.bounds).map((cell) => cellKey(cell.x, cell.z))
    const record: ColliderRecord = { collider, cellKeys: Object.freeze(keys) }
    this.records.set(collider.id, record)
    for (const key of keys) {
      let bucket = this.cells.get(key)
      if (bucket === undefined) {
        bucket = new Set<string>()
        this.cells.set(key, bucket)
      }
      bucket.add(collider.id)
    }
  }

  private detach(record: ColliderRecord): void {
    for (const key of record.cellKeys) {
      const bucket = this.cells.get(key)
      if (bucket === undefined) continue
      bucket.delete(record.collider.id)
      if (bucket.size === 0) this.cells.delete(key)
    }
  }
}
