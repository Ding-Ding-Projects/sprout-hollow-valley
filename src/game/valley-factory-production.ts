import { VALLEY_CONTENT_REGISTRY } from '../content/registry'
import type { FactoryDef, RecipeDef } from '../content/types'
import { FACTORY_REQUIRED_STATION_KINDS } from '../facilities/requirements'
import { requireInteriorById } from '../interiors/catalogue'
import type { InteriorGraph, StationKind } from '../interiors/models'
import { structureDefinitionId } from '../life/catalog'
import type { LifeSimulationState } from '../life/types'
import { fitCount } from './storage'
import type {
  GameState,
  InventoryEntry,
  ItemRef,
  Quality,
  Valley3DFactoryFinishedGoodV1,
  Valley3DFactoryInspectionState,
  Valley3DFactoryProductionFactoryV1,
  Valley3DFactoryProductionJobV1,
  Valley3DFactoryProductionStateV1,
  Valley3DFactoryStaffReadiness,
} from './types'

const EXPECTED_FACTORY_COUNT = 400
const EXPECTED_RECIPE_COUNT = 1_200
const MAX_COUNT = Number.MAX_SAFE_INTEGER
const MAX_STORED_ITEM_KINDS = 3_000
const MAX_FINISHED_LOTS = 4_500
const CLEANLINESS_GATE = 60
const MAINTENANCE_GATE = 40
const QUALITIES: readonly Quality[] = ['normal', 'silver', 'gold']
const STAFF_READINESS: readonly Valley3DFactoryStaffReadiness[] = [
  'unassessed',
  'npc-ready',
  'player-ready',
  'unavailable',
]
const INSPECTION_STATES: readonly Valley3DFactoryInspectionState[] = [
  'pending',
  'passed',
  'failed',
]

export interface FactoryProductionResolution {
  readonly factory: FactoryDef
  readonly graph: InteriorGraph
  readonly graphId: string
  readonly lifeStructureDefinitionId: string
  readonly recipes: readonly RecipeDef[]
}

export interface FactoryProductionCatalogValidation {
  readonly ok: boolean
  readonly factories: number
  readonly recipes: number
  readonly resolvedFactories: number
  readonly assignedRecipes: number
  readonly issues: readonly string[]
}

export interface FactoryProductionActionResult {
  readonly state: GameState
  readonly ok: boolean
  readonly message: string
}

export interface FactoryProductionStatus {
  readonly summary: string
  readonly detail: string
}

interface InternalResolution extends FactoryProductionResolution {
  readonly index: number
}

