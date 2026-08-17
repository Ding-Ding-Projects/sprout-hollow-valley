/**
 * The Farm tab: the shell's host for the third-person Three.js world.
 *
 * It owns three things and nothing else.
 *
 *  1. **The stage.** A container the renderer mounts its WebGL canvas into, carrying
 *     `data-sh-farm` so `settings.ts` lets the farm keys through to it and stops them
 *     everywhere else. The canvas is a responsive, third-person 3D surface backed by
 *     the bundled fallback valley and the shared engine3d input/camera/collision layers.
 *  2. **The clock.** `setVisible()` pauses the frame loop when the Farm tab is not the
 *     visible one and starts it again when it is, so a background tab costs nothing.
 *     The Game setting `pauseWhenHidden` can turn that off; the setting is read live.
 *  3. **The voice.** Every inherited line the rules layer speaks can still be routed
 *     came from and re-rendered through `t()`, so the farm speaks the selected
 *     language at the selected funny level, and every action is recorded to history as
 *     that key plus its facts — never as a frozen sentence.
 *
 * The inherited message router remains below for deterministic farming adapters. The old game
 * drew its toasts with the 5x7
 * bitmap face in `src/engine/font.ts`, which carries ASCII and nothing else. A
 * Cantonese line has no glyphs there and would render as a row of hollow boxes, so a
 * translation the face cannot draw leaves the canvas showing the game's own line — the
 * same facts, the same numbers — while the caption strip below the farm carries the
 * full translation in the selected language. Nothing is dropped and nothing is faked.
 *
 * The live 3D surface also exposes readable boot and failure states. Colour comes from
 * `tokens.css` through `base.css`; the only inline styles here are layout ones.
 */

import { CROPS } from '../../game/crops'
import {
  createDefaultEstateFarmingState,
  estateFarmingDescription,
  useEstatePlotTool,
  useEstateTreeTool,
} from '../../game/estate-farming'
import { createState } from '../../game/state'
import { formatClock } from '../../game/time'
import {
  advanceFactoryProduction,
  compatibleRecipesForFactory,
  createDefaultFactoryProductionState,
  factoryProductionStatus,
  performFactoryStationAction,
} from '../../game/valley-factory-production'
import type {
  Facing,
  GameState,
  Quality,
  Season,
  ToolId,
  Valley3DExteriorState,
  Valley3DInteriorStateV1,
  Valley3DSaveV1,
  Valley3DVector,
} from '../../game/types'
import {
  gameMinuteIndex,
  lifeMinuteIndex,
  normalizeValleyYaw,
  VALLEY3D_SAVE_VERSION,
  yawForFarmFacing,
} from '../../game/valley3d-save'
import { VALLEY_BUILDINGS, VALLEY_FACTORIES } from '../../content/valley-structures'
import type { StaticCollider, Vec3 } from '../../engine3d'
import {
  requireInteriorById,
  type DoorAccessResolution,
  type InteriorActorState,
  type InteriorGraph,
  type StationKind,
} from '../../interiors'
import { structureDefinitionId } from '../../life/catalog'
import { NPC_DEFINITIONS } from '../../life/npcs'
import { cloneLifeSimulationState, readLifeSimulationState } from '../../life/persistence'
import { advanceLifeSimulation } from '../../life/simulation'
import { createLifeSimulation } from '../../life/state'
import type { LifeSimulationState } from '../../life/types'
import { loadSave, saveGame } from '../../renderer/bridge'
import { mountThreeFarmSurface } from '../../renderer3d/farm-surface'
import type { ThreeFarmSurfaceStatus } from '../../renderer3d/farm-surface'
import {
  createFarmingGameplayAdapter,
  type FarmingGameplayAdapter,
  type GameplayCommand,
  type GameplayOverlay,
  type ResolvedGameplayTarget,
  worldToFarmTile,
} from '../../renderer3d/gameplay-adapter'
import {
  createNpcPresentationAdapter,
  resolveDeterministicNpcPlacement,
  type NpcInteractionTarget,
  type NpcPresentationAdapter,
  type NpcPresentationFrameResult,
  type NpcPresentationPlacement,
} from '../../renderer3d/npcs'
import {
  createThreeInteriorRuntime,
  type ThreeInteriorActionResult,
  type ThreeInteriorRuntimeAdapter,
  type ThreeInteriorRuntimeSnapshot,
} from '../../renderer3d/interiors'
import type { ThreeRuntime, ThreeRuntimeTick } from '../../renderer3d/runtime'
import {
  AUTHORED_ESTATE_ZONES,
  AUTHORED_VALLEY_CELL_SIZE,
  AUTHORED_VALLEY_REGIONS,
  authoredValleyLocationAt,
} from '../../renderer3d/world'
import {
  Object3D,
  Raycaster,
  Vector2,
  Vector3,
  type Intersection,
} from 'three'
import { cropNameKey, onLangChange, qualityKey, seasonKey, t } from '../core/i18n'
import type { StringKey } from '../core/i18n'
import { record } from '../core/history'
import { get, subscribe } from '../core/store'
import { attachEditor } from './appearance'

/** The tab id and the tab `kind` the shell opens this panel for. */
export const FARM_TAB_ID = 'farm'

/** The appearance-map element id for the farm region. */
export const FARM_ELEMENT_ID = 'shell.farm'

/** The keys the game quotes when it asks for a seed. A fact, never prose. */
const SEED_CYCLE_KEYS = 'Q / E'

type Params = Record<string, string | number>

interface Routed {
  key: StringKey
  params?: Params
}

/* -------------------------------------------------------------------------- *
 * Facts, translated
 * -------------------------------------------------------------------------- */

/** `PARSNIP` back to `parsnip`, so the raw line can find its catalogue entry again. */
const CROP_ID_BY_NAME: ReadonlyMap<string, string> = new Map(
  CROPS.map((crop) => [crop.name.toUpperCase(), crop.id]),
)

function cropText(rawName: string): string {
  const id = CROP_ID_BY_NAME.get(rawName.toUpperCase())
  return t(id === undefined ? 'crop.unknown' : cropNameKey(id))
}

function debrisText(rawName: string): string {
  switch (rawName.toUpperCase()) {
    case 'WEEDS':
      return t('game.debris.weeds')
    case 'ROCK':
      return t('game.debris.rock')
    case 'LOG':
      return t('game.debris.log')
    default:
      return t('game.debris.other')
  }
}

const SEASONS: readonly Season[] = ['spring', 'summer', 'fall', 'winter']

function seasonText(rawName: string): string {
  const lower = rawName.toLowerCase()
  const season = SEASONS.find((candidate) => candidate === lower)
  return season === undefined ? rawName : t(seasonKey(season))
}

const QUALITIES: readonly Quality[] = ['normal', 'silver', 'gold']

function qualityText(rawName: string): string {
  const lower = rawName.toLowerCase()
  const quality = QUALITIES.find((candidate) => candidate === lower)
  return quality === undefined ? rawName : t(qualityKey(quality))
}

/** `itemName()` in `src/game/state.ts` run backwards: seeds, produce, quality, goods. */
function itemText(raw: string): string {
  const up = raw.toUpperCase()
  if (up === 'SPRINKLER') return t('good.sprinkler')
  if (up === 'FERTILIZER') return t('good.fertilizer')

  if (up.endsWith(' SEEDS')) {
    const name = up.slice(0, up.length - ' SEEDS'.length)
    if (CROP_ID_BY_NAME.has(name)) return t('item.seed', { crop: cropText(name) })
  }
  for (const [prefix, quality] of [
    ['SILVER ', 'silver'],
    ['GOLD ', 'gold'],
  ] as const) {
    if (!up.startsWith(prefix)) continue
    const name = up.slice(prefix.length)
    if (CROP_ID_BY_NAME.has(name)) {
      return t('item.produce.quality', { quality: t(qualityKey(quality)), crop: cropText(name) })
    }
  }
  if (CROP_ID_BY_NAME.has(up)) return t('item.produce', { crop: cropText(up) })
  return raw
}

/* -------------------------------------------------------------------------- *
 * Raw game line -> string key
 * -------------------------------------------------------------------------- */

/**
 * The lines `src/game/actions.ts`, `src/game/shop.ts` and the frame loop produce with
 * no facts in them. Written out in full rather than matched loosely, so a line the
 * game changes stops being recognised instead of being quietly mistranslated.
 */
