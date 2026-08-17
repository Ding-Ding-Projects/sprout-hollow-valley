import {
  NON_FACTORY_CONTEXTS,
  requiredStationKindsForContext,
} from '../facilities/requirements'
import {
  BUILDING_INTERIOR_COUNT,
  FACTORY_INTERIOR_COUNT,
  TOTAL_INTERIOR_COUNT,
} from './catalogue'
import {
  EXTERIOR_ROOM_ID,
  type ActorKind,
  type DoorDef,
  type FixtureKind,
  type InteriorGraph,
  type StationKind,
  type StructureContext,
  type StructureKind,
} from './models'

export const INTERIOR_VALIDATION_ISSUE_CODES = [
  'invalid-registry',
  'invalid-graph',
  'invalid-definition',
  'missing-collection',
  'empty-id',
  'duplicate-id',
  'missing-save-key',
  'duplicate-save-key',
  'missing-field',
  'invalid-structure-kind',
  'invalid-structure-context',
  'structure-kind-context-mismatch',
  'structure-identity-mismatch',
  'invalid-room-purpose',
  'room-not-accessible',
  'missing-reference',
  'door-missing-endpoint',
  'door-self-link',
  'door-endpoint-not-found',
  'door-exterior-mismatch',
  'door-not-accessible',
  'door-access-invalid',
  'entry-room-invalid',
  'entry-door-invalid',
  'unreachable-room',
  'room-door-registration-mismatch',
  'room-station-registration-mismatch',
  'room-fixture-registration-mismatch',
  'interaction-incomplete',
  'interaction-duration-invalid',
  'interaction-actor-missing',
  'station-not-operational',
  'station-not-accessible',
  'station-npc-role-missing',
  'station-contract-invalid',
  'fixture-not-operational',
  'fixture-not-accessible',
  'fixture-service-missing',
  'context-stations-mismatch',
  'sanitation-room-missing',
  'sanitation-station-missing',
  'sanitation-fixture-missing',
  'sanitation-fixture-invalid',
  'sanitation-privacy-invalid',
  'sanitation-suite-incomplete',
  'registry-duplicate-structure-id',
  'registry-total-count-mismatch',
  'registry-factory-count-mismatch',
  'registry-building-count-mismatch',
] as const

export type InteriorValidationIssueCode =
  (typeof INTERIOR_VALIDATION_ISSUE_CODES)[number]

export interface InteriorValidationIssue {
  readonly code: InteriorValidationIssueCode
  readonly structureId: string
  readonly path: string
  readonly message: string
}

interface IndexedRecord {
  readonly value: Readonly<Record<string, unknown>>
  readonly path: string
}

interface IdentifiedRecord extends IndexedRecord {
  readonly id: string
}

interface ValuePath {
  readonly value: string
  readonly path: string
}

const INVALID_STRUCTURE_ID = '$invalid-structure'
const REGISTRY_STRUCTURE_ID = '$structure-registry'
const BOTH_ACTORS: readonly ActorKind[] = ['player', 'npc']
const STRUCTURE_KINDS: readonly StructureKind[] = ['factory', 'building']
const STRUCTURE_CONTEXTS: readonly StructureContext[] = [
  'factory',
  ...NON_FACTORY_CONTEXTS,
]
const ROOM_PURPOSES = [
  'entry',
  'primary',
  'operations',
  'logistics',
  'support',
  'staff',
  'restroom',
] as const
const ACCESS_METHODS = [
  'opening-hours',
  'employment',
  'permission',
  'key',
  'friendship',
  'family',
  'quest',
  'progression',
] as const
const SANITATION_FIXTURE_KINDS: readonly FixtureKind[] = [
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
const SANITATION_STATION_KINDS: readonly StationKind[] = [
  'restroom',
  'handwashing',
]
const ISSUE_ORDER: ReadonlyMap<InteriorValidationIssueCode, number> = new Map(
  INTERIOR_VALIDATION_ISSUE_CODES.map((code, index) => [code, index]),
)

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function knownValue<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.some((candidate) => candidate === value)
}

function addIssue(
  issues: InteriorValidationIssue[],
  code: InteriorValidationIssueCode,
  structureId: string,
  path: string,
  message: string,
): void {
  issues.push({ code, structureId, path, message })
}

function compareIssues(left: InteriorValidationIssue, right: InteriorValidationIssue): number {
  const codeDifference =
    (ISSUE_ORDER.get(left.code) ?? Number.MAX_SAFE_INTEGER) -
    (ISSUE_ORDER.get(right.code) ?? Number.MAX_SAFE_INTEGER)
  if (codeDifference !== 0) return codeDifference
  const structureDifference = left.structureId.localeCompare(right.structureId)
  if (structureDifference !== 0) return structureDifference
  const pathDifference = left.path.localeCompare(right.path)
  if (pathDifference !== 0) return pathDifference
  return left.message.localeCompare(right.message)
}

function stableIssues(issues: readonly InteriorValidationIssue[]): readonly InteriorValidationIssue[] {
  return Object.freeze(
    [...issues]
      .sort(compareIssues)
      .map((issue) => Object.freeze({ ...issue })),
  )
}

function recordsFrom(
  value: unknown,
  collectionPath: string,
  structureId: string,
  issues: InteriorValidationIssue[],
): readonly IndexedRecord[] {
  if (!Array.isArray(value)) {
    addIssue(
      issues,
      'missing-collection',
      structureId,
      collectionPath,
      `${collectionPath} must be a defined array.`,
    )
    return []
  }

  const records: IndexedRecord[] = []
  value.forEach((candidate, index) => {
    const path = `${collectionPath}[${index}]`
    if (!isRecord(candidate)) {
      addIssue(
        issues,
        'invalid-definition',
        structureId,
        path,
        `${path} must be an object definition.`,
      )
      return
    }
    records.push({ value: candidate, path })
  })
  return records
}

