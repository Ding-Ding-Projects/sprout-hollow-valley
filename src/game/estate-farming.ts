import {
  clearDebris,
  fellTree,
  fertilize,
  harvest,
  harvestTree,
  sow,
  sowTree,
  till,
  water,
} from './actions'
import { FARM_W } from './constants'
import { cropById } from './crops'
import {
  cloneEstateFarmingState,
  estateFarmHash,
  estateFarmKey,
  isDesignatedEstateOrchardSlot,
  isDesignatedEstatePlot,
} from './estate-farm-state'
import { cutGrass } from './livestock'
import { cloneState } from './state'
import { treeById } from './trees'
import type {
  ActionResult,
  GameState,
  Plant,
  Tile,
  ToolId,
  Valley3DEstateFarmingStateV1,
  Valley3DEstateId,
  Valley3DEstatePlotTileV1,
} from './types'

export {
  cloneEstateFarmingState,
  createDefaultEstateFarmingState,
  ESTATE_FARM_LAYOUTS,
  estateFarmKey,
  estateWorldCoordinate,
  isDesignatedEstateOrchardSlot,
  isDesignatedEstatePlot,
} from './estate-farm-state'

function refusal(state: GameState, message: string): ActionResult {
  return { state, ok: false, message, sound: 'deny', fx: [] }
}

function clonePlant(plant: Plant | null): Plant | null {
  return plant === null ? null : { ...plant }
}

function detachedTile(tile: Valley3DEstatePlotTileV1): Tile {
  return {
    ground: tile.ground,
    watered: tile.watered,
    fertilized: tile.fertilized,
    sprinkler: false,
    plant: clonePlant(tile.plant),
    variant: tile.variant,
    buildingId: null,
    machineId: null,
  }
}

function plotFromTile(source: Valley3DEstatePlotTileV1, tile: Tile): Valley3DEstatePlotTileV1 {
  const ground = tile.ground === 'soil' || tile.ground === 'weeds' || tile.ground === 'rock'
    || tile.ground === 'log' ? tile.ground : 'grass'
  return {
    ...source,
    ground,
    watered: tile.watered,
    fertilized: tile.fertilized,
    plant: clonePlant(tile.plant),
    variant: tile.variant,
  }
}

const BRIDGE_X = 5
const BRIDGE_Y = 5
const BRIDGE_INDEX = BRIDGE_Y * FARM_W + BRIDGE_X

type CanonicalTileAction = (state: GameState, index: number) => ActionResult

function executePlotAction(
  state: GameState,
  key: string,
  action: CanonicalTileAction,
): ActionResult {
  const farming = state.valley3d?.estateFarming
  const target = farming?.plotTiles[key]
  if (farming === undefined || target === undefined || key !== estateFarmKey(target.estateId, target.worldX, target.worldZ)) {
    return refusal(state, 'THIS GROUND IS NOT A DESIGNATED ESTATE FARM PLOT.')
  }
  if (!isDesignatedEstatePlot(target.estateId, target.worldX, target.worldZ)) {
    return refusal(state, 'THIS GROUND IS OUTSIDE THE FARMABLE ESTATE PLOTS.')
  }

  const projected = cloneState(state)
  const mapped = new Map<number, string>()
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const worldX = target.worldX + dx
      const worldZ = target.worldZ + dz
      const neighborKey = estateFarmKey(target.estateId, worldX, worldZ)
      const neighbor = farming.plotTiles[neighborKey]
      if (neighbor === undefined) continue
      const index = (BRIDGE_Y + dz) * FARM_W + BRIDGE_X + dx
      projected.tiles[index] = detachedTile(neighbor)
      mapped.set(index, neighborKey)
    }
  }
  projected.player = { x: BRIDGE_X, y: BRIDGE_Y, facing: state.player.facing }
  projected.seed = estateFarmHash(`${state.seed}:${key}`) & 0x7fffffff
  const outcome = action(projected, BRIDGE_INDEX)
  if (!outcome.ok) return { ...outcome, state }

  const next = outcome.state
  const projectedTiles = outcome.state.tiles
  const inherited = cloneState(state)
  next.seed = state.seed
  next.player = { ...state.player }
  next.tiles = inherited.tiles
  const estateFarming = cloneEstateFarmingState(farming)
  for (const [index, neighborKey] of mapped) {
    const source = estateFarming.plotTiles[neighborKey]
    const tile = projectedTiles[index]
    if (source !== undefined && tile !== undefined) estateFarming.plotTiles[neighborKey] = plotFromTile(source, tile)
  }
  next.valley3d = { ...state.valley3d!, estateFarming }
  return { ...outcome, state: next, fx: [] }
}

export function useEstatePlotTool(state: GameState, key: string, tool: ToolId = state.tool): ActionResult {
  switch (tool) {
    case 'hoe':
      return executePlotAction(state, key, till)
    case 'can':
      return executePlotAction(state, key, water)
    case 'seeds':
      if (state.selectedSeed === null) return refusal(state, 'PICK A SEED OR SAPLING FIRST.')
      if (treeById(state.selectedSeed) !== undefined) {
        return refusal(state, 'PLANT SAPLINGS IN A MARKED ESTATE ORCHARD SLOT.')
      }
      return executePlotAction(state, key, (projected, index) => sow(projected, index, state.selectedSeed!))
    case 'hand':
      return executePlotAction(state, key, harvest)
    case 'axe': {
      const tile = state.valley3d?.estateFarming.plotTiles[key]
      return executePlotAction(state, key, tile?.ground === 'grass' ? cutGrass : clearDebris)
    }
    case 'fertilizer':
      return executePlotAction(state, key, fertilize)
    case 'sprinkler':
      return refusal(state, 'USE WATERING OR WEATHER ON OPEN-WORLD ESTATE PLOTS.')
  }
}

