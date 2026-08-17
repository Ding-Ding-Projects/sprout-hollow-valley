import {
  EMPLOYMENT_ROLE_DEFS,
  STATION_ROLE_DEFS,
  STRUCTURE_DEFINITIONS,
} from './catalog'
import { HOUSEHOLD_BLUEPRINTS, NPC_DEFINITIONS } from './npcs'
import { calendarForAbsoluteDay } from './simulation'
import {
  LIFE_MINUTES_PER_DAY,
  LIFE_SEASONS,
  type LifeSimulationState,
} from './types'

const EXPECTED_NPC_COUNT = 240
const MAX_ID_LENGTH = 256
const MAX_TEXT_LENGTH = 4_096
const MAX_ROWS = 50_000

const SIMULATION_TIERS = ['near', 'distant'] as const
const ACTIVITIES = [
  'sleep',
  'breakfast',
  'commute',
  'work',
  'meal',
  'socialize',
  'errand',
  'leisure',
  'toilet',
  'wash-hands',
  'shower',
  'rest',
] as const
const EMPLOYMENT_STATUSES = ['active', 'leave', 'resigned', 'between-jobs'] as const
const RELATIONSHIP_KINDS = ['family', 'friend', 'romance', 'rival', 'neighbor', 'coworker'] as const
const FRIENDSHIP_TIERS = ['stranger', 'acquaintance', 'friend', 'close-friend'] as const
const ROMANCE_STAGES = ['none', 'dating', 'engaged', 'married'] as const
const ADOPTION_STAGES = ['none', 'considering', 'approved', 'placed'] as const
const RELATIONSHIP_ACTIONS = [
  'meet',
  'befriend',
  'start-dating',
  'end-dating',
  'become-engaged',
  'marry',
  'share-home',
  'move-out',
  'consider-adoption',
  'approve-adoption',
  'place-adoption',
  'cancel-adoption',
  'separate',
] as const
const LIFE_EVENT_KINDS = [
  'argument',
  'reconciliation',
  'temporary-move',
  'return-home',
  'job-change',
  'promotion',
  'resignation',
  'business-break',
  'business-reopen',
  'community-celebration',
  'routine-change',
] as const

const NPC_BY_ID = new Map(NPC_DEFINITIONS.map((definition) => [definition.id, definition]))
const NPC_IDS = new Set(NPC_BY_ID.keys())
const HOUSEHOLD_IDS = new Set(HOUSEHOLD_BLUEPRINTS.map((household) => household.id))
const STRUCTURE_BY_ID = new Map(STRUCTURE_DEFINITIONS.map((definition) => [definition.id, definition]))
const STATION_ROLE_IDS = new Set(STATION_ROLE_DEFS.map((definition) => definition.id))
const EMPLOYMENT_ROLE_BY_ID = new Map(EMPLOYMENT_ROLE_DEFS.map((definition) => [definition.id, definition]))
const SCHEDULE_IDS_BY_NPC = new Map(
  NPC_DEFINITIONS.map((definition) => [
    definition.id,
    new Set([
      ...definition.schedule.weekday,
      ...definition.schedule.weekend,
      ...definition.schedule.seasonal,
      ...definition.schedule.event,
    ].map((block) => block.id)),
  ]),
)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function rows(value: unknown, exactLength?: number): readonly unknown[] | null {
  if (!Array.isArray(value) || value.length > MAX_ROWS) return null
  return exactLength === undefined || value.length === exactLength ? value : null
}

function id(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH
    ? value
    : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length <= MAX_TEXT_LENGTH ? value : null
}

function safeInteger(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number | null {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
    ? value
    : null
}

function finite(value: unknown, minimum: number, maximum: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
    ? value
    : null
}

function oneOf<const T extends readonly string[]>(value: unknown, allowed: T): T[number] | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : null
}

function nullableId(value: unknown): string | null | undefined {
  if (value === null) return null
  const parsed = id(value)
  return parsed === null ? undefined : parsed
}

function nullableInteger(value: unknown): number | null | undefined {
  if (value === null) return null
  const parsed = safeInteger(value)
  return parsed === null ? undefined : parsed
}

function nullableOneOf<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
): T[number] | null | undefined {
  if (value === null) return null
  const parsed = oneOf(value, allowed)
  return parsed === null ? undefined : parsed
}

function uniqueKnownIds(
  value: unknown,
  known: ReadonlySet<string>,
  exactLength?: number,
): string[] | null {
  const source = rows(value, exactLength)
  if (source === null) return null
  const parsed: string[] = []
  const seen = new Set<string>()
  for (const entry of source) {
    const entryId = id(entry)
    if (entryId === null || !known.has(entryId) || seen.has(entryId)) return null
    seen.add(entryId)
    parsed.push(entryId)
  }
  return parsed
}

