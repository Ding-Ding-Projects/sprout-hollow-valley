import { VALLEY_CONTENT_REGISTRY } from '../../content/registry'
import type { BuildingDef, ContentRegistry, FactoryDef, FootprintDef } from '../../content/types'
import {
  BUILDING_INTERIOR_COUNT,
  FACTORY_INTERIOR_COUNT,
  STRUCTURE_INTERIORS,
  TOTAL_INTERIOR_COUNT,
  type InteriorGraph,
} from '../../interiors'

export type AuthoredValleyRegionId =
  | 'region:meadow'
  | 'region:forest'
  | 'region:riverland'
  | 'region:mountain'
  | 'region:coastal'
  | 'region:marsh'
  | 'region:arid'
  | 'region:alpine'

export type AuthoredStructureKind = 'factory' | 'building'
export type AuthoredStructureCellKey = `0:${number}:${number}`

export interface AuthoredStructureCellCoordinate {
  readonly x: number
  readonly z: number
  readonly layer: 0
}

export interface AuthoredStructurePoint2D {
  readonly x: number
  readonly z: number
}

export interface AuthoredStructurePoint3D extends AuthoredStructurePoint2D {
  readonly y: number
}

export interface AuthoredStructureFootprint {
  /** Rendered collision width in world units. */
  readonly width: number
  /** Rendered collision depth in world units. */
  readonly depth: number
  /** Clear walkable margin outside the rendered collision bounds. */
  readonly clearance: number
}

export interface AuthoredStructureDistrict {
  readonly id: string
  readonly name: string
  readonly category: 'agricultural' | 'civic' | 'homes' | 'market' | 'services' | 'works'
}

export interface AuthoredStructureRoad {
  readonly id: string
  readonly name: string
  readonly localLaneZ: number
}

export interface AuthoredStructureEntrance {
  /** Stable exterior interaction identity; this is the only door-like exterior object. */
  readonly id: string
  readonly interiorGraphId: string
  readonly interiorDoorId: string
  readonly interiorRoomId: string
  readonly localPosition: AuthoredStructurePoint3D
  readonly worldPosition: AuthoredStructurePoint3D
  readonly approachPosition: AuthoredStructurePoint3D
  readonly accessibleLabel: string
}

export interface AuthoredStructurePlacement {
  readonly id: string
  readonly ordinal: number
  readonly kindOrdinal: number
  readonly structureKind: AuthoredStructureKind
  readonly contentStructureId: string
  readonly label: string
  /** Exact immutable catalogue row rendered by this placement. */
  readonly definition: FactoryDef | BuildingDef
  readonly regionId: AuthoredValleyRegionId
  readonly regionName: string
  readonly district: AuthoredStructureDistrict
  readonly road: AuthoredStructureRoad
  readonly cell: AuthoredStructureCellCoordinate
  readonly cellKey: AuthoredStructureCellKey
  readonly slot: number
  readonly localPosition: AuthoredStructurePoint3D
  readonly worldPosition: AuthoredStructurePoint3D
  /** Three.js Y-axis rotation in radians; the real exterior door faces the cell access lane. */
  readonly facingYaw: number
  readonly footprint: AuthoredStructureFootprint
  readonly sourceFootprint: FootprintDef
  readonly collisionId: string
  readonly interiorGraphId: string
  readonly interiorEntryDoorId: string
  readonly interiorEntryRoomId: string
  readonly entrance: AuthoredStructureEntrance
}

export interface AuthoredStructureDirectoryEntry {
  readonly placementId: string
  readonly contentStructureId: string
  readonly label: string
  readonly structureKind: AuthoredStructureKind
  readonly regionId: AuthoredValleyRegionId
  readonly regionName: string
  readonly districtId: string
  readonly districtName: string
  readonly roadId: string
  readonly roadName: string
  readonly cellKey: AuthoredStructureCellKey
  readonly worldPosition: AuthoredStructurePoint3D
  readonly facingYaw: number
  readonly footprint: AuthoredStructureFootprint
  readonly interiorGraphId: string
  readonly interiorDoorId: string
  readonly accessibleEntranceLabel: string
}