function compareId(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function integer(value: unknown, minimum = 0, maximum = MAX_COUNT): number | null {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= minimum
    && value <= maximum
    ? value
    : null
}

function oneOf<const T extends readonly string[]>(value: unknown, values: T): T[number] | null {
  return typeof value === 'string' && (values as readonly string[]).includes(value)
    ? value as T[number]
    : null
}

function canonicalMinute(value: number): number {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0
}

function factoryGraphId(index: number): string {
  return `factory-${String(index + 1).padStart(3, '0')}`
}

function compatible(factory: FactoryDef, recipe: RecipeDef): boolean {
  return recipe.factoryCapabilities.length > 0
    && recipe.factoryCapabilities.every((capability) => factory.capabilities.includes(capability))
}

const FACTORIES = [...VALLEY_CONTENT_REGISTRY.factories].sort((a, b) => compareId(a.id, b.id))
const RECIPES = [...VALLEY_CONTENT_REGISTRY.recipes].sort((a, b) => compareId(a.id, b.id))
const FACTORY_INDEX = new Map(FACTORIES.map((factory, index) => [factory.id, index] as const))
const RECIPE_BY_ID = new Map(RECIPES.map((recipe) => [recipe.id, recipe] as const))
const PRODUCT_BY_ID = new Map(
  VALLEY_CONTENT_REGISTRY.products.map((product) => [product.id, product] as const),
)
const MATERIAL_IDS = new Set(VALLEY_CONTENT_REGISTRY.materials.map((material) => material.id))
const PRODUCT_IDS = new Set(VALLEY_CONTENT_REGISTRY.products.map((product) => product.id))
const ITEM_IDS = new Set([...MATERIAL_IDS, ...PRODUCT_IDS])
const RECIPES_BY_FACTORY = new Map<string, readonly RecipeDef[]>(
  FACTORIES.map((factory) => [
    factory.id,
    Object.freeze(RECIPES.filter((recipe) => compatible(factory, recipe))),
  ]),
)

function internalResolution(factoryId: string): InternalResolution | null {
  const index = FACTORY_INDEX.get(factoryId)
  if (index === undefined) return null
  const factory = FACTORIES[index]
  if (factory === undefined) return null
  const graphId = factoryGraphId(index)
  let graph: InteriorGraph
  try {
    graph = requireInteriorById(graphId)
  } catch {
    return null
  }
  if (graph.id !== graphId || graph.kind !== 'factory' || graph.context !== 'factory') return null
  const stationKinds = new Set(graph.stations.map((station) => station.kind))
  if (!FACTORY_REQUIRED_STATION_KINDS.every((kind) => stationKinds.has(kind))) return null
  const recipes = RECIPES_BY_FACTORY.get(factory.id)
  if (recipes === undefined || recipes.length === 0) return null
  return {
    index,
    factory,
    graph,
    graphId,
    lifeStructureDefinitionId: structureDefinitionId('factory', index + 1),
    recipes,
  }
}

function validateCatalog(): FactoryProductionCatalogValidation {
  const issues: string[] = []
  if (FACTORIES.length !== EXPECTED_FACTORY_COUNT) {
    issues.push(`Expected exactly ${EXPECTED_FACTORY_COUNT} factories; received ${FACTORIES.length}.`)
  }
  if (RECIPES.length !== EXPECTED_RECIPE_COUNT) {
    issues.push(`Expected exactly ${EXPECTED_RECIPE_COUNT} recipes; received ${RECIPES.length}.`)
  }
  if (FACTORY_INDEX.size !== FACTORIES.length) issues.push('Factory IDs are not unique.')
  if (RECIPE_BY_ID.size !== RECIPES.length) issues.push('Recipe IDs are not unique.')

  let resolvedFactories = 0
  const assignedRecipes = new Set<string>()
  for (const factory of FACTORIES) {
    const resolution = internalResolution(factory.id)
    if (resolution === null) {
      issues.push(`Factory ${factory.id} cannot resolve a complete interior and recipe set.`)
      continue
    }
    resolvedFactories += 1
    for (const recipe of resolution.recipes) assignedRecipes.add(recipe.id)
  }
  for (const recipe of RECIPES) {
    if (!assignedRecipes.has(recipe.id)) {
      issues.push(`Recipe ${recipe.id} has no strictly compatible canonical factory.`)
    }
  }
  return Object.freeze({
    ok: issues.length === 0,
    factories: FACTORIES.length,
    recipes: RECIPES.length,
    resolvedFactories,
    assignedRecipes: assignedRecipes.size,
    issues: Object.freeze(issues),
  })
}

export const FACTORY_PRODUCTION_CATALOG_VALIDATION = validateCatalog()

export function factoryProductionResolution(
  factoryId: string,
  graphId?: string,
): FactoryProductionResolution | null {
  if (!FACTORY_PRODUCTION_CATALOG_VALIDATION.ok) return null
  const resolution = internalResolution(factoryId)
  if (resolution === null || (graphId !== undefined && graphId !== resolution.graphId)) return null
  return resolution
}

export function compatibleRecipesForFactory(factoryId: string): readonly RecipeDef[] {
  return factoryProductionResolution(factoryId)?.recipes ?? []
}

function defaultFactoryRow(factoryId: string, currentMinute: number): Valley3DFactoryProductionFactoryV1 {
  return {
    factoryId,
    queue: [],
    storage: {},
    finishedGoods: [],
    staffReadiness: 'unassessed',
    cleanliness: 100,
    inspection: 'pending',
    maintenance: 100,
    lastAdvancedMinute: canonicalMinute(currentMinute),
    nextJobSerial: 1,
  }
}

export function createDefaultFactoryProductionState(
  currentMinute: number,
): Valley3DFactoryProductionStateV1 {
  const factories: Record<string, Valley3DFactoryProductionFactoryV1> = {}
  for (const factory of FACTORIES) factories[factory.id] = defaultFactoryRow(factory.id, currentMinute)
  return { factories }
}

function cloneJob(job: Valley3DFactoryProductionJobV1): Valley3DFactoryProductionJobV1 {
  return { ...job }
}

function cloneFinishedGood(
  lot: Valley3DFactoryFinishedGoodV1,
): Valley3DFactoryFinishedGoodV1 {
  return { ...lot }
}

function cloneFactoryRow(
  row: Valley3DFactoryProductionFactoryV1,
): Valley3DFactoryProductionFactoryV1 {
  return {
    ...row,
    queue: row.queue.map(cloneJob),
    storage: { ...row.storage },
    finishedGoods: row.finishedGoods.map(cloneFinishedGood),
  }
}

export function cloneFactoryProductionState(
  state: Valley3DFactoryProductionStateV1,
): Valley3DFactoryProductionStateV1 {
  const factories: Record<string, Valley3DFactoryProductionFactoryV1> = {}
  for (const factory of FACTORIES) {
    const row = state.factories[factory.id]
    factories[factory.id] = row === undefined
      ? defaultFactoryRow(factory.id, 0)
      : cloneFactoryRow(row)
  }
  return { factories }
}

function readStorage(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return null
  const keys = Object.keys(value).sort(compareId)
  if (keys.length > MAX_STORED_ITEM_KINDS) return null
  const storage: Record<string, number> = {}
  for (const itemId of keys) {
    if (!ITEM_IDS.has(itemId)) return null
    const quantity = integer(value[itemId], 1)
    if (quantity === null) return null
    storage[itemId] = quantity
  }
  return storage
}

function readFinishedGoods(value: unknown): Valley3DFactoryFinishedGoodV1[] | null {
  if (!Array.isArray(value) || value.length > MAX_FINISHED_LOTS) return null
  const lots: Valley3DFactoryFinishedGoodV1[] = []
  const seen = new Set<string>()
  for (const candidate of value) {
    if (!isRecord(candidate) || typeof candidate['productId'] !== 'string') return null
    const productId = candidate['productId']
    const quality = oneOf(candidate['quality'], QUALITIES)
    const quantity = integer(candidate['quantity'], 1)
    const key = `${productId}:${String(quality)}`
    if (!PRODUCT_IDS.has(productId) || quality === null || quantity === null || seen.has(key)) {
      return null
    }
    seen.add(key)
    lots.push({ productId, quality, quantity })
  }
  return lots.sort((a, b) => compareId(`${a.productId}:${a.quality}`, `${b.productId}:${b.quality}`))
}

function jobSerial(factoryId: string, jobId: string): number | null {
  const prefix = `${factoryId}:job:`
  if (!jobId.startsWith(prefix)) return null
  const text = jobId.slice(prefix.length)
  if (!/^\d+$/.test(text)) return null
  return integer(Number(text), 1)
}

function readQueue(
  value: unknown,
  resolution: FactoryProductionResolution,
  currentMinute: number,
): { readonly queue: Valley3DFactoryProductionJobV1[]; readonly maximumSerial: number } | null {
  if (!Array.isArray(value) || value.length > resolution.factory.queueCapacity) return null
  const compatibleIds = new Set(resolution.recipes.map((recipe) => recipe.id))
  const queue: Valley3DFactoryProductionJobV1[] = []
  const ids = new Set<string>()
  let maximumSerial = 0
  for (const candidate of value) {
    if (!isRecord(candidate)) return null
    const id = typeof candidate['id'] === 'string' ? candidate['id'] : null
    const recipeId = typeof candidate['recipeId'] === 'string' ? candidate['recipeId'] : null
    const queuedAtMinute = integer(candidate['queuedAtMinute'], 0, currentMinute)
    const quality = oneOf(candidate['quality'], QUALITIES)
    const recipe = recipeId === null ? undefined : RECIPE_BY_ID.get(recipeId)
    const remainingMinutes = recipe === undefined
      ? null
      : integer(candidate['remainingMinutes'], 1, recipe.durationMinutes)
    const serial = id === null ? null : jobSerial(resolution.factory.id, id)
    if (
      id === null || ids.has(id) || recipeId === null || !compatibleIds.has(recipeId)
      || queuedAtMinute === null || quality === null || recipe === undefined
      || remainingMinutes === null || serial === null
    ) {
      return null
    }
    ids.add(id)
    maximumSerial = Math.max(maximumSerial, serial)
    queue.push({ id, recipeId, queuedAtMinute, remainingMinutes, quality })
  }
  return { queue, maximumSerial }
}

function readFactoryRow(
  value: unknown,
  resolution: FactoryProductionResolution,
  currentMinute: number,
): Valley3DFactoryProductionFactoryV1 | null {
  if (!isRecord(value) || value['factoryId'] !== resolution.factory.id) return null
  const lastAdvancedMinute = integer(value['lastAdvancedMinute'], 0, currentMinute)
  const cleanliness = integer(value['cleanliness'], 0, 100)
  const maintenance = integer(value['maintenance'], 0, 100)
  const staffReadiness = oneOf(value['staffReadiness'], STAFF_READINESS)
  const inspection = oneOf(value['inspection'], INSPECTION_STATES)
  const storage = readStorage(value['storage'])
  const finishedGoods = readFinishedGoods(value['finishedGoods'])
  const queueResult = readQueue(value['queue'], resolution, currentMinute)
  const nextJobSerial = integer(value['nextJobSerial'], 1)
  if (
    lastAdvancedMinute === null || cleanliness === null || maintenance === null
    || staffReadiness === null || inspection === null || storage === null
    || finishedGoods === null || queueResult === null || nextJobSerial === null
    || nextJobSerial <= queueResult.maximumSerial
  ) {
    return null
  }
  return {
    factoryId: resolution.factory.id,
    queue: queueResult.queue,
    storage,
    finishedGoods,
    staffReadiness,
    cleanliness,
    inspection,
    maintenance,
    lastAdvancedMinute,
    nextJobSerial,
  }
}

export function readFactoryProductionState(
  value: unknown,
  currentMinute: number,
): Valley3DFactoryProductionStateV1 {
  const minute = canonicalMinute(currentMinute)
  const fallback = (): Valley3DFactoryProductionStateV1 =>
    createDefaultFactoryProductionState(minute)
  if (!FACTORY_PRODUCTION_CATALOG_VALIDATION.ok || !isRecord(value) || !isRecord(value['factories'])) {
    return fallback()
  }
  const suppliedKeys = Object.keys(value['factories']).sort(compareId)
  const canonicalKeys = FACTORIES.map((factory) => factory.id)
  if (
    suppliedKeys.length !== canonicalKeys.length
    || suppliedKeys.some((key, index) => key !== canonicalKeys[index])
  ) {
    return fallback()
  }
  const factories: Record<string, Valley3DFactoryProductionFactoryV1> = {}
  for (const factory of FACTORIES) {
    const resolution = factoryProductionResolution(factory.id)
    if (resolution === null) return fallback()
    factories[factory.id] = readFactoryRow(value['factories'][factory.id], resolution, minute)
      ?? defaultFactoryRow(factory.id, minute)
  }
  return { factories }
}

function stableHash(text: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function outputQuality(
  state: GameState,
  row: Valley3DFactoryProductionFactoryV1,
  recipe: RecipeDef,
  currentMinute: number,
): Quality {
  const roll = stableHash(
    `${state.seed}:${row.factoryId}:${recipe.id}:${currentMinute}:${state.weather}:${row.cleanliness}:${row.maintenance}:${row.inspection}`,
  ) % 100
  const readinessBonus = row.staffReadiness === 'npc-ready' ? 9 : 5
  const conditionBonus = Math.floor(row.cleanliness / 10) + Math.floor(row.maintenance / 12)
  const score = roll + readinessBonus + conditionBonus
  return score >= 100 ? 'gold' : score >= 58 ? 'silver' : 'normal'
}

function npcReadyForFactory(
  life: LifeSimulationState,
  lifeStructureDefinitionId: string,
): boolean {
  const npcById = new Map(life.npcs.map((npc) => [npc.npcId, npc] as const))
  return life.employments.some((employment) => {
    if (employment.status !== 'active' || employment.structureDefinitionId !== lifeStructureDefinitionId) {
      return false
    }
    const npc = npcById.get(employment.npcId)
    return npc !== undefined
      && npc.employmentStatus === 'active'
      && npc.activity === 'work'
      && npc.location.kind === 'work'
      && npc.location.structureDefinitionId === lifeStructureDefinitionId
      && (npc.unavailableUntilDay === null || npc.unavailableUntilDay <= life.calendar.absoluteDay)
      && npc.needs.energy > 0
      && npc.needs.hygiene >= 20
  })
}

function resolvedStaffReadiness(
  row: Valley3DFactoryProductionFactoryV1,
  life: LifeSimulationState,
  resolution: FactoryProductionResolution,
): Valley3DFactoryStaffReadiness {
  if (npcReadyForFactory(life, resolution.lifeStructureDefinitionId)) return 'npc-ready'
  if (row.staffReadiness === 'player-ready') return 'player-ready'
  return 'unavailable'
}

function addFinishedOutput(
  lots: Valley3DFactoryFinishedGoodV1[],
  productId: string,
  quality: Quality,
  quantity: number,
): void {
  const existing = lots.find((lot) => lot.productId === productId && lot.quality === quality)
  if (existing === undefined) lots.push({ productId, quality, quantity })
  else existing.quantity = Math.min(MAX_COUNT, existing.quantity + quantity)
}

function productionBlockReason(row: Valley3DFactoryProductionFactoryV1): string | null {
  if (row.staffReadiness !== 'npc-ready' && row.staffReadiness !== 'player-ready') {
    return 'No eligible NPC or player operator is ready.'
  }
  if (row.cleanliness < CLEANLINESS_GATE) return 'Cleaning is below the production threshold.'
  if (row.inspection !== 'passed') return 'The staged batch has not passed inspection.'
  if (row.maintenance < MAINTENANCE_GATE) return 'Maintenance is below the production threshold.'
  return null
}

function updateProductionState(
  state: GameState,
  production: Valley3DFactoryProductionStateV1,
  extra: Partial<Pick<GameState, 'gold' | 'inventory' | 'stats'>> = {},
): GameState {
  if (state.valley3d === undefined) return state
  return {
    ...state,
    ...extra,
    valley3d: { ...state.valley3d, factoryProduction: production },
  }
}

export function advanceFactoryProduction(
  state: GameState,
  life: LifeSimulationState,
  currentMinute: number,
): GameState {
  if (state.valley3d === undefined || !FACTORY_PRODUCTION_CATALOG_VALIDATION.ok) return state
  const minute = canonicalMinute(currentMinute)
  const production = cloneFactoryProductionState(state.valley3d.factoryProduction)
  let changed = false

  for (const factory of FACTORIES) {
    const resolution = factoryProductionResolution(factory.id)
    const row = production.factories[factory.id]
    if (resolution === null || row === undefined) continue
    const readiness = resolvedStaffReadiness(row, life, resolution)
    if (readiness !== row.staffReadiness) {
      row.staffReadiness = readiness
      changed = true
    }
    if (minute <= row.lastAdvancedMinute) continue
    let availableMinutes = minute - row.lastAdvancedMinute
    row.lastAdvancedMinute = minute
    changed = true
    if (row.queue.length === 0 || productionBlockReason(row) !== null) continue

    while (availableMinutes > 0 && row.queue.length > 0) {
      const head = row.queue[0]
      if (head === undefined) break
      if (availableMinutes < head.remainingMinutes) {
        head.remainingMinutes -= availableMinutes
        availableMinutes = 0
        break
      }
      availableMinutes -= head.remainingMinutes
      const recipe = RECIPE_BY_ID.get(head.recipeId)
      if (recipe === undefined || !compatible(factory, recipe)) break
      for (const output of recipe.outputs) {
        addFinishedOutput(row.finishedGoods, output.itemId, head.quality, output.quantity)
      }
      row.queue.shift()
      row.cleanliness = Math.max(0, row.cleanliness - Math.max(1, Math.ceil(recipe.durationMinutes / 720)))
      row.maintenance = Math.max(0, row.maintenance - Math.max(1, Math.ceil(recipe.durationMinutes / 1_440)))
      if (productionBlockReason(row) !== null) break
    }
  }
  return changed ? updateProductionState(state, production) : state
}

function refused(state: GameState, message: string): FactoryProductionActionResult {
  return { state, ok: false, message }
}

function accepted(state: GameState, message: string): FactoryProductionActionResult {
  return { state, ok: true, message }
}

function inventoryQuantity(inventory: readonly InventoryEntry[], itemId: string): number {
  let count = 0
  for (const entry of inventory) {
    if (entry.item.kind === 'material' && entry.item.materialId === itemId) count += entry.count
    if (entry.item.kind === 'product' && entry.item.productId === itemId) count += entry.count
  }
  return count
}

function consumeInventoryItem(
  inventory: InventoryEntry[],
  itemId: string,
  quantity: number,
): InventoryEntry[] | null {
  if (quantity <= 0) return inventory.map((entry) => ({ item: { ...entry.item }, count: entry.count }))
  if (inventoryQuantity(inventory, itemId) < quantity) return null
  let remaining = quantity
  const qualityOrder = new Map<Quality, number>(QUALITIES.map((quality, index) => [quality, index]))
  const ordered = inventory
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const leftQuality = left.entry.item.kind === 'product'
        ? qualityOrder.get(left.entry.item.quality) ?? 0
        : 0
      const rightQuality = right.entry.item.kind === 'product'
        ? qualityOrder.get(right.entry.item.quality) ?? 0
        : 0
      return leftQuality - rightQuality || left.index - right.index
    })
  const removed = new Map<number, number>()
  for (const { entry, index } of ordered) {
    const matches = (entry.item.kind === 'material' && entry.item.materialId === itemId)
      || (entry.item.kind === 'product' && entry.item.productId === itemId)
    if (!matches || remaining <= 0) continue
    const amount = Math.min(remaining, entry.count)
    removed.set(index, amount)
    remaining -= amount
  }
  if (remaining > 0) return null
  return inventory.flatMap((entry, index) => {
    const count = entry.count - (removed.get(index) ?? 0)
    return count > 0 ? [{ item: { ...entry.item }, count }] : []
  })
}