const EXACT: Readonly<Record<string, StringKey>> = {
  'YOU CAN BARELY STAND. GET TO BED.': 'game.guard.exhausted',
  'THERE IS NOTHING OVER THERE.': 'game.guard.offMap',
  'YOU ARE TOO TIRED FOR THAT.': 'game.guard.tired',
  'THIS SOIL IS ALREADY TURNED.': 'game.till.already',
  'YOU CANNOT TILL THE POND.': 'game.till.pond',
  'THE PATH IS PACKED TOO HARD.': 'game.till.path',
  'THE EARTH TURNS OVER.': 'game.till.ok',
  'THERE IS NO TILLED SOIL TO WATER.': 'game.water.noSoil',
  'THIS SOIL IS ALREADY WATERED.': 'game.water.already',
  'THE SOIL DRINKS IT UP.': 'game.water.ok',
  'YOU HAVE NO SUCH SEED.': 'game.sow.noSuchSeed',
  'TILL THE GROUND FIRST.': 'game.sow.tillFirst',
  'SEEDS WILL NOT TAKE THERE.': 'game.sow.badGround',
  'SOMETHING IS ALREADY GROWING HERE.': 'game.sow.occupied',
  'THERE IS NOTHING TO PICK HERE.': 'game.harvest.nothing',
  'THERE IS NOTHING TO CLEAR THERE.': 'game.clear.nothing',
  'THE WEEDS COME UP EASILY.': 'game.clear.weeds',
  'THE ROCK BREAKS APART.': 'game.clear.rock',
  'THE LOG SPLITS AND IS HAULED OFF.': 'game.clear.log',
  'NO SPRINKLERS IN THE BAG.': 'game.sprinkler.none',
  'A SPRINKLER ALREADY STANDS HERE.': 'game.sprinkler.already',
  'IT WOULD SINK IN THE POND.': 'game.sprinkler.pond',
  'SOMETHING IS GROWING THERE ALREADY.': 'game.sprinkler.occupied',
  'THE SPRINKLER WILL WET ITS NEIGHBOURS.': 'game.sprinkler.ok',
  'NO FERTILIZER IN THE BAG.': 'game.fertilize.none',
  'FERTILIZER ONLY HELPS TILLED SOIL.': 'game.fertilize.needSoil',
  'FEED THE SOIL BEFORE YOU SOW IT.': 'game.fertilize.beforeSow',
  'THIS SOIL IS ALREADY RICH.': 'game.fertilize.already',
  'THE SOIL IS DARK AND RICH.': 'game.fertilize.ok',
  'NOTHING HAPPENS.': 'game.tool.nothing',
  'BUY AT LEAST ONE': 'shop.buy.atLeastOne',
  'SELL AT LEAST ONE': 'shop.sell.atLeastOne',
  'NO PRODUCE IN THE BAG': 'shop.sellAll.none',
  'SOUND OFF.': 'settings.audio.muted',
  'SOUND ON.': 'settings.audio.unmuted',
}

interface Rule {
  re: RegExp
  build(m: RegExpExecArray): Routed
}

/**
 * The lines that carry facts. Every capture becomes a `t()` parameter, which is what
 * keeps a price, a count, a crop and a season identical at funny level 1 and 5.
 * Order matters where two shapes overlap; the more specific rule is written first.
 */
const RULES: readonly Rule[] = [
  {
    re: /^CLEAR THE (.+) FIRST\.$/,
    build: (m) => ({ key: 'game.clear.first', params: { debris: debrisText(m[1]) } }),
  },
  {
    re: /^USE THE AXE ON THE (.+)\.$/,
    build: (m) => ({ key: 'game.harvest.useAxe', params: { debris: debrisText(m[1]) } }),
  },
  {
    re: /^WATERED (\d+) TILES\.$/,
    build: (m) => ({ key: 'game.water.many', params: { count: Number(m[1]) } }),
  },
  {
    re: /^NO (.+) SEEDS IN THE BAG\.$/,
    build: (m) => ({ key: 'game.sow.noSeeds', params: { crop: cropText(m[1]) } }),
  },
  {
    re: /^(.+) WILL NOT GROW IN (.+)\.$/,
    build: (m) => ({
      key: 'game.sow.outOfSeason',
      params: { crop: cropText(m[1]), season: seasonText(m[2]) },
    }),
  },
  {
    re: /^(.+) SOWN\.$/,
    build: (m) => ({ key: 'game.sow.ok', params: { crop: cropText(m[1]) } }),
  },
  {
    re: /^YOU PULL UP THE WITHERED (.+)\.$/,
    build: (m) => ({ key: 'game.harvest.withered', params: { crop: cropText(m[1]) } }),
  },
  {
    re: /^THE (.+) IS NOT READY YET\.$/,
    build: (m) => ({ key: 'game.harvest.notReady', params: { crop: cropText(m[1]) } }),
  },
  {
    // `PICKED 3 MELON - GOLD!. IT WILL BEAR AGAIN.` — quality and regrowth are optional
    // and independent, which is exactly the four `game.harvest.ok*` keys.
    re: /^PICKED (\d+) (.+?)(?: - (SILVER|GOLD)!)?\.( IT WILL BEAR AGAIN\.)?$/,
    build: (m) => {
      const params: Params = { count: Number(m[1]), crop: cropText(m[2]) }
      const graded = typeof m[3] === 'string'
      const regrows = typeof m[4] === 'string'
      if (graded) params.quality = qualityText(m[3])
      const key: StringKey = graded
        ? regrows
          ? 'game.harvest.okQualityRegrow'
          : 'game.harvest.okQuality'
        : regrows
          ? 'game.harvest.okRegrow'
          : 'game.harvest.ok'
      return { key, params }
    },
  },
  {
    re: /^PICK A SEED FIRST - PRESS Q OR E\.$/,
    build: () => ({ key: 'game.tool.pickSeed', params: { keys: SEED_CYCLE_KEYS } }),
  },
  {
    re: /^(.+) IS NOT SOLD THIS SEASON$/,
    build: (m) => ({ key: 'shop.buy.notSold', params: { item: itemText(m[1]) } }),
  },
  {
    re: /^ONLY (\d+) LEFT IN STOCK$/,
    build: (m) => ({ key: 'shop.buy.stock', params: { count: Number(m[1]) } }),
  },
  {
    re: /^NEEDS (\d+)G, YOU HAVE (\d+)G$/,
    build: (m) => ({
      key: 'shop.buy.cannotAfford',
      params: { cost: Number(m[1]), gold: Number(m[2]) },
    }),
  },
  {
    re: /^BOUGHT (.+) X(\d+) FOR (\d+)G$/,
    build: (m) => ({
      key: 'shop.buy.ok',
      params: { item: itemText(m[1]), count: Number(m[2]), cost: Number(m[3]) },
    }),
  },
  {
    re: /^SOLD (\d+) PRODUCE FOR (\d+)G$/,
    build: (m) => ({
      key: 'shop.sellAll.ok',
      params: { count: Number(m[1]), total: Number(m[2]) },
    }),
  },
  {
    re: /^SOLD (.+) X(\d+) FOR (\d+)G$/,
    build: (m) => ({
      key: 'shop.sell.ok',
      params: { item: itemText(m[1]), count: Number(m[2]), total: Number(m[3]) },
    }),
  },
  {
    re: /^ONLY (\d+) IN THE BAG$/,
    build: (m) => ({ key: 'shop.sell.only', params: { count: Number(m[1]) } }),
  },
  {
    re: /^NO (.+) IN THE BAG$/,
    build: (m) => ({ key: 'shop.sell.none', params: { item: itemText(m[1]) } }),
  },
  {
    re: /^NOBODY WANTS (.+)$/,
    build: (m) => ({ key: 'shop.sell.worthless', params: { item: itemText(m[1]) } }),
  },
]

/**
 * The string key one raw line came from, or `null` for the game's own running
 * commentary — a tile description as the farmer walks, the tool in hand — which has no
 * catalogue entry and is left exactly as the game wrote it.
 */
export function routeGameMessage(raw: string): Routed | null {
  const line = raw.trim()
  if (line.length === 0) return null

  const exact = Object.prototype.hasOwnProperty.call(EXACT, line) ? EXACT[line] : undefined
  if (exact !== undefined) return { key: exact }

  for (const rule of RULES) {
    const m = rule.re.exec(line)
    if (m === null) continue
    try {
      return rule.build(m)
    } catch {
      // A line that looks right and reads wrong is better left alone than mangled.
      return null
    }
  }
  return null
}

/* -------------------------------------------------------------------------- *
 * The tab
 * -------------------------------------------------------------------------- */