function setEquals(actual: ReadonlySet<string>, expected: ReadonlySet<string>): boolean {
  return actual.size === expected.size && [...expected].every((entry) => actual.has(entry))
}

function validMemory(value: unknown): boolean {
  if (!isRecord(value)) return false
  const day = safeInteger(value['day'])
  const expiresDay = nullableInteger(value['expiresDay'])
  return (
    id(value['key']) !== null &&
    text(value['value']) !== null &&
    day !== null &&
    expiresDay !== undefined &&
    (expiresDay === null || expiresDay >= day)
  )
}

function validMemories(value: unknown): boolean {
  const memories = rows(value)
  return memories !== null && memories.every(validMemory)
}

function validCalendar(value: unknown, seed: number): boolean {
  if (!isRecord(value)) return false
  const absoluteDay = safeInteger(value['absoluteDay'])
  const minute = safeInteger(value['minute'], 0, LIFE_MINUTES_PER_DAY - 1)
  if (absoluteDay === null || minute === null) return false
  const expected = calendarForAbsoluteDay(seed, absoluteDay, minute)
  return (
    value['year'] === expected.year &&
    value['season'] === expected.season &&
    value['day'] === expected.day &&
    value['minute'] === expected.minute &&
    value['weather'] === expected.weather &&
    oneOf(value['season'], LIFE_SEASONS) !== null
  )
}

function validNeeds(value: unknown): boolean {
  return isRecord(value) &&
    finite(value['energy'], 0, 100) !== null &&
    finite(value['hunger'], 0, 100) !== null &&
    finite(value['social'], 0, 100) !== null &&
    finite(value['hygiene'], 0, 100) !== null
}

function validDestination(value: unknown): boolean {
  if (!isRecord(value)) return false
  switch (value['kind']) {
    case 'home':
      return typeof value['householdId'] === 'string' && HOUSEHOLD_IDS.has(value['householdId'])
    case 'work': {
      const structureId = id(value['structureDefinitionId'])
      const stationRoleId = id(value['stationRoleId'])
      return structureId !== null &&
        stationRoleId !== null &&
        STRUCTURE_BY_ID.has(structureId) &&
        STATION_ROLE_IDS.has(stationRoleId)
    }
    case 'community':
      return id(value['locationId']) !== null
    case 'fixture':
      return oneOf(value['fixture'], ['toilet', 'sink', 'shower'] as const) !== null &&
        typeof value['structureDefinitionId'] === 'string' &&
        STRUCTURE_BY_ID.has(value['structureDefinitionId'])
    default:
      return false
  }
}

function validNPCs(
  value: unknown,
  employmentStatuses: ReadonlyMap<string, string>,
): boolean {
  const npcs = rows(value, EXPECTED_NPC_COUNT)
  if (npcs === null || NPC_IDS.size !== EXPECTED_NPC_COUNT) return false
  const seen = new Set<string>()
  for (const raw of npcs) {
    if (!isRecord(raw)) return false
    const npcId = id(raw['npcId'])
    const definition = npcId === null ? undefined : NPC_BY_ID.get(npcId)
    const householdId = id(raw['householdId'])
    const unavailableUntilDay = nullableInteger(raw['unavailableUntilDay'])
    if (
      npcId === null ||
      definition === undefined ||
      seen.has(npcId) ||
      householdId === null ||
      householdId !== definition.householdId ||
      oneOf(raw['simulationTier'], SIMULATION_TIERS) === null ||
      !validNeeds(raw['needs']) ||
      oneOf(raw['activity'], ACTIVITIES) === null ||
      typeof raw['scheduleBlockId'] !== 'string' ||
      !SCHEDULE_IDS_BY_NPC.get(npcId)?.has(raw['scheduleBlockId']) ||
      !validDestination(raw['location']) ||
      oneOf(raw['employmentStatus'], EMPLOYMENT_STATUSES) === null ||
      raw['employmentStatus'] !== employmentStatuses.get(npcId) ||
      !validMemories(raw['memories']) ||
      unavailableUntilDay === undefined ||
      finite(raw['presentationProgress'], 0, 1) === null
    ) {
      return false
    }
    seen.add(npcId)
  }
  return setEquals(seen, NPC_IDS)
}