export interface AuthoredStructurePlacementRegistry {
  readonly placements: readonly AuthoredStructurePlacement[]
  readonly directory: readonly AuthoredStructureDirectoryEntry[]
  readonly byPlacementId: ReadonlyMap<string, AuthoredStructurePlacement>
  readonly byContentStructureId: ReadonlyMap<string, AuthoredStructurePlacement>
  readonly byInteriorGraphId: ReadonlyMap<string, AuthoredStructurePlacement>
  readonly byCellKey: ReadonlyMap<AuthoredStructureCellKey, readonly AuthoredStructurePlacement[]>
  readonly factoryCount: number
  readonly buildingCount: number
  readonly maxStructuresPerCell: number
}

interface RegionPlacementSpec {
  readonly id: AuthoredValleyRegionId
  readonly slug: string
  readonly name: string
  readonly centre: AuthoredStructurePoint2D
}

interface PlacementSource {
  readonly definition: FactoryDef | BuildingDef
  readonly graph: InteriorGraph
  readonly structureKind: AuthoredStructureKind
  readonly kindOrdinal: number
}

const CELL_SIZE = 16
const MIN_CELL_X = -8
const MAX_CELL_X = 8
const MIN_CELL_Z = -6
const MAX_CELL_Z = 7
const MAX_STRUCTURES_PER_CELL = 5
const ESTATE_CELL_KEYS: ReadonlySet<string> = new Set([
  '-2:-2',
  '-6:-1',
  '-3:4',
  '3:-4',
  '6:1',
  '0:6',
  '6:-4',
  '4:6',
])

const SPROUT_RIVER_POINTS: readonly AuthoredStructurePoint2D[] = Object.freeze([
  Object.freeze({ x: -5.5, z: -6.8 }),
  Object.freeze({ x: -4.1, z: -3.3 }),
  Object.freeze({ x: -3.3, z: -0.4 }),
  Object.freeze({ x: -2.1, z: 2.3 }),
  Object.freeze({ x: -1.5, z: 4.4 }),
  Object.freeze({ x: 0.5, z: 7.8 }),
])

const REGION_SPECS: readonly RegionPlacementSpec[] = Object.freeze([
  Object.freeze({ id: 'region:meadow', slug: 'meadow', name: 'Meadow Commons', centre: Object.freeze({ x: -2, z: -2 }) }),
  Object.freeze({ id: 'region:forest', slug: 'forest', name: 'Fernwood Wilds', centre: Object.freeze({ x: -6, z: -1 }) }),
  Object.freeze({ id: 'region:riverland', slug: 'riverland', name: 'Riverbend Terraces', centre: Object.freeze({ x: -3, z: 4 }) }),
  Object.freeze({ id: 'region:mountain', slug: 'mountain', name: 'Copper Highridge', centre: Object.freeze({ x: 3, z: -4 }) }),
  Object.freeze({ id: 'region:coastal', slug: 'coastal', name: 'Saltwind Coast', centre: Object.freeze({ x: 6, z: 1 }) }),
  Object.freeze({ id: 'region:marsh', slug: 'marsh', name: 'Willowfen Wetlands', centre: Object.freeze({ x: 0, z: 6 }) }),
  Object.freeze({ id: 'region:arid', slug: 'arid', name: 'Sunstone Mesa', centre: Object.freeze({ x: 6, z: -4 }) }),
  Object.freeze({ id: 'region:alpine', slug: 'alpine', name: 'Snowcap Highlands', centre: Object.freeze({ x: 4, z: 6 }) }),
])

const REGION_SPEC_BY_ID: ReadonlyMap<AuthoredValleyRegionId, RegionPlacementSpec> = new Map(
  REGION_SPECS.map((region) => [region.id, region]),
)

