import { Group } from 'three'
import type { StaticCollider, Vec3 } from '../../engine3d'
import { DIALOGUE_TOPICS, selectDialogue } from '../../life/dialogue'
import { NPC_DEFINITIONS } from '../../life/npcs'
import type {
  DialogueContext,
  DialogueTopic,
  FriendshipTier,
  LifeEventKind,
  LifeSimulationState,
  NPCDef,
  NPCState,
} from '../../life/types'
import { resolveDeterministicNpcPlacement } from './placement'
import { createProceduralNpcAvatar, type ProceduralNpcAvatar } from './procedural-avatar'
import {
  PERSISTENT_NPC_COUNT,
  type NpcConversationOptions,
  type NpcConversationPrompt,
  type NpcInteractionTarget,
  type NpcPlacementContext,
  type NpcPlacementResolver,
  type NpcPresentationAdapterOptions,
  type NpcPresentationFrame,
  type NpcPresentationFrameResult,
  type NpcPresentationIdentity,
  type NpcPresentationPlacement,
  type NpcPresentationSpace,
} from './types'

const DEFAULT_MATERIALIZE_RADIUS = 42
const DEFAULT_INTERACTION_RADIUS = 2.6

interface MaterializedNpc {
  readonly avatar: ProceduralNpcAvatar
  readonly colliderId: string
}

function finitePositive(value: number | undefined, fallback: number, label: string): number {
  const resolved = value ?? fallback
  if (!Number.isFinite(resolved) || resolved <= 0) {
    throw new RangeError(`${label} must be a finite positive number`)
  }
  return resolved
}

