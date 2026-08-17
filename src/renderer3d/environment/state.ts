import {
  DEFAULT_ENVIRONMENT_TRANSITION_CONFIG,
  ENVIRONMENT_SEASONS,
  ENVIRONMENT_WEATHERS,
} from './types'
import type {
  EnvironmentBlendState,
  EnvironmentSeason,
  EnvironmentSeedState,
  EnvironmentState,
  EnvironmentStep,
  EnvironmentTransitionConfig,
  EnvironmentWeather,
  EnvironmentWeights,
} from './types'

const MINUTES_PER_DAY = 24 * 60
const STABLE_PRECISION = 1_000_000_000

function stable(value: number): number {
  return Math.round(value * STABLE_PRECISION) / STABLE_PRECISION
}

function validateFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`)
}

function validateDuration(name: string, value: number): void {
  validateFinite(name, value)
  if (value < 0) throw new RangeError(`${name} cannot be negative`)
}

function validateConfig(config: EnvironmentTransitionConfig): void {
  validateFinite('gameMinutesPerTick', config.gameMinutesPerTick)
  validateDuration('seasonTransitionTicks', config.seasonTransitionTicks)
  validateDuration('weatherTransitionTicks', config.weatherTransitionTicks)
}

function wrapMinute(minute: number): number {
  validateFinite('minuteOfDay', minute)
  const wrapped = minute % MINUTES_PER_DAY
  return stable(wrapped < 0 ? wrapped + MINUTES_PER_DAY : wrapped)
}

function smoothstep(progress: number): number {
  const value = Math.max(0, Math.min(1, progress))
  return value * value * (3 - 2 * value)
}

function oneHot<Key extends string>(keys: readonly Key[], selected: Key): EnvironmentWeights<Key> {
  return Object.fromEntries(keys.map((key) => [key, key === selected ? 1 : 0])) as Record<Key, number>
}

function currentWeights<Key extends string>(
  keys: readonly Key[],
  blend: EnvironmentBlendState<Key>,
): EnvironmentWeights<Key> {
  if (blend.durationTicks === 0) return { ...blend.to }
  const amount = smoothstep(blend.elapsedTicks / blend.durationTicks)
  return Object.fromEntries(
    keys.map((key) => [key, stable(blend.from[key] + (blend.to[key] - blend.from[key]) * amount)]),
  ) as Record<Key, number>
}

function beginTransition<Key extends string>(
  keys: readonly Key[],
  blend: EnvironmentBlendState<Key>,
  target: Key,
  durationTicks: number,
): EnvironmentBlendState<Key> {
  const destination = oneHot(keys, target)
  if (durationTicks === 0) {
    return { from: destination, to: destination, elapsedTicks: 0, durationTicks: 0 }
  }
  return {
    from: currentWeights(keys, blend),
    to: destination,
    elapsedTicks: 0,
    durationTicks,
  }
}

function advanceTransition<Key extends string>(
  blend: EnvironmentBlendState<Key>,
  deltaTicks: number,
): EnvironmentBlendState<Key> {
  if (blend.durationTicks === 0 || blend.elapsedTicks >= blend.durationTicks) return blend
  return {
    ...blend,
    elapsedTicks: stable(Math.min(blend.durationTicks, blend.elapsedTicks + deltaTicks)),
  }
}

function initialBlend<Key extends string>(
  keys: readonly Key[],
  selected: Key,
): EnvironmentBlendState<Key> {
  const weights = oneHot(keys, selected)
  return { from: weights, to: weights, elapsedTicks: 0, durationTicks: 0 }
}

export function createEnvironmentState(seed: EnvironmentSeedState): EnvironmentState {
  const tick = seed.tick ?? 0
  validateDuration('tick', tick)
  return {
    tick: stable(tick),
    minuteOfDay: wrapMinute(seed.minuteOfDay),
    season: seed.season,
    weather: seed.weather,
    seasonBlend: initialBlend(ENVIRONMENT_SEASONS, seed.season),
    weatherBlend: initialBlend(ENVIRONMENT_WEATHERS, seed.weather),
  }
}

/**
 * Advance environment state from explicit inputs only. The function does not mutate its
 * arguments, read time, generate randomness, or perform rendering work.
 */
export function stepEnvironment(
  state: EnvironmentState,
  step: EnvironmentStep,
  config: EnvironmentTransitionConfig = DEFAULT_ENVIRONMENT_TRANSITION_CONFIG,
): EnvironmentState {
  validateConfig(config)
  validateDuration('deltaTicks', step.deltaTicks)

  let seasonBlend = state.seasonBlend
  let weatherBlend = state.weatherBlend
  const season = step.season ?? state.season
  const weather = step.weather ?? state.weather

  if (season !== state.season) {
    seasonBlend = beginTransition(
      ENVIRONMENT_SEASONS,
      seasonBlend,
      season,
      config.seasonTransitionTicks,
    )
  }
  if (weather !== state.weather) {
    weatherBlend = beginTransition(
      ENVIRONMENT_WEATHERS,
      weatherBlend,
      weather,
      config.weatherTransitionTicks,
    )
  }

  seasonBlend = advanceTransition(seasonBlend, step.deltaTicks)
  weatherBlend = advanceTransition(weatherBlend, step.deltaTicks)

  return {
    tick: stable(state.tick + step.deltaTicks),
    minuteOfDay:
      step.minuteOfDay === undefined
        ? wrapMinute(state.minuteOfDay + config.gameMinutesPerTick * step.deltaTicks)
        : wrapMinute(step.minuteOfDay),
    season,
    weather,
    seasonBlend,
    weatherBlend,
  }
}

export function environmentSeasonWeights(
  state: EnvironmentState,
): EnvironmentWeights<EnvironmentSeason> {
  return currentWeights(ENVIRONMENT_SEASONS, state.seasonBlend)
}

export function environmentWeatherWeights(
  state: EnvironmentState,
): EnvironmentWeights<EnvironmentWeather> {
  return currentWeights(ENVIRONMENT_WEATHERS, state.weatherBlend)
}
