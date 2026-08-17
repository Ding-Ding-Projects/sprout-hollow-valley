import type {
  AnimalDef,
  AnimalDiet,
  AnimalHousing,
  AnimalTemperament,
  CareDifficulty,
  CropDef,
  CropFamily,
  EconomyDef,
  HarvestMethod,
  OrchardPlantDef,
  OrchardPlantForm,
  PollinationMethod,
  Season,
  SoilAffinity,
  WaterNeed,
} from './types'

const ALL_SEASONS: readonly Season[] = ['spring', 'summer', 'fall', 'winter']
const VALLEY_REGIONS = [
  'region:meadow',
  'region:forest',
  'region:riverland',
  'region:mountain',
  'region:coastal',
  'region:marsh',
  'region:arid',
  'region:alpine',
] as const

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function canonicalSort<T extends { readonly id: string }>(definitions: readonly T[]): readonly T[] {
  return [...definitions].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
}

function seasonalDemand(activeSeasons: readonly Season[], peak: number): EconomyDef['seasonalDemand'] {
  const active = new Set(activeSeasons)
  return {
    spring: active.has('spring') ? peak : 0.82,
    summer: active.has('summer') ? peak : 0.84,
    fall: active.has('fall') ? peak : 0.88,
    winter: active.has('winter') ? peak : 0.96,
  }
}

function regionsFor(seed: number): readonly string[] {
  const first = seed % VALLEY_REGIONS.length
  const second = (first + 3 + (seed % 3)) % VALLEY_REGIONS.length
  return [VALLEY_REGIONS[first], VALLEY_REGIONS[second]]
}

type FiveCultivars = readonly [string, string, string, string, string]

interface CropFamilySeed {
  readonly familyName: string
  readonly guild: string
  readonly cropFamily: CropFamily
  readonly seasons: readonly Season[]
  readonly cultivars: FiveCultivars
}

function five(
  first: string,
  second: string,
  third: string,
  fourth: string,
  fifth: string,
): FiveCultivars {
  return [first, second, third, fourth, fifth]
}

function cropSeed(
  familyName: string,
  guild: string,
  cropFamily: CropFamily,
  seasons: readonly Season[],
  cultivars: FiveCultivars,
): CropFamilySeed {
  return { familyName, guild, cropFamily, seasons, cultivars }
}

/**
 * One hundred genuine crop families, each with five explicitly named cultivars.
 * The source order is the authored level ladder: five cultivars unlock per family.
 */
