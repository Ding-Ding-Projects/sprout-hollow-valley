import { describe, expect, it, vi } from 'vitest'
import { Scene } from 'three'

import { computeEnvironmentFrame } from '../../src/renderer3d/environment/frame'
import { createEnvironmentState } from '../../src/renderer3d/environment/state'
import { WeatherHookRegistry } from '../../src/renderer3d/environment/weather-hooks'

const FRAME = computeEnvironmentFrame(createEnvironmentState({
  minuteOfDay: 600,
  season: 'spring',
  weather: 'clear',
}))

describe('WeatherHookRegistry', () => {
  it('attaches an empty registry without attempting to add an undefined Three child', () => {
    const scene = new Scene()
    const registry = new WeatherHookRegistry()
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      registry.attach({ scene, frame: FRAME })

      expect(scene.children).toContain(registry.root)
      expect(registry.root.children).toEqual([])
      expect(error).not.toHaveBeenCalledWith(
        'THREE.Object3D.add: object not an instance of THREE.Object3D.',
        undefined,
      )
    } finally {
      error.mockRestore()
    }
  })
})
