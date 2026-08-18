/**
 * Authored structure catalogue for Sprout Hollow Valley.
 *
 * The catalogue is deliberately constructed from two curated axes rather than an
 * ordinal loop. A site contributes a real valley identity, material tradition and
 * regional economy; an archetype contributes a real service or production contract.
 * Their combination is therefore a named, playable definition rather than a numbered
 * filler variant. Sorting by stable ID makes the exported order deterministic.
 */
import {
  ALL_SEASONS,
  FACTORY_CAPABILITIES,
  type BuildingDef,
  type BuildingType,
  type DecorationCapability,
  type DecorationDef,
  type DecorationPlacementDef,
  type DecorationType,
  type EconomyDef,
  type FactoryCapability,
  type FactoryDef,
  type FootprintDef,
  type PlacementSurface,
  type SanitationDef,
  type Season,
  type StructureCapability,
  type StructureRoomDef,
  type StructureStationDef,
  type UnlockDef,
} from './types'

interface StructureSite {
  readonly slug: string
  readonly name: string
  readonly region: string
  readonly materialTradition: string
  readonly craftTradition: string
  readonly landscape: string
}

const STRUCTURE_SITES: readonly StructureSite[] = [
  { slug: 'meadowbrook', name: 'Meadowbrook', region: 'meadow', materialTradition: 'white oak and fieldstone', craftTradition: 'mortise-and-tenon farm craft', landscape: 'open hay meadows' },
  { slug: 'fernwood', name: 'Fernwood', region: 'forest', materialTradition: 'cedar and mossy granite', craftTradition: 'woodland joinery', landscape: 'fern-rich forest clearings' },
  { slug: 'riverbend', name: 'Riverbend', region: 'riverland', materialTradition: 'river stone and willow', craftTradition: 'waterwheel craft', landscape: 'broad river terraces' },
  { slug: 'highridge', name: 'Highridge', region: 'mountain', materialTradition: 'granite and larch', craftTradition: 'mountain masonry', landscape: 'windy ridge shelves' },
  { slug: 'seagrass', name: 'Seagrass', region: 'coastal', materialTradition: 'driftwood and shell lime', craftTradition: 'salt-resistant coastal craft', landscape: 'dune-backed coves' },
  { slug: 'willowfen', name: 'Willowfen', region: 'marsh', materialTradition: 'willow and fired reed brick', craftTradition: 'raised wetland building', landscape: 'willow-lined wetlands' },
  { slug: 'redmesa', name: 'Redmesa', region: 'arid', materialTradition: 'adobe and red sandstone', craftTradition: 'passive-cooling desert craft', landscape: 'sunlit mesa gardens' },
  { slug: 'snowcap', name: 'Snowcap', region: 'alpine', materialTradition: 'spruce and pale slate', craftTradition: 'snow-shedding alpine craft', landscape: 'high snowfields' },
  { slug: 'orchardgate', name: 'Orchardgate', region: 'meadow', materialTradition: 'applewood and honey brick', craftTradition: 'orchard cooperage', landscape: 'flowering orchard lanes' },
  { slug: 'pinewatch', name: 'Pinewatch', region: 'forest', materialTradition: 'pine and dark basalt', craftTradition: 'ranger-built timber framing', landscape: 'pine forest overlooks' },
  { slug: 'moonwater', name: 'Moonwater', region: 'riverland', materialTradition: 'blue slate and alder', craftTradition: 'canal-side millwork', landscape: 'quiet oxbow banks' },
  { slug: 'coppercliff', name: 'Coppercliff', region: 'mountain', materialTradition: 'copper trim and grey stone', craftTradition: 'precision mountain metalwork', landscape: 'mineral-rich cliff benches' },
  { slug: 'driftwood', name: 'Driftwood', region: 'coastal', materialTradition: 'weathered timber and beach stone', craftTradition: 'boatbuilder carpentry', landscape: 'sheltered tidal inlets' },
  { slug: 'mossbank', name: 'Mossbank', region: 'marsh', materialTradition: 'peat brick and woven rush', craftTradition: 'boardwalk wetland craft', landscape: 'mossy marsh islands' },
  { slug: 'sunstone', name: 'Sunstone', region: 'arid', materialTradition: 'golden limestone and mesquite', craftTradition: 'shade-first courtyard craft', landscape: 'warm stone terraces' },
  { slug: 'frostpine', name: 'Frostpine', region: 'alpine', materialTradition: 'frosted pine and ironstone', craftTradition: 'insulated alpine framing', landscape: 'evergreen mountain bowls' },
  { slug: 'cloverplain', name: 'Cloverplain', region: 'meadow', materialTradition: 'ash wood and cream brick', craftTradition: 'cooperative barn craft', landscape: 'clover grazing commons' },
  { slug: 'cedarshade', name: 'Cedarshade', region: 'forest', materialTradition: 'red cedar and greenstone', craftTradition: 'low-impact forest craft', landscape: 'shaded cedar groves' },
  { slug: 'reedmere', name: 'Reedmere', region: 'riverland', materialTradition: 'reed panel and river clay', craftTradition: 'flood-resilient waterside craft', landscape: 'reed-fringed backwaters' },
  { slug: 'amberfall', name: 'Amberfall', region: 'mountain', materialTradition: 'amber glass and schist', craftTradition: 'terraced highland craft', landscape: 'sunset mountain falls' },
] as const

function canonicalById<T extends { readonly id: string }>(left: T, right: T): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
}

function unlockFor(siteIndex: number, archetypeIndex: number, stride: number, regionId: string): UnlockDef {
  const level = ((siteIndex * stride + archetypeIndex) % 100) + 1
  return {
    level,
    reputation: Math.min(1000, Math.max(0, level * 8 - 8)),
    regionId,
    questId: null,
    prerequisiteIds: [],
  }
}

function demandFor(index: number): Readonly<Record<Season, number>> {
  const spring = 1 + ((index + 1) % 4) * 0.04
  const summer = 1 + ((index + 2) % 4) * 0.04
  const fall = 1 + ((index + 3) % 4) * 0.04
  const winter = 1 + (index % 4) * 0.04
  return { spring, summer, fall, winter }
}

function structureEconomy(basePrice: number, index: number, maintenanceDivisor: number): EconomyDef {
  const purchasePrice = basePrice + index * 275
  return {
    purchasePrice,
    sellPrice: Math.floor(purchasePrice * 0.55),
    craftValue: Math.floor(purchasePrice * 0.28),
    maintenancePerDay: Math.max(1, Math.floor(purchasePrice / maintenanceDivisor)),
    marketElasticity: 0.08 + (index % 5) * 0.02,
    seasonalDemand: demandFor(index),
  }
}

function structureFootprint(width: number, depth: number, index: number): FootprintDef {
  return {
    width: width + (index % 2),
    depth: depth + (Math.floor(index / 2) % 2),
    clearance: 1 + (index % 3 === 0 ? 1 : 0),
  }
}

function sanitationFor(capacity: number, publicFacing: boolean): SanitationDef {
  const fixtureBank = Math.max(1, Math.ceil(capacity / (publicFacing ? 18 : 12)))
  return {
    toilets: fixtureBank + (publicFacing ? 1 : 0),
    accessibleToilets: 1,
    sinks: fixtureBank + 1,
    soapStations: fixtureBank + 1,
    dryingStations: fixtureBank + 1,
    wasteBins: fixtureBank + 1,
    mirrors: fixtureBank + 1,
    privacyDoors: fixtureBank + (publicFacing ? 1 : 0),
    handWashStations: fixtureBank + 1,
  }
}

interface RoomBlueprint {
  readonly slug: string
  readonly name: string
  readonly purpose: string
  readonly capacity: number
}

function roomsFor(structureId: string, keyStem: string, blueprints: readonly RoomBlueprint[]): readonly StructureRoomDef[] {
  return blueprints.map((room, index) => ({
    id: structureId + ':room:' + room.slug,
    name: room.name,
    nameKey: keyStem + '.room.' + room.slug + '.name',
    purpose: room.purpose,
    floor: index > 11 ? 2 : 1,
    capacity: room.capacity,
    accessible: true,
  }))
}

