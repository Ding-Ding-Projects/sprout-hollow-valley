import { Scene } from 'three'
import { computeEnvironmentFrame } from './frame'
import { EnvironmentLightingRig } from './lighting-rig'
import { createEnvironmentState, stepEnvironment } from './state'
import { WeatherHookRegistry } from './weather-hooks'
import type { ToneMappingExposureTarget } from './lighting-rig'
import type {
  EnvironmentFrame,
  EnvironmentSeedState,
  EnvironmentState,
  EnvironmentStep,
  EnvironmentTransitionConfig,
} from './types'
import type {
  WeatherHookDefinition,
  WeatherHookRegistryOptions,
} from './weather-hooks'
import { DEFAULT_ENVIRONMENT_TRANSITION_CONFIG } from './types'

export interface EnvironmentSystemOptions {
  readonly scene?: Scene
  readonly initial: EnvironmentSeedState
  readonly transition?: Partial<EnvironmentTransitionConfig>
  readonly hooks?: readonly WeatherHookDefinition[]
  readonly hookRegistry?: WeatherHookRegistryOptions
}

/** Coordinates pure state, scene lighting, and isolated weather layers. */
export class EnvironmentSystem {
  readonly lighting: EnvironmentLightingRig
  readonly weatherHooks: WeatherHookRegistry

  private readonly transition: EnvironmentTransitionConfig
  private environmentState: EnvironmentState
  private environmentFrame: EnvironmentFrame
  private attachedScene: Scene | undefined

  constructor(options: EnvironmentSystemOptions) {
    const transition = options.transition
    this.transition = {
      gameMinutesPerTick:
        transition?.gameMinutesPerTick ??
        DEFAULT_ENVIRONMENT_TRANSITION_CONFIG.gameMinutesPerTick,
      seasonTransitionTicks:
        transition?.seasonTransitionTicks ??
        DEFAULT_ENVIRONMENT_TRANSITION_CONFIG.seasonTransitionTicks,
      weatherTransitionTicks:
        transition?.weatherTransitionTicks ??
        DEFAULT_ENVIRONMENT_TRANSITION_CONFIG.weatherTransitionTicks,
    }
    this.environmentState = createEnvironmentState(options.initial)
    this.environmentFrame = computeEnvironmentFrame(this.environmentState)
    this.lighting = new EnvironmentLightingRig()
    this.weatherHooks = new WeatherHookRegistry(options.hookRegistry)
    for (const hook of options.hooks ?? []) this.weatherHooks.register(hook)
    this.lighting.apply(this.environmentFrame)
    if (options.scene) this.attach(options.scene)
  }

  get state(): EnvironmentState {
    return this.environmentState
  }

  get frame(): EnvironmentFrame {
    return this.environmentFrame
  }

  get scene(): Scene | undefined {
    return this.attachedScene
  }

  attach(scene: Scene): void {
    if (this.attachedScene === scene) return
    this.detach()
    this.attachedScene = scene
    this.lighting.attach(scene)
    this.weatherHooks.attach({ scene, frame: this.environmentFrame })
  }

  update(step: EnvironmentStep): EnvironmentFrame {
    this.environmentState = stepEnvironment(this.environmentState, step, this.transition)
    this.environmentFrame = computeEnvironmentFrame(this.environmentState)
    this.lighting.apply(this.environmentFrame)
    this.weatherHooks.update(this.environmentFrame)
    return this.environmentFrame
  }

  registerWeatherHook(definition: WeatherHookDefinition): () => void {
    return this.weatherHooks.register(definition)
  }

  applyExposure(target: ToneMappingExposureTarget): void {
    this.lighting.applyExposure(target)
  }

  detach(): void {
    this.weatherHooks.detach()
    this.lighting.detach()
    this.attachedScene = undefined
  }

  dispose(): void {
    this.detach()
  }
}