function requiredString(
  record: Readonly<Record<string, unknown>>,
  field: string,
  path: string,
  structureId: string,
  issues: InteriorValidationIssue[],
): string {
  const value = record[field]
  if (!nonEmptyString(value)) {
    addIssue(
      issues,
      'missing-field',
      structureId,
      `${path}.${field}`,
      `${path}.${field} must be a non-empty string.`,
    )
    return ''
  }
  return value.trim()
}

function definitionId(
  record: Readonly<Record<string, unknown>>,
  path: string,
  structureId: string,
  issues: InteriorValidationIssue[],
): string {
  const value = record.id
  if (!nonEmptyString(value)) {
    addIssue(
      issues,
      'empty-id',
      structureId,
      `${path}.id`,
      `${path}.id must be a non-empty stable identifier.`,
    )
    return ''
  }
  return value.trim()
}

function definitionSaveKey(
  record: Readonly<Record<string, unknown>>,
  path: string,
  structureId: string,
  issues: InteriorValidationIssue[],
): string {
  const value = record.saveKey
  if (!nonEmptyString(value)) {
    addIssue(
      issues,
      'missing-save-key',
      structureId,
      `${path}.saveKey`,
      `${path}.saveKey must be a non-empty persistent key.`,
    )
    return ''
  }
  return value.trim()
}

function identifiedRecords(
  records: readonly IndexedRecord[],
  structureId: string,
  issues: InteriorValidationIssue[],
): readonly IdentifiedRecord[] {
  return records.map((record) => ({
    ...record,
    id: definitionId(record.value, record.path, structureId, issues),
  }))
}

function firstRecordById(records: readonly IdentifiedRecord[]): ReadonlyMap<string, IdentifiedRecord> {
  const result = new Map<string, IdentifiedRecord>()
  records.forEach((record) => {
    if (record.id.length > 0 && !result.has(record.id)) result.set(record.id, record)
  })
  return result
}

function checkDuplicates(
  values: readonly ValuePath[],
  code: 'duplicate-id' | 'duplicate-save-key',
  structureId: string,
  label: string,
  issues: InteriorValidationIssue[],
): void {
  const firstPathByValue = new Map<string, string>()
  values.forEach(({ value, path }) => {
    if (value.length === 0) return
    const firstPath = firstPathByValue.get(value)
    if (firstPath === undefined) {
      firstPathByValue.set(value, path)
      return
    }
    addIssue(
      issues,
      code,
      structureId,
      path,
      `${label} "${value}" duplicates ${firstPath}.`,
    )
  })
}

function stringArray(value: unknown): readonly string[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) return null
  return value
}

function exactUniqueSet(actual: unknown, expected: readonly string[]): boolean {
  const values = stringArray(actual)
  if (values === null || values.length !== expected.length) return false
  const actualSet = new Set(values)
  if (actualSet.size !== values.length) return false
  return expected.every((value) => actualSet.has(value))
}

function interactionSupports(
  interaction: unknown,
  actorKind: ActorKind,
): boolean {
  if (!isRecord(interaction)) return false
  const actorKinds = stringArray(interaction.actorKinds)
  return actorKinds !== null && actorKinds.some((kind) => kind === actorKind)
}

function interactionComplete(interaction: unknown): boolean {
  if (!isRecord(interaction)) return false
  return (
    nonEmptyString(interaction.id) &&
    nonEmptyString(interaction.label) &&
    nonEmptyString(interaction.accessibilityLabel) &&
    Number.isInteger(interaction.durationTicks) &&
    typeof interaction.durationTicks === 'number' &&
    interaction.durationTicks > 0 &&
    nonEmptyString(interaction.animationState) &&
    nonEmptyString(interaction.soundState) &&
    nonEmptyString(interaction.failureExplanation) &&
    BOTH_ACTORS.every((actorKind) => interactionSupports(interaction, actorKind))
  )
}

function validateInteraction(
  interaction: unknown,
  path: string,
  structureId: string,
  issues: InteriorValidationIssue[],
  idValues: ValuePath[],
): void {
  if (!isRecord(interaction)) {
    addIssue(
      issues,
      'interaction-incomplete',
      structureId,
      path,
      `${path} must define a complete interaction.`,
    )
    return
  }

  const id = definitionId(interaction, path, structureId, issues)
  if (id.length > 0) idValues.push({ value: id, path: `${path}.id` })
  const requiredFields = [
    'label',
    'accessibilityLabel',
    'animationState',
    'soundState',
    'failureExplanation',
  ] as const
  requiredFields.forEach((field) => {
    if (!nonEmptyString(interaction[field])) {
      addIssue(
        issues,
        'interaction-incomplete',
        structureId,
        `${path}.${field}`,
        `${path}.${field} must be a non-empty interaction field.`,
      )
    }
  })
  if (
    !Number.isInteger(interaction.durationTicks) ||
    typeof interaction.durationTicks !== 'number' ||
    interaction.durationTicks <= 0
  ) {
    addIssue(
      issues,
      'interaction-duration-invalid',
      structureId,
      `${path}.durationTicks`,
      `${path}.durationTicks must be a positive integer.`,
    )
  }
  BOTH_ACTORS.forEach((actorKind) => {
    if (!interactionSupports(interaction, actorKind)) {
      addIssue(
        issues,
        'interaction-actor-missing',
        structureId,
        `${path}.actorKinds`,
        `${path} must support the ${actorKind} actor kind.`,
      )
    }
  })
  const actorKinds = stringArray(interaction.actorKinds)
  if (
    actorKinds === null ||
    actorKinds.length !== new Set(actorKinds).size ||
    actorKinds.some((kind) => !BOTH_ACTORS.some((actorKind) => actorKind === kind))
  ) {
    addIssue(
      issues,
      'interaction-incomplete',
      structureId,
      `${path}.actorKinds`,
      `${path}.actorKinds must contain unique supported actor kinds.`,
    )
  }
}

