import type { Object3D } from 'three'
import type { StaticCollider, Vec3 } from '../../engine3d'
import type {
  DialogueContext,
  DialogueLine,
  DialogueTopic,
  EmploymentState,
  HouseholdState,
  LifeSimulationState,
  NPCDef,
  NPCState,
} from '../../life/types'

export const PERSISTENT_NPC_COUNT = 240 as const

export interface NpcExteriorSpace {
  readonly kind: 'exterior'
  readonly worldId: string
}

export interface NpcInteriorSpace {
  readonly kind: 'interior'
  readonly structureDefinitionId: string
  readonly structureInstanceId: string | null
  /** A null room keeps the whole currently streamed interior presentation-visible. */
  readonly roomId: string | null
}

export type NpcPresentationSpace = NpcExteriorSpace | NpcInteriorSpace

export interface NpcPresentationViewer {
  readonly position: Vec3
  readonly space: NpcPresentationSpace
}

export interface NpcPresentationPlacement {
  readonly space: NpcPresentationSpace
  /** Dialogue-facing location ID, normalized independently from the presentation space. */
  readonly locationId: string
  readonly roomId: string | null
  readonly position: Vec3
  readonly yawRadians: number
  readonly moving: boolean
}

export interface NpcPlacementContext {
  readonly definition: NPCDef
  readonly npc: NPCState
  readonly household: HouseholdState | null
  readonly employment: EmploymentState | null
  readonly simulation: LifeSimulationState
}

export type NpcPlacementResolver = (
  context: NpcPlacementContext,
) => NpcPresentationPlacement

export interface NpcCollisionRegistry {
  upsertStaticCollider(collider: StaticCollider): StaticCollider
  removeStaticCollider(id: string): boolean
}

export interface NpcConversationPrompt {
  readonly npcId: string
  readonly displayName: string
  readonly topic: DialogueTopic
  readonly lineId: string
  readonly text: string
  readonly promptLabel: string
  readonly accessibilityLabel: string
  readonly line: DialogueLine
}

export interface NpcInteractionTarget {
  readonly npcId: string
  readonly displayName: string
  readonly object: Object3D
  readonly colliderId: string
  readonly position: Vec3
  readonly distance: number
  readonly prompt: NpcConversationPrompt
}

export interface NpcConversationOptions {
  /** Explicit values override context derived from the life state and presentation placement. */
  readonly context?: Partial<DialogueContext>
}

export interface NpcPresentationFrame {
  readonly state: LifeSimulationState
  readonly viewer: NpcPresentationViewer
  /** Optional player/context values used by the default prompt on interaction targets. */
  readonly conversationContext?: Partial<DialogueContext>
}

export interface NpcPresentationFrameResult {
  readonly rosterCount: typeof PERSISTENT_NPC_COUNT
  readonly materializedNpcIds: readonly string[]
  /** Feed this set into the next logical life-simulation advancement; the adapter never mutates it. */
  readonly nearbyNpcIds: ReadonlySet<string>
  readonly interactionTargets: readonly NpcInteractionTarget[]
  readonly culledNpcCount: number
}

export interface NpcPresentationIdentity {
  readonly npcId: string
  readonly displayName: string
  readonly appearanceSeed: number
}

export interface NpcPresentationAdapterOptions {
  /** Scene or task-owned group that receives the adapter's single presentation root. */
  readonly parent: Object3D
  readonly collision?: NpcCollisionRegistry
  readonly placementResolver?: NpcPlacementResolver
  readonly definitions?: readonly NPCDef[]
  readonly materializeRadius?: number
  readonly interactionRadius?: number
}
