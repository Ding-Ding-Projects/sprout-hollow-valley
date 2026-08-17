import {
  canonicalizeContentSources,
  collectionPath,
  compareContentIds,
  contentFingerprint,
  flattenContentSources,
} from './deterministic'
import {
  createLocalizationCatalog,
  localizationEntries,
  missingLocalizationKeys,
} from './localization'
import {
  ALL_SEASONS,
  CONTENT_CATEGORY_ORDER,
  CONTENT_MINIMA,
  FACTORY_CAPABILITIES,
} from './types'
import type {
  AccessDef,
  BuildingDef,
  ContentCollectionKey,
  ContentCounts,
  ContentDefinition,
  ContentKind,
  ContentMinimums,
  ContentRegistry,
  ContentRegistrySources,
  ContentValidationCode,
  ContentValidationIssue,
  ContentValidationOptions,
  ContentValidationResult,
  DecorationDef,
  EconomyDef,
  FactoryDef,
  FootprintDef,
  LocalizationCatalog,
  ProductDef,
  RecipeDef,
  SanitationDef,
  StructureRoomDef,
  StructureStationDef,
  UnlockDef,
} from './types'
import {
  VALLEY_ANIMALS,
  VALLEY_CROPS,
  VALLEY_ORCHARD_PLANTS,
} from './valley-flora-fauna'
import {
  VALLEY_MATERIALS,
  VALLEY_PRODUCTS,
  VALLEY_RECIPES,
} from './valley-economy'
import {
  VALLEY_BUILDINGS,
  VALLEY_DECORATIONS,
  VALLEY_FACTORIES,
} from './valley-structures'

const CONTENT_ID_PATTERN = /^[a-z][a-z0-9-]*:[a-z0-9]+(?:-[a-z0-9]+)*$/
const LOCALIZATION_KEY_PATTERN = /^[a-z][a-z0-9]*(?:[.:-][a-z0-9]+)*$/
const PLACEHOLDER_PATTERN = /\b(?:dummy|lorem|placeholder|sample item|tbd|test item|todo|unnamed)\b/i
const GENERIC_NAME_PATTERN = /^(?:animal|building|crop|decoration|factory|material|orchard|product|recipe|tree)(?:[- _]?\d+)?$/i
const RESTROOM_PATTERN = /\b(?:hygiene|restroom|sanitation|toilet|washroom)\b/i

const COLLECTION_KIND: Readonly<Record<ContentCollectionKey, ContentKind>> = {
  crops: 'crop',
  orchardPlants: 'orchard',
  animals: 'animal',
  factories: 'factory',
  buildings: 'building',
  products: 'product',
  recipes: 'recipe',
  materials: 'material',
  decorations: 'decoration',
}

interface DefinitionRecord {
  readonly collection: ContentCollectionKey
  readonly definition: ContentDefinition
  readonly path: string
}

type AddIssue = (code: ContentValidationCode, path: string, message: string) => void

export interface CreateContentRegistryOptions extends ContentValidationOptions {
  readonly localization?: LocalizationCatalog
  /** Kept for focused negative fixtures; production construction always validates. */
  readonly validate?: boolean
}

export class ContentValidationError extends Error {
  readonly result: ContentValidationResult

  constructor(result: ContentValidationResult) {
    const preview = result.issues.slice(0, 8).map((issue) => `${issue.path}: ${issue.message}`).join('; ')
    const remainder = result.issues.length > 8 ? `; plus ${result.issues.length - 8} more` : ''
    super(`Sprout Hollow Valley content validation failed (${result.issues.length} issues): ${preview}${remainder}`)
    this.name = 'ContentValidationError'
    this.result = result
  }
}

function freezeSources(sources: ContentRegistrySources): ContentRegistrySources {
  return Object.freeze({
    crops: Object.freeze([...sources.crops]),
    orchardPlants: Object.freeze([...sources.orchardPlants]),
    animals: Object.freeze([...sources.animals]),
    factories: Object.freeze([...sources.factories]),
    buildings: Object.freeze([...sources.buildings]),
    products: Object.freeze([...sources.products]),
    recipes: Object.freeze([...sources.recipes]),
    materials: Object.freeze([...sources.materials]),
    decorations: Object.freeze([...sources.decorations]),
  })
}

function countContent(sources: ContentRegistrySources): ContentCounts {
  return Object.freeze({
    crops: sources.crops.length,
    orchardPlants: sources.orchardPlants.length,
    animals: sources.animals.length,
    factories: sources.factories.length,
    buildings: sources.buildings.length,
    products: sources.products.length,
    recipes: sources.recipes.length,
    materials: sources.materials.length,
    decorations: sources.decorations.length,
  })
}

function validationOptions(options: CreateContentRegistryOptions): ContentValidationOptions {
  return {
    countMode: options.countMode,
    minima: options.minima,
    requiredLocales: options.requiredLocales,
    requireCanonicalOrder: options.requireCanonicalOrder,
  }
}

export function createContentRegistry(
  sources: ContentRegistrySources,
  options: CreateContentRegistryOptions = {},
): ContentRegistry {
  const canonical = freezeSources(canonicalizeContentSources(sources))
  const definitions = Object.freeze([...flattenContentSources(canonical)])
  const byId = new Map<string, ContentDefinition>()
  for (const definition of definitions) byId.set(definition.id, definition)
  const counts = countContent(canonical)
  const registry: ContentRegistry = Object.freeze({
    ...canonical,
    definitions,
    byId,
    counts,
    total: definitions.length,
    fingerprint: contentFingerprint(canonical),
    localization: createLocalizationCatalog(definitions, options.localization),
  })

  if (options.validate !== false) assertContentRegistry(registry, validationOptions(options))
  return registry
}

