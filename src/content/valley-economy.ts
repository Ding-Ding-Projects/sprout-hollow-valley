/**
 * Deterministic economy catalogue for Sprout Hollow Valley.
 *
 * The catalogue is assembled from authored taxonomies rather than counters or
 * placeholder rows. Crop, orchard, and animal products adopt the exact product
 * IDs declared by their source definitions, while artisan and refined goods are
 * generated from named process blueprints. Every recipe therefore refers only
 * to a material or product that is present in this module's exported registries.
 */
import { ALL_SEASONS, FACTORY_CAPABILITIES } from './types'
import type {
  EconomyDef,
  FactoryCapability,
  MaterialCategory,
  MaterialDef,
  MaterialSourceKind,
  ProductCategory,
  ProductDef,
  ProductUnit,
  RecipeDef,
  Renewability,
  Season,
  SellingChannel,
  UnlockDef,
} from './types'
import {
  VALLEY_ANIMALS,
  VALLEY_CROPS,
  VALLEY_ORCHARD_PLANTS,
} from './valley-flora-fauna'

const REGIONS = [
  'region:meadow',
  'region:forest',
  'region:riverland',
  'region:mountain',
  'region:coastal',
  'region:marsh',
  'region:arid',
  'region:alpine',
] as const

const QUALITY_GRADES = ['standard', 'fine', 'premium', 'masterwork'] as const
const SELLING_CHANNELS: readonly SellingChannel[] = [
  'farm-gate',
  'market-stall',
  'shipping-bin',
  'town-order',
  'wholesale',
]

