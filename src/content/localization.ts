import type {
  BuildingDef,
  ContentDefinition,
  ContentLocale,
  FactoryDef,
  LocalizationCatalog,
  LocalizationDictionary,
  LocalizationKey,
} from './types'

export interface LocalizationEntry {
  readonly key: LocalizationKey
  readonly value: string
  readonly path: string
}

function structureEntries(definition: FactoryDef | BuildingDef): readonly LocalizationEntry[] {
  const entries: LocalizationEntry[] = []
  definition.rooms.forEach((room, index) => {
    entries.push({ key: room.nameKey, value: room.name, path: `${definition.id}.rooms[${index}].nameKey` })
  })
  definition.stations.forEach((station, index) => {
    entries.push({ key: station.nameKey, value: station.name, path: `${definition.id}.stations[${index}].nameKey` })
  })
  return entries
}

export function localizationEntriesFor(definition: ContentDefinition): readonly LocalizationEntry[] {
  const entries: LocalizationEntry[] = [
    { key: definition.nameKey, value: definition.name, path: `${definition.id}.nameKey` },
    { key: definition.descriptionKey, value: definition.description, path: `${definition.id}.descriptionKey` },
  ]
  if (definition.kind === 'factory' || definition.kind === 'building') {
    entries.push(...structureEntries(definition))
  }
  return entries
}

export function localizationEntries(definitions: readonly ContentDefinition[]): readonly LocalizationEntry[] {
  return definitions.flatMap(localizationEntriesFor)
}

/**
 * English is authored directly beside each deterministic definition. Other locale
 * dictionaries remain explicit inputs so a missing translation can never be hidden
 * by silently copying English into the Cantonese or bilingual modes.
 */
export function createLocalizationCatalog(
  definitions: readonly ContentDefinition[],
  supplied: LocalizationCatalog = {},
): LocalizationCatalog {
  const english: Record<string, string> = {}
  for (const entry of localizationEntries(definitions)) english[entry.key] = entry.value

  return Object.freeze({
    ...supplied,
    en: Object.freeze({ ...english, ...(supplied.en ?? {}) }),
  })
}

export function localizationValue(
  catalog: LocalizationCatalog,
  locale: ContentLocale,
  key: LocalizationKey,
): string | undefined {
  return catalog[locale]?.[key]
}

export function missingLocalizationKeys(
  catalog: LocalizationCatalog,
  locale: ContentLocale,
  definitions: readonly ContentDefinition[],
): readonly LocalizationKey[] {
  const dictionary = catalog[locale]
  const missing = new Set<LocalizationKey>()
  for (const entry of localizationEntries(definitions)) {
    const value = dictionary?.[entry.key]
    if (typeof value !== 'string' || value.trim().length === 0) missing.add(entry.key)
  }
  return [...missing].sort()
}

export function mergeLocalizationDictionary(
  base: LocalizationDictionary,
  additions: LocalizationDictionary,
): LocalizationDictionary {
  return Object.freeze({ ...base, ...additions })
}
