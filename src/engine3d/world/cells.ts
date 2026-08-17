export interface WorldXZ {
  readonly x: number
  readonly z: number
}

export interface WorldCellCoordinate {
  readonly x: number
  readonly z: number
  readonly layer: number
}

export type WorldCellKey = `${number}:${number}:${number}`

export interface WorldCellDescriptor {
  readonly key: WorldCellKey
  readonly coordinate: WorldCellCoordinate
  readonly seed: number
  readonly ringDistance: number
  readonly distanceSquared: number
}

export interface WorldCellPlanOptions {
  readonly worldSeed: number
  readonly cellSize: number
  readonly loadRadius: number
  readonly unloadRadius?: number
  readonly maxResidentCells?: number
  readonly layer?: number
}

export interface WorldCellPlan {
  readonly center: WorldCellCoordinate
  readonly active: readonly WorldCellDescriptor[]
  readonly load: readonly WorldCellDescriptor[]
  readonly retain: readonly WorldCellDescriptor[]
  readonly unload: readonly WorldCellKey[]
}

interface NormalizedWorldCellPlanOptions {
  readonly worldSeed: number
  readonly cellSize: number
  readonly loadRadius: number
  readonly unloadRadius: number
  readonly maxResidentCells: number
  readonly layer: number
}

const MAX_WORLD_SEED = 0xffff_ffff
const CANONICAL_INTEGER = '(?:0|-?[1-9]\\d*)'
const WORLD_CELL_KEY_PATTERN = new RegExp(
  `^(${CANONICAL_INTEGER}):(${CANONICAL_INTEGER}):(${CANONICAL_INTEGER})$`,
)

