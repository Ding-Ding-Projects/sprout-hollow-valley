export const EXTERIOR_ROOM_ID = '$exterior' as const

export type StructureKind = 'factory' | 'building'

export type NonFactoryContext =
  | 'home'
  | 'shop'
  | 'civic'
  | 'farm'
  | 'mine'
  | 'greenhouse'
  | 'restaurant'
  | 'service'

export type StructureContext = 'factory' | NonFactoryContext
export type ActorKind = 'player' | 'npc'

export type RoomPurpose =
  | 'entry'
  | 'primary'
  | 'operations'
  | 'logistics'
  | 'support'
  | 'staff'
  | 'restroom'

export type AccessMethod =
  | 'opening-hours'
  | 'employment'
  | 'permission'
  | 'key'
  | 'friendship'
  | 'family'
  | 'quest'
  | 'progression'

export interface DoorAccessStep {
  readonly id: string
  readonly method: AccessMethod
  readonly description: string
  readonly grantedBy: string
  readonly deterministic: boolean
  readonly guaranteed: boolean
}

export interface DoorAccessDef {
  readonly initiallyOpen: boolean
  readonly reason: string | null
  readonly eventualAccess: readonly DoorAccessStep[]
}

export interface InteractionDef {
  readonly id: string
  readonly label: string
  readonly accessibilityLabel: string
  readonly actorKinds: readonly ActorKind[]
  readonly durationTicks: number
  readonly animationState: string
  readonly soundState: string
  readonly failureExplanation: string
}

export interface RoomDef {
  readonly id: string
  readonly saveKey: string
  readonly name: string
  readonly purpose: RoomPurpose
  readonly gameplayPurpose: string
  readonly accessible: boolean
  readonly doorIds: readonly string[]
  readonly stationIds: readonly string[]
  readonly fixtureIds: readonly string[]
}

export interface DoorDef {
  readonly id: string
  readonly saveKey: string
  readonly label: string
  readonly fromRoomId: string
  readonly toRoomId: string
  readonly visible: boolean
  readonly exterior: boolean
  readonly bidirectional: boolean
  readonly accessible: boolean
  readonly access: DoorAccessDef
  readonly interaction: InteractionDef
}

export type StationKind =
  | 'intake'
  | 'inspection'
  | 'storage'
  | 'preparation'
  | 'washing'
  | 'production'
  | 'quality-control'
  | 'packaging'
  | 'finished-goods-storage'
  | 'shipping'
  | 'maintenance'
  | 'cleaning'
  | 'waste'
  | 'recycling'
  | 'staff-facilities'
  | 'office'
  | 'first-aid'
  | 'safety'
  | 'restroom'
  | 'handwashing'
  | 'home-living'
  | 'home-cooking'
  | 'home-dining'
  | 'home-sleeping'
  | 'home-storage'
  | 'shop-display'
  | 'shop-checkout'
  | 'shop-inventory'
  | 'shop-customer-service'
  | 'civic-reception'
  | 'civic-records'
  | 'civic-public-service'
  | 'civic-meeting'
  | 'farm-animal-care'
  | 'farm-crop-preparation'
  | 'farm-tool-storage'
  | 'farm-harvest-handling'
  | 'mine-safety-check'
  | 'mine-ore-sorting'
  | 'mine-ventilation'
  | 'mine-extraction-support'
  | 'greenhouse-potting'
  | 'greenhouse-irrigation'
  | 'greenhouse-climate-control'
  | 'greenhouse-produce-washing'
  | 'restaurant-receiving'
  | 'restaurant-cold-storage'
  | 'restaurant-food-preparation'
  | 'restaurant-cooking'
  | 'restaurant-dishwashing'
  | 'restaurant-service'
  | 'service-reception'
  | 'service-appointment'
  | 'service-workbench'
  | 'service-records'

export type StationContractKind = 'transform' | 'storage' | 'service'

export interface StationContract {
  readonly kind: StationContractKind
  readonly inputs: readonly string[]
  readonly outputs: readonly string[]
  readonly service: string | null
}

export interface StationDef {
  readonly id: string
  readonly saveKey: string
  readonly roomId: string
  readonly kind: StationKind
  readonly name: string
  readonly purpose: string
  readonly operational: boolean
  readonly accessible: boolean
  readonly npcRoles: readonly string[]
  readonly interaction: InteractionDef
  readonly contract: StationContract
}

export type FixtureKind =
  | 'toilet'
  | 'accessible-toilet'
  | 'sink'
  | 'soap'
  | 'water'
  | 'drying'
  | 'waste'
  | 'mirror'
  | 'privacy-door'

export interface PrivacyDef {
  readonly closable: boolean
  readonly opaque: boolean
  readonly reachable: boolean
  readonly latchOperational: boolean
}

export interface FixtureDef {
  readonly id: string
  readonly saveKey: string
  readonly roomId: string
  readonly kind: FixtureKind
  readonly name: string
  readonly operational: boolean
  readonly accessible: boolean
  readonly service: string
  readonly interaction: InteractionDef
  readonly privacy: PrivacyDef | null
}

export interface InteriorGraph {
  readonly id: string
  readonly saveKey: string
  readonly name: string
  readonly kind: StructureKind
  readonly context: StructureContext
  readonly entryRoomId: string
  readonly entryDoorId: string
  readonly rooms: readonly RoomDef[]
  readonly doors: readonly DoorDef[]
  readonly stations: readonly StationDef[]
  readonly fixtures: readonly FixtureDef[]
}