function compareId(a: { readonly id: string }, b: { readonly id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function idLeaf(id: string): string {
  const separator = id.indexOf(':')
  return separator >= 0 ? id.slice(separator + 1) : id
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(' ')
}

function localizationKeys(kind: 'material' | 'product' | 'recipe', id: string): {
  readonly nameKey: string
  readonly descriptionKey: string
} {
  const leaf = idLeaf(id).replace(/-/g, '.')
  return {
    nameKey: `content.${kind}.${leaf}.name`,
    descriptionKey: `content.${kind}.${leaf}.description`,
  }
}

function seasonsFromOffset(index: number, breadth = 2): readonly Season[] {
  const seasons: Season[] = []
  for (let offset = 0; offset < breadth; offset += 1) {
    seasons.push(ALL_SEASONS[(index + offset) % ALL_SEASONS.length]!)
  }
  return seasons
}

function seasonalDemand(index: number, peak = 1.24): EconomyDef['seasonalDemand'] {
  const values = { spring: 0.94, summer: 0.94, fall: 0.94, winter: 0.94 }
  values[ALL_SEASONS[index % ALL_SEASONS.length]!] = peak
  values[ALL_SEASONS[(index + 1) % ALL_SEASONS.length]!] = 1.08
  return values
}

function unlockFor(index: number, prerequisiteIds: readonly string[] = [], minimumLevel = 1): UnlockDef {
  const level = Math.max(minimumLevel, 1 + (index % 100))
  const regionId = REGIONS[Math.floor(index / 13) % REGIONS.length]!
  return {
    level,
    reputation: Math.min(1000, Math.floor(level / 5) * 35),
    regionId,
    questId: level % 20 === 0 ? `quest:economy-milestone-${level}` : null,
    prerequisiteIds,
  }
}

function economyFor(baseValue: number, index: number, purchasable: boolean): EconomyDef {
  const sellPrice = Math.max(1, Math.round(baseValue))
  return {
    purchasePrice: purchasable ? Math.max(sellPrice + 1, Math.round(sellPrice * 1.42)) : 0,
    sellPrice,
    craftValue: Math.max(1, Math.round(sellPrice * 0.82)),
    maintenancePerDay: 0,
    marketElasticity: 0.35 + (index % 7) * 0.15,
    seasonalDemand: seasonalDemand(index),
  }
}

interface MaterialFamily {
  readonly category: MaterialCategory
  readonly sourceKinds: readonly MaterialSourceKind[]
  readonly renewability: Renewability
  readonly habitat: string
  readonly purpose: string
  readonly names: readonly string[]
}

const MATERIAL_FAMILIES: readonly MaterialFamily[] = [
  {
    category: 'timber',
    sourceKinds: ['forestry', 'trade'],
    renewability: 'renewable',
    habitat: 'managed woodland stands',
    purpose: 'structural joinery, tool handles, and weatherproof farm construction',
    names: [
      'Alder Log', 'Ash Log', 'Aspen Log', 'Beech Log', 'Birch Log',
      'Blackwood Log', 'Cedar Log', 'Cherrywood Log', 'Chestnut Log', 'Cypress Log',
      'Dogwood Log', 'Douglas Fir Log', 'Elm Log', 'Eucalyptus Log', 'Fir Log',
      'Hazelwood Log', 'Hemlock Log', 'Hickory Log', 'Holly Log', 'Juniper Log',
      'Larch Log', 'Linden Log', 'Maple Log', 'Oak Log', 'Olivewood Log',
      'Pine Log', 'Poplar Log', 'Redwood Log', 'Spruce Log', 'Walnut Log',
    ],
  },
  {
    category: 'mineral',
    sourceKinds: ['mining', 'trade'],
    renewability: 'finite',
    habitat: 'surveyed quarry benches and ore seams',
    purpose: 'masonry, metal refining, kiln work, and durable machine components',
    names: [
      'Granite Block', 'Basalt Block', 'Limestone Chunk', 'Sandstone Slab', 'Slate Shard',
      'Marble Block', 'Quartzite Chunk', 'Obsidian Shard', 'Pumice Stone', 'Soapstone Chunk',
      'Flint Nodule', 'Chalk Stone', 'Gypsum Crystal', 'Feldspar Chunk', 'Mica Flake',
      'Kaolin Stone', 'Copper Ore', 'Tin Ore', 'Iron Ore', 'Zinc Ore',
      'Nickel Ore', 'Silver Ore', 'Gold Ore', 'Cobalt Ore', 'Manganese Ore',
      'Bauxite Ore', 'Chromite Ore', 'Magnetite Ore', 'Hematite Ore', 'Pyrite Ore',
    ],
  },
  {
    category: 'fiber',
    sourceKinds: ['foraging', 'refining', 'trade'],
    renewability: 'renewable',
    habitat: 'field margins, fibre plots, and managed wetland beds',
    purpose: 'rope, cloth, basketry, paper stock, and protective packing',
    names: [
      'Flax Fibre', 'Hemp Fibre', 'Jute Fibre', 'Ramie Fibre', 'Nettle Fibre',
      'Kenaf Fibre', 'Sisal Fibre', 'Abaca Fibre', 'Coir Fibre', 'Kapok Fibre',
      'Cotton Boll', 'Linen Tow', 'Bamboo Fibre', 'Banana Fibre', 'Pineapple Fibre',
      'Lotus Fibre', 'Milkweed Floss', 'Reed Fibre', 'Rush Fibre', 'Sedge Fibre',
      'Raffia Fibre', 'Esparto Fibre', 'Palm Fibre', 'Willow Bast', 'Linden Bast',
      'Mulberry Bast', 'Paperbark Fibre', 'Corn Husk Fibre', 'Rice Straw Fibre', 'Wheat Straw Fibre',
    ],
  },
  {
    category: 'ceramic',
    sourceKinds: ['clearing', 'mining', 'refining'],
    renewability: 'slow-renewable',
    habitat: 'river cuts, clay pits, salt pans, and screened soil banks',
    purpose: 'pottery bodies, glass batches, masonry binders, and soil amendments',
    names: [
      'Red Clay', 'White Clay', 'Blue Clay', 'Fire Clay', 'Ball Clay',
      'Bentonite Clay', 'Terracotta Clay', 'Stoneware Clay', 'Porcelain Clay', 'Loam Soil',
      'Peat Soil', 'Silt Soil', 'Volcanic Ash', 'River Sand', 'Silica Sand',
      'Black Sand', 'Coral Sand', 'Gravel Aggregate', 'Crushed Shell', 'Sea Salt',
      'Rock Salt', 'Pink Salt', 'Epsom Salt', 'Soda Ash', 'Potash',
      'Lime Powder', 'Dolomite Powder', 'Diatomaceous Earth', 'Charcoal Fines', 'Biochar Granules',
    ],
  },
  {
    category: 'botanical',
    sourceKinds: ['foraging', 'forestry', 'trade'],
    renewability: 'renewable',
    habitat: 'tapped groves, herb terraces, and carefully rotated wild patches',
    purpose: 'adhesives, medicines, fragrances, flavouring, and protective finishes',
    names: [
      'Pine Resin', 'Fir Resin', 'Spruce Gum', 'Birch Sap', 'Maple Sap',
      'Acacia Gum', 'Frankincense Resin', 'Myrrh Resin', 'Copal Resin', 'Mastic Resin',
      "Dragon's Blood Resin", 'Natural Latex', 'Cork Bark', 'Cinnamon Bark', 'Willow Bark',
      'Quinine Bark', 'Vanilla Pod', 'Cacao Husk', 'Coffee Chaff', 'Tea Stem',
      'Lavender Bundle', 'Rosemary Bundle', 'Sage Bundle', 'Thyme Bundle', 'Mint Bundle',
      'Chamomile Bundle', 'Yarrow Bundle', 'Comfrey Bundle', 'Lemon Balm Bundle', 'Echinacea Root',
    ],
  },
  {
    category: 'reagent',
    sourceKinds: ['animal-care', 'foraging', 'trade'],
    renewability: 'renewable',
    habitat: 'ethical animal-care collections and naturally shed deposits',
    purpose: 'textiles, polish, glue, soil conditioning, and fine craft work',
    names: [
      'Sheep Fleece', 'Alpaca Fleece', 'Angora Fleece', 'Goat Fleece', 'Yak Fleece',
      'Camel Fleece', 'Bison Fibre', 'Cashmere Tuft', 'Mohair Lock', 'Raw Silk Cocoon',
      'Beeswax Comb', 'Raw Honeycomb', 'Tallow Cake', 'Lanolin Wax', 'Bone Fragment',
      'Antler Shed', 'Horn Sheath', 'Feather Quill', 'Down Cluster', 'Eggshell Grit',
      'Oyster Shell', 'Snail Shell', 'Crab Shell', 'Lobster Shell', 'Fish Scale',
      'Fish Skin', 'Rawhide Sheet', 'Parchment Skin', 'Hoof Keratin', 'Natural Sponge',
    ],
  },
  {
    category: 'reagent',
    sourceKinds: ['foraging', 'trade'],
    renewability: 'slow-renewable',
    habitat: 'licensed shore harvests and storm-cast coastal deposits',
    purpose: 'food-grade gels, marine fertiliser, shell inlay, and coastal craft stock',
    names: [
      'Kelp Frond', 'Wakame Frond', 'Nori Laver', 'Dulse Frond', 'Sea Lettuce',
      'Bladderwrack', 'Irish Moss', 'Sea Grapes', 'Kombu Frond', 'Hijiki Frond',
      'Agar Weed', 'Carrageen Moss', 'Eelgrass Fibre', 'Seagrass Bundle', 'Driftwood Branch',
      'Pearl Oyster', 'Mother-of-Pearl Shell', 'Abalone Shell', 'Conch Shell', 'Scallop Shell',
      'Cuttlefish Bone', 'Coral Rubble', 'Sea Urchin Spine', 'Barnacle Cluster', 'Horseshoe Crab Shell',
      'Shark Egg Case', 'Whelk Shell', 'Cowrie Shell', 'Sea Glass Shard', 'Brine Mineral Slurry',
    ],
  },
  {
    category: 'reagent',
    sourceKinds: ['foraging', 'refining', 'trade'],
    renewability: 'renewable',
    habitat: 'dye gardens, mineral washes, and documented traditional colour sources',
    purpose: 'lightfast textile dyes, ceramic slips, paints, inks, and sign finishes',
    names: [
      'Madder Root Dye', 'Indigo Leaf Dye', 'Woad Leaf Dye', 'Weld Flower Dye', 'Marigold Petal Dye',
      'Safflower Dye', 'Annatto Seed Dye', 'Cochineal Lake', 'Lac Dye', 'Walnut Hull Dye',
      'Onion Skin Dye', 'Avocado Pit Dye', 'Logwood Dye', 'Brazilwood Dye', 'Alkanet Root Dye',
      'Turmeric Dye', 'Saffron Dye', 'Beetroot Dye', 'Red Ochre Pigment', 'Yellow Ochre Pigment',
      'Umber Pigment', 'Sienna Pigment', 'Bone Black Pigment', 'Vine Black Pigment', 'Chalk White Pigment',
      'Malachite Green Pigment', 'Azurite Blue Pigment', 'Ultramarine Mineral', 'Manganese Violet Pigment', 'Sepia Ink',
    ],
  },
  {
    category: 'ore',
    sourceKinds: ['recycling', 'trade'],
    renewability: 'recycled',
    habitat: 'the valley reclamation yard and repair-shop salvage stream',
    purpose: 'repair stock, foundry feed, replacement fittings, and low-waste construction',
    names: [
      'Wrought Iron Scrap', 'Cast Iron Scrap', 'Steel Offcut', 'Copper Wire Scrap', 'Brass Fitting',
      'Bronze Gear Blank', 'Aluminum Sheet Scrap', 'Zinc Plate Scrap', 'Tin Sheet Scrap', 'Lead-Free Pewter Scrap',
      'Stainless Steel Mesh', 'Galvanized Nail Bundle', 'Reclaimed Bolt Bundle', 'Reclaimed Screw Bundle', 'Chain Link Segment',
      'Bicycle Spoke Bundle', 'Machine Spring', 'Bearing Race', 'Glass Cullet', 'Ceramic Sherd',
      'Brick Fragment', 'Reclaimed Tile', 'Rubber Offcut', 'Leather Offcut', 'Canvas Offcut',
      'Rope Offcut', 'Cardboard Pulp', 'Paper Rag', 'Cork Offcut', 'Wood Shaving',
    ],
  },
  {
    category: 'mineral',
    sourceKinds: ['mining', 'trade'],
    renewability: 'finite',
    habitat: 'mapped crystal pockets and community gem-cutting claims',
    purpose: 'precision lenses, jewellery, mosaics, instruments, and high-value commissions',
    names: [
      'Clear Quartz Crystal', 'Rose Quartz Crystal', 'Smoky Quartz Crystal', 'Amethyst Crystal', 'Citrine Crystal',
      'Agate Nodule', 'Jasper Stone', 'Carnelian Stone', 'Onyx Stone', 'Chalcedony Stone',
      'Moonstone', 'Sunstone', 'Labradorite', 'Garnet Crystal', 'Peridot Crystal',
      'Aquamarine Crystal', 'Tourmaline Crystal', 'Topaz Crystal', 'Spinel Crystal', 'Zircon Crystal',
      'Opal Rough', 'Jade Rough', 'Turquoise Rough', 'Lapis Lazuli Rough', 'Malachite Rough',
      'Azurite Rough', 'Fluorite Crystal', 'Calcite Crystal', 'Selenite Crystal', 'Geode Half',
    ],
  },
]

function materialDefinition(family: MaterialFamily, name: string, index: number): MaterialDef {
  const id = `material:${slugify(name)}`
  return {
    kind: 'material',
    id,
    name,
    description: `${name} is responsibly gathered from ${family.habitat} for ${family.purpose}.`,
    ...localizationKeys('material', id),
    seasons: family.renewability === 'finite' ? ALL_SEASONS : seasonsFromOffset(index, 3),
    regions: [REGIONS[index % REGIONS.length]!, REGIONS[(index + 3) % REGIONS.length]!],
    unlock: unlockFor(index),
    economy: economyFor(6 + (index % 30) * 3 + Math.floor(index / 30) * 8, index, true),
    tags: [family.category, family.renewability, ...family.sourceKinds],
    materialCategory: family.category,
    sourceKinds: family.sourceKinds,
    renewability: family.renewability,
    qualityGrades: QUALITY_GRADES,
    stackLimit: family.category === 'timber' || family.category === 'mineral' ? 80 : 160,
    weight: Number((0.15 + (index % 17) * 0.21).toFixed(2)),
  }
}

const MATERIAL_ROWS = MATERIAL_FAMILIES.flatMap((family) =>
  family.names.map((name, localIndex) => ({ family, name, localIndex })),
)

export const VALLEY_MATERIALS: readonly MaterialDef[] = Object.freeze(
  MATERIAL_ROWS
    .map(({ family, name }, index) => materialDefinition(family, name, index))
    .sort(compareId),
)

interface ProductBlueprint {
  readonly definition: ProductDef
  readonly primaryInputId: string
  readonly recipeSlug: string
  readonly capability: FactoryCapability
  readonly recipeCategory: string
  readonly baseDurationMinutes: number
  readonly baseProductionCost: number
  readonly additiveMaterialId: string | null
}

function productEconomy(baseValue: number, index: number): EconomyDef {
  return economyFor(baseValue, index, false)
}

const FRESH_SOURCE_DEFS = [
  ...VALLEY_CROPS.map((definition) => ({ definition, sourceKind: 'crop' as const, category: 'crop' as const })),
  ...VALLEY_ORCHARD_PLANTS.map((definition) => ({ definition, sourceKind: 'orchard' as const, category: 'orchard' as const })),
].sort((a, b) => compareId(a.definition, b.definition))

const FRESH_PRODUCTS: readonly ProductDef[] = FRESH_SOURCE_DEFS.map(
  ({ definition, sourceKind, category }, index): ProductDef => {
    const id = definition.yield.productId
    return {
      kind: 'product',
      id,
      name: `Fresh ${definition.name}`,
      description: `A carefully graded harvest of ${definition.name}, packed at field temperature for direct sale or further valley processing.`,
      ...localizationKeys('product', id),
      seasons: definition.seasons,
      regions: definition.regions,
      unlock: unlockFor(index, [definition.id], definition.unlock.level),
      economy: productEconomy(12 + (index % 43) * 3, index),
      tags: ['fresh', category, idLeaf(definition.id)],
      productCategory: category,
      sourceKind,
      sourceIds: [definition.id],
      perishableDays: 5 + (index % 8),
      qualityGrades: QUALITY_GRADES,
      unit: 'each',
      sellingChannels: SELLING_CHANNELS,
    }
  },
)

const ANIMAL_PRODUCTS: readonly ProductDef[] = VALLEY_ANIMALS
  .flatMap((animal, animalIndex) =>
    animal.products.map((product, productIndex): ProductDef => {
      const prefix = `product:animal-${idLeaf(animal.id)}-`
      const commoditySlug = product.productId.startsWith(prefix)
        ? product.productId.slice(prefix.length)
        : idLeaf(product.productId)
      const commodityName = titleCase(commoditySlug)
      const index = animalIndex * 7 + productIndex
      return {
        kind: 'product',
        id: product.productId,
        name: `${animal.name} ${commodityName}`,
        description: `${animal.name} caretakers collect this ${commodityName.toLowerCase()} on its ${product.intervalDays}-day welfare-first husbandry cycle, then grade it for valley markets.`,
        ...localizationKeys('product', product.productId),
        seasons: animal.seasons,
        regions: animal.regions,
        unlock: unlockFor(index, [animal.id], animal.unlock.level),
        economy: productEconomy(28 + animalIndex * 2 + productIndex * 7, index),
        tags: ['animal-good', animal.speciesGroup, commoditySlug],
        productCategory: 'animal-good',
        sourceKind: 'animal',
        sourceIds: [animal.id],
        perishableDays: /milk|egg|fish|shellfish|honey/.test(commoditySlug) ? 10 : null,
        qualityGrades: QUALITY_GRADES,
        unit: /milk|honey/.test(commoditySlug) ? 'litre' : /wool|fiber|wax/.test(commoditySlug) ? 'bundle' : 'each',
        sellingChannels: SELLING_CHANNELS,
      }
    }),
  )
  .sort(compareId)

function materialProductCategory(material: MaterialDef): ProductCategory {
  if (material.materialCategory === 'fiber') return 'fabric'
  if (material.materialCategory === 'botanical' || material.materialCategory === 'reagent') return 'household'
  return 'refined'
}

function materialProductUnit(material: MaterialDef): ProductUnit {
  if (material.materialCategory === 'fiber') return 'metre'
  if (material.materialCategory === 'timber') return 'bundle'
  return 'kilogram'
}

function materialCapability(category: MaterialCategory): FactoryCapability {
  switch (category) {
    case 'timber': return 'capability:carpentry'
    case 'fiber': return 'capability:weaving'
    case 'ceramic': return 'capability:pottery'
    case 'botanical': return 'capability:extracting'
    case 'reagent': return 'capability:blending'
    case 'ore': return 'capability:forging'
    case 'glass': return 'capability:glassmaking'
    case 'fuel': return 'capability:roasting'
    case 'stone': return 'capability:cleaning'
    case 'mineral': return 'capability:smelting'
  }
}

const MATERIAL_PRODUCT_BLUEPRINTS: readonly ProductBlueprint[] = VALLEY_MATERIALS.map(
  (material, index): ProductBlueprint => {
    const id = `product:refined-${idLeaf(material.id)}`
    const capability = materialCapability(material.materialCategory)
    const definition: ProductDef = {
      kind: 'product',
      id,
      name: `Refined ${material.name}`,
      description: `${material.name} cleaned, graded, and prepared as dependable ${materialProductCategory(material)} stock for workshops and town contracts.`,
      ...localizationKeys('product', id),
      seasons: material.seasons,
      regions: material.regions,
      unlock: unlockFor(index + 35, [material.id], material.unlock.level),
      economy: productEconomy(material.economy.craftValue * 2.1 + 18, index + 900),
      tags: ['refined', material.materialCategory, idLeaf(material.id)],
      productCategory: materialProductCategory(material),
      sourceKind: 'material',
      sourceIds: [material.id],
      perishableDays: null,
      qualityGrades: QUALITY_GRADES,
      unit: materialProductUnit(material),
      sellingChannels: SELLING_CHANNELS,
    }
    return {
      definition,
      primaryInputId: material.id,
      recipeSlug: `refined-${idLeaf(material.id)}`,
      capability,
      recipeCategory: `${material.materialCategory}-refining`,
      baseDurationMinutes: 45 + (index % 16) * 15,
      baseProductionCost: 4 + (index % 21) * 2,
      additiveMaterialId: null,
    }
  },
)

interface ProcessSpec {
  readonly slug: string
  readonly label: string
  readonly description: string
  readonly productCategory: ProductCategory
  readonly unit: ProductUnit
  readonly perishableDays: number | null
  readonly capability: FactoryCapability
  readonly durationMinutes: number
  readonly valueMultiplier: number
  readonly additiveMaterialId: string
}

const PROCESS_SPECS: readonly ProcessSpec[] = [
  { slug: 'preserve', label: 'Preserve', description: 'slow-set fruit preserve', productCategory: 'preserve', unit: 'jar', perishableDays: 180, capability: 'capability:preserving', durationMinutes: 240, valueMultiplier: 2.05, additiveMaterialId: 'material:maple-sap' },
  { slug: 'pickle', label: 'Pickle', description: 'crisp cellar pickle', productCategory: 'preserve', unit: 'jar', perishableDays: 150, capability: 'capability:pickling', durationMinutes: 360, valueMultiplier: 2.12, additiveMaterialId: 'material:sea-salt' },
  { slug: 'chutney', label: 'Chutney', description: 'spiced slow-cooked chutney', productCategory: 'preserve', unit: 'jar', perishableDays: 120, capability: 'capability:cooking', durationMinutes: 210, valueMultiplier: 2.28, additiveMaterialId: 'material:cinnamon-bark' },
  { slug: 'relish', label: 'Relish', description: 'bright savoury relish', productCategory: 'preserve', unit: 'jar', perishableDays: 90, capability: 'capability:cooking', durationMinutes: 150, valueMultiplier: 2.02, additiveMaterialId: 'material:rock-salt' },
  { slug: 'jam', label: 'Jam', description: 'copper-kettle jam', productCategory: 'preserve', unit: 'jar', perishableDays: 180, capability: 'capability:preserving', durationMinutes: 180, valueMultiplier: 2.18, additiveMaterialId: 'material:maple-sap' },
  { slug: 'jelly', label: 'Jelly', description: 'clear strained jelly', productCategory: 'preserve', unit: 'jar', perishableDays: 180, capability: 'capability:preserving', durationMinutes: 225, valueMultiplier: 2.24, additiveMaterialId: 'material:acacia-gum' },
  { slug: 'syrup', label: 'Syrup', description: 'pan-reduced botanical syrup', productCategory: 'artisan', unit: 'bottle', perishableDays: 120, capability: 'capability:extracting', durationMinutes: 270, valueMultiplier: 2.34, additiveMaterialId: 'material:maple-sap' },
  { slug: 'nectar', label: 'Nectar', description: 'gently pressed nectar', productCategory: 'beverage', unit: 'bottle', perishableDays: 21, capability: 'capability:pressing', durationMinutes: 75, valueMultiplier: 1.82, additiveMaterialId: 'material:acacia-gum' },
  { slug: 'juice', label: 'Juice', description: 'cold-pressed juice', productCategory: 'beverage', unit: 'bottle', perishableDays: 14, capability: 'capability:pressing', durationMinutes: 60, valueMultiplier: 1.72, additiveMaterialId: 'material:sea-salt' },
  { slug: 'vinegar', label: 'Vinegar', description: 'barrel-cultured vinegar', productCategory: 'artisan', unit: 'bottle', perishableDays: null, capability: 'capability:fermenting', durationMinutes: 1440, valueMultiplier: 2.62, additiveMaterialId: 'material:charcoal-fines' },
  { slug: 'cordial', label: 'Cordial', description: 'concentrated valley cordial', productCategory: 'beverage', unit: 'bottle', perishableDays: 90, capability: 'capability:blending', durationMinutes: 210, valueMultiplier: 2.4, additiveMaterialId: 'material:vanilla-pod' },
  { slug: 'infusion', label: 'Infusion', description: 'fragrant steeped infusion', productCategory: 'beverage', unit: 'packet', perishableDays: 240, capability: 'capability:brewing', durationMinutes: 120, valueMultiplier: 1.96, additiveMaterialId: 'material:mint-bundle' },
  { slug: 'powder', label: 'Powder', description: 'low-temperature dried powder', productCategory: 'artisan', unit: 'packet', perishableDays: 300, capability: 'capability:drying', durationMinutes: 480, valueMultiplier: 2.22, additiveMaterialId: 'material:rice-straw-fibre' },
  { slug: 'meal', label: 'Meal', description: 'stone-milled whole meal', productCategory: 'cooked-food', unit: 'kilogram', perishableDays: 120, capability: 'capability:milling', durationMinutes: 150, valueMultiplier: 2.08, additiveMaterialId: 'material:flint-nodule' },
  { slug: 'oil', label: 'Cold-Pressed Oil', description: 'first-press culinary oil', productCategory: 'artisan', unit: 'bottle', perishableDays: 180, capability: 'capability:pressing', durationMinutes: 300, valueMultiplier: 2.72, additiveMaterialId: 'material:charcoal-fines' },
  { slug: 'paste', label: 'Paste', description: 'silky mortar-ground paste', productCategory: 'cooked-food', unit: 'jar', perishableDays: 45, capability: 'capability:blending', durationMinutes: 135, valueMultiplier: 2.16, additiveMaterialId: 'material:sea-salt' },
  { slug: 'sauce', label: 'Sauce', description: 'balanced hearth-cooked sauce', productCategory: 'cooked-food', unit: 'bottle', perishableDays: 45, capability: 'capability:cooking', durationMinutes: 195, valueMultiplier: 2.3, additiveMaterialId: 'material:thyme-bundle' },
  { slug: 'seasoning', label: 'Seasoning', description: 'aromatic dried seasoning', productCategory: 'artisan', unit: 'packet', perishableDays: 365, capability: 'capability:drying', durationMinutes: 420, valueMultiplier: 2.48, additiveMaterialId: 'material:rock-salt' },
  { slug: 'confection', label: 'Confection', description: 'small-batch pulled confection', productCategory: 'artisan', unit: 'packet', perishableDays: 90, capability: 'capability:confectionery', durationMinutes: 240, valueMultiplier: 2.86, additiveMaterialId: 'material:vanilla-pod' },
  { slug: 'ferment', label: 'Ferment', description: 'live crock-cultured ferment', productCategory: 'artisan', unit: 'jar', perishableDays: 120, capability: 'capability:fermenting', durationMinutes: 960, valueMultiplier: 2.54, additiveMaterialId: 'material:sea-salt' },
]

function processedProductBlueprint(
  source: ProductDef,
  process: ProcessSpec,
  index: number,
): ProductBlueprint {
  const sourceSlug = idLeaf(source.id).replace(/^fresh-/, '')
  const sourceName = source.name.replace(/^Fresh /, '')
  const id = `product:${process.slug}-${sourceSlug}`
  const primaryRecipeId = `recipe:cooperative-${process.slug}-${sourceSlug}`
  const definition: ProductDef = {
    kind: 'product',
    id,
    name: `${sourceName} ${process.label}`,
    description: `A ${process.description} made from traceable ${sourceName} harvests with a process tuned for flavour, shelf life, and consistent quality.`,
    ...localizationKeys('product', id),
    seasons: source.seasons,
    regions: source.regions,
    unlock: unlockFor(index + 18, [source.id], source.unlock.level),
    economy: productEconomy(source.economy.sellPrice * process.valueMultiplier + 15, index + 1600),
    tags: ['processed', process.slug, sourceSlug],
    productCategory: process.productCategory,
    sourceKind: 'recipe',
    sourceIds: [primaryRecipeId],
    perishableDays: process.perishableDays,
    qualityGrades: QUALITY_GRADES,
    unit: process.unit,
    sellingChannels: SELLING_CHANNELS,
  }
  return {
    definition,
    primaryInputId: source.id,
    recipeSlug: `${process.slug}-${sourceSlug}`,
    capability: process.capability,
    recipeCategory: process.slug,
    baseDurationMinutes: process.durationMinutes,
    baseProductionCost: 5 + (index % 23) * 2,
    additiveMaterialId: process.additiveMaterialId,
  }
}

const RAW_PRODUCT_COUNT = FRESH_PRODUCTS.length + ANIMAL_PRODUCTS.length
const PROCESSED_PRODUCT_TARGET = 1500 - RAW_PRODUCT_COUNT - MATERIAL_PRODUCT_BLUEPRINTS.length

const PROCESSED_PRODUCT_BLUEPRINTS: readonly ProductBlueprint[] = FRESH_PRODUCTS
  .flatMap((source, sourceIndex) =>
    PROCESS_SPECS.map((process, processIndex) =>
      processedProductBlueprint(source, process, sourceIndex * PROCESS_SPECS.length + processIndex),
    ),
  )
  .slice(0, Math.max(0, PROCESSED_PRODUCT_TARGET))

const ALL_PRODUCT_ROWS: readonly ProductDef[] = [
  ...FRESH_PRODUCTS,
  ...ANIMAL_PRODUCTS,
  ...MATERIAL_PRODUCT_BLUEPRINTS.map((blueprint) => blueprint.definition),
  ...PROCESSED_PRODUCT_BLUEPRINTS.map((blueprint) => blueprint.definition),
]

export const VALLEY_PRODUCTS: readonly ProductDef[] = Object.freeze(
  [...ALL_PRODUCT_ROWS].sort(compareId),
)

interface RecipeTechnique {
  readonly slug: string
  readonly label: string
  readonly description: string
  readonly inputQuantity: number
  readonly outputQuantity: number
  readonly durationMultiplier: number
  readonly costMultiplier: number
  readonly unlockOffset: number
}

const RECIPE_TECHNIQUES: readonly RecipeTechnique[] = [
  {
    slug: 'cooperative',
    label: 'Cooperative Workshop',
    description: 'the valley cooperative standard, balancing material use, labour, and dependable output',
    inputQuantity: 3,
    outputQuantity: 1,
    durationMultiplier: 1,
    costMultiplier: 1,
    unlockOffset: 0,
  },
  {
    slug: 'small-batch',
    label: 'Artisan Small-Batch',
    description: 'a slower hands-on method that conserves the primary ingredient while rewarding close attention',
    inputQuantity: 2,
    outputQuantity: 1,
    durationMultiplier: 1.35,
    costMultiplier: 1.3,
    unlockOffset: 8,
  },
  {
    slug: 'bulk',
    label: 'Market-Day Bulk',
    description: 'a high-throughput market-day run that trades a larger batch for three finished lots',
    inputQuantity: 8,
    outputQuantity: 3,
    durationMultiplier: 1.55,
    costMultiplier: 1.65,
    unlockOffset: 18,
  },
  {
    slug: 'precision',
    label: 'Masterwork Precision',
    description: 'a calibrated late-game method that spends extra time to produce two premium-ready lots',
    inputQuantity: 4,
    outputQuantity: 2,
    durationMultiplier: 1.8,
    costMultiplier: 1.5,
    unlockOffset: 32,
  },
]

const RECIPE_OUTPUT_BLUEPRINTS = [
  ...MATERIAL_PRODUCT_BLUEPRINTS,
  ...PROCESSED_PRODUCT_BLUEPRINTS,
]

const ITEM_UNLOCK_LEVELS = new Map<string, number>([
  ...VALLEY_MATERIALS.map((material) => [material.id, material.unlock.level] as const),
  ...VALLEY_PRODUCTS.map((product) => [product.id, product.unlock.level] as const),
])

/** Ensure every installed factory capability owns at least one deterministic recipe. */
const RECIPE_CAPABILITY_COVERAGE: readonly FactoryCapability[] = [
  'capability:cleaning',
  'capability:sorting',
  'capability:baking',
  'capability:roasting',
  'capability:smoking',
  'capability:churning',
  'capability:cheesemaking',
  'capability:distilling',
  'capability:freezing',
  'capability:spinning',
  'capability:tanning',
  'capability:papermaking',
  'capability:glassmaking',
  'capability:tailoring',
]

function recipeDefinition(
  blueprint: ProductBlueprint,
  technique: RecipeTechnique,
  index: number,
): RecipeDef {
  const id = `recipe:${technique.slug}-${blueprint.recipeSlug}`
  const inputs = [
    { itemId: blueprint.primaryInputId, quantity: technique.inputQuantity },
    ...(blueprint.additiveMaterialId === null
      ? []
      : [{ itemId: blueprint.additiveMaterialId, quantity: technique.slug === 'bulk' ? 2 : 1 }]),
  ]
  const durationMinutes = Math.max(15, Math.round(blueprint.baseDurationMinutes * technique.durationMultiplier))
  const productionCost = Math.max(1, Math.round(blueprint.baseProductionCost * technique.costMultiplier))
  return {
    kind: 'recipe',
    id,
    name: `${technique.label} ${blueprint.definition.name}`,
    description: `Produces ${blueprint.definition.name} through ${technique.description}; the listed capability, quantities, time, and fee are deterministic.`,
    ...localizationKeys('recipe', id),
    seasons: blueprint.definition.seasons,
    regions: blueprint.definition.regions,
    unlock: unlockFor(
      index + technique.unlockOffset,
      [blueprint.primaryInputId],
      ITEM_UNLOCK_LEVELS.get(blueprint.primaryInputId) ?? 1,
    ),
    economy: {
      purchasePrice: 0,
      sellPrice: 0,
      craftValue: Math.max(1, blueprint.definition.economy.craftValue),
      maintenancePerDay: 0,
      marketElasticity: 0,
      seasonalDemand: seasonalDemand(index),
    },
    tags: [blueprint.recipeCategory, technique.slug, blueprint.capability],
    recipeCategory: blueprint.recipeCategory,
    durationMinutes,
    productionCost,
    inputs,
    outputs: [{ itemId: blueprint.definition.id, quantity: technique.outputQuantity }],
    factoryCapabilities: [RECIPE_CAPABILITY_COVERAGE[index] ?? blueprint.capability],
  }
}

const PRIMARY_RECIPES = RECIPE_OUTPUT_BLUEPRINTS.map((blueprint, index) =>
  recipeDefinition(blueprint, RECIPE_TECHNIQUES[0]!, index),
)

const ALTERNATE_RECIPE_CANDIDATES = RECIPE_TECHNIQUES.slice(1).flatMap((technique, techniqueIndex) =>
  RECIPE_OUTPUT_BLUEPRINTS.map((blueprint, blueprintIndex) =>
    recipeDefinition(
      blueprint,
      technique,
      PRIMARY_RECIPES.length + techniqueIndex * RECIPE_OUTPUT_BLUEPRINTS.length + blueprintIndex,
    ),
  ),
)

export const VALLEY_RECIPES: readonly RecipeDef[] = Object.freeze(
  [...PRIMARY_RECIPES, ...ALTERNATE_RECIPE_CANDIDATES]
    .slice(0, 1200)
    .sort(compareId),
)

export const VALLEY_ECONOMY_COUNTS = Object.freeze({
  materials: VALLEY_MATERIALS.length,
  products: VALLEY_PRODUCTS.length,
  recipes: VALLEY_RECIPES.length,
})

/**
 * Fail-closed completeness proof for the economy slice. The shared registry performs
 * broader cross-category checks; this guard owns the exact economy totals, identity,
 * localization, economic metadata, and material/product recipe graph.
 */
export function assertValleyEconomyCompleteness(): void {
  if (VALLEY_MATERIALS.length !== 300) {
    throw new Error(`Valley economy requires exactly 300 materials; received ${VALLEY_MATERIALS.length}`)
  }
  if (VALLEY_PRODUCTS.length !== 1500) {
    throw new Error(`Valley economy requires exactly 1500 products; received ${VALLEY_PRODUCTS.length}`)
  }
  if (VALLEY_RECIPES.length !== 1200) {
    throw new Error(`Valley economy requires exactly 1200 recipes; received ${VALLEY_RECIPES.length}`)
  }

  const allDefinitions = [...VALLEY_MATERIALS, ...VALLEY_PRODUCTS, ...VALLEY_RECIPES]
  const ids = new Set<string>()
  const localization = new Set<string>()
  const placeholderName = /(?:placeholder|dummy|sample|test item|unnamed)/i
  for (const definition of allDefinitions) {
    if (ids.has(definition.id)) throw new Error(`Duplicate valley economy ID: ${definition.id}`)
    ids.add(definition.id)
    for (const key of [definition.nameKey, definition.descriptionKey]) {
      if (localization.has(key)) throw new Error(`Duplicate valley economy localization key: ${key}`)
      localization.add(key)
    }
    if (definition.name.trim().length < 3 || placeholderName.test(definition.name)) {
      throw new Error(`Non-substantive valley economy name: ${definition.id}`)
    }
    if (definition.description.trim().length < 40) {
      throw new Error(`Non-substantive valley economy description: ${definition.id}`)
    }
    if (definition.seasons.length === 0 || definition.regions.length === 0) {
      throw new Error(`Missing season or region metadata: ${definition.id}`)
    }
    if (definition.unlock.level < 1 || definition.unlock.level > 100) {
      throw new Error(`Unlock level outside 1..100: ${definition.id}`)
    }
    const economy = definition.economy
    if (economy.purchasePrice <= 0 && economy.sellPrice <= 0 && economy.craftValue <= 0) {
      throw new Error(`Missing positive economy value: ${definition.id}`)
    }
    for (const season of ALL_SEASONS) {
      if (economy.seasonalDemand[season] <= 0) {
        throw new Error(`Invalid ${season} demand value: ${definition.id}`)
      }
    }
  }

  const itemIds = new Set<string>([
    ...VALLEY_MATERIALS.map((material) => material.id),
    ...VALLEY_PRODUCTS.map((product) => product.id),
  ])
  const capabilityIds = new Set<string>(FACTORY_CAPABILITIES)
  for (const recipe of VALLEY_RECIPES) {
    if (recipe.inputs.length === 0 || recipe.outputs.length === 0) {
      throw new Error(`Recipe lacks inputs or outputs: ${recipe.id}`)
    }
    if (recipe.durationMinutes <= 0 || recipe.productionCost <= 0) {
      throw new Error(`Recipe lacks positive duration or production cost: ${recipe.id}`)
    }
    for (const entry of [...recipe.inputs, ...recipe.outputs]) {
      if (!itemIds.has(entry.itemId)) throw new Error(`Unknown recipe item ${entry.itemId} in ${recipe.id}`)
      if (!Number.isInteger(entry.quantity) || entry.quantity <= 0) {
        throw new Error(`Invalid recipe quantity for ${entry.itemId} in ${recipe.id}`)
      }
    }
    if (recipe.factoryCapabilities.length === 0) {
      throw new Error(`Recipe lacks a factory capability: ${recipe.id}`)
    }
    for (const capability of recipe.factoryCapabilities) {
      if (!capabilityIds.has(capability)) throw new Error(`Unknown factory capability ${capability} in ${recipe.id}`)
    }
  }
}

assertValleyEconomyCompleteness()