function accessStepComplete(step: unknown): boolean {
  if (!isRecord(step)) return false
  return (
    nonEmptyString(step.id) &&
    knownValue(step.method, ACCESS_METHODS) &&
    nonEmptyString(step.description) &&
    nonEmptyString(step.grantedBy) &&
    step.deterministic === true &&
    step.guaranteed === true
  )
}

export function doorHasDeterministicAccess(door: DoorDef): boolean {
  if (!isRecord(door) || !isRecord(door.access)) return false
  const access = door.access
  if (!Array.isArray(access.eventualAccess)) return false
  if (access.initiallyOpen === true) {
    return access.reason === null && access.eventualAccess.length === 0
  }
  if (access.initiallyOpen !== false || !nonEmptyString(access.reason)) return false
  if (access.eventualAccess.length === 0) return false
  const ids = new Set<string>()
  return access.eventualAccess.every((step) => {
    if (!accessStepComplete(step) || !isRecord(step) || !nonEmptyString(step.id)) return false
    const id = step.id.trim()
    if (ids.has(id)) return false
    ids.add(id)
    return true
  })
}

function validateDoorAccess(
  access: unknown,
  path: string,
  structureId: string,
  issues: InteriorValidationIssue[],
  idValues: ValuePath[],
): void {
  if (!isRecord(access)) {
    addIssue(
      issues,
      'door-access-invalid',
      structureId,
      path,
      `${path} must define immediate access or a deterministic eventual-access path.`,
    )
    return
  }
  const steps = access.eventualAccess
  if (!Array.isArray(steps)) {
    addIssue(
      issues,
      'door-access-invalid',
      structureId,
      `${path}.eventualAccess`,
      `${path}.eventualAccess must be an array.`,
    )
    return
  }
  if (access.initiallyOpen === true) {
    if (access.reason !== null || steps.length !== 0) {
      addIssue(
        issues,
        'door-access-invalid',
        structureId,
        path,
        `${path} must have a null reason and no eventual steps when initially open.`,
      )
    }
    return
  }
  if (access.initiallyOpen !== false || !nonEmptyString(access.reason) || steps.length === 0) {
    addIssue(
      issues,
      'door-access-invalid',
      structureId,
      path,
      `${path} must state a reason and at least one guaranteed deterministic step when locked.`,
    )
  }
  const stepIds: ValuePath[] = []
  steps.forEach((step, index) => {
    const stepPath = `${path}.eventualAccess[${index}]`
    if (!accessStepComplete(step)) {
      addIssue(
        issues,
        'door-access-invalid',
        structureId,
        stepPath,
        `${stepPath} must define an ID, supported method, description, grant source, and guaranteed deterministic access.`,
      )
    }
    if (isRecord(step)) {
      const id = definitionId(step, stepPath, structureId, issues)
      if (id.length > 0) {
        const valuePath = { value: id, path: `${stepPath}.id` }
        stepIds.push(valuePath)
        idValues.push(valuePath)
      }
    }
  })
  checkDuplicates(stepIds, 'duplicate-id', structureId, 'Door access step ID', issues)
}

function stationContractComplete(contract: unknown): boolean {
  if (!isRecord(contract)) return false
  const inputs = stringArray(contract.inputs)
  const outputs = stringArray(contract.outputs)
  if (inputs === null || outputs === null) return false
  if (inputs.some((value) => value.trim().length === 0)) return false
  if (outputs.some((value) => value.trim().length === 0)) return false
  if (new Set(inputs).size !== inputs.length || new Set(outputs).size !== outputs.length) return false
  if (contract.kind === 'service') {
    return inputs.length === 0 && outputs.length === 0 && nonEmptyString(contract.service)
  }
  if (contract.kind === 'transform' || contract.kind === 'storage') {
    return inputs.length > 0 && outputs.length > 0 && contract.service === null
  }
  return false
}

function validateStationContract(
  contract: unknown,
  path: string,
  structureId: string,
  issues: InteriorValidationIssue[],
): void {
  if (stationContractComplete(contract)) return
  addIssue(
    issues,
    'station-contract-invalid',
    structureId,
    path,
    `${path} must be a complete transform, storage, or service contract.`,
  )
}

function validNpcRoles(value: unknown): boolean {
  const roles = stringArray(value)
  return (
    roles !== null &&
    roles.length > 0 &&
    roles.every((role) => role.trim().length > 0) &&
    new Set(roles).size === roles.length
  )
}

function definitionBelongsToStructure(
  id: string,
  saveKey: string,
  structureId: string,
  category: 'rooms' | 'doors' | 'stations' | 'fixtures',
): boolean {
  if (id.length === 0 || saveKey.length === 0 || structureId === INVALID_STRUCTURE_ID) return false
  const singular = category.slice(0, -1)
  return id.startsWith(`${structureId}:${singular}:`) && saveKey.startsWith(`${structureId}/${category}/`)
}

function validateStructureOwnership(
  record: IdentifiedRecord,
  saveKey: string,
  structureId: string,
  category: 'rooms' | 'doors' | 'stations' | 'fixtures',
  issues: InteriorValidationIssue[],
): void {
  if (definitionBelongsToStructure(record.id, saveKey, structureId, category)) return
  addIssue(
    issues,
    'structure-identity-mismatch',
    structureId,
    record.path,
    `${record.path} must use IDs and save keys scoped to structure "${structureId}".`,
  )
}

function completePrivacy(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.closable === true &&
    value.opaque === true &&
    value.reachable === true &&
    value.latchOperational === true
  )
}

function completeSanitationFixture(record: Readonly<Record<string, unknown>>): boolean {
  if (
    record.operational !== true ||
    record.accessible !== true ||
    !nonEmptyString(record.service) ||
    !interactionComplete(record.interaction)
  ) {
    return false
  }
  return record.kind !== 'privacy-door' || completePrivacy(record.privacy)
}

