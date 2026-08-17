/**
 * Typed contracts for Sprout Hollow Valley's deterministic non-NPC content.
 *
 * Category modules intentionally depend only on this file. Registry assembly is
 * injection based, so independently generated catalogues never need to import one
 * another or rely on module initialization order.
 */

export const CONTENT_MINIMA = {
  crops: 500,
  orchardPlants: 250,
  animals: 150,
  factories: 400,
  buildings: 300,
  products: 1500,
  recipes: 1200,
  materials: 300,
  decorations: 400,
} as const

export const CONTENT_CATEGORY_ORDER = [
  'crops',
  'orchardPlants',
  'animals',
  'factories',
  'buildings',
  'products',
  'recipes',
  'materials',
  'decorations',
] as const

export type ContentCollectionKey = (typeof CONTENT_CATEGORY_ORDER)[number]
export type ContentMinimums = Readonly<Record<ContentCollectionKey, number>>

export const ALL_SEASONS = ['spring', 'summer', 'fall', 'winter'] as const
export type Season = (typeof ALL_SEASONS)[number]
export type SeasonalValues = Readonly<Record<Season, number>>

export const SUPPORTED_LOCALES = ['en', 'yue-Hant', 'bilingual'] as const
export type ContentLocale = (typeof SUPPORTED_LOCALES)[number]
export type LocalizationKey = string
export type LocalizationDictionary = Readonly<Record<LocalizationKey, string>>
export type LocalizationCatalog = Readonly<Partial<Record<ContentLocale, LocalizationDictionary>>>

export interface UnlockDef {
  /** Sprout Hollow Valley progression level, inclusive, from 1 through 100. */
  readonly level: number
  /** Town reputation required, from 0 through 1000. */
  readonly reputation: number
  /** Authored valley region gate, or null when the definition is region-neutral. */
  readonly regionId: string | null
  /** Authored quest gate, or null when no quest is required. */
  readonly questId: string | null
  /** Other content definitions that must already be unlocked. */
  readonly prerequisiteIds: readonly string[]
}

/**
 * One common economy shape keeps balance data inspectable across every category.
 * Zero is valid when a channel is genuinely inapplicable; validators require each
 * definition to carry at least one positive economic value and apply stricter
 * category-specific rules to seeds, products, materials, and structures.
 */
export interface EconomyDef {
  readonly purchasePrice: number
  readonly sellPrice: number
  readonly craftValue: number
  readonly maintenancePerDay: number
  /** Market response strength. Zero is fixed-price; normal goods stay at or below 2. */
  readonly marketElasticity: number
  /** Positive demand multiplier for all four seasons. */
  readonly seasonalDemand: SeasonalValues
}

export interface BaseContentDef<Kind extends ContentKind> {
  readonly kind: Kind
  /** Globally unique, stable, namespaced identifier such as `crop:amber-carrot`. */
  readonly id: string
  /** Authored English display name used for catalogue proof and fallback rendering. */
  readonly name: string
  /** Authored explanatory sentence; a name restatement is not substantive. */
  readonly description: string
  readonly nameKey: LocalizationKey
  readonly descriptionKey: LocalizationKey
  /** Seasons in which the definition is active, available, or market-relevant. */
  readonly seasons: readonly Season[]
  /** Authored valley regions where this definition participates. */
  readonly regions: readonly string[]
  readonly unlock: UnlockDef
  readonly economy: EconomyDef
  /** Searchable authored taxonomy. */
  readonly tags: readonly string[]
}

export type CropFamily =
  | 'allium'
  | 'brassica'
  | 'cereal'
  | 'fiber'
  | 'flower'
  | 'fruiting'
  | 'herb'
  | 'leafy'
  | 'legume'
  | 'medicinal'
  | 'melon'
  | 'oilseed'
  | 'root'
  | 'tuber'

export type WaterNeed = 'low' | 'moderate' | 'high'
export type SoilAffinity = 'loam' | 'clay' | 'sand' | 'silt' | 'peat' | 'rocky' | 'wetland'
export type HarvestMethod = 'cut' | 'dig' | 'hand-pick' | 'pull' | 'shake' | 'strip'

export interface ProductYield {
  readonly productId: string
  readonly min: number
  readonly max: number
}