function recordsFor(registry: ContentRegistry): readonly DefinitionRecord[] {
  const records: DefinitionRecord[] = []
  for (const collection of CONTENT_CATEGORY_ORDER) {
    registry[collection].forEach((definition, index) => {
      records.push({ collection, definition, path: collectionPath(collection, index) })
    })
  }
  return records
}

function expectedMinima(options: ContentValidationOptions): ContentMinimums {
  return Object.freeze({ ...CONTENT_MINIMA, ...(options.minima ?? {}) })
}

function isFiniteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

function isSubstantiveText(value: string, minimumLength = 3): boolean {
  const normalized = value.trim()
  return normalized.length >= minimumLength && /[A-Za-z]/.test(normalized) && !PLACEHOLDER_PATTERN.test(normalized)
}

function validateUniqueStrings(values: readonly string[], path: string, add: AddIssue): void {
  const seen = new Set<string>()
  values.forEach((value, index) => {
    const itemPath = `${path}[${index}]`
    if (!isSubstantiveText(value, 2)) add('invalid-category-data', itemPath, 'must be a substantive authored value')
    const normalized = value.trim().toLowerCase()
    if (seen.has(normalized)) add('invalid-category-data', itemPath, `duplicates "${value}" in the same list`)
    seen.add(normalized)
  })
}

function validateUnlock(
  unlock: UnlockDef,
  definition: ContentDefinition,
  path: string,
  known: ReadonlyMap<string, ContentDefinition>,
  add: AddIssue,
): void {
  if (!Number.isInteger(unlock.level) || unlock.level < 1 || unlock.level > 100) {
    add('invalid-unlock', `${path}.level`, 'level must be an integer from 1 through 100')
  }
  if (!Number.isInteger(unlock.reputation) || unlock.reputation < 0 || unlock.reputation > 1000) {
    add('invalid-unlock', `${path}.reputation`, 'reputation must be an integer from 0 through 1000')
  }
  if (unlock.regionId !== null && !isSubstantiveText(unlock.regionId, 3)) {
    add('invalid-unlock', `${path}.regionId`, 'regionId must be null or an authored region identifier')
  }
  if (unlock.questId !== null && !isSubstantiveText(unlock.questId, 3)) {
    add('invalid-unlock', `${path}.questId`, 'questId must be null or an authored quest identifier')
  }
  validateUniqueStrings(unlock.prerequisiteIds, `${path}.prerequisiteIds`, add)
  for (const [index, prerequisiteId] of unlock.prerequisiteIds.entries()) {
    const prerequisitePath = `${path}.prerequisiteIds[${index}]`
    const prerequisite = known.get(prerequisiteId)
    if (!prerequisite) {
      add('unknown-prerequisite', prerequisitePath, `references unknown content "${prerequisiteId}"`)
    } else if (prerequisite.id === definition.id) {
      add('invalid-unlock', prerequisitePath, 'a definition cannot require itself')
    } else if (prerequisite.unlock.level > unlock.level) {
      add('invalid-unlock', prerequisitePath, `requires level-${prerequisite.unlock.level} content above its own level ${unlock.level}`)
    }
  }
}

function validateEconomy(economy: EconomyDef, definition: ContentDefinition, path: string, add: AddIssue): void {
  const values: ReadonlyArray<readonly [string, number]> = [
    ['purchasePrice', economy.purchasePrice],
    ['sellPrice', economy.sellPrice],
    ['craftValue', economy.craftValue],
    ['maintenancePerDay', economy.maintenancePerDay],
  ]
  for (const [key, value] of values) {
    if (!isFiniteNonNegative(value)) add('invalid-economy', `${path}.${key}`, 'must be a finite non-negative number')
  }
  if (values.every(([, value]) => value === 0)) {
    add('invalid-economy', path, 'must define at least one positive economic value')
  }
  if (!Number.isFinite(economy.marketElasticity) || economy.marketElasticity < 0 || economy.marketElasticity > 2) {
    add('invalid-economy', `${path}.marketElasticity`, 'must be between 0 and 2')
  }
  for (const season of ALL_SEASONS) {
    const demand = economy.seasonalDemand[season]
    if (!Number.isFinite(demand) || demand < 0.25 || demand > 4) {
      add('invalid-economy', `${path}.seasonalDemand.${season}`, 'must be between 0.25 and 4')
    }
  }

  if ((definition.kind === 'crop' || definition.kind === 'orchard' || definition.kind === 'animal') && economy.purchasePrice <= 0) {
    add('invalid-economy', `${path}.purchasePrice`, `${definition.kind} definitions require a positive acquisition price`)
  }
  if (definition.kind === 'product' && economy.sellPrice <= 0) {
    add('invalid-economy', `${path}.sellPrice`, 'sellable products require a positive sale price')
  }
  if (definition.kind === 'material' && economy.craftValue <= 0) {
    add('invalid-economy', `${path}.craftValue`, 'materials require a positive crafting value')
  }
  if ((definition.kind === 'factory' || definition.kind === 'building' || definition.kind === 'decoration') && economy.purchasePrice <= 0) {
    add('invalid-economy', `${path}.purchasePrice`, `${definition.kind} definitions require a positive purchase price`)
  }
  if (
    (definition.kind === 'factory' || definition.kind === 'building' || definition.kind === 'decoration') &&
    economy.sellPrice > economy.purchasePrice
  ) {
    add('invalid-economy', `${path}.sellPrice`, 'resale value cannot exceed purchase price')
  }
}