const CROP_FAMILIES: readonly CropFamilySeed[] = [
  // Cool-season grains (10 families, 50 definitions).
  cropSeed('Wheat', 'cool grain', 'cereal', ['spring', 'fall'], five('Red Fife', 'Marquis', 'Selkirk', 'Glenn', 'Snowbird')),
  cropSeed('Barley', 'cool grain', 'cereal', ['spring', 'fall'], five('Golden Promise', 'Maris Otter', 'Bere', 'Conlon', 'Harrington')),
  cropSeed('Oat', 'cool grain', 'cereal', ['spring', 'fall'], five('Hulless', 'Black Bristle', 'Swedish', 'Cayuse', 'Pendek')),
  cropSeed('Rye', 'cool grain', 'cereal', ['fall', 'winter', 'spring'], five('Danko', 'Hazlet', 'Aroostook', 'Wheeler', 'Sangaste')),
  cropSeed('Triticale', 'cool grain', 'cereal', ['spring', 'fall'], five('Trical', 'Bogo', 'Pika', 'AC Ultima', 'Fridge')),
  cropSeed('Spelt', 'cool grain', 'cereal', ['spring', 'fall'], five('Oberkulmer', 'Maverick', 'Sungold', 'Alkor', 'Comet')),
  cropSeed('Einkorn', 'cool grain', 'cereal', ['spring', 'fall'], five('Black', 'Alpine', 'Amber', 'Spring', 'Hulled')),
  cropSeed('Emmer', 'cool grain', 'cereal', ['spring', 'fall'], five('Blue Beard', 'Ethiopian', 'Farro', 'Khapli', 'White Mountain')),
  cropSeed('Buckwheat', 'cool grain', 'cereal', ['spring', 'summer'], five('Mancan', 'Koto', 'Common Grey', 'Silverhull', 'Tokyo')),
  cropSeed('Quinoa', 'cool grain', 'cereal', ['spring', 'summer', 'fall'], five('Brightest Brilliant', 'Cherry Vanilla', 'Faro', 'Red Head', 'Temuco')),

  // Warm-season grains (10 families, 50 definitions).
  cropSeed('Maize', 'warm grain', 'cereal', ['summer', 'fall'], five('Golden Bantam', 'Glass Gem', 'Bloody Butcher', 'Country Gentleman', 'Hopi Blue')),
  cropSeed('Rice', 'warm grain', 'cereal', ['summer', 'fall'], five('Arborio', 'Basmati', 'Jasmine', 'Koshihikari', 'Carolina Gold')),
  cropSeed('Sorghum', 'warm grain', 'cereal', ['summer', 'fall'], five('Dale', 'Rox Orange', 'Mennonite', 'Red Amber', 'White African')),
  cropSeed('Pearl Millet', 'warm grain', 'cereal', ['summer', 'fall'], five('Tifgrain', 'Stardom', 'Chadi', 'Iniadi', 'Giant Bajra')),
  cropSeed('Proso Millet', 'warm grain', 'cereal', ['summer', 'fall'], five('Huntsman', 'Sunrise', 'Cerise', 'Crown', 'Horizon')),
  cropSeed('Foxtail Millet', 'warm grain', 'cereal', ['summer', 'fall'], five('Golden German', 'Hungarian', 'Siberian', 'Red Sibir', 'White Wonder')),
  cropSeed('Teff', 'warm grain', 'cereal', ['summer', 'fall'], five('Brown', 'Ivory', 'Magna', 'Dessie', 'Key Murri')),
  cropSeed('Grain Amaranth', 'warm grain', 'cereal', ['summer', 'fall'], five('Golden Giant', 'Hopi Red Dye', 'Orange', 'Plainsman', 'Burgundy')),
  cropSeed('Fonio', 'warm grain', 'cereal', ['summer', 'fall'], five('White Acha', 'Black Acha', 'Mali Pearl', 'Fouta', 'Sahel Gold')),
  cropSeed("Job's Tears", 'warm grain', 'cereal', ['summer', 'fall'], five('Ma-Yuen', 'Softshell', 'Taiwan Pearl', 'Japanese', 'Korean')),

  // Pulses (10 families, 50 definitions).
  cropSeed('Common Bean', 'pulse', 'legume', ['summer', 'fall'], five("Jacob's Cattle", 'Cherokee Trail', 'Calypso', 'Dragon Tongue', 'Soldier')),
  cropSeed('Field Pea', 'pulse', 'legume', ['spring', 'fall'], five('Green Arrow', 'Alaska', 'Lincoln', 'Wando', 'Maestro')),
  cropSeed('Soybean', 'pulse', 'legume', ['summer', 'fall'], five('Envy', 'Midori Giant', 'Black Jet', 'Butterbean', 'Shirofumi')),
  cropSeed('Chickpea', 'pulse', 'legume', ['spring', 'summer'], five('Kabuli', 'Desi', 'Black', 'Spanish White', 'Ethiopian')),
  cropSeed('Lentil', 'pulse', 'legume', ['spring', 'fall'], five('Puy', 'Beluga', 'Eston Green', 'Red Chief', 'Spanish Brown')),
  cropSeed('Fava Bean', 'pulse', 'legume', ['spring', 'fall'], five('Windsor', 'Aquadulce', 'Crimson Flowered', 'Stereo', 'The Sutton')),
  cropSeed('Cowpea', 'pulse', 'legume', ['summer', 'fall'], five('California Blackeye', 'Purple Hull', 'Lady', 'Iron Clay', 'Red Ripper')),
  cropSeed('Mung Bean', 'pulse', 'legume', ['summer', 'fall'], five('Berken', 'Crystal', 'Jade-AU', 'King', 'Satin')),
  cropSeed('Pigeon Pea', 'pulse', 'legume', ['summer', 'fall'], five('Georgia', 'Tobago', 'Hunt', 'ICPL', 'Puerto Rico')),
  cropSeed('Lupin', 'pulse', 'legume', ['spring', 'summer'], five('Andean Pearl', 'Blue Juno', 'Sweet White', 'Russell Grain', 'Yellow Sun')),

  // Oil, fibre, and sugar crops (10 families, 50 definitions).
  cropSeed('Sunflower', 'oil crop', 'oilseed', ['summer', 'fall'], five('Mammoth Grey Stripe', 'Black Oil', 'Lemon Queen', 'Velvet Queen', 'Arikara')),
  cropSeed('Sesame', 'oil crop', 'oilseed', ['summer', 'fall'], five('Benne', 'Black', 'White', 'Korean', 'Red')),
  cropSeed('Peanut', 'oil crop', 'oilseed', ['summer', 'fall'], five('Valencia', 'Virginia', 'Spanish', 'Tennessee Red', 'Carolina African')),
  cropSeed('Canola', 'oil crop', 'oilseed', ['spring', 'fall'], five('Argentine', 'Polish', 'Dwarf Essex', 'Wester', 'Goldrush')),
  cropSeed('Safflower', 'oil crop', 'oilseed', ['summer', 'fall'], five('Orange Grenade', 'White Petal', 'Red Silk', 'Arizona', 'Montana')),
  cropSeed('Flax', 'fibre crop', 'fiber', ['spring', 'summer'], five('Bethune', 'Bolley Golden', 'Stormont', 'Blue Fiber', 'Linore')),
  cropSeed('Cotton', 'fibre crop', 'fiber', ['summer', 'fall'], five('Pima', 'Acala', 'Sea Island', 'Nankeen', 'Green Lint')),
  cropSeed('Hemp', 'fibre crop', 'fiber', ['spring', 'summer', 'fall'], five('Finola', 'Futura', 'Kompolti', 'Fedora', 'Carmagnola')),
  cropSeed('Sugar Beet', 'sugar crop', 'root', ['spring', 'fall'], five('Klein Wanzleben', 'Detroit Dark Red', 'Lutz Green Leaf', 'Chioggia', 'Albina Vereduna')),
  cropSeed('Sugarcane', 'sugar crop', 'cereal', ['summer', 'fall'], five('Louisiana Ribbon', 'Badila', 'Crystalina', 'Uba', 'Yellow Gal')),

  // Roots and tubers (10 families, 50 definitions).
  cropSeed('Potato', 'root and tuber', 'tuber', ['spring', 'fall'], five('Yukon Gold', 'Russet Burbank', 'Red Norland', 'Purple Majesty', 'Russian Banana')),
  cropSeed('Sweet Potato', 'root and tuber', 'tuber', ['summer', 'fall'], five('Beauregard', 'Covington', 'Garnet', 'Okinawan', 'Stokes Purple')),
  cropSeed('Carrot', 'root and tuber', 'root', ['spring', 'fall', 'winter'], five('Nantes', 'Danvers', 'Chantenay', 'Imperator', 'Purple Haze')),
  cropSeed('Parsnip', 'root and tuber', 'root', ['spring', 'fall', 'winter'], five('Hollow Crown', 'Harris Model', 'Gladiator', 'Tender and True', 'White Gem')),
  cropSeed('Beetroot', 'root and tuber', 'root', ['spring', 'fall'], five('Detroit Dark Red', 'Bull’s Blood', 'Golden', 'Cylindra', 'Chioggia Guardsmark')),
  cropSeed('Turnip', 'root and tuber', 'root', ['spring', 'fall', 'winter'], five('Purple Top White Globe', 'Tokyo Cross', 'Golden Ball', 'Hakurei', 'Seven Top')),
  cropSeed('Rutabaga', 'root and tuber', 'root', ['spring', 'fall', 'winter'], five('Laurentian', 'Joan', 'American Purple Top', 'Helenor', 'Marian')),
  cropSeed('Radish', 'root and tuber', 'root', ['spring', 'fall', 'winter'], five('French Breakfast', 'Cherry Belle', 'Easter Egg', 'White Icicle', 'Watermelon')),
  cropSeed('Daikon', 'root and tuber', 'root', ['spring', 'fall', 'winter'], five('Minowase', 'Miyashige', 'Shunkyo', 'Korean Mu', 'Alpine')),
  cropSeed('Celeriac', 'root and tuber', 'root', ['spring', 'fall'], five('Giant Prague', 'Brilliant', 'Monarch', 'Prinz', 'Mars')),

  // Specialty roots and alliums (10 families, 50 definitions).
  cropSeed('Salsify', 'specialty root', 'root', ['spring', 'fall'], five('Mammoth Sandwich Island', 'Black Scorzonera', 'Fiore Blu', 'French White', 'Improved Mammoth')),
  cropSeed('Scorzonera', 'specialty root', 'root', ['spring', 'fall'], five('Hoffmanns Schwarze Pfahl', 'Duplex', 'Russian Giant', 'Enorma', 'Meres')),
  cropSeed('Jicama', 'specialty root', 'root', ['summer', 'fall'], five('Agua Dulce', 'Cristalina', 'San Juan', 'Mexican White', 'Compact Vine')),
  cropSeed('Cassava', 'specialty root', 'tuber', ['summer', 'fall'], five('TMS 30572', 'Rayong', 'MCol 1684', 'Golden Yellow', 'Sweet White')),
  cropSeed('Taro', 'specialty root', 'tuber', ['summer', 'fall'], five('Bun Long', 'Lehua Maoli', 'Maui Lehua', 'Chinese', 'Dasheen')),
  cropSeed('Ginger', 'rhizome crop', 'medicinal', ['spring', 'summer', 'fall'], five('Canton', 'Rio-de-Janeiro', 'Nadia', 'Kintoki', 'Hawaiian Yellow')),
  cropSeed('Turmeric', 'rhizome crop', 'medicinal', ['spring', 'summer', 'fall'], five('Alleppey', 'Madras', 'Lakadong', 'Erode', 'Pragati')),
  cropSeed('Onion', 'allium', 'allium', ['spring', 'fall', 'winter'], five('Walla Walla', 'Red Burgundy', 'Yellow Sweet Spanish', 'Ailsa Craig', 'Copra')),
  cropSeed('Garlic', 'allium', 'allium', ['fall', 'winter', 'spring'], five('Music', 'Chesnok Red', 'Inchelium Red', 'Spanish Roja', 'Georgian Crystal')),
  cropSeed('Leek', 'allium', 'allium', ['spring', 'fall', 'winter'], five('King Richard', 'Blue Solaise', 'Giant Musselburgh', 'Bandit', 'Carentan')),

  // Leafy crops (10 families, 50 definitions).
  cropSeed('Lettuce', 'leafy green', 'leafy', ['spring', 'fall', 'winter'], five('Buttercrunch', 'Little Gem', 'Lollo Rosso', 'Oakleaf', 'Winter Density')),
  cropSeed('Spinach', 'leafy green', 'leafy', ['spring', 'fall', 'winter'], five('Bloomsdale', 'Space', 'Tyee', 'Giant Winter', 'Malabar')),
  cropSeed('Swiss Chard', 'leafy green', 'leafy', ['spring', 'summer', 'fall'], five('Bright Lights', 'Fordhook Giant', 'Ruby Red', 'Lucullus', 'Orange Fantasia')),
  cropSeed('Kale', 'leafy green', 'brassica', ['spring', 'fall', 'winter'], five('Lacinato', 'Red Russian', 'Winterbor', 'Siberian', 'Dwarf Blue Curled')),
  cropSeed('Cabbage', 'leafy green', 'brassica', ['spring', 'fall', 'winter'], five('Golden Acre', 'January King', 'Red Drumhead', 'Savoy Perfection', 'Danish Ballhead')),
  cropSeed('Napa Cabbage', 'leafy green', 'brassica', ['spring', 'fall'], five('Michihili', 'Blues', 'Minuet', 'Rubicon', 'Tokyo Bekana')),
  cropSeed('Bok Choy', 'leafy green', 'brassica', ['spring', 'fall', 'winter'], five('Joi Choi', 'Mei Qing Choi', 'Prize Choi', 'Rosie', 'Shanghai Green')),
  cropSeed('Collard', 'leafy green', 'brassica', ['spring', 'fall', 'winter'], five('Georgia Southern', 'Champion', 'Morris Heading', 'Vates', 'Top Bunch')),
  cropSeed('Arugula', 'leafy green', 'leafy', ['spring', 'fall', 'winter'], five('Astro', 'Sylvetta', 'Dragon Tongue', 'Wasabi', 'Olive Leaf')),
  cropSeed('Mustard Green', 'leafy green', 'brassica', ['spring', 'fall', 'winter'], five('Red Giant', 'Green Wave', 'Mizuna', 'Osaka Purple', 'Southern Curled')),

  // Brassica, stem, and salad crops (10 families, 50 definitions).
  cropSeed('Broccoli', 'brassica and stem', 'brassica', ['spring', 'fall'], five('Calabrese', 'De Cicco', 'Waltham 29', 'Romanesco', 'Purple Sprouting')),
  cropSeed('Cauliflower', 'brassica and stem', 'brassica', ['spring', 'fall'], five('Snowball', 'Cheddar', 'Graffiti', 'Romanesco', 'Amazing')),
  cropSeed('Kohlrabi', 'brassica and stem', 'brassica', ['spring', 'fall'], five('Early White Vienna', 'Purple Vienna', 'Gigante', 'Azur Star', 'Kossak')),
  cropSeed('Brussels Sprout', 'brassica and stem', 'brassica', ['spring', 'fall', 'winter'], five('Long Island Improved', 'Diablo', 'Jade Cross', 'Falstaff', 'Groninger')),
  cropSeed('Celery', 'brassica and stem', 'leafy', ['spring', 'fall'], five('Tango', 'Tall Utah', 'Golden Self-Blanching', 'Redventure', 'Chinese Pink')),
  cropSeed('Florence Fennel', 'brassica and stem', 'herb', ['spring', 'fall'], five('Zefa Fino', 'Romanesco', 'Preludio', 'Perfection', 'Orion')),
  cropSeed('Chicory', 'salad crop', 'leafy', ['spring', 'fall', 'winter'], five('Catalogna', 'Witloof', 'Rossa di Treviso', 'Sugarloaf', 'Spadona')),
  cropSeed('Endive', 'salad crop', 'leafy', ['spring', 'fall', 'winter'], five('Green Curled Ruffec', 'Broadleaf Batavian', 'Tres Fine Maraichere', 'Natacha', 'Frisée de Meaux')),
  cropSeed('Radicchio', 'salad crop', 'leafy', ['spring', 'fall', 'winter'], five('Chioggia', 'Treviso', 'Castelfranco', 'Verona', 'Palla Rossa')),
  cropSeed('Mâche', 'salad crop', 'leafy', ['fall', 'winter', 'spring'], five('Vit', 'Verte de Cambrai', 'Dutch Broadleaf', 'Favor', 'Coquille de Louviers')),

  // Fruiting vegetables (10 families, 50 definitions).
  cropSeed('Tomato', 'fruiting vegetable', 'fruiting', ['summer', 'fall'], five('Brandywine', 'Roma', 'Sungold', 'San Marzano', 'Green Zebra')),
  cropSeed('Sweet Pepper', 'fruiting vegetable', 'fruiting', ['summer', 'fall'], five('California Wonder', 'Jimmy Nardello', 'Corno di Toro', 'Purple Beauty', 'Shishito')),
  cropSeed('Chile Pepper', 'fruiting vegetable', 'fruiting', ['summer', 'fall'], five('Jalapeño', 'Serrano', 'Cayenne', 'Poblano', 'Habanero')),
  cropSeed('Eggplant', 'fruiting vegetable', 'fruiting', ['summer', 'fall'], five('Black Beauty', 'Rosa Bianca', 'Listada de Gandia', 'Thai Green', 'Ping Tung Long')),
  cropSeed('Okra', 'fruiting vegetable', 'fruiting', ['summer', 'fall'], five('Clemson Spineless', 'Burgundy', 'Hill Country Red', 'Emerald', 'Star of David')),
  cropSeed('Tomatillo', 'fruiting vegetable', 'fruiting', ['summer', 'fall'], five('Toma Verde', 'Purple de Milpa', 'Rio Grande Verde', 'Pineapple', 'Amarylla')),
  cropSeed('Ground Cherry', 'fruiting vegetable', 'fruiting', ['summer', 'fall'], five("Aunt Molly's", 'Cossack Pineapple', 'Goldie', 'Yantar', 'New Hanover')),
  cropSeed('Cucumber', 'fruiting vegetable', 'fruiting', ['summer'], five('Marketmore', 'Lemon', 'Armenian', 'Boston Pickling', 'Suyo Long')),
  cropSeed('Zucchini', 'fruiting vegetable', 'fruiting', ['summer', 'fall'], five('Black Beauty', 'Costata Romanesco', 'Golden', 'Cocozelle', 'Ronde de Nice')),
  cropSeed('Pumpkin', 'fruiting vegetable', 'melon', ['summer', 'fall'], five('Connecticut Field', 'Cinderella', 'Jarrahdale', 'Long Island Cheese', 'Winter Luxury')),

  // Cucurbits, herbs, and flowers (10 families, 50 definitions).
  cropSeed('Butternut Squash', 'cucurbit', 'melon', ['summer', 'fall'], five('Waltham', 'Honeynut', 'Butterbush', 'Rogosa Violina Gioia', 'Early Nutter')),
  cropSeed('Acorn Squash', 'cucurbit', 'melon', ['summer', 'fall'], five('Table Queen', 'Honey Bear', 'Thelma Sanders', 'Sweet Reba', 'Carnival')),
  cropSeed('Watermelon', 'cucurbit', 'melon', ['summer'], five('Sugar Baby', 'Moon and Stars', 'Charleston Gray', 'Crimson Sweet', 'Orangeglo')),
  cropSeed('Muskmelon', 'cucurbit', 'melon', ['summer'], five('Hale’s Best', 'Charentais', 'Minnesota Midget', 'Ambrosia', 'Collective Farm Woman')),
  cropSeed('Basil', 'culinary herb', 'herb', ['spring', 'summer'], five('Genovese', 'Thai', 'Lemon', 'Purple Ruffles', 'Cinnamon')),
  cropSeed('Cilantro', 'culinary herb', 'herb', ['spring', 'fall'], five('Santo', 'Calypso', 'Leisure', 'Caribe', 'Slow Bolt')),
  cropSeed('Dill', 'culinary herb', 'herb', ['spring', 'summer'], five('Bouquet', 'Mammoth', 'Fernleaf', 'Hera', 'Dukat')),
  cropSeed('Chamomile', 'medicinal flower', 'medicinal', ['spring', 'summer'], five('Bodegold', 'Zloty Lan', 'German Blue', 'Roman', 'Treneague')),
  cropSeed('Calendula', 'useful flower', 'flower', ['spring', 'summer', 'fall'], five('Pacific Beauty', 'Resina', 'Orange King', 'Pink Surprise', 'Ivory Princess')),
  cropSeed('Marigold', 'useful flower', 'flower', ['spring', 'summer', 'fall'], five('Crackerjack', 'Lemon Gem', 'Red Metamorph', 'Tangerine Gem', 'Queen Sophia')),
]