export interface CropDef extends BaseContentDef<'crop'> {
  readonly cropFamily: CropFamily
  readonly cultivar: string
  readonly growthDays: number
  readonly regrowDays: number | null
  readonly waterNeed: WaterNeed
  readonly soilAffinity: readonly SoilAffinity[]
  readonly harvestMethod: HarvestMethod
  readonly yield: ProductYield
}

export type OrchardPlantForm = 'tree' | 'orchard-plant' | 'bush' | 'vine'
export type PollinationMethod = 'self' | 'wind' | 'insect' | 'cross'

export interface OrchardPlantDef extends BaseContentDef<'orchard'> {
  readonly plantForm: OrchardPlantForm
  readonly plantFamily: string
  readonly cultivar: string
  readonly maturityDays: number
  readonly harvestIntervalDays: number
  readonly dormantSeasons: readonly Season[]
  readonly pollination: PollinationMethod
  readonly canopySize: number
  readonly yield: ProductYield
}

export type AnimalHousing =
  | 'apiary'
  | 'aquarium'
  | 'barn'
  | 'coop'
  | 'hutch'
  | 'pasture'
  | 'pond'
  | 'stable'
  | 'terrarium'

export type AnimalDiet = 'fodder' | 'forage' | 'fruit' | 'grain' | 'hay' | 'insects' | 'nectar' | 'pellets' | 'plants' | 'seeds'
export type AnimalTemperament = 'calm' | 'curious' | 'gentle' | 'independent' | 'lively' | 'social' | 'shy' | 'watchful'
export type CareDifficulty = 'easy' | 'moderate' | 'advanced'

export interface AnimalProductYield extends ProductYield {
  readonly intervalDays: number
}

export interface AnimalDef extends BaseContentDef<'animal'> {
  readonly speciesGroup: string
  readonly breed: string
  readonly housing: readonly AnimalHousing[]
  readonly diet: readonly AnimalDiet[]
  readonly temperament: AnimalTemperament
  readonly careDifficulty: CareDifficulty
  readonly maturityDays: number
  readonly lifespanYears: number
  readonly products: readonly AnimalProductYield[]
}

export type MaterialCategory =
  | 'botanical'
  | 'ceramic'
  | 'fiber'
  | 'fuel'
  | 'glass'
  | 'mineral'
  | 'ore'
  | 'reagent'
  | 'stone'
  | 'timber'

export type MaterialSourceKind =
  | 'animal-care'
  | 'clearing'
  | 'foraging'
  | 'forestry'
  | 'mining'
  | 'recycling'
  | 'refining'
  | 'trade'

export type Renewability = 'renewable' | 'slow-renewable' | 'finite' | 'recycled'
export type QualityGrade = 'standard' | 'fine' | 'premium' | 'masterwork'

export interface MaterialDef extends BaseContentDef<'material'> {
  readonly materialCategory: MaterialCategory
  readonly sourceKinds: readonly MaterialSourceKind[]
  readonly renewability: Renewability
  readonly qualityGrades: readonly QualityGrade[]
  readonly stackLimit: number
  readonly weight: number
}

export type ProductCategory =
  | 'animal-good'
  | 'artisan'
  | 'beverage'
  | 'cooked-food'
  | 'crop'
  | 'fabric'
  | 'household'
  | 'orchard'
  | 'preserve'
  | 'refined'
  | 'tool'

export type ProductSourceKind = 'animal' | 'crop' | 'forage' | 'material' | 'orchard' | 'recipe'
export type ProductUnit = 'bottle' | 'bundle' | 'each' | 'jar' | 'kilogram' | 'litre' | 'metre' | 'packet' | 'wheel'
export type SellingChannel = 'farm-gate' | 'market-stall' | 'shipping-bin' | 'town-order' | 'wholesale'

export interface ProductDef extends BaseContentDef<'product'> {
  readonly productCategory: ProductCategory
  readonly sourceKind: ProductSourceKind
  /** IDs of the crops, orchard plants, animals, materials, or recipes that create it. */
  readonly sourceIds: readonly string[]
  readonly perishableDays: number | null
  readonly qualityGrades: readonly QualityGrade[]
  readonly unit: ProductUnit
  readonly sellingChannels: readonly SellingChannel[]
}