function validateCommon(
  record: DefinitionRecord,
  known: ReadonlyMap<string, ContentDefinition>,
  add: AddIssue,
): void {
  const { definition, path, collection } = record
  if (definition.kind !== COLLECTION_KIND[collection]) {
    add('invalid-kind', `${path}.kind`, `expected "${COLLECTION_KIND[collection]}" for collection ${collection}`)
  }
  if (!CONTENT_ID_PATTERN.test(definition.id)) {
    add('invalid-id', `${path}.id`, 'must be a lowercase namespaced stable ID')
  } else if (definition.id.slice(0, definition.id.indexOf(':')) !== definition.kind) {
    add('invalid-id', `${path}.id`, `ID namespace must match kind "${definition.kind}"`)
  }

  const name = definition.name.trim()
  if (!isSubstantiveText(name, 3) || name.length > 96) {
    add('invalid-name', `${path}.name`, 'must be an authored display name from 3 through 96 characters')
  }
  if (PLACEHOLDER_PATTERN.test(name) || GENERIC_NAME_PATTERN.test(name)) {
    add('placeholder-name', `${path}.name`, 'generic or placeholder catalogue names are forbidden')
  }
  const description = definition.description.trim()
  if (!isSubstantiveText(description, 32) || description.split(/\s+/).length < 5) {
    add('invalid-description', `${path}.description`, 'must be an authored explanatory sentence of at least five words')
  }
  if (description.toLowerCase() === name.toLowerCase()) {
    add('invalid-description', `${path}.description`, 'must explain the definition rather than repeat its name')
  }

  if (!LOCALIZATION_KEY_PATTERN.test(definition.nameKey) || !definition.nameKey.endsWith('.name')) {
    add('missing-localization', `${path}.nameKey`, 'must be a stable localization key ending in .name')
  }
  if (!LOCALIZATION_KEY_PATTERN.test(definition.descriptionKey) || !definition.descriptionKey.endsWith('.description')) {
    add('missing-localization', `${path}.descriptionKey`, 'must be a stable localization key ending in .description')
  }

  if (definition.seasons.length === 0) add('invalid-season', `${path}.seasons`, 'must name at least one active season')
  const seasons = new Set<string>()
  definition.seasons.forEach((season, index) => {
    if (!ALL_SEASONS.includes(season)) add('invalid-season', `${path}.seasons[${index}]`, `unknown season "${season}"`)
    if (seasons.has(season)) add('invalid-season', `${path}.seasons[${index}]`, `duplicates season "${season}"`)
    seasons.add(season)
  })

  if (definition.regions.length === 0) add('invalid-category-data', `${path}.regions`, 'must name at least one authored region')
  validateUniqueStrings(definition.regions, `${path}.regions`, add)
  if (definition.tags.length === 0) add('invalid-category-data', `${path}.tags`, 'must include searchable taxonomy tags')
  validateUniqueStrings(definition.tags, `${path}.tags`, add)
  validateUnlock(definition.unlock, definition, `${path}.unlock`, known, add)
  validateEconomy(definition.economy, definition, `${path}.economy`, add)
}

function validateKnownReference(
  id: string,
  path: string,
  allowedKinds: readonly ContentKind[],
  known: ReadonlyMap<string, ContentDefinition>,
  add: AddIssue,
): ContentDefinition | undefined {
  const referenced = known.get(id)
  if (!referenced) {
    add('unknown-reference', path, `references unknown content "${id}"`)
    return undefined
  }
  if (!allowedKinds.includes(referenced.kind)) {
    add('reference-kind-mismatch', path, `references ${referenced.kind} "${id}", expected ${allowedKinds.join(' or ')}`)
  }
  return referenced
}

function validateProductYield(
  ownerId: string,
  productId: string,
  min: number,
  max: number,
  path: string,
  products: ReadonlyMap<string, ProductDef>,
  known: ReadonlyMap<string, ContentDefinition>,
  add: AddIssue,
): void {
  if (!isPositiveInteger(min) || !isPositiveInteger(max) || max < min) {
    add('invalid-category-data', path, 'yield bounds must be positive integers with max at least min')
  }
  validateKnownReference(productId, `${path}.productId`, ['product'], known, add)
  const product = products.get(productId)
  if (product && !product.sourceIds.includes(ownerId)) {
    add('reference-kind-mismatch', `${path}.productId`, `product "${productId}" does not reciprocally name source "${ownerId}"`)
  }
}