const SLOT_LAYOUT: readonly Readonly<{
  localPosition: AuthoredStructurePoint2D
  facingYaw: number
}>[] = Object.freeze([
  Object.freeze({ localPosition: Object.freeze({ x: -5, z: -4 }), facingYaw: 0 }),
  Object.freeze({ localPosition: Object.freeze({ x: 0, z: -4 }), facingYaw: 0 }),
  Object.freeze({ localPosition: Object.freeze({ x: 5, z: -4 }), facingYaw: 0 }),
  Object.freeze({ localPosition: Object.freeze({ x: -2.6, z: 3.8 }), facingYaw: Math.PI }),
  Object.freeze({ localPosition: Object.freeze({ x: 2.6, z: 3.8 }), facingYaw: Math.PI }),
])

function squareDistance(left: AuthoredStructurePoint2D, right: AuthoredStructurePoint2D): number {
  const dx = left.x - right.x
  const dz = left.z - right.z
  return dx * dx + dz * dz
}

function distanceToSegment(
  point: AuthoredStructurePoint2D,
  start: AuthoredStructurePoint2D,
  end: AuthoredStructurePoint2D,
): number {
  const dx = end.x - start.x
  const dz = end.z - start.z
  const lengthSquared = dx * dx + dz * dz
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.z - start.z)
  const amount = clamp(
    ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared,
    0,
    1,
  )
  return Math.hypot(point.x - (start.x + dx * amount), point.z - (start.z + dz * amount))
}

function distanceToSproutRiver(point: AuthoredStructurePoint2D): number {
  let nearest = Number.POSITIVE_INFINITY
  for (let index = 1; index < SPROUT_RIVER_POINTS.length; index += 1) {
    nearest = Math.min(
      nearest,
      distanceToSegment(point, SPROUT_RIVER_POINTS[index - 1]!, SPROUT_RIVER_POINTS[index]!),
    )
  }
  return nearest
}

/** Exact terrain sampler shared by immutable placement poses and streamed geometry. */
export function authoredValleyTerrainHeightAt(
  worldX: number,
  worldZ: number,
  cellSize = CELL_SIZE,
): number {
  if (!Number.isFinite(worldX) || !Number.isFinite(worldZ) || !Number.isFinite(cellSize) || cellSize <= 0) {
    throw new RangeError('Authored Valley terrain coordinates and cell size must be finite, with a positive cell size')
  }
  const x = worldX / cellSize
  const z = worldZ / cellSize
  const rolling = Math.sin(x * 0.82) * 0.16 + Math.cos(z * 0.67) * 0.13
  const highridge = Math.exp(-squareDistance({ x, z }, { x: 3.5, z: -4.5 }) / 8) * 0.75
  const snowcap = Math.exp(-squareDistance({ x, z }, { x: 4.5, z: 6.2 }) / 7) * 1.05
  const mesa = Math.exp(-squareDistance({ x, z }, { x: 6.2, z: -4.2 }) / 6) * 0.42
  const riverDistance = distanceToSproutRiver({ x, z })
  const riverCut = Math.exp(-(riverDistance * riverDistance) / 0.045) * 0.34
  return rolling + highridge + snowcap + mesa - riverCut
}

/** Shared deterministic region resolver for world composition and the placement directory. */
export function authoredStructureRegionIdForCell(
  point: AuthoredStructurePoint2D,
): AuthoredValleyRegionId {
  let selected = REGION_SPECS[0]!
  let distance = squareDistance(point, selected.centre)
  for (const candidate of REGION_SPECS.slice(1)) {
    const candidateDistance = squareDistance(point, candidate.centre)
    if (candidateDistance < distance) {
      selected = candidate
      distance = candidateDistance
    }
  }
  return selected.id
}

