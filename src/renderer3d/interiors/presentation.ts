import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three'
import type {
  BufferGeometry,
  MeshStandardMaterialParameters,
  Object3D,
} from 'three'
import {
  EXTERIOR_ROOM_ID,
  type DoorDef,
  type FixtureDef,
  type FixtureKind,
  type InteriorGraph,
  type RoomDef,
  type RoomPurpose,
  type StationDef,
  type StationKind,
  type StructureContext,
  type VerticalTraversalKind,
} from '../../interiors/models'
import type { Aabb3, StaticCollider, Vec3 } from '../../engine3d/collision'
import type {
  InteriorDoorEndpointPresentation,
  InteriorDoorFeedback,
  InteriorDoorPresentation,
  InteriorFixturePresentation,
  InteriorRoomPresentation,
  InteriorStationPresentation,
  InteriorVerticalConnectorPresentation,
  InteriorVisibilityMode,
  ThreeInteriorBuildOptions,
  ThreeInteriorPresentation,
} from './types'

const DEFAULT_ROOM_WIDTH = 10
const DEFAULT_ROOM_DEPTH = 8
const DEFAULT_WALL_HEIGHT = 3.2
const DEFAULT_FLOOR_HEIGHT = 4.2
const DEFAULT_ROOM_GAP = 3
const WALL_THICKNESS = 0.18
const FLOOR_THICKNESS = 0.18
const DOOR_HEIGHT = 2.18
const DOOR_DEPTH = 0.12

const ROOM_COLORS: Readonly<Record<RoomPurpose, number>> = Object.freeze({
  entry: 0xd6c49c,
  primary: 0xbecda7,
  operations: 0xb5c7c9,
  logistics: 0xc8b79d,
  support: 0xc8c2b5,
  staff: 0xc4b7cf,
  restroom: 0xb9d7d2,
})

const CONTEXT_COLORS: Readonly<Record<StructureContext, number>> = Object.freeze({
  factory: 0x56727b,
  home: 0xb87965,
  shop: 0xd09a45,
  civic: 0x607bb2,
  farm: 0x769b4a,
  mine: 0x6f6b76,
  greenhouse: 0x50a878,
  restaurant: 0xb95e4e,
  service: 0x6b8e9b,
})

const DOOR_STYLES: Readonly<
  Record<InteriorDoorFeedback['state'], { readonly color: number; readonly emissive: number }>
> = Object.freeze({
  available: { color: 0x4f9e69, emissive: 0x0b2713 },
  locked: { color: 0xcf9638, emissive: 0x2d1904 },
  resolved: { color: 0x418eb4, emissive: 0x071f2c },
  denied: { color: 0xb84d51, emissive: 0x300708 },
})

type WallSide = 'north' | 'east' | 'south' | 'west'

interface ResolvedBuildOptions {
  readonly roomWidth: number
  readonly roomDepth: number
  readonly wallHeight: number
  readonly floorHeight: number
  readonly roomGap: number
  readonly exteriorReturnPosition: Vec3 | null
}

interface RoomLayout {
  readonly definition: RoomDef
  readonly x: number
  readonly y: number
  readonly z: number
  readonly indexOnFloor: number
}

interface OwnedResources {
  readonly geometries: Set<BufferGeometry>
  readonly materials: Set<MeshStandardMaterial>
}

interface EndpointPlacement {
  readonly localPanel: Vec3
  readonly interactionPosition: Vec3
  readonly arrivalPosition: Vec3
  readonly rotationY: number
}

interface DoorEndpointBuildResult {
  readonly presentation: InteriorDoorEndpointPresentation
  readonly material: MeshStandardMaterial
}

function immutableVec3(x: number, y: number, z: number): Vec3 {
  return Object.freeze({ x, y, z })
}

function immutableBounds(min: Vec3, max: Vec3): Aabb3 {
  return Object.freeze({ min, max })
}

function finitePositive(value: number | undefined, fallback: number, label: string): number {
  if (value === undefined) return fallback
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a finite positive number`)
  }
  return value
}

function finiteNonNegative(value: number | undefined, fallback: number, label: string): number {
  if (value === undefined) return fallback
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite non-negative number`)
  }
  return value
}

function copyPosition(value: Vec3, label: string): Vec3 {
  if (![value.x, value.y, value.z].every(Number.isFinite)) {
    throw new RangeError(`${label} must contain finite coordinates`)
  }
  return immutableVec3(value.x, value.y, value.z)
}

function resolveOptions(options: ThreeInteriorBuildOptions | undefined): ResolvedBuildOptions {
  return Object.freeze({
    roomWidth: finitePositive(options?.roomWidth, DEFAULT_ROOM_WIDTH, 'roomWidth'),
    roomDepth: finitePositive(options?.roomDepth, DEFAULT_ROOM_DEPTH, 'roomDepth'),
    wallHeight: finitePositive(options?.wallHeight, DEFAULT_WALL_HEIGHT, 'wallHeight'),
    floorHeight: finitePositive(options?.floorHeight, DEFAULT_FLOOR_HEIGHT, 'floorHeight'),
    roomGap: finiteNonNegative(options?.roomGap, DEFAULT_ROOM_GAP, 'roomGap'),
    exteriorReturnPosition:
      options?.exteriorReturnPosition === undefined
        ? null
        : copyPosition(options.exteriorReturnPosition, 'exteriorReturnPosition'),
  })
}

function ownGeometry<T extends BufferGeometry>(resources: OwnedResources, geometry: T): T {
  resources.geometries.add(geometry)
  return geometry
}

function ownMaterial(
  resources: OwnedResources,
  parameters: MeshStandardMaterialParameters,
): MeshStandardMaterial {
  const material = new MeshStandardMaterial(parameters)
  resources.materials.add(material)
  return material
}

