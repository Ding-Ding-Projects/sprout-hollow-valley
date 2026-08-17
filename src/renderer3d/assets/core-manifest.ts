import type {
  AssetDescriptorInput,
  LazyAssetRegistry,
} from '../../engine3d/assets'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import manifestSource from '../../../assets/3d/core/manifest.json?raw'

export type CoreGltfAssetKind = 'gltf'
export type CoreGltfAssetCategory = string

export interface CoreGltfAssetMetadata {
  readonly loadPolicy: 'on-demand'
  readonly [key: string]: unknown
}

export type CoreGltfAssetDescriptorInput = AssetDescriptorInput<
  CoreGltfAssetKind,
  CoreGltfAssetCategory,
  CoreGltfAssetMetadata
>

export type CoreGltfAssetRegistry = LazyAssetRegistry<
  GLTF,
  CoreGltfAssetKind,
  CoreGltfAssetCategory,
  CoreGltfAssetMetadata
>

interface CoreManifestRecord {
  readonly schemaVersion: number
  readonly assets: readonly CoreGltfAssetDescriptorInput[]
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be a non-empty string`)
  }
  return value
}

function requireEstimatedBytes(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer`)
  }
  return value as number
}

function stringTags(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return Object.freeze([])
  const tags = value.map((tag, index) => requireString(tag, `metadata.tags[${index}]`))
  return Object.freeze(tags)
}

function parseManifestAsset(value: unknown, index: number): CoreGltfAssetDescriptorInput {
  const asset = requireRecord(value, `assets[${index}]`)
  const metadata = requireRecord(asset.metadata, `assets[${index}].metadata`)
  if (metadata.loadPolicy !== 'on-demand') {
    throw new TypeError(`assets[${index}].metadata.loadPolicy must be on-demand`)
  }
  const kind = requireString(asset.kind, `assets[${index}].kind`)
  if (kind !== 'gltf') throw new TypeError(`assets[${index}].kind must be gltf`)

  return Object.freeze({
    id: requireString(asset.id, `assets[${index}].id`),
    url: requireString(asset.uri, `assets[${index}].uri`),
    category: requireString(asset.category, `assets[${index}].category`),
    kind,
    estimatedBytes: requireEstimatedBytes(
      asset.estimatedBytes,
      `assets[${index}].estimatedBytes`,
    ),
    metadata: Object.freeze({ ...metadata, loadPolicy: 'on-demand' as const }),
    tags: stringTags(metadata.tags),
  })
}

/** Parse only the thin index. Model bytes remain in lazy Vite modules until acquisition. */
export function parseCoreGltfManifest(source: string): CoreManifestRecord {
  const manifest = requireRecord(JSON.parse(source) as unknown, 'core asset manifest')
  if (manifest.schemaVersion !== 1) {
    throw new Error(`Unsupported core asset manifest schema: ${String(manifest.schemaVersion)}`)
  }
  if (!Array.isArray(manifest.assets)) throw new TypeError('core asset manifest assets must be an array')
  return Object.freeze({
    schemaVersion: 1,
    assets: Object.freeze(manifest.assets.map(parseManifestAsset)),
  })
}

export const CORE_GLTF_MANIFEST = parseCoreGltfManifest(manifestSource)

/** Registration indexes descriptors only and never imports or parses a glTF payload. */
export function registerCoreGltfManifest(
  registry: CoreGltfAssetRegistry,
): readonly CoreGltfAssetDescriptorInput[] {
  registry.registerMany(CORE_GLTF_MANIFEST.assets)
  return CORE_GLTF_MANIFEST.assets
}
