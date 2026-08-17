import { createLifeSimulation } from '../life/state'
import { cloneLifeSimulationState, readLifeSimulationState } from '../life/persistence'
import type { LifeSimulationState } from '../life/types'
import {
  cloneEstateFarmingState,
  createDefaultEstateFarmingState,
  estateFarmKey,
  isDesignatedEstateOrchardSlot,
  isDesignatedEstatePlot,
} from './estate-farm-state'
import { cropById } from './crops'
import { treeById } from './trees'
import {
  cloneFactoryProductionState,
  createDefaultFactoryProductionState,
  readFactoryProductionState,
} from './valley-factory-production'
import type {
  Facing,
  GameState,
  Player,
  Valley3DDoorAccessState,
  Valley3DEstateFarmingStateV1,
  Valley3DEstatePlotTileV1,
  Valley3DEstateTreeV1,
  Valley3DExteriorState,
  Valley3DInteriorStateV1,
  Valley3DPose,
  Valley3DSaveV1,
  Valley3DVector,
} from './types'

export const VALLEY3D_SAVE_VERSION = 1 as const

const MAX_ID_LENGTH = 256
const MAX_ACCESS_ROWS = 4_096
const MAX_USE_COUNTS = 4_096
const MAX_COORDINATE = 1_000_000
const MAX_COUNTER = Number.MAX_SAFE_INTEGER
const MAX_ESTATE_PLOTS = 160
const MAX_ESTATE_TREES = 24
const TWO_PI = Math.PI * 2

const SANITATION_STAGES = [
  'needs-toilet',
  'needs-sink',
  'needs-water',
  'needs-soap',
  'needs-rinse',
  'needs-drying',
  'complete',
] as const

const ESTATE_IDS = [
  'estate:meadow',
  'estate:forest',
  'estate:riverland',
  'estate:mountain',
  'estate:coastal',
  'estate:marsh',
  'estate:arid',
  'estate:alpine',
] as const

const ESTATE_GROUNDS = ['grass', 'soil', 'weeds', 'rock', 'log'] as const