function requireFinite(name: string, value: number): number {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`)
  return value
}

function requireInteger(name: string, value: number): number {
  requireFinite(name, value)
  if (!Number.isSafeInteger(value)) throw new RangeError(`${name} must be a safe integer`)
  return value
}

function requireWorldSeed(value: number): number {
  requireInteger('worldSeed', value)
  if (value < 0 || value > MAX_WORLD_SEED) {
    throw new RangeError(`worldSeed must be between 0 and ${MAX_WORLD_SEED}`)
  }
  return value
}

function squareCellCount(radius: number): number {
  const side = radius * 2 + 1
  const count = side * side
  if (!Number.isSafeInteger(count)) {
    throw new RangeError('unloadRadius is too large to derive a default resident-cell limit')
  }
  return count
}

function normalizeOptions(options: WorldCellPlanOptions): NormalizedWorldCellPlanOptions {
  const cellSize = requireFinite('cellSize', options.cellSize)
  const loadRadius = requireInteger('loadRadius', options.loadRadius)
  const unloadRadius = requireInteger('unloadRadius', options.unloadRadius ?? loadRadius + 1)
  const maxResidentCells = requireInteger(
    'maxResidentCells',
    options.maxResidentCells ?? squareCellCount(unloadRadius),
  )

  if (cellSize <= 0) throw new RangeError('cellSize must be greater than zero')
  if (loadRadius < 0) throw new RangeError('loadRadius must not be negative')
  if (unloadRadius < loadRadius) {
    throw new RangeError('unloadRadius must be greater than or equal to loadRadius')
  }
  if (maxResidentCells < 1) throw new RangeError('maxResidentCells must be at least one')

  return {
    worldSeed: requireWorldSeed(options.worldSeed),
    cellSize,
    loadRadius,
    unloadRadius,
    maxResidentCells,
    layer: requireInteger('layer', options.layer ?? 0),
  }
}

/** Validates planner configuration without enumerating or loading any cells. */
export function validateWorldCellPlanOptions(options: WorldCellPlanOptions): void {
  normalizeOptions(options)
}

export function worldToCell(position: WorldXZ, cellSize: number, layer = 0): WorldCellCoordinate {
  requireFinite('position.x', position.x)
  requireFinite('position.z', position.z)
  requireFinite('cellSize', cellSize)
  requireInteger('layer', layer)
  if (cellSize <= 0) throw new RangeError('cellSize must be greater than zero')
  const x = Math.floor(position.x / cellSize)
  const z = Math.floor(position.z / cellSize)
  requireInteger('cell x', x)
  requireInteger('cell z', z)
  return { x, z, layer }
}

export function worldCellKey(coordinate: WorldCellCoordinate): WorldCellKey {
  const layer = requireInteger('coordinate.layer', coordinate.layer)
  const x = requireInteger('coordinate.x', coordinate.x)
  const z = requireInteger('coordinate.z', coordinate.z)
  return `${layer}:${x}:${z}`
}

export function parseWorldCellKey(key: string): WorldCellCoordinate | null {
  const match = WORLD_CELL_KEY_PATTERN.exec(key)
  if (!match) return null
  const layer = Number(match[1])
  const x = Number(match[2])
  const z = Number(match[3])
  if (![layer, x, z].every(Number.isSafeInteger)) return null
  return { layer, x, z }
}

/** Stable FNV-1a fold for authored and generated cell content. */
export function worldCellSeed(worldSeed: number, coordinate: WorldCellCoordinate): number {
  const text = `${requireWorldSeed(worldSeed)}:${worldCellKey(coordinate)}`
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function descriptorFor(
  worldSeed: number,
  center: WorldCellCoordinate,
  coordinate: WorldCellCoordinate,
): WorldCellDescriptor {
  const dx = coordinate.x - center.x
  const dz = coordinate.z - center.z
  return {
    key: worldCellKey(coordinate),
    coordinate,
    seed: worldCellSeed(worldSeed, coordinate),
    ringDistance: Math.max(Math.abs(dx), Math.abs(dz)),
    distanceSquared: dx * dx + dz * dz,
  }
}

export function compareWorldCellDescriptors(
  left: WorldCellDescriptor,
  right: WorldCellDescriptor,
): number {
  return (
    left.ringDistance - right.ringDistance ||
    left.distanceSquared - right.distanceSquared ||
    left.coordinate.layer - right.coordinate.layer ||
    left.coordinate.z - right.coordinate.z ||
    left.coordinate.x - right.coordinate.x
  )
}

function enumerateRadius(
  worldSeed: number,
  center: WorldCellCoordinate,
  radius: number,
  limit: number,
): WorldCellDescriptor[] {
  const descriptors: WorldCellDescriptor[] = []

  for (let ring = 0; ring <= radius && descriptors.length < limit; ring++) {
    const ringDescriptors: WorldCellDescriptor[] = []
    if (ring === 0) {
      ringDescriptors.push(descriptorFor(worldSeed, center, center))
    } else {
      const minX = center.x - ring
      const maxX = center.x + ring
      const minZ = center.z - ring
      const maxZ = center.z + ring
      requireInteger('minimum cell x', minX)
      requireInteger('maximum cell x', maxX)
      requireInteger('minimum cell z', minZ)
      requireInteger('maximum cell z', maxZ)

      for (let x = minX; x <= maxX; x++) {
        ringDescriptors.push(
          descriptorFor(worldSeed, center, { x, z: minZ, layer: center.layer }),
          descriptorFor(worldSeed, center, { x, z: maxZ, layer: center.layer }),
        )
      }
      for (let z = minZ + 1; z < maxZ; z++) {
        ringDescriptors.push(
          descriptorFor(worldSeed, center, { x: minX, z, layer: center.layer }),
          descriptorFor(worldSeed, center, { x: maxX, z, layer: center.layer }),
        )
      }
    }

    ringDescriptors.sort(compareWorldCellDescriptors)
    descriptors.push(...ringDescriptors.slice(0, limit - descriptors.length))
  }

  return descriptors
}

/**
 * Produces the same load/retain/unload order for the same inputs, regardless of Set or Map
 * insertion order. Resident cells inside the unload radius provide hysteresis, while the
 * hard resident cap keeps memory bounded.
 */
export function planWorldCells(
  position: WorldXZ,
  options: WorldCellPlanOptions,
  residentKeys: Iterable<string> = [],
): WorldCellPlan {
  const normalized = normalizeOptions(options)
  const center = worldToCell(position, normalized.cellSize, normalized.layer)
  const resident = new Map<WorldCellKey, WorldCellDescriptor>()

  for (const rawKey of residentKeys) {
    const coordinate = parseWorldCellKey(rawKey)
    if (!coordinate) continue
    const descriptor = descriptorFor(normalized.worldSeed, center, coordinate)
    resident.set(descriptor.key, descriptor)
  }

  const selected = new Map<WorldCellKey, WorldCellDescriptor>()
  const nearest = enumerateRadius(
    normalized.worldSeed,
    center,
    normalized.loadRadius,
    normalized.maxResidentCells,
  )
  for (const descriptor of nearest) {
    if (selected.size >= normalized.maxResidentCells) break
    selected.set(descriptor.key, descriptor)
  }

  const hysteresisCandidates = [...resident.values()]
    .filter(
      (descriptor) =>
        descriptor.coordinate.layer === center.layer &&
        descriptor.ringDistance <= normalized.unloadRadius &&
        !selected.has(descriptor.key),
    )
    .sort(compareWorldCellDescriptors)

  for (const descriptor of hysteresisCandidates) {
    if (selected.size >= normalized.maxResidentCells) break
    selected.set(descriptor.key, descriptor)
  }

  const active = [...selected.values()].sort(compareWorldCellDescriptors)
  const load = active.filter((descriptor) => !resident.has(descriptor.key))
  const retain = active.filter((descriptor) => resident.has(descriptor.key))
  const unload = [...resident.keys()]
    .filter((key) => !selected.has(key))
    .sort((left, right) => {
      const leftDescriptor = resident.get(left)
      const rightDescriptor = resident.get(right)
      if (!leftDescriptor || !rightDescriptor) return left.localeCompare(right)
      return compareWorldCellDescriptors(rightDescriptor, leftDescriptor)
    })

  return { center, active, load, retain, unload }
}