function validStructureInstances(value: unknown): Set<string> | null {
  const instances = rows(value)
  if (instances === null) return null
  const instanceIds = new Set<string>()
  for (const raw of instances) {
    if (!isRecord(raw)) return null
    const instanceId = id(raw['id'])
    const definitionId = id(raw['definitionId'])
    if (
      instanceId === null ||
      definitionId === null ||
      instanceIds.has(instanceId) ||
      !STRUCTURE_BY_ID.has(definitionId) ||
      typeof raw['enabled'] !== 'boolean'
    ) {
      return null
    }
    const owner = raw['owner']
    if (!isRecord(owner)) return null
    if (
      owner['kind'] !== 'valley' &&
      owner['kind'] !== 'player' &&
      !(
        owner['kind'] === 'household' &&
        typeof owner['householdId'] === 'string' &&
        HOUSEHOLD_IDS.has(owner['householdId'])
      )
    ) {
      return null
    }
    const stationIds = rows(raw['stationIds'])
    if (stationIds === null) return null
    const seenStations = new Set<string>()
    for (const stationIdValue of stationIds) {
      const stationId = id(stationIdValue)
      if (stationId === null || seenStations.has(stationId)) return null
      seenStations.add(stationId)
    }
    instanceIds.add(instanceId)
  }
  return instanceIds
}

function validHouseholds(value: unknown, instanceIds: ReadonlySet<string>): boolean {
  const households = rows(value, HOUSEHOLD_IDS.size)
  if (households === null) return false
  const seenHouseholds = new Set<string>()
  const memberOwner = new Map<string, string>()
  for (const raw of households) {
    if (!isRecord(raw)) return false
    const householdId = id(raw['id'])
    const members = uniqueKnownIds(raw['memberIds'], NPC_IDS)
    const homeStructureId = id(raw['homeStructureDefinitionId'])
    const activeInstanceId = nullableId(raw['activeStructureInstanceId'])
    const temporaryMoveUntilDay = nullableInteger(raw['temporaryMoveUntilDay'])
    if (
      householdId === null ||
      !HOUSEHOLD_IDS.has(householdId) ||
      seenHouseholds.has(householdId) ||
      members === null ||
      members.length === 0 ||
      homeStructureId === null ||
      !STRUCTURE_BY_ID.has(homeStructureId) ||
      activeInstanceId === undefined ||
      (activeInstanceId !== null && !instanceIds.has(activeInstanceId)) ||
      finite(raw['sharedFunds'], 0, Number.MAX_SAFE_INTEGER) === null ||
      temporaryMoveUntilDay === undefined
    ) {
      return false
    }
    for (const memberId of members) {
      if (memberOwner.has(memberId) || NPC_BY_ID.get(memberId)?.householdId !== householdId) return false
      memberOwner.set(memberId, householdId)
    }
    seenHouseholds.add(householdId)
  }
  return setEquals(seenHouseholds, HOUSEHOLD_IDS) && setEquals(new Set(memberOwner.keys()), NPC_IDS)
}

function readEmployments(
  value: unknown,
  instanceIds: ReadonlySet<string>,
): ReadonlyMap<string, string> | null {
  const employments = rows(value, EXPECTED_NPC_COUNT)
  if (employments === null) return null
  const statuses = new Map<string, string>()
  for (const raw of employments) {
    if (!isRecord(raw)) return null
    const npcId = id(raw['npcId'])
    const roleId = id(raw['roleId'])
    const structureId = id(raw['structureDefinitionId'])
    const stationRoleId = id(raw['stationRoleId'])
    const instanceId = nullableId(raw['structureInstanceId'])
    const role = roleId === null ? undefined : EMPLOYMENT_ROLE_BY_ID.get(roleId)
    const structure = structureId === null ? undefined : STRUCTURE_BY_ID.get(structureId)
    if (
      npcId === null ||
      !NPC_IDS.has(npcId) ||
      statuses.has(npcId) ||
      role === undefined ||
      structure === undefined ||
      stationRoleId === null ||
      !STATION_ROLE_IDS.has(stationRoleId) ||
      !role.stationRoleIds.includes(stationRoleId) ||
      !role.allowedStructureKinds.includes(structure.kind) ||
      !structure.stationRoleIds.includes(stationRoleId) ||
      instanceId === undefined ||
      (instanceId !== null && !instanceIds.has(instanceId)) ||
      oneOf(raw['status'], EMPLOYMENT_STATUSES) === null ||
      safeInteger(raw['sinceDay']) === null ||
      safeInteger(raw['level'], 1) === null
    ) {
      return null
    }
    statuses.set(npcId, raw['status'] as string)
  }
  return setEquals(new Set(statuses.keys()), NPC_IDS) ? statuses : null
}