function itemRefFor(productId: string, quality: Quality): ItemRef {
  return { kind: 'product', productId, quality }
}

function sameItem(left: ItemRef, right: ItemRef): boolean {
  if (left.kind !== right.kind) return false
  if (left.kind === 'product' && right.kind === 'product') {
    return left.productId === right.productId && left.quality === right.quality
  }
  if (left.kind === 'material' && right.kind === 'material') {
    return left.materialId === right.materialId
  }
  return false
}

function stageInputs(
  state: GameState,
  production: Valley3DFactoryProductionStateV1,
  row: Valley3DFactoryProductionFactoryV1,
  recipe: RecipeDef,
): FactoryProductionActionResult {
  const missing = recipe.inputs.map((input) => ({
    itemId: input.itemId,
    quantity: Math.max(0, input.quantity - (row.storage[input.itemId] ?? 0)),
  }))
  const shortage = missing.find(
    (input) => input.quantity > inventoryQuantity(state.inventory, input.itemId),
  )
  if (shortage !== undefined) {
    return refused(
      state,
      `Intake refused: ${shortage.quantity} more ${shortage.itemId} required in player storage.`,
    )
  }
  let inventory = state.inventory.map((entry) => ({ item: { ...entry.item }, count: entry.count }))
  for (const input of missing) {
    if (input.quantity <= 0) continue
    const consumed = consumeInventoryItem(inventory, input.itemId, input.quantity)
    if (consumed === null) return refused(state, `Intake refused: ${input.itemId} changed before transfer.`)
    inventory = consumed
    row.storage[input.itemId] = (row.storage[input.itemId] ?? 0) + input.quantity
  }
  row.inspection = 'pending'
  return accepted(
    updateProductionState(state, production, { inventory }),
    missing.every((input) => input.quantity === 0)
      ? `${recipe.name} inputs are already staged.`
      : `${recipe.name} inputs moved into ${row.factoryId} storage; inspection is pending.`,
  )
}

