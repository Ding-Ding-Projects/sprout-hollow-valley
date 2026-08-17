import { describe, expect, it, vi } from 'vitest'
import {
  DuplicateAssetIdError,
  InvalidBundledAssetUrlError,
  LazyAssetRegistry,
  toBundledAssetUrl,
} from '../../src/engine3d/assets'
import type { AssetDescriptor, AssetDescriptorInput } from '../../src/engine3d/assets'

type TestKind = 'definition' | 'structure' | 'mesh'
type TestCategory = 'world-content' | 'enterable' | 'render'

interface TestMetadata {
  readonly ordinal: number
  readonly enterable: boolean
}

interface TestAsset {
  readonly id: string
  readonly generation: number
}

type TestDescriptor = AssetDescriptor<TestKind, TestCategory, TestMetadata>
type TestDescriptorInput = AssetDescriptorInput<TestKind, TestCategory, TestMetadata>

function descriptor(
  id: string,
  kind: TestKind = 'mesh',
  category: TestCategory = 'render',
  ordinal = 0,
): TestDescriptorInput {
  return {
    id,
    kind,
    category,
    url: `assets/3d/core/${category}/${id}.glb`,
    metadata: { ordinal, enterable: kind === 'structure' },
    tags: [kind, category],
    estimatedBytes: 10,
    version: '1',
  }
}

function deferred<T>(): {
  readonly promise: Promise<T>
  resolve(value: T): void
  reject(error: unknown): void
} {
  let resolvePromise!: (value: T) => void
  let rejectPromise!: (error: unknown) => void
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  return { promise, resolve: resolvePromise, reject: rejectPromise }
}

describe('LazyAssetRegistry descriptor index', () => {
  it('indexes 5,000 non-NPC definitions and 700 enterable structures without loading payloads', () => {
    const loader = vi.fn(async (entry: TestDescriptor): Promise<TestAsset> => ({
      id: entry.id,
      generation: 1,
    }))
    const registry = new LazyAssetRegistry<TestAsset, TestKind, TestCategory, TestMetadata>({ loader })
    const definitions = Array.from({ length: 5_000 }, (_, ordinal) =>
      descriptor(`definition-${ordinal}`, 'definition', 'world-content', ordinal),
    )
    const structures = Array.from({ length: 700 }, (_, ordinal) =>
      descriptor(`structure-${ordinal}`, 'structure', 'enterable', ordinal),
    )

    registry.registerMany([...definitions, ...structures])

    expect(registry.size).toBe(5_700)
    expect(registry.stats()).toMatchObject({ registered: 5_700, loaded: 0, inFlight: 0 })
    expect(registry.idsByKind('definition')).toHaveLength(5_000)
    expect(registry.idsByKind('structure')).toHaveLength(700)
    expect(registry.idsByCategory('enterable')).toHaveLength(700)
    expect(registry.query({ kind: 'structure', category: 'enterable' })).toHaveLength(700)
    expect(registry.query({ kind: 'structure', category: 'world-content' })).toEqual([])
    expect(registry.query({ category: 'enterable', offset: 698, limit: 2 }).map((entry) => entry.id)).toEqual([
      'structure-698',
      'structure-699',
    ])
    expect(registry.requireDescriptor('structure-699').metadata.enterable).toBe(true)
    expect(registry.kinds()).toEqual(['definition', 'structure'])
    expect(registry.categories()).toEqual(['world-content', 'enterable'])
    expect(loader).not.toHaveBeenCalled()
  })

  it('copies and freezes index-bearing descriptor data', () => {
    const loader = vi.fn(async (): Promise<TestAsset> => ({ id: 'barn', generation: 1 }))
    const registry = new LazyAssetRegistry<TestAsset, TestKind, TestCategory, TestMetadata>({ loader })
    const tags = ['structure', 'enterable']
    const metadata = { ordinal: 4, enterable: true }
    const input: TestDescriptorInput = {
      ...descriptor('barn', 'structure', 'enterable', 4),
      tags,
      metadata,
    }

    const registered = registry.register(input)
    tags.push('mutated-after-registration')
    metadata.ordinal = 99

    expect(registered.tags).toEqual(['structure', 'enterable'])
    expect(registered.metadata.ordinal).toBe(4)
    expect(Object.isFrozen(registered)).toBe(true)
    expect(Object.isFrozen(registered.tags)).toBe(true)
    expect(Object.isFrozen(registered.metadata)).toBe(true)
    expect(loader).not.toHaveBeenCalled()
  })

  it('rejects duplicate ids atomically without invoking the loader', () => {
    const loader = vi.fn(async (): Promise<TestAsset> => ({ id: 'unused', generation: 1 }))
    const registry = new LazyAssetRegistry<TestAsset, TestKind, TestCategory, TestMetadata>({ loader })
    registry.register(descriptor('existing'))

    expect(() => registry.registerMany([
      descriptor('would-have-been-added'),
      descriptor('existing', 'structure', 'enterable'),
    ])).toThrow(DuplicateAssetIdError)
    expect(registry.size).toBe(1)
    expect(registry.has('would-have-been-added')).toBe(false)

    expect(() => registry.registerMany([
      descriptor('same-id'),
      descriptor('same-id', 'structure', 'enterable'),
    ])).toThrow(/same-id/)
    expect(registry.size).toBe(1)
    expect(loader).not.toHaveBeenCalled()
  })
})

