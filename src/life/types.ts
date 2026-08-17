export const LIFE_SEASONS = ['spring', 'summer', 'fall', 'winter'] as const
export const LIFE_DAYS_PER_SEASON = 28
export const LIFE_DAYS_PER_YEAR = LIFE_SEASONS.length * LIFE_DAYS_PER_SEASON
export const LIFE_MINUTES_PER_DAY = 24 * 60
export const LIFE_START_MINUTE = 6 * 60

export type LifeSeason = (typeof LIFE_SEASONS)[number]
export type LifeWeather = 'clear' | 'rain' | 'storm' | 'snow'
export type SimulationTier = 'near' | 'distant'

export type ContentCategory =
  | 'field-crop'
  | 'perennial-plant'
  | 'animal-species'
  | 'factory'
  | 'building'
  | 'product'
  | 'recipe'
  | 'raw-material'
  | 'world-object'

export interface NonNPCDefinition {
  id: string
  category: ContentCategory
  name: string
  registryKey: string
  localizationKey: string
  assetKey: string
  documentationKey: string
  ruleTags: readonly string[]
}

export type StructureKind = 'factory' | 'building'

export interface StationRoleDef {
  id: string
  name: string
  activities: readonly ScheduleActivity[]
  hygieneRequired: boolean
}

export interface EmploymentRoleDef {
  id: string
  name: string
  stationRoleIds: readonly string[]
  allowedStructureKinds: readonly StructureKind[]
  defaultShift: readonly [startMinute: number, endMinute: number]
}

export interface StructureDefinition {
  id: string
  contentDefinitionId: string
  kind: StructureKind
  name: string
  stationRoleIds: readonly string[]
  capacity: number
  enterable: true
  supportsPlayerBuiltInstances: boolean
}

export type StructureOwner =
  | { kind: 'valley' }
  | { kind: 'household'; householdId: string }
  | { kind: 'player' }

export interface StructureInstance {
  id: string
  definitionId: string
  owner: StructureOwner
  enabled: boolean
  stationIds: readonly string[]
}

export interface EmploymentAssignment {
  roleId: string
  structureDefinitionId: string
  stationRoleId: string
  /** Optional because a definition may be staffed before its valley or player-built instance exists. */
  structureInstanceId: string | null
}

export type Pronouns = 'she-her' | 'he-him' | 'they-them'
export type LifeStage = 'young-adult' | 'adult' | 'older-adult' | 'elder'

export interface NPCIdentity {
  displayName: string
  pronouns: Pronouns
  lifeStage: LifeStage
  birthday: { season: LifeSeason; day: number }
}

export interface NPCPreferences {
  likes: readonly string[]
  dislikes: readonly string[]
  favoriteGiftTag: string
}

export interface NPCSkill {
  id: string
  level: 1 | 2 | 3 | 4 | 5
}

export type ScheduleActivity =
  | 'sleep'
  | 'breakfast'
  | 'commute'
  | 'work'
  | 'meal'
  | 'socialize'
  | 'errand'
  | 'leisure'
  | 'toilet'
  | 'wash-hands'
  | 'shower'
  | 'rest'

export type ScheduleDestination =
  | { kind: 'home'; householdId: string }
  | { kind: 'work'; structureDefinitionId: string; stationRoleId: string }
  | { kind: 'community'; locationId: string }
  | { kind: 'fixture'; fixture: 'toilet' | 'sink' | 'shower'; structureDefinitionId: string }

export interface ScheduleCondition {
  seasons?: readonly LifeSeason[]
  weather?: readonly LifeWeather[]
  eventKinds?: readonly LifeEventKind[]
  employmentStatus?: readonly EmploymentStatus[]
}

export interface ScheduleBlock {
  id: string
  startMinute: number
  endMinute: number
  activity: ScheduleActivity
  destination: ScheduleDestination
  condition?: ScheduleCondition
}

export interface SchedulePlan {
  weekday: readonly ScheduleBlock[]
  weekend: readonly ScheduleBlock[]
  seasonal: readonly ScheduleBlock[]
  event: readonly ScheduleBlock[]
}

export interface ScheduleSelectionContext {
  calendar: LifeCalendar
  employmentStatus: EmploymentStatus
  activeEventKinds: readonly LifeEventKind[]
}

export interface NPCDef {
  id: string
  identity: NPCIdentity
  appearanceSeed: number
  traits: readonly [string, string, string]
  preferences: NPCPreferences
  skills: readonly NPCSkill[]
  householdId: string
  homeStructureDefinitionId: string
  initialEmployment: EmploymentAssignment
  schedule: SchedulePlan
  dialogueProfileId: string
  requestIds: readonly string[]
  romanceable: boolean
}

export interface NeedState {
  /** Wellbeing gauge: 100 is fully rested. */
  energy: number
  /** Pressure gauge: 100 is very hungry and meals reduce it. */
  hunger: number
  /** Wellbeing gauge: 100 is socially fulfilled. */
  social: number
  /** Wellbeing gauge: 100 is clean. */
  hygiene: number
}

export interface NeedEffect {
  energy: number
  hunger: number
  social: number
  hygiene: number
}

export type EmploymentStatus = 'active' | 'leave' | 'resigned' | 'between-jobs'