function completeSanitationStation(record: Readonly<Record<string, unknown>>): boolean {
  return (
    record.operational === true &&
    record.accessible === true &&
    validNpcRoles(record.npcRoles) &&
    interactionComplete(record.interaction) &&
    stationContractComplete(record.contract)
  )
}

function doorRecordUsable(record: Readonly<Record<string, unknown>>): boolean {
  return (
    record.accessible === true &&
    interactionComplete(record.interaction) &&
    doorHasDeterministicAccess(record as unknown as DoorDef)
  )
}

function reachableRoomIdsFromRecords(
  entryRoomId: string,
  rooms: readonly IdentifiedRecord[],
  doors: readonly IdentifiedRecord[],
): ReadonlySet<string> {
  const roomIds = new Set(rooms.map((room) => room.id).filter((id) => id.length > 0))
  if (!roomIds.has(entryRoomId)) return new Set()
  const reachable = new Set<string>([entryRoomId])
  const queue = [entryRoomId]
  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break
    doors.forEach(({ value: door }) => {
      if (!doorRecordUsable(door)) return
      const fromRoomId = typeof door.fromRoomId === 'string' ? door.fromRoomId : ''
      const toRoomId = typeof door.toRoomId === 'string' ? door.toRoomId : ''
      let destination = ''
      if (fromRoomId === current && roomIds.has(toRoomId)) destination = toRoomId
      else if (door.bidirectional === true && toRoomId === current && roomIds.has(fromRoomId)) {
        destination = fromRoomId
      }
      if (destination.length === 0 || reachable.has(destination)) return
      reachable.add(destination)
      queue.push(destination)
    })
  }
  return reachable
}

export function reachableInteriorRoomIds(graph: InteriorGraph): readonly string[] {
  if (!isRecord(graph)) return []
  const rawRooms = Array.isArray(graph.rooms) ? graph.rooms : []
  const rawDoors = Array.isArray(graph.doors) ? graph.doors : []
  const rooms: IdentifiedRecord[] = rawRooms.flatMap((value, index) =>
    isRecord(value) && nonEmptyString(value.id)
      ? [{ value, path: `rooms[${index}]`, id: value.id.trim() }]
      : [],
  )
  const doors: IdentifiedRecord[] = rawDoors.flatMap((value, index) =>
    isRecord(value) && nonEmptyString(value.id)
      ? [{ value, path: `doors[${index}]`, id: value.id.trim() }]
      : [],
  )
  const entryRoomId = nonEmptyString(graph.entryRoomId) ? graph.entryRoomId.trim() : ''
  return Object.freeze([...reachableRoomIdsFromRecords(entryRoomId, rooms, doors)].sort())
}

function validateContextStations(
  context: StructureContext | null,
  stations: readonly IdentifiedRecord[],
  structureId: string,
  issues: InteriorValidationIssue[],
): void {
  if (context === null) return
  const expected = requiredStationKindsForContext(context)
  const actual = stations
    .map(({ value }) => value.kind)
    .filter((kind): kind is string => typeof kind === 'string')
  const actualCounts = new Map<string, number>()
  actual.forEach((kind) => actualCounts.set(kind, (actualCounts.get(kind) ?? 0) + 1))
  const missing = expected.filter((kind) => !actualCounts.has(kind))
  const unexpected = [...actualCounts.keys()]
    .filter((kind) => !expected.some((required) => required === kind))
    .sort()
  const duplicate = [...actualCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([kind]) => kind)
    .sort()
  if (
    missing.length === 0 &&
    unexpected.length === 0 &&
    duplicate.length === 0 &&
    actual.length === expected.length
  ) {
    return
  }
  const details = [
    `missing [${missing.join(', ')}]`,
    `unexpected [${unexpected.join(', ')}]`,
    `duplicate [${duplicate.join(', ')}]`,
  ].join('; ')
  addIssue(
    issues,
    'context-stations-mismatch',
    structureId,
    'stations',
    `Structure context "${context}" requires exactly its station set: ${details}.`,
  )
}

