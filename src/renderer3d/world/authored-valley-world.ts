import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  type BufferGeometry,
  type ColorRepresentation,
  type Material,
  type Object3D,
} from 'three'
import { VALLEY_CONTENT_REGISTRY } from '../../content/registry'
import type {
  ContentRegistry,
  CropDef,
  DecorationDef,
  OrchardPlantDef,
} from '../../content/types'
import type { StaticCollider } from '../../engine3d'
import {
  ESTATE_FARM_LAYOUTS,
  estateFarmKey,
  estateWorldCoordinate,
} from '../../game/estate-farm-state'
import { cropById } from '../../game/crops'
import { treeById } from '../../game/trees'
import type { Valley3DEstateFarmingStateV1 } from '../../game/types'
import type {
  ThreeWorldCellBuildContext,
  ThreeWorldCellBuilder,
  ThreeWorldCellContent,
} from './three-world-cell-source'
import {
  AUTHORED_STRUCTURE_PLACEMENT_REGISTRY,
  authoredStructurePlacementsForCell,
  authoredStructureRegionIdForCell,
  authoredValleyTerrainHeightAt,
  createAuthoredStructurePlacementRegistry,
  type AuthoredStructurePlacement,
  type AuthoredStructurePlacementRegistry,
  type AuthoredValleyRegionId,
} from './authored-structure-placements'

export type { AuthoredValleyRegionId } from './authored-structure-placements'

/** World units per streamed authored cell; shared by runtime streaming and save location IDs. */
export const AUTHORED_VALLEY_CELL_SIZE = 16

export interface AuthoredValleyCellPoint {
  readonly x: number
  readonly z: number
}

export interface AuthoredValleyRegion {
  readonly id: AuthoredValleyRegionId
  readonly name: string
  readonly centreCell: AuthoredValleyCellPoint
  readonly terrainColor: number
  readonly soilColor: number
  readonly foliageColor: number
  readonly cropColor: number
  readonly roofColor: number
}

export interface AuthoredEstateZone {
  readonly id: `estate:${string}`
  readonly name: string
  readonly regionId: AuthoredValleyRegionId
  readonly anchorCell: AuthoredValleyCellPoint
  readonly approachName: string
}

export interface AuthoredValleyBounds {
  readonly minCellX: number
  readonly maxCellX: number
  readonly minCellZ: number
  readonly maxCellZ: number
}

export interface AuthoredValleyLocation {
  readonly regionId: AuthoredValleyRegionId
  readonly estateId: AuthoredEstateZone['id'] | null
}

export interface AuthoredValleyWorldCellBuilderOptions {
  /** Defaults to the validated 5,000-definition Valley content registry. */
  readonly registry?: ContentRegistry
  /** Defaults to the complete deterministic 700-exterior placement registry. */
  readonly structurePlacements?: AuthoredStructurePlacementRegistry
  /** Allows low presets to omit point lights while keeping their physical lantern meshes. */
  readonly pointLights?: boolean
  /** Terrain subdivisions per streamed cell. Higher values produce smoother authored slopes. */
  readonly terrainSegments?: number
  /** Mutable save snapshot source read only when an authored estate cell is composed. */
  readonly estateFarming?: () => Valley3DEstateFarmingStateV1 | null
}

interface AuthoredRoute {
  readonly id: string
  readonly name: string
  readonly points: readonly AuthoredValleyCellPoint[]
}

interface Segment {
  readonly start: AuthoredValleyCellPoint
  readonly end: AuthoredValleyCellPoint
}

interface RegionContent {
  readonly crops: readonly CropDef[]
  readonly orchardPlants: readonly OrchardPlantDef[]
  readonly lights: readonly DecorationDef[]
  readonly paths: readonly DecorationDef[]
}

interface CellResources {
  readonly geometries: BufferGeometry[]
  readonly materials: Material[]
}

export const AUTHORED_VALLEY_BOUNDS: AuthoredValleyBounds = Object.freeze({
  minCellX: -8,
  maxCellX: 8,
  minCellZ: -6,
  maxCellZ: 7,
})

export const AUTHORED_VALLEY_REGIONS: readonly AuthoredValleyRegion[] = Object.freeze([
  Object.freeze({
    id: 'region:meadow',
    name: 'Meadow Commons',
    centreCell: Object.freeze({ x: -2, z: -2 }),
    terrainColor: 0x7ead5c,
    soilColor: 0x79593b,
    foliageColor: 0x3f7d43,
    cropColor: 0xa7c957,
    roofColor: 0x9f493e,
  }),
  Object.freeze({
    id: 'region:forest',
    name: 'Fernwood Wilds',
    centreCell: Object.freeze({ x: -6, z: -1 }),
    terrainColor: 0x456d49,
    soilColor: 0x594936,
    foliageColor: 0x28563a,
    cropColor: 0x79a95b,
    roofColor: 0x51463c,
  }),
  Object.freeze({
    id: 'region:riverland',
    name: 'Riverbend Terraces',
    centreCell: Object.freeze({ x: -3, z: 4 }),
    terrainColor: 0x6c9b6b,
    soilColor: 0x665b43,
    foliageColor: 0x3d7559,
    cropColor: 0x89bd6a,
    roofColor: 0x4d6f83,
  }),
  Object.freeze({
    id: 'region:mountain',
    name: 'Copper Highridge',
    centreCell: Object.freeze({ x: 3, z: -4 }),
    terrainColor: 0x78826a,
    soilColor: 0x66594f,
    foliageColor: 0x4b684c,
    cropColor: 0x91a95d,
    roofColor: 0x725b4d,
  }),
  Object.freeze({
    id: 'region:coastal',
    name: 'Saltwind Coast',
    centreCell: Object.freeze({ x: 6, z: 1 }),
    terrainColor: 0x9ead75,
    soilColor: 0x9c825b,
    foliageColor: 0x578563,
    cropColor: 0xb6ba68,
    roofColor: 0x437b8d,
  }),
  Object.freeze({
    id: 'region:marsh',
    name: 'Willowfen Wetlands',
    centreCell: Object.freeze({ x: 0, z: 6 }),
    terrainColor: 0x5b8060,
    soilColor: 0x514c3d,
    foliageColor: 0x3c684a,
    cropColor: 0x89a95b,
    roofColor: 0x5e6751,
  }),
  Object.freeze({
    id: 'region:arid',
    name: 'Sunstone Mesa',
    centreCell: Object.freeze({ x: 6, z: -4 }),
    terrainColor: 0xb58b55,
    soilColor: 0x8d5d3d,
    foliageColor: 0x667344,
    cropColor: 0xb2a24f,
    roofColor: 0x934f35,
  }),
  Object.freeze({
    id: 'region:alpine',
    name: 'Snowcap Highlands',
    centreCell: Object.freeze({ x: 4, z: 6 }),
    terrainColor: 0xa5b7a3,
    soilColor: 0x6d6c63,
    foliageColor: 0x3e6658,
    cropColor: 0x8fad6f,
    roofColor: 0x536579,
  }),
])

