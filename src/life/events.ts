import type {
  ConversationMemory,
  EmploymentState,
  LifeEvent,
  LifeEventKind,
  LifeSimulationState,
  NeedState,
  NPCState,
  RelationshipEdge,
} from './types'

const EVENT_DURATION_DAYS: Readonly<Record<LifeEventKind, number>> = {
  argument: 2,
  reconciliation: 1,
  'temporary-move': 3,
  'return-home': 1,
  'job-change': 2,
  promotion: 1,
  resignation: 4,
  'business-break': 3,
  'business-reopen': 1,
  'community-celebration': 1,
  'routine-change': 2,
}

const REVERSAL_KIND: Readonly<Record<LifeEventKind, LifeEventKind | null>> = {
  argument: 'reconciliation',
  reconciliation: null,
  'temporary-move': 'return-home',
  'return-home': null,
  'job-change': null,
  promotion: null,
  resignation: 'job-change',
  'business-break': 'business-reopen',
  'business-reopen': null,
  'community-celebration': null,
  'routine-change': null,
}

const NEED_EFFECTS: Readonly<Record<LifeEventKind, Readonly<NeedState>>> = {
  argument: { energy: -2, hunger: 0, social: -6, hygiene: 0 },
  reconciliation: { energy: 1, hunger: 0, social: 8, hygiene: 0 },
  'temporary-move': { energy: -1, hunger: 0, social: -2, hygiene: 0 },
  'return-home': { energy: 2, hunger: 0, social: 6, hygiene: 1 },
  'job-change': { energy: 1, hunger: 0, social: 3, hygiene: 0 },
  promotion: { energy: 2, hunger: 0, social: 6, hygiene: 0 },
  resignation: { energy: 1, hunger: 0, social: -2, hygiene: 0 },
  'business-break': { energy: 4, hunger: 0, social: 0, hygiene: 1 },
  'business-reopen': { energy: 2, hunger: 0, social: 3, hygiene: 0 },
  'community-celebration': { energy: 2, hunger: -4, social: 12, hygiene: 2 },
  'routine-change': { energy: 1, hunger: 0, social: 1, hygiene: 1 },
}

export interface CreateLifeEventOptions {
  startedDay?: number
  durationDays?: number
  sourceEventId?: string | null
}

export interface ResolveLifeEventResult {
  state: LifeSimulationState
  resolvedEventId: string | null
  recoveryEvent: LifeEvent | null
}

export interface ResolveDueLifeEventsResult {
  state: LifeSimulationState
  resolvedEventIds: string[]
  recoveryEvents: LifeEvent[]
}

function finiteDay(value: number, fallback = 0): number {
  return Math.max(0, Number.isFinite(value) ? Math.floor(value) : fallback)
}

function boundedDuration(value: number, fallback: number): number {
  const duration = Number.isFinite(value) ? Math.floor(value) : fallback
  return Math.max(1, Math.min(7, duration))
}

function bounded(value: number, minimum: number, maximum: number): number {
  const finite = Number.isFinite(value) ? value : minimum
  return Math.max(minimum, Math.min(maximum, finite))
}