const FACTORY_ROOM_BLUEPRINTS: readonly RoomBlueprint[] = [
  { slug: 'welcome', name: 'Welcome Vestibule', purpose: 'Receives workers and visitors, explains safety rules, and connects the accessible exterior entrance to production rooms.', capacity: 8 },
  { slug: 'intake', name: 'Material Intake Dock', purpose: 'Accepts contracted deliveries and records custody before any material enters a production queue.', capacity: 12 },
  { slug: 'inspection', name: 'Incoming Inspection Bay', purpose: 'Checks identity, grade, temperature, cleanliness, and damage before storage or preparation.', capacity: 8 },
  { slug: 'raw-store', name: 'Raw Material Store', purpose: 'Keeps accepted inputs in labelled, persistent inventory zones with safe separation.', capacity: 24 },
  { slug: 'preparation', name: 'Preparation Room', purpose: 'Stages measured production batches and makes the next queue job visible to workers and players.', capacity: 12 },
  { slug: 'wash', name: 'Wash and Rinse Room', purpose: 'Cleans washable inputs, reusable vessels, and worker equipment before processing.', capacity: 10 },
  { slug: 'production', name: 'Production Hall', purpose: 'Houses the factory process, visible machine states, worker animation points, and queue controls.', capacity: 24 },
  { slug: 'quality', name: 'Quality Laboratory', purpose: 'Samples active batches, explains failures, and records deterministic quality results.', capacity: 8 },
  { slug: 'packaging', name: 'Packaging Room', purpose: 'Measures, labels, seals, and counts finished batches for market channels.', capacity: 14 },
  { slug: 'finished-store', name: 'Finished Goods Store', purpose: 'Holds completed output safely when shipping or player storage is temporarily full.', capacity: 24 },
  { slug: 'shipping', name: 'Shipping Office', purpose: 'Assigns finished lots to contracts, wholesale orders, market stalls, and player collection.', capacity: 10 },
  { slug: 'maintenance', name: 'Maintenance Workshop', purpose: 'Stores tools and exposes repair, lubrication, calibration, and safe shutdown interactions.', capacity: 10 },
  { slug: 'cleaning', name: 'Cleaning Store', purpose: 'Controls cleaning schedules, supplies, waste separation, and inspection readiness.', capacity: 6 },
  { slug: 'recycling', name: 'Recycling Room', purpose: 'Sorts recoverable by-products and prevents usable material from becoming decorative waste.', capacity: 8 },
  { slug: 'staff', name: 'Staff Break Room', purpose: 'Supports meal, rest, locker, schedule, and social needs for assigned workers.', capacity: 16 },
  { slug: 'office', name: 'Operations Office', purpose: 'Holds production records, staffing assignments, contracts, and accessible failure explanations.', capacity: 8 },
  { slug: 'first-aid', name: 'First Aid Room', purpose: 'Provides non-graphic workplace care, recovery, safety announcements, and incident records.', capacity: 4 },
  { slug: 'sanitation', name: 'Accessible Sanitation Suite', purpose: 'Provides toilets, running-water hand washing, soap, drying, mirrors, bins, privacy, and accessible routes.', capacity: 10 },
] as const

interface FactoryStationBlueprint {
  readonly slug: string
  readonly name: string
  readonly capability: StructureCapability | null
  readonly interaction: string
  readonly npcRole: string
}

const FACTORY_STATION_BLUEPRINTS: readonly FactoryStationBlueprint[] = [
  { slug: 'intake', name: 'Delivery Intake', capability: 'capability:sorting', interaction: 'Accept, reject, or route a labelled delivery into persistent intake storage.', npcRole: 'receiving coordinator' },
  { slug: 'inspection', name: 'Input Inspection', capability: 'capability:cleaning', interaction: 'Inspect batch identity, grade, condition, and cleanliness with an announced verdict.', npcRole: 'incoming inspector' },
  { slug: 'raw-storage', name: 'Raw Storage Ledger', capability: 'capability:storage', interaction: 'Review and reserve persistent raw-stock lots for upcoming production jobs.', npcRole: 'inventory keeper' },
  { slug: 'preparation', name: 'Batch Preparation', capability: 'capability:sorting', interaction: 'Measure and stage the selected recipe batch without consuming it before confirmation.', npcRole: 'batch preparer' },
  { slug: 'washing', name: 'Production Wash Station', capability: 'capability:cleaning', interaction: 'Wash approved inputs and reusable production vessels before a queue begins.', npcRole: 'wash attendant' },
  { slug: 'production', name: 'Primary Production Console', capability: null, interaction: 'Choose a compatible recipe, inspect its contract, and advance a visible deterministic queue.', npcRole: 'production operator' },
  { slug: 'quality', name: 'Quality Control Bench', capability: 'capability:sorting', interaction: 'Sample a batch, display its quality factors, and explain any hold or failed check.', npcRole: 'quality steward' },
  { slug: 'packaging', name: 'Packing and Labelling Bench', capability: 'capability:sorting', interaction: 'Package, label, and count finished output for its selected selling channel.', npcRole: 'packaging worker' },
  { slug: 'finished-storage', name: 'Finished Goods Ledger', capability: 'capability:storage', interaction: 'Review completed lots held safely when the shipping route or barn is full.', npcRole: 'finished-goods keeper' },
  { slug: 'shipping', name: 'Dispatch Desk', capability: 'capability:transport', interaction: 'Assign finished lots to collection, contract, wholesale, stall, or shipping-bin routes.', npcRole: 'dispatch coordinator' },
  { slug: 'maintenance', name: 'Maintenance Board', capability: 'capability:community-service', interaction: 'Inspect wear, schedule safe shutdown, and perform repair or calibration tasks.', npcRole: 'maintenance technician' },
  { slug: 'cleaning', name: 'Cleaning Schedule', capability: 'capability:cleaning', interaction: 'Run an accessible cleaning checklist and record workplace readiness.', npcRole: 'sanitation attendant' },
  { slug: 'waste', name: 'Waste Sorting Point', capability: 'capability:sorting', interaction: 'Sort unavoidable waste into safe disposal streams with an explained rejection state.', npcRole: 'waste coordinator' },
  { slug: 'recycling', name: 'By-product Recovery Point', capability: 'capability:sorting', interaction: 'Recover eligible by-products into persistent material storage.', npcRole: 'recycling worker' },
  { slug: 'staff', name: 'Staff Schedule Board', capability: 'capability:community-service', interaction: 'Review staffed shifts, breaks, training, and temporary coverage.', npcRole: 'shift coordinator' },
  { slug: 'office', name: 'Operations Ledger', capability: 'capability:community-service', interaction: 'Review queue history, costs, contracts, staffing, inspections, and failure explanations.', npcRole: 'operations manager' },
  { slug: 'first-aid', name: 'First Aid Cabinet', capability: 'capability:healthcare', interaction: 'Use or restock non-graphic first-aid supplies and log workplace recovery.', npcRole: 'first-aid marshal' },
  { slug: 'safety', name: 'Safety Equipment Rack', capability: 'capability:community-service', interaction: 'Equip context-appropriate protective gear and review emergency shutdown guidance.', npcRole: 'safety marshal' },
  { slug: 'restroom', name: 'Accessible Restroom', capability: 'capability:sanitation', interaction: 'Use a private toilet with persistent occupancy and accessibility announcements.', npcRole: 'facility attendant' },
  { slug: 'hand-wash', name: 'Hand-Washing Basin', capability: 'capability:sanitation', interaction: 'Wash with running water, soap, and drying before hygiene-sensitive work.', npcRole: 'facility attendant' },
] as const

function factoryStationsFor(id: string, keyStem: string, primaryCapability: FactoryCapability): readonly StructureStationDef[] {
  return FACTORY_STATION_BLUEPRINTS.map((station) => ({
    id: id + ':station:' + station.slug,
    name: station.name,
    nameKey: keyStem + '.station.' + station.slug + '.name',
    capability: station.capability ?? primaryCapability,
    interaction: station.interaction,
    inputItemIds: [],
    outputItemIds: [],
    assignedNpcRole: station.npcRole,
    accessible: true,
  }))
}

interface FactoryArchetype {
  readonly slug: string
  readonly name: string
  readonly summary: string
  readonly capabilities: readonly FactoryCapability[]
  readonly basePrice: number
  readonly width: number
  readonly depth: number
  readonly queueCapacity: number
  readonly staffCapacity: number
}

