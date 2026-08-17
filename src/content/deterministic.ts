import type {
  ContentCollectionKey,
  ContentDefinition,
  ContentRegistrySources,
  Season,
  SeasonalValues,
} from './types'
import { CONTENT_CATEGORY_ORDER } from './types'

const textEncoder = new TextEncoder()

/** Locale-independent comparison used everywhere catalogue order becomes observable. */
export function compareContentIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

/** Returns a fresh stable array; callers never mutate a category module's export. */
export function sortByContentId<T extends { readonly id: string }>(values: readonly T[]): readonly T[] {
  return [...values].sort((left, right) => compareContentIds(left.id, right.id))
}

export function canonicalizeContentSources(sources: ContentRegistrySources): ContentRegistrySources {
  return {
    crops: sortByContentId(sources.crops),
    orchardPlants: sortByContentId(sources.orchardPlants),
    animals: sortByContentId(sources.animals),
    factories: sortByContentId(sources.factories),
    buildings: sortByContentId(sources.buildings),
    products: sortByContentId(sources.products),
    recipes: sortByContentId(sources.recipes),
    materials: sortByContentId(sources.materials),
    decorations: sortByContentId(sources.decorations),
  }
}

export function flattenContentSources(sources: ContentRegistrySources): readonly ContentDefinition[] {
  const definitions: ContentDefinition[] = []
  for (const key of CONTENT_CATEGORY_ORDER) definitions.push(...sources[key])
  return definitions
}

function canonicalValue(value: unknown, seen: Set<object>): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Content data cannot contain a non-finite number')
    return Object.is(value, -0) ? 0 : value
  }
  if (typeof value === 'undefined') return null
  if (typeof value !== 'object') throw new Error(`Unsupported content value type: ${typeof value}`)
  if (seen.has(value)) throw new Error('Content data cannot contain a circular reference')

  seen.add(value)
  let result: unknown
  if (Array.isArray(value)) {
    result = value.map((entry) => canonicalValue(entry, seen))
  } else {
    const record = value as Readonly<Record<string, unknown>>
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(record).sort(compareContentIds)) {
      sorted[key] = canonicalValue(record[key], seen)
    }
    result = sorted
  }
  seen.delete(value)
  return result
}

/** Stable JSON with sorted object keys and explicit rejection of unsafe values. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalValue(value, new Set()))
}

/** Small deterministic digest suitable for save/catalogue compatibility checks. */
export function fnv1a32(value: string): string {
  let hash = 0x811c9dc5
  for (const byte of textEncoder.encode(value)) {
    hash ^= byte
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

export function contentFingerprint(sources: ContentRegistrySources): string {
  const canonical = canonicalizeContentSources(sources)
  return `fnv1a32:${fnv1a32(stableStringify(canonical))}`
}

/**
 * Turns authored taxonomy fragments into a stable namespaced ID. The optional
 * ordinal disambiguates intentionally repeated names without introducing entropy.
 */
export function makeContentId(namespace: string, label: string, ordinal?: number): string {
  const prefix = slug(namespace)
  const body = slug(label)
  if (!prefix || !body) throw new Error('makeContentId requires a substantive namespace and label')
  const suffix = ordinal === undefined ? '' : `-${Math.max(1, Math.floor(ordinal)).toString().padStart(3, '0')}`
  return `${prefix}:${body}${suffix}`
}

export function slug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

export function seasonalValues(base: number, overrides: Partial<Record<Season, number>> = {}): SeasonalValues {
  return {
    spring: overrides.spring ?? base,
    summer: overrides.summer ?? base,
    fall: overrides.fall ?? base,
    winter: overrides.winter ?? base,
  }
}

/** Deterministic Cartesian expansion for substantive authored taxonomies. */
export function cartesianProduct<T>(dimensions: readonly (readonly T[])[]): readonly (readonly T[])[] {
  let rows: readonly (readonly T[])[] = [[]]
  for (const dimension of dimensions) {
    const next: T[][] = []
    for (const row of rows) {
      for (const entry of dimension) next.push([...row, entry])
    }
    rows = next
  }
  return rows
}

export function collectionPath(key: ContentCollectionKey, index: number): string {
  return `${key}[${index}]`
}