export const AUTHORED_ESTATE_ZONES: readonly AuthoredEstateZone[] = Object.freeze([
  Object.freeze({
    id: 'estate:meadow',
    name: 'Meadowbrook Estate',
    regionId: 'region:meadow',
    anchorCell: Object.freeze({ x: -2, z: -2 }),
    approachName: 'Clover Lane',
  }),
  Object.freeze({
    id: 'estate:forest',
    name: 'Fernwood Estate',
    regionId: 'region:forest',
    anchorCell: Object.freeze({ x: -6, z: -1 }),
    approachName: 'Cedar Trail',
  }),
  Object.freeze({
    id: 'estate:riverland',
    name: 'Riverbend Estate',
    regionId: 'region:riverland',
    anchorCell: Object.freeze({ x: -3, z: 4 }),
    approachName: 'Millrace Walk',
  }),
  Object.freeze({
    id: 'estate:mountain',
    name: 'Highridge Estate',
    regionId: 'region:mountain',
    anchorCell: Object.freeze({ x: 3, z: -4 }),
    approachName: 'Granite Rise',
  }),
  Object.freeze({
    id: 'estate:coastal',
    name: 'Seagrass Estate',
    regionId: 'region:coastal',
    anchorCell: Object.freeze({ x: 6, z: 1 }),
    approachName: 'Saltwind Way',
  }),
  Object.freeze({
    id: 'estate:marsh',
    name: 'Willowfen Estate',
    regionId: 'region:marsh',
    anchorCell: Object.freeze({ x: 0, z: 6 }),
    approachName: 'Raised Reed Walk',
  }),
  Object.freeze({
    id: 'estate:arid',
    name: 'Redmesa Estate',
    regionId: 'region:arid',
    anchorCell: Object.freeze({ x: 6, z: -4 }),
    approachName: 'Terracotta Road',
  }),
  Object.freeze({
    id: 'estate:alpine',
    name: 'Snowcap Estate',
    regionId: 'region:alpine',
    anchorCell: Object.freeze({ x: 4, z: 6 }),
    approachName: 'Frostpine Pass',
  }),
])

const TOWN_SQUARE = Object.freeze({ x: 0.5, z: 0.5 })
const MARKET_DISTRICT = Object.freeze({ x: -0.5, z: 1.5 })
const INDUSTRIAL_DISTRICT = Object.freeze({ x: 2.5, z: 1.5 })

const AUTHORED_ROADS: readonly AuthoredRoute[] = Object.freeze([
  Object.freeze({
    id: 'road:valley-spine',
    name: 'Valley Spine Road',
    points: Object.freeze([
      Object.freeze({ x: 0, z: -6.5 }),
      Object.freeze({ x: 0, z: -2 }),
      TOWN_SQUARE,
      Object.freeze({ x: 0, z: 3 }),
      Object.freeze({ x: 0, z: 7.5 }),
    ]),
  }),
  Object.freeze({
    id: 'road:market-ring',
    name: 'Market Ring Road',
    points: Object.freeze([
      Object.freeze({ x: -2, z: 0 }),
      MARKET_DISTRICT,
      TOWN_SQUARE,
      INDUSTRIAL_DISTRICT,
      Object.freeze({ x: 4, z: 1 }),
    ]),
  }),
  ...AUTHORED_ESTATE_ZONES.map((estate) => Object.freeze({
    id: `road:${estate.id.slice('estate:'.length)}-approach`,
    name: estate.approachName,
    points: Object.freeze([
      Object.freeze({ x: estate.anchorCell.x + 0.5, z: estate.anchorCell.z + 0.5 }),
      Object.freeze({
        x: (estate.anchorCell.x + 0.5) * 0.52 + TOWN_SQUARE.x * 0.48,
        z: (estate.anchorCell.z + 0.5) * 0.52 + TOWN_SQUARE.z * 0.48,
      }),
      TOWN_SQUARE,
    ]),
  })),
])

const AUTHORED_RIVER: AuthoredRoute = Object.freeze({
  id: 'water:sprout-river',
  name: 'Sprout River',
  points: Object.freeze([
    Object.freeze({ x: -5.5, z: -6.8 }),
    Object.freeze({ x: -4.1, z: -3.3 }),
    Object.freeze({ x: -3.3, z: -0.4 }),
    Object.freeze({ x: -2.1, z: 2.3 }),
    Object.freeze({ x: -1.5, z: 4.4 }),
    Object.freeze({ x: 0.5, z: 7.8 }),
  ]),
})

const DEFAULT_TERRAIN_SEGMENTS = 8
const ROAD_WIDTH_IN_CELLS = 0.14
const RIVER_WIDTH_IN_CELLS = 0.28

function hashString(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function mixSeed(seed: number, salt: string): number {
  let value = (seed ^ hashString(salt)) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d)
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b)
  value ^= value >>> 16
  return value >>> 0
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function squareDistance(left: AuthoredValleyCellPoint, right: AuthoredValleyCellPoint): number {
  const dx = left.x - right.x
  const dz = left.z - right.z
  return dx * dx + dz * dz
}

function regionForCell(point: AuthoredValleyCellPoint): AuthoredValleyRegion {
  const regionId = authoredStructureRegionIdForCell(point)
  const region = AUTHORED_VALLEY_REGIONS.find((candidate) => candidate.id === regionId)
  if (region === undefined) throw new Error(`Missing authored Valley region ${regionId}`)
  return region
}

function estateForCell(point: AuthoredValleyCellPoint): AuthoredEstateZone | undefined {
  return AUTHORED_ESTATE_ZONES.find(
    (estate) => estate.anchorCell.x === point.x && estate.anchorCell.z === point.z,
  )
}

function withinValley(point: AuthoredValleyCellPoint): boolean {
  return (
    point.x >= AUTHORED_VALLEY_BOUNDS.minCellX &&
    point.x <= AUTHORED_VALLEY_BOUNDS.maxCellX &&
    point.z >= AUTHORED_VALLEY_BOUNDS.minCellZ &&
    point.z <= AUTHORED_VALLEY_BOUNDS.maxCellZ
  )
}

/** Resolves the authored registry location for a world pose without duplicating region rules. */
export function authoredValleyLocationAt(
  position: Readonly<{ x: number; z: number }>,
  cellSize: number,
): AuthoredValleyLocation | null {
  if (
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.z) ||
    !Number.isFinite(cellSize) ||
    cellSize <= 0
  ) {
    return null
  }
  const cell = Object.freeze({
    x: Math.floor(position.x / cellSize),
    z: Math.floor(position.z / cellSize),
  })
  if (!withinValley(cell)) return null
  const region = regionForCell(cell)
  const estate = estateForCell(cell)
  return Object.freeze({
    regionId: region.id,
    estateId: estate?.id ?? null,
  })
}

function normalizedRegion(value: string): string {
  return value.startsWith('region:') ? value : `region:${value}`
}

function forRegion<T extends { readonly regions: readonly string[] }>(
  definitions: readonly T[],
  regionId: AuthoredValleyRegionId,
): readonly T[] {
  const matches = definitions.filter((definition) =>
    definition.regions.some((candidate) => normalizedRegion(candidate) === regionId),
  )
  return matches.length > 0 ? matches : definitions
}

function indexRegionContent(registry: ContentRegistry): ReadonlyMap<AuthoredValleyRegionId, RegionContent> {
  const result = new Map<AuthoredValleyRegionId, RegionContent>()
  for (const region of AUTHORED_VALLEY_REGIONS) {
    result.set(region.id, Object.freeze({
      crops: Object.freeze([...forRegion(registry.crops, region.id)]),
      orchardPlants: Object.freeze([...forRegion(registry.orchardPlants, region.id)]),
      lights: Object.freeze([
        ...forRegion(
          registry.decorations.filter((definition) => definition.decorationType === 'light'),
          region.id,
        ),
      ]),
      paths: Object.freeze([
        ...forRegion(
          registry.decorations.filter((definition) => definition.decorationType === 'path'),
          region.id,
        ),
      ]),
    }))
  }
  return result
}

function selectDefinition<T>(definitions: readonly T[], seed: number, salt: string): T {
  if (definitions.length === 0) throw new Error(`Authored Valley cannot select empty ${salt} content`)
  return definitions[mixSeed(seed, salt) % definitions.length]!
}

