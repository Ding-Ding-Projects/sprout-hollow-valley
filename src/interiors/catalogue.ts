import {
  NON_FACTORY_CONTEXTS,
  requiredStationKindsForContext,
} from '../facilities/requirements'
import {
  EXTERIOR_ROOM_ID,
  type ActorKind,
  type DoorAccessDef,
  type DoorDef,
  type FixtureDef,
  type FixtureKind,
  type InteractionDef,
  type InteriorGraph,
  type NonFactoryContext,
  type PrivacyDef,
  type RoomDef,
  type RoomPurpose,
  type StationContract,
  type StationDef,
  type StationKind,
  type StructureContext,
  type StructureKind,
  type VerticalTraversalKind,
} from './models'

export const FACTORY_INTERIOR_COUNT = 400 as const
export const BUILDING_INTERIOR_COUNT = 300 as const
export const TOTAL_INTERIOR_COUNT = 700 as const

const BOTH_ACTORS: readonly ActorKind[] = ['player', 'npc']

interface RoomSpec {
  readonly role: RoomPurpose
  readonly name: string
  readonly gameplayPurpose: string
}

const FACTORY_ROOMS: readonly RoomSpec[] = [
  { role: 'entry', name: 'Receiving Hall', gameplayPurpose: 'Visitor entry, intake and inspection' },
  { role: 'operations', name: 'Operations Floor', gameplayPurpose: 'Preparation, production and quality work' },
  { role: 'logistics', name: 'Logistics Hall', gameplayPurpose: 'Storage, packing, shipping and material recovery' },
  { role: 'support', name: 'Support Workshop', gameplayPurpose: 'Maintenance, cleaning, safety and first aid' },
  { role: 'staff', name: 'Staff Wing', gameplayPurpose: 'Staff facilities and administration' },
  { role: 'restroom', name: 'Accessible Restroom', gameplayPurpose: 'Private sanitation and hand washing' },
]

const BUILDING_ROOMS: readonly RoomSpec[] = [
  { role: 'entry', name: 'Welcome Room', gameplayPurpose: 'Accessible arrival, greeting and orientation' },
  { role: 'primary', name: 'Main Room', gameplayPurpose: 'The building context primary public activity' },
  { role: 'support', name: 'Support Room', gameplayPurpose: 'Storage, staff work and supporting services' },
  { role: 'restroom', name: 'Accessible Restroom', gameplayPurpose: 'Private sanitation and hand washing' },
]

const FIXTURE_KINDS: readonly FixtureKind[] = [
  'toilet',
  'accessible-toilet',
  'sink',
  'soap',
  'water',
  'drying',
  'waste',
  'mirror',
  'privacy-door',
]

function pad(value: number): string {
  return String(value).padStart(3, '0')
}