function validateFloraAndAnimals(
  registry: ContentRegistry,
  known: ReadonlyMap<string, ContentDefinition>,
  products: ReadonlyMap<string, ProductDef>,
  add: AddIssue,
): void {
  registry.crops.forEach((crop, index) => {
    const path = collectionPath('crops', index)
    if (!isSubstantiveText(crop.cultivar, 3)) add('invalid-category-data', `${path}.cultivar`, 'must name an authored cultivar')
    if (!isPositiveInteger(crop.growthDays) || crop.growthDays > 112) add('invalid-category-data', `${path}.growthDays`, 'must be from 1 through 112 days')
    if (crop.regrowDays !== null && (!isPositiveInteger(crop.regrowDays) || crop.regrowDays > 28)) {
      add('invalid-category-data', `${path}.regrowDays`, 'must be null or from 1 through 28 days')
    }
    if (crop.soilAffinity.length === 0) add('invalid-category-data', `${path}.soilAffinity`, 'must include at least one soil affinity')
    validateProductYield(crop.id, crop.yield.productId, crop.yield.min, crop.yield.max, `${path}.yield`, products, known, add)
  })

  registry.orchardPlants.forEach((plant, index) => {
    const path = collectionPath('orchardPlants', index)
    if (!isSubstantiveText(plant.plantFamily, 3)) add('invalid-category-data', `${path}.plantFamily`, 'must name an authored plant family')
    if (!isSubstantiveText(plant.cultivar, 3)) add('invalid-category-data', `${path}.cultivar`, 'must name an authored cultivar')
    if (!isPositiveInteger(plant.maturityDays) || plant.maturityDays > 336) add('invalid-category-data', `${path}.maturityDays`, 'must be from 1 through 336 days')
    if (!isPositiveInteger(plant.harvestIntervalDays) || plant.harvestIntervalDays > 28) {
      add('invalid-category-data', `${path}.harvestIntervalDays`, 'must be from 1 through 28 days')
    }
    if (!Number.isFinite(plant.canopySize) || plant.canopySize <= 0 || plant.canopySize > 32) {
      add('invalid-category-data', `${path}.canopySize`, 'must be greater than 0 and no more than 32')
    }
    const dormant = new Set<string>()
    plant.dormantSeasons.forEach((season, seasonIndex) => {
      if (!ALL_SEASONS.includes(season)) add('invalid-season', `${path}.dormantSeasons[${seasonIndex}]`, `unknown season "${season}"`)
      if (dormant.has(season)) add('invalid-season', `${path}.dormantSeasons[${seasonIndex}]`, `duplicates season "${season}"`)
      if (plant.seasons.includes(season)) add('invalid-season', `${path}.dormantSeasons[${seasonIndex}]`, 'cannot also be an active season')
      dormant.add(season)
    })
    validateProductYield(plant.id, plant.yield.productId, plant.yield.min, plant.yield.max, `${path}.yield`, products, known, add)
  })

  registry.animals.forEach((animal, index) => {
    const path = collectionPath('animals', index)
    if (!isSubstantiveText(animal.speciesGroup, 3)) add('invalid-category-data', `${path}.speciesGroup`, 'must name an authored species group')
    if (!isSubstantiveText(animal.breed, 3)) add('invalid-category-data', `${path}.breed`, 'must name an authored breed or species')
    if (animal.housing.length === 0) add('invalid-category-data', `${path}.housing`, 'must provide at least one housing type')
    if (animal.diet.length === 0) add('invalid-category-data', `${path}.diet`, 'must provide at least one diet type')
    if (!isPositiveInteger(animal.maturityDays) || animal.maturityDays > 1120) add('invalid-category-data', `${path}.maturityDays`, 'must be from 1 through 1120 days')
    if (!isPositiveInteger(animal.lifespanYears) || animal.lifespanYears > 200) add('invalid-category-data', `${path}.lifespanYears`, 'must be from 1 through 200 years')
    if (animal.products.length === 0) add('invalid-category-data', `${path}.products`, 'must define at least one useful animal product')
    animal.products.forEach((product, productIndex) => {
      const productPath = `${path}.products[${productIndex}]`
      validateProductYield(animal.id, product.productId, product.min, product.max, productPath, products, known, add)
      if (!isPositiveInteger(product.intervalDays) || product.intervalDays > 112) {
        add('invalid-category-data', `${productPath}.intervalDays`, 'must be from 1 through 112 days')
      }
    })
  })
}

function productSourceKinds(product: ProductDef): readonly ContentKind[] {
  switch (product.sourceKind) {
    case 'animal': return ['animal']
    case 'crop': return ['crop']
    case 'forage': return ['material']
    case 'material': return ['material']
    case 'orchard': return ['orchard']
    case 'recipe': return ['recipe']
  }
}

function validateMaterialsAndProducts(
  registry: ContentRegistry,
  known: ReadonlyMap<string, ContentDefinition>,
  add: AddIssue,
): void {
  registry.materials.forEach((material, index) => {
    const path = collectionPath('materials', index)
    if (material.sourceKinds.length === 0) add('invalid-category-data', `${path}.sourceKinds`, 'must define at least one acquisition source')
    if (material.qualityGrades.length === 0) add('invalid-category-data', `${path}.qualityGrades`, 'must define at least one quality grade')
    if (!isPositiveInteger(material.stackLimit) || material.stackLimit > 9999) add('invalid-category-data', `${path}.stackLimit`, 'must be from 1 through 9999')
    if (!Number.isFinite(material.weight) || material.weight <= 0 || material.weight > 10000) add('invalid-category-data', `${path}.weight`, 'must be greater than 0 and no more than 10000')
  })

  registry.products.forEach((product, index) => {
    const path = collectionPath('products', index)
    if (product.sourceIds.length === 0) add('invalid-category-data', `${path}.sourceIds`, 'must identify at least one real source definition')
    validateUniqueStrings(product.sourceIds, `${path}.sourceIds`, add)
    product.sourceIds.forEach((sourceId, sourceIndex) => {
      validateKnownReference(sourceId, `${path}.sourceIds[${sourceIndex}]`, productSourceKinds(product), known, add)
    })
    if (product.perishableDays !== null && (!isPositiveInteger(product.perishableDays) || product.perishableDays > 1120)) {
      add('invalid-category-data', `${path}.perishableDays`, 'must be null or from 1 through 1120 days')
    }
    if (product.qualityGrades.length === 0) add('invalid-category-data', `${path}.qualityGrades`, 'must define at least one quality grade')
    if (product.sellingChannels.length === 0) add('invalid-category-data', `${path}.sellingChannels`, 'must define at least one selling channel')
  })
}

