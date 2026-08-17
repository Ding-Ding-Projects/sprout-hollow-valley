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
import type { GameState, Quality, Season } from '../../game/types'
import { mountThreeFarmSurface } from '../../renderer3d/farm-surface'
import type { ThreeFarmSurfaceStatus } from '../../renderer3d/farm-surface'
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
  /** Reserved for the deterministic gameplay adapter; the 3D runtime owns no save yet. */
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

  element.append(stage)

  /* -- the game -- */

  const gameOptions = (): { pauseWhenHidden: boolean } => {
    return { pauseWhenHidden: get().settings.game.pauseWhenHidden }
  }

  let surfaceStatus: ThreeFarmSurfaceStatus = Object.freeze({ state: 'booting' })

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

  const game = mountThreeFarmSurface(stage, {
    startPaused: true,
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

  /* -- visibility -- */

  let visible = false

  const applyClock = (): void => {
    const shouldRun = visible || !gameOptions().pauseWhenHidden
    if (shouldRun) game.resume()
    else game.pause()
  }

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
      return null
    },
    apply(_next: GameState): void {
      // The gameplay-adapter lane will connect deterministic farming state to this surface.
    },
    saveNow(): void {
      // ThreeRuntime owns presentation state only; the shell store remains independent.
    },
    destroy(): void {
      stopStore()
      stopLang()
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