const FACTORY_ARCHETYPES: readonly FactoryArchetype[] = [
  { slug: 'grain-pulse-mill', name: 'Grain and Pulse Mill', summary: 'cleans, grades, and mills cereals and pulses into consistent cooking and baking ingredients', capabilities: ['capability:cleaning', 'capability:sorting', 'capability:milling'], basePrice: 9200, width: 6, depth: 5, queueCapacity: 8, staffCapacity: 14 },
  { slug: 'seed-oil-house', name: 'Cold-Pressed Oil House', summary: 'presses seeds and extracts useful oils while recovering nutritious meal by-products', capabilities: ['capability:pressing', 'capability:extracting'], basePrice: 10800, width: 6, depth: 5, queueCapacity: 7, staffCapacity: 12 },
  { slug: 'cellar-fermentation-works', name: 'Cellar Fermentation Works', summary: 'ferments, brews, and carefully distils valley crops through visible temperature-controlled batches', capabilities: ['capability:fermenting', 'capability:brewing', 'capability:distilling'], basePrice: 14800, width: 7, depth: 6, queueCapacity: 10, staffCapacity: 16 },
  { slug: 'stone-hearth-bakery', name: 'Stone-Hearth Bakery', summary: 'bakes breads, pies, crackers, and celebration goods in separately scheduled hearths', capabilities: ['capability:baking'], basePrice: 10400, width: 6, depth: 5, queueCapacity: 9, staffCapacity: 15 },
  { slug: 'community-kitchen', name: 'Valley Community Kitchen', summary: 'cooks balanced meals and contract dishes at accessible preparation and cooking stations', capabilities: ['capability:cooking'], basePrice: 11200, width: 7, depth: 5, queueCapacity: 10, staffCapacity: 18 },
  { slug: 'small-batch-roastery', name: 'Small-Batch Roastery', summary: 'roasts seeds, roots, nuts, grains, and beverage ingredients with inspectable roast profiles', capabilities: ['capability:roasting'], basePrice: 9900, width: 5, depth: 5, queueCapacity: 7, staffCapacity: 10 },
  { slug: 'solar-drying-loft', name: 'Solar Drying Loft', summary: 'dries herbs, fruit, vegetables, fibers, and timber with season-aware airflow controls', capabilities: ['capability:drying'], basePrice: 8700, width: 7, depth: 4, queueCapacity: 12, staffCapacity: 9 },
  { slug: 'woodsmoke-curing-house', name: 'Woodsmoke Curing House', summary: 'smokes fish, mushrooms, cheeses, peppers, and salts in separately monitored low-smoke chambers', capabilities: ['capability:smoking'], basePrice: 10100, width: 6, depth: 5, queueCapacity: 8, staffCapacity: 11 },
  { slug: 'seasonal-preserve-kitchen', name: 'Seasonal Preserve Kitchen', summary: 'preserves and pickles seasonal harvests with labelled brines, jars, and food-safe wash cycles', capabilities: ['capability:preserving', 'capability:pickling'], basePrice: 11600, width: 7, depth: 5, queueCapacity: 11, staffCapacity: 16 },
  { slug: 'cultured-dairy-creamery', name: 'Cultured Dairy Creamery', summary: 'churns cultured creams and matures cheeses with strict hand-washing and temperature records', capabilities: ['capability:churning', 'capability:cheesemaking'], basePrice: 13200, width: 7, depth: 6, queueCapacity: 9, staffCapacity: 17 },
  { slug: 'honeyed-confectionery', name: 'Honeyed Confectionery', summary: 'crafts candies, chocolate, fruit pastes, and honey sweets in small traceable batches', capabilities: ['capability:confectionery'], basePrice: 12400, width: 6, depth: 5, queueCapacity: 10, staffCapacity: 14 },
  { slug: 'springwater-ice-house', name: 'Springwater Ice House', summary: 'freezes desserts, preserves cold-chain goods, and manages recoverable chilled storage', capabilities: ['capability:freezing'], basePrice: 15600, width: 7, depth: 6, queueCapacity: 8, staffCapacity: 13 },
  { slug: 'herbal-blending-works', name: 'Herbal Blending Works', summary: 'blends teas, seasonings, bath goods, feeds, and household mixtures by documented formula', capabilities: ['capability:blending'], basePrice: 9400, width: 6, depth: 4, queueCapacity: 12, staffCapacity: 12 },
  { slug: 'loom-spindle-mill', name: 'Loom and Spindle Mill', summary: 'spins clean fiber and weaves traceable cloth on visible worker-operated equipment', capabilities: ['capability:spinning', 'capability:weaving'], basePrice: 14100, width: 8, depth: 5, queueCapacity: 10, staffCapacity: 20 },
  { slug: 'hide-cloth-atelier', name: 'Hide and Cloth Atelier', summary: 'uses plant-conscious tanning and careful tailoring to turn responsibly sourced hides and cloth into durable goods', capabilities: ['capability:tanning', 'capability:tailoring'], basePrice: 13800, width: 7, depth: 5, queueCapacity: 8, staffCapacity: 16 },
  { slug: 'timber-joinery', name: 'Timber Joinery', summary: 'seasons lumber and performs measured carpentry for furniture, fittings, crates, and repairs', capabilities: ['capability:carpentry'], basePrice: 14400, width: 8, depth: 6, queueCapacity: 8, staffCapacity: 18 },
  { slug: 'rag-reed-paper-mill', name: 'Rag and Reed Paper Mill', summary: 'makes paper from recycled rag, crop fiber, and reeds with closed-loop wash water', capabilities: ['capability:papermaking'], basePrice: 15100, width: 8, depth: 6, queueCapacity: 9, staffCapacity: 17 },
  { slug: 'kiln-glassworks', name: 'Kiln Glassworks', summary: 'forms reusable bottles, panes, lenses, and decorative glass with guarded heat stations', capabilities: ['capability:glassmaking'], basePrice: 18200, width: 8, depth: 6, queueCapacity: 7, staffCapacity: 19 },
  { slug: 'tool-forge-foundry', name: 'Tool Forge and Foundry', summary: 'smelts reclaimed ore and forges tools, fittings, cookware, and repair parts under visible safety controls', capabilities: ['capability:smelting', 'capability:forging'], basePrice: 19600, width: 8, depth: 7, queueCapacity: 8, staffCapacity: 21 },
  { slug: 'ceramic-studio', name: 'Production Ceramic Studio', summary: 'prepares clay and fires durable vessels, tiles, crocks, drainage parts, and tableware', capabilities: ['capability:pottery'], basePrice: 13700, width: 7, depth: 6, queueCapacity: 10, staffCapacity: 15 },
] as const

function createFactory(site: StructureSite, siteIndex: number, archetype: FactoryArchetype, archetypeIndex: number): FactoryDef {
  const id = 'factory:' + site.slug + '-' + archetype.slug
  const keyStem = 'content.factory.' + site.slug + '.' + archetype.slug
  const sequence = siteIndex * FACTORY_ARCHETYPES.length + archetypeIndex
  return {
    kind: 'factory',
    id,
    name: site.name + ' ' + archetype.name,
    description: 'A ' + site.craftTradition + ' facility serving ' + site.landscape + '; it ' + archetype.summary + ' using ' + site.materialTradition + ' construction.',
    nameKey: keyStem + '.name',
    descriptionKey: keyStem + '.description',
    seasons: ALL_SEASONS,
    regions: [site.region],
    unlock: unlockFor(siteIndex, archetypeIndex, FACTORY_ARCHETYPES.length, site.region),
    economy: structureEconomy(archetype.basePrice, sequence, 95),
    tags: ['structure', 'factory', site.region, site.slug, archetype.slug, site.craftTradition],
    factoryType: archetype.slug,
    footprint: structureFootprint(archetype.width, archetype.depth, sequence),
    queueCapacity: archetype.queueCapacity + (siteIndex % 3),
    staffCapacity: archetype.staffCapacity + (siteIndex % 4),
    capabilities: archetype.capabilities,
    rooms: roomsFor(id, keyStem, FACTORY_ROOM_BLUEPRINTS),
    stations: factoryStationsFor(id, keyStem, archetype.capabilities[0]),
    access: {
      entranceCount: archetype.width >= 8 ? 3 : 2,
      accessibleEntrance: true,
      openingHour: 6,
      closingHour: 22,
      lockReason: 'Closed production floors require an active shift, delivery appointment, employment role, or guided visitor permit.',
      eventualAccess: 'Reach the posted opening hours, accept a delivery or work contract, gain employee access, or book the public safety tour.',
    },
    sanitation: sanitationFor(archetype.staffCapacity + 8, false),
  }
}

export const VALLEY_FACTORIES: readonly FactoryDef[] = STRUCTURE_SITES
  .flatMap((site, siteIndex) => FACTORY_ARCHETYPES.map((archetype, archetypeIndex) => createFactory(site, siteIndex, archetype, archetypeIndex)))
  .sort(canonicalById)

interface BuildingArchetype {
  readonly slug: string
  readonly name: string
  readonly buildingType: BuildingType
  readonly serviceCategory: string
  readonly summary: string
  readonly capabilities: readonly StructureCapability[]
  readonly basePrice: number
  readonly width: number
  readonly depth: number
  readonly occupants: number
  readonly visitors: number
  readonly storage: number
  readonly primaryStationName: string
  readonly primaryInteraction: string
  readonly primaryRole: string
  readonly rooms: readonly RoomBlueprint[]
}