function validateItemQuantities(
  values: readonly { readonly itemId: string; readonly quantity: number }[],
  path: string,
  allowedKinds: readonly ContentKind[],
  known: ReadonlyMap<string, ContentDefinition>,
  add: AddIssue,
): void {
  const seen = new Set<string>()
  values.forEach((value, index) => {
    const itemPath = `${path}[${index}]`
    if (!isPositiveInteger(value.quantity)) add('invalid-recipe', `${itemPath}.quantity`, 'must be a positive integer')
    if (seen.has(value.itemId)) add('invalid-recipe', `${itemPath}.itemId`, `duplicates item "${value.itemId}" in this list`)
    seen.add(value.itemId)
    validateKnownReference(value.itemId, `${itemPath}.itemId`, allowedKinds, known, add)
  })
}

function validateRecipes(
  registry: ContentRegistry,
  known: ReadonlyMap<string, ContentDefinition>,
  products: ReadonlyMap<string, ProductDef>,
  add: AddIssue,
): ReadonlyMap<string, number> {
  const capabilityUse = new Map<string, number>()
  const knownCapabilities = new Set<string>(FACTORY_CAPABILITIES)
  registry.recipes.forEach((recipe, index) => {
    const path = collectionPath('recipes', index)
    if (!isSubstantiveText(recipe.recipeCategory, 3)) add('invalid-recipe', `${path}.recipeCategory`, 'must name an authored production family')
    if (!isPositiveInteger(recipe.durationMinutes) || recipe.durationMinutes > 40320) add('invalid-recipe', `${path}.durationMinutes`, 'must be from 1 minute through 28 days')
    if (!isFiniteNonNegative(recipe.productionCost)) add('invalid-recipe', `${path}.productionCost`, 'must be finite and non-negative')
    if (recipe.inputs.length === 0) add('invalid-recipe', `${path}.inputs`, 'must consume at least one material or product')
    if (recipe.outputs.length === 0) add('invalid-recipe', `${path}.outputs`, 'must create at least one product')
    validateItemQuantities(recipe.inputs, `${path}.inputs`, ['material', 'product'], known, add)
    validateItemQuantities(recipe.outputs, `${path}.outputs`, ['product'], known, add)
    const inputIds = new Set(recipe.inputs.map((input) => input.itemId))
    recipe.outputs.forEach((output, outputIndex) => {
      if (inputIds.has(output.itemId)) add('invalid-recipe', `${path}.outputs[${outputIndex}].itemId`, 'cannot also be an unchanged input')
      const product = products.get(output.itemId)
      if (product && (product.sourceKind !== 'recipe' || !product.sourceIds.includes(recipe.id))) {
        add('reference-kind-mismatch', `${path}.outputs[${outputIndex}].itemId`, `product "${product.id}" does not reciprocally name recipe source "${recipe.id}"`)
      }
    })
    if (recipe.factoryCapabilities.length === 0) add('missing-factory-capability', `${path}.factoryCapabilities`, 'must require at least one production capability')
    const seenCapabilities = new Set<string>()
    recipe.factoryCapabilities.forEach((capability, capabilityIndex) => {
      const capabilityPath = `${path}.factoryCapabilities[${capabilityIndex}]`
      if (!knownCapabilities.has(capability)) add('missing-factory-capability', capabilityPath, `unknown factory capability "${capability}"`)
      if (seenCapabilities.has(capability)) add('invalid-recipe', capabilityPath, `duplicates capability "${capability}"`)
      seenCapabilities.add(capability)
      capabilityUse.set(capability, (capabilityUse.get(capability) ?? 0) + 1)
    })
  })
  return capabilityUse
}

function validateFootprint(footprint: FootprintDef, path: string, add: AddIssue): void {
  if (!isPositiveInteger(footprint.width) || footprint.width > 128) add('invalid-structure', `${path}.width`, 'must be from 1 through 128')
  if (!isPositiveInteger(footprint.depth) || footprint.depth > 128) add('invalid-structure', `${path}.depth`, 'must be from 1 through 128')
  if (!Number.isInteger(footprint.clearance) || footprint.clearance < 0 || footprint.clearance > 32) add('invalid-structure', `${path}.clearance`, 'must be an integer from 0 through 32')
}

function validateAccess(access: AccessDef, path: string, add: AddIssue): void {
  if (!isPositiveInteger(access.entranceCount)) add('invalid-structure', `${path}.entranceCount`, 'must provide at least one usable entrance')
  if (!access.accessibleEntrance) add('invalid-structure', `${path}.accessibleEntrance`, 'must provide an accessible entrance')
  if (!Number.isInteger(access.openingHour) || access.openingHour < 0 || access.openingHour > 23) add('invalid-structure', `${path}.openingHour`, 'must be an hour from 0 through 23')
  if (!Number.isInteger(access.closingHour) || access.closingHour < 1 || access.closingHour > 24) add('invalid-structure', `${path}.closingHour`, 'must be an hour from 1 through 24')
  if (access.openingHour === access.closingHour) add('invalid-structure', path, 'opening and closing hours cannot be identical')
  if (access.lockReason !== null && !isSubstantiveText(access.lockReason, 12)) add('invalid-structure', `${path}.lockReason`, 'must plainly explain the authored lock')
  if (!isSubstantiveText(access.eventualAccess, 16)) add('invalid-structure', `${path}.eventualAccess`, 'must state a real eventual access route')
}