function makeMesh(
  name: string,
  geometry: BufferGeometry,
  material: MeshStandardMaterial,
): Mesh {
  const mesh = new Mesh(geometry, material)
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function addBox(
  resources: OwnedResources,
  parent: Group,
  material: MeshStandardMaterial,
  name: string,
  size: Vec3,
  position: Vec3,
  userData: Readonly<Record<string, unknown>>,
): Mesh {
  const mesh = makeMesh(
    name,
    ownGeometry(resources, new BoxGeometry(size.x, size.y, size.z)),
    material,
  )
  mesh.position.set(position.x, position.y, position.z)
  mesh.userData = { ...userData }
  parent.add(mesh)
  return mesh
}

function addCylinder(
  resources: OwnedResources,
  parent: Group,
  material: MeshStandardMaterial,
  name: string,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  position: Vec3,
  userData: Readonly<Record<string, unknown>>,
  radialSegments = 12,
): Mesh {
  const mesh = makeMesh(
    name,
    ownGeometry(
      resources,
      new CylinderGeometry(radiusTop, radiusBottom, height, radialSegments),
    ),
    material,
  )
  mesh.position.set(position.x, position.y, position.z)
  mesh.userData = { ...userData }
  parent.add(mesh)
  return mesh
}

function tagObjectTree(
  object: Object3D,
  semanticData: Readonly<Record<string, unknown>>,
): void {
  object.traverse((child) => {
    child.userData = { ...semanticData, ...child.userData }
  })
}

function floorLayouts(
  graph: InteriorGraph,
  options: ResolvedBuildOptions,
): ReadonlyMap<string, RoomLayout> {
  const layouts = new Map<string, RoomLayout>()
  const floors = [...new Set(graph.rooms.map((room) => room.floor))].sort((left, right) => left - right)

  for (const floor of floors) {
    const rooms = graph.rooms.filter((room) => room.floor === floor)
    const columns = Math.max(1, Math.ceil(Math.sqrt(rooms.length)))
    const rows = Math.max(1, Math.ceil(rooms.length / columns))
    const strideX = options.roomWidth + options.roomGap
    const strideZ = options.roomDepth + options.roomGap

    rooms.forEach((room, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      layouts.set(
        room.id,
        Object.freeze({
          definition: room,
          x: (column - (columns - 1) / 2) * strideX,
          y: room.floor * options.floorHeight,
          z: (row - (rows - 1) / 2) * strideZ,
          indexOnFloor: index,
        }),
      )
    })
  }

  return layouts
}

function wallBounds(
  layout: RoomLayout,
  options: ResolvedBuildOptions,
  side: WallSide,
): Aabb3 {
  const halfWidth = options.roomWidth / 2
  const halfDepth = options.roomDepth / 2
  const halfWall = WALL_THICKNESS / 2
  switch (side) {
    case 'north':
      return immutableBounds(
        immutableVec3(layout.x - halfWidth, layout.y, layout.z - halfDepth - halfWall),
        immutableVec3(
          layout.x + halfWidth,
          layout.y + options.wallHeight,
          layout.z - halfDepth + halfWall,
        ),
      )
    case 'south':
      return immutableBounds(
        immutableVec3(layout.x - halfWidth, layout.y, layout.z + halfDepth - halfWall),
        immutableVec3(
          layout.x + halfWidth,
          layout.y + options.wallHeight,
          layout.z + halfDepth + halfWall,
        ),
      )
    case 'east':
      return immutableBounds(
        immutableVec3(layout.x + halfWidth - halfWall, layout.y, layout.z - halfDepth),
        immutableVec3(
          layout.x + halfWidth + halfWall,
          layout.y + options.wallHeight,
          layout.z + halfDepth,
        ),
      )
    case 'west':
      return immutableBounds(
        immutableVec3(layout.x - halfWidth - halfWall, layout.y, layout.z - halfDepth),
        immutableVec3(
          layout.x - halfWidth + halfWall,
          layout.y + options.wallHeight,
          layout.z + halfDepth,
        ),
      )
  }
}

function buildRoom(
  graph: InteriorGraph,
  layout: RoomLayout,
  options: ResolvedBuildOptions,
  resources: OwnedResources,
  colliders: StaticCollider[],
): InteriorRoomPresentation {
  const room = layout.definition
  const object = new Group()
  object.name = `interior-room:${room.id}`
  object.position.set(layout.x, layout.y, layout.z)
  object.userData = {
    semantic: 'interior-room',
    graphId: graph.id,
    roomId: room.id,
    floor: room.floor,
    navigationRegionId: room.navigationRegionId,
    accessible: room.accessible,
    definition: room,
  }

  const floorMaterial = ownMaterial(resources, {
    color: ROOM_COLORS[room.purpose],
    roughness: 0.9,
    metalness: 0,
    flatShading: true,
  })
  const wallMaterial = ownMaterial(resources, {
    color: 0xede5d3,
    roughness: 0.96,
    metalness: 0,
    flatShading: true,
    side: DoubleSide,
  })
  const trimMaterial = ownMaterial(resources, {
    color: CONTEXT_COLORS[graph.context],
    roughness: 0.75,
    metalness: graph.context === 'factory' ? 0.18 : 0.03,
    flatShading: true,
  })
  const roomData = {
    semantic: 'interior-room-shell',
    graphId: graph.id,
    roomId: room.id,
    floor: room.floor,
    definition: room,
  }

  addBox(
    resources,
    object,
    floorMaterial,
    `interior-floor:${room.id}`,
    immutableVec3(options.roomWidth, FLOOR_THICKNESS, options.roomDepth),
    immutableVec3(0, -FLOOR_THICKNESS / 2, 0),
    { ...roomData, component: 'floor' },
  )

  const wallY = options.wallHeight / 2
  addBox(
    resources,
    object,
    wallMaterial,
    `interior-wall:${room.id}:north`,
    immutableVec3(options.roomWidth, options.wallHeight, WALL_THICKNESS),
    immutableVec3(0, wallY, -options.roomDepth / 2),
    { ...roomData, component: 'north-wall' },
  )
  addBox(
    resources,
    object,
    wallMaterial,
    `interior-wall:${room.id}:south`,
    immutableVec3(options.roomWidth, options.wallHeight, WALL_THICKNESS),
    immutableVec3(0, wallY, options.roomDepth / 2),
    { ...roomData, component: 'south-wall' },
  )
  addBox(
    resources,
    object,
    wallMaterial,
    `interior-wall:${room.id}:east`,
    immutableVec3(WALL_THICKNESS, options.wallHeight, options.roomDepth),
    immutableVec3(options.roomWidth / 2, wallY, 0),
    { ...roomData, component: 'east-wall' },
  )
  addBox(
    resources,
    object,
    wallMaterial,
    `interior-wall:${room.id}:west`,
    immutableVec3(WALL_THICKNESS, options.wallHeight, options.roomDepth),
    immutableVec3(-options.roomWidth / 2, wallY, 0),
    { ...roomData, component: 'west-wall' },
  )

  const trimHeight = Math.min(0.16, options.wallHeight * 0.06)
  addBox(
    resources,
    object,
    trimMaterial,
    `interior-trim:${room.id}:north`,
    immutableVec3(options.roomWidth, trimHeight, WALL_THICKNESS * 1.4),
    immutableVec3(0, options.wallHeight - trimHeight / 2, -options.roomDepth / 2),
    { ...roomData, component: 'north-trim' },
  )
  addBox(
    resources,
    object,
    trimMaterial,
    `interior-trim:${room.id}:south`,
    immutableVec3(options.roomWidth, trimHeight, WALL_THICKNESS * 1.4),
    immutableVec3(0, options.wallHeight - trimHeight / 2, options.roomDepth / 2),
    { ...roomData, component: 'south-trim' },
  )

  for (const side of ['north', 'east', 'south', 'west'] as const) {
    colliders.push(
      Object.freeze({
        id: `${graph.id}:collider:${room.id}:wall:${side}`,
        bounds: wallBounds(layout, options, side),
      }),
    )
  }

  return Object.freeze({
    definition: room,
    object,
    bounds: immutableBounds(
      immutableVec3(
        layout.x - options.roomWidth / 2,
        layout.y,
        layout.z - options.roomDepth / 2,
      ),
      immutableVec3(
        layout.x + options.roomWidth / 2,
        layout.y + options.wallHeight,
        layout.z + options.roomDepth / 2,
      ),
    ),
    spawnPosition: immutableVec3(layout.x, layout.y, layout.z),
  })
}

function oppositeSide(side: WallSide): WallSide {
  switch (side) {
    case 'north':
      return 'south'
    case 'east':
      return 'west'
    case 'south':
      return 'north'
    case 'west':
      return 'east'
  }
}

function fallbackSide(ordinal: number): WallSide {
  return (['south', 'east', 'north', 'west'] as const)[ordinal % 4]
}

function sideToward(from: RoomLayout, to: RoomLayout, ordinal: number): WallSide {
  const deltaX = to.x - from.x
  const deltaZ = to.z - from.z
  if (Math.abs(deltaX) > Math.abs(deltaZ) && deltaX !== 0) return deltaX > 0 ? 'east' : 'west'
  if (deltaZ !== 0) return deltaZ > 0 ? 'south' : 'north'
  return fallbackSide(ordinal)
}

function roomDoorOrdinal(layout: RoomLayout, doorId: string, fallback: number): number {
  const ordinal = layout.definition.doorIds.indexOf(doorId)
  return ordinal < 0 ? fallback : ordinal
}

function sideOffset(side: WallSide, ordinal: number, options: ResolvedBuildOptions): number {
  const available =
    (side === 'north' || side === 'south' ? options.roomWidth : options.roomDepth) / 2 - 1.25
  if (available <= 0) return 0
  const pattern = [0, -1, 1, -2, 2] as const
  const unit = Math.min(1.25, available / 2)
  const value = pattern[ordinal % pattern.length] * unit
  return Math.max(-available, Math.min(available, value))
}

function endpointPlacement(
  layout: RoomLayout,
  side: WallSide,
  ordinal: number,
  outside: boolean,
  options: ResolvedBuildOptions,
): EndpointPlacement {
  const offset = sideOffset(side, ordinal, options)
  let localX = 0
  let localZ = 0
  let outwardX = 0
  let outwardZ = 0
  let rotationY = 0

  switch (side) {
    case 'north':
      localX = offset
      localZ = -options.roomDepth / 2
      outwardZ = -1
      break
    case 'south':
      localX = offset
      localZ = options.roomDepth / 2
      outwardZ = 1
      break
    case 'east':
      localX = options.roomWidth / 2
      localZ = offset
      outwardX = 1
      rotationY = Math.PI / 2
      break
    case 'west':
      localX = -options.roomWidth / 2
      localZ = offset
      outwardX = -1
      rotationY = Math.PI / 2
      break
  }

  const panelOffset = outside ? DOOR_DEPTH * 1.25 : -DOOR_DEPTH * 0.25
  localX += outwardX * panelOffset
  localZ += outwardZ * panelOffset
  const travelDirection = outside ? 1 : -1
  const worldX = layout.x + localX
  const worldZ = layout.z + localZ

  return Object.freeze({
    localPanel: immutableVec3(localX, DOOR_HEIGHT / 2, localZ),
    rotationY,
    interactionPosition: immutableVec3(
      worldX + outwardX * travelDirection * 0.82,
      layout.y,
      worldZ + outwardZ * travelDirection * 0.82,
    ),
    arrivalPosition: immutableVec3(
      worldX + outwardX * travelDirection * 1.42,
      layout.y,
      worldZ + outwardZ * travelDirection * 1.42,
    ),
  })
}

function destinationFloor(
  destinationRoomId: string,
  layouts: ReadonlyMap<string, RoomLayout>,
): number | null {
  return destinationRoomId === EXTERIOR_ROOM_ID
    ? null
    : (layouts.get(destinationRoomId)?.definition.floor ?? null)
}

function endpointSemanticData(
  graph: InteriorGraph,
  door: DoorDef,
  endpointId: string,
  roomId: string,
  destinationRoomId: string,
  layouts: ReadonlyMap<string, RoomLayout>,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    semantic: 'interior-door-endpoint',
    interactive: true,
    graphId: graph.id,
    endpointId,
    doorId: door.id,
    roomId,
    destinationRoomId,
    destinationFloor: destinationFloor(destinationRoomId, layouts),
    label: door.label,
    accessible: door.accessible,
    exterior: door.exterior,
    bidirectional: door.bidirectional,
    catalogueVisible: door.visible,
    verticalTraversal: door.verticalTraversal,
    access: door.access,
    accessInitiallyOpen: door.access.initiallyOpen,
    accessReason: door.access.reason,
    accessSteps: door.access.eventualAccess,
    accessStepIds: door.access.eventualAccess.map((step) => step.id),
    interaction: door.interaction,
    definition: door,
  })
}

