import type { BuildingKind, MachineKind, StoreId } from '../../game/farm-types'
import type {
  Interior,
  PanelRequest,
  Station,
  StationKind,
  StationUse,
} from '../../game/interiors'
import type { ActionResult, GameState, ToolId } from '../../game/types'

/** Three-independent point used by the gameplay and overlay ports. */
export interface GameplayWorldPoint {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** Maps the inherited farm grid onto the authored Three.js world. */
export interface FarmWorldTransform {
  readonly origin: GameplayWorldPoint
  readonly tileSize: number
  readonly groundY: number
  readonly maxInteractionDistance: number
}

export interface FarmTileCoordinate {
  readonly x: number
  readonly y: number
  readonly index: number
}

/** Stable references written into Object3D.userData or returned by a raycast adapter. */
export type GameplayTargetRef =
  | { readonly kind: 'tile'; readonly index: number }
  | { readonly kind: 'building'; readonly buildingId: string }
  | { readonly kind: 'machine'; readonly machineId: string }
  | { readonly kind: 'animal'; readonly animalId: string }
  | {
      readonly kind: 'station'
      readonly buildingId: string
      readonly stationKey: string
    }

export interface GameplayTargetHit {
  readonly ref: GameplayTargetRef
  readonly point: GameplayWorldPoint
  /** Ray distance, used only to choose between overlapping rendered targets. */
  readonly distance: number
}

export type GameplayTargetSubject =
  | 'ground'
  | 'crop'
  | 'tree'
  | 'debris'
  | 'sprinkler'
  | 'building'
  | 'machine'
  | 'animal'
  | 'station'

export interface ResolvedGameplayTarget {
  readonly key: string
  readonly ref: GameplayTargetRef
  readonly subject: GameplayTargetSubject
  readonly label: string
  readonly detail: string
  readonly point: GameplayWorldPoint
  readonly tile: FarmTileCoordinate | null
  readonly rayDistance: number
  readonly actorDistance: number
  readonly reachable: boolean
}

export interface GameplayTargetQuery {
  readonly actorPosition: GameplayWorldPoint
  readonly hits?: readonly GameplayTargetHit[]
  /** A terrain hit becomes a tile candidate when no more specific hit wins. */
  readonly groundPoint?: GameplayWorldPoint
}

export type PlacementRequest =
  | { readonly kind: 'building'; readonly buildingKind: BuildingKind }
  | { readonly kind: 'machine'; readonly machineKind: MachineKind }
  | { readonly kind: 'object'; readonly object: 'sprinkler' | 'fertilizer' }

export interface GameplayOverlayOptions {
  readonly inputLabel?: string
  readonly placement?: PlacementRequest
  /** When supplied, a machine target offers this exact recipe for intake. */
  readonly machineRecipeId?: string
}

export type GameplayCommand =
  | { readonly kind: 'select-tool'; readonly tool: ToolId }
  | { readonly kind: 'select-seed'; readonly cropId: string | null }
  | { readonly kind: 'use-tool'; readonly tileIndex: number }
  | { readonly kind: 'till'; readonly tileIndex: number }
  | { readonly kind: 'sow'; readonly tileIndex: number; readonly cropId: string }
  | { readonly kind: 'water'; readonly tileIndex: number }
  | { readonly kind: 'harvest'; readonly tileIndex: number }
  | { readonly kind: 'clear'; readonly tileIndex: number }
  | { readonly kind: 'place-sprinkler'; readonly tileIndex: number }
  | { readonly kind: 'fertilize'; readonly tileIndex: number }
  | { readonly kind: 'feed-animal'; readonly animalId: string }
  | { readonly kind: 'pet-animal'; readonly animalId: string }
  | { readonly kind: 'let-out-animal'; readonly animalId: string }
  | { readonly kind: 'collect-animal'; readonly animalId: string }
  | {
      readonly kind: 'place-building'
      readonly buildingKind: BuildingKind
      readonly tileIndex: number
    }
  | {
      readonly kind: 'place-machine'
      readonly machineKind: MachineKind
      readonly tileIndex: number
    }
  | {
      readonly kind: 'insert-machine'
      readonly machineId: string
      readonly recipeId: string
    }
  | { readonly kind: 'collect-machine'; readonly machineId: string }
  | { readonly kind: 'enter-building'; readonly buildingId: string }
  | {
      readonly kind: 'use-station'
      readonly buildingId: string
      readonly stationKey: string
    }
  | { readonly kind: 'inspect-storage'; readonly store: StoreId }

export interface GameplayInteractionOption {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly enabled: boolean
  readonly command: GameplayCommand
}

export type GameplayHighlight =
  | {
      readonly kind: 'tile'
      readonly state: 'action' | 'valid' | 'blocked' | 'information'
      readonly tile: FarmTileCoordinate
      readonly label: string
    }
  | {
      readonly kind: 'entity'
      readonly state: 'action' | 'valid' | 'blocked' | 'information'
      readonly targetKey: string
      readonly point: GameplayWorldPoint
      readonly label: string
    }
  | {
      readonly kind: 'footprint'
      readonly state: 'valid' | 'blocked'
      readonly tiles: readonly FarmTileCoordinate[]
      readonly label: string
    }

export interface StorageOverlayRow {
  readonly store: StoreId
  readonly label: string
  readonly used: number
  readonly capacity: number
  readonly free: number
  readonly text: string
}

/** DOM-free overlay model consumed by Three meshes and the accessible HTML layer. */
export interface GameplayOverlay {
  readonly targetKey: string | null
  readonly title: string
  readonly prompt: string
  readonly detail: string
  readonly inputLabel: string
  readonly highlights: readonly GameplayHighlight[]
  readonly options: readonly GameplayInteractionOption[]
  readonly storage: readonly StorageOverlayRow[]
  /** Complete text for an aria-live region; visuals never carry the only explanation. */
  readonly announcement: string
}

export type GameplayTransition =
  | {
      readonly kind: 'enter-building'
      readonly buildingId: string
      readonly entry: { readonly x: number; readonly y: number }
    }
  | { readonly kind: 'leave-building'; readonly buildingId: string }

export interface GameplayOutcome extends ActionResult {
  readonly command: GameplayCommand
  readonly targetKey: string | null
  readonly panel: PanelRequest | null
  readonly transition: GameplayTransition | null
  readonly announcement: string
}

/**
 * The adapter owns targeting only. Every mutation is delegated through this port so the
 * inherited deterministic rules remain the sole authority for time, energy, economy and save.
 */
export interface GameplayRuleBindings {
  readonly setTool: (state: GameState, tool: ToolId) => GameState
  readonly selectSeed: (state: GameState, cropId: string | null) => GameState
  readonly till: (state: GameState, index: number) => ActionResult
  readonly sow: (state: GameState, index: number, cropId: string) => ActionResult
  readonly water: (state: GameState, index: number) => ActionResult
  readonly harvest: (state: GameState, index: number) => ActionResult
  readonly clearDebris: (state: GameState, index: number) => ActionResult
  readonly cutGrass: (state: GameState, index: number) => ActionResult
  readonly placeSprinkler: (state: GameState, index: number) => ActionResult
  readonly fertilize: (state: GameState, index: number) => ActionResult
  readonly feedAnimal: (state: GameState, animalId: string) => ActionResult
  readonly petAnimal: (state: GameState, animalId: string) => ActionResult
  readonly letOut: (state: GameState, animalId: string) => ActionResult
  readonly collectProduce: (state: GameState, animalId: string) => ActionResult
  readonly placeBuilding: (
    state: GameState,
    kind: BuildingKind,
    x: number,
    y: number,
  ) => ActionResult
  readonly placeMachine: (state: GameState, kind: MachineKind, index: number) => ActionResult
  readonly insertIntoMachine: (
    state: GameState,
    machineId: string,
    recipeId: string,
  ) => ActionResult
  readonly collectMachine: (state: GameState, machineId: string) => ActionResult
  readonly interiorFor: (state: GameState, buildingId: string) => Interior | null
  readonly useStation: (state: GameState, interior: Interior, station: Station) => StationUse
  /** Canonical tree actions are injected here; the adapter never recreates their rules. */
  readonly sowTree?: (state: GameState, index: number, treeId: string) => ActionResult
  readonly harvestTree?: (state: GameState, index: number) => ActionResult
}

export interface FarmingGameplayAdapterOptions {
  readonly transform?: Partial<FarmWorldTransform>
  readonly rules?: Partial<GameplayRuleBindings>
}

export interface StationIdentity {
  readonly key: string
  readonly kind: StationKind
}
