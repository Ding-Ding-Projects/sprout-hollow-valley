import {
  EXTERIOR_ROOM_ID,
  type ActorKind,
  type DoorDef,
  type FixtureKind,
  type InteriorGraph,
  type InteractionDef,
} from './models'

export type InteriorPresence = 'outside' | 'inside' | 'using'

export type SanitationStage =
  | 'needs-toilet'
  | 'needs-sink'
  | 'needs-water'
  | 'needs-soap'
  | 'needs-rinse'
  | 'needs-drying'
  | 'complete'

export type InteriorUseKind = 'station' | 'fixture'

export interface ActiveInteriorUse {
  readonly kind: InteriorUseKind
  readonly targetId: string
  readonly roomId: string
  readonly durationTicks: number
  readonly remainingTicks: number
}

export type InteriorRuntimeEventKind =
  | 'entered'
  | 'door-traversed'
  | 'use-started'
  | 'use-advanced'
  | 'use-completed'
  | 'exited'
  | 'rejected'

export interface InteriorRuntimeEvent {
  readonly serial: number
  readonly tick: number
  readonly kind: InteriorRuntimeEventKind
  readonly structureId: string | null
  readonly roomId: string | null
  readonly targetId: string | null
  readonly message: string
}

export interface InteriorActorState {
  readonly actorId: string
  readonly actorKind: ActorKind
  readonly npcRole: string | null
  readonly presence: InteriorPresence
  readonly structureId: string | null
  readonly roomId: string | null
  readonly activeUse: ActiveInteriorUse | null
  readonly sanitationStage: SanitationStage
  readonly hygieneComplete: boolean
  readonly serial: number
  readonly tick: number
  readonly events: readonly InteriorRuntimeEvent[]
  readonly useCounts: Readonly<Record<string, number>>
}

export type InteriorRuntimeErrorCode =
  | 'invalid-actor'
  | 'invalid-state'
  | 'wrong-structure'
  | 'missing-definition'
  | 'wrong-room'
  | 'access-denied'
  | 'actor-not-allowed'
  | 'npc-role-not-allowed'
  | 'not-operational'
  | 'not-accessible'
  | 'use-in-progress'
  | 'no-use-in-progress'
  | 'invalid-ticks'
  | 'sanitation-out-of-order'

export interface InteriorRuntimeError {
  readonly code: InteriorRuntimeErrorCode
  readonly message: string
}

export interface InteriorRuntimeResult {
  readonly ok: boolean
  readonly state: InteriorActorState
  readonly error: InteriorRuntimeError | null
}

export interface DoorAccessResolution {
  readonly doorId: string
  readonly stepIds: readonly string[]
}

interface StateChanges {
  readonly presence?: InteriorPresence
  readonly structureId?: string | null
  readonly roomId?: string | null
  readonly activeUse?: ActiveInteriorUse | null
  readonly sanitationStage?: SanitationStage
  readonly hygieneComplete?: boolean
  readonly tick?: number
  readonly useCounts?: Readonly<Record<string, number>>
}

function appendEvent(
  state: InteriorActorState,
  changes: StateChanges,
  kind: InteriorRuntimeEventKind,
  message: string,
  structureId: string | null,
  roomId: string | null,
  targetId: string | null,
): InteriorActorState {
  const serial = state.serial + 1
  const tick = changes.tick ?? state.tick
  const event: InteriorRuntimeEvent = {
    serial,
    tick,
    kind,
    structureId,
    roomId,
    targetId,
    message,
  }
  return {
    ...state,
    ...changes,
    serial,
    events: [...state.events, event],
  }
}

function accepted(
  state: InteriorActorState,
  changes: StateChanges,
  kind: InteriorRuntimeEventKind,
  message: string,
  structureId: string | null,
  roomId: string | null,
  targetId: string | null,
): InteriorRuntimeResult {
  return {
    ok: true,
    state: appendEvent(state, changes, kind, message, structureId, roomId, targetId),
    error: null,
  }
}

function rejected(
  state: InteriorActorState,
  code: InteriorRuntimeErrorCode,
  message: string,
  targetId: string | null = null,
): InteriorRuntimeResult {
  const error: InteriorRuntimeError = { code, message }
  return {
    ok: false,
    state: appendEvent(
      state,
      {},
      'rejected',
      message,
      state.structureId,
      state.roomId,
      targetId,
    ),
    error,
  }
}