function validRelationships(value: unknown): boolean {
  const relationships = rows(value)
  if (relationships === null) return false
  const pairs = new Set<string>()
  for (const raw of relationships) {
    if (!isRecord(raw)) return false
    const a = id(raw['a'])
    const b = id(raw['b'])
    if (a === null || b === null || a === b || !NPC_IDS.has(a) || !NPC_IDS.has(b)) return false
    const pair = a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`
    if (pairs.has(pair)) return false
    const kinds = uniqueKnownIds(raw['kinds'], new Set(RELATIONSHIP_KINDS))
    if (
      kinds === null ||
      kinds.length === 0 ||
      finite(raw['affinity'], -100, 100) === null ||
      finite(raw['trust'], -100, 100) === null ||
      finite(raw['romance'], 0, 100) === null ||
      finite(raw['rivalry'], 0, 100) === null ||
      !validMemories(raw['memories'])
    ) {
      return false
    }
    pairs.add(pair)
  }
  return true
}

function validConsent(value: unknown): boolean {
  return isRecord(value) &&
    oneOf(value['action'], RELATIONSHIP_ACTIONS) !== null &&
    safeInteger(value['day']) !== null &&
    value['playerConsented'] === true &&
    value['npcConsented'] === true
}

function validPlayerRelationships(value: unknown): boolean {
  const relationships = rows(value, EXPECTED_NPC_COUNT)
  if (relationships === null) return false
  const seen = new Set<string>()
  for (const raw of relationships) {
    if (!isRecord(raw)) return false
    const npcId = id(raw['npcId'])
    const consentHistory = rows(raw['consentHistory'])
    if (
      npcId === null ||
      !NPC_IDS.has(npcId) ||
      seen.has(npcId) ||
      oneOf(raw['friendship'], FRIENDSHIP_TIERS) === null ||
      oneOf(raw['romance'], ROMANCE_STAGES) === null ||
      typeof raw['sharedHome'] !== 'boolean' ||
      oneOf(raw['adoption'], ADOPTION_STAGES) === null ||
      finite(raw['affinity'], -100, 100) === null ||
      finite(raw['trust'], -100, 100) === null ||
      consentHistory === null ||
      !consentHistory.every(validConsent)
    ) {
      return false
    }
    seen.add(npcId)
  }
  return setEquals(seen, NPC_IDS)
}

function readEventRows(
  value: unknown,
  expectedStatus: 'active' | 'resolved',
  seenIds: Set<string>,
): ReadonlyArray<{ id: string; sourceEventId: string | null }> | null {
  const events = rows(value)
  if (events === null) return null
  const references: Array<{ id: string; sourceEventId: string | null }> = []
  for (const raw of events) {
    if (!isRecord(raw)) return null
    const eventId = id(raw['id'])
    const participants = uniqueKnownIds(raw['participantIds'], NPC_IDS)
    const startedDay = safeInteger(raw['startedDay'])
    const resolvesDay = safeInteger(raw['resolvesDay'])
    const reversalKind = nullableOneOf(raw['reversalKind'], LIFE_EVENT_KINDS)
    const sourceEventId = nullableId(raw['sourceEventId'])
    if (
      eventId === null ||
      seenIds.has(eventId) ||
      oneOf(raw['kind'], LIFE_EVENT_KINDS) === null ||
      participants === null ||
      participants.length === 0 ||
      startedDay === null ||
      resolvesDay === null ||
      resolvesDay < startedDay ||
      raw['status'] !== expectedStatus ||
      reversalKind === undefined ||
      sourceEventId === undefined
    ) {
      return null
    }
    seenIds.add(eventId)
    references.push({ id: eventId, sourceEventId })
  }
  return references
}

function validEvents(active: unknown, history: unknown): boolean {
  const seenIds = new Set<string>()
  const activeRows = readEventRows(active, 'active', seenIds)
  const historyRows = readEventRows(history, 'resolved', seenIds)
  if (activeRows === null || historyRows === null) return false
  return [...activeRows, ...historyRows].every(
    (event) => event.sourceEventId === null || seenIds.has(event.sourceEventId),
  )
}

/** Produces a detached JSON-safe copy without reading a clock or generating any values. */
export function cloneLifeSimulationState(state: LifeSimulationState): LifeSimulationState {
  return JSON.parse(JSON.stringify(state)) as LifeSimulationState
}

/** Strictly decodes the canonical 240-resident life snapshot, or fails closed. */
export function readLifeSimulationState(
  value: unknown,
  expectedSeed: number,
): LifeSimulationState | null {
  if (!isRecord(value) || NPC_DEFINITIONS.length !== EXPECTED_NPC_COUNT) return null
  const normalizedSeed = expectedSeed >>> 0
  if (value['seed'] !== normalizedSeed || !validCalendar(value['calendar'], normalizedSeed)) return null
  const instanceIds = validStructureInstances(value['structureInstances'])
  const employmentStatuses = instanceIds === null
    ? null
    : readEmployments(value['employments'], instanceIds)
  if (
    instanceIds === null ||
    employmentStatuses === null ||
    !validNPCs(value['npcs'], employmentStatuses) ||
    !validHouseholds(value['households'], instanceIds) ||
    !validRelationships(value['relationships']) ||
    !validPlayerRelationships(value['playerRelationships']) ||
    !validEvents(value['activeEvents'], value['eventHistory'])
  ) {
    return null
  }
  try {
    return cloneLifeSimulationState(value as unknown as LifeSimulationState)
  } catch {
    return null
  }
}