function compareText(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function validateDefinitions(definitions: readonly NPCDef[]): readonly NPCDef[] {
  if (definitions.length !== PERSISTENT_NPC_COUNT) {
    throw new Error(`NPC presentation requires exactly ${PERSISTENT_NPC_COUNT} definitions`)
  }
  const ids = new Set<string>()
  const names = new Set<string>()
  for (const definition of definitions) {
    if (definition.id.trim() === '' || ids.has(definition.id)) {
      throw new Error(`NPC presentation found a blank or duplicate definition ID: ${definition.id}`)
    }
    const name = definition.identity.displayName.trim()
    if (name === '' || names.has(name)) {
      throw new Error(`NPC presentation found a blank or duplicate display name: ${name}`)
    }
    ids.add(definition.id)
    names.add(name)
  }
  return Object.freeze([...definitions].sort((left, right) => compareText(left.id, right.id)))
}

function validateSimulationRoster(
  state: LifeSimulationState,
  definitionById: ReadonlyMap<string, NPCDef>,
): void {
  if (state.npcs.length !== PERSISTENT_NPC_COUNT) {
    throw new Error(`NPC presentation state must contain exactly ${PERSISTENT_NPC_COUNT} NPCs`)
  }
  const stateIds = new Set<string>()
  for (const npc of state.npcs) {
    if (stateIds.has(npc.npcId) || !definitionById.has(npc.npcId)) {
      throw new Error(`NPC presentation state contains an unknown or duplicate NPC: ${npc.npcId}`)
    }
    stateIds.add(npc.npcId)
  }
  if (stateIds.size !== definitionById.size) {
    throw new Error('NPC presentation state does not cover the complete authored roster')
  }
}

function sameSpace(left: NpcPresentationSpace, right: NpcPresentationSpace): boolean {
  if (left.kind !== right.kind) return false
  if (left.kind === 'exterior' && right.kind === 'exterior') {
    return left.worldId === right.worldId
  }
  if (left.kind !== 'interior' || right.kind !== 'interior') return false
  if (left.structureDefinitionId !== right.structureDefinitionId) return false
  if (right.structureInstanceId !== null && left.structureInstanceId !== right.structureInstanceId) {
    return false
  }
  return right.roomId === null || left.roomId === right.roomId
}

function distanceSquared(left: Vec3, right: Vec3): number {
  const x = left.x - right.x
  const y = left.y - right.y
  const z = left.z - right.z
  return x * x + y * y + z * z
}

function snapshotPosition(position: Vec3): Vec3 {
  return Object.freeze({ x: position.x, y: position.y, z: position.z })
}

function friendshipFor(state: LifeSimulationState, npcId: string): FriendshipTier {
  return state.playerRelationships.find((relationship) => relationship.npcId === npcId)?.friendship ?? 'stranger'
}

function eventKindsFor(state: LifeSimulationState, npcId: string): readonly LifeEventKind[] {
  return Object.freeze(
    [...new Set(
      state.activeEvents
        .filter((event) => event.participantIds.includes(npcId))
        .map((event) => event.kind),
    )].sort(compareText),
  )
}

function memoryKeysFor(state: LifeSimulationState, npc: NPCState): readonly string[] {
  const relationshipKeys = state.relationships
    .filter((edge) => edge.a === npc.npcId || edge.b === npc.npcId)
    .flatMap((edge) => edge.memories.map((memory) => memory.key))
  return Object.freeze(
    [...new Set([...npc.memories.map((memory) => memory.key), ...relationshipKeys])].sort(compareText),
  )
}

function preferredTopic(
  state: LifeSimulationState,
  npc: NPCState,
): DialogueTopic {
  const eventKinds = eventKindsFor(state, npc.npcId)
  if (eventKinds.includes('argument')) return 'conflict'
  if (eventKinds.includes('reconciliation')) return 'reconciliation'
  if (eventKinds.includes('community-celebration')) return 'community-event'
  if (friendshipFor(state, npc.npcId) === 'stranger') return 'introduction'
  if (npc.activity === 'work') return 'work'
  if (npc.location.kind === 'home') return 'home'
  if (npc.activity === 'errand') return 'request'
  return 'routine'
}

function colliderFor(
  colliderId: string,
  placement: NpcPresentationPlacement,
  avatar: ProceduralNpcAvatar,
): StaticCollider {
  return {
    id: colliderId,
    bounds: {
      min: {
        x: placement.position.x - avatar.radius,
        y: placement.position.y,
        z: placement.position.z - avatar.radius,
      },
      max: {
        x: placement.position.x + avatar.radius,
        y: placement.position.y + avatar.height,
        z: placement.position.z + avatar.radius,
      },
    },
  }
}

/**
 * Presentation-only bridge for the complete authored life roster. It owns visible Three objects
 * and moving collision proxies, but never mutates or advances the logical simulation.
 */
export class NpcPresentationAdapter {
  readonly root = new Group()
  readonly roster: readonly NpcPresentationIdentity[]

  private readonly definitions: readonly NPCDef[]
  private readonly definitionById: ReadonlyMap<string, NPCDef>
  private readonly placementResolver: NpcPlacementResolver
  private readonly materializeRadiusSquared: number
  private readonly interactionRadiusSquared: number
  private readonly materialized = new Map<string, MaterializedNpc>()
  private readonly placements = new Map<string, NpcPresentationPlacement>()
  private lastState: LifeSimulationState | null = null
  private lastNearbyNpcIds: ReadonlySet<string> = new Set<string>()
  private lastInteractionTargets: readonly NpcInteractionTarget[] = Object.freeze([])
  private disposed = false

  constructor(private readonly options: NpcPresentationAdapterOptions) {
    this.definitions = validateDefinitions(options.definitions ?? NPC_DEFINITIONS)
    this.definitionById = new Map(
      this.definitions.map((definition) => [definition.id, definition] as const),
    )
    this.roster = Object.freeze(
      this.definitions.map((definition) =>
        Object.freeze({
          npcId: definition.id,
          displayName: definition.identity.displayName,
          appearanceSeed: definition.appearanceSeed,
        }),
      ),
    )
    this.placementResolver = options.placementResolver ?? resolveDeterministicNpcPlacement
    const materializeRadius = finitePositive(
      options.materializeRadius,
      DEFAULT_MATERIALIZE_RADIUS,
      'NPC materialize radius',
    )
    const interactionRadius = finitePositive(
      options.interactionRadius,
      DEFAULT_INTERACTION_RADIUS,
      'NPC interaction radius',
    )
    if (interactionRadius > materializeRadius) {
      throw new RangeError('NPC interaction radius must not exceed the materialize radius')
    }
    this.materializeRadiusSquared = materializeRadius * materializeRadius
    this.interactionRadiusSquared = interactionRadius * interactionRadius
    this.root.name = 'persistent-npc-presentation'
    options.parent.add(this.root)
  }

  get materializedCount(): number {
    return this.materialized.size
  }

  update(frame: NpcPresentationFrame): NpcPresentationFrameResult {
    this.assertActive()
    validateSimulationRoster(frame.state, this.definitionById)
    const stateById = new Map(
      frame.state.npcs.map((npc) => [npc.npcId, npc] as const),
    )
    const householdById = new Map(
      frame.state.households.map((household) => [household.id, household] as const),
    )
    const employmentByNpcId = new Map(
      frame.state.employments.map((employment) => [employment.npcId, employment] as const),
    )
    const nextVisibleIds = new Set<string>()
    const nextNearbyIds = new Set<string>()
    const interactionCandidates: Array<{
      readonly definition: NPCDef
      readonly npc: NPCState
      readonly placement: NpcPresentationPlacement
      readonly distanceSquared: number
      readonly materialized: MaterializedNpc
    }> = []
    this.placements.clear()

    for (const definition of this.definitions) {
      const npc = stateById.get(definition.id)
      if (npc === undefined) continue
      const context: NpcPlacementContext = {
        definition,
        npc,
        household: householdById.get(npc.householdId) ?? null,
        employment: employmentByNpcId.get(npc.npcId) ?? null,
        simulation: frame.state,
      }
      const placement = this.placementResolver(context)
      this.placements.set(npc.npcId, placement)
      const separationSquared = distanceSquared(placement.position, frame.viewer.position)
      const visible =
        sameSpace(placement.space, frame.viewer.space) &&
        separationSquared <= this.materializeRadiusSquared
      if (!visible) continue

      nextVisibleIds.add(npc.npcId)
      nextNearbyIds.add(npc.npcId)
      const materialized = this.materialize(definition)
      materialized.avatar.update(placement, npc)
      this.options.collision?.upsertStaticCollider(
        colliderFor(materialized.colliderId, placement, materialized.avatar),
      )
      if (separationSquared <= this.interactionRadiusSquared) {
        interactionCandidates.push({
          definition,
          npc,
          placement,
          distanceSquared: separationSquared,
          materialized,
        })
      }
    }

    for (const npcId of [...this.materialized.keys()]) {
      if (!nextVisibleIds.has(npcId)) this.dematerialize(npcId)
    }

    this.lastState = frame.state
    this.lastNearbyNpcIds = new Set(nextNearbyIds)
    const interactionTargets = interactionCandidates
      .map((candidate): NpcInteractionTarget | null => {
        const topic = preferredTopic(frame.state, candidate.npc)
        const prompt = this.conversationPrompt(
          candidate.npc.npcId,
          topic,
          { context: frame.conversationContext },
        )
        if (prompt === null) return null
        return Object.freeze({
          npcId: candidate.npc.npcId,
          displayName: candidate.definition.identity.displayName,
          object: candidate.materialized.avatar.root,
          colliderId: candidate.materialized.colliderId,
          position: snapshotPosition(candidate.placement.position),
          distance: Math.sqrt(candidate.distanceSquared),
          prompt,
        })
      })
      .filter((target): target is NpcInteractionTarget => target !== null)
      .sort((left, right) => left.distance - right.distance || compareText(left.npcId, right.npcId))
    this.lastInteractionTargets = Object.freeze(interactionTargets)

    return Object.freeze({
      rosterCount: PERSISTENT_NPC_COUNT,
      materializedNpcIds: Object.freeze([...nextVisibleIds].sort(compareText)),
      nearbyNpcIds: new Set(nextNearbyIds),
      interactionTargets: this.lastInteractionTargets,
      culledNpcCount: PERSISTENT_NPC_COUNT - nextVisibleIds.size,
    })
  }

  getInteractionTargets(): readonly NpcInteractionTarget[] {
    return this.lastInteractionTargets
  }

  interactionTargetForCollider(colliderId: string): NpcInteractionTarget | null {
    return this.lastInteractionTargets.find((target) => target.colliderId === colliderId) ?? null
  }

  avatarForNpc(npcId: string): Group | null {
    return this.materialized.get(npcId)?.avatar.root ?? null
  }

  conversationPrompt(
    npcId: string,
    topic: DialogueTopic,
    options: NpcConversationOptions = {},
  ): NpcConversationPrompt | null {
    this.assertActive()
    const state = this.lastState
    const definition = this.definitionById.get(npcId)
    const npc = state?.npcs.find((candidate) => candidate.npcId === npcId)
    const placement = this.placements.get(npcId)
    if (state === null || definition === undefined || npc === undefined || placement === undefined) {
      return null
    }
    const context = this.dialogueContext(state, npc, placement, options.context)
    const line = selectDialogue(npcId, topic, context)
    if (line === null) return null
    return Object.freeze({
      npcId,
      displayName: definition.identity.displayName,
      topic,
      lineId: line.id,
      text: line.text,
      promptLabel: `Talk to ${definition.identity.displayName}`,
      accessibilityLabel: `Talk to ${definition.identity.displayName}: ${line.text}`,
      line,
    })
  }

  conversationPrompts(
    npcId: string,
    options: NpcConversationOptions = {},
  ): readonly NpcConversationPrompt[] {
    return Object.freeze(
      DIALOGUE_TOPICS.map((topic) => this.conversationPrompt(npcId, topic, options)).filter(
        (prompt): prompt is NpcConversationPrompt => prompt !== null,
      ),
    )
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const npcId of [...this.materialized.keys()]) this.dematerialize(npcId)
    this.root.removeFromParent()
    this.placements.clear()
    this.lastState = null
    this.lastNearbyNpcIds = new Set<string>()
    this.lastInteractionTargets = Object.freeze([])
  }

  private materialize(definition: NPCDef): MaterializedNpc {
    const existing = this.materialized.get(definition.id)
    if (existing !== undefined) return existing
    const avatar = createProceduralNpcAvatar(definition)
    const materialized = {
      avatar,
      colliderId: `presentation:${definition.id}:body`,
    }
    avatar.root.userData.colliderId = materialized.colliderId
    this.root.add(avatar.root)
    this.materialized.set(definition.id, materialized)
    return materialized
  }

  private dematerialize(npcId: string): void {
    const materialized = this.materialized.get(npcId)
    if (materialized === undefined) return
    this.options.collision?.removeStaticCollider(materialized.colliderId)
    materialized.avatar.dispose()
    this.materialized.delete(npcId)
  }

  private dialogueContext(
    state: LifeSimulationState,
    npc: NPCState,
    placement: NpcPresentationPlacement,
    override: Partial<DialogueContext> | undefined,
  ): DialogueContext {
    const definition = this.definitionById.get(npc.npcId)
    const authoredHomeRoom =
      npc.location.kind === 'home' && definition !== undefined
        ? `${definition.homeStructureDefinitionId}.common-room`
        : placement.roomId
    return {
      locationId: override?.locationId ?? placement.locationId,
      roomId: override?.roomId === undefined ? authoredHomeRoom : override.roomId,
      activity: override?.activity ?? npc.activity,
      minute: override?.minute ?? state.calendar.minute,
      season: override?.season ?? state.calendar.season,
      weather: override?.weather ?? state.calendar.weather,
      friendship: override?.friendship ?? friendshipFor(state, npc.npcId),
      householdId: override?.householdId ?? npc.householdId,
      employmentStatus: override?.employmentStatus ?? npc.employmentStatus,
      recentEventKinds: override?.recentEventKinds ?? eventKindsFor(state, npc.npcId),
      giftTags: override?.giftTags ?? [],
      questIds: override?.questIds ?? [],
      nearbyNPCIds: override?.nearbyNPCIds ?? [...this.lastNearbyNpcIds].filter((id) => id !== npc.npcId),
      memoryKeys: override?.memoryKeys ?? memoryKeysFor(state, npc),
    }
  }

  private assertActive(): void {
    if (this.disposed) throw new Error('NpcPresentationAdapter is disposed')
  }
}

export function createNpcPresentationAdapter(
  options: NpcPresentationAdapterOptions,
): NpcPresentationAdapter {
  return new NpcPresentationAdapter(options)
}