function actorAllowed(state: InteriorActorState, interaction: InteractionDef): boolean {
  return interaction.actorKinds.some((kind) => kind === state.actorKind)
}

function graphMatches(state: InteriorActorState, graph: InteriorGraph): boolean {
  return state.structureId === graph.id
}

function accessResolved(door: DoorDef, resolution: DoorAccessResolution | undefined): boolean {
  if (door.access.initiallyOpen) return true
  if (resolution === undefined || resolution.doorId !== door.id) return false
  if (resolution.stepIds.length !== door.access.eventualAccess.length) return false
  return door.access.eventualAccess.every(
    (step, index) =>
      step.deterministic &&
      step.guaranteed &&
      resolution.stepIds[index] === step.id,
  )
}

function sanitationFixture(kind: FixtureKind): boolean {
  return (
    kind === 'toilet' ||
    kind === 'accessible-toilet' ||
    kind === 'sink' ||
    kind === 'water' ||
    kind === 'soap' ||
    kind === 'drying'
  )
}

function fixtureAllowedForStage(stage: SanitationStage, kind: FixtureKind): boolean {
  if (!sanitationFixture(kind)) return true
  switch (stage) {
    case 'needs-toilet':
    case 'complete':
      return kind === 'toilet' || kind === 'accessible-toilet'
    case 'needs-sink':
      return kind === 'sink'
    case 'needs-water':
    case 'needs-rinse':
      return kind === 'water'
    case 'needs-soap':
      return kind === 'soap'
    case 'needs-drying':
      return kind === 'drying'
  }
}

function nextSanitationStage(stage: SanitationStage, kind: FixtureKind): SanitationStage {
  if ((stage === 'needs-toilet' || stage === 'complete') && (kind === 'toilet' || kind === 'accessible-toilet')) {
    return 'needs-sink'
  }
  if (stage === 'needs-sink' && kind === 'sink') return 'needs-water'
  if (stage === 'needs-water' && kind === 'water') return 'needs-soap'
  if (stage === 'needs-soap' && kind === 'soap') return 'needs-rinse'
  if (stage === 'needs-rinse' && kind === 'water') return 'needs-drying'
  if (stage === 'needs-drying' && kind === 'drying') return 'complete'
  return stage
}

export function createInteriorActorState(
  actorId: string,
  actorKind: ActorKind,
  npcRole: string | null = null,
): InteriorActorState {
  const cleanActorId = actorId.trim()
  if (cleanActorId.length === 0) throw new Error('createInteriorActorState: actorId is required')
  const cleanRole = npcRole?.trim() ?? null
  if (actorKind === 'npc' && (cleanRole === null || cleanRole.length === 0)) {
    throw new Error('createInteriorActorState: npcRole is required for an NPC')
  }
  return {
    actorId: cleanActorId,
    actorKind,
    npcRole: actorKind === 'npc' ? cleanRole : null,
    presence: 'outside',
    structureId: null,
    roomId: null,
    activeUse: null,
    sanitationStage: 'needs-toilet',
    hygieneComplete: false,
    serial: 0,
    tick: 0,
    events: [],
    useCounts: {},
  }
}

export function resolveDoorAccess(door: DoorDef): DoorAccessResolution {
  return {
    doorId: door.id,
    stepIds: door.access.eventualAccess.map((step) => step.id),
  }
}