function distanceToSegment(
  point: AuthoredValleyCellPoint,
  start: AuthoredValleyCellPoint,
  end: AuthoredValleyCellPoint,
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

function distanceToRoute(point: AuthoredValleyCellPoint, route: AuthoredRoute): number {
  let nearest = Number.POSITIVE_INFINITY
  for (let index = 1; index < route.points.length; index += 1) {
    nearest = Math.min(nearest, distanceToSegment(point, route.points[index - 1]!, route.points[index]!))
  }
  return nearest
}

function terrainHeightAt(worldX: number, worldZ: number, cellSize: number): number {
  return authoredValleyTerrainHeightAt(worldX, worldZ, cellSize)
}

function clipSegmentToBounds(
  segment: Segment,
  minimumX: number,
  maximumX: number,
  minimumZ: number,
  maximumZ: number,
): Segment | null {
  const dx = segment.end.x - segment.start.x
  const dz = segment.end.z - segment.start.z
  const p = [-dx, dx, -dz, dz]
  const q = [
    segment.start.x - minimumX,
    maximumX - segment.start.x,
    segment.start.z - minimumZ,
    maximumZ - segment.start.z,
  ]
  let entry = 0
  let exit = 1
  for (let index = 0; index < p.length; index += 1) {
    const denominator = p[index]!
    const numerator = q[index]!
    if (denominator === 0) {
      if (numerator < 0) return null
      continue
    }
    const amount = numerator / denominator
    if (denominator < 0) entry = Math.max(entry, amount)
    else exit = Math.min(exit, amount)
    if (entry > exit) return null
  }
  return {
    start: { x: segment.start.x + dx * entry, z: segment.start.z + dz * entry },
    end: { x: segment.start.x + dx * exit, z: segment.start.z + dz * exit },
  }
}

function routeSegmentsInCell(
  route: AuthoredRoute,
  coordinate: AuthoredValleyCellPoint,
): readonly Segment[] {
  const result: Segment[] = []
  const minimumX = coordinate.x
  const maximumX = coordinate.x + 1
  const minimumZ = coordinate.z
  const maximumZ = coordinate.z + 1
  for (let index = 1; index < route.points.length; index += 1) {
    const clipped = clipSegmentToBounds(
      { start: route.points[index - 1]!, end: route.points[index]! },
      minimumX,
      maximumX,
      minimumZ,
      maximumZ,
    )
    if (clipped) {
      const length = Math.hypot(clipped.end.x - clipped.start.x, clipped.end.z - clipped.start.z)
      if (length > 0.0001) result.push(clipped)
    }
  }
  return result
}

function createMaterial(
  resources: CellResources,
  color: number,
  options: ConstructorParameters<typeof MeshStandardMaterial>[0] = {},
): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: 0.88,
    metalness: 0,
    ...options,
  })
  resources.materials.push(material)
  return material
}

function ownGeometry<T extends BufferGeometry>(resources: CellResources, geometry: T): T {
  resources.geometries.push(geometry)
  return geometry
}

function addBoxCollider(
  colliders: StaticCollider[],
  id: string,
  centreX: number,
  centreZ: number,
  localX: number,
  baseY: number,
  localZ: number,
  width: number,
  height: number,
  depth: number,
): void {
  colliders.push(Object.freeze({
    id,
    bounds: Object.freeze({
      min: Object.freeze({
        x: centreX + localX - width / 2,
        y: baseY,
        z: centreZ + localZ - depth / 2,
      }),
      max: Object.freeze({
        x: centreX + localX + width / 2,
        y: baseY + height,
        z: centreZ + localZ + depth / 2,
      }),
    }),
  }))
}

function addTerrain(
  root: Group,
  resources: CellResources,
  context: ThreeWorldCellBuildContext,
  region: AuthoredValleyRegion,
  terrainSegments: number,
): void {
  const geometry = ownGeometry(
    resources,
    new PlaneGeometry(context.cellSize, context.cellSize, terrainSegments, terrainSegments),
  )
  geometry.rotateX(-Math.PI / 2)
  const position = geometry.getAttribute('position')
  const centreX = (context.descriptor.coordinate.x + 0.5) * context.cellSize
  const centreZ = (context.descriptor.coordinate.z + 0.5) * context.cellSize
  for (let index = 0; index < position.count; index += 1) {
    position.setY(
      index,
      terrainHeightAt(centreX + position.getX(index), centreZ + position.getZ(index), context.cellSize),
    )
  }
  position.needsUpdate = true
  geometry.computeVertexNormals()
  const shade = 0.92 + (context.descriptor.seed % 11) * 0.009
  const material = createMaterial(resources, region.terrainColor)
  material.color.multiplyScalar(shade)
  const terrain = new Mesh(geometry, material)
  terrain.name = `terrain:${region.id}:${context.descriptor.key}`
  terrain.receiveShadow = true
  root.add(terrain)
}

function addLinearSurface(
  root: Group,
  resources: CellResources,
  context: ThreeWorldCellBuildContext,
  segment: Segment,
  name: string,
  widthInCells: number,
  height: number,
  material: MeshStandardMaterial,
  verticalOffset: number,
): AuthoredValleyCellPoint {
  const startX = segment.start.x * context.cellSize
  const startZ = segment.start.z * context.cellSize
  const endX = segment.end.x * context.cellSize
  const endZ = segment.end.z * context.cellSize
  const dx = endX - startX
  const dz = endZ - startZ
  const length = Math.hypot(dx, dz)
  const middleX = (startX + endX) / 2
  const middleZ = (startZ + endZ) / 2
  const centreX = (context.descriptor.coordinate.x + 0.5) * context.cellSize
  const centreZ = (context.descriptor.coordinate.z + 0.5) * context.cellSize
  const geometry = ownGeometry(
    resources,
    new BoxGeometry(widthInCells * context.cellSize, height, length + 0.03),
  )
  const mesh = new Mesh(geometry, material)
  mesh.name = name
  mesh.position.set(
    middleX - centreX,
    terrainHeightAt(middleX, middleZ, context.cellSize) + verticalOffset,
    middleZ - centreZ,
  )
  mesh.rotation.y = Math.atan2(dx, dz)
  mesh.receiveShadow = true
  root.add(mesh)
  return { x: middleX - centreX, z: middleZ - centreZ }
}

function addTree(
  root: Group,
  resources: CellResources,
  colliders: StaticCollider[],
  context: ThreeWorldCellBuildContext,
  region: AuthoredValleyRegion,
  plant: OrchardPlantDef,
  localX: number,
  localZ: number,
  index: number,
  scale: number,
): void {
  const centreX = (context.descriptor.coordinate.x + 0.5) * context.cellSize
  const centreZ = (context.descriptor.coordinate.z + 0.5) * context.cellSize
  const baseY = terrainHeightAt(centreX + localX, centreZ + localZ, context.cellSize)
  const trunkHeight = 1.2 * scale
  const tree = new Group()
  tree.name = `orchard:${plant.id}:${index}`
  tree.position.set(localX, baseY, localZ)

  const trunk = new Mesh(
    ownGeometry(resources, new CylinderGeometry(0.13 * scale, 0.19 * scale, trunkHeight, 6)),
    createMaterial(resources, 0x69462e),
  )
  trunk.position.y = trunkHeight / 2
  trunk.castShadow = true
  trunk.receiveShadow = true
  tree.add(trunk)

  const canopy = new Mesh(
    ownGeometry(resources, new DodecahedronGeometry(0.68 * scale, 0)),
    createMaterial(resources, region.foliageColor),
  )
  canopy.position.y = trunkHeight + 0.35 * scale
  canopy.scale.set(1, 0.88, 1)
  canopy.castShadow = true
  canopy.receiveShadow = true
  tree.add(canopy)
  root.add(tree)

  addBoxCollider(
    colliders,
    `${context.descriptor.key}:tree:${index}:${plant.id}`,
    centreX,
    centreZ,
    localX,
    baseY,
    localZ,
    0.38 * scale,
    trunkHeight + 0.5 * scale,
    0.38 * scale,
  )
}

const ESTATE_FARM_SYNC_KEY = 'estateFarmSync'
const ESTATE_FARM_DISPOSE_KEY = 'estateFarmDispose'

function estateGroundColor(
  ground: Valley3DEstateFarmingStateV1['plotTiles'][string]['ground'] | undefined,
  region: AuthoredValleyRegion,
  watered: boolean,
  fertilized: boolean,
): number {
  if (ground === 'soil') {
    if (watered) return fertilized ? 0x3f342c : 0x51443a
    return fertilized ? 0x58402c : region.soilColor
  }
  if (ground === 'rock') return 0x747b76
  if (ground === 'log') return 0x6a4931
  if (ground === 'weeds') return 0x4f7b3d
  return region.terrainColor
}