const INTERIOR_WORLD_Y = 32
const NPC_WORLD_ID = 'sprout-hollow-valley'
const INTERACTION_DISTANCE = 3.4
const TOOL_ORDER: readonly ToolId[] = [
  'hoe',
  'can',
  'seeds',
  'hand',
  'axe',
  'sprinkler',
  'fertilizer',
]

interface StructureBinding {
  readonly contentId: string
  readonly label: string
  readonly graph: InteriorGraph
  readonly lifeDefinitionId: string
}

interface AuthoredStructureTarget {
  readonly binding: StructureBinding
  readonly distance: number
}

interface EstateFarmTarget {
  readonly key: string
  readonly kind: 'plot' | 'tree' | 'orchard-slot'
  readonly label: string
  readonly detail: string
  readonly distance: number
}

type InteriorTarget =
  | { readonly kind: 'door'; readonly id: string; readonly label: string; readonly distance: number }
  | { readonly kind: 'connector'; readonly id: string; readonly label: string; readonly distance: number }
  | { readonly kind: 'station'; readonly id: string; readonly label: string; readonly distance: number }
  | { readonly kind: 'fixture'; readonly id: string; readonly label: string; readonly distance: number }

interface ActiveInterior {
  readonly binding: StructureBinding
  readonly runtime: ThreeInteriorRuntimeAdapter
  readonly exteriorPosition: Vec3
  readonly exteriorFacing: number
}

const FACTORY_BINDINGS: readonly StructureBinding[] = VALLEY_FACTORIES.map(
  (definition, index) => ({
    contentId: definition.id,
    label: definition.name,
    graph: requireInteriorById(`factory-${String(index + 1).padStart(3, '0')}`),
    lifeDefinitionId: structureDefinitionId('factory', index + 1),
  }),
)
const BUILDING_BINDINGS: readonly StructureBinding[] = VALLEY_BUILDINGS.map(
  (definition, index) => ({
    contentId: definition.id,
    label: definition.name,
    graph: requireInteriorById(`building-${String(index + 1).padStart(3, '0')}`),
    lifeDefinitionId: structureDefinitionId('building', index + 1),
  }),
)
const STRUCTURE_BINDING_BY_CONTENT_ID: ReadonlyMap<string, StructureBinding> = new Map(
  [...FACTORY_BINDINGS, ...BUILDING_BINDINGS].map((binding) => [binding.contentId, binding]),
)
const AUTHORED_REGION_IDS: ReadonlySet<string> = new Set(
  AUTHORED_VALLEY_REGIONS.map((region) => region.id),
)
const AUTHORED_ESTATE_BY_ID = new Map(
  AUTHORED_ESTATE_ZONES.map((estate) => [estate.id, estate]),
)

function vector(point: Readonly<{ x: number; y: number; z: number }>): Valley3DVector {
  return { x: point.x, y: point.y, z: point.z }
}

function exteriorForPose(position: Readonly<Vec3>, facingYaw: number): Valley3DExteriorState {
  const location = authoredValleyLocationAt(position, AUTHORED_VALLEY_CELL_SIZE)
  return {
    position: vector(position),
    facingYaw: normalizeValleyYaw(facingYaw),
    regionId: location?.regionId ?? null,
    estateId: location?.estateId ?? null,
  }
}

function legacyExterior(state: GameState): Valley3DExteriorState {
  return exteriorForPose(
    { x: state.player.x + 0.5, y: 0, z: state.player.y + 0.5 },
    yawForFarmFacing(state.player.facing),
  )
}

function posesMatch(
  left: Readonly<{ position: Valley3DVector; facingYaw: number }>,
  right: Readonly<{ position: Valley3DVector; facingYaw: number }>,
): boolean {
  return (
    left.position.x === right.position.x &&
    left.position.y === right.position.y &&
    left.position.z === right.position.z &&
    normalizeValleyYaw(left.facingYaw) === normalizeValleyYaw(right.facingYaw)
  )
}

function exteriorReferencesCurrentRegistry(exterior: Valley3DExteriorState): boolean {
  const location = authoredValleyLocationAt(exterior.position, AUTHORED_VALLEY_CELL_SIZE)
  if (location === null) return exterior.regionId === null && exterior.estateId === null
  if (
    exterior.regionId === null ||
    exterior.regionId !== location.regionId ||
    !AUTHORED_REGION_IDS.has(exterior.regionId)
  ) {
    return false
  }
  if (exterior.estateId !== location.estateId) return false
  if (exterior.estateId === null) return true
  return AUTHORED_ESTATE_BY_ID.get(exterior.estateId)?.regionId === exterior.regionId
}

function restoredInteriorSnapshot(
  binding: StructureBinding,
  saved: Valley3DInteriorStateV1,
): ThreeInteriorRuntimeSnapshot | null {
  if (saved.graphId !== binding.graph.id) return null
  const room = binding.graph.rooms.find((candidate) => candidate.id === saved.roomId)
  if (room === undefined || room.floor !== saved.floor) return null

  const doorAccess: Record<string, DoorAccessResolution> = {}
  for (const entry of saved.resolvedDoorAccess) {
    const door = binding.graph.doors.find((candidate) => candidate.id === entry.doorId)
    if (door === undefined || doorAccess[entry.doorId] !== undefined) return null
    const expected = door.access.eventualAccess.map((step) => step.id)
    if (
      expected.length !== entry.stepIds.length ||
      !expected.every((stepId, index) => stepId === entry.stepIds[index])
    ) {
      return null
    }
    doorAccess[entry.doorId] = { doorId: entry.doorId, stepIds: [...entry.stepIds] }
  }

  const activeUse = saved.activeUse
  if (activeUse !== null) {
    const target = activeUse.kind === 'station'
      ? binding.graph.stations.find((candidate) => candidate.id === activeUse.targetId)
      : binding.graph.fixtures.find((candidate) => candidate.id === activeUse.targetId)
    if (
      target === undefined ||
      target.roomId !== saved.roomId ||
      target.roomId !== activeUse.roomId ||
      target.interaction.durationTicks !== activeUse.durationTicks
    ) {
      return null
    }
  }

  const knownUseTargetIds = new Set<string>([
    ...binding.graph.stations.map((station) => station.id),
    ...binding.graph.fixtures.map((fixture) => fixture.id),
  ])
  if (Object.keys(saved.useCounts).some((targetId) => !knownUseTargetIds.has(targetId))) return null

  const actor: InteriorActorState = {
    actorId: 'player',
    actorKind: 'player',
    npcRole: null,
    presence: activeUse === null ? 'inside' : 'using',
    structureId: binding.graph.id,
    roomId: saved.roomId,
    activeUse: activeUse === null ? null : { ...activeUse },
    sanitationStage: saved.sanitationStage,
    hygieneComplete: saved.hygieneComplete,
    serial: saved.serial,
    tick: saved.tick,
    events: [],
    useCounts: { ...saved.useCounts },
  }
  return {
    actor,
    position: vector(saved.position),
    doorAccess,
    revision: saved.revision,
  }
}

function freshGameSeed(): number {
  try {
    const value = new Uint32Array(1)
    crypto.getRandomValues(value)
    return (value[0] ?? 1) & 0x7fffffff
  } catch {
    return 0x534856
  }
}

function facingForYaw(yaw: number): Facing {
  const x = Math.sin(yaw)
  const z = Math.cos(yaw)
  if (Math.abs(x) > Math.abs(z)) return x < 0 ? 'left' : 'right'
  return z < 0 ? 'up' : 'down'
}

function shiftedPoint(point: Vec3, yOffset = INTERIOR_WORLD_Y): Vec3 {
  return Object.freeze({ x: point.x, y: point.y + yOffset, z: point.z })
}

function shiftedCollider(collider: StaticCollider): StaticCollider {
  return {
    ...collider,
    bounds: {
      min: shiftedPoint(collider.bounds.min),
      max: shiftedPoint(collider.bounds.max),
    },
  }
}

function semanticOwner(object: Object3D): Object3D | null {
  let cursor: Object3D | null = object
  while (cursor !== null) {
    if (typeof cursor.userData.semantic === 'string') return cursor
    cursor = cursor.parent
  }
  return null
}

function objectContains(root: Object3D, object: Object3D): boolean {
  let cursor: Object3D | null = object
  while (cursor !== null) {
    if (cursor === root) return true
    cursor = cursor.parent
  }
  return false
}

function legacyBuildingBinding(id: string): StructureBinding {
  let hash = 0x811c9dc5
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return BUILDING_BINDINGS[(hash >>> 0) % BUILDING_BINDINGS.length]!
}

