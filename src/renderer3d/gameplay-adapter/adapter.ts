import {
  clearDebris,
  fertilize,
  harvest,
  placeSprinkler,
  selectSeed,
  setTool,
  sow,
  till,
  water,
} from '../../game/actions'
import { FARM_W } from '../../game/constants'
import { cropById } from '../../game/crops'
import type { StoreId } from '../../game/farm-types'
import { entryPoint, interiorFor, useStation } from '../../game/interiors'
import { collectProduce, cutGrass, feedAnimal, letOut, petAnimal } from '../../game/livestock'
import { placeBuilding } from '../../game/placement'
import {
  collectMachine,
  insertIntoMachine,
  placeMachine,
} from '../../game/production'
import { storeName, storeSpace } from '../../game/storage'
import { treeById } from '../../game/trees'
import type { ActionResult, GameState, ToolId } from '../../game/types'
import { createFarmWorldTransform } from './coordinates'
import { createGameplayOverlay } from './overlay'
import {
  gameplayStationKey,
  resolveGameplayTarget,
} from './targets'
import type {
  FarmingGameplayAdapterOptions,
  FarmWorldTransform,
  GameplayCommand,
  GameplayOutcome,
  GameplayOverlay,
  GameplayOverlayOptions,
  GameplayRuleBindings,
  GameplayTargetQuery,
  ResolvedGameplayTarget,
} from './types'

export const GAMEPLAY_TOOL_ORDER: readonly ToolId[] = Object.freeze([
  'hoe',
  'can',
  'seeds',
  'hand',
  'axe',
  'sprinkler',
  'fertilizer',
])

export const DEFAULT_GAMEPLAY_RULES: Readonly<GameplayRuleBindings> = Object.freeze({
  setTool,
  selectSeed,
  till,
  sow,
  water,
  harvest,
  clearDebris,
  cutGrass,
  placeSprinkler,
  fertilize,
  feedAnimal,
  petAnimal,
  letOut,
  collectProduce,
  placeBuilding,
  placeMachine,
  insertIntoMachine,
  collectMachine,
  interiorFor,
  useStation,
})

export function toolSelectionCommands(): readonly GameplayCommand[] {
  return Object.freeze(GAMEPLAY_TOOL_ORDER.map((tool) => Object.freeze({ kind: 'select-tool' as const, tool })))
}

function refusal(state: GameState, message: string): ActionResult {
  return { state, ok: false, message, sound: 'deny', fx: [] }
}

function acknowledgement(state: GameState, message: string): ActionResult {
  return { state, ok: true, message, sound: 'select', fx: [] }
}

function outcomeAnnouncement(result: ActionResult, suffix: string): string {
  const prefix = result.ok ? '' : 'Action unavailable. '
  return `${prefix}${result.message}${suffix}`.trim()
}

function outcome(
  command: GameplayCommand,
  target: ResolvedGameplayTarget | null,
  result: ActionResult,
  panel: GameplayOutcome['panel'] = null,
  transition: GameplayOutcome['transition'] = null,
): GameplayOutcome {
  const panelText = panel === null ? '' : ` Open ${panel.open}.`
  const transitionText = transition === null
    ? ''
    : transition.kind === 'enter-building'
      ? ' Entering building.'
      : ' Leaving building.'
  return Object.freeze({
    ...result,
    command,
    targetKey: target?.key ?? null,
    panel,
    transition,
    announcement: outcomeAnnouncement(result, `${panelText}${transitionText}`),
  })
}

function isTileCommand(command: GameplayCommand): command is Extract<GameplayCommand, { tileIndex: number }> {
  return 'tileIndex' in command
}

function machineIdAt(state: GameState, target: ResolvedGameplayTarget): string | null {
  if (target.ref.kind === 'machine') return target.ref.machineId
  return target.tile === null ? null : (state.tiles[target.tile.index]?.machineId ?? null)
}

function buildingIdAt(state: GameState, target: ResolvedGameplayTarget): string | null {
  if (target.ref.kind === 'building') return target.ref.buildingId
  return target.tile === null ? null : (state.tiles[target.tile.index]?.buildingId ?? null)
}

function targetMatches(
  state: GameState,
  command: GameplayCommand,
  target: ResolvedGameplayTarget,
): boolean {
  if (isTileCommand(command)) return target.tile?.index === command.tileIndex
  switch (command.kind) {
    case 'feed-animal':
    case 'pet-animal':
    case 'let-out-animal':
    case 'collect-animal':
      return target.ref.kind === 'animal' && target.ref.animalId === command.animalId
    case 'insert-machine':
    case 'collect-machine':
      return machineIdAt(state, target) === command.machineId
    case 'enter-building':
      return buildingIdAt(state, target) === command.buildingId
    case 'use-station':
      return target.ref.kind === 'station'
        && target.ref.buildingId === command.buildingId
        && target.ref.stationKey === command.stationKey
    case 'select-tool':
    case 'select-seed':
    case 'inspect-storage':
      return true
  }
}