function validateSanitation(
  rooms: readonly IdentifiedRecord[],
  stations: readonly IdentifiedRecord[],
  fixtures: readonly IdentifiedRecord[],
  reachableRoomIds: ReadonlySet<string>,
  structureId: string,
  issues: InteriorValidationIssue[],
): void {
  const restroomRooms = rooms.filter(({ value }) => value.purpose === 'restroom')
  if (restroomRooms.length === 0) {
    addIssue(
      issues,
      'sanitation-room-missing',
      structureId,
      'rooms',
      'The structure must contain an accessible operational restroom room.',
    )
  }
  const restroomRoomIds = new Set(restroomRooms.map((room) => room.id))
  const sanitationStations = stations.filter(({ value }) =>
    restroomRoomIds.has(typeof value.roomId === 'string' ? value.roomId : ''),
  )
  SANITATION_STATION_KINDS.forEach((kind) => {
    const matching = sanitationStations.filter(({ value }) => value.kind === kind)
    if (matching.length === 0) {
      addIssue(
        issues,
        'sanitation-station-missing',
        structureId,
        'stations',
        `The restroom suite must contain an operational ${kind} station.`,
      )
    } else if (!matching.some(({ value }) => completeSanitationStation(value))) {
      addIssue(
        issues,
        'sanitation-station-missing',
        structureId,
        matching[0].path,
        `The restroom suite has no complete accessible operational ${kind} station.`,
      )
    }
  })

  const sanitationFixtures = fixtures.filter(({ value }) =>
    restroomRoomIds.has(typeof value.roomId === 'string' ? value.roomId : ''),
  )
  SANITATION_FIXTURE_KINDS.forEach((kind) => {
    const matching = sanitationFixtures.filter(({ value }) => value.kind === kind)
    if (matching.length === 0) {
      addIssue(
        issues,
        'sanitation-fixture-missing',
        structureId,
        'fixtures',
        `The restroom suite must contain a ${kind} fixture.`,
      )
      return
    }
    if (!matching.some(({ value }) => completeSanitationFixture(value))) {
      addIssue(
        issues,
        'sanitation-fixture-invalid',
        structureId,
        matching[0].path,
        `The restroom suite has no complete accessible operational ${kind} fixture.`,
      )
    }
    if (kind === 'privacy-door' && !matching.some(({ value }) => completePrivacy(value.privacy))) {
      addIssue(
        issues,
        'sanitation-privacy-invalid',
        structureId,
        matching[0].path,
        'Restroom privacy must be closable, opaque, reachable, and have an operational latch.',
      )
    }
  })

  const hasCompleteSuite = restroomRooms.some(({ id, value: room }) => {
    if (room.accessible !== true || !reachableRoomIds.has(id)) return false
    const roomStations = stations.filter(({ value }) => value.roomId === id)
    const roomFixtures = fixtures.filter(({ value }) => value.roomId === id)
    const stationsComplete = SANITATION_STATION_KINDS.every((kind) =>
      roomStations.some(({ value }) => value.kind === kind && completeSanitationStation(value)),
    )
    const fixturesComplete = SANITATION_FIXTURE_KINDS.every((kind) =>
      roomFixtures.some(({ value }) => value.kind === kind && completeSanitationFixture(value)),
    )
    return stationsComplete && fixturesComplete
  })
  if (!hasCompleteSuite) {
    addIssue(
      issues,
      'sanitation-suite-incomplete',
      structureId,
      'rooms',
      'No single reachable accessible restroom contains the complete operational station, fixture, hand-washing, waste, mirror, and privacy contract.',
    )
  }
}

export function hasCompleteSanitationSuite(graph: InteriorGraph): boolean {
  if (!isRecord(graph) || !Array.isArray(graph.rooms) || !Array.isArray(graph.stations) || !Array.isArray(graph.fixtures)) {
    return false
  }
  const reachable = new Set(reachableInteriorRoomIds(graph))
  const restroomRooms = graph.rooms.filter(
    (room) => isRecord(room) && nonEmptyString(room.id) && room.purpose === 'restroom',
  )
  return restroomRooms.some((room) => {
    if (!isRecord(room) || !nonEmptyString(room.id) || room.accessible !== true || !reachable.has(room.id)) {
      return false
    }
    const roomStations = graph.stations.filter(
      (station) => isRecord(station) && station.roomId === room.id,
    )
    const roomFixtures = graph.fixtures.filter(
      (fixture) => isRecord(fixture) && fixture.roomId === room.id,
    )
    return (
      SANITATION_STATION_KINDS.every((kind) =>
        roomStations.some(
          (station) => isRecord(station) && station.kind === kind && completeSanitationStation(station),
        ),
      ) &&
      SANITATION_FIXTURE_KINDS.every((kind) =>
        roomFixtures.some(
          (fixture) => isRecord(fixture) && fixture.kind === kind && completeSanitationFixture(fixture),
        ),
      )
    )
  })
}

export function requiredStationKindsForInterior(
  graph: Pick<InteriorGraph, 'context'>,
): readonly StationKind[] {
  if (!knownValue(graph.context, STRUCTURE_CONTEXTS)) return []
  return Object.freeze([...requiredStationKindsForContext(graph.context)])
}