function addEstateFarmingPresentation(
  root: Group,
  context: ThreeWorldCellBuildContext,
  region: AuthoredValleyRegion,
  estate: AuthoredEstateZone,
  initial: Valley3DEstateFarmingStateV1 | null,
): void {
  const layout = ESTATE_FARM_LAYOUTS.find((candidate) => candidate.estateId === estate.id)
  if (layout === undefined) return
  const presentation = new Group()
  presentation.name = `estate-farming-state:${estate.id}`
  root.add(presentation)

  let geometries: BufferGeometry[] = []
  let materials: Material[] = []
  const disposeDynamic = (): void => {
    presentation.clear()
    for (const geometry of geometries) geometry.dispose()
    for (const material of materials) material.dispose()
    geometries = []
    materials = []
  }
  const geometry = <T extends BufferGeometry>(value: T): T => {
    geometries.push(value)
    return value
  }
  const material = (color: ColorRepresentation): MeshStandardMaterial => {
    const value = new MeshStandardMaterial({ color, roughness: 0.9, flatShading: true })
    materials.push(value)
    return value
  }
  const centreX = (context.descriptor.coordinate.x + 0.5) * context.cellSize
  const centreZ = (context.descriptor.coordinate.z + 0.5) * context.cellSize

  const sync = (state: Valley3DEstateFarmingStateV1 | null): void => {
    disposeDynamic()
    for (let localZ = layout.field.minLocalZ; localZ <= layout.field.maxLocalZ; localZ += 1) {
      for (let localX = layout.field.minLocalX; localX <= layout.field.maxLocalX; localX += 1) {
        const { worldX, worldZ } = estateWorldCoordinate(layout, localX, localZ)
        const key = estateFarmKey(layout.estateId, worldX, worldZ)
        const saved = state?.plotTiles[key]
        const worldCentreX = worldX + 0.5
        const worldCentreZ = worldZ + 0.5
        const localCentreX = worldCentreX - centreX
        const localCentreZ = worldCentreZ - centreZ
        const groundY = terrainHeightAt(worldCentreX, worldCentreZ, context.cellSize)
        const tile = new Mesh(
          geometry(new BoxGeometry(0.94, 0.08, 0.94)),
          material(estateGroundColor(saved?.ground, region, saved?.watered === true, saved?.fertilized === true)),
        )
        tile.name = `estate-plot:${key}`
        tile.position.set(localCentreX, groundY + 0.035, localCentreZ)
        tile.receiveShadow = true
        tile.userData = {
          semantic: 'estate-farm-tile',
          estateFarmKey: key,
          estateId: layout.estateId,
          worldX,
          worldZ,
          farmable: true,
          label: saved?.plant?.cropId ?? `${saved?.ground ?? 'grass'} estate plot`,
        }
        presentation.add(tile)

        if (saved?.plant !== null && saved?.plant !== undefined) {
          const crop = cropById(saved.plant.cropId)
          const height = crop === undefined
            ? 0.18
            : Math.max(0.16, (saved.plant.stage + 1) / (crop.stageDays.length + 1) * 0.9)
          const plant = new Mesh(
            geometry(new ConeGeometry(0.16 + height * 0.08, height, 6)),
            material(saved.plant.dead ? 0x756c55 : (crop?.art.fruit ?? region.cropColor)),
          )
          plant.name = `estate-crop:${saved.plant.cropId}:${key}`
          plant.position.set(localCentreX, groundY + 0.08 + height / 2, localCentreZ)
          plant.castShadow = true
          plant.userData = { ...tile.userData, semantic: 'estate-farm-crop', label: crop?.name ?? saved.plant.cropId }
          presentation.add(plant)
        } else if (saved?.ground === 'weeds' || saved?.ground === 'rock' || saved?.ground === 'log') {
          const debris = new Mesh(
            saved.ground === 'rock'
              ? geometry(new DodecahedronGeometry(0.24, 0))
              : geometry(new BoxGeometry(saved.ground === 'log' ? 0.58 : 0.3, 0.24, 0.24)),
            material(saved.ground === 'rock' ? 0x757c79 : saved.ground === 'log' ? 0x6a4931 : 0x3f6f35),
          )
          debris.name = `estate-debris:${saved.ground}:${key}`
          debris.position.set(localCentreX, groundY + 0.16, localCentreZ)
          debris.castShadow = true
          debris.userData = { ...tile.userData, semantic: 'estate-farm-debris', label: saved.ground }
          presentation.add(debris)
        }
      }
    }

    for (const slot of layout.orchardSlots) {
      const { worldX, worldZ } = estateWorldCoordinate(layout, slot.localX, slot.localZ)
      const key = estateFarmKey(layout.estateId, worldX, worldZ)
      const saved = state?.trees[key]
      const localCentreX = worldX + 0.5 - centreX
      const localCentreZ = worldZ + 0.5 - centreZ
      const groundY = terrainHeightAt(worldX + 0.5, worldZ + 0.5, context.cellSize)
      const pad = new Mesh(
        geometry(new CylinderGeometry(0.43, 0.43, 0.07, 12)),
        material(saved === undefined ? 0x92734d : region.soilColor),
      )
      pad.name = `estate-orchard-slot:${key}`
      pad.position.set(localCentreX, groundY + 0.035, localCentreZ)
      pad.receiveShadow = true
      pad.userData = {
        semantic: 'estate-orchard-slot',
        estateFarmKey: key,
        estateId: layout.estateId,
        worldX,
        worldZ,
        farmable: true,
        label: saved?.plant.cropId ?? 'Empty orchard slot',
      }
      presentation.add(pad)
      if (saved === undefined) continue
      const definition = treeById(saved.plant.cropId)
      const maturity = definition === undefined
        ? 0.35
        : Math.max(0.25, Math.min(1, (saved.plant.stage + 1) / (definition.stageDays.length + 1)))
      const tree = new Group()
      tree.name = `estate-orchard-tree:${saved.plant.cropId}:${key}`
      tree.position.set(localCentreX, groundY + 0.07, localCentreZ)
      tree.userData = { ...pad.userData, semantic: 'estate-orchard-tree', label: definition?.name ?? saved.plant.cropId }
      const trunkHeight = 0.55 + maturity * 0.85
      const trunk = new Mesh(
        geometry(new CylinderGeometry(0.1, 0.15, trunkHeight, 7)),
        material(definition?.art.stem ?? 0x69462e),
      )
      trunk.position.y = trunkHeight / 2
      trunk.castShadow = true
      const canopy = new Mesh(
        geometry(new DodecahedronGeometry(0.35 + maturity * 0.4, 0)),
        material(saved.plant.dead ? 0x716b58 : (definition?.art.leaf ?? region.foliageColor)),
      )
      canopy.position.y = trunkHeight + 0.26
      canopy.castShadow = true
      tree.add(trunk, canopy)
      presentation.add(tree)
    }
  }

  root.userData[ESTATE_FARM_SYNC_KEY] = sync
  root.userData[ESTATE_FARM_DISPOSE_KEY] = disposeDynamic
  sync(initial)
}

/** Refreshes a resident authored cell after a save-backed estate action. */
export function syncAuthoredEstateFarmingCell(
  root: Object3D,
  state: Valley3DEstateFarmingStateV1,
): boolean {
  const sync = root.userData[ESTATE_FARM_SYNC_KEY]
  if (typeof sync !== 'function') return false
  ;(sync as (value: Valley3DEstateFarmingStateV1) => void)(state)
  return true
}