function needsReach(command: GameplayCommand): boolean {
  switch (command.kind) {
    case 'select-tool':
    case 'select-seed':
    case 'inspect-storage':
    case 'place-building':
    case 'place-machine':
      return false
    default:
      return true
  }
}

function requiredTool(command: GameplayCommand): ToolId | null {
  switch (command.kind) {
    case 'till':
      return 'hoe'
    case 'water':
      return 'can'
    case 'sow':
      return 'seeds'
    case 'harvest':
      return 'hand'
    case 'clear':
      return 'axe'
    case 'place-sprinkler':
      return 'sprinkler'
    case 'fertilize':
      return 'fertilizer'
    default:
      return null
  }
}

function treeBindingRefusal(state: GameState, verb: 'plant' | 'harvest'): ActionResult {
  const action = verb === 'plant' ? 'PLANT THIS SAPLING' : 'PICK THIS TREE'
  return refusal(
    state,
    `CANNOT ${action}: THE CANONICAL TREE ACTION IS NOT CONNECTED. NO TIME, ENERGY, ITEM OR TREE CHANGED.`,
  )
}

function sowAt(
  rules: GameplayRuleBindings,
  state: GameState,
  index: number,
  cropId: string,
): ActionResult {
  if (treeById(cropId) !== undefined) {
    return rules.sowTree?.(state, index, cropId) ?? treeBindingRefusal(state, 'plant')
  }
  return rules.sow(state, index, cropId)
}

function harvestAt(
  rules: GameplayRuleBindings,
  state: GameState,
  index: number,
): ActionResult {
  const plant = state.tiles[index]?.plant
  if (plant !== null && plant !== undefined && treeById(plant.cropId) !== undefined) {
    return rules.harvestTree?.(state, index) ?? treeBindingRefusal(state, 'harvest')
  }
  return rules.harvest(state, index)
}

function useToolAt(
  rules: GameplayRuleBindings,
  state: GameState,
  index: number,
): ActionResult {
  switch (state.tool) {
    case 'hoe':
      return rules.till(state, index)
    case 'can':
      return rules.water(state, index)
    case 'seeds':
      return state.selectedSeed === null
        ? refusal(state, 'PICK A SEED OR SAPLING FIRST.')
        : sowAt(rules, state, index, state.selectedSeed)
    case 'hand':
      return harvestAt(rules, state, index)
    case 'axe':
      return state.tiles[index]?.ground === 'grass'
        ? rules.cutGrass(state, index)
        : rules.clearDebris(state, index)
    case 'sprinkler':
      return rules.placeSprinkler(state, index)
    case 'fertilizer':
      return rules.fertilize(state, index)
  }
}

function selectToolOutcome(
  rules: GameplayRuleBindings,
  state: GameState,
  command: Extract<GameplayCommand, { kind: 'select-tool' }>,
): ActionResult {
  const next = rules.setTool(state, command.tool)
  return acknowledgement(next, `${command.tool.toUpperCase()} SELECTED.`)
}

function selectSeedOutcome(
  rules: GameplayRuleBindings,
  state: GameState,
  command: Extract<GameplayCommand, { kind: 'select-seed' }>,
): ActionResult {
  if (command.cropId !== null && cropById(command.cropId) === undefined && treeById(command.cropId) === undefined) {
    return refusal(state, 'THERE IS NO SUCH SEED OR SAPLING.')
  }
  const next = rules.selectSeed(state, command.cropId)
  if (command.cropId === null) return acknowledgement(next, 'SEED BAG CLEARED.')
  const plant = cropById(command.cropId) ?? treeById(command.cropId)
  return acknowledgement(next, `SEED BAG LOADED WITH ${plant?.name ?? command.cropId}.`)
}

function storageOutcome(state: GameState, store: StoreId): ActionResult {
  const space = storeSpace(state, store)
  const free = Math.max(0, space.cap - space.used)
  return acknowledgement(
    state,
    `${storeName(store)}: ${space.used} OF ${space.cap}, ${free} FREE.`,
  )
}