function normalizedParticipantIds(participantIds: readonly string[]): string[] {
  return [...new Set(participantIds.filter((id) => id.length > 0))].sort((a, b) =>
    a.localeCompare(b),
  )
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

function copiedEvent(event: LifeEvent): LifeEvent {
  return { ...event, participantIds: [...event.participantIds] }
}

/** Creates the same semantic event ID for the same state seed, day, kind, participants and source. */
export function createLifeEvent(
  state: LifeSimulationState,
  kind: LifeEventKind,
  participantIds: readonly string[],
  options: CreateLifeEventOptions | number = {},
): LifeEvent {
  const resolvedOptions = typeof options === 'number' ? { durationDays: options } : options
  const startedDay = finiteDay(resolvedOptions.startedDay ?? state.calendar.absoluteDay)
  const durationDays = boundedDuration(
    resolvedOptions.durationDays ?? EVENT_DURATION_DAYS[kind],
    EVENT_DURATION_DAYS[kind],
  )
  const participants = normalizedParticipantIds(participantIds)
  const sourceEventId = resolvedOptions.sourceEventId ?? null
  const identity = [
    state.seed,
    kind,
    startedDay,
    startedDay + durationDays,
    participants.join(','),
    sourceEventId ?? 'origin',
  ].join('|')

  return {
    id: `life-event-${kind}-${startedDay}-${stableHash(identity)}`,
    kind,
    participantIds: participants,
    startedDay,
    resolvesDay: startedDay + durationDays,
    status: 'active',
    reversalKind: REVERSAL_KIND[kind],
    sourceEventId,
  }
}

function eventMemory(event: LifeEvent, status: 'active' | 'resolved', day: number): ConversationMemory {
  return {
    key: `life-event:${event.id}:${status}`,
    value: `${event.kind}:${status}`,
    day,
    expiresDay: day + 28,
  }
}

function appendMemory(
  memories: readonly ConversationMemory[],
  memory: ConversationMemory,
): ConversationMemory[] {
  if (memories.some((candidate) => candidate.key === memory.key)) return [...memories]
  return [...memories, memory]
}

function applyNeedEffect(needs: NeedState, kind: LifeEventKind): NeedState {
  const effect = NEED_EFFECTS[kind]
  return {
    energy: bounded(needs.energy + effect.energy, 0, 100),
    hunger: bounded(needs.hunger + effect.hunger, 0, 100),
    social: bounded(needs.social + effect.social, 0, 100),
    hygiene: bounded(needs.hygiene + effect.hygiene, 0, 100),
  }
}

function applyNPCEvent(npc: NPCState, event: LifeEvent): NPCState {
  if (!event.participantIds.includes(npc.npcId)) return npc

  let unavailableUntilDay = npc.unavailableUntilDay
  if (event.kind === 'temporary-move' || event.kind === 'business-break') {
    unavailableUntilDay = Math.max(unavailableUntilDay ?? 0, event.resolvesDay)
  } else if (event.kind === 'return-home' || event.kind === 'business-reopen') {
    unavailableUntilDay = null
  }

  return {
    ...npc,
    needs: applyNeedEffect(npc.needs, event.kind),
    unavailableUntilDay,
    memories: appendMemory(npc.memories, eventMemory(event, 'active', event.startedDay)),
  }
}

function employmentParticipates(employment: EmploymentState, participantIds: ReadonlySet<string>): boolean {
  return (
    participantIds.has(employment.npcId) ||
    participantIds.has(employment.structureDefinitionId) ||
    (employment.structureInstanceId !== null && participantIds.has(employment.structureInstanceId))
  )
}

function applyEmploymentEvent(
  employment: EmploymentState,
  event: LifeEvent,
  participantIds: ReadonlySet<string>,
): EmploymentState {
  if (!employmentParticipates(employment, participantIds)) return employment

  switch (event.kind) {
    case 'job-change':
    case 'business-reopen':
      return { ...employment, status: 'active', sinceDay: event.startedDay }
    case 'promotion':
      return {
        ...employment,
        status: 'active',
        sinceDay: event.startedDay,
        level: Math.min(10, Math.max(1, employment.level + 1)),
      }
    case 'resignation':
      return { ...employment, status: 'resigned', sinceDay: event.startedDay }
    case 'business-break':
      return { ...employment, status: 'leave', sinceDay: event.startedDay }
    case 'argument':
    case 'reconciliation':
    case 'temporary-move':
    case 'return-home':
    case 'community-celebration':
    case 'routine-change':
      return employment
  }
}

function applyRelationshipEvent(
  relationship: RelationshipEdge,
  event: LifeEvent,
  participantIds: ReadonlySet<string>,
): RelationshipEdge {
  if (!participantIds.has(relationship.a) || !participantIds.has(relationship.b)) {
    return relationship
  }

  let affinity = 0
  let trust = 0
  let rivalry = 0
  if (event.kind === 'argument') {
    affinity = -6
    trust = -4
    rivalry = 8
  } else if (event.kind === 'reconciliation') {
    affinity = 8
    trust = 6
    rivalry = -10
  } else if (event.kind === 'community-celebration') {
    affinity = 3
    trust = 2
    rivalry = -2
  } else if (event.kind === 'return-home') {
    affinity = 1
    trust = 1
    rivalry = -1
  } else {
    return relationship
  }

  return {
    ...relationship,
    affinity: bounded(relationship.affinity + affinity, -100, 100),
    trust: bounded(relationship.trust + trust, -100, 100),
    rivalry: bounded(relationship.rivalry + rivalry, 0, 100),
  }
}

/** Applies an event once. Reapplying an existing event ID is an immutable no-op. */
export function applyLifeEvent(state: LifeSimulationState, event: LifeEvent): LifeSimulationState {
  if (
    state.activeEvents.some((candidate) => candidate.id === event.id) ||
    state.eventHistory.some((candidate) => candidate.id === event.id)
  ) {
    return state
  }

  const activeEvent: LifeEvent = {
    ...event,
    participantIds: normalizedParticipantIds(event.participantIds),
    startedDay: finiteDay(event.startedDay, state.calendar.absoluteDay),
    resolvesDay: Math.max(
      finiteDay(event.startedDay, state.calendar.absoluteDay) + 1,
      finiteDay(event.resolvesDay, state.calendar.absoluteDay + 1),
    ),
    status: 'active',
  }
  const participantIds = new Set(activeEvent.participantIds)
  const employments = state.employments.map((employment) =>
    applyEmploymentEvent(employment, activeEvent, participantIds),
  )
  const employmentStatus = new Map(
    employments.map((employment) => [employment.npcId, employment.status]),
  )

  return {
    ...state,
    activeEvents: [...state.activeEvents.map(copiedEvent), activeEvent],
    npcs: state.npcs.map((npc) => {
      const applied = applyNPCEvent(npc, activeEvent)
      const status = employmentStatus.get(npc.npcId)
      return status === undefined || status === applied.employmentStatus
        ? applied
        : { ...applied, employmentStatus: status }
    }),
    households: state.households.map((household) => {
      const participates =
        participantIds.has(household.id) ||
        household.memberIds.some((memberId) => participantIds.has(memberId))
      if (!participates) return household
      if (activeEvent.kind === 'temporary-move') {
        return {
          ...household,
          temporaryMoveUntilDay: Math.max(
            household.temporaryMoveUntilDay ?? 0,
            activeEvent.resolvesDay,
          ),
        }
      }
      if (activeEvent.kind === 'return-home') {
        return { ...household, temporaryMoveUntilDay: null }
      }
      return household
    }),
    employments,
    relationships: state.relationships.map((relationship) =>
      applyRelationshipEvent(relationship, activeEvent, participantIds),
    ),
  }
}

function resolvedNPC(npc: NPCState, event: LifeEvent, day: number): NPCState {
  if (!event.participantIds.includes(npc.npcId)) return npc
  return {
    ...npc,
    memories: appendMemory(npc.memories, eventMemory(event, 'resolved', day)),
  }
}

/** Resolves one active event and immediately starts its bounded cozy recovery, when defined. */
export function resolveLifeEvent(
  state: LifeSimulationState,
  eventOrId: LifeEvent | string,
  day = state.calendar.absoluteDay,
): ResolveLifeEventResult {
  const eventId = typeof eventOrId === 'string' ? eventOrId : eventOrId.id
  const event = state.activeEvents.find(
    (candidate) => candidate.id === eventId && candidate.status === 'active',
  )
  if (event === undefined) {
    return { state, resolvedEventId: null, recoveryEvent: null }
  }

  const resolvedDay = finiteDay(day, state.calendar.absoluteDay)
  const resolvedEvent: LifeEvent = { ...copiedEvent(event), status: 'resolved' }
  const historyWithoutDuplicate = state.eventHistory.filter(
    (candidate) => candidate.id !== resolvedEvent.id,
  )
  let next: LifeSimulationState = {
    ...state,
    activeEvents: state.activeEvents
      .filter((candidate) => candidate.id !== resolvedEvent.id)
      .map(copiedEvent),
    eventHistory: [...historyWithoutDuplicate.map(copiedEvent), resolvedEvent],
    npcs: state.npcs.map((npc) => resolvedNPC(npc, resolvedEvent, resolvedDay)),
  }

  const reversalKind = resolvedEvent.reversalKind
  if (reversalKind === null) {
    return { state: next, resolvedEventId: resolvedEvent.id, recoveryEvent: null }
  }

  const existingRecovery = [...next.activeEvents, ...next.eventHistory].find(
    (candidate) =>
      candidate.sourceEventId === resolvedEvent.id &&
      candidate.kind === reversalKind,
  )
  if (existingRecovery !== undefined) {
    return { state: next, resolvedEventId: resolvedEvent.id, recoveryEvent: null }
  }

  const recoveryEvent = createLifeEvent(
    next,
    reversalKind,
    resolvedEvent.participantIds,
    {
      startedDay: resolvedDay,
      durationDays: EVENT_DURATION_DAYS[reversalKind],
      sourceEventId: resolvedEvent.id,
    },
  )
  next = applyLifeEvent(next, recoveryEvent)
  return { state: next, resolvedEventId: resolvedEvent.id, recoveryEvent }
}

/** Resolves every event due on or before `day` in a stable order. */
export function resolveDueLifeEvents(
  state: LifeSimulationState,
  day = state.calendar.absoluteDay,
): ResolveDueLifeEventsResult {
  const resolvedDay = finiteDay(day, state.calendar.absoluteDay)
  const dueEventIds = state.activeEvents
    .filter((event) => event.status === 'active' && event.resolvesDay <= resolvedDay)
    .slice()
    .sort(
      (a, b) =>
        a.resolvesDay - b.resolvesDay ||
        a.startedDay - b.startedDay ||
        a.id.localeCompare(b.id),
    )
    .map((event) => event.id)

  let next = state
  const resolvedEventIds: string[] = []
  const recoveryEvents: LifeEvent[] = []
  for (const eventId of dueEventIds) {
    const result = resolveLifeEvent(next, eventId, resolvedDay)
    next = result.state
    if (result.resolvedEventId !== null) resolvedEventIds.push(result.resolvedEventId)
    if (result.recoveryEvent !== null) recoveryEvents.push(copiedEvent(result.recoveryEvent))
  }

  return { state: next, resolvedEventIds, recoveryEvents }
}