function buildDoorEndpoint(
  graph: InteriorGraph,
  door: DoorDef,
  roomId: string,
  destinationRoomId: string,
  owner: InteriorRoomPresentation,
  ownerLayout: RoomLayout,
  side: WallSide,
  ordinal: number,
  outside: boolean,
  options: ResolvedBuildOptions,
  layouts: ReadonlyMap<string, RoomLayout>,
  resources: OwnedResources,
): DoorEndpointBuildResult {
  const id = `${door.id}:endpoint:${roomId}`
  const placement = endpointPlacement(ownerLayout, side, ordinal, outside, options)
  const object = new Group()
  object.name = `interior-door-endpoint:${id}`
  object.position.set(
    placement.localPanel.x,
    placement.localPanel.y,
    placement.localPanel.z,
  )
  object.rotation.y = placement.rotationY
  object.visible = door.visible

  const data = endpointSemanticData(graph, door, id, roomId, destinationRoomId, layouts)
  object.userData = { ...data }
  const panelMaterial = ownMaterial(resources, {
    color: DOOR_STYLES[door.access.initiallyOpen ? 'available' : 'locked'].color,
    emissive: DOOR_STYLES[door.access.initiallyOpen ? 'available' : 'locked'].emissive,
    emissiveIntensity: 0.2,
    roughness: 0.65,
    metalness: 0.08,
    flatShading: true,
    side: DoubleSide,
  })
  const frameMaterial = ownMaterial(resources, {
    color: 0x4f3b2b,
    roughness: 0.82,
    flatShading: true,
  })
  const hardwareMaterial = ownMaterial(resources, {
    color: 0xe2c572,
    roughness: 0.28,
    metalness: 0.72,
  })
  const doorWidth = Math.max(0.45, Math.min(1.08, options.roomWidth * 0.16))
  const panel = addBox(
    resources,
    object,
    panelMaterial,
    `interior-door-panel:${id}`,
    immutableVec3(doorWidth, DOOR_HEIGHT, DOOR_DEPTH),
    immutableVec3(0, 0, 0),
    { ...data, component: 'door-panel' },
  )
  const frameWidth = Math.max(0.07, doorWidth * 0.08)
  addBox(
    resources,
    object,
    frameMaterial,
    `interior-door-frame:${id}:left`,
    immutableVec3(frameWidth, DOOR_HEIGHT + 0.16, DOOR_DEPTH * 1.45),
    immutableVec3(-(doorWidth + frameWidth) / 2, 0, 0),
    { ...data, component: 'left-frame' },
  )
  addBox(
    resources,
    object,
    frameMaterial,
    `interior-door-frame:${id}:right`,
    immutableVec3(frameWidth, DOOR_HEIGHT + 0.16, DOOR_DEPTH * 1.45),
    immutableVec3((doorWidth + frameWidth) / 2, 0, 0),
    { ...data, component: 'right-frame' },
  )
  addBox(
    resources,
    object,
    frameMaterial,
    `interior-door-frame:${id}:top`,
    immutableVec3(doorWidth + frameWidth * 2, frameWidth, DOOR_DEPTH * 1.45),
    immutableVec3(0, DOOR_HEIGHT / 2 + frameWidth / 2, 0),
    { ...data, component: 'top-frame' },
  )
  const handle = addCylinder(
    resources,
    object,
    hardwareMaterial,
    `interior-door-handle:${id}`,
    0.055,
    0.055,
    0.13,
    immutableVec3(doorWidth * 0.3, 0, DOOR_DEPTH),
    { ...data, component: 'door-handle' },
    10,
  )
  handle.rotation.x = Math.PI / 2
  owner.object.add(object)

  return Object.freeze({
    material: panelMaterial,
    presentation: Object.freeze({
      id,
      doorId: door.id,
      roomId,
      destinationRoomId,
      destinationFloor: destinationFloor(destinationRoomId, layouts),
      object,
      panel,
      interactionPosition: placement.interactionPosition,
      arrivalPosition: placement.arrivalPosition,
    }),
  })
}

function connectorSemanticData(
  graph: InteriorGraph,
  door: DoorDef,
  connectorId: string,
  kind: VerticalTraversalKind,
  fromLayout: RoomLayout,
  toLayout: RoomLayout,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    semantic: 'interior-vertical-connector',
    interactive: true,
    graphId: graph.id,
    connectorId,
    doorId: door.id,
    kind,
    fromRoomId: door.fromRoomId,
    toRoomId: door.toRoomId,
    fromFloor: fromLayout.definition.floor,
    toFloor: toLayout.definition.floor,
    accessible: door.accessible,
    access: door.access,
    verticalTraversal: door.verticalTraversal,
    interaction: door.interaction,
    definition: door,
  })
}

