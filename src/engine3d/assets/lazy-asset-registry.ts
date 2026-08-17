import { toBundledAssetUrl } from './url-policy'
import type {
  AssetDescriptor,
  AssetDescriptorInput,
  AssetEvictionReason,
  AssetIndexQuery,
  AssetLease,
  AssetLoadFailure,
  AssetRegistryStats,
  LazyAssetRegistryOptions,
} from './types'

const DEFAULT_MAX_LOADED_ENTRIES = 256

interface LoadedEntry<TAsset> {
  readonly value: TAsset
  readonly weight: number
  references: number
  lastUsed: number
}

export class DuplicateAssetIdError extends Error {
  readonly id: string

  constructor(id: string) {
    super(`Asset descriptor id is already registered: ${id}`)
    this.name = 'DuplicateAssetIdError'
    this.id = id
  }
}

export class InvalidAssetDescriptorError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidAssetDescriptorError'
  }
}

export class UnknownAssetError extends Error {
  readonly id: string

  constructor(id: string) {
    super(`Unknown asset descriptor: ${id}`)
    this.name = 'UnknownAssetError'
    this.id = id
  }
}

function requireLabel(value: string, field: string): void {
  if (value.length === 0 || value !== value.trim()) {
    throw new InvalidAssetDescriptorError(`${field} must be a non-empty trimmed string`)
  }
  if (/[\u0000-\u001f\u007f]/u.test(value)) {
    throw new InvalidAssetDescriptorError(`${field} must not contain control characters`)
  }
}

function requireNonNegativeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new InvalidAssetDescriptorError(`${field} must be a non-negative safe integer`)
  }
}

function requirePositiveLimit(value: number, field: string, allowInfinity: boolean): void {
  if (allowInfinity && value === Number.POSITIVE_INFINITY) return
  if (!Number.isFinite(value) || value <= 0 || Math.floor(value) !== value) {
    throw new InvalidAssetDescriptorError(`${field} must be a positive integer`)
  }
}

function immutableDescriptor<
  TKind extends string,
  TCategory extends string,
  TMetadata extends object,
>(
  input: AssetDescriptorInput<TKind, TCategory, TMetadata>,
): AssetDescriptor<TKind, TCategory, TMetadata> {
  requireLabel(input.id, 'id')
  requireLabel(input.kind, `kind for ${input.id}`)
  requireLabel(input.category, `category for ${input.id}`)
  if (input.metadata === null || typeof input.metadata !== 'object' || Array.isArray(input.metadata)) {
    throw new InvalidAssetDescriptorError(`metadata for ${input.id} must be an object`)
  }
  if (input.estimatedBytes !== undefined) {
    requireNonNegativeInteger(input.estimatedBytes, `estimatedBytes for ${input.id}`)
  }
  if (input.version !== undefined) requireLabel(input.version, `version for ${input.id}`)

  const tags = [...(input.tags ?? [])]
  const seenTags = new Set<string>()
  for (const tag of tags) {
    requireLabel(tag, `tag for ${input.id}`)
    if (seenTags.has(tag)) {
      throw new InvalidAssetDescriptorError(`duplicate tag for ${input.id}: ${tag}`)
    }
    seenTags.add(tag)
  }

  const descriptor: AssetDescriptor<TKind, TCategory, TMetadata> = {
    id: input.id,
    kind: input.kind,
    category: input.category,
    url: toBundledAssetUrl(input.url),
    metadata: Object.freeze({ ...input.metadata }) as Readonly<TMetadata>,
    tags: Object.freeze(tags),
    ...(input.estimatedBytes === undefined ? {} : { estimatedBytes: input.estimatedBytes }),
    ...(input.version === undefined ? {} : { version: input.version }),
  }
  return Object.freeze(descriptor)
}

function increment(map: Map<string, number>, id: string): void {
  map.set(id, (map.get(id) ?? 0) + 1)
}

function decrement(map: Map<string, number>, id: string): void {
  const next = (map.get(id) ?? 0) - 1
  if (next <= 0) map.delete(id)
  else map.set(id, next)
}

/**
 * A Three-independent, index-first registry for bundled assets and content payloads.
 * Descriptor registration and index queries never invoke the payload loader.
 */