const CULTIVAR_ROLES = [
  'early-maturing',
  'flavour-selected',
  'high-yield',
  'storage-selected',
  'climate-resilient',
] as const

const SOILS: readonly SoilAffinity[] = ['loam', 'clay', 'sand', 'silt', 'peat', 'rocky', 'wetland']
const WATER_NEEDS: readonly WaterNeed[] = ['low', 'moderate', 'high']

function cropHarvestMethod(family: CropFamily): HarvestMethod {
  if (family === 'root' || family === 'tuber' || family === 'allium' || family === 'medicinal') return 'dig'
  if (family === 'cereal' || family === 'fiber' || family === 'flower') return 'cut'
  if (family === 'leafy' || family === 'brassica' || family === 'herb') return 'cut'
  if (family === 'oilseed' || family === 'legume') return 'strip'
  return 'hand-pick'
}

function baseCropGrowthDays(family: CropFamily): number {
  if (family === 'leafy' || family === 'herb') return 5
  if (family === 'root' || family === 'allium' || family === 'brassica') return 7
  if (family === 'fruiting' || family === 'melon' || family === 'tuber') return 10
  if (family === 'fiber' || family === 'oilseed' || family === 'cereal') return 9
  return 8
}

function cropDefinitions(): readonly CropDef[] {
  const rows: CropDef[] = []
  CROP_FAMILIES.forEach((family, familyIndex) => {
    family.cultivars.forEach((cultivar, cultivarRank) => {
      const familySlug = slugify(family.familyName)
      const cultivarSlug = slugify(cultivar)
      const id = `crop:${familySlug}-${cultivarSlug}`
      const hash = stableHash(id)
      const role = CULTIVAR_ROLES[cultivarRank]
      const level = ((familyIndex * 5 + cultivarRank) % 100) + 1
      const regions = regionsFor(hash)
      const growthDays = Math.max(3, baseCropGrowthDays(family.cropFamily) + cultivarRank - 1 + (hash % 3))
      const repeatBearing = family.cropFamily === 'fruiting'
        || family.cropFamily === 'leafy'
        || family.cropFamily === 'herb'
        || family.cropFamily === 'flower'
      const yieldMin = 1 + (hash % 2)
      const yieldMax = yieldMin + 1 + ((hash >>> 4) % 3)
      const seedCost = 10 + level * 2 + (hash % 23)
      const unitValue = Math.ceil((seedCost * 1.45) / ((yieldMin + yieldMax) / 2)) + growthDays
      const soilA = hash % SOILS.length
      const soilB = (soilA + 2 + cultivarRank) % SOILS.length
      const displayName = `${cultivar} ${family.familyName}`

      rows.push({
        kind: 'crop',
        id,
        name: displayName,
        description: `${displayName} is a ${role} ${family.guild} cultivated for ${family.seasons.join(' and ')} harvests, with a ${growthDays}-day field cycle and ${SOILS[soilA]}-leaning soil needs.`,
        nameKey: `content.crop.${familySlug}.${cultivarSlug}.name`,
        descriptionKey: `content.crop.${familySlug}.${cultivarSlug}.description`,
        seasons: family.seasons,
        regions,
        unlock: {
          level,
          reputation: Math.min(1000, Math.max(0, level * 9 - 9)),
          regionId: level > 12 ? regions[0] : null,
          questId: level % 20 === 0 ? `quest:crop-guild-${Math.ceil(level / 20)}` : null,
          prerequisiteIds: [],
        },
        economy: {
          purchasePrice: seedCost,
          sellPrice: unitValue,
          craftValue: Math.max(1, Math.round(unitValue * 0.82)),
          maintenancePerDay: 1 + Math.floor(growthDays / 6),
          marketElasticity: 0.65 + (hash % 90) / 100,
          seasonalDemand: seasonalDemand(family.seasons, 1.08 + cultivarRank * 0.04),
        },
        tags: [family.guild, family.cropFamily, role, `cultivar:${cultivarSlug}`, `harvest:${cropHarvestMethod(family.cropFamily)}`],
        cropFamily: family.cropFamily,
        cultivar,
        growthDays,
        regrowDays: repeatBearing ? 2 + cultivarRank + (hash % 3) : null,
        waterNeed: WATER_NEEDS[(hash + cultivarRank) % WATER_NEEDS.length],
        soilAffinity: soilA === soilB ? [SOILS[soilA]] : [SOILS[soilA], SOILS[soilB]],
        harvestMethod: cropHarvestMethod(family.cropFamily),
        yield: {
          productId: `product:fresh-${familySlug}-${cultivarSlug}`,
          min: yieldMin,
          max: yieldMax,
        },
      })
    })
  })
  return canonicalSort(rows)
}