function buildStairs(
  resources: OwnedResources,
  object: Group,
  data: Readonly<Record<string, unknown>>,
  span: number,
  run: number,
): void {
  const stepMaterial = ownMaterial(resources, {
    color: 0x9b8262,
    roughness: 0.88,
    flatShading: true,
  })
  const railMaterial = ownMaterial(resources, {
    color: 0x586064,
    roughness: 0.45,
    metalness: 0.48,
  })
  const stepCount = 10
  const stepDepth = run / stepCount
  for (let index = 0; index < stepCount; index += 1) {
    const height = (span * (index + 1)) / stepCount
    addBox(
      resources,
      object,
      stepMaterial,
      `interior-stair-step:${String(index).padStart(2, '0')}`,
      immutableVec3(1.5, height, stepDepth),
      immutableVec3(0, height / 2, -run / 2 + stepDepth * (index + 0.5)),
      { ...data, component: 'stair-step', stepIndex: index },
    )
  }
  for (const side of [-1, 1] as const) {
    addBox(
      resources,
      object,
      railMaterial,
      `interior-stair-rail:${side < 0 ? 'left' : 'right'}`,
      immutableVec3(0.07, 0.86, run),
      immutableVec3(side * 0.79, span / 2 + 0.43, 0),
      { ...data, component: 'stair-rail', side },
    )
  }
}

function buildElevator(
  resources: OwnedResources,
  object: Group,
  data: Readonly<Record<string, unknown>>,
  span: number,
): void {
  const frameMaterial = ownMaterial(resources, {
    color: 0x59656c,
    roughness: 0.48,
    metalness: 0.5,
  })
  const cabinMaterial = ownMaterial(resources, {
    color: 0x8ea5ac,
    roughness: 0.55,
    metalness: 0.22,
    flatShading: true,
  })
  const buttonMaterial = ownMaterial(resources, {
    color: 0x75c8a2,
    emissive: 0x123d2a,
    emissiveIntensity: 0.35,
    roughness: 0.3,
    metalness: 0.35,
  })
  const shaftHeight = span + DOOR_HEIGHT
  for (const x of [-0.78, 0.78] as const) {
    addBox(
      resources,
      object,
      frameMaterial,
      `interior-elevator-post:${x < 0 ? 'left' : 'right'}`,
      immutableVec3(0.13, shaftHeight, 0.13),
      immutableVec3(x, shaftHeight / 2, 0),
      { ...data, component: 'elevator-post' },
    )
  }
  addBox(
    resources,
    object,
    cabinMaterial,
    'interior-elevator-cabin',
    immutableVec3(1.35, DOOR_HEIGHT, 1.25),
    immutableVec3(0, DOOR_HEIGHT / 2, 0),
    { ...data, component: 'elevator-cabin' },
  )
  addBox(
    resources,
    object,
    frameMaterial,
    'interior-elevator-header',
    immutableVec3(1.72, 0.18, 0.18),
    immutableVec3(0, shaftHeight, 0),
    { ...data, component: 'elevator-header' },
  )
  addBox(
    resources,
    object,
    buttonMaterial,
    'interior-elevator-call-button',
    immutableVec3(0.13, 0.22, 0.06),
    immutableVec3(0.98, 1.08, 0.7),
    { ...data, component: 'elevator-call-button' },
  )
}

function buildConnector(
  graph: InteriorGraph,
  door: DoorDef,
  kind: VerticalTraversalKind,
  id: string,
  ordinal: number,
  fromLayout: RoomLayout,
  toLayout: RoomLayout,
  options: ResolvedBuildOptions,
  resources: OwnedResources,
  colliders: StaticCollider[],
): InteriorVerticalConnectorPresentation {
  const object = new Group()
  object.name = `interior-connector:${id}`
  const centerX = (fromLayout.x + toLayout.x) / 2 + (kind === 'stairs' ? -1.05 : 1.05)
  const centerZ = (fromLayout.z + toLayout.z) / 2 + ordinal * 0.12
  const lowerY = Math.min(fromLayout.y, toLayout.y)
  const span = Math.max(
    Math.abs(toLayout.y - fromLayout.y),
    Math.abs(toLayout.definition.floor - fromLayout.definition.floor) * options.floorHeight,
  )
  const effectiveSpan = Math.max(span, options.floorHeight)
  const run = Math.max(2.4, Math.min(options.roomDepth * 0.55, effectiveSpan * 0.95))
  object.position.set(centerX, lowerY, centerZ)
  object.visible = door.visible

  const data = connectorSemanticData(graph, door, id, kind, fromLayout, toLayout)
  object.userData = { ...data }
  if (kind === 'stairs') buildStairs(resources, object, data, effectiveSpan, run)
  else buildElevator(resources, object, data, effectiveSpan)
  tagObjectTree(object, data)

  const halfWidth = kind === 'stairs' ? 0.85 : 0.95
  const halfDepth = kind === 'stairs' ? run / 2 : 0.75
  colliders.push(
    Object.freeze({
      id: `${graph.id}:collider:${id}`,
      bounds: immutableBounds(
        immutableVec3(centerX - halfWidth, lowerY, centerZ - halfDepth),
        immutableVec3(
          centerX + halfWidth,
          lowerY + effectiveSpan + DOOR_HEIGHT,
          centerZ + halfDepth,
        ),
      ),
    }),
  )

  const fromAtLowerFloor = fromLayout.y <= toLayout.y
  const interactionPosition = immutableVec3(
    centerX,
    fromLayout.y,
    centerZ + (kind === 'stairs' ? (fromAtLowerFloor ? -run / 2 - 0.7 : run / 2 + 0.7) : 0.95),
  )
  return Object.freeze({
    id,
    doorId: door.id,
    kind,
    fromRoomId: door.fromRoomId,
    toRoomId: door.toRoomId,
    fromFloor: fromLayout.definition.floor,
    toFloor: toLayout.definition.floor,
    object,
    interactionPosition,
  })
}

function stationIsStorage(kind: StationKind): boolean {
  return (
    kind.includes('storage') ||
    kind === 'intake' ||
    kind === 'shipping' ||
    kind === 'waste' ||
    kind === 'recycling' ||
    kind === 'shop-inventory'
  )
}

function stationUsesWater(kind: StationKind): boolean {
  return (
    kind.includes('washing') ||
    kind.includes('irrigation') ||
    kind === 'washing' ||
    kind === 'handwashing'
  )
}

function stationIsSafety(kind: StationKind): boolean {
  return kind === 'safety' || kind === 'first-aid' || kind.includes('safety-check')
}

function stationIsHome(kind: StationKind): boolean {
  return kind.startsWith('home-')
}

function addStorageStationGeometry(
  resources: OwnedResources,
  object: Group,
  data: Readonly<Record<string, unknown>>,
  accent: MeshStandardMaterial,
  body: MeshStandardMaterial,
): void {
  for (const x of [-0.62, 0.62] as const) {
    addBox(
      resources,
      object,
      body,
      `station-rack-post:${x < 0 ? 'left' : 'right'}`,
      immutableVec3(0.09, 1.35, 0.09),
      immutableVec3(x, 0.675, 0),
      { ...data, component: 'rack-post' },
    )
  }
  for (const y of [0.22, 0.68, 1.14] as const) {
    addBox(
      resources,
      object,
      body,
      `station-rack-shelf:${y}`,
      immutableVec3(1.35, 0.09, 0.66),
      immutableVec3(0, y, 0),
      { ...data, component: 'rack-shelf' },
    )
  }
  addBox(
    resources,
    object,
    accent,
    'station-storage-crate',
    immutableVec3(0.52, 0.37, 0.48),
    immutableVec3(-0.32, 0.45, 0),
    { ...data, component: 'storage-crate' },
  )
}

function addWaterStationGeometry(
  resources: OwnedResources,
  object: Group,
  data: Readonly<Record<string, unknown>>,
  accent: MeshStandardMaterial,
  body: MeshStandardMaterial,
): void {
  addBox(
    resources,
    object,
    body,
    'station-wash-counter',
    immutableVec3(1.35, 0.72, 0.72),
    immutableVec3(0, 0.36, 0),
    { ...data, component: 'wash-counter' },
  )
  addCylinder(
    resources,
    object,
    accent,
    'station-wash-basin',
    0.36,
    0.3,
    0.13,
    immutableVec3(0, 0.77, 0),
    { ...data, component: 'wash-basin' },
    16,
  )
  addCylinder(
    resources,
    object,
    body,
    'station-wash-faucet',
    0.045,
    0.045,
    0.4,
    immutableVec3(0, 1.02, -0.2),
    { ...data, component: 'wash-faucet' },
    10,
  )
}