export interface ItemQuantity {
  /** A globally unique material or product ID. */
  readonly itemId: string
  readonly quantity: number
}

export const FACTORY_CAPABILITIES = [
  'capability:cleaning',
  'capability:sorting',
  'capability:milling',
  'capability:pressing',
  'capability:fermenting',
  'capability:baking',
  'capability:cooking',
  'capability:roasting',
  'capability:drying',
  'capability:smoking',
  'capability:preserving',
  'capability:pickling',
  'capability:churning',
  'capability:cheesemaking',
  'capability:confectionery',
  'capability:brewing',
  'capability:distilling',
  'capability:freezing',
  'capability:blending',
  'capability:extracting',
  'capability:weaving',
  'capability:spinning',
  'capability:tanning',
  'capability:carpentry',
  'capability:papermaking',
  'capability:glassmaking',
  'capability:smelting',
  'capability:forging',
  'capability:pottery',
  'capability:tailoring',
] as const

export type FactoryCapability = (typeof FACTORY_CAPABILITIES)[number]

export interface RecipeDef extends BaseContentDef<'recipe'> {
  readonly recipeCategory: string
  readonly durationMinutes: number
  readonly productionCost: number
  readonly inputs: readonly ItemQuantity[]
  readonly outputs: readonly ItemQuantity[]
  /** At least one installed factory capability must match every listed value. */
  readonly factoryCapabilities: readonly FactoryCapability[]
}

export interface FootprintDef {
  readonly width: number
  readonly depth: number
  readonly clearance: number
}

export interface AccessDef {
  readonly entranceCount: number
  readonly accessibleEntrance: boolean
  readonly openingHour: number
  readonly closingHour: number
  readonly lockReason: string | null
  readonly eventualAccess: string
}

export interface SanitationDef {
  readonly toilets: number
  readonly accessibleToilets: number
  readonly sinks: number
  readonly soapStations: number
  readonly dryingStations: number
  readonly wasteBins: number
  readonly mirrors: number
  readonly privacyDoors: number
  readonly handWashStations: number
}

export type StructureCapability =
  | FactoryCapability
  | 'capability:animal-care'
  | 'capability:community-service'
  | 'capability:education'
  | 'capability:healthcare'
  | 'capability:housing'
  | 'capability:lodging'
  | 'capability:research'
  | 'capability:retail'
  | 'capability:sanitation'
  | 'capability:storage'
  | 'capability:transport'

export interface StructureRoomDef {
  readonly id: string
  readonly name: string
  readonly nameKey: LocalizationKey
  readonly purpose: string
  readonly floor: number
  readonly capacity: number
  readonly accessible: boolean
}

export interface StructureStationDef {
  readonly id: string
  readonly name: string
  readonly nameKey: LocalizationKey
  readonly capability: StructureCapability
  readonly interaction: string
  readonly inputItemIds: readonly string[]
  readonly outputItemIds: readonly string[]
  readonly assignedNpcRole: string
  readonly accessible: boolean
}

export interface FactoryDef extends BaseContentDef<'factory'> {
  readonly factoryType: string
  readonly footprint: FootprintDef
  readonly queueCapacity: number
  readonly staffCapacity: number
  readonly capabilities: readonly FactoryCapability[]
  readonly rooms: readonly StructureRoomDef[]
  readonly stations: readonly StructureStationDef[]
  readonly access: AccessDef
  readonly sanitation: SanitationDef
}

export type BuildingType =
  | 'agricultural'
  | 'civic'
  | 'commercial'
  | 'education'
  | 'health'
  | 'hospitality'
  | 'recreation'
  | 'residential'
  | 'storage'
  | 'transport'
  | 'utility'

export interface BuildingDef extends BaseContentDef<'building'> {
  readonly buildingType: BuildingType
  readonly serviceCategory: string
  readonly footprint: FootprintDef
  readonly occupantCapacity: number
  readonly visitorCapacity: number
  readonly storageCapacity: number
  readonly capabilities: readonly StructureCapability[]
  readonly rooms: readonly StructureRoomDef[]
  readonly stations: readonly StructureStationDef[]
  readonly access: AccessDef
  readonly sanitation: SanitationDef
}