export const VALLEY_CROPS: readonly CropDef[] = cropDefinitions()

interface OrchardFamilySeed {
  readonly plantName: string
  readonly plantForm: OrchardPlantForm
  readonly climate: 'temperate' | 'nut' | 'warm' | 'berry' | 'vine'
  readonly seasons: readonly Season[]
  readonly cultivars: readonly string[]
}

function orchardSeed(
  plantName: string,
  plantForm: OrchardPlantForm,
  climate: OrchardFamilySeed['climate'],
  seasons: readonly Season[],
  cultivars: readonly string[],
): OrchardFamilySeed {
  return { plantName, plantForm, climate, seasons, cultivars }
}

/**
 * A hand-curated orchard catalogue: 90 temperate fruits, 25 nuts,
 * 45 warm-climate plants, 45 berry bushes/canes, and 45 vines.
 */
const ORCHARD_FAMILIES: readonly OrchardFamilySeed[] = [
  // Temperate orchard: 90 definitions.
  orchardSeed('Apple', 'tree', 'temperate', ['summer', 'fall'], [
    'Honeycrisp', 'Gala', 'Fuji', 'Granny Smith', 'Braeburn', "Cox's Orange Pippin",
    'McIntosh', 'Jonathan', 'Golden Delicious', 'Cripps Pink', 'Northern Spy', 'Arkansas Black',
  ]),
  orchardSeed('European Pear', 'tree', 'temperate', ['summer', 'fall'], [
    'Bartlett', 'Bosc', "D'Anjou", 'Comice', 'Seckel', 'Concorde', 'Forelle', 'Conference',
  ]),
  orchardSeed('Asian Pear', 'tree', 'temperate', ['summer', 'fall'], [
    'Hosui', 'Shinseiki', 'Nijisseiki', 'Shinko', 'Kosui',
  ]),
  orchardSeed('Sweet Cherry', 'tree', 'temperate', ['spring', 'summer'], [
    'Bing', 'Rainier', 'Lapins', 'Stella', 'Sweetheart', 'Chelan', 'Skeena',
  ]),
  orchardSeed('Sour Cherry', 'tree', 'temperate', ['spring', 'summer'], [
    'Montmorency', 'Morello', 'Balaton', 'North Star',
  ]),
  orchardSeed('Peach', 'tree', 'temperate', ['summer'], [
    'Elberta', 'Redhaven', 'Contender', 'Reliance', "O'Henry", 'Belle of Georgia', 'Cresthaven', 'Saturn',
  ]),
  orchardSeed('Nectarine', 'tree', 'temperate', ['summer'], [
    'Fantasia', 'Arctic Jay', 'Harko', 'Mericrest',
  ]),
  orchardSeed('European Plum', 'tree', 'temperate', ['summer', 'fall'], [
    'Stanley', 'Damson', 'Green Gage', 'Italian Prune', 'Victoria', 'Mirabelle de Nancy',
  ]),
  orchardSeed('Japanese Plum', 'tree', 'temperate', ['summer'], [
    'Santa Rosa', 'Satsuma', 'Methley', 'Shiro', 'Elephant Heart',
  ]),
  orchardSeed('Apricot', 'tree', 'temperate', ['spring', 'summer'], [
    'Moorpark', 'Blenheim', 'Goldcot', 'Harcot', 'Tilton',
  ]),
  orchardSeed('Quince', 'tree', 'temperate', ['fall'], ['Smyrna', 'Champion', 'Pineapple']),
  orchardSeed('Persimmon', 'tree', 'temperate', ['fall'], ['Fuyu', 'Hachiya', 'Jiro', 'Saijo']),
  orchardSeed('Pawpaw', 'tree', 'temperate', ['summer', 'fall'], ['Sunflower', 'Susquehanna', 'Shenandoah', 'Allegheny']),
  orchardSeed('Medlar', 'tree', 'temperate', ['fall', 'winter'], ['Nottingham', 'Breda Giant', 'Royal']),
  orchardSeed('Mulberry', 'tree', 'temperate', ['summer'], ['Pakistan', 'Illinois Everbearing', 'Shangri-La', 'White Shahtoot']),
  orchardSeed('Loquat', 'tree', 'temperate', ['spring'], ['Big Jim', 'Gold Nugget', 'Champagne', 'Vista White']),
  orchardSeed('Serviceberry', 'bush', 'temperate', ['spring', 'summer'], ['Thiessen', 'Smoky', 'Northline', 'Martin']),

  // Nut orchard: 25 definitions.
  orchardSeed('Almond', 'tree', 'nut', ['fall'], ['Nonpareil', 'Carmel', 'Mission', 'Tuono']),
  orchardSeed('Walnut', 'tree', 'nut', ['fall'], ['Chandler', 'Hartley', 'Franquette', 'Tulare']),
  orchardSeed('Pecan', 'tree', 'nut', ['fall'], ['Pawnee', 'Desirable', 'Kanza', 'Elliot']),
  orchardSeed('Hazelnut', 'bush', 'nut', ['fall'], ['Barcelona', 'Jefferson', 'Yamhill', "Hall's Giant"]),
  orchardSeed('Chestnut', 'tree', 'nut', ['fall'], ['Colossal', 'Maraval', 'Bouche de Bétizac']),
  orchardSeed('Pistachio', 'tree', 'nut', ['fall'], ['Kerman', 'Larnaka', 'Sirora']),
  orchardSeed('Macadamia', 'tree', 'nut', ['summer', 'fall'], ['Beaumont', 'Cate', 'Keauhou']),

  // Warm-climate orchard: 45 definitions.
  orchardSeed('Orange', 'tree', 'warm', ['winter', 'spring'], ['Valencia', 'Washington Navel', 'Cara Cara', 'Moro Blood']),
  orchardSeed('Mandarin', 'tree', 'warm', ['fall', 'winter'], ['Owari Satsuma', 'Clementine', 'Kishu', 'Dancy']),
  orchardSeed('Lemon', 'tree', 'warm', ['spring', 'summer', 'fall', 'winter'], ['Eureka', 'Lisbon', 'Meyer']),
  orchardSeed('Lime', 'tree', 'warm', ['summer', 'fall'], ['Persian', 'Key', 'Makrut']),
  orchardSeed('Grapefruit', 'tree', 'warm', ['winter', 'spring'], ['Ruby Red', 'Marsh Seedless']),
  orchardSeed('Pomelo', 'tree', 'warm', ['winter', 'spring'], ['Chandler', 'Hirado Buntan']),
  orchardSeed('Fig', 'tree', 'warm', ['summer', 'fall'], ['Brown Turkey', 'Black Mission', 'Kadota', 'Chicago Hardy']),
  orchardSeed('Pomegranate', 'tree', 'warm', ['fall'], ['Wonderful', 'Parfianka', 'Eversweet', 'Salavatski']),
  orchardSeed('Olive', 'tree', 'warm', ['fall', 'winter'], ['Arbequina', 'Koroneiki', 'Frantoio', 'Manzanilla']),
  orchardSeed('Avocado', 'tree', 'warm', ['spring', 'summer', 'fall'], ['Hass', 'Fuerte', 'Bacon', 'Reed']),
  orchardSeed('Mango', 'tree', 'warm', ['summer'], ['Alphonso', 'Kent', 'Keitt']),
  orchardSeed('Banana', 'orchard-plant', 'warm', ['summer', 'fall'], ['Cavendish', 'Gros Michel', 'Blue Java']),
  orchardSeed('Coconut', 'tree', 'warm', ['summer', 'fall'], ['Malayan Dwarf']),
  orchardSeed('Cacao', 'orchard-plant', 'warm', ['summer', 'fall'], ['Chuao Criollo', 'Ecuador Nacional']),
  orchardSeed('Coffee', 'orchard-plant', 'warm', ['spring', 'summer'], ['Typica', 'Bourbon']),

  // Bushes and canes: 45 definitions.
  orchardSeed('Blueberry', 'bush', 'berry', ['summer'], ['Duke', 'Bluecrop', 'Elliott', 'Legacy', 'Pink Lemonade']),
  orchardSeed('Cranberry', 'bush', 'berry', ['fall'], ['Stevens', 'Ben Lear', 'Early Black']),
  orchardSeed('Lingonberry', 'bush', 'berry', ['summer', 'fall'], ['Koralle', 'Red Pearl', 'Sussi']),
  orchardSeed('Huckleberry', 'bush', 'berry', ['summer', 'fall'], ['Cascade Black', 'Olympic Evergreen', 'Rocky Mountain']),
  orchardSeed('Gooseberry', 'bush', 'berry', ['summer'], ['Invicta', 'Hinnonmaki Red', 'Captivator', "Whinham's Industry"]),
  orchardSeed('Black Currant', 'bush', 'berry', ['summer'], ['Ben Sarek', 'Titania', 'Consort', 'Blackdown']),
  orchardSeed('Red Currant', 'bush', 'berry', ['summer'], ['Red Lake', 'Rovada', 'Jonkheer van Tets']),
  orchardSeed('Raspberry', 'bush', 'berry', ['summer', 'fall'], ['Heritage', 'Tulameen', 'Anne', 'Caroline', 'Joan J']),
  orchardSeed('Blackberry', 'bush', 'berry', ['summer', 'fall'], ['Chester Thornless', 'Triple Crown', 'Navaho', 'Marion', 'Prime-Ark Freedom']),
  orchardSeed('Elderberry', 'bush', 'berry', ['summer', 'fall'], ['Adams', 'York', 'Nova']),
  orchardSeed('Aronia', 'bush', 'berry', ['fall'], ['Viking', 'Nero', 'Galicjanka']),
  orchardSeed('Honeyberry', 'bush', 'berry', ['spring', 'summer'], ['Borealis', 'Tundra', 'Indigo Gem', 'Aurora']),

  // Vines and climbers: 45 definitions.
  orchardSeed('Wine Grape', 'vine', 'vine', ['summer', 'fall'], [
    'Cabernet Sauvignon', 'Merlot', 'Pinot Noir', 'Syrah', 'Chardonnay', 'Riesling',
    'Sauvignon Blanc', 'Chenin Blanc', 'Tempranillo', 'Sangiovese',
  ]),
  orchardSeed('Table Grape', 'vine', 'vine', ['summer', 'fall'], [
    'Concord', 'Thompson Seedless', 'Flame Seedless', 'Crimson Seedless',
    'Autumn Royal', 'Red Globe', 'Niagara', 'Himrod',
  ]),
  orchardSeed('Muscadine', 'vine', 'vine', ['summer', 'fall'], ['Scuppernong', 'Carlos', 'Noble']),
  orchardSeed('Kiwi', 'vine', 'vine', ['fall'], ['Hayward', 'Bruno', 'Abbott', 'Monty', 'Allison']),
  orchardSeed('Hardy Kiwi', 'vine', 'vine', ['summer', 'fall'], ['Ananasnaya', 'Issai', "Ken's Red"]),
  orchardSeed('Passionfruit', 'vine', 'vine', ['summer', 'fall'], ['Purple Possum', 'Frederick', 'Panama Red', 'Sweet Granadilla']),
  orchardSeed('Hop', 'vine', 'vine', ['summer', 'fall'], ['Cascade', 'Centennial', 'Saaz', 'Hallertau Mittelfrüh', 'Fuggle']),
  orchardSeed('Vanilla', 'vine', 'vine', ['summer', 'fall'], ['Bourbon', 'Tahitian']),
  orchardSeed('Pepper Vine', 'vine', 'vine', ['summer', 'fall'], ['Malabar Black', 'Tellicherry', 'Kampot Red']),
  orchardSeed('Schisandra', 'vine', 'vine', ['summer', 'fall'], ['Eastern Prince', 'Volgar']),
]

