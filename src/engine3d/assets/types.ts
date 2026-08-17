declare const bundledAssetUrlBrand: unique symbol

/** A URL proven to resolve inside the packaged application rather than over a network. */
export type BundledAssetUrl = string & { readonly [bundledAssetUrlBrand]: true }

export interface AssetDescriptorInput<
  TKind extends string = string,
  TCategory extends string = string,
  TMetadata extends object = Record<string, unknown>,
> {
  readonly id: string
  readonly kind: TKind
  readonly category: TCategory
  readonly url: string
  readonly metadata: TMetadata
  readonly tags?: readonly string[]
  /** A manifest estimate used when no runtime weight function is supplied. */
  readonly estimatedBytes?: number
  readonly version?: string
}

/** The immutable, validated descriptor exposed to loaders and index consumers. */
export interface AssetDescriptor<
  TKind extends string = string,
  TCategory extends string = string,
  TMetadata extends object = Record<string, unknown>,
> {
  readonly id: string
  readonly kind: TKind
  readonly category: TCategory
  readonly url: BundledAssetUrl
  readonly metadata: Readonly<TMetadata>
  readonly tags: readonly string[]
  readonly estimatedBytes?: number
  readonly version?: string
}

export interface AssetLoadContext {
  /** One for the first call and incremented only when a loader is invoked again. */
  readonly attempt: number
}

export type AssetLoader<
  TAsset,
  TKind extends string = string,
  TCategory extends string = string,
  TMetadata extends object = Record<string, unknown>,
> = (
  descriptor: AssetDescriptor<TKind, TCategory, TMetadata>,
  context: AssetLoadContext,
) => Promise<TAsset> | TAsset

export interface AssetLease<TAsset> {
  readonly id: string
  readonly value: TAsset
  readonly released: boolean
  /** Releases exactly this lease. Calling it again is a harmless no-op. */
  release(): boolean
}

export interface AssetLoadFailure {
  readonly attempt: number
  readonly error: unknown
}

export interface AssetIndexQuery<TKind extends string, TCategory extends string> {
  readonly kind?: TKind
  readonly category?: TCategory
  readonly offset?: number
  readonly limit?: number
}

export type AssetEvictionReason = 'capacity' | 'explicit' | 'clear'

export interface LazyAssetRegistryOptions<
  TAsset,
  TKind extends string = string,
  TCategory extends string = string,
  TMetadata extends object = Record<string, unknown>,
> {
  readonly loader: AssetLoader<TAsset, TKind, TCategory, TMetadata>
  /** Maximum number of resident payloads. Acquired payloads remain pinned until release. */
  readonly maxLoadedEntries?: number
  /** Optional weighted bound; defaults to no weighted limit. */
  readonly maxLoadedWeight?: number
  readonly weightOf?: (
    asset: TAsset,
    descriptor: AssetDescriptor<TKind, TCategory, TMetadata>,
  ) => number
  readonly onEvict?: (
    asset: TAsset,
    descriptor: AssetDescriptor<TKind, TCategory, TMetadata>,
    reason: AssetEvictionReason,
  ) => void
}

export interface AssetRegistryStats {
  readonly registered: number
  readonly loaded: number
  readonly inFlight: number
  readonly activeReferences: number
  readonly loadedWeight: number
  readonly loadAttempts: number
  readonly failedAssets: number
}