const BUILDING_ARCHETYPES: readonly BuildingArchetype[] = [
  {
    slug: 'agricultural-extension-house', name: 'Agricultural Extension House', buildingType: 'agricultural', serviceCategory: 'farm advice and soil stewardship', summary: 'provides soil testing, crop planning, animal-care advice, seed trials, and reversible farm recovery plans', capabilities: ['capability:education', 'capability:research', 'capability:animal-care'], basePrice: 8400, width: 6, depth: 5, occupants: 8, visitors: 20, storage: 36, primaryStationName: 'Farm Planning Table', primaryInteraction: 'Compare field records, soil results, seasonal plans, and accessible recovery recommendations.', primaryRole: 'agricultural advisor',
    rooms: [
      { slug: 'reception', name: 'Farm Advice Reception', purpose: 'Welcomes growers and routes questions to the appropriate advisor.', capacity: 12 },
      { slug: 'soil-lab', name: 'Soil Testing Laboratory', purpose: 'Tests soil samples and explains deterministic amendment results.', capacity: 8 },
      { slug: 'planning', name: 'Seasonal Planning Room', purpose: 'Builds crop, pasture, and orchard plans without committing changes prematurely.', capacity: 14 },
      { slug: 'seed-library', name: 'Seed Reference Library', purpose: 'Stores labelled examples and unlock guidance for valley cultivars.', capacity: 10 },
      { slug: 'staff', name: 'Advisor Workroom', purpose: 'Supports advisor schedules, research notes, breaks, and case follow-up.', capacity: 10 },
    ],
  },
  {
    slug: 'seed-tool-market', name: 'Seed and Tool Market', buildingType: 'commercial', serviceCategory: 'farm retail', summary: 'sells seasonal seeds, inspected hand tools, repair parts, and clearly priced farm supplies', capabilities: ['capability:retail', 'capability:storage'], basePrice: 7200, width: 6, depth: 5, occupants: 6, visitors: 28, storage: 90, primaryStationName: 'Farm Goods Counter', primaryInteraction: 'Browse, compare, purchase, return, or reserve clearly priced seasonal farm goods.', primaryRole: 'farm merchant',
    rooms: [
      { slug: 'sales-floor', name: 'Seed Sales Floor', purpose: 'Displays seasonal seeds with price, growth, region, and unlock information.', capacity: 24 },
      { slug: 'tool-gallery', name: 'Tool Gallery', purpose: 'Lets players compare tool functions, durability, controls, and repair needs.', capacity: 16 },
      { slug: 'order-desk', name: 'Special Order Desk', purpose: 'Places recoverable supply reservations and explains unavailable stock.', capacity: 8 },
      { slug: 'stockroom', name: 'Secure Stockroom', purpose: 'Persists sale stock and reserved orders without silent loss.', capacity: 12 },
      { slug: 'staff', name: 'Merchant Workroom', purpose: 'Supports pricing, stocking, breaks, and daily market preparation.', capacity: 8 },
    ],
  },
  {
    slug: 'valley-council-hall', name: 'Valley Council Hall', buildingType: 'civic', serviceCategory: 'civic administration', summary: 'hosts permits, land deeds, public meetings, elections, records, and community recovery decisions', capabilities: ['capability:community-service', 'capability:storage'], basePrice: 11600, width: 8, depth: 6, occupants: 14, visitors: 60, storage: 70, primaryStationName: 'Civic Services Desk', primaryInteraction: 'Review permits, deeds, public records, meeting decisions, and appeal routes.', primaryRole: 'civic clerk',
    rooms: [
      { slug: 'public-hall', name: 'Public Meeting Hall', purpose: 'Hosts announced meetings, hearings, celebrations, and community votes.', capacity: 60 },
      { slug: 'services', name: 'Civic Services Office', purpose: 'Processes deeds, permits, registrations, and accessible appeals.', capacity: 18 },
      { slug: 'records', name: 'Public Records Archive', purpose: 'Stores persistent decisions, maps, deeds, and readable history.', capacity: 12 },
      { slug: 'council', name: 'Council Chamber', purpose: 'Resolves scheduled civic events with transparent deterministic outcomes.', capacity: 30 },
      { slug: 'staff', name: 'Clerk Workroom', purpose: 'Supports civic schedules, secure documents, breaks, and case preparation.', capacity: 14 },
    ],
  },
  {
    slug: 'community-schoolhouse', name: 'Community Schoolhouse', buildingType: 'education', serviceCategory: 'community education', summary: 'teaches farming, craft, ecology, safety, accessibility, and valley history through scheduled lessons', capabilities: ['capability:education', 'capability:community-service'], basePrice: 9800, width: 7, depth: 6, occupants: 12, visitors: 42, storage: 48, primaryStationName: 'Lesson Planning Board', primaryInteraction: 'Choose an unlocked lesson, review outcomes, and join a scheduled accessible class.', primaryRole: 'community teacher',
    rooms: [
      { slug: 'classroom', name: 'Community Classroom', purpose: 'Runs lessons with keyboard, pointer, gamepad, narration, and readable materials.', capacity: 36 },
      { slug: 'workshop', name: 'Practical Skills Room', purpose: 'Teaches safe hands-on farm, craft, and repair interactions.', capacity: 24 },
      { slug: 'library', name: 'Learning Library', purpose: 'Provides searchable guides and permanent lesson review.', capacity: 18 },
      { slug: 'quiet-room', name: 'Quiet Study Room', purpose: 'Offers reduced-motion and low-distraction learning space.', capacity: 10 },
      { slug: 'staff', name: 'Teacher Workroom', purpose: 'Supports lesson preparation, schedules, breaks, and student requests.', capacity: 12 },
    ],
  },
  {
    slug: 'wellness-clinic', name: 'Health and Wellness Clinic', buildingType: 'health', serviceCategory: 'healthcare and recovery', summary: 'provides gentle treatment, energy recovery, wellness advice, first aid, and clearly explained fees', capabilities: ['capability:healthcare', 'capability:sanitation'], basePrice: 13200, width: 7, depth: 6, occupants: 16, visitors: 34, storage: 64, primaryStationName: 'Wellness Reception', primaryInteraction: 'Request treatment, review time and cost, or schedule a reversible wellness service.', primaryRole: 'clinic receptionist',
    rooms: [
      { slug: 'waiting', name: 'Clinic Waiting Room', purpose: 'Queues visits visibly with seating, narration, and estimated wait information.', capacity: 24 },
      { slug: 'consultation', name: 'Consultation Room', purpose: 'Provides private wellness advice and consent-based care choices.', capacity: 6 },
      { slug: 'treatment', name: 'Treatment Room', purpose: 'Restores energy or resolves temporary conditions without irreversible harm.', capacity: 8 },
      { slug: 'pharmacy', name: 'Dispensary', purpose: 'Stores and explains approved remedies and first-aid supplies.', capacity: 8 },
      { slug: 'staff', name: 'Care Team Room', purpose: 'Supports hand washing, schedules, records, breaks, and shift coordination.', capacity: 14 },
    ],
  },
  {
    slug: 'travellers-inn', name: 'Travellers Inn', buildingType: 'hospitality', serviceCategory: 'lodging and meals', summary: 'offers bookable rooms, meals, luggage storage, local guidance, and accessible overnight recovery', capabilities: ['capability:lodging', 'capability:housing', 'capability:storage'], basePrice: 12400, width: 8, depth: 7, occupants: 28, visitors: 36, storage: 72, primaryStationName: 'Innkeeper Desk', primaryInteraction: 'Book a room, store luggage, review meals, or request accessible lodging support.', primaryRole: 'innkeeper',
    rooms: [
      { slug: 'lobby', name: 'Inn Lobby', purpose: 'Handles arrivals, departures, guidance, luggage, and visible room status.', capacity: 28 },
      { slug: 'dining', name: 'Guest Dining Room', purpose: 'Serves scheduled meals with seating and hygiene-aware service.', capacity: 36 },
      { slug: 'guest-wing', name: 'Accessible Guest Wing', purpose: 'Provides real traversable lodging rooms with privacy and storage.', capacity: 24 },
      { slug: 'laundry', name: 'Guest Laundry', purpose: 'Cleans linens and guest clothing through scheduled service interactions.', capacity: 8 },
      { slug: 'staff', name: 'Hospitality Workroom', purpose: 'Supports housekeeping, meal service, shifts, breaks, and guest requests.', capacity: 16 },
    ],
  },
  {
    slug: 'recreation-pavilion', name: 'Recreation Pavilion', buildingType: 'recreation', serviceCategory: 'games and community events', summary: 'hosts indoor games, movement classes, clubs, rehearsals, festivals, and weather-safe gatherings', capabilities: ['capability:community-service', 'capability:education'], basePrice: 10600, width: 8, depth: 6, occupants: 10, visitors: 72, storage: 52, primaryStationName: 'Activity Schedule Board', primaryInteraction: 'Join, schedule, or review an accessible club, class, rehearsal, or community event.', primaryRole: 'recreation coordinator',
    rooms: [
      { slug: 'great-room', name: 'Community Great Room', purpose: 'Hosts large gatherings with configurable seating and clear navigation.', capacity: 72 },
      { slug: 'games', name: 'Games Room', purpose: 'Provides deterministic tabletop and cooperative activities.', capacity: 28 },
      { slug: 'movement', name: 'Movement Studio', purpose: 'Hosts reduced-motion-compatible classes and rehearsals.', capacity: 30 },
      { slug: 'equipment', name: 'Equipment Store', purpose: 'Persists activity equipment and explains unavailable items.', capacity: 10 },
      { slug: 'staff', name: 'Coordinator Office', purpose: 'Supports event planning, schedules, safety, breaks, and community requests.', capacity: 10 },
    ],
  },
  {
    slug: 'family-cottage', name: 'Family Cottage', buildingType: 'residential', serviceCategory: 'household housing', summary: 'supports a persistent household with bedrooms, cooking, storage, hygiene, relationships, and accessible daily routines', capabilities: ['capability:housing', 'capability:storage', 'capability:sanitation'], basePrice: 14800, width: 7, depth: 6, occupants: 8, visitors: 12, storage: 96, primaryStationName: 'Household Planning Table', primaryInteraction: 'Review chores, meals, visitors, room permissions, and respectful household transitions.', primaryRole: 'household resident',
    rooms: [
      { slug: 'living', name: 'Family Living Room', purpose: 'Supports conversations, rest, play, shared activities, and visitor hosting.', capacity: 14 },
      { slug: 'kitchen', name: 'Household Kitchen', purpose: 'Supports meals, food storage, cleaning, and hygiene-aware routines.', capacity: 10 },
      { slug: 'bedrooms', name: 'Private Bedroom Wing', purpose: 'Provides real private sleeping rooms with consent-based access.', capacity: 8 },
      { slug: 'utility', name: 'Household Utility Room', purpose: 'Handles laundry, repairs, cleaning supplies, and household storage.', capacity: 6 },
      { slug: 'study', name: 'Household Study', purpose: 'Supports schedules, memories, letters, homework, and quiet activities.', capacity: 8 },
    ],
  },
  {
    slug: 'cooperative-storehouse', name: 'Cooperative Storehouse', buildingType: 'storage', serviceCategory: 'shared storage and logistics', summary: 'provides labelled shared storage, reservations, climate zones, inventory records, and safe overflow handling', capabilities: ['capability:storage', 'capability:transport'], basePrice: 9100, width: 8, depth: 6, occupants: 10, visitors: 24, storage: 320, primaryStationName: 'Cooperative Inventory Desk', primaryInteraction: 'Deposit, reserve, transfer, collect, or audit a persistent labelled storage lot.', primaryRole: 'cooperative storekeeper',
    rooms: [
      { slug: 'receiving', name: 'Storehouse Receiving Hall', purpose: 'Accepts and labels deposits before they enter shared storage.', capacity: 18 },
      { slug: 'dry-store', name: 'Dry Goods Store', purpose: 'Keeps shelf-stable goods in searchable persistent bays.', capacity: 20 },
      { slug: 'cool-store', name: 'Cool Storage Room', purpose: 'Protects perishable goods and exposes temperature status.', capacity: 18 },
      { slug: 'dispatch', name: 'Collection and Dispatch Room', purpose: 'Transfers reserved lots without silent loss or queue blockage.', capacity: 16 },
      { slug: 'staff', name: 'Storekeeper Office', purpose: 'Supports inventory audits, schedules, breaks, and dispute resolution.', capacity: 10 },
    ],
  },
  {
    slug: 'coach-ferry-depot', name: 'Coach and Ferry Depot', buildingType: 'transport', serviceCategory: 'valley transport', summary: 'coordinates coaches, ferries, deliveries, accessible boarding, route recovery, and weather-aware travel', capabilities: ['capability:transport', 'capability:storage'], basePrice: 11800, width: 8, depth: 6, occupants: 16, visitors: 56, storage: 80, primaryStationName: 'Journey Desk', primaryInteraction: 'Choose a route, review time and fare, reserve accessible boarding, or recover from disruption.', primaryRole: 'transport dispatcher',
    rooms: [
      { slug: 'concourse', name: 'Passenger Concourse', purpose: 'Shows routes, fares, weather, delays, and accessible navigation.', capacity: 56 },
      { slug: 'ticketing', name: 'Journey Services Room', purpose: 'Books recoverable journeys and explains unavailable routes.', capacity: 14 },
      { slug: 'baggage', name: 'Baggage Store', purpose: 'Persists checked parcels and player luggage with claim records.', capacity: 16 },
      { slug: 'dispatch', name: 'Dispatch Office', purpose: 'Coordinates vehicles, crews, route changes, and safety checks.', capacity: 12 },
      { slug: 'staff', name: 'Driver Rest Room', purpose: 'Supports breaks, schedules, lockers, and hand washing for transport crews.', capacity: 14 },
    ],
  },
  {
    slug: 'water-power-house', name: 'Water and Power House', buildingType: 'utility', serviceCategory: 'public utilities', summary: 'monitors clean water, renewable power, drainage, outages, repairs, and clearly explained service restoration', capabilities: ['capability:community-service', 'capability:research'], basePrice: 15400, width: 8, depth: 6, occupants: 18, visitors: 16, storage: 90, primaryStationName: 'Utility Control Board', primaryInteraction: 'Inspect supply, route maintenance, acknowledge an outage, or begin a safe restoration task.', primaryRole: 'utility operator',
    rooms: [
      { slug: 'control', name: 'Utility Control Room', purpose: 'Displays water, power, drainage, and fault states without hidden timers.', capacity: 14 },
      { slug: 'pump', name: 'Pump and Filter Hall', purpose: 'Houses inspectable water treatment and distribution equipment.', capacity: 16 },
      { slug: 'electrical', name: 'Power Distribution Room', purpose: 'Houses guarded renewable power switching and storage.', capacity: 12 },
      { slug: 'repair', name: 'Utility Repair Workshop', purpose: 'Stores parts and supports safe service restoration interactions.', capacity: 12 },
      { slug: 'staff', name: 'Operator Workroom', purpose: 'Supports schedules, incident records, lockers, breaks, and training.', capacity: 16 },
    ],
  },
  {
    slug: 'veterinary-care-house', name: 'Veterinary Care House', buildingType: 'health', serviceCategory: 'animal healthcare', summary: 'provides gentle animal examinations, temporary recovery stalls, husbandry guidance, and hygiene-controlled care', capabilities: ['capability:animal-care', 'capability:healthcare', 'capability:sanitation'], basePrice: 13600, width: 7, depth: 6, occupants: 14, visitors: 26, storage: 68, primaryStationName: 'Animal Care Reception', primaryInteraction: 'Register an animal, review care and cost, or schedule a gentle examination.', primaryRole: 'veterinary receptionist',
    rooms: [
      { slug: 'waiting', name: 'Animal Waiting Room', purpose: 'Separates species safely and communicates queue and stress status.', capacity: 20 },
      { slug: 'exam', name: 'Examination Room', purpose: 'Supports gentle consent-aware examination and clear findings.', capacity: 8 },
      { slug: 'recovery', name: 'Recovery Stall Room', purpose: 'Provides temporary reversible care without permanent animal loss.', capacity: 12 },
      { slug: 'supply', name: 'Care Supply Room', purpose: 'Stores labelled remedies, bandages, feed samples, and cleaning supplies.', capacity: 8 },
      { slug: 'staff', name: 'Care Team Workroom', purpose: 'Supports records, schedules, hand washing, breaks, and case review.', capacity: 12 },
    ],
  },
  {
    slug: 'library-archive', name: 'Library and Archive', buildingType: 'education', serviceCategory: 'knowledge and history', summary: 'provides searchable books, maps, oral histories, research desks, local records, and quiet accessible study', capabilities: ['capability:education', 'capability:research', 'capability:storage'], basePrice: 10200, width: 7, depth: 6, occupants: 12, visitors: 46, storage: 180, primaryStationName: 'Reference Desk', primaryInteraction: 'Search, borrow, return, translate, narrate, or request an accessible reference item.', primaryRole: 'librarian',
    rooms: [
      { slug: 'stacks', name: 'Open Book Stacks', purpose: 'Stores searchable circulating books and guides with accessible routes.', capacity: 36 },
      { slug: 'reading', name: 'Reading Room', purpose: 'Provides quiet seating, narration, magnification, and study tools.', capacity: 30 },
      { slug: 'archive', name: 'Valley Archive', purpose: 'Preserves maps, public history, festival records, and community memory.', capacity: 12 },
      { slug: 'research', name: 'Research Room', purpose: 'Supports requests, comparisons, citations, and quest research.', capacity: 14 },
      { slug: 'staff', name: 'Cataloguing Workroom', purpose: 'Supports returns, conservation, schedules, breaks, and reference work.', capacity: 12 },
    ],
  },
  {
    slug: 'bathhouse-laundry', name: 'Bathhouse and Laundry', buildingType: 'recreation', serviceCategory: 'bathing and laundry', summary: 'offers private bathing, accessible showers, laundry, changing, relaxation, and rigorous hygiene routines', capabilities: ['capability:sanitation', 'capability:community-service'], basePrice: 12100, width: 8, depth: 6, occupants: 16, visitors: 44, storage: 54, primaryStationName: 'Bathhouse Welcome Desk', primaryInteraction: 'Reserve an accessible bathing, shower, laundry, or relaxation service.', primaryRole: 'bathhouse attendant',
    rooms: [
      { slug: 'changing', name: 'Accessible Changing Room', purpose: 'Provides private changing, lockers, seating, and assistance requests.', capacity: 20 },
      { slug: 'bathing', name: 'Warm Bath Hall', purpose: 'Supports timed private or communal bathing with clear occupancy.', capacity: 24 },
      { slug: 'showers', name: 'Accessible Shower Room', purpose: 'Provides step-free showers with soap, drying, seating, and privacy.', capacity: 16 },
      { slug: 'laundry', name: 'Community Laundry', purpose: 'Runs visible wash, dry, fold, and collection queues.', capacity: 14 },
      { slug: 'staff', name: 'Linen and Staff Room', purpose: 'Supports clean linen, schedules, breaks, supplies, and inspection records.', capacity: 12 },
    ],
  },
  {
    slug: 'ranger-rescue-lodge', name: 'Ranger and Rescue Lodge', buildingType: 'civic', serviceCategory: 'ranger and rescue services', summary: 'coordinates trail guidance, weather warnings, searches, wildlife support, first aid, and safe return routes', capabilities: ['capability:community-service', 'capability:transport', 'capability:healthcare'], basePrice: 12800, width: 7, depth: 6, occupants: 20, visitors: 30, storage: 100, primaryStationName: 'Ranger Duty Desk', primaryInteraction: 'Review trails and hazards, file a request, or join a clearly scoped rescue task.', primaryRole: 'duty ranger',
    rooms: [
      { slug: 'briefing', name: 'Trail Briefing Room', purpose: 'Shows routes, weather, closures, hazards, and eventual access paths.', capacity: 28 },
      { slug: 'dispatch', name: 'Rescue Dispatch Room', purpose: 'Coordinates deterministic searches and safe-return tasks.', capacity: 14 },
      { slug: 'equipment', name: 'Rescue Equipment Store', purpose: 'Stores inspected field, navigation, weather, and first-aid gear.', capacity: 12 },
      { slug: 'first-aid', name: 'Trail First Aid Room', purpose: 'Provides gentle recovery and safe onward travel guidance.', capacity: 8 },
      { slug: 'staff', name: 'Ranger Ready Room', purpose: 'Supports shifts, training, lockers, breaks, and incident review.', capacity: 18 },
    ],
  },
] as const

