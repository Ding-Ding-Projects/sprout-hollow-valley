import { FARM_H, FARM_W } from '../../game/constants'
import type {
  FarmTileCoordinate,
  FarmWorldTransform,
  GameplayWorldPoint,
} from './types'

export const DEFAULT_FARM_WORLD_TRANSFORM: Readonly<FarmWorldTransform> = Object.freeze({
  origin: Object.freeze({ x: 0, y: 0, z: 0 }),
  tileSize: 1,
  groundY: 0,
  maxInteractionDistance: 2.15,
})

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`)
  return value
}

function positive(value: number, label: string): number {
  const resolved = finite(value, label)
  if (resolved <= 0) throw new RangeError(`${label} must be positive`)
  return resolved
}

export function createFarmWorldTransform(
  input: Partial<FarmWorldTransform> = {},
): Readonly<FarmWorldTransform> {
  const originInput = input.origin ?? DEFAULT_FARM_WORLD_TRANSFORM.origin
  const origin = Object.freeze({
    x: finite(originInput.x, 'origin.x'),
    y: finite(originInput.y, 'origin.y'),
    z: finite(originInput.z, 'origin.z'),
  })
  return Object.freeze({
    origin,
    tileSize: positive(input.tileSize ?? DEFAULT_FARM_WORLD_TRANSFORM.tileSize, 'tileSize'),
    groundY: finite(input.groundY ?? origin.y, 'groundY'),
    maxInteractionDistance: positive(
      input.maxInteractionDistance ?? DEFAULT_FARM_WORLD_TRANSFORM.maxInteractionDistance,
      'maxInteractionDistance',
    ),
  })
}

export function tileCoordinate(index: number): FarmTileCoordinate | null {
  if (!Number.isInteger(index) || index < 0 || index >= FARM_W * FARM_H) return null
  return Object.freeze({ x: index % FARM_W, y: Math.floor(index / FARM_W), index })
}

export function worldToFarmTile(
  point: GameplayWorldPoint,
  transform: FarmWorldTransform,
): FarmTileCoordinate | null {
  if (![point.x, point.y, point.z].every(Number.isFinite)) return null
  const x = Math.floor((point.x - transform.origin.x) / transform.tileSize)
  const y = Math.floor((point.z - transform.origin.z) / transform.tileSize)
  if (x < 0 || y < 0 || x >= FARM_W || y >= FARM_H) return null
  return Object.freeze({ x, y, index: y * FARM_W + x })
}

export function farmTileCenter(
  tile: Pick<FarmTileCoordinate, 'x' | 'y'>,
  transform: FarmWorldTransform,
): GameplayWorldPoint {
  return Object.freeze({
    x: transform.origin.x + (tile.x + 0.5) * transform.tileSize,
    y: transform.groundY,
    z: transform.origin.z + (tile.y + 0.5) * transform.tileSize,
  })
}

export function gameplayWorldDistance(a: GameplayWorldPoint, b: GameplayWorldPoint): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.hypot(dx, dy, dz)
}