export type DecorationType = 'decoration' | 'fence' | 'light' | 'outdoor-object' | 'path' | 'sign'
export type PlacementSurface = 'floor' | 'ground' | 'path-edge' | 'shore' | 'wall' | 'water'
export type DecorationCapability = 'barrier' | 'connectivity' | 'lighting' | 'navigation' | 'seating' | 'signage' | 'storage' | 'weather-shelter'

export interface DecorationPlacementDef {
  readonly surfaces: readonly PlacementSurface[]
  readonly canRotate: boolean
  readonly connectable: boolean
}

export interface DecorationFunctionDef {
  readonly capabilities: readonly DecorationCapability[]
  readonly lightRadius: number
  readonly seats: number
  readonly storageSlots: number
  readonly pathSpeedMultiplier: number
  readonly barrierStrength: number
  readonly signTopic: string | null
}

export interface DecorationDef extends BaseContentDef<'decoration'> {
  readonly decorationType: DecorationType
  readonly footprint: FootprintDef
  readonly placement: DecorationPlacementDef
  readonly functionality: DecorationFunctionDef
}

export type ContentKind =
  | 'animal'
  | 'building'
  | 'crop'
  | 'decoration'
  | 'factory'
  | 'material'
  | 'orchard'
  | 'product'
  | 'recipe'

export type ContentDefinition =
  | CropDef
  | OrchardPlantDef
  | AnimalDef
  | FactoryDef
  | BuildingDef
  | ProductDef
  | RecipeDef
  | MaterialDef
  | DecorationDef

export interface ContentRegistrySources {
  readonly crops: readonly CropDef[]
  readonly orchardPlants: readonly OrchardPlantDef[]
  readonly animals: readonly AnimalDef[]
  readonly factories: readonly FactoryDef[]
  readonly buildings: readonly BuildingDef[]
  readonly products: readonly ProductDef[]
  readonly recipes: readonly RecipeDef[]
  readonly materials: readonly MaterialDef[]
  readonly decorations: readonly DecorationDef[]
}

export type ContentCounts = Readonly<Record<ContentCollectionKey, number>>

export interface ContentRegistry extends ContentRegistrySources {
  /** Definitions sorted by kind and ID in canonical deterministic order. */
  readonly definitions: readonly ContentDefinition[]
  readonly byId: ReadonlyMap<string, ContentDefinition>
  readonly counts: ContentCounts
  readonly total: number
  /** Stable FNV-1a digest over canonical content data, prefixed with `fnv1a32:`. */
  readonly fingerprint: string
  readonly localization: LocalizationCatalog
}

export type ContentValidationCode =
  | 'count-below-minimum'
  | 'count-not-exact'
  | 'duplicate-id'
  | 'duplicate-localization-key'
  | 'invalid-id'
  | 'invalid-kind'
  | 'invalid-name'
  | 'placeholder-name'
  | 'invalid-description'
  | 'missing-localization'
  | 'invalid-season'
  | 'invalid-unlock'
  | 'unknown-prerequisite'
  | 'invalid-economy'
  | 'invalid-category-data'
  | 'unknown-reference'
  | 'reference-kind-mismatch'
  | 'invalid-recipe'
  | 'missing-factory-capability'
  | 'invalid-structure'
  | 'invalid-sanitation'
  | 'invalid-decoration-function'
  | 'nondeterministic-order'

export interface ContentValidationIssue {
  readonly code: ContentValidationCode
  readonly path: string
  readonly message: string
}

export type ContentCountMode = 'at-least' | 'exact'

export interface ContentValidationOptions {
  readonly countMode?: ContentCountMode
  readonly minima?: Partial<Record<ContentCollectionKey, number>>
  readonly requiredLocales?: readonly ContentLocale[]
  /** When true, collection arrays must already be sorted by ID. */
  readonly requireCanonicalOrder?: boolean
}

export interface ContentValidationResult {
  readonly ok: boolean
  readonly issues: readonly ContentValidationIssue[]
  readonly counts: ContentCounts
  readonly expectedMinima: ContentMinimums
  readonly countMode: ContentCountMode
  readonly total: number
  readonly fingerprint: string
}
