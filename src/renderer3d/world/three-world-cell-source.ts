import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
} from 'three'
import type { Object3D } from 'three'
import type {
  AssetLease,
  LoadedWorldCell,
  StaticCollider,
  WorldCellDescriptor,
  WorldCellSource,
} from '../../engine3d'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import {
  instantiateBundledGltf,
  type BundledGltfInstance,
  type CoreGltfAssetRegistry,
} from '../assets'

export const DEFAULT_CORE_MARKER_ASSET_ID = 'core.terrain.sprout-marker'

export interface StreamedGltfInstance extends BundledGltfInstance {
  readonly assetId: string
}

export interface ThreeWorldCellBuildContext {
  readonly descriptor: WorldCellDescriptor
  readonly cellSize: number
  readonly signal: AbortSignal
  /** Acquires a registry lease that remains pinned until this cell unloads. */
  acquireGltf(assetId: string): Promise<StreamedGltfInstance>
}

export interface ThreeWorldCellContent {
  readonly root: Object3D
  readonly colliders?: readonly StaticCollider[]
  /** Disposes only resources created specifically for this cell, not leased glTF data. */
  readonly dispose?: () => void | Promise<void>
}

export type ThreeWorldCellBuilder = (
  context: ThreeWorldCellBuildContext,
) => ThreeWorldCellContent | Promise<ThreeWorldCellContent>

export interface LoadedThreeWorldCell {
  readonly root: Object3D
  readonly colliderIds: readonly string[]
  readonly assetLeases: readonly AssetLease<GLTF>[]
  readonly dispose?: () => void | Promise<void>
}

export interface ThreeWorldCellSourceOptions {
  readonly scene: Scene
  readonly collision: {
    addStaticCollider(collider: StaticCollider): StaticCollider
    removeStaticCollider(id: string): boolean
  }
  readonly assets: CoreGltfAssetRegistry
  readonly cellSize: number
  readonly buildCell?: ThreeWorldCellBuilder
}

function abortError(): Error {
  const error = new Error('World cell load was aborted')
  error.name = 'AbortError'
  return error
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError()
}

/** Keep a broken builder from becoming an opaque Three.js console diagnostic. */
function assertThreeRoot(value: unknown, label: string): asserts value is Object3D {
  if (
    typeof value !== 'object' ||
    value === null ||
    (value as { readonly isObject3D?: unknown }).isObject3D !== true
  ) {
    throw new TypeError(`${label} returned an invalid Three root`)
  }
}

function seededCellColor(seed: number): number {
  const red = 72 + (seed & 0x1f)
  const green = 126 + ((seed >>> 5) & 0x3f)
  const blue = 66 + ((seed >>> 11) & 0x1f)
  return (red << 16) | (green << 8) | blue
}

/** A small authored-looking fallback cell used until a content lane supplies its own builder. */
export async function buildDefaultThreeWorldCell(
  context: ThreeWorldCellBuildContext,
): Promise<ThreeWorldCellContent> {
  throwIfAborted(context.signal)
  const { coordinate, key, seed } = context.descriptor
  const centerX = (coordinate.x + 0.5) * context.cellSize
  const centerZ = (coordinate.z + 0.5) * context.cellSize
  const root = new Group()
  root.name = `world-cell:${key}`
  root.position.set(centerX, 0, centerZ)

  const terrainGeometry = new PlaneGeometry(context.cellSize, context.cellSize, 1, 1)
  terrainGeometry.rotateX(-Math.PI / 2)
  const terrainMaterial = new MeshStandardMaterial({
    color: seededCellColor(seed),
    roughness: 0.94,
    metalness: 0,
    flatShading: true,
  })
  const terrain = new Mesh(terrainGeometry, terrainMaterial)
  terrain.name = `terrain:${key}`
  terrain.receiveShadow = true
  root.add(terrain)

  const ownedGeometries = [terrainGeometry]
  const ownedMaterials = [terrainMaterial]
  const colliders: StaticCollider[] = []

  if (seed % 5 === 0) {
    const stoneSize = 0.8 + ((seed >>> 17) & 0x7) * 0.08
    const stoneHeight = stoneSize * 0.75
    const stoneX = (seed & 1) === 0 ? context.cellSize * 0.28 : -context.cellSize * 0.28
    const stoneZ = (seed & 2) === 0 ? context.cellSize * 0.31 : -context.cellSize * 0.31
    const stoneGeometry = new BoxGeometry(stoneSize, stoneHeight, stoneSize)
    const stoneMaterial = new MeshStandardMaterial({
      color: 0x71806c,
      roughness: 0.88,
      flatShading: true,
    })
    const stone = new Mesh(stoneGeometry, stoneMaterial)
    stone.name = `stone:${key}`
    stone.position.set(stoneX, stoneHeight / 2, stoneZ)
    stone.castShadow = true
    stone.receiveShadow = true
    root.add(stone)
    ownedGeometries.push(stoneGeometry)
    ownedMaterials.push(stoneMaterial)
    colliders.push({
      id: `${key}:stone`,
      bounds: {
        min: {
          x: centerX + stoneX - stoneSize / 2,
          y: 0,
          z: centerZ + stoneZ - stoneSize / 2,
        },
        max: {
          x: centerX + stoneX + stoneSize / 2,
          y: stoneHeight,
          z: centerZ + stoneZ + stoneSize / 2,
        },
      },
    })
  }

  if (seed % 7 === 0) {
    const marker = await context.acquireGltf(DEFAULT_CORE_MARKER_ASSET_ID)
    throwIfAborted(context.signal)
    const markerX = context.cellSize * 0.18
    const markerZ = -context.cellSize * 0.2
    marker.root.name = `sprout-marker:${key}`
    marker.root.position.set(markerX, 0, markerZ)
    marker.root.traverse((object) => {
      const mesh = object as Object3D & { isMesh?: boolean; castShadow?: boolean }
      if (mesh.isMesh === true) mesh.castShadow = true
    })
    root.add(marker.root)
    colliders.push({
      id: `${key}:sprout-marker`,
      bounds: {
        min: { x: centerX + markerX - 0.28, y: 0, z: centerZ + markerZ - 0.28 },
        max: { x: centerX + markerX + 0.28, y: 0.87, z: centerZ + markerZ + 0.28 },
      },
    })
  }

  return {
    root,
    colliders: Object.freeze(colliders),
    dispose: () => {
      for (const geometry of ownedGeometries) geometry.dispose()
      for (const material of ownedMaterials) material.dispose()
    },
  }
}