function validateSanitation(sanitation: SanitationDef, path: string, add: AddIssue): void {
  const required: ReadonlyArray<readonly [keyof SanitationDef, number]> = [
    ['toilets', sanitation.toilets],
    ['accessibleToilets', sanitation.accessibleToilets],
    ['sinks', sanitation.sinks],
    ['soapStations', sanitation.soapStations],
    ['dryingStations', sanitation.dryingStations],
    ['wasteBins', sanitation.wasteBins],
    ['mirrors', sanitation.mirrors],
    ['privacyDoors', sanitation.privacyDoors],
    ['handWashStations', sanitation.handWashStations],
  ]
  for (const [key, value] of required) {
    if (!isPositiveInteger(value)) add('invalid-sanitation', `${path}.${key}`, 'must be a positive integer')
  }
  if (sanitation.accessibleToilets > sanitation.toilets) add('invalid-sanitation', `${path}.accessibleToilets`, 'cannot exceed the total toilet count')
  if (sanitation.handWashStations > sanitation.sinks) add('invalid-sanitation', `${path}.handWashStations`, 'cannot exceed the sink count')
}

function validateRooms(rooms: readonly StructureRoomDef[], path: string, add: AddIssue): void {
  if (rooms.length < 2) add('invalid-structure', path, 'must provide multiple purposeful rooms, including sanitation')
  const ids = new Set<string>()
  rooms.forEach((room, index) => {
    const roomPath = `${path}[${index}]`
    if (!isSubstantiveText(room.id, 3)) add('invalid-structure', `${roomPath}.id`, 'must be an authored stable room ID')
    if (ids.has(room.id)) add('invalid-structure', `${roomPath}.id`, `duplicates room "${room.id}"`)
    ids.add(room.id)
    if (!isSubstantiveText(room.name, 3)) add('invalid-structure', `${roomPath}.name`, 'must be an authored room name')
    if (!isSubstantiveText(room.purpose, 16)) add('invalid-structure', `${roomPath}.purpose`, 'must state a real gameplay or simulation purpose')
    if (!Number.isInteger(room.floor) || room.floor < -8 || room.floor > 128) add('invalid-structure', `${roomPath}.floor`, 'must be an integer floor from -8 through 128')
    if (!isPositiveInteger(room.capacity)) add('invalid-structure', `${roomPath}.capacity`, 'must be a positive integer')
  })
  if (!rooms.some((room) => RESTROOM_PATTERN.test(`${room.name} ${room.purpose}`))) {
    add('invalid-sanitation', path, 'must include a named restroom or sanitation room')
  }
}

function validateStations(
  stations: readonly StructureStationDef[],
  capabilities: readonly string[],
  path: string,
  known: ReadonlyMap<string, ContentDefinition>,
  add: AddIssue,
): void {
  if (stations.length === 0) add('invalid-structure', path, 'must provide functional stations')
  const ids = new Set<string>()
  stations.forEach((station, index) => {
    const stationPath = `${path}[${index}]`
    if (!isSubstantiveText(station.id, 3)) add('invalid-structure', `${stationPath}.id`, 'must be an authored stable station ID')
    if (ids.has(station.id)) add('invalid-structure', `${stationPath}.id`, `duplicates station "${station.id}"`)
    ids.add(station.id)
    if (!isSubstantiveText(station.name, 3)) add('invalid-structure', `${stationPath}.name`, 'must be an authored station name')
    if (!isSubstantiveText(station.interaction, 16)) add('invalid-structure', `${stationPath}.interaction`, 'must state a real player or NPC interaction')
    if (!isSubstantiveText(station.assignedNpcRole, 3)) add('invalid-structure', `${stationPath}.assignedNpcRole`, 'must assign an authored NPC role')
    station.inputItemIds.forEach((itemId, itemIndex) => validateKnownReference(itemId, `${stationPath}.inputItemIds[${itemIndex}]`, ['material', 'product'], known, add))
    station.outputItemIds.forEach((itemId, itemIndex) => validateKnownReference(itemId, `${stationPath}.outputItemIds[${itemIndex}]`, ['material', 'product'], known, add))
  })
  if (!stations.some((station) => station.capability === 'capability:sanitation')) {
    add('invalid-sanitation', path, 'must include a functional sanitation station')
  }
  if (!stations.some((station) => capabilities.includes(station.capability))) {
    add('invalid-structure', path, 'must expose at least one station matching a declared structure capability')
  }
}

function validateStructure(
  structure: FactoryDef | BuildingDef,
  path: string,
  known: ReadonlyMap<string, ContentDefinition>,
  add: AddIssue,
): void {
  validateFootprint(structure.footprint, `${path}.footprint`, add)
  validateAccess(structure.access, `${path}.access`, add)
  validateSanitation(structure.sanitation, `${path}.sanitation`, add)
  validateRooms(structure.rooms, `${path}.rooms`, add)
  validateStations(structure.stations, structure.capabilities, `${path}.stations`, known, add)
  if (structure.capabilities.length === 0) add('invalid-structure', `${path}.capabilities`, 'must declare functional capabilities')
  validateUniqueStrings(structure.capabilities, `${path}.capabilities`, add)
}