function orchardPollination(seed: OrchardFamilySeed, hash: number): PollinationMethod {
  if (seed.plantForm === 'vine') return hash % 3 === 0 ? 'cross' : 'insect'
  if (seed.climate === 'nut') return hash % 2 === 0 ? 'wind' : 'cross'
  if (seed.plantName === 'Banana' || seed.plantName === 'Fig' || seed.plantName === 'Coffee') return 'self'
  return hash % 4 === 0 ? 'self' : hash % 3 === 0 ? 'cross' : 'insect'
}

function orchardDefinitions(): readonly OrchardPlantDef[] {
  const rows: OrchardPlantDef[] = []
  let authoredIndex = 0
  for (const family of ORCHARD_FAMILIES) {
    for (const cultivar of family.cultivars) {
      const plantSlug = slugify(family.plantName)
      const cultivarSlug = slugify(cultivar)
      const id = `orchard:${plantSlug}-${cultivarSlug}`
      const hash = stableHash(id)
      const level = (authoredIndex % 100) + 1
      const regions = regionsFor(hash + 17)
      const canopyBase = family.plantForm === 'tree' ? 4 : family.plantForm === 'vine' ? 2 : 1
      const maturityDays = 18 + canopyBase * 5 + (hash % 25)
      const harvestIntervalDays = 3 + (hash % 6) + (family.climate === 'nut' ? 3 : 0)
      const yieldMin = 1 + (hash % 3)
      const yieldMax = yieldMin + 1 + ((hash >>> 5) % 4)
      const purchasePrice = 180 + level * 9 + canopyBase * 65 + (hash % 90)
      const sellPrice = Math.ceil((purchasePrice * 1.2) / Math.max(3, Math.floor((28 * family.seasons.length) / harvestIntervalDays) * ((yieldMin + yieldMax) / 2)))
      const displayName = `${cultivar} ${family.plantName}`
      const support = family.plantForm === 'vine' ? 'permanent trellis support' : family.plantForm === 'bush' ? 'renewal pruning' : 'annual structural pruning'
      const harvest = family.climate === 'nut' ? 'shake harvest' : family.plantForm === 'vine' ? 'trellis picking' : 'hand picking'
      const pollination = orchardPollination(family, hash)

      rows.push({
        kind: 'orchard',
        id,
        name: displayName,
        description: `${displayName} is a ${family.climate}-climate ${family.plantForm} managed with ${support}, ${pollination} pollination, and ${harvest} every ${harvestIntervalDays} productive days.`,
        nameKey: `content.orchard.${plantSlug}.${cultivarSlug}.name`,
        descriptionKey: `content.orchard.${plantSlug}.${cultivarSlug}.description`,
        seasons: family.seasons,
        regions,
        unlock: {
          level,
          reputation: Math.min(1000, 35 + level * 8),
          regionId: regions[0],
          questId: level % 25 === 0 ? `quest:orchard-craft-${Math.ceil(level / 25)}` : null,
          prerequisiteIds: [],
        },
        economy: {
          purchasePrice,
          sellPrice: Math.max(8, sellPrice),
          craftValue: Math.max(10, sellPrice + canopyBase * 4),
          maintenancePerDay: canopyBase + (family.plantForm === 'vine' ? 2 : 1),
          marketElasticity: 0.55 + (hash % 105) / 100,
          seasonalDemand: seasonalDemand(family.seasons, 1.12 + (hash % 18) / 100),
        },
        tags: [family.climate, family.plantForm, `plant:${plantSlug}`, `pollination:${pollination}`, `harvest:${slugify(harvest)}`],
        plantForm: family.plantForm,
        plantFamily: family.plantName,
        cultivar,
        maturityDays,
        harvestIntervalDays,
        dormantSeasons: ALL_SEASONS.filter((season) => !family.seasons.includes(season)),
        pollination,
        canopySize: canopyBase + (hash % 2),
        yield: {
          productId: `product:fresh-${plantSlug}-${cultivarSlug}`,
          min: yieldMin,
          max: yieldMax,
        },
      })
      authoredIndex += 1
    }
  }
  return canonicalSort(rows)
}