export function validateInteriorGraph(graph: unknown): readonly InteriorValidationIssue[] {
  const issues: InteriorValidationIssue[] = []
  if (!isRecord(graph)) {
    addIssue(
      issues,
      'invalid-graph',
      INVALID_STRUCTURE_ID,
      'graph',
      'An interior graph must be an object definition.',
    )
    return stableIssues(issues)
  }

  const rawId = graph.id
  const structureId = nonEmptyString(rawId) ? rawId.trim() : INVALID_STRUCTURE_ID
  if (!nonEmptyString(rawId)) {
    addIssue(
      issues,
      'empty-id',
      structureId,
      'id',
      'The interior graph ID must be a non-empty stable structure ID.',
    )
  }
  const graphSaveKey = definitionSaveKey(graph, 'graph', structureId, issues)
  requiredString(graph, 'name', 'graph', structureId, issues)

  const kind = knownValue(graph.kind, STRUCTURE_KINDS) ? graph.kind : null
  if (kind === null) {
    addIssue(
      issues,
      'invalid-structure-kind',
      structureId,
      'kind',
      'The interior graph kind must be "factory" or "building".',
    )
  }
  const context = knownValue(graph.context, STRUCTURE_CONTEXTS) ? graph.context : null
  if (context === null) {
    addIssue(
      issues,
      'invalid-structure-context',
      structureId,
      'context',
      'The interior graph context must be factory or a registered non-factory context.',
    )
  }
  if (
    kind !== null &&
    context !== null &&
    ((kind === 'factory' && context !== 'factory') ||
      (kind === 'building' && context === 'factory'))
  ) {
    addIssue(
      issues,
      'structure-kind-context-mismatch',
      structureId,
      'context',
      `Structure kind "${kind}" cannot use context "${context}".`,
    )
  }
  if (
    structureId !== INVALID_STRUCTURE_ID &&
    graphSaveKey.length > 0 &&
    graphSaveKey !== `interiors/${structureId}`
  ) {
    addIssue(
      issues,
      'structure-identity-mismatch',
      structureId,
      'saveKey',
      `Interior saveKey must be "interiors/${structureId}".`,
    )
  }

  const rooms = identifiedRecords(recordsFrom(graph.rooms, 'rooms', structureId, issues), structureId, issues)
  const doors = identifiedRecords(recordsFrom(graph.doors, 'doors', structureId, issues), structureId, issues)
  const stations = identifiedRecords(recordsFrom(graph.stations, 'stations', structureId, issues), structureId, issues)
  const fixtures = identifiedRecords(recordsFrom(graph.fixtures, 'fixtures', structureId, issues), structureId, issues)
  const roomById = firstRecordById(rooms)
  const doorById = firstRecordById(doors)
  const stationById = firstRecordById(stations)
  const fixtureById = firstRecordById(fixtures)
  const idValues: ValuePath[] = []
  const saveKeyValues: ValuePath[] = []
  if (structureId !== INVALID_STRUCTURE_ID) idValues.push({ value: structureId, path: 'id' })
  if (graphSaveKey.length > 0) saveKeyValues.push({ value: graphSaveKey, path: 'saveKey' })

  rooms.forEach((room) => {
    if (room.id.length > 0) idValues.push({ value: room.id, path: `${room.path}.id` })
    const saveKey = definitionSaveKey(room.value, room.path, structureId, issues)
    if (saveKey.length > 0) saveKeyValues.push({ value: saveKey, path: `${room.path}.saveKey` })
    validateStructureOwnership(room, saveKey, structureId, 'rooms', issues)
    requiredString(room.value, 'name', room.path, structureId, issues)
    requiredString(room.value, 'gameplayPurpose', room.path, structureId, issues)
    if (!knownValue(room.value.purpose, ROOM_PURPOSES)) {
      addIssue(
        issues,
        'invalid-room-purpose',
        structureId,
        `${room.path}.purpose`,
        `${room.path}.purpose must be a supported gameplay room purpose.`,
      )
    }
    if (room.value.accessible !== true) {
      addIssue(
        issues,
        'room-not-accessible',
        structureId,
        `${room.path}.accessible`,
        `${room.path} must be accessible.`,
      )
    }
    const registrationFields = ['doorIds', 'stationIds', 'fixtureIds'] as const
    registrationFields.forEach((field) => {
      if (stringArray(room.value[field]) === null) {
        addIssue(
          issues,
          'missing-collection',
          structureId,
          `${room.path}.${field}`,
          `${room.path}.${field} must be an array of definition IDs.`,
        )
      }
    })
  })

  doors.forEach((door) => {
    if (door.id.length > 0) idValues.push({ value: door.id, path: `${door.path}.id` })
    const saveKey = definitionSaveKey(door.value, door.path, structureId, issues)
    if (saveKey.length > 0) saveKeyValues.push({ value: saveKey, path: `${door.path}.saveKey` })
    validateStructureOwnership(door, saveKey, structureId, 'doors', issues)
    requiredString(door.value, 'label', door.path, structureId, issues)
    const fromRoomId = nonEmptyString(door.value.fromRoomId) ? door.value.fromRoomId.trim() : ''
    const toRoomId = nonEmptyString(door.value.toRoomId) ? door.value.toRoomId.trim() : ''
    if (fromRoomId.length === 0 || toRoomId.length === 0) {
      addIssue(
        issues,
        'door-missing-endpoint',
        structureId,
        door.path,
        `${door.path} must have non-empty source and destination room IDs.`,
      )
    }
    if (fromRoomId.length > 0 && fromRoomId === toRoomId) {
      addIssue(
        issues,
        'door-self-link',
        structureId,
        door.path,
        `${door.path} cannot lead back to the same room.`,
      )
    }
    const endpoints = [
      ['fromRoomId', fromRoomId],
      ['toRoomId', toRoomId],
    ] as const
    endpoints.forEach(([field, roomId]) => {
      if (roomId.length > 0 && roomId !== EXTERIOR_ROOM_ID && !roomById.has(roomId)) {
        addIssue(
          issues,
          'door-endpoint-not-found',
          structureId,
          `${door.path}.${field}`,
          `${door.path}.${field} references missing room "${roomId}".`,
        )
      }
    })
    const exteriorEndpointCount =
      (fromRoomId === EXTERIOR_ROOM_ID ? 1 : 0) +
      (toRoomId === EXTERIOR_ROOM_ID ? 1 : 0)
    if (
      (door.value.exterior === true && exteriorEndpointCount !== 1) ||
      (door.value.exterior !== true && exteriorEndpointCount !== 0)
    ) {
      addIssue(
        issues,
        'door-exterior-mismatch',
        structureId,
        `${door.path}.exterior`,
        `${door.path} exterior flag and endpoints do not describe one real exterior connection.`,
      )
    }
    if (door.value.accessible !== true) {
      addIssue(
        issues,
        'door-not-accessible',
        structureId,
        `${door.path}.accessible`,
        `${door.path} must be accessible to remain traversable.`,
      )
    }
    if (typeof door.value.visible !== 'boolean' || typeof door.value.bidirectional !== 'boolean') {
      addIssue(
        issues,
        'missing-field',
        structureId,
        door.path,
        `${door.path} must define visible and bidirectional boolean behavior.`,
      )
    }
    validateDoorAccess(door.value.access, `${door.path}.access`, structureId, issues, idValues)
    validateInteraction(
      door.value.interaction,
      `${door.path}.interaction`,
      structureId,
      issues,
      idValues,
    )
  })

  stations.forEach((station) => {
    if (station.id.length > 0) idValues.push({ value: station.id, path: `${station.path}.id` })
    const saveKey = definitionSaveKey(station.value, station.path, structureId, issues)
    if (saveKey.length > 0) saveKeyValues.push({ value: saveKey, path: `${station.path}.saveKey` })
    validateStructureOwnership(station, saveKey, structureId, 'stations', issues)
    requiredString(station.value, 'name', station.path, structureId, issues)
    requiredString(station.value, 'purpose', station.path, structureId, issues)
    const roomId = requiredString(station.value, 'roomId', station.path, structureId, issues)
    if (roomId.length > 0 && !roomById.has(roomId)) {
      addIssue(
        issues,
        'missing-reference',
        structureId,
        `${station.path}.roomId`,
        `${station.path} references missing room "${roomId}".`,
      )
    }
    if (!nonEmptyString(station.value.kind)) {
      addIssue(
        issues,
        'missing-field',
        structureId,
        `${station.path}.kind`,
        `${station.path}.kind must identify a station kind.`,
      )
    }
    if (station.value.operational !== true) {
      addIssue(
        issues,
        'station-not-operational',
        structureId,
        `${station.path}.operational`,
        `${station.path} must be operational.`,
      )
    }
    if (station.value.accessible !== true) {
      addIssue(
        issues,
        'station-not-accessible',
        structureId,
        `${station.path}.accessible`,
        `${station.path} must be accessible.`,
      )
    }
    if (!validNpcRoles(station.value.npcRoles)) {
      addIssue(
        issues,
        'station-npc-role-missing',
        structureId,
        `${station.path}.npcRoles`,
        `${station.path} must assign at least one unique non-empty NPC role.`,
      )
    }
    validateInteraction(
      station.value.interaction,
      `${station.path}.interaction`,
      structureId,
      issues,
      idValues,
    )
    validateStationContract(
      station.value.contract,
      `${station.path}.contract`,
      structureId,
      issues,
    )
  })

  fixtures.forEach((fixture) => {
    if (fixture.id.length > 0) idValues.push({ value: fixture.id, path: `${fixture.path}.id` })
    const saveKey = definitionSaveKey(fixture.value, fixture.path, structureId, issues)
    if (saveKey.length > 0) saveKeyValues.push({ value: saveKey, path: `${fixture.path}.saveKey` })
    validateStructureOwnership(fixture, saveKey, structureId, 'fixtures', issues)
    requiredString(fixture.value, 'name', fixture.path, structureId, issues)
    const roomId = requiredString(fixture.value, 'roomId', fixture.path, structureId, issues)
    if (roomId.length > 0 && !roomById.has(roomId)) {
      addIssue(
        issues,
        'missing-reference',
        structureId,
        `${fixture.path}.roomId`,
        `${fixture.path} references missing room "${roomId}".`,
      )
    }
    if (!SANITATION_FIXTURE_KINDS.some((kind) => kind === fixture.value.kind)) {
      addIssue(
        issues,
        'missing-field',
        structureId,
        `${fixture.path}.kind`,
        `${fixture.path}.kind must be a supported sanitation fixture kind.`,
      )
    }
    if (fixture.value.operational !== true) {
      addIssue(
        issues,
        'fixture-not-operational',
        structureId,
        `${fixture.path}.operational`,
        `${fixture.path} must be operational.`,
      )
    }
    if (fixture.value.accessible !== true) {
      addIssue(
        issues,
        'fixture-not-accessible',
        structureId,
        `${fixture.path}.accessible`,
        `${fixture.path} must be accessible.`,
      )
    }
    if (!nonEmptyString(fixture.value.service)) {
      addIssue(
        issues,
        'fixture-service-missing',
        structureId,
        `${fixture.path}.service`,
        `${fixture.path} must describe its persistent sanitation service.`,
      )
    }
    if (fixture.value.kind === 'privacy-door') {
      if (!completePrivacy(fixture.value.privacy)) {
        addIssue(
          issues,
          'sanitation-privacy-invalid',
          structureId,
          `${fixture.path}.privacy`,
          `${fixture.path} privacy must be closable, opaque, reachable, and latched.`,
        )
      }
    } else if (fixture.value.privacy !== null) {
      addIssue(
        issues,
        'sanitation-privacy-invalid',
        structureId,
        `${fixture.path}.privacy`,
        `${fixture.path} must reserve privacy behavior for the privacy door fixture.`,
      )
    }
    validateInteraction(
      fixture.value.interaction,
      `${fixture.path}.interaction`,
      structureId,
      issues,
      idValues,
    )
  })

  checkDuplicates(idValues, 'duplicate-id', structureId, 'Definition ID', issues)
  checkDuplicates(saveKeyValues, 'duplicate-save-key', structureId, 'Save key', issues)

  const entryRoomId = nonEmptyString(graph.entryRoomId) ? graph.entryRoomId.trim() : ''
  const entryRoom = roomById.get(entryRoomId)
  if (
    entryRoomId.length === 0 ||
    entryRoom === undefined ||
    entryRoom.value.purpose !== 'entry' ||
    entryRoom.value.accessible !== true
  ) {
    addIssue(
      issues,
      'entry-room-invalid',
      structureId,
      'entryRoomId',
      'entryRoomId must reference an accessible room with entry purpose.',
    )
  }
  const entryDoorId = nonEmptyString(graph.entryDoorId) ? graph.entryDoorId.trim() : ''
  const entryDoor = doorById.get(entryDoorId)
  const entryConnectsExterior =
    entryDoor !== undefined &&
    ((entryDoor.value.fromRoomId === EXTERIOR_ROOM_ID && entryDoor.value.toRoomId === entryRoomId) ||
      (entryDoor.value.toRoomId === EXTERIOR_ROOM_ID && entryDoor.value.fromRoomId === entryRoomId))
  if (
    entryDoorId.length === 0 ||
    entryDoor === undefined ||
    entryDoor.value.exterior !== true ||
    entryDoor.value.visible !== true ||
    entryDoor.value.bidirectional !== true ||
    entryDoor.value.accessible !== true ||
    !entryConnectsExterior ||
    !doorRecordUsable(entryDoor.value)
  ) {
    addIssue(
      issues,
      'entry-door-invalid',
      structureId,
      'entryDoorId',
      'entryDoorId must reference a visible accessible bidirectional real exterior door to the entry room.',
    )
  }

  rooms.forEach((room) => {
    const expectedDoorIds = doors
      .filter(({ value }) => value.fromRoomId === room.id || value.toRoomId === room.id)
      .map((door) => door.id)
    if (!exactUniqueSet(room.value.doorIds, expectedDoorIds)) {
      addIssue(
        issues,
        'room-door-registration-mismatch',
        structureId,
        `${room.path}.doorIds`,
        `${room.path}.doorIds must exactly register every incident door once.`,
      )
    }
    const expectedStationIds = stations
      .filter(({ value }) => value.roomId === room.id)
      .map((station) => station.id)
    if (!exactUniqueSet(room.value.stationIds, expectedStationIds)) {
      addIssue(
        issues,
        'room-station-registration-mismatch',
        structureId,
        `${room.path}.stationIds`,
        `${room.path}.stationIds must exactly register every station in the room once.`,
      )
    }
    const expectedFixtureIds = fixtures
      .filter(({ value }) => value.roomId === room.id)
      .map((fixture) => fixture.id)
    if (!exactUniqueSet(room.value.fixtureIds, expectedFixtureIds)) {
      addIssue(
        issues,
        'room-fixture-registration-mismatch',
        structureId,
        `${room.path}.fixtureIds`,
        `${room.path}.fixtureIds must exactly register every fixture in the room once.`,
      )
    }
    const references = [
      ['doorIds', room.value.doorIds, doorById],
      ['stationIds', room.value.stationIds, stationById],
      ['fixtureIds', room.value.fixtureIds, fixtureById],
    ] as const
    references.forEach(([field, rawValues, definitions]) => {
      const values = stringArray(rawValues)
      if (values === null) return
      values.forEach((value, index) => {
        if (!definitions.has(value)) {
          addIssue(
            issues,
            'missing-reference',
            structureId,
            `${room.path}.${field}[${index}]`,
            `${room.path}.${field} references missing definition "${value}".`,
          )
        }
      })
    })
  })

  const reachableRoomIds = reachableRoomIdsFromRecords(entryRoomId, rooms, doors)
  rooms.forEach((room) => {
    if (room.id.length > 0 && !reachableRoomIds.has(room.id)) {
      addIssue(
        issues,
        'unreachable-room',
        structureId,
        room.path,
        `${room.path} is not reachable from the entry room through accessible immediate or guaranteed eventual door access.`,
      )
    }
  })

  validateContextStations(context, stations, structureId, issues)
  validateSanitation(rooms, stations, fixtures, reachableRoomIds, structureId, issues)
  return stableIssues(issues)
}