function validateStructures(
  registry: ContentRegistry,
  known: ReadonlyMap<string, ContentDefinition>,
  capabilityUse: ReadonlyMap<string, number>,
  add: AddIssue,
): void {
  const validFactoryCapabilities = new Set<string>(FACTORY_CAPABILITIES)
  registry.factories.forEach((factory, index) => {
    const path = collectionPath('factories', index)
    validateStructure(factory, path, known, add)
    if (!isSubstantiveText(factory.factoryType, 3)) add('invalid-structure', `${path}.factoryType`, 'must name an authored production-facility type')
    if (!isPositiveInteger(factory.queueCapacity)) add('invalid-structure', `${path}.queueCapacity`, 'must be a positive integer')
    if (!isPositiveInteger(factory.staffCapacity)) add('invalid-structure', `${path}.staffCapacity`, 'must be a positive integer')
    factory.capabilities.forEach((capability, capabilityIndex) => {
      const capabilityPath = `${path}.capabilities[${capabilityIndex}]`
      if (!validFactoryCapabilities.has(capability)) add('missing-factory-capability', capabilityPath, `unknown factory capability "${capability}"`)
      if ((capabilityUse.get(capability) ?? 0) === 0) add('missing-factory-capability', capabilityPath, `no recipe uses capability "${capability}"`)
    })
  })

  const installedCapabilities = new Set(registry.factories.flatMap((factory) => factory.capabilities))
  for (const [capability, uses] of capabilityUse) {
    if (uses > 0 && !installedCapabilities.has(capability as FactoryDef['capabilities'][number])) {
      add('missing-factory-capability', 'factories', `recipes require uninstalled capability "${capability}"`)
    }
  }

  registry.buildings.forEach((building, index) => {
    const path = collectionPath('buildings', index)
    validateStructure(building, path, known, add)
    if (!isSubstantiveText(building.serviceCategory, 3)) add('invalid-structure', `${path}.serviceCategory`, 'must name an authored service category')
    const capacities = [building.occupantCapacity, building.visitorCapacity, building.storageCapacity]
    capacities.forEach((capacity, capacityIndex) => {
      if (!Number.isInteger(capacity) || capacity < 0) add('invalid-structure', `${path}.${['occupantCapacity', 'visitorCapacity', 'storageCapacity'][capacityIndex]}`, 'must be a non-negative integer')
    })
    if (capacities.every((capacity) => capacity === 0)) add('invalid-structure', path, 'must provide occupancy, visitor service, or storage capacity')
  })
}

function validateDecoration(decoration: DecorationDef, path: string, add: AddIssue): void {
  validateFootprint(decoration.footprint, `${path}.footprint`, add)
  if (decoration.placement.surfaces.length === 0) add('invalid-decoration-function', `${path}.placement.surfaces`, 'must name at least one placement surface')
  const functionality = decoration.functionality
  if (functionality.capabilities.length === 0) add('invalid-decoration-function', `${path}.functionality.capabilities`, 'must provide at least one real function')
  validateUniqueStrings(functionality.capabilities, `${path}.functionality.capabilities`, add)
  const numbers: ReadonlyArray<readonly [string, number]> = [
    ['lightRadius', functionality.lightRadius],
    ['seats', functionality.seats],
    ['storageSlots', functionality.storageSlots],
    ['pathSpeedMultiplier', functionality.pathSpeedMultiplier],
    ['barrierStrength', functionality.barrierStrength],
  ]
  for (const [key, value] of numbers) {
    if (!isFiniteNonNegative(value)) add('invalid-decoration-function', `${path}.functionality.${key}`, 'must be finite and non-negative')
  }
  const capabilities = new Set(functionality.capabilities)
  if (capabilities.has('lighting') && functionality.lightRadius <= 0) add('invalid-decoration-function', `${path}.functionality.lightRadius`, 'lighting requires a positive radius')
  if (capabilities.has('seating') && functionality.seats <= 0) add('invalid-decoration-function', `${path}.functionality.seats`, 'seating requires at least one seat')
  if (capabilities.has('storage') && functionality.storageSlots <= 0) add('invalid-decoration-function', `${path}.functionality.storageSlots`, 'storage requires at least one slot')
  if (capabilities.has('navigation') && functionality.pathSpeedMultiplier < 1) add('invalid-decoration-function', `${path}.functionality.pathSpeedMultiplier`, 'navigation cannot slow below 1')
  if (capabilities.has('barrier') && functionality.barrierStrength <= 0) add('invalid-decoration-function', `${path}.functionality.barrierStrength`, 'barriers require positive strength')
  if (capabilities.has('signage') && (functionality.signTopic === null || !isSubstantiveText(functionality.signTopic, 3))) {
    add('invalid-decoration-function', `${path}.functionality.signTopic`, 'signage requires an authored topic')
  }
  if (capabilities.has('connectivity') && !decoration.placement.connectable) add('invalid-decoration-function', `${path}.placement.connectable`, 'connectivity requires connectable placement')
  const requiredByType: Partial<Record<DecorationDef['decorationType'], DecorationDef['functionality']['capabilities'][number]>> = {
    fence: 'barrier',
    light: 'lighting',
    path: 'navigation',
    sign: 'signage',
  }
  const required = requiredByType[decoration.decorationType]
  if (required && !capabilities.has(required)) add('invalid-decoration-function', `${path}.functionality.capabilities`, `${decoration.decorationType} requires ${required}`)
}

function validateDecorations(registry: ContentRegistry, add: AddIssue): void {
  registry.decorations.forEach((decoration, index) => validateDecoration(decoration, collectionPath('decorations', index), add))
}