export const VALLEY_ORCHARD_PLANTS: readonly OrchardPlantDef[] = orchardDefinitions()

interface AnimalGroupSeed {
  readonly speciesGroup: string
  readonly husbandryNote: string
  readonly housing: readonly AnimalHousing[]
  readonly diet: readonly AnimalDiet[]
  readonly temperament: AnimalTemperament
  readonly careDifficulty: CareDifficulty
  readonly maturityDays: number
  readonly lifespanYears: number
  readonly commodities: readonly string[]
  readonly breeds: readonly string[]
}

function animalSeed(
  speciesGroup: string,
  husbandryNote: string,
  housing: readonly AnimalHousing[],
  diet: readonly AnimalDiet[],
  temperament: AnimalTemperament,
  careDifficulty: CareDifficulty,
  maturityDays: number,
  lifespanYears: number,
  commodities: readonly string[],
  breeds: readonly string[],
): AnimalGroupSeed {
  return {
    speciesGroup,
    husbandryNote,
    housing,
    diet,
    temperament,
    careDifficulty,
    maturityDays,
    lifespanYears,
    commodities,
    breeds,
  }
}

/** Thirteen authored husbandry families totaling exactly 150 named animal definitions. */
const ANIMAL_GROUPS: readonly AnimalGroupSeed[] = [
  animalSeed(
    'chicken',
    'a pasture-scratching layer with a secure roost and daily nest-box routine',
    ['coop', 'pasture'],
    ['grain', 'seeds', 'insects'],
    'social',
    'easy',
    56,
    9,
    ['egg', 'feather', 'manure'],
    [
      'Valley Mixed Chicken', 'Rhode Island Red Chicken', 'White Leghorn Chicken',
      'Barred Plymouth Rock Chicken', 'Light Sussex Chicken', 'Black Copper Marans Chicken',
      'Ameraucana Chicken', 'Buff Orpington Chicken', 'Silkie Chicken', 'Light Brahma Chicken',
    ],
  ),
  animalSeed(
    'waterfowl',
    'a water-loving flock bird that needs dry night shelter beside a clean paddling area',
    ['coop', 'pond', 'pasture'],
    ['grain', 'plants', 'insects'],
    'lively',
    'moderate',
    70,
    12,
    ['egg', 'feather', 'manure'],
    [
      'Valley Mixed Duck', 'Pekin Duck', 'Khaki Campbell Duck', 'Indian Runner Duck', 'Muscovy Duck',
      'Valley Mixed Goose', 'Embden Goose', 'Toulouse Goose', 'Valley Mixed Turkey', 'Bourbon Red Turkey',
    ],
  ),
  animalSeed(
    'specialty farm bird',
    'a specialist flock bird managed with species-sized fencing, dust bathing, and protected nesting',
    ['coop', 'pasture'],
    ['grain', 'seeds', 'insects', 'plants'],
    'watchful',
    'advanced',
    90,
    18,
    ['egg', 'feather', 'manure'],
    [
      'Japanese Quail', 'Northern Bobwhite', 'Helmeted Guineafowl', 'Ring-Necked Pheasant',
      'Chukar Partridge', 'King Pigeon', 'Ostrich', 'Emu', 'Greater Rhea', 'Indian Peafowl',
    ],
  ),
  animalSeed(
    'bovine',
    'a large grazing ruminant needing deep bedding, weather shelter, regular hoof care, and calm milking handling',
    ['barn', 'pasture'],
    ['hay', 'fodder', 'forage'],
    'calm',
    'advanced',
    420,
    20,
    ['milk', 'hide', 'manure'],
    [
      'Valley Mixed Dairy Cow', 'Holstein-Friesian Cattle', 'Jersey Cattle', 'Guernsey Cattle',
      'Brown Swiss Cattle', 'Ayrshire Cattle', 'Milking Shorthorn Cattle', 'Dexter Cattle',
      'Highland Cattle', 'Galloway Cattle', 'Aberdeen Angus Cattle', 'Hereford Cattle',
      'Charolais Cattle', 'Limousin Cattle', 'Simmental Cattle', 'Brahman Cattle',
      'Murrah Buffalo', 'Mediterranean Buffalo', 'Domestic Yak', 'American Bison',
    ],
  ),
  animalSeed(
    'sheep and goat',
    'a sure-footed small ruminant requiring rotational browse, dry shelter, hoof trimming, and fibre or milk care',
    ['barn', 'pasture'],
    ['hay', 'forage', 'fodder'],
    'curious',
    'moderate',
    210,
    14,
    ['milk', 'fiber', 'manure'],
    [
      'Valley Mixed Wool Sheep', 'Merino Sheep', 'Bluefaced Leicester Sheep', 'Lincoln Longwool Sheep',
      'Romney Sheep', 'Shetland Sheep', 'Icelandic Sheep', 'Karakul Sheep', 'East Friesian Sheep',
      'Awassi Sheep', 'Valley Mixed Dairy Goat', 'Saanen Goat', 'Alpine Goat', 'Anglo-Nubian Goat',
      'LaMancha Goat', 'Toggenburg Goat', 'Oberhasli Goat', 'Angora Goat', 'Pygora Goat', 'Cashmere Goat',
    ],
  ),
  animalSeed(
    'pig',
    'an intelligent rooting animal managed with shade, wallow access, enrichment, and resilient pasture rotation',
    ['barn', 'pasture'],
    ['fodder', 'forage', 'fruit', 'plants'],
    'curious',
    'moderate',
    180,
    16,
    ['truffle', 'bristle', 'manure'],
    [
      'Valley Mixed Foraging Pig', 'Berkshire Pig', 'Tamworth Pig', 'Large Black Pig',
      'Gloucestershire Old Spots Pig', 'Mangalitsa Pig', 'Duroc Pig', 'Hampshire Pig',
      'Kunekune Pig', 'Iberian Pig',
    ],
  ),
  animalSeed(
    'rabbit',
    'a quiet hutch animal needing clean bedding, chew enrichment, cool shade, and careful fibre grooming',
    ['hutch', 'pasture'],
    ['hay', 'pellets', 'plants'],
    'gentle',
    'moderate',
    120,
    10,
    ['fiber', 'manure'],
    [
      'Valley Mixed Angora Rabbit', 'English Angora Rabbit', 'French Angora Rabbit',
      'German Angora Rabbit', 'Satin Angora Rabbit', 'Flemish Giant Rabbit',
      'New Zealand White Rabbit', 'Californian Rabbit', 'Rex Rabbit', 'Silver Fox Rabbit',
    ],
  ),
  animalSeed(
    'equid',
    'a working equid trained through calm daily handling with turnout, hoof care, tack fitting, and rest days',
    ['stable', 'pasture'],
    ['hay', 'fodder', 'forage'],
    'gentle',
    'advanced',
    730,
    28,
    ['farm-service', 'hair', 'manure'],
    [
      'Valley Farm Horse', 'Clydesdale Horse', 'Percheron Horse', 'Belgian Draft Horse',
      'Suffolk Punch Horse', 'American Quarter Horse', 'Morgan Horse', 'Icelandic Horse',
      'Standard Donkey', 'American Mammoth Jackstock',
    ],
  ),
  animalSeed(
    'camelid and farmed deer',
    'a climate-adapted grazer requiring herd company, secure pasture, species-specific shelter, and seasonal coat care',
    ['barn', 'pasture'],
    ['hay', 'forage', 'plants'],
    'watchful',
    'advanced',
    400,
    19,
    ['fiber', 'milk', 'antler', 'manure'],
    [
      'Llama', 'Huacaya Alpaca', 'Suri Alpaca', 'Bactrian Camel', 'Dromedary Camel',
      'Reindeer', 'Red Deer', 'Fallow Deer', 'Sika Deer', 'Elk Wapiti',
    ],
  ),
  animalSeed(
    'managed insect',
    'a managed colony kept in a clean climate-safe habitat with forage planning and low-disturbance inspections',
    ['apiary', 'terrarium'],
    ['nectar', 'plants', 'fruit'],
    'independent',
    'advanced',
    35,
    5,
    ['honey', 'wax', 'colony-craft', 'pollination-service'],
    [
      'Valley Mixed Honey-Bee Colony', 'Italian Honey-Bee Colony', 'Carniolan Honey-Bee Colony',
      'Buckfast Honey-Bee Colony', 'Australian Stingless Bee Colony', 'Buff-Tailed Bumblebee Colony',
      'Alfalfa Leafcutter Bee Shelter', 'Blue Orchard Mason Bee Nest',
      'Domestic Silkworm Colony', 'Cochineal Scale Colony',
    ],
  ),
  animalSeed(
    'freshwater aquaculture',
    'a stocked freshwater cohort managed through oxygen, temperature, habitat cover, and carefully measured feed',
    ['pond', 'aquarium'],
    ['pellets', 'plants', 'insects'],
    'shy',
    'advanced',
    160,
    9,
    ['fish', 'roe', 'pond-fertilizer'],
    [
      'Valley Mixed Pond Fish', 'Rainbow Trout', 'Arctic Char', 'Brook Trout', 'Nile Tilapia',
      'Channel Catfish', 'Common Carp', 'Grass Carp', 'Yellow Perch', 'Barramundi',
    ],
  ),
  animalSeed(
    'shellfish and crustacean',
    'a water-quality-sensitive cohort raised with salinity, substrate, stocking-density, and filtration controls',
    ['pond', 'aquarium'],
    ['pellets', 'plants'],
    'independent',
    'advanced',
    240,
    12,
    ['shellfish', 'shell', 'pearl'],
    [
      'Whiteleg Shrimp', 'Giant River Prawn', 'Australian Redclaw Crayfish', 'Marron Crayfish',
      'Pacific Oyster', 'Blue Mussel', 'Manila Clam', 'Green-Lipped Mussel',
      'Blacklip Abalone', 'Akoya Pearl Oyster',
    ],
  ),
  animalSeed(
    'working farm companion',
    'a trained farm companion given a defined job, humane work limits, enrichment, shelter, and off-duty social time',
    ['barn', 'pasture', 'stable'],
    ['pellets', 'grain'],
    'social',
    'moderate',
    365,
    14,
    ['farm-service'],
    [
      'Border Collie', 'Australian Shepherd', 'Australian Cattle Dog', 'Great Pyrenees',
      'Maremma Sheepdog', 'Anatolian Shepherd', 'Rat Terrier', 'Jack Russell Terrier',
      'Barn Cat', 'Domestic Ferret',
    ],
  ),
]