describe('LazyAssetRegistry loading and residency', () => {
  it('deduplicates concurrent loads while accounting for each idempotent lease', async () => {
    const pending = deferred<TestAsset>()
    const loader = vi.fn(() => pending.promise)
    const registry = new LazyAssetRegistry<TestAsset, TestKind, TestCategory, TestMetadata>({ loader })
    registry.register(descriptor('shared'))

    const firstPromise = registry.acquire('shared')
    const secondPromise = registry.acquire('shared')
    await Promise.resolve()
    expect(loader).toHaveBeenCalledTimes(1)

    const value = { id: 'shared', generation: 1 }
    pending.resolve(value)
    const [first, second] = await Promise.all([firstPromise, secondPromise])

    expect(first).not.toBe(second)
    expect(first.value).toBe(value)
    expect(second.value).toBe(value)
    expect(registry.referenceCount('shared')).toBe(2)
    expect((await registry.acquire('shared')).value).toBe(value)
    expect(loader).toHaveBeenCalledTimes(1)
    expect(registry.referenceCount('shared')).toBe(3)

    expect(first.release()).toBe(true)
    expect(first.release()).toBe(false)
    expect(second.release()).toBe(true)
    expect(registry.referenceCount('shared')).toBe(1)
  })

  it('clears failed in-flight state so a later acquire retries', async () => {
    const firstError = new Error('first bundled read failed')
    const loader = vi.fn((entry: TestDescriptor, context: { readonly attempt: number }): TestAsset => {
      if (context.attempt === 1) throw firstError
      return { id: entry.id, generation: context.attempt }
    })
    const registry = new LazyAssetRegistry<TestAsset, TestKind, TestCategory, TestMetadata>({ loader })
    registry.register(descriptor('retryable'))

    const first = registry.acquire('retryable')
    const concurrent = registry.acquire('retryable')
    await expect(Promise.all([first, concurrent])).rejects.toBe(firstError)
    expect(loader).toHaveBeenCalledTimes(1)
    expect(registry.isLoaded('retryable')).toBe(false)
    expect(registry.referenceCount('retryable')).toBe(0)
    expect(registry.lastFailure('retryable')).toMatchObject({ attempt: 1, error: firstError })

    const recovered = await registry.acquire('retryable')
    expect(recovered.value).toEqual({ id: 'retryable', generation: 2 })
    expect(loader).toHaveBeenCalledTimes(2)
    expect(registry.loadAttemptCount('retryable')).toBe(2)
    expect(registry.lastFailure('retryable')).toBeUndefined()
    recovered.release()
  })

  it('evicts the least-recently-used unreferenced payload and can load it again', async () => {
    let generation = 0
    const loader = vi.fn(async (entry: TestDescriptor): Promise<TestAsset> => ({
      id: entry.id,
      generation: ++generation,
    }))
    const onEvict = vi.fn()
    const registry = new LazyAssetRegistry<TestAsset, TestKind, TestCategory, TestMetadata>({
      loader,
      maxLoadedEntries: 2,
      onEvict,
    })
    registry.registerMany([descriptor('a'), descriptor('b'), descriptor('c')])

    await registry.getOrLoad('a')
    await registry.getOrLoad('b')
    await registry.getOrLoad('a')
    await registry.getOrLoad('c')

    expect(registry.isLoaded('a')).toBe(true)
    expect(registry.isLoaded('b')).toBe(false)
    expect(registry.isLoaded('c')).toBe(true)
    expect(onEvict).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }), registry.requireDescriptor('b'), 'capacity')

    await registry.getOrLoad('b')
    expect(loader).toHaveBeenCalledTimes(4)
  })

  it('pins acquired payloads, then permits explicit eviction after release', async () => {
    const loader = vi.fn(async (entry: TestDescriptor): Promise<TestAsset> => ({ id: entry.id, generation: 1 }))
    const registry = new LazyAssetRegistry<TestAsset, TestKind, TestCategory, TestMetadata>({
      loader,
      maxLoadedEntries: 1,
    })
    registry.registerMany([descriptor('pinned'), descriptor('visitor')])

    const lease = await registry.acquire('pinned')
    await registry.getOrLoad('visitor')
    expect(registry.stats().loaded).toBe(2)
    expect(registry.evict('pinned')).toBe(false)

    lease.release()
    expect(registry.stats().loaded).toBe(1)
    expect(registry.isLoaded('pinned')).toBe(true)
    expect(registry.evict('pinned')).toBe(true)
    expect(registry.evict('pinned')).toBe(false)
    expect(registry.descriptor('pinned')).toBeDefined()
  })

  it('uses descriptor or runtime weights as an independent resident bound', async () => {
    const loader = vi.fn(async (entry: TestDescriptor): Promise<TestAsset> => ({ id: entry.id, generation: 1 }))
    const registry = new LazyAssetRegistry<TestAsset, TestKind, TestCategory, TestMetadata>({
      loader,
      maxLoadedEntries: 10,
      maxLoadedWeight: 15,
    })
    registry.registerMany([descriptor('first'), descriptor('second')])

    await registry.getOrLoad('first')
    await registry.getOrLoad('second')

    expect(registry.isLoaded('first')).toBe(false)
    expect(registry.isLoaded('second')).toBe(true)
    expect(registry.stats().loadedWeight).toBe(10)
  })

  it('does not invoke a loader for unknown descriptors', async () => {
    const loader = vi.fn(async (): Promise<TestAsset> => ({ id: 'unused', generation: 1 }))
    const registry = new LazyAssetRegistry<TestAsset, TestKind, TestCategory, TestMetadata>({ loader })

    await expect(registry.acquire('missing')).rejects.toThrow(/missing/)
    await expect(registry.getOrLoad('missing')).rejects.toThrow(/missing/)
    expect(loader).not.toHaveBeenCalled()
  })
})

