import {
  advanceInteriorUse,
  advanceInteriorUseToCompletion,
  createInteriorActorState,
  enterInterior,
  exitInterior,
  resolveDoorAccess as createDoorAccessResolution,
  startFixtureUse,
  startStationUse,
  traverseDoor as traverseInteriorDoor,
  type DoorAccessResolution,
  type InteriorActorState,
  type InteriorRuntimeError,
  type InteriorRuntimeEvent,
  type InteriorRuntimeResult,
  type SanitationStage,
} from '../../interiors/runtime'
import {
  EXTERIOR_ROOM_ID,
  type DoorDef,
  type FixtureKind,
  type InteriorGraph,
} from '../../interiors/models'
import type { Vec3 } from '../../engine3d/collision'
import { buildThreeInteriorPresentation } from './presentation'
import type {
  InteriorDoorFeedback,
  InteriorSanitationPlan,
  InteriorVisibilityMode,
  ThreeInteriorActionResult,
  ThreeInteriorMountTarget,
  ThreeInteriorPresentation,
  ThreeInteriorRuntimeOptions,
  ThreeInteriorRuntimeSnapshot,
} from './types'

const SANITATION_FIXTURE_ORDER: readonly FixtureKind[] = [
  'accessible-toilet',
  'sink',
  'water',
  'soap',
  'water',
  'drying',
]

interface RouteParent {
  readonly roomId: string
  readonly doorId: string
}

