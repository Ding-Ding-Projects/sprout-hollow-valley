import { buildingDef } from '../../game/buildings'
import { FARM_W } from '../../game/constants'
import { cropById } from '../../game/crops'
import type { Building, Machine, StoreId } from '../../game/farm-types'
import { buildingDoorAt, interiorFor } from '../../game/interiors'
import { canPlace, placementMessage } from '../../game/placement'
import { machineDefFor } from '../../game/production'
import { storeName, storeSpace } from '../../game/storage'
import { treeById } from '../../game/trees'
import type { GameState, ToolId } from '../../game/types'
import { tileCoordinate } from './coordinates'
import { gameplayStationKey } from './targets'
import type {
  GameplayCommand,
  GameplayHighlight,
  GameplayInteractionOption,
  GameplayOverlay,
  GameplayOverlayOptions,
  PlacementRequest,
  ResolvedGameplayTarget,
  StorageOverlayRow,
} from './types'

const TOOL_LABEL: Readonly<Record<ToolId, string>> = Object.freeze({
  hoe: 'Hoe',
  can: 'Watering can',
  seeds: 'Seed bag',
  hand: 'Hand',
  axe: 'Axe',
  sprinkler: 'Sprinkler',
  fertilizer: 'Fertilizer',
})

function option(
  id: string,
  label: string,
  description: string,
  enabled: boolean,
  command: GameplayCommand,
): GameplayInteractionOption {
  return Object.freeze({ id, label, description, enabled, command })
}

function storageRows(state: GameState): readonly StorageOverlayRow[] {
  const stores: readonly StoreId[] = ['silo', 'barn']
  return Object.freeze(
    stores.map((store) => {
      const space = storeSpace(state, store)
      const label = storeName(store)
      const free = Math.max(0, space.cap - space.used)
      return Object.freeze({
        store,
        label,
        used: space.used,
        capacity: space.cap,
        free,
        text: `${label}: ${space.used} of ${space.cap}, ${free} free.`,
      })
    }),
  )
}

function machineAtTarget(state: GameState, target: ResolvedGameplayTarget): Machine | null {
  const ref = target.ref
  if (ref.kind === 'machine') {
    return state.machines.find((entry) => entry.id === ref.machineId) ?? null
  }
  const id = target.tile === null ? null : state.tiles[target.tile.index]?.machineId
  return id === null ? null : (state.machines.find((entry) => entry.id === id) ?? null)
}

function buildingAtTarget(state: GameState, target: ResolvedGameplayTarget): Building | null {
  const ref = target.ref
  if (ref.kind === 'building') {
    return state.buildings.find((entry) => entry.id === ref.buildingId) ?? null
  }
  if (target.tile === null) return null
  const direct = state.tiles[target.tile.index]?.buildingId
  if (direct !== null) return state.buildings.find((entry) => entry.id === direct) ?? null
  return buildingDoorAt(state, target.tile.x, target.tile.y)
}

function toolOption(
  state: GameState,
  target: ResolvedGameplayTarget,
): GameplayInteractionOption | null {
  const tile = target.tile
  if (tile === null) return null
  const enabled = target.reachable
  switch (state.tool) {
    case 'hoe':
      return option('till', 'Till', 'Turn this target tile into soil.', enabled, {
        kind: 'till',
        tileIndex: tile.index,
      })
    case 'can':
      return option('water', 'Water', 'Water this target using the current can upgrade.', enabled, {
        kind: 'water',
        tileIndex: tile.index,
      })
    case 'seeds': {
      const selected = state.selectedSeed
      const plant = selected === null ? undefined : (cropById(selected) ?? treeById(selected))
      return option(
        'sow',
        plant === undefined ? 'Choose a seed' : `Plant ${plant.name}`,
        plant === undefined
          ? 'Select a crop seed or tree sapling first.'
          : treeById(plant.id) === undefined
            ? 'Sow this field crop through the canonical farming rules.'
            : 'Plant this sapling through the canonical tree rules.',
        enabled && selected !== null && plant !== undefined,
        selected === null
          ? { kind: 'select-seed', cropId: null }
          : { kind: 'sow', tileIndex: tile.index, cropId: selected },
      )
    }
    case 'hand':
      return option(
        'harvest',
        target.subject === 'tree' ? 'Pick tree fruit' : 'Harvest or pick up',
        'Collect through the crop, tree, animal, machine, and storage rules.',
        enabled,
        { kind: 'harvest', tileIndex: tile.index },
      )
    case 'axe':
      return option(
        'clear',
        target.subject === 'ground' ? 'Cut grass' : 'Clear',
        'Cut grass for hay or clear debris through the existing farm action.',
        enabled,
        { kind: 'clear', tileIndex: tile.index },
      )
    case 'sprinkler':
      return option('place-sprinkler', 'Place sprinkler', 'Place the held farm object.', enabled, {
        kind: 'place-sprinkler',
        tileIndex: tile.index,
      })
    case 'fertilizer':
      return option('fertilize', 'Fertilize', 'Enrich tilled soil before planting.', enabled, {
        kind: 'fertilize',
        tileIndex: tile.index,
      })
  }
}