function addSafetyStationGeometry(
  resources: OwnedResources,
  object: Group,
  data: Readonly<Record<string, unknown>>,
  accent: MeshStandardMaterial,
  body: MeshStandardMaterial,
): void {
  addBox(
    resources,
    object,
    body,
    'station-safety-cabinet',
    immutableVec3(0.88, 1.25, 0.42),
    immutableVec3(0, 0.625, 0),
    { ...data, component: 'safety-cabinet' },
  )
  addBox(
    resources,
    object,
    accent,
    'station-safety-mark-horizontal',
    immutableVec3(0.48, 0.13, 0.05),
    immutableVec3(0, 0.75, 0.24),
    { ...data, component: 'safety-mark' },
  )
  addBox(
    resources,
    object,
    accent,
    'station-safety-mark-vertical',
    immutableVec3(0.13, 0.48, 0.05),
    immutableVec3(0, 0.75, 0.24),
    { ...data, component: 'safety-mark' },
  )
}

function addHomeStationGeometry(
  resources: OwnedResources,
  object: Group,
  data: Readonly<Record<string, unknown>>,
  station: StationDef,
  accent: MeshStandardMaterial,
  body: MeshStandardMaterial,
): void {
  if (station.kind === 'home-sleeping') {
    addBox(resources, object, body, 'station-bed-frame', immutableVec3(1.35, 0.3, 0.82), immutableVec3(0, 0.15, 0), { ...data, component: 'bed-frame' })
    addBox(resources, object, accent, 'station-bed-cover', immutableVec3(1.25, 0.16, 0.74), immutableVec3(0, 0.38, 0), { ...data, component: 'bed-cover' })
    return
  }
  if (station.kind === 'home-living') {
    addBox(resources, object, body, 'station-sofa-base', immutableVec3(1.35, 0.42, 0.68), immutableVec3(0, 0.21, 0), { ...data, component: 'sofa-base' })
    addBox(resources, object, accent, 'station-sofa-back', immutableVec3(1.35, 0.72, 0.18), immutableVec3(0, 0.68, -0.25), { ...data, component: 'sofa-back' })
    return
  }
  addBox(resources, object, body, 'station-home-table', immutableVec3(1.25, 0.16, 0.72), immutableVec3(0, 0.72, 0), { ...data, component: 'home-tabletop' })
  for (const x of [-0.48, 0.48] as const) {
    addBox(resources, object, accent, `station-home-leg:${x}`, immutableVec3(0.11, 0.7, 0.11), immutableVec3(x, 0.35, 0), { ...data, component: 'home-table-leg' })
  }
}

function addGeneralStationGeometry(
  resources: OwnedResources,
  object: Group,
  data: Readonly<Record<string, unknown>>,
  station: StationDef,
  accent: MeshStandardMaterial,
  body: MeshStandardMaterial,
): void {
  addBox(
    resources,
    object,
    body,
    'station-work-base',
    immutableVec3(1.32, 0.66, 0.72),
    immutableVec3(0, 0.33, 0),
    { ...data, component: 'work-base' },
  )
  if (station.contract.kind === 'service') {
    addBox(resources, object, accent, 'station-service-counter', immutableVec3(1.4, 0.14, 0.78), immutableVec3(0, 0.73, 0), { ...data, component: 'service-counter' })
    addBox(resources, object, body, 'station-service-terminal', immutableVec3(0.48, 0.38, 0.12), immutableVec3(0.3, 1, -0.12), { ...data, component: 'service-terminal' })
  } else {
    addCylinder(resources, object, accent, 'station-machine-drum', 0.31, 0.36, 0.68, immutableVec3(0, 1, 0), { ...data, component: 'machine-drum' }, 12)
    addBox(resources, object, body, 'station-machine-feed', immutableVec3(0.54, 0.2, 0.54), immutableVec3(0, 1.42, 0), { ...data, component: 'machine-feed' })
  }
}

function addContextMarker(
  resources: OwnedResources,
  object: Group,
  data: Readonly<Record<string, unknown>>,
  context: StructureContext,
  material: MeshStandardMaterial,
): void {
  switch (context) {
    case 'factory':
      addCylinder(resources, object, material, 'station-context-factory-stack', 0.1, 0.14, 0.55, immutableVec3(-0.5, 1.15, -0.18), { ...data, component: 'factory-stack' }, 10)
      break
    case 'home':
      addBox(resources, object, material, 'station-context-home-cushion', immutableVec3(0.34, 0.18, 0.34), immutableVec3(-0.4, 0.85, 0.05), { ...data, component: 'home-cushion' })
      break
    case 'shop':
      addBox(resources, object, material, 'station-context-shop-display', immutableVec3(0.34, 0.45, 0.34), immutableVec3(-0.42, 1.02, 0), { ...data, component: 'shop-display' })
      break
    case 'civic':
      addCylinder(resources, object, material, 'station-context-civic-column', 0.13, 0.16, 0.7, immutableVec3(-0.48, 1.05, 0), { ...data, component: 'civic-column' }, 12)
      break
    case 'farm':
      addBox(resources, object, material, 'station-context-farm-crate', immutableVec3(0.48, 0.4, 0.48), immutableVec3(-0.42, 0.92, 0), { ...data, component: 'farm-crate' })
      break
    case 'mine': {
      const ore = makeMesh('station-context-mine-ore', ownGeometry(resources, new SphereGeometry(0.27, 7, 5)), material)
      ore.position.set(-0.42, 0.92, 0)
      ore.userData = { ...data, component: 'mine-ore' }
      object.add(ore)
      break
    }
    case 'greenhouse':
      addCylinder(resources, object, material, 'station-context-greenhouse-pot', 0.23, 0.17, 0.32, immutableVec3(-0.42, 0.92, 0), { ...data, component: 'greenhouse-pot' }, 10)
      break
    case 'restaurant':
      addBox(resources, object, material, 'station-context-restaurant-hob', immutableVec3(0.45, 0.08, 0.38), immutableVec3(-0.42, 0.96, 0), { ...data, component: 'restaurant-hob' })
      break
    case 'service':
      addBox(resources, object, material, 'station-context-service-board', immutableVec3(0.45, 0.5, 0.08), immutableVec3(-0.42, 1.02, -0.2), { ...data, component: 'service-board' })
      break
  }
}

function itemPosition(
  roomId: string,
  itemId: string,
  graph: InteriorGraph,
  options: ResolvedBuildOptions,
): Vec3 {
  const roomItems = [
    ...graph.stations.filter((station) => station.roomId === roomId).map((station) => station.id),
    ...graph.fixtures.filter((fixture) => fixture.roomId === roomId).map((fixture) => fixture.id),
  ]
  const index = roomItems.indexOf(itemId)
  if (index < 0) throw new Error(`Interior item ${itemId} is not assigned to room ${roomId}`)
  const availableWidth = Math.max(1.2, options.roomWidth - 2)
  const availableDepth = Math.max(1.2, options.roomDepth - 2)
  const columns = Math.max(1, Math.min(5, Math.floor(availableWidth / 1.55)))
  const rows = Math.max(1, Math.ceil(roomItems.length / columns))
  const column = index % columns
  const row = Math.floor(index / columns)
  return immutableVec3(
    -availableWidth / 2 + ((column + 0.5) * availableWidth) / columns,
    0,
    -availableDepth / 2 + ((row + 0.5) * availableDepth) / rows,
  )
}