function validateLocalization(registry: ContentRegistry, options: ContentValidationOptions, add: AddIssue): void {
  const keyOwners = new Map<string, string>()
  for (const entry of localizationEntries(registry.definitions)) {
    if (!LOCALIZATION_KEY_PATTERN.test(entry.key)) add('missing-localization', entry.path, `invalid localization key "${entry.key}"`)
    const owner = keyOwners.get(entry.key)
    if (owner) add('duplicate-localization-key', entry.path, `localization key "${entry.key}" is already owned by ${owner}`)
    else keyOwners.set(entry.key, entry.path)
  }
  for (const locale of options.requiredLocales ?? ['en']) {
    for (const key of missingLocalizationKeys(registry.localization, locale, registry.definitions)) {
      add('missing-localization', `localization.${locale}.${key}`, `required locale ${locale} has no substantive value`)
    }
  }
}

function validateCanonicalState(registry: ContentRegistry, options: ContentValidationOptions, add: AddIssue): void {
  if (options.requireCanonicalOrder !== false) {
    for (const collection of CONTENT_CATEGORY_ORDER) {
      const values = registry[collection]
      for (let index = 1; index < values.length; index++) {
        const previous = values[index - 1]
        const current = values[index]
        if (previous && current && compareContentIds(previous.id, current.id) > 0) {
          add('nondeterministic-order', `${collection}[${index}]`, `"${current.id}" sorts before preceding "${previous.id}"`)
        }
      }
    }
  }
  const expectedDefinitions = flattenContentSources(registry)
  if (
    expectedDefinitions.length !== registry.definitions.length ||
    expectedDefinitions.some((definition, index) => registry.definitions[index] !== definition)
  ) {
    add('nondeterministic-order', 'definitions', 'must be the canonical collection-order flattening')
  }
  const expectedFingerprint = contentFingerprint(registry)
  if (registry.fingerprint !== expectedFingerprint) {
    add('nondeterministic-order', 'fingerprint', `expected ${expectedFingerprint}, received ${registry.fingerprint}`)
  }
}

export function validateContentRegistry(
  registry: ContentRegistry,
  options: ContentValidationOptions = {},
): ContentValidationResult {
  const issues: ContentValidationIssue[] = []
  const add: AddIssue = (code, path, message) => issues.push({ code, path, message })
  const countMode = options.countMode ?? 'at-least'
  const minima = expectedMinima(options)
  const counts = countContent(registry)

  for (const collection of CONTENT_CATEGORY_ORDER) {
    const actual = counts[collection]
    const expected = minima[collection]
    if (actual < expected) add('count-below-minimum', collection, `contains ${actual}; requires at least ${expected}`)
    if (countMode === 'exact' && actual !== expected) add('count-not-exact', collection, `contains ${actual}; requires exactly ${expected}`)
  }

  const records = recordsFor(registry)
  const known = new Map<string, ContentDefinition>()
  for (const record of records) {
    const existing = known.get(record.definition.id)
    if (existing) add('duplicate-id', `${record.path}.id`, `duplicates globally unique ID "${record.definition.id}" owned by ${existing.kind}`)
    else known.set(record.definition.id, record.definition)
  }
  for (const record of records) validateCommon(record, known, add)

  const products = new Map(registry.products.map((product) => [product.id, product] as const))
  validateFloraAndAnimals(registry, known, products, add)
  validateMaterialsAndProducts(registry, known, add)
  const capabilityUse = validateRecipes(registry, known, products, add)
  validateStructures(registry, known, capabilityUse, add)
  validateDecorations(registry, add)
  validateLocalization(registry, options, add)
  validateCanonicalState(registry, options, add)

  return Object.freeze({
    ok: issues.length === 0,
    issues: Object.freeze(issues),
    counts,
    expectedMinima: minima,
    countMode,
    total: records.length,
    fingerprint: registry.fingerprint,
  })
}

export function assertContentRegistry(
  registry: ContentRegistry,
  options: ContentValidationOptions = {},
): asserts registry is ContentRegistry {
  const result = validateContentRegistry(registry, options)
  if (!result.ok) throw new ContentValidationError(result)
}

export function formatContentValidation(result: ContentValidationResult): string {
  if (result.ok) return `Content registry ${result.fingerprint}: ${result.total} definitions validated`
  return result.issues.map((issue) => `[${issue.code}] ${issue.path}: ${issue.message}`).join('\n')
}

export const VALLEY_CONTENT_SOURCES: ContentRegistrySources = Object.freeze({
  crops: VALLEY_CROPS,
  orchardPlants: VALLEY_ORCHARD_PLANTS,
  animals: VALLEY_ANIMALS,
  factories: VALLEY_FACTORIES,
  buildings: VALLEY_BUILDINGS,
  products: VALLEY_PRODUCTS,
  recipes: VALLEY_RECIPES,
  materials: VALLEY_MATERIALS,
  decorations: VALLEY_DECORATIONS,
})

export const VALLEY_CONTENT_REGISTRY = createContentRegistry(VALLEY_CONTENT_SOURCES, {
  countMode: 'exact',
  requiredLocales: ['en'],
  requireCanonicalOrder: true,
})

export const VALLEY_CONTENT_VALIDATION = validateContentRegistry(VALLEY_CONTENT_REGISTRY, {
  countMode: 'exact',
  requiredLocales: ['en'],
  requireCanonicalOrder: true,
})
