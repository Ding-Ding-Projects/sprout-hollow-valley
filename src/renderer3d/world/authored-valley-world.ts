import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from 'three'
import { VALLEY_CONTENT_REGISTRY } from '../../content/registry'
import type {
  BuildingDef,
  ContentRegistry,
  CropDef,
  DecorationDef,
  FactoryDef,
  OrchardPlantDef,
} from '../../content/types'
import type { StaticCollider } from '../../engine3d'
import type {
  ThreeWorldCellBuildContext,
  ThreeWorldCellBuilder,
  ThreeWorldCellContent,
} from './three-world-cell-source'

export type AuthoredValleyRegionId =
  | 'region:meadow'
  | 'region:forest'
  | 'region:riverland'
  | 'region:mountain'
  | 'region:coastal'
  | 'region:marsh'
  | 'region:arid'
  | 'region:alpine'

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
  /** Allows low presets to omit point lights while keeping their physical lantern meshes. */
  readonly pointLights?: boolean
  /** Terrain subdivisions per streamed cell. Higher values produce smoother authored slopes. */
  readonly terrainSegments?: number
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
  readonly factories: readonly FactoryDef[]
  readonly buildings: readonly BuildingDef[]
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

const TOWN_SQUARE_CELL = Object.freeze({ x: 0, z: 0 })
const MARKET_DISTRICT_CELL = Object.freeze({ x: -1, z: 1 })
const INDUSTRIAL_DISTRICT_CELL = Object.freeze({ x: 2, z: 1 })
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
  let region = AUTHORED_VALLEY_REGIONS[0]!
  let distance = squareDistance(point, region.centreCell)
  for (const candidate of AUTHORED_VALLEY_REGIONS.slice(1)) {
    const candidateDistance = squareDistance(point, candidate.centreCell)
    if (candidateDistance < distance) {
      region = candidate
      distance = candidateDistance
    }
  }
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
      factories: Object.freeze([...forRegion(registry.factories, region.id)]),
      buildings: Object.freeze([...forRegion(registry.buildings, region.id)]),
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
  const x = worldX / cellSize
  const z = worldZ / cellSize
  const rolling = Math.sin(x * 0.82) * 0.16 + Math.cos(z * 0.67) * 0.13
  const highridge = Math.exp(-squareDistance({ x, z }, { x: 3.5, z: -4.5 }) / 8) * 0.75
  const snowcap = Math.exp(-squareDistance({ x, z }, { x: 4.5, z: 6.2 }) / 7) * 1.05
  const mesa = Math.exp(-squareDistance({ x, z }, { x: 6.2, z: -4.2 }) / 6) * 0.42
  const riverDistance = distanceToRoute({ x, z }, AUTHORED_RIVER)
  const riverCut = Math.exp(-(riverDistance * riverDistance) / 0.045) * 0.34
  return rolling + highridge + snowcap + mesa - riverCut
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

function addCropPatch(
  root: Group,
  resources: CellResources,
  context: ThreeWorldCellBuildContext,
  region: AuthoredValleyRegion,
  crops: readonly [CropDef, CropDef],
): void {
  const centreX = (context.descriptor.coordinate.x + 0.5) * context.cellSize
  const centreZ = (context.descriptor.coordinate.z + 0.5) * context.cellSize
  const patchX = -context.cellSize * 0.22
  const patchZ = context.cellSize * 0.22
  const patchWidth = context.cellSize * 0.34
  const patchDepth = context.cellSize * 0.25
  const groundY = terrainHeightAt(centreX + patchX, centreZ + patchZ, context.cellSize)
  const soil = new Mesh(
    ownGeometry(resources, new BoxGeometry(patchWidth, 0.09, patchDepth)),
    createMaterial(resources, region.soilColor),
  )
  soil.name = `estate-crop-soil:${crops[0].id}:${crops[1].id}`
  soil.position.set(patchX, groundY + 0.025, patchZ)
  soil.receiveShadow = true
  root.add(soil)

  const columns = 5
  const rows = 4
  const plantsPerCrop = (columns * rows) / 2
  const geometry = ownGeometry(resources, new ConeGeometry(0.12, 0.48, 5))
  const cropMeshes = crops.map((crop, cropIndex) => {
    const material = createMaterial(
      resources,
      cropIndex === 0 ? region.cropColor : region.foliageColor,
    )
    const instances = new InstancedMesh(geometry, material, plantsPerCrop)
    instances.name = `crop-row:${crop.id}`
    instances.castShadow = true
    instances.receiveShadow = true
    return instances
  })
  const matrix = new Matrix4()
  const counters = [0, 0]
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const cropIndex = (row + column) % 2
      const localX = patchX - patchWidth * 0.38 + (column / (columns - 1)) * patchWidth * 0.76
      const localZ = patchZ - patchDepth * 0.34 + (row / (rows - 1)) * patchDepth * 0.68
      const y = terrainHeightAt(centreX + localX, centreZ + localZ, context.cellSize) + 0.27
      matrix.makeTranslation(localX, y, localZ)
      cropMeshes[cropIndex]!.setMatrixAt(counters[cropIndex]!, matrix)
      counters[cropIndex]! += 1
    }
  }
  for (const instances of cropMeshes) {
    instances.instanceMatrix.needsUpdate = true
    root.add(instances)
  }
}