function animalOptions(
  state: GameState,
  target: ResolvedGameplayTarget,
): readonly GameplayInteractionOption[] {
  const ref = target.ref
  if (ref.kind !== 'animal') return []
  const animal = state.animals.find((entry) => entry.id === ref.animalId)
  if (animal === undefined) return []
  const enabled = target.reachable
  return Object.freeze([
    option('collect-animal', 'Collect produce', 'Move ready produce into its canonical store.', enabled, {
      kind: 'collect-animal',
      animalId: animal.id,
    }),
    option('feed-animal', 'Feed', 'Feed from hay or grazing according to the livestock rules.', enabled, {
      kind: 'feed-animal',
      animalId: animal.id,
    }),
    option('pet-animal', 'Pet', 'Give this animal its daily care.', enabled, {
      kind: 'pet-animal',
      animalId: animal.id,
    }),
    option('let-out-animal', 'Let outside', 'Send this animal to pasture when conditions allow.', enabled, {
      kind: 'let-out-animal',
      animalId: animal.id,
    }),
  ])
}

function machineOptions(
  state: GameState,
  target: ResolvedGameplayTarget,
  recipeId: string | undefined,
): readonly GameplayInteractionOption[] {
  const machine = machineAtTarget(state, target)
  if (machine === null) return []
  const enabled = target.reachable
  const options: GameplayInteractionOption[] = [
    option('collect-machine', 'Collect output', 'Move finished output into the barn store.', enabled, {
      kind: 'collect-machine',
      machineId: machine.id,
    }),
  ]
  if (recipeId !== undefined && recipeId.trim() !== '') {
    options.push(
      option('insert-machine', 'Start recipe', 'Consume recipe inputs and join the machine queue.', enabled, {
        kind: 'insert-machine',
        machineId: machine.id,
        recipeId,
      }),
    )
  }
  return Object.freeze(options)
}

function buildingOptions(
  state: GameState,
  target: ResolvedGameplayTarget,
): readonly GameplayInteractionOption[] {
  const building = buildingAtTarget(state, target)
  if (building === null) return []
  return Object.freeze([
    option('enter-building', `Enter ${buildingDef(building.kind)?.name ?? building.kind}`, 'Load its real interior at the entry mat.', target.reachable, {
      kind: 'enter-building',
      buildingId: building.id,
    }),
  ])
}

function stationOptions(
  state: GameState,
  target: ResolvedGameplayTarget,
): readonly GameplayInteractionOption[] {
  const ref = target.ref
  if (ref.kind !== 'station') return []
  const interior = interiorFor(state, ref.buildingId)
  const station = interior?.stations.find((entry) => gameplayStationKey(entry) === ref.stationKey)
  if (station === undefined) return []
  return Object.freeze([
    option('use-station', `Use ${station.label}`, 'Use the interior station and any requested panel.', target.reachable, {
      kind: 'use-station',
      buildingId: ref.buildingId,
      stationKey: ref.stationKey,
    }),
  ])
}

