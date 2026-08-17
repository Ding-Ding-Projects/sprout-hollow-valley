export {
  DEFAULT_ENVIRONMENT_TRANSITION_CONFIG,
  ENVIRONMENT_SEASONS,
  ENVIRONMENT_WEATHERS,
} from './types'
export type {
  EnvironmentBlendState,
  EnvironmentFogOutput,
  EnvironmentFrame,
  EnvironmentHemisphereOutput,
  EnvironmentLightingOutput,
  EnvironmentLightOutput,
  EnvironmentSeason,
  EnvironmentSeedState,
  EnvironmentState,
  EnvironmentStep,
  EnvironmentSunOutput,
  EnvironmentTransitionConfig,
  EnvironmentWeather,
  EnvironmentWeights,
} from './types'

export {
  createEnvironmentState,
  environmentSeasonWeights,
  environmentWeatherWeights,
  stepEnvironment,
} from './state'
export { computeEnvironmentFrame } from './frame'

export { EnvironmentLightingRig } from './lighting-rig'
export type { ToneMappingExposureTarget } from './lighting-rig'

export { isBundledAssetId, WeatherHookRegistry } from './weather-hooks'
export type {
  WeatherHookAttachContext,
  WeatherHookContext,
  WeatherHookDefinition,
  WeatherHookError,
  WeatherHookPhase,
  WeatherHookRegistryOptions,
  WeatherHookStatus,
} from './weather-hooks'

export { EnvironmentSystem } from './system'
export type { EnvironmentSystemOptions } from './system'