function inspectedRecipe(
  row: Valley3DFactoryProductionFactoryV1,
  recipes: readonly RecipeDef[],
): RecipeDef | undefined {
  return recipes.find((recipe) =>
    recipe.inputs.every((input) => (row.storage[input.itemId] ?? 0) >= input.quantity),
  )
}

function enqueueRecipe(
  state: GameState,
  production: Valley3DFactoryProductionStateV1,
  row: Valley3DFactoryProductionFactoryV1,
  resolution: FactoryProductionResolution,
  recipe: RecipeDef,
  currentMinute: number,
  hygieneComplete: boolean,
): FactoryProductionActionResult {
  if (row.queue.length >= resolution.factory.queueCapacity) {
    return refused(state, `Production refused: queue capacity is ${resolution.factory.queueCapacity}.`)
  }
  const block = productionBlockReason(row)
  if (block !== null) return refused(state, `Production refused: ${block}`)
  if (!hygieneComplete) {
    return refused(state, 'Production refused: complete the accessible restroom and hand-washing route first.')
  }
  const missing = recipe.inputs.find((input) => (row.storage[input.itemId] ?? 0) < input.quantity)
  if (missing !== undefined) {
    const short = missing.quantity - (row.storage[missing.itemId] ?? 0)
    return refused(state, `Production refused: factory storage needs ${short} more ${missing.itemId}.`)
  }
  if (state.gold < recipe.productionCost) {
    return refused(state, `Production refused: ${recipe.productionCost - state.gold}g more is required.`)
  }
  if (row.nextJobSerial >= MAX_COUNT) return refused(state, 'Production refused: job serial limit reached.')
  for (const input of recipe.inputs) {
    const left = (row.storage[input.itemId] ?? 0) - input.quantity
    if (left > 0) row.storage[input.itemId] = left
    else delete row.storage[input.itemId]
  }
  const serial = row.nextJobSerial
  const quality = outputQuality(state, row, recipe, currentMinute)
  row.queue.push({
    id: `${row.factoryId}:job:${serial}`,
    recipeId: recipe.id,
    queuedAtMinute: currentMinute,
    remainingMinutes: recipe.durationMinutes,
    quality,
  })
  row.nextJobSerial += 1
  const next = updateProductionState(state, production, {
    gold: state.gold - recipe.productionCost,
    stats: { ...state.stats, spent: state.stats.spent + recipe.productionCost },
  })
  return accepted(
    next,
    `${recipe.name} joined queue ${row.queue.length}/${resolution.factory.queueCapacity}; ${recipe.durationMinutes} game minutes remain.`,
  )
}