function allCellsByRegion(): ReadonlyMap<AuthoredValleyRegionId, readonly AuthoredStructureCellCoordinate[]> {
  const mutable = new Map<AuthoredValleyRegionId, AuthoredStructureCellCoordinate[]>(
    REGION_SPECS.map((region) => [region.id, []]),
  )
  for (let z = MIN_CELL_Z; z <= MAX_CELL_Z; z += 1) {
    for (let x = MIN_CELL_X; x <= MAX_CELL_X; x += 1) {
      if (ESTATE_CELL_KEYS.has(`${x}:${z}`)) continue
      const regionId = authoredStructureRegionIdForCell({ x, z })
      mutable.get(regionId)!.push(Object.freeze({ x, z, layer: 0 }))
    }
  }
  return new Map(REGION_SPECS.map((region) => {
    const cells = mutable.get(region.id)!
      .sort((left, right) =>
        squareDistance(left, region.centre) - squareDistance(right, region.centre) ||
        left.z - right.z ||
        left.x - right.x,
      )
    return [region.id, Object.freeze(cells)]
  }))
}

const CELLS_BY_REGION = allCellsByRegion()

function regionForDefinition(definition: FactoryDef | BuildingDef): RegionPlacementSpec {
  for (const rawRegion of definition.regions) {
    const regionId = (rawRegion.startsWith('region:') ? rawRegion : `region:${rawRegion}`) as AuthoredValleyRegionId
    const region = REGION_SPEC_BY_ID.get(regionId)
    if (region !== undefined) return region
  }
  throw new Error(`Structure ${definition.id} has no authored Valley placement region`)
}

function buildingDistrictCategory(building: BuildingDef): AuthoredStructureDistrict['category'] {
  switch (building.buildingType) {
    case 'agricultural':
      return 'agricultural'
    case 'residential':
      return 'homes'
    case 'civic':
    case 'education':
    case 'health':
      return 'civic'
    case 'commercial':
    case 'hospitality':
    case 'recreation':
      return 'market'
    case 'storage':
    case 'transport':
    case 'utility':
      return 'services'
  }
}