/** Bridges deterministic engine cells to bounded Three scene, collision, and asset lifecycles. */
export class ThreeWorldCellSource implements WorldCellSource<LoadedThreeWorldCell> {
  private readonly buildCell: ThreeWorldCellBuilder

  constructor(private readonly options: ThreeWorldCellSourceOptions) {
    if (!Number.isFinite(options.cellSize) || options.cellSize <= 0) {
      throw new RangeError('cellSize must be a finite positive number')
    }
    this.buildCell = options.buildCell ?? buildDefaultThreeWorldCell
  }

  async load(
    descriptor: WorldCellDescriptor,
    signal: AbortSignal,
  ): Promise<LoadedThreeWorldCell> {
    const leases: AssetLease<GLTF>[] = []
    let content: ThreeWorldCellContent | undefined
    const colliderIds: string[] = []

    try {
      content = await this.buildCell({
        descriptor,
        cellSize: this.options.cellSize,
        signal,
        acquireGltf: async (assetId) => {
          throwIfAborted(signal)
          const lease = await this.options.assets.acquire(assetId)
          try {
            throwIfAborted(signal)
            const instance = instantiateBundledGltf(lease.value)
            leases.push(lease)
            return Object.freeze({ assetId, ...instance })
          } catch (error) {
            lease.release()
            throw error
          }
        },
      })
      throwIfAborted(signal)
      assertThreeRoot(content.root, `World cell ${descriptor.key}`)

      for (const collider of content.colliders ?? []) {
        this.options.collision.addStaticCollider(collider)
        colliderIds.push(collider.id)
      }
      this.options.scene.add(content.root)

      return Object.freeze({
        root: content.root,
        colliderIds: Object.freeze([...colliderIds]),
        assetLeases: Object.freeze([...leases]),
        dispose: content.dispose,
      })
    } catch (error) {
      const root = content?.root
      if (root?.isObject3D === true) root.parent?.remove(root)
      for (const id of [...colliderIds].reverse()) this.options.collision.removeStaticCollider(id)
      try {
        await content?.dispose?.()
      } catch {
        // The original load error remains the useful failure reported by the streamer.
      }
      for (const lease of [...leases].reverse()) lease.release()
      throw error
    }
  }

  async unload(cell: LoadedWorldCell<LoadedThreeWorldCell>): Promise<void> {
    const data = cell.data
    let failure: unknown
    data.root.parent?.remove(data.root)
    for (const id of [...data.colliderIds].reverse()) {
      try {
        this.options.collision.removeStaticCollider(id)
      } catch (error) {
        failure ??= error
      }
    }
    try {
      await data.dispose?.()
    } catch (error) {
      failure ??= error
    }
    for (const lease of [...data.assetLeases].reverse()) {
      try {
        lease.release()
      } catch (error) {
        failure ??= error
      }
    }
    if (failure !== undefined) throw failure
  }
}