function collectFinishedGoods(
  state: GameState,
  production: Valley3DFactoryProductionStateV1,
  row: Valley3DFactoryProductionFactoryV1,
): FactoryProductionActionResult {
  if (row.finishedGoods.length === 0) return refused(state, 'Finished-goods storage is empty.')
  let inventory = state.inventory.map((entry) => ({ item: { ...entry.item }, count: entry.count }))
  const held: Valley3DFactoryFinishedGoodV1[] = []
  let collected = 0
  for (const lot of row.finishedGoods) {
    const item = itemRefFor(lot.productId, lot.quality)
    const fitState = { ...state, inventory }
    const fits = fitCount(fitState, item, lot.quantity)
    if (fits > 0) {
      const existing = inventory.find((entry) => sameItem(entry.item, item))
      if (existing === undefined) inventory.push({ item, count: fits })
      else existing.count += fits
      collected += fits
    }
    const remainder = lot.quantity - fits
    if (remainder > 0) held.push({ ...lot, quantity: remainder })
  }
  if (collected === 0) return refused(state, 'Collection refused: the canonical barn store has no room.')
  row.finishedGoods = held
  return accepted(
    updateProductionState(state, production, { inventory }),
    `Collected ${collected} finished units; ${held.reduce((sum, lot) => sum + lot.quantity, 0)} remain held.`,
  )
}