function buildingRoomsFor(id: string, keyStem: string, archetype: BuildingArchetype): readonly StructureRoomDef[] {
  const completeRooms: readonly RoomBlueprint[] = [
    ...archetype.rooms,
    { slug: 'sanitation', name: 'Accessible Sanitation Suite', purpose: 'Provides private toilets, running-water sinks, soap, drying, mirrors, waste bins, hand washing, and a step-free route.', capacity: Math.max(6, Math.ceil(archetype.visitors / 5)) },
  ]
  return roomsFor(id, keyStem, completeRooms)
}

function buildingStationsFor(id: string, keyStem: string, archetype: BuildingArchetype): readonly StructureStationDef[] {
  const blueprints: readonly FactoryStationBlueprint[] = [
    { slug: 'primary-service', name: archetype.primaryStationName, capability: archetype.capabilities[0], interaction: archetype.primaryInteraction, npcRole: archetype.primaryRole },
    { slug: 'welcome', name: 'Accessible Welcome Point', capability: 'capability:community-service', interaction: 'Review services, hours, navigation, access requirements, and any current failure explanation.', npcRole: 'welcome host' },
    { slug: 'storage', name: 'Service Storage Ledger', capability: 'capability:storage', interaction: 'Review labelled supplies, reservations, and overflow without silently losing items.', npcRole: 'stock steward' },
    { slug: 'safety', name: 'Safety and First Aid Point', capability: 'capability:healthcare', interaction: 'Review context-specific safety guidance or use non-graphic first-aid supplies.', npcRole: 'safety marshal' },
    { slug: 'restroom', name: 'Accessible Restroom', capability: 'capability:sanitation', interaction: 'Use a private toilet with persistent occupancy and accessibility announcements.', npcRole: 'facility attendant' },
    { slug: 'hand-wash', name: 'Hand-Washing Basin', capability: 'capability:sanitation', interaction: 'Wash with running water, soap, and drying before returning to relevant activities.', npcRole: 'facility attendant' },
  ]
  return blueprints.map((station) => ({
    id: id + ':station:' + station.slug,
    name: station.name,
    nameKey: keyStem + '.station.' + station.slug + '.name',
    capability: station.capability ?? archetype.capabilities[0],
    interaction: station.interaction,
    inputItemIds: [],
    outputItemIds: [],
    assignedNpcRole: station.npcRole,
    accessible: true,
  }))
}