export class LazyAssetRegistry<
  TAsset,
  TKind extends string = string,
  TCategory extends string = string,
  TMetadata extends object = Record<string, unknown>,
> {
  private readonly descriptors = new Map<string, AssetDescriptor<TKind, TCategory, TMetadata>>()
  private readonly idsByKindIndex = new Map<TKind, Set<string>>()
  private readonly idsByCategoryIndex = new Map<TCategory, Set<string>>()
  private readonly loaded = new Map<string, LoadedEntry<TAsset>>()
  private readonly inFlight = new Map<string, Promise<LoadedEntry<TAsset>>>()
  private readonly pendingConsumers = new Map<string, number>()
  private readonly attempts = new Map<string, number>()
  private readonly failures = new Map<string, AssetLoadFailure>()
  private readonly loader: LazyAssetRegistryOptions<TAsset, TKind, TCategory, TMetadata>['loader']
  private readonly weightOf?: LazyAssetRegistryOptions<TAsset, TKind, TCategory, TMetadata>['weightOf']
  private readonly onEvict?: LazyAssetRegistryOptions<TAsset, TKind, TCategory, TMetadata>['onEvict']
  private readonly maxLoadedEntries: number
  private readonly maxLoadedWeight: number
  private accessSequence = 0
  private totalLoadedWeight = 0
  private totalLoadAttempts = 0

  constructor(options: LazyAssetRegistryOptions<TAsset, TKind, TCategory, TMetadata>) {
    this.loader = options.loader
    this.weightOf = options.weightOf
    this.onEvict = options.onEvict
    this.maxLoadedEntries = options.maxLoadedEntries ?? DEFAULT_MAX_LOADED_ENTRIES
    this.maxLoadedWeight = options.maxLoadedWeight ?? Number.POSITIVE_INFINITY
    requirePositiveLimit(this.maxLoadedEntries, 'maxLoadedEntries', false)
    requirePositiveLimit(this.maxLoadedWeight, 'maxLoadedWeight', true)
  }

  get size(): number {
    return this.descriptors.size
  }

  register(
    input: AssetDescriptorInput<TKind, TCategory, TMetadata>,
  ): AssetDescriptor<TKind, TCategory, TMetadata> {
    return this.registerMany([input])[0]
  }

  /** Validates the full batch before changing any index. */
  registerMany(
    inputs: Iterable<AssetDescriptorInput<TKind, TCategory, TMetadata>>,
  ): readonly AssetDescriptor<TKind, TCategory, TMetadata>[] {
    const descriptors = Array.from(inputs, (input) => immutableDescriptor(input))
    const batchIds = new Set<string>()
    for (const descriptor of descriptors) {
      if (batchIds.has(descriptor.id) || this.descriptors.has(descriptor.id)) {
        throw new DuplicateAssetIdError(descriptor.id)
      }
      batchIds.add(descriptor.id)
    }

    for (const descriptor of descriptors) {
      this.descriptors.set(descriptor.id, descriptor)
      this.addToIndex(this.idsByKindIndex, descriptor.kind, descriptor.id)
      this.addToIndex(this.idsByCategoryIndex, descriptor.category, descriptor.id)
    }
    return Object.freeze(descriptors)
  }

  has(id: string): boolean {
    return this.descriptors.has(id)
  }

  descriptor(id: string): AssetDescriptor<TKind, TCategory, TMetadata> | undefined {
    return this.descriptors.get(id)
  }

  requireDescriptor(id: string): AssetDescriptor<TKind, TCategory, TMetadata> {
    const descriptor = this.descriptors.get(id)
    if (descriptor === undefined) throw new UnknownAssetError(id)
    return descriptor
  }

  kinds(): readonly TKind[] {
    return Object.freeze([...this.idsByKindIndex.keys()])
  }

  categories(): readonly TCategory[] {
    return Object.freeze([...this.idsByCategoryIndex.keys()])
  }

  idsByKind(kind: TKind): readonly string[] {
    return Object.freeze([...(this.idsByKindIndex.get(kind) ?? [])])
  }

  idsByCategory(category: TCategory): readonly string[] {
    return Object.freeze([...(this.idsByCategoryIndex.get(category) ?? [])])
  }

  query(
    query: AssetIndexQuery<TKind, TCategory> = {},
  ): readonly AssetDescriptor<TKind, TCategory, TMetadata>[] {
    const offset = query.offset ?? 0
    const limit = query.limit ?? Number.POSITIVE_INFINITY
    requireNonNegativeInteger(offset, 'query offset')
    if (limit !== Number.POSITIVE_INFINITY) requireNonNegativeInteger(limit, 'query limit')

    const kindIds = query.kind === undefined ? undefined : this.idsByKindIndex.get(query.kind)
    const categoryIds = query.category === undefined ? undefined : this.idsByCategoryIndex.get(query.category)
    if ((query.kind !== undefined && kindIds === undefined) ||
        (query.category !== undefined && categoryIds === undefined) || limit === 0) {
      return Object.freeze([])
    }

    let candidates: Iterable<string>
    if (kindIds !== undefined && categoryIds !== undefined) {
      candidates = kindIds.size <= categoryIds.size ? kindIds : categoryIds
    } else if (kindIds !== undefined) {
      candidates = kindIds
    } else if (categoryIds !== undefined) {
      candidates = categoryIds
    } else {
      candidates = this.descriptors.keys()
    }

    const found: Array<AssetDescriptor<TKind, TCategory, TMetadata>> = []
    let skipped = 0
    for (const id of candidates) {
      const descriptor = this.descriptors.get(id)
      if (descriptor === undefined) continue
      if (query.kind !== undefined && descriptor.kind !== query.kind) continue
      if (query.category !== undefined && descriptor.category !== query.category) continue
      if (skipped < offset) {
        skipped += 1
        continue
      }
      found.push(descriptor)
      if (found.length >= limit) break
    }
    return Object.freeze(found)
  }

  isLoaded(id: string): boolean {
    return this.loaded.has(id)
  }

  getLoaded(id: string): TAsset | undefined {
    const entry = this.loaded.get(id)
    if (entry === undefined) return undefined
    this.touch(entry)
    return entry.value
  }

  referenceCount(id: string): number {
    return this.loaded.get(id)?.references ?? 0
  }

  loadAttemptCount(id: string): number {
    return this.attempts.get(id) ?? 0
  }

  lastFailure(id: string): AssetLoadFailure | undefined {
    return this.failures.get(id)
  }

  /** Loads on demand without pinning the resident value. Concurrent calls share one load. */
  async getOrLoad(id: string): Promise<TAsset> {
    const descriptor = this.requireDescriptor(id)
    increment(this.pendingConsumers, id)
    try {
      const entry = await this.ensureLoaded(descriptor)
      this.touch(entry)
      this.trimToCapacity(id)
      return entry.value
    } finally {
      decrement(this.pendingConsumers, id)
    }
  }

  /** Loads on demand and pins the value until the returned lease is released. */
  async acquire(id: string): Promise<AssetLease<TAsset>> {
    const descriptor = this.requireDescriptor(id)
    increment(this.pendingConsumers, id)
    let referenceCreated = false
    try {
      const entry = await this.ensureLoaded(descriptor)
      entry.references += 1
      this.touch(entry)
      referenceCreated = true
      decrement(this.pendingConsumers, id)
      this.trimToCapacity()

      let released = false
      return Object.freeze({
        id,
        value: entry.value,
        get released(): boolean {
          return released
        },
        release: (): boolean => {
          if (released) return false
          released = true
          return this.releaseReference(id)
        },
      })
    } finally {
      if (!referenceCreated) decrement(this.pendingConsumers, id)
    }
  }

  /** Evicts an unreferenced payload immediately. Acquired and loading payloads are protected. */
  evict(id: string): boolean {
    return this.evictEntry(id, 'explicit')
  }

  /** Evicts every currently unreferenced payload and reports the ids that left memory. */
  clearUnused(): readonly string[] {
    const evicted: string[] = []
    for (const id of [...this.loaded.keys()]) {
      if (this.evictEntry(id, 'clear')) evicted.push(id)
    }
    return Object.freeze(evicted)
  }

  stats(): AssetRegistryStats {
    let activeReferences = 0
    for (const entry of this.loaded.values()) activeReferences += entry.references
    return Object.freeze({
      registered: this.descriptors.size,
      loaded: this.loaded.size,
      inFlight: this.inFlight.size,
      activeReferences,
      loadedWeight: this.totalLoadedWeight,
      loadAttempts: this.totalLoadAttempts,
      failedAssets: this.failures.size,
    })
  }

  private addToIndex<TKey extends string>(index: Map<TKey, Set<string>>, key: TKey, id: string): void {
    const ids = index.get(key)
    if (ids === undefined) index.set(key, new Set([id]))
    else ids.add(id)
  }

  private touch(entry: LoadedEntry<TAsset>): void {
    this.accessSequence += 1
    entry.lastUsed = this.accessSequence
  }

  private resolvedWeight(
    asset: TAsset,
    descriptor: AssetDescriptor<TKind, TCategory, TMetadata>,
  ): number {
    const weight = this.weightOf?.(asset, descriptor) ?? descriptor.estimatedBytes ?? 1
    if (!Number.isSafeInteger(weight) || weight < 0) {
      throw new InvalidAssetDescriptorError(`loaded weight for ${descriptor.id} must be a non-negative safe integer`)
    }
    return weight
  }

  private ensureLoaded(
    descriptor: AssetDescriptor<TKind, TCategory, TMetadata>,
  ): Promise<LoadedEntry<TAsset>> {
    const resident = this.loaded.get(descriptor.id)
    if (resident !== undefined) {
      this.touch(resident)
      return Promise.resolve(resident)
    }
    const shared = this.inFlight.get(descriptor.id)
    if (shared !== undefined) return shared

    const attempt = (this.attempts.get(descriptor.id) ?? 0) + 1
    this.attempts.set(descriptor.id, attempt)
    this.totalLoadAttempts += 1

    let pending!: Promise<LoadedEntry<TAsset>>
    pending = Promise.resolve()
      .then(() => this.loader(descriptor, { attempt }))
      .then((value): LoadedEntry<TAsset> => {
        const entry: LoadedEntry<TAsset> = {
          value,
          weight: this.resolvedWeight(value, descriptor),
          references: 0,
          lastUsed: 0,
        }
        this.touch(entry)
        this.loaded.set(descriptor.id, entry)
        this.totalLoadedWeight += entry.weight
        this.failures.delete(descriptor.id)
        return entry
      })
      .catch((error: unknown) => {
        this.failures.set(descriptor.id, Object.freeze({ attempt, error }))
        throw error
      })
      .finally(() => {
        if (this.inFlight.get(descriptor.id) === pending) this.inFlight.delete(descriptor.id)
      })

    this.inFlight.set(descriptor.id, pending)
    return pending
  }

  private releaseReference(id: string): boolean {
    const entry = this.loaded.get(id)
    if (entry === undefined || entry.references === 0) return false
    entry.references -= 1
    this.touch(entry)
    this.trimToCapacity()
    return true
  }

  private overCapacity(): boolean {
    return this.loaded.size > this.maxLoadedEntries || this.totalLoadedWeight > this.maxLoadedWeight
  }

  private trimToCapacity(protectedId?: string): void {
    while (this.overCapacity()) {
      let oldestId: string | undefined
      let oldestUse = Number.POSITIVE_INFINITY
      for (const [id, entry] of this.loaded) {
        if (id === protectedId || entry.references > 0 || this.pendingConsumers.has(id)) continue
        if (entry.lastUsed < oldestUse ||
            (entry.lastUsed === oldestUse && (oldestId === undefined || id < oldestId))) {
          oldestId = id
          oldestUse = entry.lastUsed
        }
      }
      if (oldestId === undefined || !this.evictEntry(oldestId, 'capacity')) return
    }
  }

  private evictEntry(id: string, reason: AssetEvictionReason): boolean {
    const entry = this.loaded.get(id)
    if (entry === undefined || entry.references > 0 || this.pendingConsumers.has(id) || this.inFlight.has(id)) {
      return false
    }
    const descriptor = this.descriptors.get(id)
    if (descriptor === undefined) return false
    this.loaded.delete(id)
    this.totalLoadedWeight -= entry.weight
    this.onEvict?.(entry.value, descriptor, reason)
    return true
  }
}
