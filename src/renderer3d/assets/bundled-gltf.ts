import {
  BufferGeometry,
  LoadingManager,
  Material,
  Texture,
} from 'three'
import type { AnimationClip, Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneSkeletonSafe } from 'three/addons/utils/SkeletonUtils.js'
import { LazyAssetRegistry } from '../../engine3d/assets'
import type {
  AssetDescriptor,
  AssetEvictionReason,
} from '../../engine3d/assets'
import {
  registerCoreGltfManifest,
  type CoreGltfAssetCategory,
  type CoreGltfAssetKind,
  type CoreGltfAssetMetadata,
  type CoreGltfAssetRegistry,
} from './core-manifest'

const BUNDLED_GLTF_SOURCES = import.meta.glob<string>('/assets/3d/core/**/*.gltf', {
  query: '?raw',
  import: 'default',
})

type CoreGltfDescriptor = AssetDescriptor<
  CoreGltfAssetKind,
  CoreGltfAssetCategory,
  CoreGltfAssetMetadata
>

export interface CoreGltfAssetRegistryOptions {
  readonly maxLoadedEntries?: number
  readonly maxLoadedWeight?: number
  readonly onEvict?: (
    asset: GLTF,
    descriptor: CoreGltfDescriptor,
    reason: AssetEvictionReason,
  ) => void
}

export interface BundledGltfInstance {
  readonly root: Object3D
  readonly animations: readonly AnimationClip[]
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function assertEmbeddedResourceUris(
  document: Record<string, unknown>,
  collectionName: 'buffers' | 'images',
  assetUrl: string,
): void {
  const collection = document[collectionName]
  if (collection === undefined) return
  if (!Array.isArray(collection)) {
    throw new TypeError(`${assetUrl} has an invalid ${collectionName} collection`)
  }
  for (let index = 0; index < collection.length; index += 1) {
    const entry = requireObject(collection[index], `${assetUrl} ${collectionName}[${index}]`)
    const uri = entry.uri
    if (uri === undefined) continue
    if (typeof uri !== 'string' || !uri.startsWith('data:')) {
      throw new Error(
        `${assetUrl} ${collectionName}[${index}] must be embedded; external resources are disabled`,
      )
    }
  }
}

function assertSelfContainedGltf(source: string, assetUrl: string): void {
  const document = requireObject(JSON.parse(source) as unknown, assetUrl)
  const asset = requireObject(document.asset, `${assetUrl} asset`)
  if (asset.version !== '2.0') throw new Error(`${assetUrl} must use glTF 2.0`)
  assertEmbeddedResourceUris(document, 'buffers', assetUrl)
  assertEmbeddedResourceUris(document, 'images', assetUrl)
}

function createLockedLoadingManager(): LoadingManager {
  const manager = new LoadingManager()
  manager.setURLModifier((url) => {
    if (url.startsWith('data:') || url.startsWith('blob:')) return url
    throw new Error(`Blocked non-embedded glTF resource: ${url}`)
  })
  return manager
}

/** Loads only compile-time-discovered glTF modules; arbitrary URLs have no fallback. */
export class BundledGltfAssetLoader {
  private readonly loader = new GLTFLoader(createLockedLoadingManager())

  async load(descriptor: CoreGltfDescriptor): Promise<GLTF> {
    const moduleKey = `/${descriptor.url}`
    const importSource = BUNDLED_GLTF_SOURCES[moduleKey]
    if (importSource === undefined) {
      throw new Error(`Bundled glTF is absent from the build map: ${descriptor.url}`)
    }
    const source = await importSource()
    assertSelfContainedGltf(source, descriptor.url)
    return this.loader.parseAsync(source, '')
  }
}

/** Clone scene structure while retaining shared payload resources under the registry lease. */
export function instantiateBundledGltf(asset: GLTF): BundledGltfInstance {
  return Object.freeze({
    root: cloneSkeletonSafe(asset.scene),
    animations: Object.freeze([...asset.animations]),
  })
}

/** Dispose source resources only after the registry confirms that no lease is active. */
export function disposeBundledGltf(asset: GLTF): void {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const textures = new Set<Texture>()
  const visited = new Set<Object3D>()

  for (const scene of asset.scenes) {
    scene.traverse((object) => {
      if (visited.has(object)) return
      visited.add(object)
      const renderable = object as Object3D & {
        readonly isMesh?: boolean
        readonly geometry?: BufferGeometry
        readonly material?: Material | readonly Material[]
      }
      if (renderable.isMesh !== true) return
      if (renderable.geometry) geometries.add(renderable.geometry)
      const objectMaterials = Array.isArray(renderable.material)
        ? renderable.material
        : renderable.material
          ? [renderable.material]
          : []
      for (const material of objectMaterials) materials.add(material)
    })
  }

  for (const material of materials) {
    for (const value of Object.values(material as unknown as Record<string, unknown>)) {
      if (value instanceof Texture) textures.add(value)
    }
  }
  for (const texture of textures) texture.dispose()
  for (const material of materials) material.dispose()
  for (const geometry of geometries) geometry.dispose()
}

/** Create an index-first, lease-bounded registry and register only thin manifest rows. */
export function createCoreGltfAssetRegistry(
  options: CoreGltfAssetRegistryOptions = {},
): CoreGltfAssetRegistry {
  const loader = new BundledGltfAssetLoader()
  const registry = new LazyAssetRegistry<
    GLTF,
    CoreGltfAssetKind,
    CoreGltfAssetCategory,
    CoreGltfAssetMetadata
  >({
    loader: (descriptor) => loader.load(descriptor),
    maxLoadedEntries: options.maxLoadedEntries ?? 64,
    maxLoadedWeight: options.maxLoadedWeight,
    onEvict: (asset, descriptor, reason) => {
      disposeBundledGltf(asset)
      options.onEvict?.(asset, descriptor, reason)
    },
  })
  registerCoreGltfManifest(registry)
  return registry
}