function buildStation(
  graph: InteriorGraph,
  station: StationDef,
  room: InteriorRoomPresentation,
  layout: RoomLayout,
  options: ResolvedBuildOptions,
  resources: OwnedResources,
  colliders: StaticCollider[],
): InteriorStationPresentation {
  const local = itemPosition(station.roomId, station.id, graph, options)
  const object = new Group()
  object.name = `interior-station:${station.id}`
  object.position.set(local.x, 0, local.z)
  const data = Object.freeze({
    semantic: 'interior-station',
    interactive: true,
    graphId: graph.id,
    roomId: station.roomId,
    stationId: station.id,
    stationKind: station.kind,
    structureContext: graph.context,
    operational: station.operational,
    accessible: station.accessible,
    npcRoles: station.npcRoles,
    purpose: station.purpose,
    contract: station.contract,
    interaction: station.interaction,
    definition: station,
  })
  object.userData = { ...data }

  const bodyMaterial = ownMaterial(resources, {
    color: 0x8f978d,
    roughness: 0.72,
    metalness: graph.context === 'factory' ? 0.28 : 0.06,
    flatShading: true,
  })
  const accentMaterial = ownMaterial(resources, {
    color: CONTEXT_COLORS[graph.context],
    roughness: 0.58,
    metalness: 0.12,
    flatShading: true,
  })
  const markerMaterial = ownMaterial(resources, {
    color: station.operational ? 0xa8ce75 : 0xc87575,
    emissive: station.operational ? 0x112d08 : 0x2c0808,
    emissiveIntensity: 0.25,
    roughness: 0.55,
  })

  if (stationIsHome(station.kind)) {
    addHomeStationGeometry(resources, object, data, station, accentMaterial, bodyMaterial)
  } else if (stationIsStorage(station.kind)) {
    addStorageStationGeometry(resources, object, data, accentMaterial, bodyMaterial)
  } else if (stationUsesWater(station.kind)) {
    addWaterStationGeometry(resources, object, data, accentMaterial, bodyMaterial)
  } else if (stationIsSafety(station.kind)) {
    addSafetyStationGeometry(resources, object, data, markerMaterial, bodyMaterial)
  } else {
    addGeneralStationGeometry(resources, object, data, station, accentMaterial, bodyMaterial)
  }
  addContextMarker(resources, object, data, graph.context, markerMaterial)
  tagObjectTree(object, data)
  room.object.add(object)

  const worldX = layout.x + local.x
  const worldZ = layout.z + local.z
  colliders.push(
    Object.freeze({
      id: `${graph.id}:collider:${station.id}`,
      bounds: immutableBounds(
        immutableVec3(worldX - 0.76, layout.y, worldZ - 0.48),
        immutableVec3(worldX + 0.76, layout.y + 1.65, worldZ + 0.48),
      ),
    }),
  )

  return Object.freeze({
    definition: station,
    object,
    interactionPosition: immutableVec3(worldX, layout.y, worldZ + 0.92),
  })
}

function fixtureMaterials(
  resources: OwnedResources,
  fixture: FixtureDef,
): Readonly<{
  ceramic: MeshStandardMaterial
  hardware: MeshStandardMaterial
  accent: MeshStandardMaterial
}> {
  return Object.freeze({
    ceramic: ownMaterial(resources, {
      color: fixture.operational ? 0xf2f0e8 : 0xb9b5aa,
      roughness: 0.36,
      metalness: 0.02,
      flatShading: true,
    }),
    hardware: ownMaterial(resources, {
      color: 0x98a8ad,
      roughness: 0.24,
      metalness: 0.7,
    }),
    accent: ownMaterial(resources, {
      color: fixture.accessible ? 0x4f91af : 0xa78254,
      emissive: fixture.operational ? 0x071821 : 0x260707,
      emissiveIntensity: 0.18,
      roughness: 0.55,
      flatShading: true,
      side: DoubleSide,
    }),
  })
}

function addToiletGeometry(
  resources: OwnedResources,
  object: Group,
  data: Readonly<Record<string, unknown>>,
  fixture: FixtureDef,
  ceramic: MeshStandardMaterial,
  hardware: MeshStandardMaterial,
  accent: MeshStandardMaterial,
): void {
  addCylinder(resources, object, ceramic, 'fixture-toilet-base', 0.28, 0.22, 0.48, immutableVec3(0, 0.24, 0.05), { ...data, component: 'toilet-base' }, 14)
  const seat = makeMesh('fixture-toilet-seat', ownGeometry(resources, new TorusGeometry(0.28, 0.08, 8, 18)), ceramic)
  seat.rotation.x = Math.PI / 2
  seat.position.set(0, 0.53, 0.06)
  seat.userData = { ...data, component: 'toilet-seat' }
  object.add(seat)
  addBox(resources, object, ceramic, 'fixture-toilet-cistern', immutableVec3(0.52, 0.64, 0.25), immutableVec3(0, 0.68, -0.28), { ...data, component: 'toilet-cistern' })
  addCylinder(resources, object, hardware, 'fixture-toilet-flush', 0.04, 0.04, 0.05, immutableVec3(0.16, 1.02, -0.28), { ...data, component: 'toilet-flush' }, 10)
  if (fixture.kind === 'accessible-toilet') {
    for (const x of [-0.52, 0.52] as const) {
      addBox(resources, object, accent, `fixture-accessible-rail:${x}`, immutableVec3(0.07, 0.58, 0.07), immutableVec3(x, 0.62, -0.02), { ...data, component: 'accessible-support-rail' })
      addBox(resources, object, accent, `fixture-accessible-grip:${x}`, immutableVec3(0.38, 0.07, 0.07), immutableVec3(x - Math.sign(x) * 0.16, 0.88, -0.02), { ...data, component: 'accessible-support-grip' })
    }
  }
}

function addSinkGeometry(
  resources: OwnedResources,
  object: Group,
  data: Readonly<Record<string, unknown>>,
  ceramic: MeshStandardMaterial,
  hardware: MeshStandardMaterial,
): void {
  addCylinder(resources, object, ceramic, 'fixture-sink-pedestal', 0.2, 0.28, 0.68, immutableVec3(0, 0.34, 0), { ...data, component: 'sink-pedestal' }, 14)
  addCylinder(resources, object, ceramic, 'fixture-sink-basin', 0.4, 0.3, 0.16, immutableVec3(0, 0.76, 0), { ...data, component: 'sink-basin' }, 18)
  addCylinder(resources, object, hardware, 'fixture-sink-faucet', 0.045, 0.045, 0.42, immutableVec3(0, 1.02, -0.16), { ...data, component: 'sink-faucet' }, 10)
  addBox(resources, object, hardware, 'fixture-sink-spout', immutableVec3(0.08, 0.08, 0.3), immutableVec3(0, 1.2, -0.02), { ...data, component: 'sink-spout' })
}