export function validateStructureRegistry(registry: unknown): readonly InteriorValidationIssue[] {
  const issues: InteriorValidationIssue[] = []
  const structures = Array.isArray(registry) ? registry : []
  if (!Array.isArray(registry)) {
    addIssue(
      issues,
      'invalid-registry',
      REGISTRY_STRUCTURE_ID,
      'registry',
      'The structure interior registry must be an array.',
    )
  }

  const firstIndexById = new Map<string, number>()
  let factoryCount = 0
  let buildingCount = 0
  structures.forEach((graph, index) => {
    const graphIssues = validateInteriorGraph(graph)
    graphIssues.forEach((issue) => {
      addIssue(
        issues,
        issue.code,
        issue.structureId,
        `structures[${index}].${issue.path}`,
        issue.message,
      )
    })
    if (!isRecord(graph)) return
    if (graph.kind === 'factory') factoryCount += 1
    if (graph.kind === 'building') buildingCount += 1
    if (!nonEmptyString(graph.id)) return
    const id = graph.id.trim()
    const firstIndex = firstIndexById.get(id)
    if (firstIndex === undefined) {
      firstIndexById.set(id, index)
      return
    }
    addIssue(
      issues,
      'registry-duplicate-structure-id',
      id,
      `structures[${index}].id`,
      `Structure ID "${id}" duplicates structures[${firstIndex}].id.`,
    )
  })

  if (structures.length !== TOTAL_INTERIOR_COUNT) {
    addIssue(
      issues,
      'registry-total-count-mismatch',
      REGISTRY_STRUCTURE_ID,
      'registry.length',
      `The registry must contain exactly ${TOTAL_INTERIOR_COUNT} interiors; received ${structures.length}.`,
    )
  }
  if (factoryCount !== FACTORY_INTERIOR_COUNT) {
    addIssue(
      issues,
      'registry-factory-count-mismatch',
      REGISTRY_STRUCTURE_ID,
      'registry',
      `The registry must contain exactly ${FACTORY_INTERIOR_COUNT} factories; received ${factoryCount}.`,
    )
  }
  if (buildingCount !== BUILDING_INTERIOR_COUNT) {
    addIssue(
      issues,
      'registry-building-count-mismatch',
      REGISTRY_STRUCTURE_ID,
      'registry',
      `The registry must contain exactly ${BUILDING_INTERIOR_COUNT} non-factory buildings; received ${buildingCount}.`,
    )
  }
  return stableIssues(issues)
}

export class InteriorValidationError extends Error {
  readonly issues: readonly InteriorValidationIssue[]

  constructor(scope: string, issues: readonly InteriorValidationIssue[]) {
    const first = issues[0]
    const summary =
      first === undefined
        ? `${scope} failed validation.`
        : `${scope} failed validation with ${issues.length} issue(s); first: ${first.code} at ${first.path}: ${first.message}`
    super(summary)
    this.name = 'InteriorValidationError'
    this.issues = stableIssues(issues)
  }
}

export function assertValidInteriorGraph(graph: unknown): asserts graph is InteriorGraph {
  const issues = validateInteriorGraph(graph)
  if (issues.length > 0) throw new InteriorValidationError('Interior graph', issues)
}

export function assertValidStructureRegistry(
  registry: unknown,
): asserts registry is readonly InteriorGraph[] {
  const issues = validateStructureRegistry(registry)
  if (issues.length > 0) throw new InteriorValidationError('Structure interior registry', issues)
}
