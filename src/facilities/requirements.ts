import type { NonFactoryContext, StationKind, StructureContext } from '../interiors/models'

export const FACTORY_REQUIRED_STATION_KINDS: readonly StationKind[] = [
  'intake',
  'inspection',
  'storage',
  'preparation',
  'washing',
  'production',
  'quality-control',
  'packaging',
  'finished-goods-storage',
  'shipping',
  'maintenance',
  'cleaning',
  'waste',
  'recycling',
  'staff-facilities',
  'office',
  'first-aid',
  'safety',
  'restroom',
  'handwashing',
]

export const COMMON_SANITATION_STATION_KINDS: readonly StationKind[] = [
  'restroom',
  'handwashing',
]

export const NON_FACTORY_CONTEXTS: readonly NonFactoryContext[] = [
  'home',
  'shop',
  'civic',
  'farm',
  'mine',
  'greenhouse',
  'restaurant',
  'service',
]

export const NON_FACTORY_REQUIRED_STATION_KINDS: Readonly<
  Record<NonFactoryContext, readonly StationKind[]>
> = {
  home: ['home-living', 'home-cooking', 'home-dining', 'home-sleeping', 'home-storage'],
  shop: ['shop-display', 'shop-checkout', 'shop-inventory', 'shop-customer-service'],
  civic: ['civic-reception', 'civic-records', 'civic-public-service', 'civic-meeting'],
  farm: ['farm-animal-care', 'farm-crop-preparation', 'farm-tool-storage', 'farm-harvest-handling'],
  mine: ['mine-safety-check', 'mine-ore-sorting', 'mine-ventilation', 'mine-extraction-support'],
  greenhouse: [
    'greenhouse-potting',
    'greenhouse-irrigation',
    'greenhouse-climate-control',
    'greenhouse-produce-washing',
  ],
  restaurant: [
    'restaurant-receiving',
    'restaurant-cold-storage',
    'restaurant-food-preparation',
    'restaurant-cooking',
    'restaurant-dishwashing',
    'restaurant-service',
  ],
  service: ['service-reception', 'service-appointment', 'service-workbench', 'service-records'],
}

export function requiredStationKindsForContext(context: StructureContext): readonly StationKind[] {
  if (context === 'factory') return FACTORY_REQUIRED_STATION_KINDS
  return [...NON_FACTORY_REQUIRED_STATION_KINDS[context], ...COMMON_SANITATION_STATION_KINDS]
}

export function isNonFactoryContext(value: string): value is NonFactoryContext {
  return NON_FACTORY_CONTEXTS.some((context) => context === value)
}