function createBuilding(site: StructureSite, siteIndex: number, archetype: BuildingArchetype, archetypeIndex: number): BuildingDef {
  const id = 'building:' + site.slug + '-' + archetype.slug
  const keyStem = 'content.building.' + site.slug + '.' + archetype.slug
  const sequence = siteIndex * BUILDING_ARCHETYPES.length + archetypeIndex
  return {
    kind: 'building',
    id,
    name: site.name + ' ' + archetype.name,
    description: 'A fully enterable ' + archetype.serviceCategory + ' building adapted to ' + site.landscape + '; it ' + archetype.summary + ' in the local tradition of ' + site.materialTradition + '.',
    nameKey: keyStem + '.name',
    descriptionKey: keyStem + '.description',
    seasons: ALL_SEASONS,
    regions: [site.region],
    unlock: unlockFor(siteIndex, archetypeIndex, BUILDING_ARCHETYPES.length, site.region),
    economy: structureEconomy(archetype.basePrice, sequence, 120),
    tags: ['structure', 'building', archetype.buildingType, archetype.serviceCategory, site.region, site.slug],
    buildingType: archetype.buildingType,
    serviceCategory: archetype.serviceCategory,
    footprint: structureFootprint(archetype.width, archetype.depth, sequence),
    occupantCapacity: archetype.occupants + (siteIndex % 3),
    visitorCapacity: archetype.visitors + (siteIndex % 5) * 2,
    storageCapacity: archetype.storage + (siteIndex % 4) * 8,
    capabilities: archetype.capabilities,
    rooms: buildingRoomsFor(id, keyStem, archetype),
    stations: buildingStationsFor(id, keyStem, archetype),
    access: {
      entranceCount: archetype.visitors >= 40 ? 3 : 2,
      accessibleEntrance: true,
      openingHour: archetype.buildingType === 'residential' ? 0 : 7,
      closingHour: archetype.buildingType === 'residential' ? 24 : 21,
      lockReason: archetype.buildingType === 'residential'
        ? 'Private rooms require household membership, invitation, friendship, or a scheduled service visit.'
        : 'Staff and secure rooms require opening hours, an appointment, employment, a quest task, or explicit permission.',
      eventualAccess: archetype.buildingType === 'residential'
        ? 'Build household trust, accept an invitation, join the household, or schedule an authorised visit.'
        : 'Return during posted hours, book the service, accept relevant work, or earn the stated permission.',
    },
    sanitation: sanitationFor(archetype.visitors + archetype.occupants, true),
  }
}

export const VALLEY_BUILDINGS: readonly BuildingDef[] = STRUCTURE_SITES
  .flatMap((site, siteIndex) => BUILDING_ARCHETYPES.map((archetype, archetypeIndex) => createBuilding(site, siteIndex, archetype, archetypeIndex)))
  .sort(canonicalById)

interface DecorationStyle {
  readonly slug: string
  readonly name: string
  readonly region: string
  readonly material: string
  readonly craft: string
}

const DECORATION_STYLES: readonly DecorationStyle[] = [
  { slug: 'meadow-oak', name: 'Meadow Oak', region: 'meadow', material: 'oiled white oak', craft: 'rounded meadow joinery' },
  { slug: 'fernwood-cedar', name: 'Fernwood Cedar', region: 'forest', material: 'weatherproof red cedar', craft: 'fern-carved woodland joinery' },
  { slug: 'riverstone', name: 'Riverstone', region: 'riverland', material: 'smooth river stone and alder', craft: 'flood-resilient waterside craft' },
  { slug: 'highridge-granite', name: 'Highridge Granite', region: 'mountain', material: 'split granite and larch', craft: 'wind-braced mountain masonry' },
  { slug: 'seagrass-ropework', name: 'Seagrass Ropework', region: 'coastal', material: 'salt-safe rope and driftwood', craft: 'coastal ropework' },
  { slug: 'willow-reed', name: 'Willow Reed', region: 'marsh', material: 'woven willow and treated reed', craft: 'raised wetland basketry' },
  { slug: 'redmesa-adobe', name: 'Redmesa Adobe', region: 'arid', material: 'sealed adobe and red stone', craft: 'shade-casting desert craft' },
  { slug: 'snowcap-iron', name: 'Snowcap Iron', region: 'alpine', material: 'dark iron and pale slate', craft: 'snow-shedding alpine metalwork' },
  { slug: 'orchard-copper', name: 'Orchard Copper', region: 'meadow', material: 'applewood and warm copper', craft: 'blossom-pattern orchard craft' },
  { slug: 'pinewatch-timber', name: 'Pinewatch Timber', region: 'forest', material: 'resin-sealed pine', craft: 'ranger-built forest framing' },
  { slug: 'moonwater-slate', name: 'Moonwater Slate', region: 'riverland', material: 'blue slate and silvered alder', craft: 'moonlit canal craft' },
  { slug: 'coppercliff-brass', name: 'Coppercliff Brass', region: 'mountain', material: 'brushed brass and schist', craft: 'precision highland metalwork' },
  { slug: 'driftwood-shell', name: 'Driftwood Shell', region: 'coastal', material: 'weathered timber and shell lime', craft: 'boatbuilder coastal craft' },
  { slug: 'mossbank-wicker', name: 'Mossbank Wicker', region: 'marsh', material: 'sealed wicker and peat brick', craft: 'boardwalk marsh weaving' },
  { slug: 'sunstone-terracotta', name: 'Sunstone Terracotta', region: 'arid', material: 'gold terracotta and mesquite', craft: 'cool-touch courtyard craft' },
  { slug: 'frostpine-spruce', name: 'Frostpine Spruce', region: 'alpine', material: 'dense spruce and ironstone', craft: 'insulated alpine carving' },
  { slug: 'clover-mosaic', name: 'Clover Mosaic', region: 'meadow', material: 'cream tile and ash wood', craft: 'cooperative meadow mosaic' },
  { slug: 'cedarshade-barkwork', name: 'Cedarshade Barkwork', region: 'forest', material: 'fallen bark and greenstone', craft: 'low-impact forest barkwork' },
  { slug: 'reedmere-willow', name: 'Reedmere Willow', region: 'riverland', material: 'willow, reed, and river clay', craft: 'flexible backwater weaving' },
  { slug: 'amberfall-glass', name: 'Amberfall Glass', region: 'mountain', material: 'amber glass and dark stone', craft: 'sun-catching terrace craft' },
] as const

interface DecorationArchetype {
  readonly slug: string
  readonly name: string
  readonly type: DecorationType
  readonly purpose: string
  readonly width: number
  readonly depth: number
  readonly surfaces: readonly PlacementSurface[]
  readonly rotate: boolean
  readonly connectable: boolean
  readonly capabilities: readonly DecorationCapability[]
  readonly lightRadius: number
  readonly seats: number
  readonly storageSlots: number
  readonly pathSpeedMultiplier: number
  readonly barrierStrength: number
  readonly signTopic: string | null
  readonly basePrice: number
}

