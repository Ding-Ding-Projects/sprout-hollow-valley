import { describe, expect, it } from 'vitest'

import {
  WorldCellStreamer,
  parseWorldCellKey,
  planWorldCells,
  worldCellKey,
  worldCellSeed,
  worldToCell,
  type LoadedWorldCell,
  type WorldCellDescriptor,
} from '../../src/engine3d/world'

const PLAN_OPTIONS = {
  worldSeed: 20260817,
  cellSize: 32,
  loadRadius: 1,
  unloadRadius: 2,
  maxResidentCells: 9,
} as const

describe('world-cell coordinates', () => {
  it('floors negative world positions into the preceding cell', () => {
    expect(worldToCell({ x: -0.01, z: -32 }, 32)).toEqual({ x: -1, z: -1, layer: 0 })
    expect(worldToCell({ x: 31.99, z: 32 }, 32, 4)).toEqual({ x: 0, z: 1, layer: 4 })
  })

  it('round-trips signed coordinates and creates stable per-cell seeds', () => {
    const coordinate = { x: -12, z: 45, layer: 3 }
    expect(parseWorldCellKey(worldCellKey(coordinate))).toEqual(coordinate)
    expect(worldCellSeed(99, coordinate)).toBe(worldCellSeed(99, coordinate))
    expect(worldCellSeed(99, coordinate)).not.toBe(
      worldCellSeed(99, { ...coordinate, z: coordinate.z + 1 }),
    )
  })
})

describe('deterministic planning', () => {
  it('starts at the center and has stable order regardless of resident insertion order', () => {
    const residents = ['0:4:4', '0:2:3', '0:3:3']
    const forward = planWorldCells({ x: 96, z: 96 }, PLAN_OPTIONS, residents)
    const reverse = planWorldCells({ x: 96, z: 96 }, PLAN_OPTIONS, [...residents].reverse())

    expect(forward).toEqual(reverse)
    expect(forward.active[0].key).toBe('0:3:3')
    expect(forward.active).toHaveLength(9)
    expect(new Set(forward.active.map((cell) => cell.key)).size).toBe(9)
  })

  it('retains nearby hysteresis cells only when the memory cap has room', () => {
    const plan = planWorldCells(
      { x: 0, z: 0 },
      { ...PLAN_OPTIONS, loadRadius: 0, maxResidentCells: 3 },
      ['0:1:0', '0:2:0', '0:3:0'],
    )
    expect(plan.active.map((cell) => cell.key)).toEqual(['0:0:0', '0:1:0', '0:2:0'])
    expect(plan.unload).toEqual(['0:3:0'])
  })
})

describe('WorldCellStreamer', () => {
  it('loads nothing eagerly, bounds concurrency, and commits in deterministic plan order', async () => {
    let activeLoads = 0
    let peakLoads = 0
    const started: string[] = []
    const streamer = new WorldCellStreamer(
      {
        async load(descriptor: WorldCellDescriptor) {
          started.push(descriptor.key)
          activeLoads += 1
          peakLoads = Math.max(peakLoads, activeLoads)
          await Promise.resolve()
          activeLoads -= 1
          return descriptor.seed
        },
      },
      { ...PLAN_OPTIONS, maxConcurrentLoads: 2 },
    )

    expect(started).toEqual([])
    const update = await streamer.update({ x: 0, z: 0 })
    expect(peakLoads).toBe(2)
    expect(update.loaded.map((cell) => cell.descriptor.key)).toEqual(
      planWorldCells({ x: 0, z: 0 }, PLAN_OPTIONS).load.map((cell) => cell.key),
    )
    expect(streamer.residentCount).toBe(9)
    expect(streamer.snapshot()).toHaveLength(9)
    await streamer.dispose()
  })

  it('unloads departed cells and never exceeds the resident cap', async () => {
    const unloaded: string[] = []
    const streamer = new WorldCellStreamer(
      {
        async load(descriptor) {
          return descriptor.key
        },
        unload(cell: LoadedWorldCell<string>) {
          unloaded.push(cell.descriptor.key)
        },
      },
      PLAN_OPTIONS,
    )

    await streamer.update({ x: 0, z: 0 })
    const moved = await streamer.update({ x: 32 * 20, z: 0 })
    expect(moved.unloaded.length).toBeGreaterThan(0)
    expect(unloaded).toEqual(moved.unloaded)
    expect(moved.residentCount).toBeLessThanOrEqual(PLAN_OPTIONS.maxResidentCells)
    await streamer.dispose()
  })

  it('reports a failed cell and retries it on the next update', async () => {
    const attempts = new Map<string, number>()
    const streamer = new WorldCellStreamer(
      {
        async load(descriptor) {
          const count = (attempts.get(descriptor.key) ?? 0) + 1
          attempts.set(descriptor.key, count)
          if (descriptor.key === '0:0:0' && count === 1) throw new Error('transient')
          return descriptor.key
        },
      },
      { ...PLAN_OPTIONS, loadRadius: 0, maxResidentCells: 1 },
    )

    const failed = await streamer.update({ x: 0, z: 0 })
    expect(failed.failures).toHaveLength(1)
    expect(failed.residentCount).toBe(0)
    const recovered = await streamer.update({ x: 0, z: 0 })
    expect(recovered.failures).toEqual([])
    expect(recovered.loaded[0].descriptor.key).toBe('0:0:0')
    expect(attempts.get('0:0:0')).toBe(2)
    await streamer.dispose()
  })

  it('serializes overlapping update calls', async () => {
    const calls: string[] = []
    const streamer = new WorldCellStreamer(
      {
        async load(descriptor) {
          calls.push(`load:${descriptor.key}`)
          await Promise.resolve()
          return descriptor.key
        },
        unload(cell) {
          calls.push(`unload:${cell.descriptor.key}`)
        },
      },
      { ...PLAN_OPTIONS, loadRadius: 0, unloadRadius: 0, maxResidentCells: 1 },
    )

    const first = streamer.update({ x: 0, z: 0 })
    const second = streamer.update({ x: 64, z: 0 })
    await Promise.all([first, second])
    expect(calls).toEqual(['load:0:0:0', 'unload:0:0:0', 'load:0:2:0'])
    await streamer.dispose()
  })
})