export function enterInterior(
  state: InteriorActorState,
  graph: InteriorGraph,
  resolution?: DoorAccessResolution,
): InteriorRuntimeResult {
  if (state.presence !== 'outside' || state.structureId !== null || state.roomId !== null) {
    return rejected(state, 'invalid-state', 'The actor must be outside before entering an interior.')
  }
  const room = graph.rooms.find((candidate) => candidate.id === graph.entryRoomId)
  const door = graph.doors.find((candidate) => candidate.id === graph.entryDoorId)
  if (room === undefined || door === undefined) {
    return rejected(state, 'missing-definition', 'The structure entry room or entry door is missing.')
  }
  const realEntry =
    door.exterior &&
    ((door.fromRoomId === EXTERIOR_ROOM_ID && door.toRoomId === room.id) ||
      (door.toRoomId === EXTERIOR_ROOM_ID && door.fromRoomId === room.id))
  if (!realEntry) {
    return rejected(state, 'missing-definition', 'The entry door does not connect the exterior to the entry room.', door.id)
  }
  if (!door.accessible || !room.accessible) {
    return rejected(state, 'not-accessible', 'The structure entry route is not accessible.', door.id)
  }
  if (!actorAllowed(state, door.interaction)) {
    return rejected(state, 'actor-not-allowed', 'This actor kind cannot operate the entry door.', door.id)
  }
  if (!accessResolved(door, resolution)) {
    return rejected(state, 'access-denied', 'The entry door eventual-access steps have not been resolved.', door.id)
  }
  return accepted(
    state,
    {
      presence: 'inside',
      structureId: graph.id,
      roomId: room.id,
      activeUse: null,
    },
    'entered',
    `Entered ${graph.name}.`,
    graph.id,
    room.id,
    door.id,
  )
}

export function traverseDoor(
  state: InteriorActorState,
  graph: InteriorGraph,
  doorId: string,
  resolution?: DoorAccessResolution,
): InteriorRuntimeResult {
  if (!graphMatches(state, graph)) {
    return rejected(state, 'wrong-structure', 'The actor is not inside this structure.', doorId)
  }
  if (state.presence === 'using' || state.activeUse !== null) {
    return rejected(state, 'use-in-progress', 'Finish the active use before traversing a door.', doorId)
  }
  if (state.presence !== 'inside' || state.roomId === null) {
    return rejected(state, 'invalid-state', 'The actor must be inside a room to traverse a door.', doorId)
  }
  const door = graph.doors.find((candidate) => candidate.id === doorId)
  if (door === undefined) return rejected(state, 'missing-definition', 'The requested door does not exist.', doorId)
  if (door.exterior || door.fromRoomId === EXTERIOR_ROOM_ID || door.toRoomId === EXTERIOR_ROOM_ID) {
    return rejected(state, 'invalid-state', 'Use exitInterior for an exterior door.', door.id)
  }
  if (!door.accessible) return rejected(state, 'not-accessible', 'The requested door is not accessible.', door.id)
  if (!actorAllowed(state, door.interaction)) {
    return rejected(state, 'actor-not-allowed', 'This actor kind cannot operate the requested door.', door.id)
  }
  if (!accessResolved(door, resolution)) {
    return rejected(state, 'access-denied', 'The door eventual-access steps have not been resolved.', door.id)
  }

  let destinationId: string | null = null
  if (door.fromRoomId === state.roomId) destinationId = door.toRoomId
  else if (door.bidirectional && door.toRoomId === state.roomId) destinationId = door.fromRoomId
  if (destinationId === null || destinationId === state.roomId) {
    return rejected(state, 'wrong-room', 'The requested door is not a traversable link from the current room.', door.id)
  }
  const destination = graph.rooms.find((room) => room.id === destinationId)
  if (destination === undefined) {
    return rejected(state, 'missing-definition', 'The requested door destination does not exist.', door.id)
  }
  if (!destination.accessible) {
    return rejected(state, 'not-accessible', 'The requested destination room is not accessible.', door.id)
  }
  return accepted(
    state,
    { roomId: destination.id },
    'door-traversed',
    `Traversed ${door.label}.`,
    graph.id,
    destination.id,
    door.id,
  )
}