function addBuilding(
  root: Group,
  resources: CellResources,
  colliders: StaticCollider[],
  context: ThreeWorldCellBuildContext,
  region: AuthoredValleyRegion,
  placement: AuthoredStructurePlacement,
): void {
  if (placement.structureKind !== 'building' || placement.definition.kind !== 'building') {
    throw new Error(`Building renderer received ${placement.contentStructureId} as ${placement.structureKind}`)
  }
  const building = placement.definition
  const { x: localX, z: localZ } = placement.localPosition
  const centreX = (context.descriptor.coordinate.x + 0.5) * context.cellSize
  const centreZ = (context.descriptor.coordinate.z + 0.5) * context.cellSize
  const { width, depth } = placement.footprint
  const height = 2.05 + (mixSeed(context.descriptor.seed, building.id) % 4) * 0.18
  const exteriorArchetype = building.buildingType === 'residential'
    ? 'cottage-chimney'
    : ['civic', 'education', 'health'].includes(building.buildingType)
      ? 'public-cupola'
      : ['commercial', 'hospitality', 'recreation'].includes(building.buildingType)
        ? 'public-awning'
        : 'service-annex'
  const baseY = terrainHeightAt(centreX + localX, centreZ + localZ, context.cellSize)
  const structure = new Group()
  structure.name = placement.id
  structure.position.set(localX, baseY, localZ)
  structure.rotation.y = placement.facingYaw
  structure.userData = {
    semantic: 'authored-structure',
    structureKind: 'building',
    contentStructureId: building.id,
    placementId: placement.id,
    placementOrdinal: placement.ordinal,
    interiorGraphId: placement.interiorGraphId,
    interiorEntryDoorId: placement.interiorEntryDoorId,
    interiorEntryRoomId: placement.interiorEntryRoomId,
    regionId: placement.regionId,
    districtId: placement.district.id,
    roadId: placement.road.id,
    footprint: placement.footprint,
    entrance: placement.entrance,
    exteriorArchetype,
    label: building.name,
    definition: building,
  }

  const body = new Mesh(
    ownGeometry(resources, new BoxGeometry(width, height, depth)),
    createMaterial(resources, region.soilColor, { roughness: 0.82 }),
  )
  body.position.y = height / 2
  body.castShadow = true
  body.receiveShadow = true
  structure.add(body)

  const roof = new Mesh(
    ownGeometry(resources, new ConeGeometry(Math.max(width, depth) * 0.72, 0.8, 4)),
    createMaterial(resources, region.roofColor, { roughness: 0.76 }),
  )
  roof.name = `${building.id}:roof`
  roof.position.y = height + 0.36
  roof.rotation.y = Math.PI / 4
  roof.scale.z = depth / width
  roof.castShadow = true
  roof.receiveShadow = true
  structure.add(roof)

  const accentMaterial = createMaterial(resources, 0x6f5743, { roughness: 0.8 })
  if (exteriorArchetype === 'public-cupola') {
    const cupola = new Mesh(
      ownGeometry(resources, new CylinderGeometry(0.32, 0.38, 0.58, 8)),
      accentMaterial,
    )
    cupola.name = `${placement.id}:cupola`
    cupola.position.y = height + 0.92
    cupola.castShadow = true
    structure.add(cupola)
  } else if (exteriorArchetype === 'cottage-chimney') {
    const chimney = new Mesh(
      ownGeometry(resources, new BoxGeometry(0.32, 1.05, 0.32)),
      accentMaterial,
    )
    chimney.name = `${placement.id}:chimney`
    chimney.position.set(width * 0.24, height + 0.42, -depth * 0.18)
    chimney.castShadow = true
    structure.add(chimney)
  } else if (exteriorArchetype === 'service-annex') {
    const annex = new Mesh(
      ownGeometry(resources, new BoxGeometry(width * 0.32, height * 0.58, depth * 0.66)),
      createMaterial(resources, region.roofColor, { roughness: 0.82 }),
    )
    annex.name = `${placement.id}:service-annex`
    annex.position.set(width * 0.34, height * 0.29, -depth * 0.05)
    annex.castShadow = true
    annex.receiveShadow = true
    structure.add(annex)
  }

  const door = new Mesh(
    ownGeometry(resources, new BoxGeometry(0.58, 1.18, 0.08)),
    createMaterial(resources, 0x48372b),
  )
  door.name = placement.entrance.id
  door.position.set(0, 0.59, depth / 2 + 0.045)
  door.userData = {
    semantic: 'authored-structure-door',
    interactive: true,
    structureKind: 'building',
    contentStructureId: building.id,
    placementId: placement.id,
    interiorGraphId: placement.interiorGraphId,
    interiorEntryDoorId: placement.interiorEntryDoorId,
    interiorEntryRoomId: placement.interiorEntryRoomId,
    entranceId: placement.entrance.id,
    approachPosition: placement.entrance.approachPosition,
    realDestination: true,
    label: placement.entrance.accessibleLabel,
    definition: building,
  }
  structure.add(door)

  const entranceCanopy = new Mesh(
    ownGeometry(resources, new BoxGeometry(1.15, 0.12, 0.62)),
    createMaterial(resources, region.roofColor, { roughness: 0.72 }),
  )
  entranceCanopy.name = `${placement.id}:entrance-canopy`
  entranceCanopy.position.set(0, 1.42, depth / 2 + 0.3)
  entranceCanopy.rotation.x = -0.14
  entranceCanopy.castShadow = true
  structure.add(entranceCanopy)

  const entranceSign = new Mesh(
    ownGeometry(resources, new BoxGeometry(0.72, 0.34, 0.08)),
    createMaterial(resources, 0xe5c274, { roughness: 0.58 }),
  )
  entranceSign.name = `${placement.id}:entrance-sign`
  entranceSign.position.set(width * 0.28, 1.58, depth / 2 + 0.07)
  entranceSign.userData = {
    semantic: 'authored-structure-entrance-sign',
    placementId: placement.id,
    contentStructureId: building.id,
    label: building.name,
    entranceId: placement.entrance.id,
    interiorGraphId: placement.interiorGraphId,
  }
  structure.add(entranceSign)

  const windowMaterial = createMaterial(resources, 0xf6d890, {
    emissive: 0x9a6323,
    emissiveIntensity: 0.38,
    roughness: 0.32,
  })
  for (const side of [-1, 1]) {
    const window = new Mesh(
      ownGeometry(resources, new BoxGeometry(0.38, 0.42, 0.06)),
      windowMaterial,
    )
    window.position.set(side * width * 0.28, height * 0.58, depth / 2 + 0.04)
    structure.add(window)
  }
  root.add(structure)

  addBoxCollider(
    colliders,
    placement.collisionId,
    centreX,
    centreZ,
    localX,
    baseY,
    localZ,
    width,
    height + 0.6,
    depth,
  )
}

