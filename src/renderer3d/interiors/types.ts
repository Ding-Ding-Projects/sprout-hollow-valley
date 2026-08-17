import type {
  DoorAccessResolution,
  InteriorActorState,
  InteriorRuntimeError,
} from '../../interiors/runtime'
import type {
  DoorDef,
  FixtureDef,
  InteriorGraph,
  RoomDef,
  StationDef,
  VerticalTraversalKind,
} from '../../interiors/models'
import type { Aabb3, StaticCollider, Vec3 } from '../../engine3d/collision'
import type { Group, Mesh, Object3D } from 'three'

export type InteriorDoorVisualState = 'available' | 'locked' | 'resolved' | 'denied'
export type InteriorVisibilityMode = 'all' | 'floor' | 'room'

export interface InteriorDoorFeedback {
  readonly doorId: string
  readonly state: InteriorDoorVisualState
  readonly message: string
  readonly reason: string | null
  readonly destinationRoomId: string
  readonly destinationFloor: number | null
  readonly accessStepIds: readonly string[]
}

export interface InteriorRoomPresentation {
  readonly definition: RoomDef
  readonly object: Group
  readonly bounds: Aabb3
  readonly spawnPosition: Vec3
}

export interface InteriorDoorEndpointPresentation {
  readonly id: string
  readonly doorId: string
  readonly roomId: string
  readonly destinationRoomId: string
  readonly destinationFloor: number | null
  readonly object: Group
  readonly panel: Mesh
  readonly interactionPosition: Vec3
  readonly arrivalPosition: Vec3
}

export interface InteriorVerticalConnectorPresentation {
  readonly id: string
  readonly doorId: string
  readonly kind: VerticalTraversalKind
  readonly fromRoomId: string
  readonly toRoomId: string
  readonly fromFloor: number
  readonly toFloor: number
  readonly object: Group
  readonly interactionPosition: Vec3
}

export interface InteriorDoorPresentation {
  readonly definition: DoorDef
  readonly endpoints: readonly InteriorDoorEndpointPresentation[]
  readonly connectors: readonly InteriorVerticalConnectorPresentation[]
}

export interface InteriorStationPresentation {
  readonly definition: StationDef
  readonly object: Group
  readonly interactionPosition: Vec3
}

export interface InteriorFixturePresentation {
  readonly definition: FixtureDef
  readonly object: Group
  readonly interactionPosition: Vec3
}

export interface ThreeInteriorPresentation {
  readonly graph: InteriorGraph
  readonly root: Group
  readonly rooms: ReadonlyMap<string, InteriorRoomPresentation>
  readonly doors: ReadonlyMap<string, InteriorDoorPresentation>
  readonly stations: ReadonlyMap<string, InteriorStationPresentation>
  readonly fixtures: ReadonlyMap<string, InteriorFixturePresentation>
  readonly connectors: ReadonlyMap<string, InteriorVerticalConnectorPresentation>
  readonly colliders: readonly StaticCollider[]
  readonly exteriorReturnPosition: Vec3
  setActiveRoom(roomId: string | null, mode?: InteriorVisibilityMode): void
  setDoorFeedback(feedback: InteriorDoorFeedback): void
  dispose(): void
}

export interface ThreeInteriorBuildOptions {
  readonly roomWidth?: number
  readonly roomDepth?: number
  readonly wallHeight?: number
  readonly floorHeight?: number
  readonly roomGap?: number
  readonly exteriorReturnPosition?: Vec3
}

export interface ThreeInteriorRuntimeSnapshot {
  readonly actor: InteriorActorState
  readonly position: Vec3 | null
  readonly doorAccess: Readonly<Record<string, DoorAccessResolution>>
  readonly revision: number
}

export interface ThreeInteriorActionResult {
  readonly ok: boolean
  readonly snapshot: ThreeInteriorRuntimeSnapshot
  readonly error: InteriorRuntimeError | null
  readonly feedback: string
  readonly teleportPosition: Vec3 | null
  readonly interactionPosition: Vec3 | null
}

export interface InteriorSanitationPlan {
  readonly restroomRoomId: string
  readonly routeDoorIds: readonly string[]
  readonly restroomStationId: string
  readonly handwashingStationId: string
  readonly fixtureIds: readonly string[]
}

export interface ThreeInteriorRuntimeOptions {
  readonly graph: InteriorGraph
  readonly actorId: string
  readonly actorKind: InteriorActorState['actorKind']
  readonly npcRole?: string | null
  readonly presentation?: ThreeInteriorPresentation
  readonly build?: ThreeInteriorBuildOptions
  readonly snapshot?: ThreeInteriorRuntimeSnapshot
  readonly visibilityMode?: InteriorVisibilityMode
}

export interface ThreeInteriorMountTarget {
  readonly scene: Object3D
  readonly addCollider?: (collider: StaticCollider) => void
  readonly removeCollider?: (id: string) => void
}