export function startStationUse(
  state: InteriorActorState,
  graph: InteriorGraph,
  stationId: string,
): InteriorRuntimeResult {
  if (!graphMatches(state, graph)) {
    return rejected(state, 'wrong-structure', 'The actor is not inside this structure.', stationId)
  }
  if (state.presence === 'using' || state.activeUse !== null) {
    return rejected(state, 'use-in-progress', 'Another station or fixture use is already active.', stationId)
  }
  if (state.presence !== 'inside' || state.roomId === null) {
    return rejected(state, 'invalid-state', 'The actor must be inside to use a station.', stationId)
  }
  const station = graph.stations.find((candidate) => candidate.id === stationId)
  if (station === undefined) return rejected(state, 'missing-definition', 'The requested station does not exist.', stationId)
  if (station.roomId !== state.roomId) {
    return rejected(state, 'wrong-room', 'The actor is not in the station room.', station.id)
  }
  if (!station.operational) return rejected(state, 'not-operational', station.interaction.failureExplanation, station.id)
  if (!station.accessible) return rejected(state, 'not-accessible', 'The requested station is not accessible.', station.id)
  if (!Number.isInteger(station.interaction.durationTicks) || station.interaction.durationTicks <= 0) {
    return rejected(state, 'not-operational', 'The requested station has no valid deterministic duration.', station.id)
  }
  if (!actorAllowed(state, station.interaction)) {
    return rejected(state, 'actor-not-allowed', 'This actor kind cannot use the requested station.', station.id)
  }
  if (
    state.actorKind === 'npc' &&
    (state.npcRole === null || !station.npcRoles.some((role) => role === state.npcRole))
  ) {
    return rejected(state, 'npc-role-not-allowed', 'The NPC role is not assigned to this station.', station.id)
  }
  const activeUse: ActiveInteriorUse = {
    kind: 'station',
    targetId: station.id,
    roomId: station.roomId,
    durationTicks: station.interaction.durationTicks,
    remainingTicks: station.interaction.durationTicks,
  }
  return accepted(
    state,
    { presence: 'using', activeUse },
    'use-started',
    station.interaction.label,
    graph.id,
    station.roomId,
    station.id,
  )
}

export function startFixtureUse(
  state: InteriorActorState,
  graph: InteriorGraph,
  fixtureId: string,
): InteriorRuntimeResult {
  if (!graphMatches(state, graph)) {
    return rejected(state, 'wrong-structure', 'The actor is not inside this structure.', fixtureId)
  }
  if (state.presence === 'using' || state.activeUse !== null) {
    return rejected(state, 'use-in-progress', 'Another station or fixture use is already active.', fixtureId)
  }
  if (state.presence !== 'inside' || state.roomId === null) {
    return rejected(state, 'invalid-state', 'The actor must be inside to use a fixture.', fixtureId)
  }
  const fixture = graph.fixtures.find((candidate) => candidate.id === fixtureId)
  if (fixture === undefined) return rejected(state, 'missing-definition', 'The requested fixture does not exist.', fixtureId)
  if (fixture.roomId !== state.roomId) {
    return rejected(state, 'wrong-room', 'The actor is not in the fixture room.', fixture.id)
  }
  if (!fixture.operational) return rejected(state, 'not-operational', fixture.interaction.failureExplanation, fixture.id)
  if (!fixture.accessible) return rejected(state, 'not-accessible', 'The requested fixture is not accessible.', fixture.id)
  if (!Number.isInteger(fixture.interaction.durationTicks) || fixture.interaction.durationTicks <= 0) {
    return rejected(state, 'not-operational', 'The requested fixture has no valid deterministic duration.', fixture.id)
  }
  if (!actorAllowed(state, fixture.interaction)) {
    return rejected(state, 'actor-not-allowed', 'This actor kind cannot use the requested fixture.', fixture.id)
  }
  if (!fixtureAllowedForStage(state.sanitationStage, fixture.kind)) {
    return rejected(
      state,
      'sanitation-out-of-order',
      `The sanitation sequence is at ${state.sanitationStage}; ${fixture.kind} is out of order.`,
      fixture.id,
    )
  }
  const activeUse: ActiveInteriorUse = {
    kind: 'fixture',
    targetId: fixture.id,
    roomId: fixture.roomId,
    durationTicks: fixture.interaction.durationTicks,
    remainingTicks: fixture.interaction.durationTicks,
  }
  return accepted(
    state,
    { presence: 'using', activeUse },
    'use-started',
    fixture.interaction.label,
    graph.id,
    fixture.roomId,
    fixture.id,
  )
}