function addFixtureGeometry(
  resources: OwnedResources,
  object: Group,
  fixture: FixtureDef,
  data: Readonly<Record<string, unknown>>,
): void {
  const materials = fixtureMaterials(resources, fixture)
  switch (fixture.kind) {
    case 'toilet':
    case 'accessible-toilet':
      addToiletGeometry(resources, object, data, fixture, materials.ceramic, materials.hardware, materials.accent)
      break
    case 'sink':
      addSinkGeometry(resources, object, data, materials.ceramic, materials.hardware)
      break
    case 'soap':
      addBox(resources, object, materials.ceramic, 'fixture-soap-dispenser', immutableVec3(0.34, 0.48, 0.22), immutableVec3(0, 1.1, 0), { ...data, component: 'soap-dispenser' })
      addBox(resources, object, materials.hardware, 'fixture-soap-pump', immutableVec3(0.18, 0.08, 0.18), immutableVec3(0, 1.38, 0.04), { ...data, component: 'soap-pump' })
      break
    case 'water': {
      addCylinder(resources, object, materials.hardware, 'fixture-water-pipe', 0.05, 0.05, 0.72, immutableVec3(0, 0.72, 0), { ...data, component: 'water-pipe' }, 10)
      addBox(resources, object, materials.hardware, 'fixture-water-spout', immutableVec3(0.09, 0.09, 0.38), immutableVec3(0, 1.05, 0.15), { ...data, component: 'water-spout' })
      const drop = makeMesh('fixture-water-drop', ownGeometry(resources, new SphereGeometry(0.1, 10, 8)), materials.accent)
      drop.scale.set(0.72, 1.18, 0.72)
      drop.position.set(0, 0.82, 0.33)
      drop.userData = { ...data, component: 'water-indicator' }
      object.add(drop)
      break
    }
    case 'drying':
      addBox(resources, object, materials.accent, 'fixture-dryer-body', immutableVec3(0.62, 0.72, 0.32), immutableVec3(0, 1.05, 0), { ...data, component: 'dryer-body' })
      addBox(resources, object, materials.hardware, 'fixture-dryer-outlet', immutableVec3(0.38, 0.09, 0.16), immutableVec3(0, 0.72, 0.14), { ...data, component: 'dryer-outlet' })
      break
    case 'waste':
      addCylinder(resources, object, materials.accent, 'fixture-waste-bin', 0.34, 0.28, 0.74, immutableVec3(0, 0.37, 0), { ...data, component: 'waste-bin' }, 12)
      addCylinder(resources, object, materials.hardware, 'fixture-waste-lid', 0.37, 0.37, 0.08, immutableVec3(0, 0.79, 0), { ...data, component: 'waste-lid' }, 12)
      break
    case 'mirror': {
      addBox(resources, object, materials.accent, 'fixture-mirror-frame', immutableVec3(0.86, 1.18, 0.08), immutableVec3(0, 1.18, 0), { ...data, component: 'mirror-frame' })
      const mirrorMaterial = ownMaterial(resources, { color: 0xb9d9dc, roughness: 0.08, metalness: 0.72, side: DoubleSide })
      const mirror = makeMesh('fixture-mirror-surface', ownGeometry(resources, new PlaneGeometry(0.7, 1.02)), mirrorMaterial)
      mirror.position.set(0, 1.18, 0.05)
      mirror.userData = { ...data, component: 'mirror-surface' }
      object.add(mirror)
      break
    }
    case 'privacy-door':
      addBox(resources, object, materials.accent, 'fixture-privacy-door-panel', immutableVec3(0.96, 2.08, 0.13), immutableVec3(0, 1.04, 0), { ...data, component: 'privacy-door-panel', privacy: fixture.privacy })
      addCylinder(resources, object, materials.hardware, 'fixture-privacy-door-latch', 0.055, 0.055, 0.14, immutableVec3(0.3, 1.02, 0.1), { ...data, component: 'privacy-door-latch', privacy: fixture.privacy }, 10)
      break
  }
}

function fixtureColliderHalfExtents(kind: FixtureKind): Readonly<{ x: number; z: number; height: number }> {
  switch (kind) {
    case 'toilet':
    case 'accessible-toilet':
      return Object.freeze({ x: kind === 'accessible-toilet' ? 0.72 : 0.42, z: 0.48, height: 1.1 })
    case 'sink':
      return Object.freeze({ x: 0.46, z: 0.4, height: 1.25 })
    case 'privacy-door':
      return Object.freeze({ x: 0.52, z: 0.12, height: 2.1 })
    case 'mirror':
      return Object.freeze({ x: 0.46, z: 0.08, height: 1.8 })
    case 'soap':
    case 'water':
    case 'drying':
    case 'waste':
      return Object.freeze({ x: 0.38, z: 0.34, height: 1.55 })
  }
}

function buildFixture(
  graph: InteriorGraph,
  fixture: FixtureDef,
  room: InteriorRoomPresentation,
  layout: RoomLayout,
  options: ResolvedBuildOptions,
  resources: OwnedResources,
  colliders: StaticCollider[],
): InteriorFixturePresentation {
  const local = itemPosition(fixture.roomId, fixture.id, graph, options)
  const object = new Group()
  object.name = `interior-fixture:${fixture.id}`
  object.position.set(local.x, 0, local.z)
  const data = Object.freeze({
    semantic: 'interior-fixture',
    interactive: true,
    graphId: graph.id,
    roomId: fixture.roomId,
    fixtureId: fixture.id,
    fixtureKind: fixture.kind,
    operational: fixture.operational,
    accessible: fixture.accessible,
    service: fixture.service,
    privacy: fixture.privacy,
    interaction: fixture.interaction,
    definition: fixture,
  })
  object.userData = { ...data }
  addFixtureGeometry(resources, object, fixture, data)
  tagObjectTree(object, data)
  room.object.add(object)

  const worldX = layout.x + local.x
  const worldZ = layout.z + local.z
  const half = fixtureColliderHalfExtents(fixture.kind)
  colliders.push(
    Object.freeze({
      id: `${graph.id}:collider:${fixture.id}`,
      bounds: immutableBounds(
        immutableVec3(worldX - half.x, layout.y, worldZ - half.z),
        immutableVec3(worldX + half.x, layout.y + half.height, worldZ + half.z),
      ),
    }),
  )
  return Object.freeze({
    definition: fixture,
    object,
    interactionPosition: immutableVec3(worldX, layout.y, worldZ + half.z + 0.55),
  })
}

function stableColliderOrder(left: StaticCollider, right: StaticCollider): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
}

/**
 * Builds one deterministic, locally bundled Three.js representation of an authored interior.
 * The returned presentation owns every geometry and material it creates.
 */