export interface EmploymentState extends EmploymentAssignment {
  npcId: string
  status: EmploymentStatus
  sinceDay: number
  level: number
}

export interface ConversationMemory {
  key: string
  value: string
  day: number
  expiresDay: number | null
}

export interface NPCState {
  npcId: string
  householdId: string
  simulationTier: SimulationTier
  needs: NeedState
  activity: ScheduleActivity
  scheduleBlockId: string
  location: ScheduleDestination
  employmentStatus: EmploymentStatus
  memories: ConversationMemory[]
  unavailableUntilDay: number | null
  /** Presentation-only near-tier progress. It never changes logical outcomes. */
  presentationProgress: number
}

export interface HouseholdState {
  id: string
  memberIds: string[]
  homeStructureDefinitionId: string
  activeStructureInstanceId: string | null
  sharedFunds: number
  temporaryMoveUntilDay: number | null
}

export type RelationshipKind = 'family' | 'friend' | 'romance' | 'rival' | 'neighbor' | 'coworker'

export interface RelationshipEdge {
  a: string
  b: string
  kinds: RelationshipKind[]
  affinity: number
  trust: number
  romance: number
  rivalry: number
  memories: ConversationMemory[]
}

export type FriendshipTier = 'stranger' | 'acquaintance' | 'friend' | 'close-friend'
export type RomanceStage = 'none' | 'dating' | 'engaged' | 'married'
export type AdoptionStage = 'none' | 'considering' | 'approved' | 'placed'

export interface ConsentRecord {
  action: RelationshipAction
  day: number
  playerConsented: true
  npcConsented: true
}

export interface PlayerRelationshipState {
  npcId: string
  friendship: FriendshipTier
  romance: RomanceStage
  sharedHome: boolean
  adoption: AdoptionStage
  affinity: number
  trust: number
  consentHistory: ConsentRecord[]
}

export type RelationshipAction =
  | 'meet'
  | 'befriend'
  | 'start-dating'
  | 'end-dating'
  | 'become-engaged'
  | 'marry'
  | 'share-home'
  | 'move-out'
  | 'consider-adoption'
  | 'approve-adoption'
  | 'place-adoption'
  | 'cancel-adoption'
  | 'separate'

export interface RelationshipConsent {
  player: boolean
  npc: boolean
}

export interface RelationshipTransitionResult {
  ok: boolean
  message: string
  state: PlayerRelationshipState
}

export type DialogueTopic =
  | 'introduction'
  | 'routine'
  | 'work'
  | 'home'
  | 'season'
  | 'weather'
  | 'festival'
  | 'relationship'
  | 'conflict'
  | 'reconciliation'
  | 'request'
  | 'community-event'

export interface DialogueCondition {
  locations?: readonly string[]
  rooms?: readonly string[]
  activities?: readonly ScheduleActivity[]
  minuteRange?: readonly [number, number]
  seasons?: readonly LifeSeason[]
  weather?: readonly LifeWeather[]
  friendship?: readonly FriendshipTier[]
  householdIds?: readonly string[]
  employmentStatuses?: readonly EmploymentStatus[]
  recentEventKinds?: readonly LifeEventKind[]
  giftTags?: readonly string[]
  questIds?: readonly string[]
  nearbyNPCIds?: readonly string[]
  memoryKeys?: readonly string[]
}

export interface DialogueLine {
  id: string
  speakerId: string
  topic: DialogueTopic
  text: string
  conditions: DialogueCondition
  priority: number
}

export interface DialogueContext {
  locationId: string
  roomId: string | null
  activity: ScheduleActivity
  minute: number
  season: LifeSeason
  weather: LifeWeather
  friendship: FriendshipTier
  householdId: string
  employmentStatus: EmploymentStatus
  recentEventKinds: readonly LifeEventKind[]
  giftTags: readonly string[]
  questIds: readonly string[]
  nearbyNPCIds: readonly string[]
  memoryKeys: readonly string[]
}

export type LifeEventKind =
  | 'argument'
  | 'reconciliation'
  | 'temporary-move'
  | 'return-home'
  | 'job-change'
  | 'promotion'
  | 'resignation'
  | 'business-break'
  | 'business-reopen'
  | 'community-celebration'
  | 'routine-change'

export interface LifeEvent {
  id: string
  kind: LifeEventKind
  participantIds: string[]
  startedDay: number
  resolvesDay: number
  status: 'active' | 'resolved'
  reversalKind: LifeEventKind | null
  sourceEventId: string | null
}

export interface LifeCalendar {
  absoluteDay: number
  year: number
  season: LifeSeason
  day: number
  minute: number
  weather: LifeWeather
}

export interface LifeSimulationState {
  seed: number
  calendar: LifeCalendar
  npcs: NPCState[]
  households: HouseholdState[]
  employments: EmploymentState[]
  relationships: RelationshipEdge[]
  playerRelationships: PlayerRelationshipState[]
  structureInstances: StructureInstance[]
  activeEvents: LifeEvent[]
  eventHistory: LifeEvent[]
}

export interface SimulationContext {
  nearbyNPCIds: ReadonlySet<string>
  structureInstances: readonly StructureInstance[]
}

export interface ValidationResult {
  ok: boolean
  problems: string[]
}