export function advanceInteriorUse(
  state: InteriorActorState,
  graph: InteriorGraph,
  ticks: number,
): InteriorRuntimeResult {
  if (!Number.isInteger(ticks) || ticks <= 0) {
    return rejected(state, 'invalid-ticks', 'Advance ticks must be a positive integer.')
  }
  if (!graphMatches(state, graph)) {
    return rejected(state, 'wrong-structure', 'The actor is not inside this structure.')
  }
  const active = state.activeUse
  if (state.presence !== 'using' || active === null) {
    return rejected(state, 'no-use-in-progress', 'There is no station or fixture use to advance.')
  }
  const nextTick = state.tick + ticks
  if (ticks < active.remainingTicks) {
    const activeUse: ActiveInteriorUse = {
      ...active,
      remainingTicks: active.remainingTicks - ticks,
    }
    return accepted(
      state,
      { tick: nextTick, activeUse },
      'use-advanced',
      `Advanced ${active.targetId} by ${ticks} ticks.`,
      graph.id,
      active.roomId,
      active.targetId,
    )
  }

  let sanitationStage = state.sanitationStage
  let hygieneComplete = state.hygieneComplete
  if (active.kind === 'fixture') {
    const fixture = graph.fixtures.find((candidate) => candidate.id === active.targetId)
    if (fixture === undefined) {
      return rejected(state, 'missing-definition', 'The active fixture no longer exists.', active.targetId)
    }
    sanitationStage = nextSanitationStage(state.sanitationStage, fixture.kind)
    hygieneComplete = sanitationStage === 'complete'
  } else if (!graph.stations.some((station) => station.id === active.targetId)) {
    return rejected(state, 'missing-definition', 'The active station no longer exists.', active.targetId)
  }
  const useCounts: Readonly<Record<string, number>> = {
    ...state.useCounts,
    [active.targetId]: (state.useCounts[active.targetId] ?? 0) + 1,
  }
  return accepted(
    state,
    {
      presence: 'inside',
      activeUse: null,
      tick: nextTick,
      sanitationStage,
      hygieneComplete,
      useCounts,
    },
    'use-completed',
    `Completed ${active.targetId}.`,
    graph.id,
    active.roomId,
    active.targetId,
  )
}

export function advanceInteriorUseToCompletion(
  state: InteriorActorState,
  graph: InteriorGraph,
): InteriorRuntimeResult {
  if (state.activeUse === null) {
    return rejected(state, 'no-use-in-progress', 'There is no station or fixture use to complete.')
  }
  return advanceInteriorUse(state, graph, state.activeUse.remainingTicks)
}

export function exitInterior(
  state: InteriorActorState,
  graph: InteriorGraph,
  resolution?: DoorAccessResolution,
): InteriorRuntimeResult {
  if (!graphMatches(state, graph)) {
    return rejected(state, 'wrong-structure', 'The actor is not inside this structure.')
  }
  if (state.presence === 'using' || state.activeUse !== null) {
    return rejected(state, 'use-in-progress', 'Finish the active use before exiting.')
  }
  if (state.presence !== 'inside' || state.roomId !== graph.entryRoomId) {
    return rejected(state, 'wrong-room', 'The actor must return to the entry room before exiting.')
  }
  const door = graph.doors.find((candidate) => candidate.id === graph.entryDoorId)
  if (door === undefined) return rejected(state, 'missing-definition', 'The structure entry door is missing.')
  const realExit =
    door.exterior &&
    ((door.fromRoomId === EXTERIOR_ROOM_ID && door.toRoomId === graph.entryRoomId) ||
      (door.toRoomId === EXTERIOR_ROOM_ID && door.fromRoomId === graph.entryRoomId))
  if (!realExit) {
    return rejected(state, 'missing-definition', 'The exit door does not connect the entry room to the exterior.', door.id)
  }
  if (!door.accessible) return rejected(state, 'not-accessible', 'The structure exit is not accessible.', door.id)
  if (!actorAllowed(state, door.interaction)) {
    return rejected(state, 'actor-not-allowed', 'This actor kind cannot operate the exit door.', door.id)
  }
  if (!accessResolved(door, resolution)) {
    return rejected(state, 'access-denied', 'The exit door eventual-access steps have not been resolved.', door.id)
  }
  const exitedRoomId = state.roomId
  return accepted(
    state,
    { presence: 'outside', structureId: null, roomId: null, activeUse: null },
    'exited',
    `Exited ${graph.name}.`,
    graph.id,
    exitedRoomId,
    door.id,
  )
}