/** Executes one immutable command and returns a state/result/overlay handoff in one shape. */
export function executeGameplayCommand(
  state: GameState,
  command: GameplayCommand,
  rules: GameplayRuleBindings = DEFAULT_GAMEPLAY_RULES,
  target: ResolvedGameplayTarget | null = null,
): GameplayOutcome {
  if (target !== null && !targetMatches(state, command, target)) {
    return outcome(command, target, refusal(state, 'THE TARGET CHANGED. AIM AGAIN.'))
  }
  if (target !== null && needsReach(command) && !target.reachable) {
    return outcome(command, target, refusal(state, `MOVE CLOSER TO ${target.label.toUpperCase()}.`))
  }
  const tool = requiredTool(command)
  if (tool !== null && state.tool !== tool) {
    return outcome(command, target, refusal(state, `SELECT THE ${tool.toUpperCase()} FIRST.`))
  }

  switch (command.kind) {
    case 'select-tool':
      return outcome(command, target, selectToolOutcome(rules, state, command))
    case 'select-seed':
      return outcome(command, target, selectSeedOutcome(rules, state, command))
    case 'use-tool':
      return outcome(command, target, useToolAt(rules, state, command.tileIndex))
    case 'till':
      return outcome(command, target, rules.till(state, command.tileIndex))
    case 'sow':
      return outcome(command, target, sowAt(rules, state, command.tileIndex, command.cropId))
    case 'water':
      return outcome(command, target, rules.water(state, command.tileIndex))
    case 'harvest':
      return outcome(command, target, harvestAt(rules, state, command.tileIndex))
    case 'clear':
      return outcome(
        command,
        target,
        state.tiles[command.tileIndex]?.ground === 'grass'
          ? rules.cutGrass(state, command.tileIndex)
          : rules.clearDebris(state, command.tileIndex),
      )
    case 'place-sprinkler':
      return outcome(command, target, rules.placeSprinkler(state, command.tileIndex))
    case 'fertilize':
      return outcome(command, target, rules.fertilize(state, command.tileIndex))
    case 'feed-animal':
      return outcome(command, target, rules.feedAnimal(state, command.animalId))
    case 'pet-animal':
      return outcome(command, target, rules.petAnimal(state, command.animalId))
    case 'let-out-animal':
      return outcome(command, target, rules.letOut(state, command.animalId))
    case 'collect-animal':
      return outcome(command, target, rules.collectProduce(state, command.animalId))
    case 'place-building': {
      const x = command.tileIndex % FARM_W
      const y = Math.floor(command.tileIndex / FARM_W)
      return outcome(command, target, rules.placeBuilding(state, command.buildingKind, x, y))
    }
    case 'place-machine':
      return outcome(command, target, rules.placeMachine(state, command.machineKind, command.tileIndex))
    case 'insert-machine':
      return outcome(
        command,
        target,
        rules.insertIntoMachine(state, command.machineId, command.recipeId),
      )
    case 'collect-machine':
      return outcome(command, target, rules.collectMachine(state, command.machineId))
    case 'enter-building': {
      const interior = rules.interiorFor(state, command.buildingId)
      if (interior === null) {
        return outcome(command, target, refusal(state, 'THAT BUILDING HAS NO AVAILABLE INTERIOR.'))
      }
      return outcome(
        command,
        target,
        acknowledgement(state, `ENTERING ${interior.name.toUpperCase()}.`),
        null,
        { kind: 'enter-building', buildingId: command.buildingId, entry: entryPoint(interior) },
      )
    }
    case 'use-station': {
      const interior = rules.interiorFor(state, command.buildingId)
      const station = interior?.stations.find((entry) => gameplayStationKey(entry) === command.stationKey)
      if (interior === null || interior === undefined || station === undefined) {
        return outcome(command, target, refusal(state, 'THAT STATION IS NO LONGER HERE.'))
      }
      const used = rules.useStation(state, interior, station)
      const transition = used.panel?.open === 'leave'
        ? { kind: 'leave-building' as const, buildingId: command.buildingId }
        : null
      return outcome(command, target, used.result, used.panel, transition)
    }
    case 'inspect-storage':
      return outcome(command, target, storageOutcome(state, command.store))
  }
}

/** Stateless composition root for the live Three Farm surface. */
export class FarmingGameplayAdapter {
  readonly transform: Readonly<FarmWorldTransform>
  readonly rules: GameplayRuleBindings

  constructor(options: FarmingGameplayAdapterOptions = {}) {
    this.transform = createFarmWorldTransform(options.transform)
    this.rules = { ...DEFAULT_GAMEPLAY_RULES, ...options.rules }
  }

  resolveTarget(state: GameState, query: GameplayTargetQuery): ResolvedGameplayTarget | null {
    return resolveGameplayTarget(state, query, this.transform)
  }

  overlay(
    state: GameState,
    target: ResolvedGameplayTarget | null,
    options: GameplayOverlayOptions = {},
  ): GameplayOverlay {
    return createGameplayOverlay(state, target, options)
  }

  execute(
    state: GameState,
    command: GameplayCommand,
    target: ResolvedGameplayTarget | null = null,
  ): GameplayOutcome {
    return executeGameplayCommand(state, command, this.rules, target)
  }
}

export function createFarmingGameplayAdapter(
  options: FarmingGameplayAdapterOptions = {},
): FarmingGameplayAdapter {
  return new FarmingGameplayAdapter(options)
}