describe('bundled asset URL policy', () => {
  it('accepts only logical files under the core bundle root', () => {
    expect(toBundledAssetUrl('assets/3d/core/structures/barn.glb')).toBe(
      'assets/3d/core/structures/barn.glb',
    )
  })

  it.each([
    '',
    'https://example.test/model.glb',
    'http://example.test/model.glb',
    '//example.test/model.glb',
    'data:model/gltf-binary;base64,AAAA',
    'blob:https://example.test/id',
    'file:///tmp/model.glb',
    'javascript:alert(1)',
    'ftp://example.test/model.glb',
    '/assets/3d/core/model.glb',
    './assets/3d/core/model.glb',
    'assets/3d/other/model.glb',
    'assets/3d/core/../secret.glb',
    'assets/3d/core/models//barn.glb',
    'assets/3d/core/model.glb?version=1',
    'assets/3d/core/model.glb#mesh',
    'assets/3d/core/%2e%2e/secret.glb',
    'assets\\3d\\core\\model.glb',
  ])('rejects non-bundled or runtime-resolved URL %s', (url) => {
    expect(() => toBundledAssetUrl(url)).toThrow(InvalidBundledAssetUrlError)
  })

  it('rejects an external URL during registration before it can reach a loader', () => {
    const loader = vi.fn(async (): Promise<TestAsset> => ({ id: 'never', generation: 1 }))
    const registry = new LazyAssetRegistry<TestAsset, TestKind, TestCategory, TestMetadata>({ loader })
    const external: TestDescriptorInput = {
      ...descriptor('external'),
      url: 'https://cdn.example.test/external.glb',
    }

    expect(() => registry.register(external)).toThrow(InvalidBundledAssetUrlError)
    expect(registry.size).toBe(0)
    expect(loader).not.toHaveBeenCalled()
  })
})