export function buildThreeInteriorPresentation(
  graph: InteriorGraph,
  options?: ThreeInteriorBuildOptions,
): ThreeInteriorPresentation {
  const resolved = resolveOptions(options)
  const resources: OwnedResources = {
    geometries: new Set<BufferGeometry>(),
    materials: new Set<MeshStandardMaterial>(),
  }
  const root = new Group()
  root.name = `three-interior:${graph.id}`
  root.userData = {
    semantic: 'three-interior-presentation',
    graphId: graph.id,
    saveKey: graph.saveKey,
    structureKind: graph.kind,
    structureContext: graph.context,
    definition: graph,
    activeRoomId: null,
    visibilityMode: 'all',
  }

  const layouts = floorLayouts(graph, resolved)
  const mutableColliders: StaticCollider[] = []
  const roomPresentations = new Map<string, InteriorRoomPresentation>()
  const doorPresentations = new Map<string, InteriorDoorPresentation>()
  const stationPresentations = new Map<string, InteriorStationPresentation>()
  const fixturePresentations = new Map<string, InteriorFixturePresentation>()
  const connectorPresentations = new Map<string, InteriorVerticalConnectorPresentation>()
  const doorMaterials = new Map<string, readonly MeshStandardMaterial[]>()

  for (const room of graph.rooms) {
    const layout = layouts.get(room.id)
    if (layout === undefined) throw new Error(`Missing room layout for ${room.id}`)
    const presentation = buildRoom(graph, layout, resolved, resources, mutableColliders)
    roomPresentations.set(room.id, presentation)
    root.add(presentation.object)
  }

  let defaultExteriorReturn: Vec3 | null = null
  graph.doors.forEach((door, doorIndex) => {
    const fromLayout =
      door.fromRoomId === EXTERIOR_ROOM_ID ? undefined : layouts.get(door.fromRoomId)
    const toLayout = door.toRoomId === EXTERIOR_ROOM_ID ? undefined : layouts.get(door.toRoomId)
    if (fromLayout === undefined && toLayout === undefined) {
      throw new Error(`Door ${door.id} has no interior endpoint`)
    }

    let fromSide: WallSide
    let toSide: WallSide
    if (fromLayout === undefined || toLayout === undefined) {
      fromSide = 'south'
      toSide = 'south'
    } else if (fromLayout.definition.floor !== toLayout.definition.floor) {
      fromSide = fallbackSide(roomDoorOrdinal(fromLayout, door.id, doorIndex))
      toSide = oppositeSide(fromSide)
    } else {
      fromSide = sideToward(fromLayout, toLayout, roomDoorOrdinal(fromLayout, door.id, doorIndex))
      toSide = sideToward(toLayout, fromLayout, roomDoorOrdinal(toLayout, door.id, doorIndex))
    }

    const endpointResults: DoorEndpointBuildResult[] = []
    const endpointSpecs = [
      {
        roomId: door.fromRoomId,
        destinationRoomId: door.toRoomId,
        layout: fromLayout,
        fallbackOwnerLayout: toLayout,
        side: fromSide,
      },
      {
        roomId: door.toRoomId,
        destinationRoomId: door.fromRoomId,
        layout: toLayout,
        fallbackOwnerLayout: fromLayout,
        side: toSide,
      },
    ] as const

    for (const specification of endpointSpecs) {
      const ownerLayout = specification.layout ?? specification.fallbackOwnerLayout
      if (ownerLayout === undefined) throw new Error(`Door ${door.id} endpoint has no owner layout`)
      const owner = roomPresentations.get(ownerLayout.definition.id)
      if (owner === undefined) throw new Error(`Door ${door.id} endpoint owner is unavailable`)
      const ordinal = roomDoorOrdinal(ownerLayout, door.id, doorIndex)
      const result = buildDoorEndpoint(
        graph,
        door,
        specification.roomId,
        specification.destinationRoomId,
        owner,
        ownerLayout,
        specification.side,
        ordinal,
        specification.roomId === EXTERIOR_ROOM_ID,
        resolved,
        layouts,
        resources,
      )
      endpointResults.push(result)
      if (
        specification.roomId === EXTERIOR_ROOM_ID &&
        door.id === graph.entryDoorId
      ) {
        defaultExteriorReturn = result.presentation.arrivalPosition
      }
    }

    const connectors: InteriorVerticalConnectorPresentation[] = []
    if (door.verticalTraversal.length > 0) {
      if (fromLayout === undefined || toLayout === undefined) {
        throw new Error(`Vertical door ${door.id} must connect two interior rooms`)
      }
      const kindOccurrences = new Map<VerticalTraversalKind, number>()
      door.verticalTraversal.forEach((kind, connectorIndex) => {
        const occurrence = kindOccurrences.get(kind) ?? 0
        kindOccurrences.set(kind, occurrence + 1)
        const duplicates = door.verticalTraversal.filter((candidate) => candidate === kind).length
        const id = `${door.id}:connector:${kind}${duplicates > 1 ? `:${occurrence}` : ''}`
        const connector = buildConnector(
          graph,
          door,
          kind,
          id,
          connectorIndex,
          fromLayout,
          toLayout,
          resolved,
          resources,
          mutableColliders,
        )
        connectors.push(connector)
        connectorPresentations.set(id, connector)
        root.add(connector.object)
      })
    }

    const endpoints = Object.freeze(endpointResults.map((result) => result.presentation))
    doorMaterials.set(
      door.id,
      Object.freeze(endpointResults.map((result) => result.material)),
    )
    doorPresentations.set(
      door.id,
      Object.freeze({
        definition: door,
        endpoints,
        connectors: Object.freeze([...connectors]),
      }),
    )
  })

  for (const station of graph.stations) {
    const room = roomPresentations.get(station.roomId)
    const layout = layouts.get(station.roomId)
    if (room === undefined || layout === undefined) {
      throw new Error(`Station ${station.id} references unknown room ${station.roomId}`)
    }
    stationPresentations.set(
      station.id,
      buildStation(graph, station, room, layout, resolved, resources, mutableColliders),
    )
  }

  for (const fixture of graph.fixtures) {
    const room = roomPresentations.get(fixture.roomId)
    const layout = layouts.get(fixture.roomId)
    if (room === undefined || layout === undefined) {
      throw new Error(`Fixture ${fixture.id} references unknown room ${fixture.roomId}`)
    }
    fixturePresentations.set(
      fixture.id,
      buildFixture(graph, fixture, room, layout, resolved, resources, mutableColliders),
    )
  }

  const entryLayout = layouts.get(graph.entryRoomId)
  if (entryLayout === undefined) throw new Error(`Entry room ${graph.entryRoomId} has no layout`)
  const exteriorReturnPosition =
    resolved.exteriorReturnPosition ??
    defaultExteriorReturn ??
    immutableVec3(
      entryLayout.x,
      entryLayout.y,
      entryLayout.z + resolved.roomDepth / 2 + 1.5,
    )
  root.userData.exteriorReturnPosition = exteriorReturnPosition

  const colliders = Object.freeze([...mutableColliders].sort(stableColliderOrder))
  let disposed = false

  function assertUsable(action: string): void {
    if (disposed) throw new Error(`Cannot ${action}: interior presentation is disposed`)
  }

  function applyDoorFeedback(feedback: InteriorDoorFeedback): void {
    const door = doorPresentations.get(feedback.doorId)
    const materials = doorMaterials.get(feedback.doorId)
    if (door === undefined || materials === undefined) {
      throw new RangeError(`Unknown interior door ${feedback.doorId}`)
    }
    const style = DOOR_STYLES[feedback.state]
    for (const material of materials) {
      material.color.setHex(style.color)
      material.emissive.setHex(style.emissive)
      material.emissiveIntensity = feedback.state === 'denied' ? 0.4 : 0.22
    }
    for (const endpoint of door.endpoints) {
      const dynamic = {
        doorVisualState: feedback.state,
        feedbackMessage: feedback.message,
        feedbackReason: feedback.reason,
        resolvedDestinationRoomId: feedback.destinationRoomId,
        resolvedDestinationFloor: feedback.destinationFloor,
        resolvedAccessStepIds: feedback.accessStepIds,
        feedback,
      }
      endpoint.object.userData = { ...endpoint.object.userData, ...dynamic }
      endpoint.panel.userData = { ...endpoint.panel.userData, ...dynamic }
    }
    for (const connector of door.connectors) {
      connector.object.userData = {
        ...connector.object.userData,
        doorVisualState: feedback.state,
        feedbackMessage: feedback.message,
        feedbackReason: feedback.reason,
        feedback,
      }
    }
  }

  for (const door of graph.doors) {
    const destinationRoomId =
      door.toRoomId === EXTERIOR_ROOM_ID ? door.fromRoomId : door.toRoomId
    applyDoorFeedback(
      Object.freeze({
        doorId: door.id,
        state: door.access.initiallyOpen ? 'available' : 'locked',
        message: door.interaction.label,
        reason: door.access.reason,
        destinationRoomId,
        destinationFloor: destinationFloor(destinationRoomId, layouts),
        accessStepIds: Object.freeze(door.access.eventualAccess.map((step) => step.id)),
      }),
    )
  }

  return Object.freeze({
    graph,
    root,
    rooms: roomPresentations,
    doors: doorPresentations,
    stations: stationPresentations,
    fixtures: fixturePresentations,
    connectors: connectorPresentations,
    colliders,
    exteriorReturnPosition,
    setActiveRoom(roomId: string | null, mode: InteriorVisibilityMode = 'room'): void {
      assertUsable('change active room')
      if (roomId !== null && !roomPresentations.has(roomId)) {
        throw new RangeError(`Unknown interior room ${roomId}`)
      }
      const activeFloor = roomId === null ? null : layouts.get(roomId)?.definition.floor ?? null
      for (const [candidateId, room] of roomPresentations) {
        room.object.visible =
          roomId === null ||
          mode === 'all' ||
          (mode === 'floor' && room.definition.floor === activeFloor) ||
          (mode === 'room' && candidateId === roomId)
      }
      for (const connector of connectorPresentations.values()) {
        const doorVisible = doorPresentations.get(connector.doorId)?.definition.visible ?? false
        connector.object.visible =
          doorVisible &&
          (roomId === null ||
            mode === 'all' ||
            (mode === 'floor' &&
              (connector.fromFloor === activeFloor || connector.toFloor === activeFloor)) ||
            (mode === 'room' &&
              (connector.fromRoomId === roomId || connector.toRoomId === roomId)))
      }
      root.userData.activeRoomId = roomId
      root.userData.visibilityMode = mode
    },
    setDoorFeedback(feedback: InteriorDoorFeedback): void {
      assertUsable('set door feedback')
      applyDoorFeedback(feedback)
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      root.parent?.remove(root)
      for (const geometry of resources.geometries) geometry.dispose()
      for (const material of resources.materials) material.dispose()
      resources.geometries.clear()
      resources.materials.clear()
      root.clear()
      root.userData = {
        semantic: 'three-interior-presentation',
        graphId: graph.id,
        disposed: true,
      }
    },
  })
}