function words(value: string): string {
  return value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function compareStableText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function districtFor(
  source: PlacementSource,
  region: RegionPlacementSpec,
): AuthoredStructureDistrict {
  const category = source.structureKind === 'factory'
    ? 'works'
    : buildingDistrictCategory(source.definition as BuildingDef)
  return Object.freeze({
    id: `district:${region.slug}-${category}`,
    name: `${region.name} ${words(category)} District`,
    category,
  })
}

function roadFor(
  region: RegionPlacementSpec,
  district: AuthoredStructureDistrict,
): AuthoredStructureRoad {
  return Object.freeze({
    id: `road:${region.slug}-${district.category}-lane`,
    name: `${region.name} ${words(district.category)} Lane`,
    localLaneZ: 0,
  })
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function renderedFootprint(source: PlacementSource): AuthoredStructureFootprint {
  const sourceFootprint = source.definition.footprint
  const scale = source.structureKind === 'factory' ? 0.42 : 0.38
  const minimumWidth = source.structureKind === 'factory' ? 2.4 : 2.1
  const minimumDepth = source.structureKind === 'factory' ? 2.2 : 1.9
  const maximumWidth = CELL_SIZE * (source.structureKind === 'factory' ? 0.34 : 0.3)
  const maximumDepth = CELL_SIZE * (source.structureKind === 'factory' ? 0.32 : 0.28)
  return Object.freeze({
    width: clamp(sourceFootprint.width * scale, minimumWidth, maximumWidth),
    depth: clamp(sourceFootprint.depth * scale, minimumDepth, maximumDepth),
    clearance: clamp(sourceFootprint.clearance * 0.32, 0.4, 0.72),
  })
}

function rotateForward(distance: number, facingYaw: number): AuthoredStructurePoint2D {
  return Object.freeze({
    x: Math.sin(facingYaw) * distance,
    z: Math.cos(facingYaw) * distance,
  })
}

function cellKey(cell: AuthoredStructureCellCoordinate): AuthoredStructureCellKey {
  return `0:${cell.x}:${cell.z}`
}

function sourceRows(
  registry: ContentRegistry,
  interiors: readonly InteriorGraph[],
): readonly PlacementSource[] {
  if (registry.factories.length !== FACTORY_INTERIOR_COUNT) {
    throw new Error(`Authored placement registry requires ${FACTORY_INTERIOR_COUNT} factories; received ${registry.factories.length}`)
  }
  if (registry.buildings.length !== BUILDING_INTERIOR_COUNT) {
    throw new Error(`Authored placement registry requires ${BUILDING_INTERIOR_COUNT} buildings; received ${registry.buildings.length}`)
  }
  if (interiors.length !== TOTAL_INTERIOR_COUNT) {
    throw new Error(`Authored placement registry requires ${TOTAL_INTERIOR_COUNT} interior graphs; received ${interiors.length}`)
  }
  const factoryGraphs = interiors.filter((graph) => graph.kind === 'factory')
  const buildingGraphs = interiors.filter((graph) => graph.kind === 'building')
  if (factoryGraphs.length !== FACTORY_INTERIOR_COUNT || buildingGraphs.length !== BUILDING_INTERIOR_COUNT) {
    throw new Error('Authored placement registry interior graph kind totals are incomplete')
  }
  return Object.freeze([
    ...registry.factories.map((definition, index) => Object.freeze({
      definition,
      graph: factoryGraphs[index]!,
      structureKind: 'factory' as const,
      kindOrdinal: index + 1,
    })),
    ...registry.buildings.map((definition, index) => Object.freeze({
      definition,
      graph: buildingGraphs[index]!,
      structureKind: 'building' as const,
      kindOrdinal: index + 1,
    })),
  ])
}

function placementFor(
  source: PlacementSource,
  ordinal: number,
  cell: AuthoredStructureCellCoordinate,
  slot: number,
): AuthoredStructurePlacement {
  const region = regionForDefinition(source.definition)
  const slotLayout = SLOT_LAYOUT[slot]
  if (slotLayout === undefined) {
    throw new Error(`Structure ${source.definition.id} exceeds the bounded ${MAX_STRUCTURES_PER_CELL}-placement cell layout`)
  }
  const footprint = renderedFootprint(source)
  const worldX = (cell.x + 0.5) * CELL_SIZE + slotLayout.localPosition.x
  const worldZ = (cell.z + 0.5) * CELL_SIZE + slotLayout.localPosition.z
  const baseY = authoredValleyTerrainHeightAt(worldX, worldZ)
  const localPosition = Object.freeze({
    x: slotLayout.localPosition.x,
    y: baseY,
    z: slotLayout.localPosition.z,
  })
  const worldPosition = Object.freeze({
    x: worldX,
    y: baseY,
    z: worldZ,
  })
  const district = districtFor(source, region)
  const road = roadFor(region, district)
  const doorOffset = rotateForward(footprint.depth / 2 + 0.05, slotLayout.facingYaw)
  const approachOffset = rotateForward(footprint.depth / 2 + 1.35, slotLayout.facingYaw)
  const doorCentreY = source.structureKind === 'factory' ? 0.68 : 0.59
  const entranceLocal = Object.freeze({
    x: slotLayout.localPosition.x + doorOffset.x,
    y: baseY + doorCentreY,
    z: slotLayout.localPosition.z + doorOffset.z,
  })
  const entranceWorld = Object.freeze({
    x: worldPosition.x + doorOffset.x,
    y: baseY + doorCentreY,
    z: worldPosition.z + doorOffset.z,
  })
  const approachX = worldPosition.x + approachOffset.x
  const approachZ = worldPosition.z + approachOffset.z
  const approachWorld = Object.freeze({
    x: approachX,
    y: authoredValleyTerrainHeightAt(approachX, approachZ),
    z: approachZ,
  })
  const id = `placement:${source.definition.id}`
  return Object.freeze({
    id,
    ordinal,
    kindOrdinal: source.kindOrdinal,
    structureKind: source.structureKind,
    contentStructureId: source.definition.id,
    label: source.definition.name,
    definition: source.definition,
    regionId: region.id,
    regionName: region.name,
    district,
    road,
    cell,
    cellKey: cellKey(cell),
    slot,
    localPosition,
    worldPosition,
    facingYaw: slotLayout.facingYaw,
    footprint,
    sourceFootprint: source.definition.footprint,
    collisionId: `${id}:collision`,
    interiorGraphId: source.graph.id,
    interiorEntryDoorId: source.graph.entryDoorId,
    interiorEntryRoomId: source.graph.entryRoomId,
    entrance: Object.freeze({
      id: `${id}:door:entrance`,
      interiorGraphId: source.graph.id,
      interiorDoorId: source.graph.entryDoorId,
      interiorRoomId: source.graph.entryRoomId,
      localPosition: entranceLocal,
      worldPosition: entranceWorld,
      approachPosition: approachWorld,
      accessibleLabel: `Enter ${source.definition.name}; opens ${source.graph.name}.`,
    }),
  })
}

function directoryEntry(placement: AuthoredStructurePlacement): AuthoredStructureDirectoryEntry {
  return Object.freeze({
    placementId: placement.id,
    contentStructureId: placement.contentStructureId,
    label: placement.label,
    structureKind: placement.structureKind,
    regionId: placement.regionId,
    regionName: placement.regionName,
    districtId: placement.district.id,
    districtName: placement.district.name,
    roadId: placement.road.id,
    roadName: placement.road.name,
    cellKey: placement.cellKey,
    worldPosition: placement.worldPosition,
    facingYaw: placement.facingYaw,
    footprint: placement.footprint,
    interiorGraphId: placement.interiorGraphId,
    interiorDoorId: placement.interiorEntryDoorId,
    accessibleEntranceLabel: placement.entrance.accessibleLabel,
  })
}

/**
 * Builds the complete stable exterior-to-interior index. Definitions are assigned to cells in
 * canonical ID order and spread across every cell belonging to their authored region before a
 * second slot is used, keeping collision, navigation, rendering, and streaming work bounded.
 */
export function createAuthoredStructurePlacementRegistry(
  registry: ContentRegistry = VALLEY_CONTENT_REGISTRY,
  interiors: readonly InteriorGraph[] = STRUCTURE_INTERIORS,
): AuthoredStructurePlacementRegistry {
  const grouped = new Map<AuthoredValleyRegionId, PlacementSource[]>(
    REGION_SPECS.map((region) => [region.id, []]),
  )
  for (const source of sourceRows(registry, interiors)) {
    grouped.get(regionForDefinition(source.definition).id)!.push(source)
  }

  const placements: AuthoredStructurePlacement[] = []
  let ordinal = 1
  for (const region of REGION_SPECS) {
    const sources = grouped.get(region.id)!.sort((left, right) =>
      compareStableText(left.definition.id, right.definition.id),
    )
    const cells = CELLS_BY_REGION.get(region.id)!
    for (const [index, source] of sources.entries()) {
      const cell = cells[index % cells.length]!
      const slot = Math.floor(index / cells.length)
      placements.push(placementFor(source, ordinal, cell, slot))
      ordinal += 1
    }
  }
  placements.sort((left, right) => compareStableText(left.contentStructureId, right.contentStructureId))

  const byPlacementId = new Map<string, AuthoredStructurePlacement>()
  const byContentStructureId = new Map<string, AuthoredStructurePlacement>()
  const byInteriorGraphId = new Map<string, AuthoredStructurePlacement>()
  const mutableByCell = new Map<AuthoredStructureCellKey, AuthoredStructurePlacement[]>()
  for (const placement of placements) {
    if (byPlacementId.has(placement.id)) throw new Error(`Duplicate authored placement ID ${placement.id}`)
    if (byContentStructureId.has(placement.contentStructureId)) {
      throw new Error(`Duplicate authored content placement ${placement.contentStructureId}`)
    }
    if (byInteriorGraphId.has(placement.interiorGraphId)) {
      throw new Error(`Interior graph ${placement.interiorGraphId} has more than one exterior placement`)
    }
    byPlacementId.set(placement.id, placement)
    byContentStructureId.set(placement.contentStructureId, placement)
    byInteriorGraphId.set(placement.interiorGraphId, placement)
    const cellPlacements = mutableByCell.get(placement.cellKey) ?? []
    cellPlacements.push(placement)
    mutableByCell.set(placement.cellKey, cellPlacements)
  }

  const byCellKey = new Map<AuthoredStructureCellKey, readonly AuthoredStructurePlacement[]>()
  let maxStructuresPerCell = 0
  for (const [key, values] of mutableByCell) {
    values.sort((left, right) => left.slot - right.slot || compareStableText(left.contentStructureId, right.contentStructureId))
    if (values.length > MAX_STRUCTURES_PER_CELL) {
      throw new Error(`Authored structure cell ${key} exceeds ${MAX_STRUCTURES_PER_CELL} placements`)
    }
    maxStructuresPerCell = Math.max(maxStructuresPerCell, values.length)
    byCellKey.set(key, Object.freeze(values))
  }

  if (placements.length !== TOTAL_INTERIOR_COUNT) {
    throw new Error(`Authored placement registry requires ${TOTAL_INTERIOR_COUNT} placements; created ${placements.length}`)
  }
  return Object.freeze({
    placements: Object.freeze(placements),
    directory: Object.freeze(placements.map(directoryEntry)),
    byPlacementId,
    byContentStructureId,
    byInteriorGraphId,
    byCellKey,
    factoryCount: registry.factories.length,
    buildingCount: registry.buildings.length,
    maxStructuresPerCell,
  })
}

export const AUTHORED_STRUCTURE_PLACEMENT_REGISTRY =
  createAuthoredStructurePlacementRegistry()

export const AUTHORED_STRUCTURE_PLACEMENTS =
  AUTHORED_STRUCTURE_PLACEMENT_REGISTRY.placements

export const AUTHORED_STRUCTURE_DIRECTORY =
  AUTHORED_STRUCTURE_PLACEMENT_REGISTRY.directory

export function authoredStructurePlacementByContentId(
  contentStructureId: string,
  registry: AuthoredStructurePlacementRegistry = AUTHORED_STRUCTURE_PLACEMENT_REGISTRY,
): AuthoredStructurePlacement | undefined {
  return registry.byContentStructureId.get(contentStructureId)
}

export function authoredStructurePlacementByInteriorGraphId(
  interiorGraphId: string,
  registry: AuthoredStructurePlacementRegistry = AUTHORED_STRUCTURE_PLACEMENT_REGISTRY,
): AuthoredStructurePlacement | undefined {
  return registry.byInteriorGraphId.get(interiorGraphId)
}

export function authoredStructurePlacementsForCell(
  cell: Readonly<{ x: number; z: number }>,
  registry: AuthoredStructurePlacementRegistry = AUTHORED_STRUCTURE_PLACEMENT_REGISTRY,
): readonly AuthoredStructurePlacement[] {
  return registry.byCellKey.get(`0:${cell.x}:${cell.z}`) ?? Object.freeze([])
}

/** Stable plain-text directory search suitable for an accessible in-app map or command surface. */
export function searchAuthoredStructureDirectory(
  query: string,
  registry: AuthoredStructurePlacementRegistry = AUTHORED_STRUCTURE_PLACEMENT_REGISTRY,
): readonly AuthoredStructureDirectoryEntry[] {
  const normalized = query.trim().toLocaleLowerCase('en-US')
  if (normalized.length === 0) return registry.directory
  return Object.freeze(registry.directory.filter((entry) => [
    entry.label,
    entry.contentStructureId,
    entry.structureKind,
    entry.regionName,
    entry.districtName,
    entry.roadName,
    entry.cellKey,
    entry.interiorGraphId,
  ].some((value) => value.toLocaleLowerCase('en-US').includes(normalized))))
}