function shipFinishedGoods(
  state: GameState,
  production: Valley3DFactoryProductionStateV1,
  row: Valley3DFactoryProductionFactoryV1,
): FactoryProductionActionResult {
  if (row.finishedGoods.length === 0) return refused(state, 'Shipping refused: no finished goods are held.')
  let value = 0
  let units = 0
  for (const lot of row.finishedGoods) {
    const product = PRODUCT_BY_ID.get(lot.productId)
    if (product === undefined || product.economy.sellPrice <= 0) {
      return refused(state, `Shipping refused: ${lot.productId} has no canonical sell price.`)
    }
    value += product.economy.sellPrice * lot.quantity
    units += lot.quantity
    if (!Number.isSafeInteger(value) || state.gold + value > MAX_COUNT) {
      return refused(state, 'Shipping refused: canonical proceeds exceed the safe account limit.')
    }
  }
  row.finishedGoods = []
  return accepted(
    updateProductionState(state, production, {
      gold: state.gold + value,
      stats: { ...state.stats, earned: state.stats.earned + value },
    }),
    `Shipped ${units} finished units for ${value}g at exact registered sell prices.`,
  )
}

function serviceMessage(
  stationKind: StationKind,
  row: Valley3DFactoryProductionFactoryV1,
  resolution: FactoryProductionResolution,
): string {
  const stored = Object.values(row.storage).reduce((sum, quantity) => sum + quantity, 0)
  const finished = row.finishedGoods.reduce((sum, lot) => sum + lot.quantity, 0)
  switch (stationKind) {
    case 'storage':
      return `Raw storage holds ${stored} units across ${Object.keys(row.storage).length} canonical item types.`
    case 'preparation': {
      const ready = inspectedRecipe(row, resolution.recipes)
      return ready === undefined
        ? 'Preparation found no complete compatible staged batch.'
        : `${ready.name} has a complete staged batch ready for inspection and production.`
    }
    case 'quality-control':
      return `Quality control reports ${row.queue.length} queued jobs and ${finished} traceable finished units.`
    case 'packaging':
      return `${finished} finished units are packaged by product and persisted quality grade.`
    case 'waste':
      return `Waste station checked: ${stored} stored units remain isolated from finished goods.`
    case 'recycling':
      return `Recycling station checked; canonical recipe inputs are never rewritten into invented outputs.`
    case 'office':
      return `Office ledger: queue ${row.queue.length}/${resolution.factory.queueCapacity}, staff ${row.staffReadiness}, cleanliness ${row.cleanliness}%, maintenance ${row.maintenance}%.`
    case 'first-aid':
      return 'First-aid supplies are available; production state remains unchanged.'
    case 'safety':
      return `Safety check complete; maintenance is ${row.maintenance}% and blocked work remains fail-closed.`
    case 'restroom':
      return 'Use the accessible toilet fixture and full sanitation route before hygiene-sensitive production.'
    case 'handwashing':
      return 'Use running water, soap, rinse, and drying fixtures to complete the persistent hygiene route.'
    default:
      return `${stationKind} station is operational.`
  }
}