const DECORATION_ARCHETYPES: readonly DecorationArchetype[] = [
  { slug: 'walking-path', name: 'Walking Path', type: 'path', purpose: 'creates a connected all-weather walking surface that improves movement and accessible route readability', width: 1, depth: 1, surfaces: ['ground'], rotate: true, connectable: true, capabilities: ['connectivity', 'navigation'], lightRadius: 0, seats: 0, storageSlots: 0, pathSpeedMultiplier: 1.14, barrierStrength: 0, signTopic: null, basePrice: 35 },
  { slug: 'boundary-fence', name: 'Boundary Fence', type: 'fence', purpose: 'forms a connected livestock and garden boundary with a visible collision state', width: 1, depth: 1, surfaces: ['ground', 'path-edge'], rotate: true, connectable: true, capabilities: ['barrier', 'connectivity'], lightRadius: 0, seats: 0, storageSlots: 0, pathSpeedMultiplier: 1, barrierStrength: 8, signTopic: null, basePrice: 55 },
  { slug: 'wayfinding-sign', name: 'Wayfinding Sign', type: 'sign', purpose: 'shows a customizable destination, distance, icon, narration label, and route direction', width: 1, depth: 1, surfaces: ['ground', 'path-edge'], rotate: true, connectable: false, capabilities: ['navigation', 'signage'], lightRadius: 0, seats: 0, storageSlots: 0, pathSpeedMultiplier: 1, barrierStrength: 0, signTopic: 'wayfinding', basePrice: 85 },
  { slug: 'market-lantern', name: 'Market Lantern', type: 'light', purpose: 'provides warm dusk-to-dawn illumination with a manual toggle and reduced-flash state', width: 1, depth: 1, surfaces: ['ground', 'path-edge'], rotate: true, connectable: false, capabilities: ['lighting', 'navigation'], lightRadius: 8, seats: 0, storageSlots: 0, pathSpeedMultiplier: 1, barrierStrength: 0, signTopic: null, basePrice: 140 },
  { slug: 'rest-bench', name: 'Rest Bench', type: 'outdoor-object', purpose: 'offers three accessible rest positions that restore a small amount of energy over time', width: 2, depth: 1, surfaces: ['ground', 'path-edge'], rotate: true, connectable: false, capabilities: ['seating'], lightRadius: 0, seats: 3, storageSlots: 0, pathSpeedMultiplier: 1, barrierStrength: 0, signTopic: null, basePrice: 110 },
  { slug: 'picnic-table', name: 'Picnic Table', type: 'outdoor-object', purpose: 'supports six seated meals, conversations, gifts, games, and scheduled community breaks', width: 2, depth: 2, surfaces: ['ground'], rotate: true, connectable: false, capabilities: ['seating', 'storage'], lightRadius: 0, seats: 6, storageSlots: 2, pathSpeedMultiplier: 1, barrierStrength: 0, signTopic: null, basePrice: 180 },
  { slug: 'rain-shelter', name: 'Rain Shelter', type: 'outdoor-object', purpose: 'provides a navigable weather refuge, dry seating, and a safe NPC waiting point', width: 3, depth: 2, surfaces: ['ground', 'path-edge'], rotate: true, connectable: false, capabilities: ['weather-shelter', 'seating', 'navigation'], lightRadius: 0, seats: 4, storageSlots: 0, pathSpeedMultiplier: 1, barrierStrength: 2, signTopic: null, basePrice: 260 },
  { slug: 'raised-planter', name: 'Raised Planter', type: 'outdoor-object', purpose: 'holds seasonal flowers or herbs at an accessible interaction height and supports pollinators', width: 2, depth: 1, surfaces: ['ground', 'floor'], rotate: true, connectable: true, capabilities: ['storage'], lightRadius: 0, seats: 0, storageSlots: 6, pathSpeedMultiplier: 1, barrierStrength: 1, signTopic: null, basePrice: 125 },
  { slug: 'climbing-trellis', name: 'Climbing Trellis', type: 'fence', purpose: 'supports vines while forming a transparent connected garden boundary', width: 1, depth: 1, surfaces: ['ground', 'path-edge'], rotate: true, connectable: true, capabilities: ['barrier', 'connectivity'], lightRadius: 0, seats: 0, storageSlots: 0, pathSpeedMultiplier: 1, barrierStrength: 5, signTopic: null, basePrice: 95 },
  { slug: 'garden-gate', name: 'Garden Gate', type: 'fence', purpose: 'opens, closes, latches, and announces its state within a connected fence run', width: 1, depth: 1, surfaces: ['ground', 'path-edge'], rotate: true, connectable: true, capabilities: ['barrier', 'connectivity', 'navigation'], lightRadius: 0, seats: 0, storageSlots: 0, pathSpeedMultiplier: 1, barrierStrength: 7, signTopic: null, basePrice: 120 },
  { slug: 'parcel-chest', name: 'Parcel Chest', type: 'outdoor-object', purpose: 'stores delivered contracts and player parcels in persistent labelled slots', width: 1, depth: 1, surfaces: ['ground', 'floor'], rotate: true, connectable: false, capabilities: ['storage'], lightRadius: 0, seats: 0, storageSlots: 12, pathSpeedMultiplier: 1, barrierStrength: 2, signTopic: null, basePrice: 160 },
  { slug: 'notice-board', name: 'Notice Board', type: 'sign', purpose: 'shows searchable town notices, contracts, events, accessibility notices, and expiry states', width: 2, depth: 1, surfaces: ['ground', 'wall'], rotate: true, connectable: false, capabilities: ['signage', 'navigation'], lightRadius: 0, seats: 0, storageSlots: 0, pathSpeedMultiplier: 1, barrierStrength: 0, signTopic: 'community-notices', basePrice: 170 },
  { slug: 'path-beacon', name: 'Path Beacon', type: 'light', purpose: 'marks path edges with low-glare night lighting and a high-contrast navigation silhouette', width: 1, depth: 1, surfaces: ['path-edge', 'ground'], rotate: true, connectable: true, capabilities: ['lighting', 'navigation', 'connectivity'], lightRadius: 5, seats: 0, storageSlots: 0, pathSpeedMultiplier: 1, barrierStrength: 0, signTopic: null, basePrice: 105 },
  { slug: 'cycle-stand', name: 'Cycle Stand', type: 'outdoor-object', purpose: 'parks four bicycles or small mounts without blocking an accessible path', width: 2, depth: 1, surfaces: ['ground', 'path-edge'], rotate: true, connectable: true, capabilities: ['storage', 'navigation'], lightRadius: 0, seats: 0, storageSlots: 4, pathSpeedMultiplier: 1, barrierStrength: 2, signTopic: null, basePrice: 145 },
  { slug: 'footbridge', name: 'Footbridge', type: 'outdoor-object', purpose: 'creates a connected step-free crossing over a narrow stream, ditch, or marsh channel', width: 1, depth: 3, surfaces: ['shore', 'water'], rotate: true, connectable: true, capabilities: ['connectivity', 'navigation'], lightRadius: 0, seats: 0, storageSlots: 0, pathSpeedMultiplier: 1.08, barrierStrength: 5, signTopic: null, basePrice: 320 },
  { slug: 'recycling-station', name: 'Recycling Station', type: 'outdoor-object', purpose: 'sorts public waste into labelled persistent recovery slots and improves area cleanliness', width: 2, depth: 1, surfaces: ['ground', 'path-edge'], rotate: true, connectable: false, capabilities: ['storage', 'signage'], lightRadius: 0, seats: 0, storageSlots: 8, pathSpeedMultiplier: 1, barrierStrength: 1, signTopic: 'recycling', basePrice: 130 },
  { slug: 'courtyard-fountain', name: 'Courtyard Fountain', type: 'outdoor-object', purpose: 'provides a landmark, quiet seating edge, refill interaction, and cooling gathering point', width: 3, depth: 3, surfaces: ['ground', 'floor'], rotate: false, connectable: false, capabilities: ['navigation', 'seating'], lightRadius: 0, seats: 8, storageSlots: 0, pathSpeedMultiplier: 1, barrierStrength: 2, signTopic: null, basePrice: 420 },
  { slug: 'field-scarecrow', name: 'Field Scarecrow', type: 'outdoor-object', purpose: 'protects nearby ripe crops from bird loss while showing its active coverage area', width: 1, depth: 1, surfaces: ['ground'], rotate: true, connectable: false, capabilities: ['barrier', 'signage'], lightRadius: 0, seats: 0, storageSlots: 0, pathSpeedMultiplier: 1, barrierStrength: 3, signTopic: 'crop-protection', basePrice: 115 },
  { slug: 'festival-pennant', name: 'Festival Pennant', type: 'decoration', purpose: 'announces the current community festival and guides visitors between event spaces', width: 2, depth: 1, surfaces: ['ground', 'wall', 'path-edge'], rotate: true, connectable: true, capabilities: ['signage', 'navigation', 'connectivity'], lightRadius: 0, seats: 0, storageSlots: 0, pathSpeedMultiplier: 1, barrierStrength: 0, signTopic: 'festivals', basePrice: 90 },
  { slug: 'trail-bollard', name: 'Trail Bollard', type: 'outdoor-object', purpose: 'keeps vehicles out of walking routes while preserving a clearly marked accessible gap', width: 1, depth: 1, surfaces: ['ground', 'path-edge'], rotate: true, connectable: true, capabilities: ['barrier', 'navigation', 'connectivity'], lightRadius: 0, seats: 0, storageSlots: 0, pathSpeedMultiplier: 1, barrierStrength: 9, signTopic: null, basePrice: 80 },
] as const

function decorationPlacement(archetype: DecorationArchetype): DecorationPlacementDef {
  return {
    surfaces: archetype.surfaces,
    canRotate: archetype.rotate,
    connectable: archetype.connectable,
  }
}

