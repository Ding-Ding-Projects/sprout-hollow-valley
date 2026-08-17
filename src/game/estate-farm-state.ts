import type {
  Plant,
  Valley3DEstateFarmingStateV1,
  Valley3DEstateId,
  Valley3DEstatePlotTileV1,
  Valley3DEstateTreeV1,
} from './types'

export interface EstateFarmLayout {
  readonly estateId: Valley3DEstateId
  readonly cellX: number
  readonly cellZ: number
  readonly field: {
    readonly minLocalX: number
    readonly maxLocalX: number
    readonly minLocalZ: number
    readonly maxLocalZ: number
  }
  readonly orchardSlots: readonly Readonly<{ localX: number; localZ: number }>[]
}

const ESTATE_CELLS: readonly Readonly<[Valley3DEstateId, number, number]>[] = Object.freeze([
  ['estate:meadow', -2, -2],
  ['estate:forest', -6, -1],
  ['estate:riverland', -3, 4],
  ['estate:mountain', 3, -4],
  ['estate:coastal', 6, 1],
  ['estate:marsh', 0, 6],
  ['estate:arid', 6, -4],
  ['estate:alpine', 4, 6],
])

export const ESTATE_FARM_LAYOUTS: readonly EstateFarmLayout[] = Object.freeze(
  ESTATE_CELLS.map(([estateId, cellX, cellZ]) => Object.freeze({
    estateId,
    cellX,
    cellZ,
    field: Object.freeze({ minLocalX: 2, maxLocalX: 6, minLocalZ: 9, maxLocalZ: 12 }),
    orchardSlots: Object.freeze([
      Object.freeze({ localX: 10, localZ: 11 }),
      Object.freeze({ localX: 12, localZ: 11 }),
      Object.freeze({ localX: 14, localZ: 11 }),
    ]),
  })),
)

const LAYOUT_BY_ESTATE = new Map(ESTATE_FARM_LAYOUTS.map((layout) => [layout.estateId, layout]))

export function estateFarmKey(estateId: Valley3DEstateId, worldX: number, worldZ: number): string {
  return `${estateId}@${worldX},${worldZ}`
}

export function estateWorldCoordinate(
  layout: EstateFarmLayout,
  localX: number,
  localZ: number,
): Readonly<{ worldX: number; worldZ: number }> {
  return Object.freeze({
    worldX: layout.cellX * 16 + localX,
    worldZ: layout.cellZ * 16 + localZ,
  })
}

export function estateFieldCoordinates(
  layout: EstateFarmLayout,
): Array<Readonly<{ worldX: number; worldZ: number }>> {
  const coordinates: Array<Readonly<{ worldX: number; worldZ: number }>> = []
  for (let localZ = layout.field.minLocalZ; localZ <= layout.field.maxLocalZ; localZ += 1) {
    for (let localX = layout.field.minLocalX; localX <= layout.field.maxLocalX; localX += 1) {
      coordinates.push(estateWorldCoordinate(layout, localX, localZ))
    }
  }
  return coordinates
}

export function estateFarmHash(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function clonePlant(plant: Plant | null): Plant | null {
  return plant === null ? null : { ...plant }
}

export function cloneEstateFarmingState(
  state: Valley3DEstateFarmingStateV1,
): Valley3DEstateFarmingStateV1 {
  const plotTiles: Record<string, Valley3DEstatePlotTileV1> = {}
  const trees: Record<string, Valley3DEstateTreeV1> = {}
  for (const key of Object.keys(state.plotTiles).sort()) {
    const tile = state.plotTiles[key]!
    plotTiles[key] = { ...tile, plant: clonePlant(tile.plant) }
  }
  for (const key of Object.keys(state.trees).sort()) {
    const tree = state.trees[key]!
    trees[key] = { ...tree, plant: { ...tree.plant } }
  }
  return { plotTiles, trees, lastGrowthDay: state.lastGrowthDay }
}

export function createDefaultEstateFarmingState(
  seed: number,
  lastGrowthDay: number,
): Valley3DEstateFarmingStateV1 {
  const plotTiles: Record<string, Valley3DEstatePlotTileV1> = {}
  for (const layout of ESTATE_FARM_LAYOUTS) {
    for (const coordinate of estateFieldCoordinates(layout)) {
      const key = estateFarmKey(layout.estateId, coordinate.worldX, coordinate.worldZ)
      const hash = estateFarmHash(`${seed}:${key}`)
      const ground = hash % 29 === 0
        ? 'log'
        : hash % 17 === 0
          ? 'rock'
          : hash % 7 === 0
            ? 'weeds'
            : 'grass'
      plotTiles[key] = {
        estateId: layout.estateId,
        worldX: coordinate.worldX,
        worldZ: coordinate.worldZ,
        ground,
        watered: false,
        fertilized: false,
        plant: null,
        variant: hash & 0xff,
      }
    }
  }
  return { plotTiles, trees: {}, lastGrowthDay: Math.max(0, Math.floor(lastGrowthDay)) }
}

export function isDesignatedEstatePlot(
  estateId: Valley3DEstateId,
  worldX: number,
  worldZ: number,
): boolean {
  const layout = LAYOUT_BY_ESTATE.get(estateId)
  if (layout === undefined) return false
  const localX = worldX - layout.cellX * 16
  const localZ = worldZ - layout.cellZ * 16
  return localX >= layout.field.minLocalX && localX <= layout.field.maxLocalX
    && localZ >= layout.field.minLocalZ && localZ <= layout.field.maxLocalZ
}

export function isDesignatedEstateOrchardSlot(
  estateId: Valley3DEstateId,
  worldX: number,
  worldZ: number,
): boolean {
  const layout = LAYOUT_BY_ESTATE.get(estateId)
  if (layout === undefined) return false
  const localX = worldX - layout.cellX * 16
  const localZ = worldZ - layout.cellZ * 16
  return layout.orchardSlots.some((slot) => slot.localX === localX && slot.localZ === localZ)
}