export interface FarmTab {
  /** The panel content. Hand it to the tab strip. */
  readonly element: HTMLElement
  /** The WebGL canvas, for a caller that wants to put focus on the farm. */
  readonly canvas: HTMLElement
  /** Tell the farm whether it is the visible tab. Pauses and resumes the loop. */
  setVisible(visible: boolean): void
  isRunning(): boolean
  /** Moves keyboard focus onto the farm. */
  focus(): void
  /** Captures farm, life simulation, exterior pose, and active interior progress immediately. */
  saveNow(): void
  /** The adapted farming state, or null while only the fallback 3D world is mounted. */
  state(): GameState | null
  /** Hands a state a shell surface produced back to the running game. */
  apply(state: GameState): void
  destroy(): void
}

export function createFarmTab(): FarmTab {
  const element = document.createElement('div')
  element.className = 'sh-farm'
  // Layout only: fill the tab panel, with the stage taking the slack and the caption
  // keeping its own line at every scale from 100% to 200%.
  element.style.display = 'flex'
  element.style.flexDirection = 'column'
  element.style.width = '100%'
  element.style.height = '100%'
  element.style.minWidth = '0'
  element.style.minHeight = '0'

  const stage = document.createElement('div')
  stage.className = 'sh-farm__stage'
  // The one attribute `settings.ts` looks for when it decides whether a key press
  // belongs to the farm or to the shell.
  stage.setAttribute('data-sh-farm', '')
  stage.style.position = 'relative'
  stage.style.flex = '1 1 auto'
  stage.style.minWidth = '0'
  stage.style.minHeight = '0'
  stage.style.overflow = 'hidden'

  const runtimeStatus = document.createElement('div')
  runtimeStatus.id = 'farm-runtime-status'
  runtimeStatus.className = 'sh-farm__runtime-status'
  runtimeStatus.setAttribute('aria-live', 'polite')
  runtimeStatus.setAttribute('aria-atomic', 'true')

  const crosshair = document.createElement('div')
  crosshair.className = 'sh-farm__crosshair'
  crosshair.setAttribute('aria-hidden', 'true')

  const hud = document.createElement('section')
  hud.className = 'sh-farm__hud'
  hud.setAttribute('aria-label', 'Farm interaction HUD')

  const facts = document.createElement('p')
  facts.className = 'sh-farm__facts'

  const targetTitle = document.createElement('h2')
  targetTitle.className = 'sh-farm__target'

  const prompt = document.createElement('p')
  prompt.className = 'sh-farm__prompt'

  const detail = document.createElement('p')
  detail.className = 'sh-farm__detail'

  const feedback = document.createElement('p')
  feedback.className = 'sh-farm__feedback'

  const actionList = document.createElement('div')
  actionList.className = 'sh-farm__actions'
  actionList.setAttribute('role', 'group')
  actionList.setAttribute('aria-label', 'Available farm actions')

  const controls = document.createElement('p')
  controls.className = 'sh-farm__controls'
  controls.textContent =
    'Move: WASD / left stick · Look: pointer / right stick · Use: E, Enter, or A · Farm action: F, click, or X · Next tool: G, right-click, or Y · Jump: Space or B'

  const live = document.createElement('div')
  live.className = 'sh-visually-hidden'
  live.setAttribute('role', 'status')
  live.setAttribute('aria-live', 'polite')
  live.setAttribute('aria-atomic', 'true')

  hud.append(facts, targetTitle, prompt, detail, feedback, actionList, controls)
  stage.append(crosshair, hud, live)
  element.append(stage)

  /* -- the game -- */

  const gameOptions = (): { pauseWhenHidden: boolean; autosave: boolean } => {
    const settings = get().settings.game
    return { pauseWhenHidden: settings.pauseWhenHidden, autosave: settings.autosave }
  }

  let surfaceStatus: ThreeFarmSurfaceStatus = Object.freeze({ state: 'booting' })
  let currentState: GameState | null = null
  let lifeState: LifeSimulationState | null = null
  let lifeMinute = 0
  let nearbyNpcIds: ReadonlySet<string> = new Set<string>()
  let npcFrame: NpcPresentationFrameResult | null = null
  let npcPresentation: NpcPresentationAdapter | null = null
  let currentNpcTarget: NpcInteractionTarget | null = null
  let currentFarmTarget: ResolvedGameplayTarget | null = null
  let currentFarmOverlay: GameplayOverlay | null = null
  let currentEstateFarmTarget: EstateFarmTarget | null = null
  let currentStructureTarget: AuthoredStructureTarget | null = null
  let currentInteriorTarget: InteriorTarget | null = null
  let activeInterior: ActiveInterior | null = null
  let lastFeedback = 'Loading the saved valley…'
  let lastAnnouncement = ''
  let lastActionSignature = ''
  let saveTimer = 0
  let disposed = false

  const gameplay: FarmingGameplayAdapter = createFarmingGameplayAdapter({
    transform: {
      origin: { x: 0, y: 0, z: 0 },
      tileSize: 1,
      groundY: 0,
      maxInteractionDistance: INTERACTION_DISTANCE,
    },
  })
  const raycaster = new Raycaster()
  const screenCentre = new Vector2(0, 0)

  const captureValleyState = (runtime: ThreeRuntime | null): void => {
    const state = currentState
    if (state === null) return
    const life = lifeState ?? createLifeSimulation(state.seed)
    const active = activeInterior
    const exterior = active !== null
      ? exteriorForPose(active.exteriorPosition, active.exteriorFacing)
      : runtime !== null
        ? exteriorForPose(runtime.playerPosition, runtime.playerYaw)
        : state.valley3d?.exterior ?? legacyExterior(state)
    let interior: Valley3DInteriorStateV1 | null = null
    if (active !== null) {
      const snapshot = active.runtime.current
      const roomId = snapshot.actor.roomId
      const room = roomId === null
        ? undefined
        : active.binding.graph.rooms.find((candidate) => candidate.id === roomId)
      if (room !== undefined && snapshot.position !== null) {
        interior = {
          structureContentId: active.binding.contentId,
          graphId: active.binding.graph.id,
          roomId: room.id,
          floor: room.floor,
          position: vector(snapshot.position),
          exteriorReturnPose: {
            position: vector(active.exteriorPosition),
            facingYaw: normalizeValleyYaw(active.exteriorFacing),
          },
          resolvedDoorAccess: Object.keys(snapshot.doorAccess)
            .sort()
            .flatMap((doorId) => {
              const resolution = snapshot.doorAccess[doorId]
              return resolution === undefined
                ? []
                : [{ doorId, stepIds: [...resolution.stepIds] }]
            }),
          activeUse: snapshot.actor.activeUse === null ? null : { ...snapshot.actor.activeUse },
          sanitationStage: snapshot.actor.sanitationStage,
          hygieneComplete: snapshot.actor.hygieneComplete,
          serial: snapshot.actor.serial,
          tick: snapshot.actor.tick,
          useCounts: { ...snapshot.actor.useCounts },
          revision: snapshot.revision,
        }
      }
    }
    const valley3d: Valley3DSaveV1 = {
      version: VALLEY3D_SAVE_VERSION,
      exterior,
      life: cloneLifeSimulationState(life),
      interior,
      estateFarming: state.valley3d?.estateFarming
        ?? createDefaultEstateFarmingState(state.seed, Math.floor(gameMinuteIndex(state) / (24 * 60))),
      factoryProduction: state.valley3d?.factoryProduction
        ?? createDefaultFactoryProductionState(gameMinuteIndex(state)),
    }
    currentState = { ...state, valley3d }
  }

  const paintRuntimeStatus = (): void => {
    runtimeStatus.dataset.state = surfaceStatus.state
    if (surfaceStatus.state === 'booting') {
      runtimeStatus.hidden = false
      runtimeStatus.setAttribute('role', 'status')
      runtimeStatus.textContent = t('common.loading')
      return
    }
    if (surfaceStatus.state === 'failed') {
      runtimeStatus.hidden = false
      runtimeStatus.setAttribute('role', 'alert')
      runtimeStatus.textContent = t('common.error', {
        error: surfaceStatus.error ?? 'The 3D valley could not start.',
      })
      return
    }
    runtimeStatus.hidden = true
    runtimeStatus.removeAttribute('role')
    runtimeStatus.textContent = ''
  }

  const persistNow = (): void => {
    if (saveTimer !== 0) {
      window.clearTimeout(saveTimer)
      saveTimer = 0
    }
    captureValleyState(game.runtime)
    const snapshot = currentState
    if (snapshot !== null) void saveGame(snapshot)
  }

  const requestAutosave = (): void => {
    if (currentState === null || disposed) return
    captureValleyState(game.runtime)
    if (!gameOptions().autosave) return
    if (saveTimer !== 0) window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      saveTimer = 0
      persistNow()
    }, 450)
  }

  const syncLife = (previous: GameState | null, next: GameState): void => {
    const targetMinute = gameMinuteIndex(next)
    const suppliedLife = next.valley3d?.life
    const suppliedChanged = suppliedLife !== undefined && suppliedLife !== previous?.valley3d?.life
    if (
      lifeState === null ||
      previous === null ||
      previous.seed !== next.seed ||
      targetMinute < lifeMinute ||
      suppliedChanged
    ) {
      const restored = readLifeSimulationState(suppliedLife, next.seed)
      if (restored !== null && lifeMinuteIndex(restored) <= targetMinute) {
        lifeState = restored
        lifeMinute = lifeMinuteIndex(restored)
      } else {
        lifeState = createLifeSimulation(next.seed)
        lifeMinute = lifeMinuteIndex(lifeState)
      }
    }
    if (targetMinute > lifeMinute) {
      lifeState = advanceLifeSimulation(lifeState, targetMinute - lifeMinute, {
        nearbyNPCIds: nearbyNpcIds,
      })
      lifeMinute = targetMinute
    } else {
      lifeState = advanceLifeSimulation(lifeState, 0, { nearbyNPCIds: nearbyNpcIds })
    }
  }

  const syncEnvironment = (runtime: ThreeRuntime, state: GameState): void => {
    runtime.syncEnvironment({
      minuteOfDay: state.minutes,
      season: state.season,
      weather: state.weather,
    })
  }

  const announceFeedback = (message: string): void => {
    lastFeedback = message
    if (message !== lastAnnouncement) {
      lastAnnouncement = message
      live.textContent = message
    }
  }

  const commitState = (next: GameState, message: string): void => {
    const previous = currentState
    syncLife(previous, next)
    const synchronized = lifeState === null
      ? next
      : advanceFactoryProduction(next, lifeState, gameMinuteIndex(next))
    currentState = synchronized
    const runtime = game.runtime
    if (runtime !== null) {
      syncEnvironment(runtime, synchronized)
      if (synchronized.valley3d !== undefined) {
        runtime.syncEstateFarming(synchronized.valley3d.estateFarming)
      }
    }
    announceFeedback(message)
    if (previous !== synchronized) requestAutosave()
  }

  const applyInteriorResult = (
    runtime: ThreeRuntime,
    result: ThreeInteriorActionResult,
  ): void => {
    announceFeedback(result.feedback)
    if (result.teleportPosition !== null) {
      runtime.setPlayerPose(shiftedPoint(result.teleportPosition), runtime.playerYaw)
    }
    requestAutosave()
  }

  const leaveInterior = (runtime: ThreeRuntime): void => {
    const active = activeInterior
    if (active === null) return
    const result = active.runtime.exit()
    if (!result.ok) {
      applyInteriorResult(runtime, result)
      return
    }
    const message = result.feedback
    activeInterior = null
    active.runtime.dispose()
    runtime.setWorldVisible(true)
    runtime.setPlayerPose(active.exteriorPosition, active.exteriorFacing)
    currentInteriorTarget = null
    announceFeedback(message)
    requestAutosave()
  }

  const enterInterior = (runtime: ThreeRuntime, binding: StructureBinding): void => {
    if (activeInterior !== null) return
    const exteriorPosition = Object.freeze({
      x: runtime.playerPosition.x,
      y: runtime.playerPosition.y,
      z: runtime.playerPosition.z,
    })
    const exteriorFacing = runtime.playerYaw
    const interior = createThreeInteriorRuntime({
      graph: binding.graph,
      actorId: 'player',
      actorKind: 'player',
      visibilityMode: 'room',
    })
    interior.presentation.root.position.y = INTERIOR_WORLD_Y
    interior.mount({
      scene: runtime.scene,
      addCollider: (collider) => {
        runtime.collision.addStaticCollider(shiftedCollider(collider))
      },
      removeCollider: (id) => {
        runtime.collision.removeStaticCollider(id)
      },
    })
    const result = interior.enter()
    if (!result.ok || result.teleportPosition === null) {
      interior.dispose()
      announceFeedback(result.feedback)
      return
    }
    activeInterior = { binding, runtime: interior, exteriorPosition, exteriorFacing }
    runtime.setWorldVisible(false)
    runtime.setPlayerPose(shiftedPoint(result.teleportPosition), exteriorFacing)
    currentStructureTarget = null
    announceFeedback(`Entered ${binding.label}. ${result.feedback}`)
    requestAutosave()
  }

  const restoreValleyRuntime = (
    runtime: ThreeRuntime,
    state: GameState,
  ): { readonly state: GameState; readonly fellBack: boolean; readonly restoredInterior: boolean } => {
    const saved = state.valley3d
    const savedExterior = saved?.exterior
    const exterior = savedExterior !== undefined && exteriorReferencesCurrentRegistry(savedExterior)
      ? savedExterior
      : legacyExterior(state)
    let fellBack = saved === undefined || savedExterior === undefined || exterior !== savedExterior
    const life = cloneLifeSimulationState(lifeState ?? createLifeSimulation(state.seed))
    const sanitizedBase: Valley3DSaveV1 = {
      version: VALLEY3D_SAVE_VERSION,
      exterior,
      life,
      interior: null,
      estateFarming: saved?.estateFarming
        ?? createDefaultEstateFarmingState(state.seed, Math.floor(gameMinuteIndex(state) / (24 * 60))),
      factoryProduction: saved?.factoryProduction
        ?? createDefaultFactoryProductionState(gameMinuteIndex(state)),
    }

    const savedInterior = saved?.interior ?? null
    if (savedInterior !== null && posesMatch(savedInterior.exteriorReturnPose, exterior)) {
      const binding = STRUCTURE_BINDING_BY_CONTENT_ID.get(savedInterior.structureContentId)
      const snapshot = binding === undefined
        ? null
        : restoredInteriorSnapshot(binding, savedInterior)
      if (binding !== undefined && snapshot !== null) {
        let interior: ThreeInteriorRuntimeAdapter | null = null
        try {
          interior = createThreeInteriorRuntime({
            graph: binding.graph,
            actorId: 'player',
            actorKind: 'player',
            snapshot,
            visibilityMode: 'room',
          })
          interior.presentation.root.position.y = INTERIOR_WORLD_Y
          interior.mount({
            scene: runtime.scene,
            addCollider: (collider) => runtime.collision.addStaticCollider(shiftedCollider(collider)),
            removeCollider: (id) => runtime.collision.removeStaticCollider(id),
          })
          activeInterior = {
            binding,
            runtime: interior,
            exteriorPosition: vector(exterior.position),
            exteriorFacing: exterior.facingYaw,
          }
          runtime.syncEstateFarming(sanitizedBase.estateFarming)
          runtime.setWorldVisible(false)
          runtime.setPlayerPose(shiftedPoint(savedInterior.position), exterior.facingYaw)
          const restoredState = { ...state, valley3d: { ...sanitizedBase, interior: savedInterior } }
          currentState = restoredState
          return { state: restoredState, fellBack, restoredInterior: true }
        } catch {
          interior?.dispose()
          activeInterior = null
          fellBack = true
        }
      } else {
        fellBack = true
      }
    } else if (savedInterior !== null) {
      fellBack = true
    }

    runtime.setWorldVisible(true)
    runtime.setPlayerPose(exterior.position, exterior.facingYaw)
    runtime.syncEstateFarming(sanitizedBase.estateFarming)
    const restoredState = { ...state, valley3d: sanitizedBase }
    currentState = restoredState
    return { state: restoredState, fellBack, restoredInterior: false }
  }

  const executeFactoryStation = (
    runtime: ThreeRuntime,
    stationId: string,
    stationKind: StationKind,
    recipeId?: string,
  ): void => {
    const active = activeInterior
    const state = currentState
    if (active === null || state === null || active.binding.graph.kind !== 'factory') return
    const interiorResult = active.runtime.useStation(stationId)
    applyInteriorResult(runtime, interiorResult)
    if (!interiorResult.ok) return
    const life = lifeState ?? createLifeSimulation(state.seed)
    const outcome = performFactoryStationAction(
      state,
      life,
      active.binding.contentId,
      stationKind,
      gameMinuteIndex(state),
      active.runtime.current.actor.hygieneComplete,
      recipeId,
    )
    commitState(outcome.state, outcome.message)
  }

  const useInteriorTarget = (
    runtime: ThreeRuntime,
    target: InteriorTarget,
    recipeId?: string,
  ): void => {
    const active = activeInterior
    if (active === null || target.distance > INTERACTION_DISTANCE) return
    switch (target.kind) {
      case 'door': {
        const door = active.runtime.graph.doors.find((candidate) => candidate.id === target.id)
        if (door?.exterior === true) {
          leaveInterior(runtime)
          return
        }
        const access = active.runtime.doorFeedback(target.id)
        if (access.state === 'locked') {
          applyInteriorResult(
            runtime,
            active.runtime.resolveDoorAccess(target.id, access.accessStepIds),
          )
          return
        }
        applyInteriorResult(runtime, active.runtime.traverseDoor(target.id))
        return
      }
      case 'connector':
        applyInteriorResult(runtime, active.runtime.traverseConnector(target.id))
        return
      case 'station':
        {
          const station = active.binding.graph.stations.find((candidate) => candidate.id === target.id)
          if (active.binding.graph.kind === 'factory' && station !== undefined) {
            executeFactoryStation(runtime, station.id, station.kind, recipeId)
          } else {
            applyInteriorResult(runtime, active.runtime.useStation(target.id))
          }
        }
        return
      case 'fixture':
        applyInteriorResult(runtime, active.runtime.useFixture(target.id))
        return
    }
  }

  const useSanitation = (runtime: ThreeRuntime): void => {
    const active = activeInterior
    if (active === null) return
    const plan = active.runtime.sanitationPlan()
    if (active.runtime.current.actor.roomId !== plan.restroomRoomId) {
      const doorId = plan.routeDoorIds[0]
      if (doorId !== undefined) {
        const access = active.runtime.doorFeedback(doorId)
        if (access.state === 'locked') {
          applyInteriorResult(
            runtime,
            active.runtime.resolveDoorAccess(doorId, access.accessStepIds),
          )
          return
        }
      }
    }
    applyInteriorResult(runtime, active.runtime.useNextSanitationStep())
  }

  const executeGameplay = (
    runtime: ThreeRuntime,
    command: GameplayCommand,
    target: ResolvedGameplayTarget | null,
  ): void => {
    const state = currentState
    if (state === null) return
    const outcome = gameplay.execute(state, command, target)
    commitState(outcome.state, outcome.announcement)
    if (outcome.transition?.kind === 'enter-building') {
      enterInterior(runtime, legacyBuildingBinding(outcome.transition.buildingId))
    } else if (outcome.transition?.kind === 'leave-building') {
      leaveInterior(runtime)
    }
  }

  const executeEstateFarming = (runtime: ThreeRuntime, target: EstateFarmTarget): void => {
    const state = currentState
    if (state === null) return
    if (target.distance > INTERACTION_DISTANCE) {
      announceFeedback(`Move closer to ${target.label}.`)
      return
    }
    const outcome = target.kind === 'plot'
      ? useEstatePlotTool(state, target.key)
      : useEstateTreeTool(state, target.key)
    commitState(outcome.state, `${target.label}: ${outcome.message}`)
    if (outcome.ok && outcome.state.valley3d !== undefined) {
      runtime.syncEstateFarming(outcome.state.valley3d.estateFarming)
    }
  }

  const cycleTool = (runtime: ThreeRuntime): void => {
    const state = currentState
    if (state === null || activeInterior !== null) return
    const index = TOOL_ORDER.indexOf(state.tool)
    const next = TOOL_ORDER[(index + 1) % TOOL_ORDER.length] ?? 'hoe'
    executeGameplay(runtime, { kind: 'select-tool', tool: next }, null)
  }

  const runPrimaryInteraction = (runtime: ThreeRuntime): void => {
    if (currentNpcTarget !== null) {
      announceFeedback(`${currentNpcTarget.displayName}: ${currentNpcTarget.prompt.text}`)
      return
    }
    if (activeInterior !== null && currentInteriorTarget !== null) {
      useInteriorTarget(runtime, currentInteriorTarget)
      return
    }
    if (currentStructureTarget !== null) {
      enterInterior(runtime, currentStructureTarget.binding)
      return
    }
    if (currentEstateFarmTarget !== null) {
      executeEstateFarming(runtime, currentEstateFarmTarget)
      return
    }
    const option = currentFarmOverlay?.options.find((candidate) => candidate.enabled)
    if (option !== undefined) executeGameplay(runtime, option.command, currentFarmTarget)
    else announceFeedback(currentFarmOverlay?.prompt ?? 'Aim at something nearby to interact.')
  }

  const labelFromData = (data: Record<string, unknown>, fallback: string): string => {
    if (typeof data.label === 'string' && data.label.trim() !== '') return data.label
    const definition = data.definition
    if (
      typeof definition === 'object' &&
      definition !== null &&
      'name' in definition &&
      typeof definition.name === 'string'
    ) {
      return definition.name
    }
    return fallback
  }

  const interiorTargetFrom = (
    hit: Intersection<Object3D>,
    runtime: ThreeRuntime,
  ): InteriorTarget | null => {
    const owner = semanticOwner(hit.object)
    if (owner === null) return null
    const data = owner.userData as Record<string, unknown>
    const distance = runtime.playerPosition.distanceTo(hit.point)
    if (distance > INTERACTION_DISTANCE) return null
    switch (data.semantic) {
      case 'interior-door-endpoint':
        return typeof data.doorId === 'string'
          ? { kind: 'door', id: data.doorId, label: labelFromData(data, 'Door'), distance }
          : null
      case 'interior-vertical-connector':
        return typeof data.connectorId === 'string'
          ? {
              kind: 'connector',
              id: data.connectorId,
              label: labelFromData(data, 'Stairs or elevator'),
              distance,
            }
          : null
      case 'interior-station':
        return typeof data.stationId === 'string'
          ? { kind: 'station', id: data.stationId, label: labelFromData(data, 'Station'), distance }
          : null
      case 'interior-fixture':
        return typeof data.fixtureId === 'string'
          ? { kind: 'fixture', id: data.fixtureId, label: labelFromData(data, 'Fixture'), distance }
          : null
      default:
        return null
    }
  }

  const estateFarmTargetFrom = (
    hit: Intersection<Object3D>,
    runtime: ThreeRuntime,
    state: GameState,
  ): EstateFarmTarget | null => {
    const owner = semanticOwner(hit.object)
    if (owner === null) return null
    const data = owner.userData as Record<string, unknown>
    if (
      data.semantic !== 'estate-farm-tile'
      && data.semantic !== 'estate-farm-crop'
      && data.semantic !== 'estate-farm-debris'
      && data.semantic !== 'estate-orchard-slot'
      && data.semantic !== 'estate-orchard-tree'
    ) {
      return null
    }
    if (typeof data.estateFarmKey !== 'string' || state.valley3d === undefined) return null
    const description = estateFarmingDescription(state.valley3d.estateFarming, data.estateFarmKey)
    if (description === null) return null
    return {
      key: data.estateFarmKey,
      kind: description.kind,
      label: description.label,
      detail: description.detail,
      distance: runtime.playerPosition.distanceTo(hit.point),
    }
  }

  const updateTargets = (runtime: ThreeRuntime): void => {
    raycaster.setFromCamera(screenCentre, runtime.camera)
    const hits = raycaster
      .intersectObjects(runtime.scene.children, true)
      .filter((hit) => !objectContains(runtime.playerAvatar, hit.object))

    currentNpcTarget = null
    for (const npc of npcFrame?.interactionTargets ?? []) {
      const hit = hits.find((candidate) => objectContains(npc.object, candidate.object))
      const rayDistance = raycaster.ray.distanceToPoint(
        new Vector3(npc.position.x, npc.position.y + 0.8, npc.position.z),
      )
      if (hit !== undefined || rayDistance <= 0.75) {
        currentNpcTarget = npc
        break
      }
    }

    currentInteriorTarget = null
    currentStructureTarget = null
    currentFarmTarget = null
    currentFarmOverlay = null
    currentEstateFarmTarget = null
    const state = currentState
    if (state === null) return

    if (activeInterior !== null) {
      for (const hit of hits) {
        const target = interiorTargetFrom(hit, runtime)
        if (target !== null) {
          currentInteriorTarget = target
          break
        }
      }
      return
    }

    for (const hit of hits) {
      const owner = semanticOwner(hit.object)
      const data = owner?.userData as Record<string, unknown> | undefined
      if (data?.semantic !== 'authored-structure-door') continue
      if (typeof data.contentStructureId !== 'string') continue
      const binding = STRUCTURE_BINDING_BY_CONTENT_ID.get(data.contentStructureId)
      if (binding === undefined) continue
      const distance = runtime.playerPosition.distanceTo(hit.point)
      if (distance <= INTERACTION_DISTANCE) {
        currentStructureTarget = { binding, distance }
        break
      }
    }

    for (const hit of hits) {
      const target = estateFarmTargetFrom(hit, runtime, state)
      if (target !== null) {
        currentEstateFarmTarget = target
        break
      }
    }

    if (currentEstateFarmTarget !== null) return

    const ground = hits.find((hit) => hit.object.name.startsWith('terrain:'))
    currentFarmTarget = gameplay.resolveTarget(state, {
      actorPosition: runtime.playerPosition,
      groundPoint: ground?.point,
    })
    currentFarmOverlay = gameplay.overlay(state, currentFarmTarget, { inputLabel: 'Use (E / A)' })
  }

  interface HudAction {
    readonly id: string
    readonly label: string
    readonly description: string
    readonly enabled: boolean
    readonly run: () => void
  }

  const hudActions = (runtime: ThreeRuntime): readonly HudAction[] => {
    const actions: HudAction[] = []
    if (currentNpcTarget !== null) {
      const npc = currentNpcTarget
      actions.push({
        id: `talk:${npc.npcId}`,
        label: npc.prompt.promptLabel,
        description: npc.prompt.accessibilityLabel,
        enabled: true,
        run: () => announceFeedback(`${npc.displayName}: ${npc.prompt.text}`),
      })
    } else if (activeInterior !== null) {
      const target = currentInteriorTarget
      if (target !== null) {
        const station = target.kind === 'station'
          ? activeInterior.binding.graph.stations.find((candidate) => candidate.id === target.id)
          : undefined
        const production = activeInterior.binding.graph.kind === 'factory' && currentState !== null
          ? factoryProductionStatus(currentState, activeInterior.binding.contentId)
          : null
        actions.push({
          id: `${target.kind}:${target.id}`,
          label: target.kind === 'door' ? `Open ${target.label}` : `Use ${target.label}`,
          description: production === null
            ? `Use the targeted ${target.kind}.`
            : `${production.summary} ${production.detail}`,
          enabled: target.distance <= INTERACTION_DISTANCE,
          run: () => useInteriorTarget(runtime, target),
        })
        if (
          station !== undefined
          && activeInterior.binding.graph.kind === 'factory'
          && (station.kind === 'intake' || station.kind === 'production')
        ) {
          for (const recipe of compatibleRecipesForFactory(activeInterior.binding.contentId)) {
            const verb = station.kind === 'intake' ? 'Stage inputs for' : 'Queue'
            actions.push({
              id: `${station.kind}:${station.id}:${recipe.id}`,
              label: `${verb} ${recipe.name}`,
              description: `${recipe.durationMinutes} game minutes · ${recipe.productionCost}g production cost · ${recipe.inputs.length} input types · ${recipe.outputs.length} output types.`,
              enabled: target.distance <= INTERACTION_DISTANCE,
              run: () => useInteriorTarget(runtime, target, recipe.id),
            })
          }
        }
      }
      actions.push({
        id: 'sanitation-route',
        label: 'Restroom and hand-washing route',
        description: 'Advance one accessible toilet, sink, soap, rinse, or drying step.',
        enabled: true,
        run: () => useSanitation(runtime),
      })
    } else if (currentStructureTarget !== null) {
      const structure = currentStructureTarget
      actions.push({
        id: `enter:${structure.binding.contentId}`,
        label: `Enter ${structure.binding.label}`,
        description: `Load and enter ${structure.binding.graph.rooms.length} detailed rooms.`,
        enabled: structure.distance <= INTERACTION_DISTANCE,
        run: () => enterInterior(runtime, structure.binding),
      })
    } else if (currentEstateFarmTarget !== null) {
      const target = currentEstateFarmTarget
      const state = currentState
      const tool = state?.tool ?? 'hand'
      const label = target.kind === 'orchard-slot' && tool === 'seeds'
        ? `Plant selected sapling in ${target.label}`
        : target.kind === 'tree' && tool === 'hand'
          ? `Harvest or check ${target.label}`
          : `${tool} — ${target.label}`
      actions.push({
        id: `estate:${target.key}:${tool}`,
        label,
        description: `${target.detail} Uses canonical ${tool} time, energy, inventory, quality, weather, and season rules.`,
        enabled: state !== null && target.distance <= INTERACTION_DISTANCE,
        run: () => executeEstateFarming(runtime, target),
      })
      actions.push({
        id: 'next-tool',
        label: 'Next tool (G / Y)',
        description: 'Cycle to the next canonical farming tool.',
        enabled: state !== null,
        run: () => cycleTool(runtime),
      })
    } else {
      for (const option of currentFarmOverlay?.options ?? []) {
        actions.push({
          id: option.id,
          label: option.label,
          description: option.description,
          enabled: option.enabled,
          run: () => executeGameplay(runtime, option.command, currentFarmTarget),
        })
      }
      actions.push({
        id: 'next-tool',
        label: 'Next tool (G / Y)',
        description: 'Cycle to the next canonical farming tool.',
        enabled: currentState !== null,
        run: () => cycleTool(runtime),
      })
    }
    actions.push({
      id: 'save-now',
      label: 'Save now',
      description: 'Write the canonical farm state immediately.',
      enabled: currentState !== null,
      run: () => {
        persistNow()
        announceFeedback('Valley saved.')
      },
    })
    return actions
  }

  const paintHud = (runtime: ThreeRuntime | null): void => {
    const state = currentState
    if (state === null || runtime === null) {
      facts.textContent = 'Restoring canonical farm and life state…'
      targetTitle.textContent = 'Sprout Hollow Valley'
      prompt.textContent = 'The authored 3D valley is loading.'
      detail.textContent = 'The Farm tab will become interactive as soon as the save is ready.'
      feedback.textContent = lastFeedback
      return
    }

    const place = activeInterior === null
      ? 'Open valley'
      : `${activeInterior.binding.label} · ${activeInterior.runtime.current.actor.roomId ?? 'entry'}`
    facts.textContent =
      `Year ${state.year} · ${state.season} ${state.day} · ${formatClock(state.minutes)} · ${state.gold}g · Energy ${state.energy}/${state.maxEnergy} · Tool ${state.tool} · ${place} · NPCs ${npcFrame?.materializedNpcIds.length ?? 0}/240 nearby`

    if (currentNpcTarget !== null) {
      targetTitle.textContent = currentNpcTarget.displayName
      prompt.textContent = currentNpcTarget.prompt.promptLabel
      detail.textContent = currentNpcTarget.prompt.text
    } else if (activeInterior !== null && currentInteriorTarget !== null) {
      targetTitle.textContent = currentInteriorTarget.label
      prompt.textContent = `Use ${currentInteriorTarget.kind} (E / A)`
      if (activeInterior.binding.graph.kind === 'factory') {
        const status = factoryProductionStatus(state, activeInterior.binding.contentId)
        detail.textContent = `${status.summary} ${status.detail}`
      } else {
        detail.textContent = `Inside ${activeInterior.binding.label}. Every visible door, station, and fixture is raycast-interactive.`
      }
    } else if (activeInterior !== null) {
      targetTitle.textContent = activeInterior.binding.label
      prompt.textContent = 'Aim at a door, stairs, elevator, work station, restroom, sink, or fixture.'
      if (activeInterior.binding.graph.kind === 'factory') {
        const status = factoryProductionStatus(state, activeInterior.binding.contentId)
        detail.textContent = `${status.summary} ${status.detail}`
      } else {
        detail.textContent = `${activeInterior.binding.graph.rooms.length} rooms · ${activeInterior.binding.graph.doors.length} doors · ${activeInterior.binding.graph.stations.length} stations · ${activeInterior.binding.graph.fixtures.length} fixtures.`
      }
    } else if (currentStructureTarget !== null) {
      targetTitle.textContent = currentStructureTarget.binding.label
      prompt.textContent = `Enter building (E / A)`
      detail.textContent = `${currentStructureTarget.binding.graph.rooms.length} detailed rooms with doors, stations, a restroom, and hand washing.`
    } else if (currentEstateFarmTarget !== null) {
      targetTitle.textContent = currentEstateFarmTarget.label
      prompt.textContent = `${state.tool} action (F, click, X, E, Enter, or A)`
      detail.textContent = `${currentEstateFarmTarget.detail} Designated open-world estate farming; saved by estate and world coordinate.`
    } else {
      targetTitle.textContent = currentFarmOverlay?.title ?? 'Open valley'
      prompt.textContent = currentFarmOverlay?.prompt ?? 'Explore the authored valley.'
      detail.textContent = currentFarmOverlay?.detail ?? 'Aim at a nearby farm tile or valley structure.'
    }
    feedback.textContent = lastFeedback

    const actions = hudActions(runtime)
    const signature = actions
      .map((action) => `${action.id}:${action.enabled}:${action.label}:${action.description}`)
      .join('|')
    if (signature === lastActionSignature) return
    lastActionSignature = signature
    actionList.replaceChildren()
    for (const action of actions) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'sh-btn sh-farm__action'
      button.textContent = action.label
      button.title = action.description
      button.disabled = !action.enabled
      if (action.id !== 'save-now' && action.id !== 'next-tool') {
        button.setAttribute('aria-keyshortcuts', 'E Enter')
      }
      button.addEventListener('click', () => {
        action.run()
        game.focus()
      })
      actionList.appendChild(button)
    }
  }

  const syncPlayerSave = (runtime: ThreeRuntime): void => {
    const state = currentState
    if (state === null || activeInterior !== null) return
    const tile = worldToFarmTile(runtime.playerPosition, gameplay.transform)
    if (tile === null) return
    const facing = facingForYaw(runtime.playerYaw)
    if (state.player.x === tile.x && state.player.y === tile.y && state.player.facing === facing) return
    currentState = { ...state, player: { x: tile.x, y: tile.y, facing } }
    requestAutosave()
  }

  const updateNpcPresentation = (runtime: ThreeRuntime, state: GameState): void => {
    if (npcPresentation === null || lifeState === null) return
    const interior = activeInterior
    npcFrame = npcPresentation.update({
      state: lifeState,
      viewer: interior === null
        ? {
            position: runtime.playerPosition,
            space: { kind: 'exterior', worldId: NPC_WORLD_ID },
          }
        : {
            position: runtime.playerPosition,
            space: {
              kind: 'interior',
              structureDefinitionId: interior.binding.lifeDefinitionId,
              structureInstanceId: null,
              roomId: interior.runtime.current.actor.roomId,
            },
          },
      conversationContext: {
        minute: state.minutes,
        season: state.season,
        weather: state.weather,
        roomId: interior?.runtime.current.actor.roomId ?? null,
      },
    })
    const nextNearby = npcFrame.nearbyNpcIds
    const previousKey = [...nearbyNpcIds].sort().join('|')
    const nextKey = [...nextNearby].sort().join('|')
    nearbyNpcIds = nextNearby
    if (previousKey !== nextKey) {
      lifeState = advanceLifeSimulation(lifeState, 0, { nearbyNPCIds: nearbyNpcIds })
      requestAutosave()
    }
  }

  const onFrame = async (frame: {
    readonly runtime: ThreeRuntime
    readonly tick: ThreeRuntimeTick
    readonly deltaSeconds: number
  }): Promise<void> => {
    if (disposed) return
    const state = currentState
    if (state === null) {
      paintHud(frame.runtime)
      return
    }
    syncPlayerSave(frame.runtime)
    updateNpcPresentation(frame.runtime, currentState ?? state)
    updateTargets(frame.runtime)
    if (frame.tick.input.buttons.secondaryAction.pressed) cycleTool(frame.runtime)
    if (frame.tick.input.buttons.interact.pressed) runPrimaryInteraction(frame.runtime)
    if (frame.tick.input.buttons.primaryAction.pressed) runPrimaryInteraction(frame.runtime)
    paintHud(frame.runtime)
  }

  const game = mountThreeFarmSurface(stage, {
    startPaused: true,
    onFrame,
    onStateChange: (next) => {
      surfaceStatus = next
      paintRuntimeStatus()
    },
    onError: (message) => {
      record('error', 'common.error', undefined, { error: message })
    },
  })
  stage.appendChild(runtimeStatus)
  game.canvas.setAttribute('aria-describedby', runtimeStatus.id)
  paintRuntimeStatus()

  if (game.runtime !== null) {
    npcPresentation = createNpcPresentationAdapter({
      parent: game.runtime.scene,
      collision: game.runtime.collision,
      definitions: NPC_DEFINITIONS,
      placementResolver: (context): NpcPresentationPlacement => {
        const placement = resolveDeterministicNpcPlacement(context)
        const interior = activeInterior
        if (
          interior === null ||
          placement.space.kind !== 'interior' ||
          placement.space.structureDefinitionId !== interior.binding.lifeDefinitionId
        ) {
          return placement
        }
        const room = placement.roomId === null
          ? null
          : interior.runtime.presentation.rooms.get(placement.roomId)
        const anchor = room?.spawnPosition ?? { x: 0, y: 0, z: 0 }
        return {
          ...placement,
          position: {
            x: anchor.x + placement.position.x,
            y: anchor.y + placement.position.y + INTERIOR_WORLD_Y,
            z: anchor.z + placement.position.z,
          },
        }
      },
    })
  }

  /* -- visibility -- */

  let visible = false

  const applyClock = (): void => {
    const shouldRun = visible || !gameOptions().pauseWhenHidden
    if (shouldRun) game.resume()
    else {
      game.pause()
      persistNow()
    }
  }

  void (async () => {
    const saved = await loadSave()
    if (disposed) return
    const next = currentState ?? saved ?? createState(freshGameSeed())
    syncLife(null, next)
    currentState = lifeState === null
      ? next
      : advanceFactoryProduction(next, lifeState, gameMinuteIndex(next))
    const synchronized = currentState
    const runtime = game.runtime
    let fellBack = synchronized.valley3d === undefined
    if (runtime !== null) {
      const restored = restoreValleyRuntime(runtime, synchronized)
      currentState = restored.state
      fellBack = fellBack || restored.fellBack
      syncEnvironment(runtime, restored.state)
    }
    requestAutosave()
    announceFeedback(
      saved === null
        ? 'New valley ready.'
        : fellBack
          ? 'Saved farm restored; unavailable 3D references returned to the safe exterior pose.'
          : 'Saved valley and 3D progress restored.',
    )
    paintHud(runtime)
    applyClock()
  })().catch((error: unknown) => {
    announceFeedback(error instanceof Error ? error.message : String(error))
    paintHud(game.runtime)
  })

  const stopStore = subscribe(() => {
    // `pauseWhenHidden` can be turned off while the Farm tab is in the background.
    applyClock()
  })

  /* -- labels -- */

  const relabel = (): void => {
    element.setAttribute('aria-label', t('tab.farm'))
    game.canvas.setAttribute('aria-label', t('tab.farm'))
    paintRuntimeStatus()
  }

  element.setAttribute('role', 'group')
  relabel()
  const stopLang = onLangChange(relabel)

  try {
    attachEditor(element, FARM_ELEMENT_ID, {
      labelKey: 'tab.farm',
      properties: ['background', 'paddingPx'],
      keywords: ['farm', 'game', 'canvas', '3d', 'third person'],
    })
  } catch {
    // An appearance editor that will not attach costs an affordance, not the farm.
  }

  return {
    element,
    canvas: game.canvas,
    setVisible(next: boolean): void {
      visible = next
      applyClock()
    },
    isRunning(): boolean {
      return game.isRunning()
    },
    focus(): void {
      game.canvas.focus()
    },
    state(): GameState | null {
      captureValleyState(game.runtime)
      return currentState
    },
    apply(next: GameState): void {
      const previous = currentState
      syncLife(previous, next)
      currentState = lifeState === null
        ? next
        : advanceFactoryProduction(next, lifeState, gameMinuteIndex(next))
      const synchronized = currentState
      const runtime = game.runtime
      if (runtime !== null) {
        activeInterior?.runtime.dispose()
        activeInterior = null
        const restored = restoreValleyRuntime(runtime, synchronized)
        currentState = restored.state
        syncEnvironment(runtime, restored.state)
      }
      requestAutosave()
      paintHud(runtime)
    },
    saveNow(): void {
      persistNow()
    },
    destroy(): void {
      disposed = true
      stopStore()
      stopLang()
      persistNow()
      if (saveTimer !== 0) window.clearTimeout(saveTimer)
      activeInterior?.runtime.dispose()
      activeInterior = null
      npcPresentation?.dispose()
      npcPresentation = null
      game.dispose()
      element.remove()
    },
  }
}

/** Convenience for a host that would rather hand over a container than an element. */
export function mountFarmTab(host: HTMLElement): FarmTab {
  const tab = createFarmTab()
  host.appendChild(tab.element)
  return tab
}
