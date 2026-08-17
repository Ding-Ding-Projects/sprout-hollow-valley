import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Scene,
} from 'three'
import type {
  EnvironmentFrame,
  EnvironmentLightingOutput,
} from './types'

export interface ToneMappingExposureTarget {
  toneMappingExposure: number
}

function lightingFrom(
  frameOrLighting: EnvironmentFrame | EnvironmentLightingOutput,
): EnvironmentLightingOutput {
  return 'lighting' in frameOrLighting ? frameOrLighting.lighting : frameOrLighting
}

/**
 * Three.js scene adapter for the pure environment frame. It deliberately needs no
 * camera, canvas, renderer, browser globals, or asynchronous assets.
 */
export class EnvironmentLightingRig {
  readonly root = new Group()
  readonly hemisphere = new HemisphereLight()
  readonly ambient = new AmbientLight()
  readonly sun = new DirectionalLight()

  private readonly background = new Color()
  private readonly fog = new Fog(0x000000, 1, 2)
  private attachedScene: Scene | undefined
  private previousBackground: Scene['background'] = null
  private previousFog: Scene['fog'] = null
  private currentLighting: EnvironmentLightingOutput | undefined

  constructor(scene?: Scene) {
    this.root.name = 'environment-lighting-rig'
    this.hemisphere.name = 'environment-hemisphere'
    this.ambient.name = 'environment-ambient'
    this.sun.name = 'environment-sun'
    this.sun.target.name = 'environment-sun-target'
    this.sun.castShadow = true
    this.root.add(this.hemisphere, this.ambient, this.sun, this.sun.target)
    if (scene) this.attach(scene)
  }

  get scene(): Scene | undefined {
    return this.attachedScene
  }

  get exposure(): number | undefined {
    return this.currentLighting?.exposure
  }

  get output(): EnvironmentLightingOutput | undefined {
    return this.currentLighting
  }

  attach(scene: Scene): void {
    if (this.attachedScene === scene) return
    this.detach()
    this.attachedScene = scene
    this.previousBackground = scene.background
    this.previousFog = scene.fog
    scene.add(this.root)
    this.applySceneOutputs()
  }

  /** Apply a serializable frame and return its exposure for renderer integration. */
  apply(frameOrLighting: EnvironmentFrame | EnvironmentLightingOutput): number {
    const lighting = lightingFrom(frameOrLighting)
    this.currentLighting = lighting

    this.hemisphere.color.setHex(lighting.hemisphere.skyColor)
    this.hemisphere.groundColor.setHex(lighting.hemisphere.groundColor)
    this.hemisphere.intensity = lighting.hemisphere.intensity
    this.ambient.color.setHex(lighting.ambient.color)
    this.ambient.intensity = lighting.ambient.intensity
    this.sun.color.setHex(lighting.sun.color)
    this.sun.intensity = lighting.sun.intensity
    this.sun.position.set(...lighting.sun.position)

    this.background.setHex(lighting.background)
    this.fog.color.setHex(lighting.fog.color)
    this.fog.near = lighting.fog.near
    this.fog.far = lighting.fog.far
    this.applySceneOutputs()
    return lighting.exposure
  }

  applyExposure(target: ToneMappingExposureTarget): void {
    if (this.currentLighting) target.toneMappingExposure = this.currentLighting.exposure
  }

  detach(): void {
    const scene = this.attachedScene
    if (!scene) return
    scene.remove(this.root)
    if (scene.background === this.background) scene.background = this.previousBackground
    if (scene.fog === this.fog) scene.fog = this.previousFog
    this.attachedScene = undefined
    this.previousBackground = null
    this.previousFog = null
  }

  private applySceneOutputs(): void {
    if (!this.attachedScene || !this.currentLighting) return
    this.attachedScene.background = this.background
    this.attachedScene.fog = this.fog
  }
}