function animalDefinitions(): readonly AnimalDef[] {
  const rows: AnimalDef[] = []
  let authoredIndex = 0
  for (const group of ANIMAL_GROUPS) {
    for (const breed of group.breeds) {
      const slug = slugify(breed)
      const id = `animal:${slug}`
      const hash = stableHash(id)
      const level = (authoredIndex % 100) + 1
      const regions = regionsFor(hash + 41)
      const purchasePrice = 140 + group.maturityDays * 2 + level * 11 + (hash % 180)
      const upkeep = Math.max(2, Math.ceil(purchasePrice / 180))
      const activeCommodityCount = group.speciesGroup === 'managed insect' ? 2 : group.speciesGroup === 'bovine' ? 2 : 1
      const products = group.commodities.slice(0, activeCommodityCount).map((commodity, commodityIndex) => ({
        productId: `product:animal-${slug}-${slugify(commodity)}`,
        min: 1,
        max: 1 + ((hash >>> (commodityIndex + 2)) % 3),
        intervalDays: 1 + commodityIndex * 2 + (hash % 5),
      }))

      rows.push({
        kind: 'animal',
        id,
        name: breed,
        description: `${breed} is ${group.husbandryNote}; it matures in about ${group.maturityDays} days and contributes ${group.commodities.slice(0, activeCommodityCount).join(' and ')} through a persistent care routine.`,
        nameKey: `content.animal.${slug}.name`,
        descriptionKey: `content.animal.${slug}.description`,
        seasons: ALL_SEASONS,
        regions,
        unlock: {
          level,
          reputation: Math.min(1000, 50 + level * 8),
          regionId: level > 10 ? regions[0] : null,
          questId: level % 20 === 10 ? `quest:husbandry-tier-${Math.ceil(level / 20)}` : null,
          prerequisiteIds: [],
        },
        economy: {
          purchasePrice,
          sellPrice: Math.round(purchasePrice * 0.62),
          craftValue: Math.round(purchasePrice * 0.48),
          maintenancePerDay: upkeep,
          marketElasticity: 0.35 + (hash % 85) / 100,
          seasonalDemand: {
            spring: 1.08 + (hash % 10) / 100,
            summer: 1.02 + ((hash >>> 3) % 10) / 100,
            fall: 1.05 + ((hash >>> 6) % 10) / 100,
            winter: 0.92 + ((hash >>> 9) % 10) / 100,
          },
        },
        tags: [group.speciesGroup, `housing:${group.housing[0]}`, `care:${group.careDifficulty}`, `temperament:${group.temperament}`, ...group.commodities.map((commodity) => `output:${slugify(commodity)}`)],
        speciesGroup: group.speciesGroup,
        breed,
        housing: group.housing,
        diet: group.diet,
        temperament: group.temperament,
        careDifficulty: group.careDifficulty,
        maturityDays: group.maturityDays + (hash % 31) - 15,
        lifespanYears: Math.max(2, group.lifespanYears + (hash % 5) - 2),
        products,
      })
      authoredIndex += 1
    }
  }
  return canonicalSort(rows)
}

export const VALLEY_ANIMALS: readonly AnimalDef[] = animalDefinitions()

export const VALLEY_FLORA_FAUNA_COUNTS = {
  crops: VALLEY_CROPS.length,
  orchardPlants: VALLEY_ORCHARD_PLANTS.length,
  animals: VALLEY_ANIMALS.length,
} as const