function placementOverlay(
  state: GameState,
  target: ResolvedGameplayTarget,
  request: PlacementRequest,
): { highlights: readonly GameplayHighlight[]; option: GameplayInteractionOption; detail: string } | null {
  const tile = target.tile
  if (tile === null) return null
  if (request.kind === 'object') {
    const command: GameplayCommand =
      request.object === 'sprinkler'
        ? { kind: 'place-sprinkler', tileIndex: tile.index }
        : { kind: 'fertilize', tileIndex: tile.index }
    return {
      highlights: Object.freeze([
        { kind: 'tile', state: target.reachable ? 'action' : 'blocked', tile, label: request.object },
      ]),
      option: option(
        `place-${request.object}`,
        `Place ${request.object}`,
        'The canonical object action makes the final inventory and terrain decision.',
        target.reachable,
        command,
      ),
      detail: target.reachable ? 'Ready for the farm rules.' : 'Move closer.',
    }
  }

  const footprint =
    request.kind === 'building'
      ? (buildingDef(request.buildingKind)?.footprint ?? { w: 1, h: 1 })
      : { w: 1, h: 1 }
  const check = canPlace(state, footprint, tile.x, tile.y)
  const highlights: GameplayHighlight[] = []
  for (const verdict of check.tiles) {
    const coordinate = tileCoordinate(verdict.y * FARM_W + verdict.x)
    if (coordinate === null) continue
    highlights.push({
      kind: 'tile',
      state: verdict.ok ? 'valid' : 'blocked',
      tile: coordinate,
      label: verdict.reason ?? 'valid',
    })
  }

  if (request.kind === 'building') {
    const name = buildingDef(request.buildingKind)?.name ?? request.buildingKind
    return {
      highlights: Object.freeze(highlights),
      option: option('place-building', `Build ${name}`, 'Commit this exact footprint.', check.ok, {
        kind: 'place-building',
        buildingKind: request.buildingKind,
        tileIndex: tile.index,
      }),
      detail: placementMessage(check.reason, name.toUpperCase()),
    }
  }

  const name = machineDefFor(request.machineKind)?.name ?? request.machineKind
  return {
    highlights: Object.freeze(highlights),
    option: option('place-machine', `Build ${name}`, 'Commit this exact machine tile.', check.ok, {
      kind: 'place-machine',
      machineKind: request.machineKind,
      tileIndex: tile.index,
    }),
    detail: placementMessage(check.reason, name.toUpperCase()),
  }
}

function targetHighlight(target: ResolvedGameplayTarget): GameplayHighlight {
  if (target.tile !== null) {
    return Object.freeze({
      kind: 'tile',
      state: target.reachable ? 'action' : 'blocked',
      tile: target.tile,
      label: target.label,
    })
  }
  return Object.freeze({
    kind: 'entity',
    state: target.reachable ? 'action' : 'blocked',
    targetKey: target.key,
    point: target.point,
    label: target.label,
  })
}

/** Builds one shared visual/prompt/live-region representation from the current state. */
export function createGameplayOverlay(
  state: GameState,
  target: ResolvedGameplayTarget | null,
  options: GameplayOverlayOptions = {},
): GameplayOverlay {
  const storage = storageRows(state)
  if (target === null) {
    const title = TOOL_LABEL[state.tool]
    const prompt = 'Aim at a farm tile, animal, building, machine, or interior station.'
    return Object.freeze({
      targetKey: null,
      title,
      prompt,
      detail: `Selected tool: ${title}.`,
      inputLabel: options.inputLabel ?? 'Use',
      highlights: Object.freeze([]),
      options: Object.freeze([]),
      storage,
      announcement: `${title} selected. ${prompt} ${storage.map((row) => row.text).join(' ')}`,
    })
  }

  const placement = options.placement === undefined
    ? null
    : placementOverlay(state, target, options.placement)
  let interactions: readonly GameplayInteractionOption[]
  let highlights: readonly GameplayHighlight[]
  let detail = target.detail

  if (placement !== null) {
    interactions = Object.freeze([placement.option])
    highlights = placement.highlights
    detail = placement.detail
  } else if (target.subject === 'animal') {
    interactions = animalOptions(state, target)
    highlights = Object.freeze([targetHighlight(target)])
  } else if (target.subject === 'machine') {
    interactions = machineOptions(state, target, options.machineRecipeId)
    highlights = Object.freeze([targetHighlight(target)])
  } else if (target.subject === 'building') {
    interactions = buildingOptions(state, target)
    highlights = Object.freeze([targetHighlight(target)])
  } else if (target.subject === 'station') {
    interactions = stationOptions(state, target)
    highlights = Object.freeze([targetHighlight(target)])
  } else {
    const tool = toolOption(state, target)
    interactions = tool === null ? Object.freeze([]) : Object.freeze([tool])
    highlights = Object.freeze([targetHighlight(target)])
  }

  const primary = interactions[0]
  const prompt = target.reachable
    ? (primary?.label ?? `Inspect ${target.label}`)
    : `Move closer to ${target.label}`
  const optionText = interactions.length === 0
    ? 'No interaction is available.'
    : interactions.map((entry) => `${entry.label}: ${entry.description}`).join(' ')
  return Object.freeze({
    targetKey: target.key,
    title: target.label,
    prompt,
    detail,
    inputLabel: options.inputLabel ?? 'Use',
    highlights,
    options: interactions,
    storage,
    announcement: `${target.label}. ${detail} ${prompt}. ${optionText} ${storage.map((row) => row.text).join(' ')}`,
  })
}
