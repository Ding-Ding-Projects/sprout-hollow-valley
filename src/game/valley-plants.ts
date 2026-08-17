import { VALLEY_CONTENT_REGISTRY } from '../content/registry'
import type {
  CropDef as ValleyCropDefinition,
  OrchardPlantDef as ValleyOrchardDefinition,
} from '../content/types'
import type { CropEntry } from './crops'
import type { TreeDef } from './trees'
import type { PlantArt } from './types'

function stableHash(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function color(hash: number, shift: number): string {
  const value = (hash >>> shift) ^ Math.imul(hash, 0x45d9f3b)
  const red = 48 + (value & 0x9f)
  const green = 64 + ((value >>> 8) & 0x8f)
  const blue = 48 + ((value >>> 16) & 0x9f)
  return `#${Math.min(255, red).toString(16).padStart(2, '0')}${Math.min(255, green).toString(16).padStart(2, '0')}${Math.min(255, blue).toString(16).padStart(2, '0')}`
}

function stageDays(totalDays: number, stages: number): number[] {
  const total = Math.max(stages, Math.floor(totalDays))
  const base = Math.floor(total / stages)
  let remainder = total % stages
  return Array.from({ length: stages }, () => {
    const days = base + (remainder > 0 ? 1 : 0)
    remainder = Math.max(0, remainder - 1)
    return Math.max(1, days)
  })
}

function cropShape(definition: ValleyCropDefinition): PlantArt['shape'] {
  switch (definition.cropFamily) {
    case 'root':
    case 'tuber':
    case 'allium':
      return 'root'
    case 'leafy':
    case 'brassica':
    case 'herb':
      return 'leafy'
    case 'cereal':
    case 'fiber':
      return 'long'
    case 'legume':
    case 'oilseed':
    case 'flower':
      return 'cluster'
    default:
      return 'round'
  }
}

function cropArt(definition: ValleyCropDefinition): PlantArt {
  const hash = stableHash(definition.id)
  return {
    stem: color(hash, 3),
    leaf: color(hash, 9),
    fruit: color(hash, 17),
    shape: cropShape(definition),
    fruits: Math.max(1, Math.min(8, definition.yield.max + (hash % 3))),
    height: Math.max(4, Math.min(14, 5 + Math.ceil(definition.growthDays / 2))),
  }
}

function orchardArt(definition: ValleyOrchardDefinition): PlantArt {
  const hash = stableHash(definition.id)
  return {
    stem: color(hash, 2),
    leaf: color(hash, 11),
    fruit: color(hash, 19),
    shape: definition.plantForm === 'vine'
      ? 'long'
      : definition.plantForm === 'bush'
        ? 'cluster'
        : 'round',
    fruits: Math.max(1, Math.min(8, definition.yield.max + (hash % 3))),
    height: definition.plantForm === 'tree'
      ? 14
      : definition.plantForm === 'vine'
        ? 11
        : 9,
  }
}

function cropRule(definition: ValleyCropDefinition): CropEntry {
  return Object.freeze({
    id: definition.id,
    name: definition.name.toUpperCase(),
    seasons: [...definition.seasons],
    level: definition.unlock.level,
    seedCost: definition.economy.purchasePrice,
    basePrice: definition.economy.sellPrice,
    stageDays: stageDays(definition.growthDays, 4),
    yieldMin: definition.yield.min,
    yieldMax: definition.yield.max,
    regrowDays: definition.regrowDays,
    art: cropArt(definition),
  })
}

function orchardRule(definition: ValleyOrchardDefinition): TreeDef {
  return Object.freeze({
    id: definition.id,
    name: definition.name.toUpperCase(),
    seasons: [...definition.seasons],
    level: definition.unlock.level,
    seedCost: definition.economy.purchasePrice,
    basePrice: definition.economy.sellPrice,
    stageDays: stageDays(definition.maturityDays, 4),
    yieldMin: definition.yield.min,
    yieldMax: definition.yield.max,
    regrowDays: Math.max(1, definition.harvestIntervalDays),
    wood: Math.max(2, Math.round(definition.canopySize * 4)),
    art: orchardArt(definition),
  })
}

/** The 500 authored catalogue crops expressed through the inherited farming-rule shape. */
export const VALLEY_CROP_RULES: readonly CropEntry[] = Object.freeze(
  VALLEY_CONTENT_REGISTRY.crops.map(cropRule),
)

/** The 250 authored orchard entries expressed through the inherited perennial-rule shape. */
export const VALLEY_TREE_RULES: readonly TreeDef[] = Object.freeze(
  VALLEY_CONTENT_REGISTRY.orchardPlants.map(orchardRule),
)

const CROP_CONTENT_BY_ID = new Map(
  VALLEY_CONTENT_REGISTRY.crops.map((definition) => [definition.id, definition]),
)
const ORCHARD_CONTENT_BY_ID = new Map(
  VALLEY_CONTENT_REGISTRY.orchardPlants.map((definition) => [definition.id, definition]),
)

export function valleyCropContentById(id: string): ValleyCropDefinition | undefined {
  return CROP_CONTENT_BY_ID.get(id)
}

export function valleyOrchardContentById(id: string): ValleyOrchardDefinition | undefined {
  return ORCHARD_CONTENT_BY_ID.get(id)
}
