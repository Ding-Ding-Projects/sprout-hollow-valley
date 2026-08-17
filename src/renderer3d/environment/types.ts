export const ENVIRONMENT_SEASONS = ['spring', 'summer', 'fall', 'winter'] as const
export const ENVIRONMENT_WEATHERS = ['clear', 'rain', 'storm', 'snow'] as const

export type EnvironmentSeason = (typeof ENVIRONMENT_SEASONS)[number]
export type EnvironmentWeather = (typeof ENVIRONMENT_WEATHERS)[number]

export interface EnvironmentSeedState {
  /** Game-clock minutes from midnight. Values outside one day are wrapped. */
  readonly minuteOfDay: number
  readonly season: EnvironmentSeason
  readonly weather: EnvironmentWeather
  /** Optional restored simulation tick. It is never read from the wall clock. */
  readonly tick?: number
}

export interface EnvironmentTransitionConfig {
  /** Game-clock minutes advanced by one environment tick. */
  readonly gameMinutesPerTick: number
  readonly seasonTransitionTicks: number
  readonly weatherTransitionTicks: number
}

export const DEFAULT_ENVIRONMENT_TRANSITION_CONFIG: Readonly<EnvironmentTransitionConfig> = {
  gameMinutesPerTick: 1,
  seasonTransitionTicks: 240,
  weatherTransitionTicks: 90,
}

export type EnvironmentWeights<Key extends string> = Readonly<Record<Key, number>>

/**
 * Serializable transition data. `from` can contain a partially blended profile, so
 * retargeting a transition never causes a visual discontinuity.
 */
export interface EnvironmentBlendState<Key extends string> {
  readonly from: EnvironmentWeights<Key>
  readonly to: EnvironmentWeights<Key>
  readonly elapsedTicks: number
  readonly durationTicks: number
}

/** Pure, save-friendly environment state. No Three.js object or timer lives here. */
export interface EnvironmentState {
  readonly tick: number
  readonly minuteOfDay: number
  /** The requested destination label while a transition is active. */
  readonly season: EnvironmentSeason
  /** The requested destination label while a transition is active. */
  readonly weather: EnvironmentWeather
  readonly seasonBlend: EnvironmentBlendState<EnvironmentSeason>
  readonly weatherBlend: EnvironmentBlendState<EnvironmentWeather>
}

export interface EnvironmentStep {
  /** Explicit deterministic simulation delta. Negative or non-finite values are rejected. */
  readonly deltaTicks: number
  /** When present this replaces, rather than advances, the game-clock minute. */
  readonly minuteOfDay?: number
  readonly season?: EnvironmentSeason
  readonly weather?: EnvironmentWeather
}

export interface EnvironmentFogOutput {
  readonly color: number
  readonly near: number
  readonly far: number
}

export interface EnvironmentHemisphereOutput {
  readonly skyColor: number
  readonly groundColor: number
  readonly intensity: number
}

export interface EnvironmentLightOutput {
  readonly color: number
  readonly intensity: number
}

export interface EnvironmentSunOutput extends EnvironmentLightOutput {
  readonly position: readonly [number, number, number]
}

/** Serializable renderer values. Colors are sRGB hexadecimal integers. */
export interface EnvironmentLightingOutput {
  readonly background: number
  readonly fog: EnvironmentFogOutput
  readonly exposure: number
  readonly hemisphere: EnvironmentHemisphereOutput
  readonly ambient: EnvironmentLightOutput
  readonly sun: EnvironmentSunOutput
}

export interface EnvironmentFrame {
  readonly tick: number
  readonly minuteOfDay: number
  readonly season: EnvironmentSeason
  readonly weather: EnvironmentWeather
  readonly seasonWeights: EnvironmentWeights<EnvironmentSeason>
  readonly weatherWeights: EnvironmentWeights<EnvironmentWeather>
  readonly lighting: EnvironmentLightingOutput
}