function addFactory(
  root: Group,
  resources: CellResources,
  colliders: StaticCollider[],
  context: ThreeWorldCellBuildContext,
  region: AuthoredValleyRegion,
  placement: AuthoredStructurePlacement,
): void {
  if (placement.structureKind !== 'factory' || placement.definition.kind !== 'factory') {
    throw new Error(`Factory renderer received ${placement.contentStructureId} as ${placement.structureKind}`)
  }
  const factory = placement.definition
  const { x: localX, z: localZ } = placement.localPosition
  const centreX = (context.descriptor.coordinate.x + 0.5) * context.cellSize
  const centreZ = (context.descriptor.coordinate.z + 0.5) * context.cellSize
  const { width, depth } = placement.footprint
  const height = 2.25
  const silhouetteVariant = mixSeed(context.descriptor.seed, factory.factoryType) % 3
  const exteriorArchetype = silhouetteVariant === 0
    ? 'roof-tank'
    : silhouetteVariant === 1
      ? 'monitor-hall'
      : 'hopper-hall'
  const baseY = terrainHeightAt(centreX + localX, centreZ + localZ, context.cellSize)
  const structure = new Group()
  structure.name = placement.id
  structure.position.set(localX, baseY, localZ)
  structure.rotation.y = placement.facingYaw
  structure.userData = {
    semantic: 'authored-structure',
    structureKind: 'factory',
    contentStructureId: factory.id,
    placementId: placement.id,
    placementOrdinal: placement.ordinal,
    interiorGraphId: placement.interiorGraphId,
    interiorEntryDoorId: placement.interiorEntryDoorId,
    interiorEntryRoomId: placement.interiorEntryRoomId,
    regionId: placement.regionId,
    districtId: placement.district.id,
    roadId: placement.road.id,
    footprint: placement.footprint,
    entrance: placement.entrance,
    exteriorArchetype,
    label: factory.name,
    definition: factory,
  }

  const body = new Mesh(
    ownGeometry(resources, new BoxGeometry(width, height, depth)),
    createMaterial(resources, 0x737267, { roughness: 0.74, metalness: 0.08 }),
  )
  body.position.y = height / 2
  body.castShadow = true
  body.receiveShadow = true
  structure.add(body)

  const roof = new Mesh(
    ownGeometry(resources, new BoxGeometry(width + 0.15, 0.22, depth + 0.15)),
    createMaterial(resources, region.roofColor, { roughness: 0.7, metalness: 0.08 }),
  )
  roof.position.y = height + 0.11
  roof.castShadow = true
  structure.add(roof)

  if (exteriorArchetype === 'roof-tank') {
    const tank = new Mesh(
      ownGeometry(resources, new CylinderGeometry(0.5, 0.58, 1.08, 10)),
      createMaterial(resources, 0x657478, { roughness: 0.52, metalness: 0.26 }),
    )
    tank.name = `${placement.id}:roof-tank`
    tank.position.set(-width * 0.22, height + 0.72, 0)
    tank.castShadow = true
    structure.add(tank)
  } else if (exteriorArchetype === 'monitor-hall') {
    const monitor = new Mesh(
      ownGeometry(resources, new BoxGeometry(width * 0.56, 0.62, depth * 0.42)),
      createMaterial(resources, 0x879296, { roughness: 0.58, metalness: 0.14 }),
    )
    monitor.name = `${placement.id}:roof-monitor`
    monitor.position.set(0, height + 0.42, 0)
    monitor.castShadow = true
    structure.add(monitor)
  } else {
    const hopper = new Mesh(
      ownGeometry(resources, new ConeGeometry(0.62, 1.18, 8)),
      createMaterial(resources, 0x7e7567, { roughness: 0.68, metalness: 0.1 }),
    )
    hopper.name = `${placement.id}:roof-hopper`
    hopper.position.set(width * 0.22, height + 0.72, -depth * 0.08)
    hopper.rotation.x = Math.PI
    hopper.castShadow = true
    structure.add(hopper)
  }

  const chimneyMaterial = createMaterial(resources, 0x4a4d4a, { roughness: 0.66, metalness: 0.18 })
  const ventCount = 1 + (mixSeed(context.descriptor.seed, factory.factoryType) % 3)
  for (let index = 0; index < ventCount; index += 1) {
    const chimney = new Mesh(
      ownGeometry(resources, new CylinderGeometry(0.18, 0.22, 1.35, 8)),
      chimneyMaterial,
    )
    chimney.name = `${factory.id}:vent:${index}`
    chimney.position.set(
      ventCount === 1 ? 0 : -width * 0.28 + index * (width * 0.56 / (ventCount - 1)),
      height + 0.78,
      -depth * 0.18,
    )
    chimney.castShadow = true
    structure.add(chimney)
  }

  const loadingDoor = new Mesh(
    ownGeometry(resources, new BoxGeometry(width * 0.36, 1.35, 0.08)),
    createMaterial(resources, 0x4d5d61, { roughness: 0.62, metalness: 0.18 }),
  )
  loadingDoor.name = placement.entrance.id
  loadingDoor.position.set(0, 0.68, depth / 2 + 0.045)
  loadingDoor.userData = {
    semantic: 'authored-structure-door',
    interactive: true,
    structureKind: 'factory',
    contentStructureId: factory.id,
    placementId: placement.id,
    interiorGraphId: placement.interiorGraphId,
    interiorEntryDoorId: placement.interiorEntryDoorId,
    interiorEntryRoomId: placement.interiorEntryRoomId,
    entranceId: placement.entrance.id,
    approachPosition: placement.entrance.approachPosition,
    realDestination: true,
    label: placement.entrance.accessibleLabel,
    definition: factory,
  }
  structure.add(loadingDoor)

  const loadingCanopy = new Mesh(
    ownGeometry(resources, new BoxGeometry(width * 0.52, 0.14, 0.72)),
    createMaterial(resources, region.roofColor, { roughness: 0.64, metalness: 0.12 }),
  )
  loadingCanopy.name = `${placement.id}:entrance-canopy`
  loadingCanopy.position.set(0, 1.58, depth / 2 + 0.34)
  loadingCanopy.rotation.x = -0.12
  loadingCanopy.castShadow = true
  structure.add(loadingCanopy)

  const entranceSign = new Mesh(
    ownGeometry(resources, new BoxGeometry(width * 0.5, 0.34, 0.08)),
    createMaterial(resources, 0xe1c46f, { roughness: 0.52, metalness: 0.04 }),
  )
  entranceSign.name = `${placement.id}:entrance-sign`
  entranceSign.position.set(0, 1.9, depth / 2 + 0.08)
  entranceSign.userData = {
    semantic: 'authored-structure-entrance-sign',
    placementId: placement.id,
    contentStructureId: factory.id,
    label: factory.name,
    entranceId: placement.entrance.id,
    interiorGraphId: placement.interiorGraphId,
  }
  structure.add(entranceSign)
  root.add(structure)

  addBoxCollider(
    colliders,
    placement.collisionId,
    centreX,
    centreZ,
    localX,
    baseY,
    localZ,
    width,
    height + 1.25,
    depth,
  )
}

function addLantern(
  root: Group,
  resources: CellResources,
  colliders: StaticCollider[],
  context: ThreeWorldCellBuildContext,
  definition: DecorationDef,
  localX: number,
  localZ: number,
  index: number,
  pointLights: boolean,
): void {
  const centreX = (context.descriptor.coordinate.x + 0.5) * context.cellSize
  const centreZ = (context.descriptor.coordinate.z + 0.5) * context.cellSize
  const baseY = terrainHeightAt(centreX + localX, centreZ + localZ, context.cellSize)
  const group = new Group()
  group.name = `light:${definition.id}:${index}`
  group.position.set(localX, baseY, localZ)
  const pole = new Mesh(
    ownGeometry(resources, new CylinderGeometry(0.055, 0.08, 1.65, 6)),
    createMaterial(resources, 0x343c36, { roughness: 0.55, metalness: 0.34 }),
  )
  pole.position.y = 0.825
  pole.castShadow = true
  group.add(pole)
  const lampMaterial = createMaterial(resources, 0xffd67b, {
    emissive: 0xffa733,
    emissiveIntensity: 1.2,
    roughness: 0.24,
  })
  const lamp = new Mesh(
    ownGeometry(resources, new SphereGeometry(0.17, 8, 6)),
    lampMaterial,
  )
  lamp.position.y = 1.68
  group.add(lamp)
  if (pointLights) {
    const light = new PointLight(
      0xffc66c,
      0.72,
      Math.max(3, definition.functionality.lightRadius),
      2,
    )
    light.position.y = 1.68
    group.add(light)
  }
  root.add(group)
  addBoxCollider(
    colliders,
    `${context.descriptor.key}:light:${index}:${definition.id}`,
    centreX,
    centreZ,
    localX,
    baseY,
    localZ,
    0.18,
    1.7,
    0.18,
  )
}

function addFenceLine(
  root: Group,
  resources: CellResources,
  context: ThreeWorldCellBuildContext,
  material: MeshStandardMaterial,
  localX: number,
  localZ: number,
  length: number,
  alongX: boolean,
  name: string,
): void {
  const centreX = (context.descriptor.coordinate.x + 0.5) * context.cellSize
  const centreZ = (context.descriptor.coordinate.z + 0.5) * context.cellSize
  const baseY = terrainHeightAt(centreX + localX, centreZ + localZ, context.cellSize)
  const rail = new Mesh(
    ownGeometry(
      resources,
      new BoxGeometry(alongX ? length : 0.1, 0.1, alongX ? 0.1 : length),
    ),
    material,
  )
  rail.name = name
  rail.position.set(localX, baseY + 0.72, localZ)
  rail.castShadow = true
  root.add(rail)
  const postGeometry = ownGeometry(resources, new BoxGeometry(0.13, 1.05, 0.13))
  for (const direction of [-1, 1]) {
    const post = new Mesh(postGeometry, material)
    post.position.set(
      localX + (alongX ? direction * length / 2 : 0),
      baseY + 0.52,
      localZ + (alongX ? 0 : direction * length / 2),
    )
    post.castShadow = true
    root.add(post)
  }
}

