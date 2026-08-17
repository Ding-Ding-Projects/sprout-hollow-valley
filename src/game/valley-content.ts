/** Public game-layer entry point for the authored Sprout Hollow Valley catalogue. */
export {
  ContentValidationError,
  VALLEY_CONTENT_REGISTRY,
  VALLEY_CONTENT_SOURCES,
  VALLEY_CONTENT_VALIDATION,
  assertContentRegistry,
  createContentRegistry,
  formatContentValidation,
  validateContentRegistry,
} from '../content/registry'

export {
  ALL_SEASONS,
  CONTENT_CATEGORY_ORDER,
  CONTENT_MINIMA,
  FACTORY_CAPABILITIES,
  SUPPORTED_LOCALES,
} from '../content/types'

export type {
  AnimalDef,
  BuildingDef,
  ContentDefinition,
  ContentRegistry,
  ContentRegistrySources,
  ContentValidationIssue,
  ContentValidationOptions,
  ContentValidationResult,
  CropDef,
  DecorationDef,
  FactoryDef,
  MaterialDef,
  OrchardPlantDef,
  ProductDef,
  RecipeDef,
} from '../content/types'