function words(value: string): string {
  return value
    .split('-')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function makeInteraction(
  id: string,
  label: string,
  durationTicks: number,
  animationState: string,
  soundState: string,
): InteractionDef {
  return {
    id,
    label,
    accessibilityLabel: `${label}. Available to the player and assigned non-player characters.`,
    actorKinds: BOTH_ACTORS,
    durationTicks,
    animationState,
    soundState,
    failureExplanation: `${label} is unavailable until its operational and access requirements are restored.`,
  }
}

function openAccess(): DoorAccessDef {
  return { initiallyOpen: true, reason: null, eventualAccess: [] }
}

function eventualAccess(doorId: string, context: StructureContext): DoorAccessDef {
  return {
    initiallyOpen: false,
    reason: 'Staff and private rooms require deterministic permission.',
    eventualAccess: [
      {
        id: `${doorId}:access:request`,
        method: 'permission',
        description: `Request access from the assigned ${context} host.`,
        grantedBy: `${context}-host-role`,
        deterministic: true,
        guaranteed: true,
      },
      {
        id: `${doorId}:access:grant`,
        method: 'permission',
        description: 'Receive the stated permission and open the door.',
        grantedBy: 'completed-access-request',
        deterministic: true,
        guaranteed: true,
      },
    ],
  }
}

function roomId(structureId: string, role: RoomPurpose): string {
  return `${structureId}:room:${role}`
}

function roomFloor(kind: StructureKind, role: RoomPurpose): number {
  if (kind === 'factory') return role === 'staff' || role === 'restroom' ? 1 : 0
  return role === 'support' || role === 'restroom' ? 1 : 0
}

function verticalTraversal(
  kind: StructureKind,
  fromRole: RoomPurpose | null,
  toRole: RoomPurpose,
): readonly VerticalTraversalKind[] {
  if (fromRole === null || roomFloor(kind, fromRole) === roomFloor(kind, toRole)) return []
  return ['stairs', 'elevator']
}

function makeDoor(
  structureId: string,
  kind: StructureKind,
  suffix: string,
  label: string,
  fromRole: RoomPurpose | null,
  toRole: RoomPurpose,
  fromRoomId: string,
  toRoomId: string,
  exterior: boolean,
  locked: boolean,
  context: StructureContext,
): DoorDef {
  const id = `${structureId}:door:${suffix}`
  return {
    id,
    saveKey: `${structureId}/doors/${suffix}`,
    label,
    fromRoomId,
    toRoomId,
    visible: true,
    exterior,
    bidirectional: true,
    accessible: true,
    verticalTraversal: verticalTraversal(kind, fromRole, toRole),
    access: locked ? eventualAccess(id, context) : openAccess(),
    interaction: makeInteraction(
      `${id}:interaction`,
      `Open ${label}`,
      1,
      'door-open',
      'door-latch',
    ),
  }
}

function makeDoors(structureId: string, kind: StructureKind, context: StructureContext): readonly DoorDef[] {
  const entry = roomId(structureId, 'entry')
  const restroom = roomId(structureId, 'restroom')
  if (kind === 'factory') {
    const operations = roomId(structureId, 'operations')
    const logistics = roomId(structureId, 'logistics')
    const support = roomId(structureId, 'support')
    const staff = roomId(structureId, 'staff')
    return [
      makeDoor(structureId, kind, 'entrance', 'main entrance', null, 'entry', EXTERIOR_ROOM_ID, entry, true, false, context),
      makeDoor(structureId, kind, 'entry-operations', 'operations door', 'entry', 'operations', entry, operations, false, false, context),
      makeDoor(structureId, kind, 'operations-logistics', 'logistics door', 'operations', 'logistics', operations, logistics, false, false, context),
      makeDoor(structureId, kind, 'entry-support', 'support door', 'entry', 'support', entry, support, false, false, context),
      makeDoor(structureId, kind, 'support-staff', 'staff door', 'support', 'staff', support, staff, false, true, context),
      makeDoor(structureId, kind, 'staff-restroom', 'restroom door', 'staff', 'restroom', staff, restroom, false, false, context),
    ]
  }

  const primary = roomId(structureId, 'primary')
  const support = roomId(structureId, 'support')
  return [
    makeDoor(structureId, kind, 'entrance', 'main entrance', null, 'entry', EXTERIOR_ROOM_ID, entry, true, false, context),
    makeDoor(structureId, kind, 'entry-primary', 'main room door', 'entry', 'primary', entry, primary, false, false, context),
    makeDoor(structureId, kind, 'primary-support', 'support room door', 'primary', 'support', primary, support, false, true, context),
    makeDoor(structureId, kind, 'support-restroom', 'restroom door', 'support', 'restroom', support, restroom, false, false, context),
  ]
}

function stationRoomRole(kind: StructureKind, stationKind: StationKind, index: number): RoomPurpose {
  if (stationKind === 'restroom' || stationKind === 'handwashing') return 'restroom'
  if (kind === 'building') {
    if (index === 0) return 'entry'
    return index % 2 === 0 ? 'support' : 'primary'
  }
  switch (stationKind) {
    case 'intake':
    case 'inspection':
      return 'entry'
    case 'preparation':
    case 'washing':
    case 'production':
    case 'quality-control':
    case 'packaging':
      return 'operations'
    case 'storage':
    case 'finished-goods-storage':
    case 'shipping':
    case 'waste':
    case 'recycling':
      return 'logistics'
    case 'maintenance':
    case 'cleaning':
    case 'first-aid':
    case 'safety':
      return 'support'
    case 'staff-facilities':
    case 'office':
      return 'staff'
    default:
      return 'operations'
  }
}

function stationContract(kind: StationKind): StationContract {
  if (
    kind.includes('storage') ||
    kind === 'intake' ||
    kind === 'shipping' ||
    kind === 'waste' ||
    kind === 'recycling' ||
    kind === 'shop-inventory'
  ) {
    return {
      kind: 'storage',
      inputs: [`${kind}:received`],
      outputs: [`${kind}:released`],
      service: null,
    }
  }
  if (
    kind === 'office' ||
    kind === 'first-aid' ||
    kind === 'safety' ||
    kind === 'staff-facilities' ||
    kind === 'restroom' ||
    kind === 'handwashing' ||
    kind.includes('reception') ||
    kind.includes('service') ||
    kind === 'service-appointment' ||
    kind === 'civic-meeting' ||
    kind === 'home-living' ||
    kind === 'home-dining' ||
    kind === 'home-sleeping'
  ) {
    return { kind: 'service', inputs: [], outputs: [], service: `${words(kind)} service` }
  }
  return {
    kind: 'transform',
    inputs: [`${kind}:input`],
    outputs: [`${kind}:output`],
    service: null,
  }
}

function makeStations(
  structureId: string,
  kind: StructureKind,
  context: StructureContext,
): readonly StationDef[] {
  return requiredStationKindsForContext(context).map((stationKind, index) => {
    const id = `${structureId}:station:${stationKind}`
    const label = words(stationKind)
    return {
      id,
      saveKey: `${structureId}/stations/${stationKind}`,
      roomId: roomId(structureId, stationRoomRole(kind, stationKind, index)),
      kind: stationKind,
      name: label,
      purpose: `${label} operations for this ${context} structure.`,
      operational: true,
      accessible: true,
      npcRoles: [`${context}-worker`, `${context}-host`],
      interaction: makeInteraction(
        `${id}:interaction`,
        `Use ${label}`,
        2 + (index % 3),
        `${stationKind}-active`,
        `${stationKind}-sound`,
      ),
      contract: stationContract(stationKind),
    }
  })
}

function fixtureDuration(kind: FixtureKind): number {
  if (kind === 'toilet' || kind === 'accessible-toilet') return 3
  if (kind === 'drying') return 2
  return 1
}

function makeFixtures(structureId: string): readonly FixtureDef[] {
  const restroomId = roomId(structureId, 'restroom')
  return FIXTURE_KINDS.map((kind) => {
    const id = `${structureId}:fixture:${kind}`
    const label = words(kind)
    const privacy: PrivacyDef | null =
      kind === 'privacy-door'
        ? { closable: true, opaque: true, reachable: true, latchOperational: true }
        : null
    return {
      id,
      saveKey: `${structureId}/fixtures/${kind}`,
      roomId: restroomId,
      kind,
      name: label,
      operational: true,
      accessible: true,
      service: `${label} sanitation service`,
      interaction: makeInteraction(
        `${id}:interaction`,
        `Use ${label}`,
        fixtureDuration(kind),
        `${kind}-active`,
        `${kind}-sound`,
      ),
      privacy,
    }
  })
}

function makeRooms(
  structureId: string,
  kind: StructureKind,
  doors: readonly DoorDef[],
  stations: readonly StationDef[],
  fixtures: readonly FixtureDef[],
): readonly RoomDef[] {
  const specs = kind === 'factory' ? FACTORY_ROOMS : BUILDING_ROOMS
  return specs.map((spec) => {
    const id = roomId(structureId, spec.role)
    return {
      id,
      saveKey: `${structureId}/rooms/${spec.role}`,
      name: spec.name,
      purpose: spec.role,
      gameplayPurpose: spec.gameplayPurpose,
      floor: roomFloor(kind, spec.role),
      navigationRegionId: `${structureId}:navigation:floor-${roomFloor(kind, spec.role)}:${spec.role}`,
      accessible: true,
      doorIds: doors
        .filter((door) => door.fromRoomId === id || door.toRoomId === id)
        .map((door) => door.id),
      stationIds: stations.filter((station) => station.roomId === id).map((station) => station.id),
      fixtureIds: fixtures.filter((fixture) => fixture.roomId === id).map((fixture) => fixture.id),
    }
  })
}

function createInterior(
  kind: StructureKind,
  number: number,
  context: StructureContext,
): InteriorGraph {
  const id = `${kind}-${pad(number)}`
  const doors = makeDoors(id, kind, context)
  const stations = makeStations(id, kind, context)
  const fixtures = makeFixtures(id)
  const rooms = makeRooms(id, kind, doors, stations, fixtures)
  return {
    id,
    saveKey: `interiors/${id}`,
    name: kind === 'factory' ? `Valley Factory ${pad(number)}` : `${words(context)} Building ${pad(number)}`,
    kind,
    context,
    entryRoomId: roomId(id, 'entry'),
    entryDoorId: `${id}:door:entrance`,
    rooms,
    doors,
    stations,
    fixtures,
  }
}

function buildingContext(offset: number): NonFactoryContext {
  return NON_FACTORY_CONTEXTS[offset % NON_FACTORY_CONTEXTS.length]
}

const FACTORY_INTERIORS: readonly InteriorGraph[] = Object.freeze(
  Array.from(
    { length: FACTORY_INTERIOR_COUNT },
    (_, offset) => createInterior('factory', offset + 1, 'factory'),
  ),
)

const BUILDING_INTERIORS: readonly InteriorGraph[] = Object.freeze(
  Array.from(
    { length: BUILDING_INTERIOR_COUNT },
    (_, offset) => createInterior('building', offset + 1, buildingContext(offset)),
  ),
)

export const STRUCTURE_INTERIORS: readonly InteriorGraph[] = Object.freeze([
  ...FACTORY_INTERIORS,
  ...BUILDING_INTERIORS,
])

const INTERIOR_BY_ID: ReadonlyMap<string, InteriorGraph> = new Map(
  STRUCTURE_INTERIORS.map((interior) => [interior.id, interior]),
)

export function interiorById(id: string): InteriorGraph | undefined {
  return INTERIOR_BY_ID.get(id)
}

export function requireInteriorById(id: string): InteriorGraph {
  const interior = interiorById(id)
  if (interior === undefined) throw new Error(`requireInteriorById: unknown structure "${id}"`)
  return interior
}

export function factoryInteriors(): readonly InteriorGraph[] {
  return FACTORY_INTERIORS
}

export function buildingInteriors(): readonly InteriorGraph[] {
  return BUILDING_INTERIORS
}

export function interiorsForContext(context: StructureContext): readonly InteriorGraph[] {
  return STRUCTURE_INTERIORS.filter((interior) => interior.context === context)
}