export function performFactoryStationAction(
  state: GameState,
  life: LifeSimulationState,
  factoryId: string,
  stationKind: StationKind,
  currentMinute: number,
  hygieneComplete: boolean,
  recipeId?: string,
): FactoryProductionActionResult {
  if (state.valley3d === undefined) return refused(state, 'Factory production is unavailable in this save.')
  const resolution = factoryProductionResolution(factoryId)
  if (resolution === null) return refused(state, `Unknown or incomplete factory ${factoryId}.`)
  if (!resolution.graph.stations.some((station) => station.kind === stationKind)) {
    return refused(state, `Factory station ${stationKind} is not catalogued in ${resolution.graphId}.`)
  }
  const minute = canonicalMinute(currentMinute)
  const advanced = advanceFactoryProduction(state, life, minute)
  if (advanced.valley3d === undefined) return refused(state, 'Factory production is unavailable in this save.')
  const production = cloneFactoryProductionState(advanced.valley3d.factoryProduction)
  const row = production.factories[factoryId]
  if (row === undefined) return refused(state, `Factory state ${factoryId} is missing.`)
  const recipe = recipeId === undefined ? undefined : RECIPE_BY_ID.get(recipeId)
  if (recipeId !== undefined && (recipe === undefined || !compatible(resolution.factory, recipe))) {
    return refused(advanced, `Recipe ${recipeId} is not compatible with ${resolution.factory.name}.`)
  }

  switch (stationKind) {
    case 'intake':
      return recipe === undefined
        ? refused(advanced, 'Choose a compatible recipe before staging intake.')
        : stageInputs(advanced, production, row, recipe)
    case 'inspection': {
      const inspected = inspectedRecipe(row, resolution.recipes)
      row.inspection = inspected === undefined ? 'failed' : 'passed'
      const next = updateProductionState(advanced, production)
      return inspected === undefined
        ? refused(next, 'Inspection failed: no complete compatible batch is staged.')
        : accepted(next, `${inspected.name} staged inputs passed inspection.`)
    }
    case 'staff-facilities':
      if (row.staffReadiness === 'npc-ready') {
        return accepted(advanced, 'An eligible on-shift NPC already has production readiness.')
      }
      row.staffReadiness = 'player-ready'
      return accepted(
        updateProductionState(advanced, production),
        'Player operating readiness recorded without changing NPC employment or schedules.',
      )
    case 'washing':
    case 'cleaning':
      row.cleanliness = 100
      return accepted(
        updateProductionState(advanced, production),
        `${stationKind === 'washing' ? 'Wash cycle' : 'Cleaning'} complete; cleanliness is 100%.`,
      )
    case 'maintenance':
      row.maintenance = 100
      return accepted(
        updateProductionState(advanced, production),
        'Maintenance complete; machine readiness is 100%.',
      )
    case 'production':
      return recipe === undefined
        ? refused(advanced, 'Choose a compatible recipe at the production console.')
        : enqueueRecipe(advanced, production, row, resolution, recipe, minute, hygieneComplete)
    case 'finished-goods-storage':
      return collectFinishedGoods(advanced, production, row)
    case 'shipping':
      return shipFinishedGoods(advanced, production, row)
    case 'storage':
    case 'preparation':
    case 'quality-control':
    case 'packaging':
    case 'waste':
    case 'recycling':
    case 'office':
    case 'first-aid':
    case 'safety':
    case 'restroom':
    case 'handwashing':
      return accepted(advanced, serviceMessage(stationKind, row, resolution))
    default:
      return refused(advanced, `Station ${stationKind} is not a factory-production operation.`)
  }
}

export function factoryProductionStatus(
  state: GameState,
  factoryId: string,
): FactoryProductionStatus {
  const resolution = factoryProductionResolution(factoryId)
  const row = state.valley3d?.factoryProduction.factories[factoryId]
  if (resolution === null || row === undefined) {
    return {
      summary: 'Factory production state unavailable.',
      detail: 'The factory, interior graph, recipes, or saved row did not resolve exactly.',
    }
  }
  const head = row.queue[0]
  const recipe = head === undefined ? undefined : RECIPE_BY_ID.get(head.recipeId)
  const stored = Object.values(row.storage).reduce((sum, quantity) => sum + quantity, 0)
  const finished = row.finishedGoods.reduce((sum, lot) => sum + lot.quantity, 0)
  const headText = head === undefined
    ? 'idle'
    : `${recipe?.name ?? head.recipeId}: ${head.remainingMinutes} min`
  return {
    summary: `Queue ${row.queue.length}/${resolution.factory.queueCapacity} · ${headText} · finished ${finished}.`,
    detail: `Storage ${stored} · staff ${row.staffReadiness} · cleanliness ${row.cleanliness}% · inspection ${row.inspection} · maintenance ${row.maintenance}%.`,
  }
}