function addEstateFarm(
  root: Group,
  resources: CellResources,
  colliders: StaticCollider[],
  context: ThreeWorldCellBuildContext,
  region: AuthoredValleyRegion,
  estate: AuthoredEstateZone,
  content: RegionContent,
  placements: readonly AuthoredStructurePlacement[],
  pointLights: boolean,
  estateFarming: Valley3DEstateFarmingStateV1 | null,
): void {
  const seed = mixSeed(context.descriptor.seed, estate.id)
  const firstCrop = selectDefinition(content.crops, seed, `${estate.id}:crop:first`)
  const secondCrop = selectDefinition(content.crops, seed, `${estate.id}:crop:second`)
  const orchard = selectDefinition(content.orchardPlants, seed, `${estate.id}:orchard`)
  const light = selectDefinition(content.lights, seed, `${estate.id}:light`)

  root.userData.estate = Object.freeze({
    id: estate.id,
    name: estate.name,
    approachName: estate.approachName,
    cropIds: Object.freeze([firstCrop.id, secondCrop.id]),
    orchardPlantId: orchard.id,
    structurePlacementIds: Object.freeze(placements.map((placement) => placement.id)),
    buildingId: placements.find((placement) => placement.structureKind === 'building')?.contentStructureId ?? null,
    factoryId: placements.find((placement) => placement.structureKind === 'factory')?.contentStructureId ?? null,
  })

  addEstateFarmingPresentation(root, context, region, estate, estateFarming)
  const fenceMaterial = createMaterial(resources, 0x725439)
  const fenceWidth = context.cellSize * 0.44
  const fenceDepth = context.cellSize * 0.36
  addFenceLine(root, resources, context, fenceMaterial, 0, fenceDepth, fenceWidth, true, `${estate.id}:north-fence`)
  addFenceLine(root, resources, context, fenceMaterial, 0, -fenceDepth, fenceWidth, true, `${estate.id}:south-fence`)
  addFenceLine(root, resources, context, fenceMaterial, -fenceWidth / 2, 0, fenceDepth * 2, false, `${estate.id}:west-fence`)
  addFenceLine(root, resources, context, fenceMaterial, fenceWidth / 2, context.cellSize * 0.13, fenceDepth * 0.65, false, `${estate.id}:east-fence-a`)
  addFenceLine(root, resources, context, fenceMaterial, fenceWidth / 2, -context.cellSize * 0.13, fenceDepth * 0.65, false, `${estate.id}:east-fence-b`)
  addLantern(
    root,
    resources,
    colliders,
    context,
    light,
    context.cellSize * 0.39,
    0,
    100,
    pointLights,
  )
}

function addAuthoredStructurePlacements(
  root: Group,
  resources: CellResources,
  colliders: StaticCollider[],
  context: ThreeWorldCellBuildContext,
  region: AuthoredValleyRegion,
  content: RegionContent,
  placements: readonly AuthoredStructurePlacement[],
  pointLights: boolean,
): void {
  if (placements.length === 0) return
  const coordinate = context.descriptor.coordinate
  const districtRows = [...new Map(placements.map((placement) => [
    placement.district.id,
    placement.district,
  ])).values()]
  const roadRows = [...new Map(placements.map((placement) => [
    placement.road.id,
    placement.road,
  ])).values()]
  root.userData.structurePlacements = Object.freeze(placements.map((placement) => Object.freeze({
    placementId: placement.id,
    contentStructureId: placement.contentStructureId,
    structureKind: placement.structureKind,
    label: placement.label,
    interiorGraphId: placement.interiorGraphId,
    interiorEntryDoorId: placement.interiorEntryDoorId,
    districtId: placement.district.id,
    roadId: placement.road.id,
    entrance: placement.entrance,
  })))
  root.userData.districts = Object.freeze(districtRows)
  root.userData.structureRoads = Object.freeze(roadRows)

  const laneDefinition = selectDefinition(content.paths, context.descriptor.seed, 'structure-access-lane')
  const laneMaterial = createMaterial(resources, 0x9b7b50, { roughness: 0.98 })
  laneMaterial.name = laneDefinition.id
  const laneName = `structure-access-lane:${context.descriptor.key}`
  addLinearSurface(
    root,
    resources,
    context,
    {
      start: { x: coordinate.x, z: coordinate.z + 0.5 },
      end: { x: coordinate.x + 1, z: coordinate.z + 0.5 },
    },
    laneName,
    0.13,
    0.065,
    laneMaterial,
    0.035,
  )
  const lane = root.getObjectByName(laneName)
  if (lane !== undefined) {
    lane.userData = {
      semantic: 'authored-structure-access-lane',
      interactive: false,
      cellKey: context.descriptor.key,
      roadIds: Object.freeze(roadRows.map((road) => road.id)),
      placementIds: Object.freeze(placements.map((placement) => placement.id)),
      pathDefinitionId: laneDefinition.id,
    }
  }

  for (const placement of placements) {
    if (placement.structureKind === 'factory') {
      addFactory(root, resources, colliders, context, region, placement)
    } else {
      addBuilding(root, resources, colliders, context, region, placement)
    }
  }

  const light = selectDefinition(content.lights, context.descriptor.seed, 'structure-lane-light')
  addLantern(
    root,
    resources,
    colliders,
    context,
    light,
    context.cellSize * 0.43,
    0,
    200,
    pointLights,
  )
}

function addScatteredVegetation(
  root: Group,
  resources: CellResources,
  colliders: StaticCollider[],
  context: ThreeWorldCellBuildContext,
  region: AuthoredValleyRegion,
  content: RegionContent,
  hasEstate: boolean,
  placements: readonly AuthoredStructurePlacement[],
): void {
  if (hasEstate) return
  const random = seededRandom(mixSeed(context.descriptor.seed, `vegetation:${region.id}`))
  const density = region.id === 'region:forest' ? 7 : region.id === 'region:arid' ? 2 : 4
  const plant = selectDefinition(content.orchardPlants, context.descriptor.seed, 'wild-orchard')
  let placed = 0
  let attempts = 0
  while (placed < density && attempts < density * 5) {
    attempts += 1
    const localX = (random() - 0.5) * context.cellSize * 0.82
    const localZ = (random() - 0.5) * context.cellSize * 0.82
    const cellPoint = {
      x: context.descriptor.coordinate.x + 0.5 + localX / context.cellSize,
      z: context.descriptor.coordinate.z + 0.5 + localZ / context.cellSize,
    }
    const nearRoad = AUTHORED_ROADS.some((route) => distanceToRoute(cellPoint, route) < ROAD_WIDTH_IN_CELLS * 1.6)
    const nearRiver = distanceToRoute(cellPoint, AUTHORED_RIVER) < RIVER_WIDTH_IN_CELLS * 1.5
    const nearStructure = placements.some((placement) =>
      Math.abs(localX - placement.localPosition.x) < placement.footprint.width / 2 + placement.footprint.clearance + 0.7 &&
      Math.abs(localZ - placement.localPosition.z) < placement.footprint.depth / 2 + placement.footprint.clearance + 0.7,
    )
    const nearAccessLane = Math.abs(localZ) < context.cellSize * 0.12
    if (nearRoad || nearRiver || nearStructure || nearAccessLane) continue
    addTree(
      root,
      resources,
      colliders,
      context,
      region,
      plant,
      localX,
      localZ,
      placed,
      0.72 + random() * 0.38,
    )
    placed += 1
  }
}