function executeTreeAction(
  state: GameState,
  key: string,
  action: CanonicalTileAction,
  requireExisting: boolean,
): ActionResult {
  const farming = state.valley3d?.estateFarming
  const parsed = /^(.+)@(-?\d+),(-?\d+)$/.exec(key)
  if (farming === undefined || parsed === null) return refusal(state, 'THAT IS NOT AN ESTATE ORCHARD SLOT.')
  const estateId = parsed[1] as Valley3DEstateId
  const worldX = Number(parsed[2])
  const worldZ = Number(parsed[3])
  if (!isDesignatedEstateOrchardSlot(estateId, worldX, worldZ)) {
    return refusal(state, 'TREES MAY ONLY USE MARKED ESTATE ORCHARD SLOTS.')
  }
  const existing = farming.trees[key]
  if (requireExisting && existing === undefined) return refusal(state, 'THERE IS NO TREE IN THIS ORCHARD SLOT.')
  if (!requireExisting && existing !== undefined) return refusal(state, 'A TREE ALREADY GROWS IN THIS ORCHARD SLOT.')

  const projected = cloneState(state)
  projected.tiles[BRIDGE_INDEX] = {
    ground: 'soil',
    watered: false,
    fertilized: false,
    sprinkler: false,
    plant: existing === undefined ? null : { ...existing.plant },
    variant: estateFarmHash(key) & 0xff,
    buildingId: null,
    machineId: null,
  }
  projected.player = { x: BRIDGE_X, y: BRIDGE_Y, facing: state.player.facing }
  projected.seed = estateFarmHash(`${state.seed}:${key}`) & 0x7fffffff
  const outcome = action(projected, BRIDGE_INDEX)
  if (!outcome.ok) return { ...outcome, state }

  const next = outcome.state
  const projectedPlant = outcome.state.tiles[BRIDGE_INDEX]?.plant ?? null
  const inherited = cloneState(state)
  next.seed = state.seed
  next.player = { ...state.player }
  next.tiles = inherited.tiles
  const estateFarming = cloneEstateFarmingState(farming)
  const plant = projectedPlant
  if (plant === null) delete estateFarming.trees[key]
  else estateFarming.trees[key] = { estateId, worldX, worldZ, plant: { ...plant } }
  next.valley3d = { ...state.valley3d!, estateFarming }
  return { ...outcome, state: next, fx: [] }
}

export function plantEstateTree(state: GameState, key: string): ActionResult {
  if (state.selectedSeed === null || treeById(state.selectedSeed) === undefined) {
    return refusal(state, 'SELECT A TREE OR ORCHARD SAPLING FIRST.')
  }
  return executeTreeAction(state, key, (projected, index) => sowTree(projected, index, state.selectedSeed!), false)
}

export function useEstateTreeTool(state: GameState, key: string, tool: ToolId = state.tool): ActionResult {
  switch (tool) {
    case 'seeds':
      return plantEstateTree(state, key)
    case 'hand':
      return executeTreeAction(state, key, harvestTree, true)
    case 'axe':
      return executeTreeAction(state, key, fellTree, true)
    case 'can':
      return refusal(state, 'ESTABLISHED ORCHARD TREES USE THE CANONICAL NO-WATER CARE RULE.')
    case 'fertilizer':
      return refusal(state, 'ORCHARD TREES DO NOT CONSUME FIELD FERTILIZER.')
    default:
      return refusal(state, 'USE SEEDS, HAND, OR AXE AT THIS ORCHARD SLOT.')
  }
}

export function estateFarmingDescription(
  state: Valley3DEstateFarmingStateV1,
  key: string,
): Readonly<{ kind: 'plot' | 'tree' | 'orchard-slot'; label: string; detail: string }> | null {
  const plot = state.plotTiles[key]
  if (plot !== undefined) {
    const plant = plot.plant
    const definition = plant === null ? undefined : cropById(plant.cropId)
    return Object.freeze({
      kind: 'plot',
      label: plant === null ? `${plot.ground} estate plot` : (definition?.name ?? plant.cropId),
      detail: plant === null
        ? `${plot.watered ? 'Watered' : 'Dry'} ${plot.fertilized ? 'fertilized' : 'plain'} ground.`
        : `Growth stage ${plant.stage}; ${plant.dead ? 'withered' : 'living'}.`,
    })
  }
  const tree = state.trees[key]
  if (tree !== undefined) {
    const definition = treeById(tree.plant.cropId)
    return Object.freeze({
      kind: 'tree',
      label: definition?.name ?? tree.plant.cropId,
      detail: `Orchard stage ${tree.plant.stage}; harvest cycle ${tree.plant.progress}.`,
    })
  }
  const parsed = /^(.+)@(-?\d+),(-?\d+)$/.exec(key)
  if (parsed !== null && isDesignatedEstateOrchardSlot(
    parsed[1] as Valley3DEstateId,
    Number(parsed[2]),
    Number(parsed[3]),
  )) {
    return Object.freeze({ kind: 'orchard-slot', label: 'Empty orchard slot', detail: 'Select a sapling to plant here.' })
  }
  return null
}