export interface Valley3DReadContext {
  readonly seed: number
  readonly year: number
  readonly season: GameState['season']
  readonly day: number
  readonly minutes: number
  readonly player: Player
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function boundedNumber(value: unknown, minimum: number, maximum: number): number | null {
  const number = finite(value)
  return number !== null && number >= minimum && number <= maximum ? number : null
}

function integer(value: unknown, minimum = 0, maximum = MAX_COUNTER): number | null {
  const number = finite(value)
  return number !== null && Number.isSafeInteger(number) && number >= minimum && number <= maximum
    ? number
    : null
}

function id(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH
    ? value
    : null
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function optionalId(value: unknown): string | null | undefined {
  if (value === null) return null
  const parsed = id(value)
  return parsed === null ? undefined : parsed
}

function oneOf<const T extends readonly string[]>(value: unknown, allowed: T): T[number] | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : null
}

export function normalizeValleyYaw(value: number): number {
  if (!Number.isFinite(value)) return 0
  const wrapped = ((value + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI
  return Object.is(wrapped, -0) ? 0 : wrapped
}

export function yawForFarmFacing(facing: Facing): number {
  switch (facing) {
    case 'up':
      return Math.PI
    case 'down':
      return 0
    case 'left':
      return -Math.PI / 2
    case 'right':
      return Math.PI / 2
  }
}

export function gameMinuteIndex(
  state: Pick<GameState, 'year' | 'season' | 'day' | 'minutes'>,
): number {
  const seasonOrdinal = state.season === 'spring'
    ? 0
    : state.season === 'summer'
      ? 1
      : state.season === 'fall'
        ? 2
        : 3
  const absoluteDay = (state.year - 1) * 4 * 28 + seasonOrdinal * 28 + state.day - 1
  return absoluteDay * 24 * 60 + state.minutes
}

export function lifeMinuteIndex(state: LifeSimulationState): number {
  return state.calendar.absoluteDay * 24 * 60 + state.calendar.minute
}

function readVector(value: unknown): Valley3DVector | null {
  if (!isRecord(value)) return null
  const x = boundedNumber(value['x'], -MAX_COORDINATE, MAX_COORDINATE)
  const y = boundedNumber(value['y'], -MAX_COORDINATE, MAX_COORDINATE)
  const z = boundedNumber(value['z'], -MAX_COORDINATE, MAX_COORDINATE)
  return x === null || y === null || z === null ? null : { x, y, z }
}

function cloneVector(value: Valley3DVector): Valley3DVector {
  return { x: value.x, y: value.y, z: value.z }
}

function readPose(value: unknown): Valley3DPose | null {
  if (!isRecord(value)) return null
  const position = readVector(value['position'])
  const facingYaw = finite(value['facingYaw'])
  return position === null || facingYaw === null
    ? null
    : { position, facingYaw: normalizeValleyYaw(facingYaw) }
}

function readExterior(value: unknown): Valley3DExteriorState | null {
  const pose = readPose(value)
  if (pose === null || !isRecord(value)) return null
  const regionId = optionalId(value['regionId'])
  const estateId = optionalId(value['estateId'])
  if (regionId === undefined || estateId === undefined) return null
  return { ...pose, regionId, estateId }
}

function readDoorAccess(value: unknown): Valley3DDoorAccessState[] | null {
  if (!Array.isArray(value) || value.length > MAX_ACCESS_ROWS) return null
  const rows: Valley3DDoorAccessState[] = []
  const doorIds = new Set<string>()
  for (const entry of value) {
    if (!isRecord(entry)) return null
    const doorId = id(entry['doorId'])
    const rawStepIds = entry['stepIds']
    if (doorId === null || doorIds.has(doorId) || !Array.isArray(rawStepIds)) return null
    const stepIds: string[] = []
    const seenSteps = new Set<string>()
    for (const rawStepId of rawStepIds.slice(0, MAX_ACCESS_ROWS)) {
      const stepId = id(rawStepId)
      if (stepId === null || seenSteps.has(stepId)) return null
      seenSteps.add(stepId)
      stepIds.push(stepId)
    }
    if (stepIds.length !== rawStepIds.length) return null
    doorIds.add(doorId)
    rows.push({ doorId, stepIds })
  }
  return rows.sort((left, right) => compareIds(left.doorId, right.doorId))
}

function readActiveUse(value: unknown): Valley3DInteriorStateV1['activeUse'] | undefined {
  if (value === null) return null
  if (!isRecord(value)) return undefined
  const kind = oneOf(value['kind'], ['station', 'fixture'] as const)
  const targetId = id(value['targetId'])
  const roomId = id(value['roomId'])
  const durationTicks = integer(value['durationTicks'], 1)
  const remainingTicks = integer(value['remainingTicks'], 1)
  if (
    kind === null ||
    targetId === null ||
    roomId === null ||
    durationTicks === null ||
    remainingTicks === null ||
    remainingTicks > durationTicks
  ) {
    return undefined
  }
  return { kind, targetId, roomId, durationTicks, remainingTicks }
}

function readUseCounts(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return null
  const keys = Object.keys(value).sort()
  if (keys.length > MAX_USE_COUNTS) return null
  const counts: Record<string, number> = {}
  for (const key of keys) {
    if (id(key) === null) return null
    const count = integer(value[key])
    if (count === null) return null
    if (count > 0) counts[key] = count
  }
  return counts
}

function readInterior(value: unknown): Valley3DInteriorStateV1 | null | undefined {
  if (value === null) return null
  if (!isRecord(value)) return undefined
  const structureContentId = id(value['structureContentId'])
  const graphId = id(value['graphId'])
  const roomId = id(value['roomId'])
  const floor = integer(value['floor'], 0, 255)
  const position = readVector(value['position'])
  const exteriorReturnPose = readPose(value['exteriorReturnPose'])
  const resolvedDoorAccess = readDoorAccess(value['resolvedDoorAccess'])
  const activeUse = readActiveUse(value['activeUse'])
  const sanitationStage = oneOf(value['sanitationStage'], SANITATION_STAGES)
  const hygieneComplete = typeof value['hygieneComplete'] === 'boolean'
    ? value['hygieneComplete']
    : null
  const serial = integer(value['serial'])
  const tick = integer(value['tick'])
  const useCounts = readUseCounts(value['useCounts'])
  const revision = integer(value['revision'])
  if (
    structureContentId === null ||
    graphId === null ||
    roomId === null ||
    floor === null ||
    position === null ||
    exteriorReturnPose === null ||
    resolvedDoorAccess === null ||
    activeUse === undefined ||
    sanitationStage === null ||
    hygieneComplete === null ||
    serial === null ||
    tick === null ||
    useCounts === null ||
    revision === null ||
    (activeUse !== null && activeUse.roomId !== roomId)
  ) {
    return undefined
  }
  return {
    structureContentId,
    graphId,
    roomId,
    floor,
    position,
    exteriorReturnPose,
    resolvedDoorAccess,
    activeUse,
    sanitationStage,
    hygieneComplete,
    serial,
    tick,
    useCounts,
    revision,
  }
}

function readEstatePlant(value: unknown): Valley3DEstatePlotTileV1['plant'] | undefined {
  if (value === null) return null
  if (!isRecord(value)) return undefined
  const cropId = id(value['cropId'])
  const stage = integer(value['stage'], 0, 1_024)
  const progress = integer(value['progress'], 0, 1_000_000)
  const dry = integer(value['dry'], 0, 1_000_000)
  const regrown = integer(value['regrown'], 0, 1_000_000)
  if (
    cropId === null || stage === null || progress === null || dry === null || regrown === null
    || typeof value['dead'] !== 'boolean' || typeof value['fertilized'] !== 'boolean'
  ) {
    return undefined
  }
  return {
    cropId,
    stage,
    progress,
    dry,
    dead: value['dead'],
    fertilized: value['fertilized'],
    regrown,
  }
}

function readEstatePlot(value: unknown): Valley3DEstatePlotTileV1 | null {
  if (!isRecord(value)) return null
  const estateId = oneOf(value['estateId'], ESTATE_IDS)
  const worldX = integer(value['worldX'], -MAX_COORDINATE, MAX_COORDINATE)
  const worldZ = integer(value['worldZ'], -MAX_COORDINATE, MAX_COORDINATE)
  const ground = oneOf(value['ground'], ESTATE_GROUNDS)
  const variant = integer(value['variant'], 0, 255)
  const plant = readEstatePlant(value['plant'])
  if (
    estateId === null || worldX === null || worldZ === null || ground === null || variant === null
    || plant === undefined || typeof value['watered'] !== 'boolean'
    || typeof value['fertilized'] !== 'boolean'
    || !isDesignatedEstatePlot(estateId, worldX, worldZ)
    || (plant !== null && (cropById(plant.cropId) === undefined || treeById(plant.cropId) !== undefined))
  ) {
    return null
  }
  return {
    estateId,
    worldX,
    worldZ,
    ground,
    watered: value['watered'],
    fertilized: value['fertilized'],
    plant,
    variant,
  }
}

function readEstateTree(value: unknown): Valley3DEstateTreeV1 | null {
  if (!isRecord(value)) return null
  const estateId = oneOf(value['estateId'], ESTATE_IDS)
  const worldX = integer(value['worldX'], -MAX_COORDINATE, MAX_COORDINATE)
  const worldZ = integer(value['worldZ'], -MAX_COORDINATE, MAX_COORDINATE)
  const plant = readEstatePlant(value['plant'])
  if (
    estateId === null || worldX === null || worldZ === null || plant === undefined || plant === null
    || !isDesignatedEstateOrchardSlot(estateId, worldX, worldZ)
    || treeById(plant.cropId) === undefined
  ) {
    return null
  }
  return { estateId, worldX, worldZ, plant }
}

function readEstateFarming(
  value: unknown,
  context: Valley3DReadContext,
): Valley3DEstateFarmingStateV1 {
  const absoluteDay = Math.floor(gameMinuteIndex(context) / (24 * 60))
  const fallback = (): Valley3DEstateFarmingStateV1 =>
    createDefaultEstateFarmingState(context.seed, absoluteDay)
  if (!isRecord(value) || !isRecord(value['plotTiles']) || !isRecord(value['trees'])) return fallback()
  const plotKeys = Object.keys(value['plotTiles']).sort()
  const treeKeys = Object.keys(value['trees']).sort()
  if (plotKeys.length !== MAX_ESTATE_PLOTS || treeKeys.length > MAX_ESTATE_TREES) return fallback()
  const plotTiles: Record<string, Valley3DEstatePlotTileV1> = {}
  const trees: Record<string, Valley3DEstateTreeV1> = {}
  for (const key of plotKeys) {
    const plot = readEstatePlot(value['plotTiles'][key])
    if (plot === null || key !== estateFarmKey(plot.estateId, plot.worldX, plot.worldZ)) return fallback()
    plotTiles[key] = plot
  }
  for (const key of treeKeys) {
    const tree = readEstateTree(value['trees'][key])
    if (tree === null || key !== estateFarmKey(tree.estateId, tree.worldX, tree.worldZ)) return fallback()
    trees[key] = tree
  }
  const lastGrowthDay = integer(value['lastGrowthDay'], 0, absoluteDay)
  return lastGrowthDay === null ? fallback() : { plotTiles, trees, lastGrowthDay }
}

export function createDefaultValley3DSave(context: Valley3DReadContext): Valley3DSaveV1 {
  const absoluteDay = Math.floor(gameMinuteIndex(context) / (24 * 60))
  return {
    version: VALLEY3D_SAVE_VERSION,
    exterior: {
      position: { x: context.player.x + 0.5, y: 0, z: context.player.y + 0.5 },
      facingYaw: yawForFarmFacing(context.player.facing),
      regionId: null,
      estateId: null,
    },
    life: createLifeSimulation(context.seed),
    interior: null,
    estateFarming: createDefaultEstateFarmingState(context.seed, absoluteDay),
    factoryProduction: createDefaultFactoryProductionState(gameMinuteIndex(context)),
  }
}

/**
 * Reads the optional composition section without risking the canonical farm state. Missing,
 * malformed, unsupported, future, or temporally impossible data migrates to deterministic
 * defaults; the caller may then safely write the current version on its next save.
 */
export function readValley3DSave(
  value: unknown,
  context: Valley3DReadContext,
): Valley3DSaveV1 {
  const fallback = (): Valley3DSaveV1 => createDefaultValley3DSave(context)
  if (!isRecord(value) || value['version'] !== VALLEY3D_SAVE_VERSION) return fallback()
  const exterior = readExterior(value['exterior'])
  const life = readLifeSimulationState(value['life'], context.seed)
  const interior = readInterior(value['interior'])
  if (exterior === null || life === null || interior === undefined) return fallback()
  if (lifeMinuteIndex(life) > gameMinuteIndex(context)) return fallback()
  return {
    version: VALLEY3D_SAVE_VERSION,
    exterior,
    life,
    interior,
    estateFarming: readEstateFarming(value['estateFarming'], context),
    factoryProduction: readFactoryProductionState(
      value['factoryProduction'],
      gameMinuteIndex(context),
    ),
  }
}

export function cloneValley3DSave(state: Valley3DSaveV1): Valley3DSaveV1 {
  return {
    version: VALLEY3D_SAVE_VERSION,
    exterior: {
      position: cloneVector(state.exterior.position),
      facingYaw: state.exterior.facingYaw,
      regionId: state.exterior.regionId,
      estateId: state.exterior.estateId,
    },
    life: cloneLifeSimulationState(state.life),
    estateFarming: cloneEstateFarmingState(state.estateFarming),
    factoryProduction: cloneFactoryProductionState(state.factoryProduction),
    interior: state.interior === null
      ? null
      : {
          ...state.interior,
          position: cloneVector(state.interior.position),
          exteriorReturnPose: {
            position: cloneVector(state.interior.exteriorReturnPose.position),
            facingYaw: state.interior.exteriorReturnPose.facingYaw,
          },
          resolvedDoorAccess: state.interior.resolvedDoorAccess.map((entry) => ({
            doorId: entry.doorId,
            stepIds: [...entry.stepIds],
          })),
          activeUse: state.interior.activeUse === null ? null : { ...state.interior.activeUse },
          useCounts: { ...state.interior.useCounts },
        },
  }
}