function addBoundaryRidge(
  root: Group,
  resources: CellResources,
  colliders: StaticCollider[],
  context: ThreeWorldCellBuildContext,
): void {
  const centreX = (context.descriptor.coordinate.x + 0.5) * context.cellSize
  const centreZ = (context.descriptor.coordinate.z + 0.5) * context.cellSize
  const ridgeMaterial = createMaterial(resources, 0x59615c, { roughness: 0.98 })
  const random = seededRandom(mixSeed(context.descriptor.seed, 'boundary-ridge'))
  for (let index = 0; index < 5; index += 1) {
    const radius = context.cellSize * (0.18 + random() * 0.11)
    const geometry = ownGeometry(resources, new DodecahedronGeometry(radius, 0))
    const rock = new Mesh(geometry, ridgeMaterial)
    rock.name = `valley-boundary-rock:${context.descriptor.key}:${index}`
    rock.position.set(
      (random() - 0.5) * context.cellSize * 0.72,
      radius * (0.35 + random() * 0.25),
      (random() - 0.5) * context.cellSize * 0.72,
    )
    rock.scale.y = 1.2 + random() * 0.8
    rock.castShadow = true
    rock.receiveShadow = true
    root.add(rock)
  }
  colliders.push(Object.freeze({
    id: `${context.descriptor.key}:authored-valley-boundary`,
    bounds: Object.freeze({
      min: Object.freeze({ x: centreX - context.cellSize / 2, y: -1, z: centreZ - context.cellSize / 2 }),
      max: Object.freeze({ x: centreX + context.cellSize / 2, y: context.cellSize, z: centreZ + context.cellSize / 2 }),
    }),
  }))
  root.userData.boundary = Object.freeze({
    kind: 'natural-ridge',
    message: 'The authored valley continues only through its marked passes.',
  })
}

function buildAuthoredCell(
  context: ThreeWorldCellBuildContext,
  registry: ContentRegistry,
  regionContent: ReadonlyMap<AuthoredValleyRegionId, RegionContent>,
  structurePlacements: AuthoredStructurePlacementRegistry,
  pointLights: boolean,
  terrainSegments: number,
  estateFarming: () => Valley3DEstateFarmingStateV1 | null,
): ThreeWorldCellContent {
  if (context.signal.aborted) {
    const error = new Error('Authored Valley cell load was aborted')
    error.name = 'AbortError'
    throw error
  }
  const coordinate = context.descriptor.coordinate
  const logicalPoint = { x: coordinate.x, z: coordinate.z }
  const region = regionForCell(logicalPoint)
  const content = regionContent.get(region.id)
  if (!content) throw new Error(`Missing authored content index for ${region.id}`)
  const placements = authoredStructurePlacementsForCell(logicalPoint, structurePlacements)
  const root = new Group()
  root.name = `authored-valley-cell:${context.descriptor.key}`
  const centreX = (coordinate.x + 0.5) * context.cellSize
  const centreZ = (coordinate.z + 0.5) * context.cellSize
  root.position.set(centreX, 0, centreZ)
  root.userData.authoredValley = Object.freeze({
    regionId: region.id,
    regionName: region.name,
    cellKey: context.descriptor.key,
    registryFingerprint: registry.fingerprint,
    deterministicSeed: context.descriptor.seed,
    structurePlacementIds: Object.freeze(placements.map((placement) => placement.id)),
    structurePlacementCount: placements.length,
  })

  const resources: CellResources = { geometries: [], materials: [] }
  const colliders: StaticCollider[] = []
  addTerrain(root, resources, context, region, terrainSegments)

  if (!withinValley(logicalPoint)) {
    addBoundaryRidge(root, resources, colliders, context)
    return {
      root,
      colliders: Object.freeze(colliders),
      dispose: () => {
        for (const geometry of resources.geometries) geometry.dispose()
        for (const material of resources.materials) material.dispose()
      },
    }
  }

  const pathDefinition = selectDefinition(content.paths, context.descriptor.seed, 'connected-path')
  const pathMaterial = createMaterial(resources, 0xa88457, { roughness: 0.97 })
  pathMaterial.name = pathDefinition.id
  const roadMidpoints: AuthoredValleyCellPoint[] = []
  for (const route of AUTHORED_ROADS) {
    for (const [index, segment] of routeSegmentsInCell(route, logicalPoint).entries()) {
      roadMidpoints.push(addLinearSurface(
        root,
        resources,
        context,
        segment,
        `${route.id}:${route.name}:${pathDefinition.id}:${index}`,
        ROAD_WIDTH_IN_CELLS,
        0.075,
        pathMaterial,
        0.025,
      ))
    }
  }

  const waterMaterial = createMaterial(resources, 0x3d85a8, {
    transparent: true,
    opacity: 0.88,
    roughness: 0.26,
    metalness: 0.04,
  })
  for (const [index, segment] of routeSegmentsInCell(AUTHORED_RIVER, logicalPoint).entries()) {
    addLinearSurface(
      root,
      resources,
      context,
      segment,
      `${AUTHORED_RIVER.id}:${AUTHORED_RIVER.name}:${index}`,
      RIVER_WIDTH_IN_CELLS,
      0.055,
      waterMaterial,
      0.01,
    )
  }

  const estate = estateForCell(logicalPoint)
  addScatteredVegetation(root, resources, colliders, context, region, content, estate !== undefined, placements)
  if (estate) {
    addEstateFarm(
      root,
      resources,
      colliders,
      context,
      region,
      estate,
      content,
      placements,
      pointLights,
      estateFarming(),
    )
  }
  addAuthoredStructurePlacements(
    root,
    resources,
    colliders,
    context,
    region,
    content,
    placements,
    pointLights,
  )

  if (!estate && roadMidpoints.length > 0 && context.descriptor.seed % 3 === 0) {
    const light = selectDefinition(content.lights, context.descriptor.seed, 'roadside-light')
    const midpoint = roadMidpoints[0]!
    addLantern(
      root,
      resources,
      colliders,
      context,
      light,
      midpoint.x + context.cellSize * 0.12,
      midpoint.z,
      0,
      pointLights,
    )
  }

  return {
    root,
    colliders: Object.freeze(colliders),
    dispose: () => {
      const disposeEstate = root.userData[ESTATE_FARM_DISPOSE_KEY]
      if (typeof disposeEstate === 'function') (disposeEstate as () => void)()
      for (const geometry of resources.geometries) geometry.dispose()
      for (const material of resources.materials) material.dispose()
    },
  }
}

/**
 * Creates the authored Valley builder consumed by `ThreeWorldCellSource`.
 *
 * The returned function is deterministic for a descriptor, registry fingerprint, and cell size.
 * It creates only bundled Three.js geometry and materials and never performs an asset download.
 */
export function createAuthoredValleyWorldCellBuilder(
  options: AuthoredValleyWorldCellBuilderOptions = {},
): ThreeWorldCellBuilder {
  const registry = options.registry ?? VALLEY_CONTENT_REGISTRY
  const regionContent = indexRegionContent(registry)
  const structurePlacements = options.structurePlacements ?? (
    options.registry === undefined
      ? AUTHORED_STRUCTURE_PLACEMENT_REGISTRY
      : createAuthoredStructurePlacementRegistry(registry)
  )
  const pointLights = options.pointLights ?? true
  const terrainSegments = options.terrainSegments ?? DEFAULT_TERRAIN_SEGMENTS
  const estateFarming = options.estateFarming ?? (() => null)
  if (!Number.isInteger(terrainSegments) || terrainSegments < 1 || terrainSegments > 64) {
    throw new RangeError('terrainSegments must be an integer from 1 through 64')
  }
  return (context) => buildAuthoredCell(
    context,
    registry,
    regionContent,
    structurePlacements,
    pointLights,
    terrainSegments,
    estateFarming,
  )
}

/** Ready-to-select default builder backed by `VALLEY_CONTENT_REGISTRY`. */
export const buildAuthoredValleyWorldCell: ThreeWorldCellBuilder =
  createAuthoredValleyWorldCellBuilder()