function createDecoration(style: DecorationStyle, styleIndex: number, archetype: DecorationArchetype, archetypeIndex: number): DecorationDef {
  const id = 'decoration:' + style.slug + '-' + archetype.slug
  const keyStem = 'content.decoration.' + style.slug + '.' + archetype.slug
  const sequence = styleIndex * DECORATION_ARCHETYPES.length + archetypeIndex
  return {
    kind: 'decoration',
    id,
    name: style.name + ' ' + archetype.name,
    description: 'A functional ' + archetype.name.toLowerCase() + ' made from ' + style.material + ' with ' + style.craft + '; it ' + archetype.purpose + '.',
    nameKey: keyStem + '.name',
    descriptionKey: keyStem + '.description',
    seasons: ALL_SEASONS,
    regions: [style.region],
    unlock: unlockFor(styleIndex, archetypeIndex, DECORATION_ARCHETYPES.length, style.region),
    economy: structureEconomy(archetype.basePrice, sequence, 180),
    tags: ['structure', 'decoration', `type:${archetype.type}`, style.region, style.slug, archetype.slug],
    decorationType: archetype.type,
    footprint: {
      width: archetype.width,
      depth: archetype.depth,
      clearance: archetype.capabilities.includes('navigation') ? 1 : 0,
    },
    placement: decorationPlacement(archetype),
    functionality: {
      capabilities: archetype.capabilities,
      lightRadius: archetype.lightRadius,
      seats: archetype.seats,
      storageSlots: archetype.storageSlots,
      pathSpeedMultiplier: archetype.pathSpeedMultiplier,
      barrierStrength: archetype.barrierStrength,
      signTopic: archetype.signTopic,
    },
  }
}

export const VALLEY_DECORATIONS: readonly DecorationDef[] = DECORATION_STYLES
  .flatMap((style, styleIndex) => DECORATION_ARCHETYPES.map((archetype, archetypeIndex) => createDecoration(style, styleIndex, archetype, archetypeIndex)))
  .sort(canonicalById)

export const VALLEY_STRUCTURE_COUNTS = {
  factories: VALLEY_FACTORIES.length,
  buildings: VALLEY_BUILDINGS.length,
  decorations: VALLEY_DECORATIONS.length,
  total: VALLEY_FACTORIES.length + VALLEY_BUILDINGS.length + VALLEY_DECORATIONS.length,
} as const

type ValleyStructureDef = FactoryDef | BuildingDef | DecorationDef

function commonStructureProblems(definition: ValleyStructureDef): string[] {
  const problems: string[] = []
  if (!/^(factory|building|decoration):[a-z0-9]+(?:-[a-z0-9]+)+$/.test(definition.id)) {
    problems.push(definition.id + ' does not have a stable namespaced identifier')
  }
  if (definition.name.trim().length < 6 || /\b(?:placeholder|generic|sample|test|todo|tbd)\b/i.test(definition.name)) {
    problems.push(definition.id + ' has a missing or placeholder display name')
  }
  if (definition.description.trim().length < 80) problems.push(definition.id + ' lacks a substantive description')
  if (!definition.nameKey.endsWith('.name') || !definition.descriptionKey.endsWith('.description')) {
    problems.push(definition.id + ' lacks stable localization keys')
  }
  if (definition.seasons.length === 0 || definition.seasons.some((season) => !ALL_SEASONS.includes(season))) {
    problems.push(definition.id + ' has invalid seasonal availability')
  }
  if (definition.regions.length === 0) problems.push(definition.id + ' has no valley region')
  if (definition.unlock.level < 1 || definition.unlock.level > 100 || definition.unlock.reputation < 0 || definition.unlock.reputation > 1000) {
    problems.push(definition.id + ' has an invalid unlock rule')
  }
  if (definition.economy.purchasePrice <= 0 || definition.economy.maintenancePerDay <= 0 || definition.economy.sellPrice <= 0) {
    problems.push(definition.id + ' has an incomplete economy contract')
  }
  if (definition.tags.length < 5) problems.push(definition.id + ' has an incomplete authored taxonomy')
  if (definition.footprint.width <= 0 || definition.footprint.depth <= 0 || definition.footprint.clearance < 0) {
    problems.push(definition.id + ' has an invalid placement footprint')
  }
  return problems
}

function sanitationProblems(definition: FactoryDef | BuildingDef): string[] {
  const problems: string[] = []
  const sanitation = definition.sanitation
  if (
    sanitation.toilets < 1
    || sanitation.accessibleToilets < 1
    || sanitation.sinks < 1
    || sanitation.soapStations < 1
    || sanitation.dryingStations < 1
    || sanitation.wasteBins < 1
    || sanitation.mirrors < 1
    || sanitation.privacyDoors < 1
    || sanitation.handWashStations < 1
  ) {
    problems.push(definition.id + ' lacks a complete operational sanitation suite')
  }
  if (!definition.access.accessibleEntrance || definition.access.entranceCount < 1 || definition.access.eventualAccess.trim().length < 20) {
    problems.push(definition.id + ' lacks a usable accessible entrance and eventual access path')
  }
  if (definition.rooms.length < 6 || definition.rooms.some((room) => !room.accessible || room.purpose.trim().length < 30)) {
    problems.push(definition.id + ' has a missing, inaccessible, or purposeless room')
  }
  if (definition.stations.length < 6 || definition.stations.some((station) => !station.accessible || station.interaction.trim().length < 30 || station.assignedNpcRole.trim().length < 3)) {
    problems.push(definition.id + ' has a missing or incomplete functional station')
  }
  const stationIds = new Set(definition.stations.map((station) => station.id))
  if (stationIds.size !== definition.stations.length) problems.push(definition.id + ' has duplicate station IDs')
  const roomIds = new Set(definition.rooms.map((room) => room.id))
  if (roomIds.size !== definition.rooms.length) problems.push(definition.id + ' has duplicate room IDs')
  return problems
}

/**
 * Returns every local structures-catalogue defect. The global registry validator adds
 * localization dictionary, recipe/product/material reference, evidence, and total checks.
 */
export function valleyStructureProblems(): readonly string[] {
  const problems: string[] = []
  if (VALLEY_FACTORIES.length !== 400) problems.push('expected exactly 400 factories, found ' + VALLEY_FACTORIES.length)
  if (VALLEY_BUILDINGS.length !== 300) problems.push('expected exactly 300 non-factory buildings, found ' + VALLEY_BUILDINGS.length)
  if (VALLEY_DECORATIONS.length !== 400) problems.push('expected exactly 400 functional decorations, found ' + VALLEY_DECORATIONS.length)

  const all: readonly ValleyStructureDef[] = [...VALLEY_FACTORIES, ...VALLEY_BUILDINGS, ...VALLEY_DECORATIONS]
  const ids = new Set<string>()
  const localizationKeys = new Set<string>()
  const names = new Set<string>()
  for (const definition of all) {
    problems.push(...commonStructureProblems(definition))
    if (ids.has(definition.id)) problems.push('duplicate structure ID ' + definition.id)
    ids.add(definition.id)
    const foldedName = definition.name.trim().toLocaleLowerCase('en')
    if (names.has(foldedName)) problems.push('duplicate semantic structure name ' + definition.name)
    names.add(foldedName)
    for (const key of [definition.nameKey, definition.descriptionKey]) {
      if (localizationKeys.has(key)) problems.push('duplicate localization key ' + key)
      localizationKeys.add(key)
    }
  }

  const capabilityCoverage = new Set<FactoryCapability>()
  for (const factory of VALLEY_FACTORIES) {
    problems.push(...sanitationProblems(factory))
    if (factory.queueCapacity < 1 || factory.staffCapacity < 1 || factory.capabilities.length === 0) {
      problems.push(factory.id + ' lacks production capacity or capability')
    }
    for (const capability of factory.capabilities) capabilityCoverage.add(capability)
  }
  for (const capability of FACTORY_CAPABILITIES) {
    if (!capabilityCoverage.has(capability)) problems.push('no factory provides ' + capability)
  }

  for (const building of VALLEY_BUILDINGS) {
    problems.push(...sanitationProblems(building))
    if (building.occupantCapacity < 1 || building.visitorCapacity < 1 || building.capabilities.length === 0) {
      problems.push(building.id + ' lacks occupancy or a real service capability')
    }
  }

  for (const decoration of VALLEY_DECORATIONS) {
    const functionality = decoration.functionality
    if (functionality.capabilities.length === 0) problems.push(decoration.id + ' has no gameplay capability')
    if (
      functionality.lightRadius < 0
      || functionality.seats < 0
      || functionality.storageSlots < 0
      || functionality.pathSpeedMultiplier <= 0
      || functionality.barrierStrength < 0
    ) {
      problems.push(decoration.id + ' has invalid functional values')
    }
    if (decoration.decorationType === 'sign' && functionality.signTopic === null) {
      problems.push(decoration.id + ' is a sign without a functional topic')
    }
    if (decoration.decorationType === 'light' && functionality.lightRadius <= 0) {
      problems.push(decoration.id + ' is a light without illumination')
    }
    if (decoration.decorationType === 'path' && functionality.pathSpeedMultiplier <= 1) {
      problems.push(decoration.id + ' is a path without a movement function')
    }
    if (decoration.decorationType === 'fence' && functionality.barrierStrength <= 0) {
      problems.push(decoration.id + ' is a fence without a barrier function')
    }
  }
  return problems
}

export function assertValleyStructuresComplete(): void {
  const problems = valleyStructureProblems()
  if (problems.length > 0) {
    throw new Error('Sprout Hollow Valley structure catalogue is incomplete:\n- ' + problems.join('\n- '))
  }
}
