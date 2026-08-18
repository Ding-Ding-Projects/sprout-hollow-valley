import { describe, expect, it, vi } from 'vitest'
import { Scene } from 'three'

import { ThreeWorldCellSource } from '../../src/renderer3d/world/three-world-cell-source'

const DESCRIPTOR = {
  key: '0:0:0' as const,
  coordinate: { x: 0, z: 0, layer: 0 },
  seed: 1,
  ringDistance: 0,
  distanceSquared: 0,
}

describe('ThreeWorldCellSource', () => {
  it('names an invalid scene root instead of passing it to Three.js', async () => {
    const scene = new Scene()
    const collision = {
      addStaticCollider: vi.fn((collider) => collider),
      removeStaticCollider: vi.fn(() => true),
    }
    const source = new ThreeWorldCellSource({
      scene,
      collision,
      assets: {} as never,
      cellSize: 16,
      buildCell: () => ({ root: undefined as never }),
    })

    await expect(source.load(DESCRIPTOR, new AbortController().signal)).rejects.toThrow(
      'World cell 0:0:0 returned an invalid Three root',
    )
    expect(scene.children).toEqual([])
    expect(collision.addStaticCollider).not.toHaveBeenCalled()
  })
})