function addBuilding(
  root: Group,
  resources: CellResources,
  colliders: StaticCollider[],
  context: ThreeWorldCellBuildContext,
  region: AuthoredValleyRegion,
  building: BuildingDef,
  localX: number,
  localZ: number,
  instanceName: string,
): void {
  const centreX = (context.descriptor.coordinate.x + 0.5) * context.cellSize
  const centreZ = (context.descriptor.coordinate.z + 0.5) * context.cellSize
  const width = clamp(building.footprint.width * 0.38, 2.1, context.cellSize * 0.3)
  const depth = clamp(building.footprint.depth * 0.38, 1.9, context.cellSize * 0.28)
  const height = 2.05 + (mixSeed(context.descriptor.seed, building.id) % 4) * 0.18
  const baseY = terrainHeightAt(centreX + localX, centreZ + localZ, context.cellSize)
  const structure = new Group()
  structure.name = `${instanceName}:${building.id}`
  structure.position.set(localX, baseY, localZ)
  structure.userData = {
    semantic: 'authored-structure',
    structureKind: 'building',
    contentStructureId: building.id,
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

  const door = new Mesh(
    ownGeometry(resources, new BoxGeometry(0.58, 1.18, 0.08)),
    createMaterial(resources, 0x48372b),
  )
  door.name = `${building.id}:enterable-door`
  door.position.set(0, 0.59, depth / 2 + 0.045)
  door.userData = {
    semantic: 'authored-structure-door',
    interactive: true,
    structureKind: 'building',
    contentStructureId: building.id,
    label: `Enter ${building.name}`,
    definition: building,
  }
  structure.add(door)

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
    `${context.descriptor.key}:${instanceName}:${building.id}`,
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
  factory: FactoryDef,
  localX: number,
  localZ: number,
  instanceName: string,
): void {
  const centreX = (context.descriptor.coordinate.x + 0.5) * context.cellSize
  const centreZ = (context.descriptor.coordinate.z + 0.5) * context.cellSize
  const width = clamp(factory.footprint.width * 0.42, 2.4, context.cellSize * 0.34)
  const depth = clamp(factory.footprint.depth * 0.42, 2.2, context.cellSize * 0.32)
  const height = 2.25
  const baseY = terrainHeightAt(centreX + localX, centreZ + localZ, context.cellSize)
  const structure = new Group()
  structure.name = `${instanceName}:${factory.id}`
  structure.position.set(localX, baseY, localZ)
  structure.userData = {
    semantic: 'authored-structure',
    structureKind: 'factory',
    contentStructureId: factory.id,
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

  const chimneyMaterial = createMaterial(resources, 0x4a4d4a, { roughness: 0.66, metalness: 0.18 })
  for (const side of [-1, 1]) {
    const chimney = new Mesh(
      ownGeometry(resources, new CylinderGeometry(0.18, 0.22, 1.35, 8)),
      chimneyMaterial,
    )
    chimney.name = `${factory.id}:vent:${side}`
    chimney.position.set(side * width * 0.28, height + 0.78, -depth * 0.18)
    chimney.castShadow = true
    structure.add(chimney)
  }

  const loadingDoor = new Mesh(
    ownGeometry(resources, new BoxGeometry(width * 0.36, 1.35, 0.08)),
    createMaterial(resources, 0x4d5d61, { roughness: 0.62, metalness: 0.18 }),
  )
  loadingDoor.name = `${factory.id}:enterable-loading-door`
  loadingDoor.position.set(0, 0.68, depth / 2 + 0.045)
  loadingDoor.userData = {
    semantic: 'authored-structure-door',
    interactive: true,
    structureKind: 'factory',
    contentStructureId: factory.id,
    label: `Enter ${factory.name}`,
    definition: factory,
  }
  structure.add(loadingDoor)
  root.add(structure)

  addBoxCollider(
    colliders,
    `${context.descriptor.key}:${instanceName}:${factory.id}`,
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
  pointLights: boolean,
): void {
  const seed = mixSeed(context.descriptor.seed, estate.id)
  const agricultural = content.buildings.filter((definition) => definition.buildingType === 'agricultural')
  const building = selectDefinition(
    agricultural.length > 0 ? agricultural : content.buildings,
    seed,
    `${estate.id}:farm-building`,
  )
  const factory = selectDefinition(content.factories, seed, `${estate.id}:factory`)
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
    buildingId: building.id,
    factoryId: factory.id,
  })

  addCropPatch(root, resources, context, region, [firstCrop, secondCrop])
  addBuilding(
    root,
    resources,
    colliders,
    context,
    region,
    building,
    -context.cellSize * 0.24,
    -context.cellSize * 0.2,
    'estate-building',
  )
  addFactory(
    root,
    resources,
    colliders,
    context,
    region,
    factory,
    context.cellSize * 0.23,
    -context.cellSize * 0.2,
    'estate-factory',
  )
  for (let index = 0; index < 3; index += 1) {
    addTree(
      root,
      resources,
      colliders,
      context,
      region,
      orchard,
      context.cellSize * (0.16 + index * 0.11),
      context.cellSize * 0.23,
      100 + index,
      0.82 + index * 0.06,
    )
  }

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

function addDistrictStructures(
  root: Group,
  resources: CellResources,
  colliders: StaticCollider[],
  context: ThreeWorldCellBuildContext,
  region: AuthoredValleyRegion,
  content: RegionContent,
  pointLights: boolean,
): void {
  const coordinate = context.descriptor.coordinate
  const isTown = coordinate.x === TOWN_SQUARE_CELL.x && coordinate.z === TOWN_SQUARE_CELL.z
  const isMarket = coordinate.x === MARKET_DISTRICT_CELL.x && coordinate.z === MARKET_DISTRICT_CELL.z
  const isIndustrial = coordinate.x === INDUSTRIAL_DISTRICT_CELL.x && coordinate.z === INDUSTRIAL_DISTRICT_CELL.z
  if (!isTown && !isMarket && !isIndustrial) return

  if (isIndustrial) {
    const factory = selectDefinition(content.factories, context.descriptor.seed, 'industrial-quarter')
    addFactory(root, resources, colliders, context, region, factory, 0, 0, 'industrial-quarter')
    root.userData.district = Object.freeze({ name: 'Valley Works Industrial Quarter', factoryId: factory.id })
  } else {
    const preferredType = isTown ? 'civic' : 'commercial'
    const preferred = content.buildings.filter((definition) => definition.buildingType === preferredType)
    const building = selectDefinition(
      preferred.length > 0 ? preferred : content.buildings,
      context.descriptor.seed,
      isTown ? 'town-square' : 'market-district',
    )
    addBuilding(
      root,
      resources,
      colliders,
      context,
      region,
      building,
      0,
      -context.cellSize * 0.16,
      isTown ? 'town-hall' : 'market-hall',
    )
    root.userData.district = Object.freeze({
      name: isTown ? 'Sprout Square Civic Centre' : 'Lantern Market District',
      buildingId: building.id,
    })
  }

  const light = selectDefinition(content.lights, context.descriptor.seed, 'district-lights')
  for (const [index, x] of [-0.28, 0.28].entries()) {
    addLantern(
      root,
      resources,
      colliders,
      context,
      light,
      x * context.cellSize,
      context.cellSize * 0.24,
      200 + index,
      pointLights,
    )
  }
}

function addScatteredVegetation(
  root: Group,
  resources: CellResources,
  colliders: StaticCollider[],
  context: ThreeWorldCellBuildContext,
  region: AuthoredValleyRegion,
  content: RegionContent,
  hasEstate: boolean,
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
    if (nearRoad || nearRiver) continue
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
  pointLights: boolean,
  terrainSegments: number,
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
  addScatteredVegetation(root, resources, colliders, context, region, content, estate !== undefined)
  if (estate) {
    addEstateFarm(root, resources, colliders, context, region, estate, content, pointLights)
  }
  addDistrictStructures(root, resources, colliders, context, region, content, pointLights)

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
  const pointLights = options.pointLights ?? true
  const terrainSegments = options.terrainSegments ?? DEFAULT_TERRAIN_SEGMENTS
  if (!Number.isInteger(terrainSegments) || terrainSegments < 1 || terrainSegments > 64) {
    throw new RangeError('terrainSegments must be an integer from 1 through 64')
  }
  return (context) => buildAuthoredCell(
    context,
    registry,
    regionContent,
    pointLights,
    terrainSegments,
  )
}

/** Ready-to-select default builder backed by `VALLEY_CONTENT_REGISTRY`. */
export const buildAuthoredValleyWorldCell: ThreeWorldCellBuilder =
  createAuthoredValleyWorldCellBuilder()