function compareId(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function point(value: Vec3): Vec3 {
  return Object.freeze({ x: value.x, y: value.y, z: value.z })
}

function accessRecord(
  value: Readonly<Record<string, DoorAccessResolution>>,
): Readonly<Record<string, DoorAccessResolution>> {
  const copy: Record<string, DoorAccessResolution> = {}
  for (const doorId of Object.keys(value).sort()) {
    const resolution = value[doorId]
    if (resolution === undefined || resolution.doorId !== doorId) continue
    copy[doorId] = Object.freeze({
      doorId,
      stepIds: Object.freeze([...resolution.stepIds]),
    })
  }
  return Object.freeze(copy)
}

function snapshot(
  actor: InteriorActorState,
  position: Vec3 | null,
  doorAccess: Readonly<Record<string, DoorAccessResolution>>,
  revision: number,
): ThreeInteriorRuntimeSnapshot {
  return Object.freeze({
    actor,
    position: position === null ? null : point(position),
    doorAccess: accessRecord(doorAccess),
    revision,
  })
}

function resolved(door: DoorDef, resolution: DoorAccessResolution | undefined): boolean {
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

function destinationRoomId(door: DoorDef, currentRoomId: string | null): string {
  if (currentRoomId === null) {
    return door.fromRoomId === EXTERIOR_ROOM_ID ? door.toRoomId : door.fromRoomId
  }
  if (door.fromRoomId === currentRoomId) return door.toRoomId
  if (door.toRoomId === currentRoomId) return door.fromRoomId
  return door.toRoomId
}

function nextFixtureKind(stage: SanitationStage): FixtureKind {
  switch (stage) {
    case 'needs-toilet':
    case 'complete':
      return 'accessible-toilet'
    case 'needs-sink':
      return 'sink'
    case 'needs-water':
    case 'needs-rinse':
      return 'water'
    case 'needs-soap':
      return 'soap'
    case 'needs-drying':
      return 'drying'
  }
}

/**
 * Deterministic bridge between the typed interior rules and the Three.js presentation.
 * It owns no wall clock or animation loop: callers explicitly select actions and ticks.
 */
export class ThreeInteriorRuntimeAdapter {
  readonly graph: InteriorGraph
  readonly presentation: ThreeInteriorPresentation

  private readonly ownsPresentation: boolean
  private readonly visibilityMode: InteriorVisibilityMode
  private state: ThreeInteriorRuntimeSnapshot
  private mountTarget: ThreeInteriorMountTarget | null = null
  private disposed = false

  constructor(options: ThreeInteriorRuntimeOptions) {
    this.graph = options.graph
    this.presentation = options.presentation ?? buildThreeInteriorPresentation(options.graph, options.build)
    if (this.presentation.graph.id !== this.graph.id) {
      throw new Error('Interior presentation belongs to a different structure graph')
    }
    this.ownsPresentation = options.presentation === undefined
    this.visibilityMode = options.visibilityMode ?? 'floor'

    const initialActor = createInteriorActorState(
      options.actorId,
      options.actorKind,
      options.npcRole ?? null,
    )
    if (options.snapshot !== undefined) {
      this.assertRestorableSnapshot(options.snapshot, initialActor)
      this.state = snapshot(
        options.snapshot.actor,
        options.snapshot.position,
        options.snapshot.doorAccess,
        options.snapshot.revision,
      )
    } else {
      this.state = snapshot(initialActor, null, {}, 0)
    }
    this.syncPresentation()
  }

  get current(): ThreeInteriorRuntimeSnapshot {
    return this.state
  }

  mount(target: ThreeInteriorMountTarget): void {
    this.assertActive()
    if (this.mountTarget !== null) throw new Error('ThreeInteriorRuntimeAdapter is already mounted')
    target.scene.add(this.presentation.root)
    if (target.addCollider !== undefined) {
      for (const collider of this.presentation.colliders) target.addCollider(collider)
    }
    this.mountTarget = target
    this.syncPresentation()
  }

  unmount(): void {
    if (this.mountTarget === null) return
    const target = this.mountTarget
    if (target.removeCollider !== undefined) {
      for (const collider of this.presentation.colliders) target.removeCollider(collider.id)
    }
    target.scene.remove(this.presentation.root)
    this.mountTarget = null
  }

  doorFeedback(doorId: string): InteriorDoorFeedback {
    const door = this.graph.doors.find((candidate) => candidate.id === doorId)
    if (door === undefined) throw new Error(`Unknown interior door "${doorId}"`)
    return this.feedbackForDoor(door)
  }

  resolveDoorAccess(
    doorId: string,
    completedStepIds: readonly string[],
  ): ThreeInteriorActionResult {
    this.assertActive()
    const door = this.graph.doors.find((candidate) => candidate.id === doorId)
    if (door === undefined) return this.localRejected('missing-definition', 'The requested door does not exist.', doorId)
    const expectedStepIds = door.access.eventualAccess.map((step) => step.id)
    const stepsMatch =
      completedStepIds.length === expectedStepIds.length &&
      completedStepIds.every((stepId, index) => stepId === expectedStepIds[index])
    if (!stepsMatch) {
      const result = this.localRejected(
        'access-denied',
        `Door access remains unavailable. Complete the ordered access steps: ${expectedStepIds.join(', ')}.`,
        door.id,
      )
      this.presentation.setDoorFeedback(this.feedbackForDoor(door, result.feedback))
      return result
    }
    const resolution = createDoorAccessResolution(door)
    this.state = snapshot(
      this.state.actor,
      this.state.position,
      { ...this.state.doorAccess, [door.id]: resolution },
      this.state.revision + 1,
    )
    const feedback = this.feedbackForDoor(door)
    this.presentation.setDoorFeedback(feedback)
    return this.localAccepted(feedback.message)
  }

  enter(): ThreeInteriorActionResult {
    this.assertActive()
    const door = this.requireDoor(this.graph.entryDoorId)
    const result = enterInterior(this.state.actor, this.graph, this.state.doorAccess[door.id])
    const destination = this.graph.entryRoomId
    return this.acceptRuntime(
      result,
      result.ok ? this.arrivalPosition(door.id, destination) : null,
      null,
      door,
    )
  }

  exit(): ThreeInteriorActionResult {
    this.assertActive()
    const door = this.requireDoor(this.graph.entryDoorId)
    const result = exitInterior(this.state.actor, this.graph, this.state.doorAccess[door.id])
    return this.acceptRuntime(
      result,
      result.ok ? this.presentation.exteriorReturnPosition : null,
      null,
      door,
    )
  }

  traverseDoor(doorId: string): ThreeInteriorActionResult {
    this.assertActive()
    const door = this.graph.doors.find((candidate) => candidate.id === doorId)
    if (door === undefined) return this.localRejected('missing-definition', 'The requested door does not exist.', doorId)
    const destination = destinationRoomId(door, this.state.actor.roomId)
    const result = traverseInteriorDoor(
      this.state.actor,
      this.graph,
      door.id,
      this.state.doorAccess[door.id],
    )
    return this.acceptRuntime(
      result,
      result.ok ? this.arrivalPosition(door.id, destination) : null,
      null,
      door,
    )
  }

  traverseConnector(connectorId: string): ThreeInteriorActionResult {
    const connector = this.presentation.connectors.get(connectorId)
    if (connector === undefined) {
      return this.localRejected(
        'missing-definition',
        'The requested stairs or elevator does not exist.',
        connectorId,
      )
    }
    return this.traverseDoor(connector.doorId)
  }

  startStation(stationId: string): ThreeInteriorActionResult {
    this.assertActive()
    const station = this.presentation.stations.get(stationId)
    const result = startStationUse(this.state.actor, this.graph, stationId)
    return this.acceptRuntime(
      result,
      null,
      station?.interactionPosition ?? null,
      null,
    )
  }

  useStation(stationId: string): ThreeInteriorActionResult {
    const started = this.startStation(stationId)
    return started.ok ? this.completeActiveUse() : started
  }

  startFixture(fixtureId: string): ThreeInteriorActionResult {
    this.assertActive()
    const fixture = this.presentation.fixtures.get(fixtureId)
    const result = startFixtureUse(this.state.actor, this.graph, fixtureId)
    return this.acceptRuntime(
      result,
      null,
      fixture?.interactionPosition ?? null,
      null,
    )
  }

  useFixture(fixtureId: string): ThreeInteriorActionResult {
    const started = this.startFixture(fixtureId)
    return started.ok ? this.completeActiveUse() : started
  }

  advanceActiveUse(ticks: number): ThreeInteriorActionResult {
    this.assertActive()
    const interactionPosition = this.activeInteractionPosition()
    return this.acceptRuntime(
      advanceInteriorUse(this.state.actor, this.graph, ticks),
      null,
      interactionPosition,
      null,
    )
  }

  completeActiveUse(): ThreeInteriorActionResult {
    this.assertActive()
    const interactionPosition = this.activeInteractionPosition()
    return this.acceptRuntime(
      advanceInteriorUseToCompletion(this.state.actor, this.graph),
      null,
      interactionPosition,
      null,
    )
  }

  sanitationPlan(): InteriorSanitationPlan {
    const restroom = [...this.graph.rooms]
      .filter((room) => room.purpose === 'restroom')
      .sort((a, b) => compareId(a.id, b.id))[0]
    if (restroom === undefined) throw new Error(`${this.graph.id} has no restroom room`)
    const startRoomId = this.state.actor.roomId ?? this.graph.entryRoomId
    const routeDoorIds = this.routeBetween(startRoomId, restroom.id)
    const restroomStation = this.graph.stations.find(
      (station) => station.roomId === restroom.id && station.kind === 'restroom',
    )
    const handwashingStation = this.graph.stations.find(
      (station) => station.roomId === restroom.id && station.kind === 'handwashing',
    )
    if (restroomStation === undefined || handwashingStation === undefined) {
      throw new Error(`${this.graph.id} has no complete sanitation station pair`)
    }
    const fixtureIds = SANITATION_FIXTURE_ORDER.map((kind) => {
      const fixture = this.graph.fixtures.find(
        (candidate) =>
          candidate.roomId === restroom.id &&
          candidate.kind === kind &&
          candidate.operational &&
          candidate.accessible,
      )
      if (fixture === undefined) throw new Error(`${this.graph.id} has no operational ${kind} fixture`)
      return fixture.id
    })
    return Object.freeze({
      restroomRoomId: restroom.id,
      routeDoorIds: Object.freeze(routeDoorIds),
      restroomStationId: restroomStation.id,
      handwashingStationId: handwashingStation.id,
      fixtureIds: Object.freeze(fixtureIds),
    })
  }

  /** Advances exactly one deterministic entry, door, toilet, or hand-washing action. */
  useNextSanitationStep(): ThreeInteriorActionResult {
    this.assertActive()
    if (this.state.actor.presence === 'outside') return this.enter()
    if (this.state.actor.presence === 'using') return this.completeActiveUse()

    const plan = this.sanitationPlan()
    if (this.state.actor.roomId !== plan.restroomRoomId) {
      const nextDoorId = plan.routeDoorIds[0]
      if (nextDoorId === undefined) {
        return this.localRejected(
          'missing-definition',
          'No deterministic route reaches the restroom.',
          plan.restroomRoomId,
        )
      }
      return this.traverseDoor(nextDoorId)
    }

    const kind = nextFixtureKind(this.state.actor.sanitationStage)
    const fixture = this.graph.fixtures.find(
      (candidate) =>
        candidate.roomId === plan.restroomRoomId &&
        candidate.kind === kind &&
        candidate.operational &&
        candidate.accessible,
    )
    if (fixture === undefined) {
      return this.localRejected(
        'missing-definition',
        `The operational sanitation path has no ${kind} fixture.`,
        plan.restroomRoomId,
      )
    }
    return this.useFixture(fixture.id)
  }

  dispose(): void {
    if (this.disposed) return
    this.unmount()
    if (this.ownsPresentation) this.presentation.dispose()
    this.disposed = true
  }

  private assertActive(): void {
    if (this.disposed) throw new Error('ThreeInteriorRuntimeAdapter is disposed')
  }

  private assertRestorableSnapshot(
    restored: ThreeInteriorRuntimeSnapshot,
    expected: InteriorActorState,
  ): void {
    if (restored.actor.actorId !== expected.actorId || restored.actor.actorKind !== expected.actorKind) {
      throw new Error('Interior snapshot actor identity does not match the requested adapter actor')
    }
    if (restored.actor.npcRole !== expected.npcRole) {
      throw new Error('Interior snapshot NPC role does not match the requested adapter actor')
    }
    if (
      restored.actor.structureId !== null &&
      restored.actor.structureId !== this.graph.id
    ) {
      throw new Error('Interior snapshot belongs to a different structure')
    }
    if (restored.actor.presence !== 'outside' && restored.position === null) {
      throw new Error('Interior snapshot must include a position while the actor is inside')
    }
    if (
      restored.actor.roomId !== null &&
      !this.graph.rooms.some((room) => room.id === restored.actor.roomId)
    ) {
      throw new Error('Interior snapshot references a room outside this structure graph')
    }
    for (const [doorId, resolution] of Object.entries(restored.doorAccess)) {
      const door = this.graph.doors.find((candidate) => candidate.id === doorId)
      if (door === undefined || !resolved(door, resolution)) {
        throw new Error(`Interior snapshot has invalid access state for door "${doorId}"`)
      }
    }
    if (!Number.isInteger(restored.revision) || restored.revision < 0) {
      throw new Error('Interior snapshot revision must be a non-negative integer')
    }
  }

  private requireDoor(doorId: string): DoorDef {
    const door = this.graph.doors.find((candidate) => candidate.id === doorId)
    if (door === undefined) throw new Error(`Unknown interior door "${doorId}"`)
    return door
  }

  private feedbackForDoor(door: DoorDef, deniedMessage?: string): InteriorDoorFeedback {
    const destinationId = destinationRoomId(door, this.state.actor.roomId)
    const destination = this.graph.rooms.find((room) => room.id === destinationId)
    const resolution = this.state.doorAccess[door.id]
    const isResolved = resolved(door, resolution)
    const state = deniedMessage !== undefined
      ? 'denied'
      : door.access.initiallyOpen
        ? 'available'
        : isResolved
          ? 'resolved'
          : 'locked'
    const destinationName = destination?.name ?? 'the exterior'
    const steps = door.access.eventualAccess.map((step) => step.description).join(' Then ')
    const message = deniedMessage ?? (
      state === 'available'
        ? `${door.label} is available and leads to ${destinationName}.`
        : state === 'resolved'
          ? `${door.label} access is resolved and leads to ${destinationName}.`
          : `${door.label} is unavailable: ${door.access.reason ?? 'access is required'} ${steps}`.trim()
    )
    return Object.freeze({
      doorId: door.id,
      state,
      message,
      reason: door.access.reason,
      destinationRoomId: destinationId,
      destinationFloor: destination?.floor ?? null,
      accessStepIds: Object.freeze(door.access.eventualAccess.map((step) => step.id)),
    })
  }

  private acceptRuntime(
    result: InteriorRuntimeResult,
    teleportPosition: Vec3 | null,
    interactionPosition: Vec3 | null,
    door: DoorDef | null,
  ): ThreeInteriorActionResult {
    const nextPosition = teleportPosition ?? this.state.position
    this.state = snapshot(
      result.state,
      nextPosition,
      this.state.doorAccess,
      this.state.revision + 1,
    )
    this.syncPresentation()
    if (door !== null) {
      this.presentation.setDoorFeedback(
        this.feedbackForDoor(door, result.ok ? undefined : result.error?.message),
      )
    }
    return Object.freeze({
      ok: result.ok,
      snapshot: this.state,
      error: result.error,
      feedback: result.error?.message ?? result.state.events.at(-1)?.message ?? 'Interior action completed.',
      teleportPosition: teleportPosition === null ? null : point(teleportPosition),
      interactionPosition: interactionPosition === null ? null : point(interactionPosition),
    })
  }

  private localAccepted(message: string): ThreeInteriorActionResult {
    return Object.freeze({
      ok: true,
      snapshot: this.state,
      error: null,
      feedback: message,
      teleportPosition: null,
      interactionPosition: null,
    })
  }

  private localRejected(
    code: InteriorRuntimeError['code'],
    message: string,
    targetId: string | null,
  ): ThreeInteriorActionResult {
    const actor = this.state.actor
    const serial = actor.serial + 1
    const event: InteriorRuntimeEvent = Object.freeze({
      serial,
      tick: actor.tick,
      kind: 'rejected',
      structureId: actor.structureId,
      roomId: actor.roomId,
      targetId,
      message,
    })
    const nextActor: InteriorActorState = {
      ...actor,
      serial,
      events: [...actor.events, event],
    }
    const error: InteriorRuntimeError = Object.freeze({ code, message })
    this.state = snapshot(
      nextActor,
      this.state.position,
      this.state.doorAccess,
      this.state.revision + 1,
    )
    return Object.freeze({
      ok: false,
      snapshot: this.state,
      error,
      feedback: message,
      teleportPosition: null,
      interactionPosition: null,
    })
  }

  private arrivalPosition(doorId: string, roomId: string): Vec3 {
    const endpoint = this.presentation.doors
      .get(doorId)
      ?.endpoints.find((candidate) => candidate.roomId === roomId)
    return endpoint?.arrivalPosition ?? this.requireRoomPosition(roomId)
  }

  private requireRoomPosition(roomId: string): Vec3 {
    const room = this.presentation.rooms.get(roomId)
    if (room === undefined) throw new Error(`No presentation exists for room "${roomId}"`)
    return room.spawnPosition
  }

  private activeInteractionPosition(): Vec3 | null {
    const active = this.state.actor.activeUse
    if (active === null) return null
    return active.kind === 'station'
      ? this.presentation.stations.get(active.targetId)?.interactionPosition ?? null
      : this.presentation.fixtures.get(active.targetId)?.interactionPosition ?? null
  }

  private routeBetween(startRoomId: string, destinationRoomIdValue: string): readonly string[] {
    if (startRoomId === destinationRoomIdValue) return []
    const queue = [startRoomId]
    const visited = new Set<string>([startRoomId])
    const parents = new Map<string, RouteParent>()

    for (let index = 0; index < queue.length; index += 1) {
      const currentRoomId = queue[index]
      if (currentRoomId === undefined) continue
      const candidates = [...this.graph.doors]
        .filter(
          (door) =>
            !door.exterior &&
            (door.fromRoomId === currentRoomId ||
              (door.bidirectional && door.toRoomId === currentRoomId)),
        )
        .sort((a, b) => compareId(a.id, b.id))
      for (const door of candidates) {
        const nextRoomId = door.fromRoomId === currentRoomId ? door.toRoomId : door.fromRoomId
        if (nextRoomId === EXTERIOR_ROOM_ID || visited.has(nextRoomId)) continue
        visited.add(nextRoomId)
        parents.set(nextRoomId, { roomId: currentRoomId, doorId: door.id })
        queue.push(nextRoomId)
      }
    }

    if (!visited.has(destinationRoomIdValue)) return []
    const reversed: string[] = []
    let cursor = destinationRoomIdValue
    while (cursor !== startRoomId) {
      const parent = parents.get(cursor)
      if (parent === undefined) return []
      reversed.push(parent.doorId)
      cursor = parent.roomId
    }
    return reversed.reverse()
  }

  private syncPresentation(): void {
    this.presentation.root.visible = this.state.actor.presence !== 'outside'
    this.presentation.setActiveRoom(this.state.actor.roomId, this.visibilityMode)
    for (const door of this.graph.doors) {
      this.presentation.setDoorFeedback(this.feedbackForDoor(door))
    }
  }
}

export function createThreeInteriorRuntime(
  options: ThreeInteriorRuntimeOptions,
): ThreeInteriorRuntimeAdapter {
  return new ThreeInteriorRuntimeAdapter(options)
}
