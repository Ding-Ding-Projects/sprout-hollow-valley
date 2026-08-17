import {
  ENVIRONMENT_SEASONS,
  ENVIRONMENT_WEATHERS,
} from './types'
import { environmentSeasonWeights, environmentWeatherWeights } from './state'
import type {
  EnvironmentFrame,
  EnvironmentLightingOutput,
  EnvironmentSeason,
  EnvironmentState,
  EnvironmentWeather,
  EnvironmentWeights,
} from './types'

interface TimeLightingKeyframe {
  readonly minute: number
  readonly sky: number
  readonly ground: number
  readonly background: number
  readonly fog: number
  readonly sun: number
  readonly hemisphereIntensity: number
  readonly ambientIntensity: number
  readonly sunIntensity: number
  readonly exposure: number
  readonly fogNear: number
  readonly fogFar: number
  readonly sunElevation: number
}

interface EnvironmentProfile {
  readonly skyTint: number
  readonly groundTint: number
  readonly backgroundTint: number
  readonly fogTint: number
  readonly sunTint: number
  readonly tintStrength: number
  readonly hemisphereMultiplier: number
  readonly ambientMultiplier: number
  readonly sunMultiplier: number
  readonly exposureMultiplier: number
  readonly fogNearMultiplier: number
  readonly fogFarMultiplier: number
}

const TIME_KEYFRAMES: readonly TimeLightingKeyframe[] = [
  {
    minute: 0,
    sky: 0x101b3d,
    ground: 0x0c1322,
    background: 0x071126,
    fog: 0x111a31,
    sun: 0x8098c8,
    hemisphereIntensity: 0.2,
    ambientIntensity: 0.11,
    sunIntensity: 0.025,
    exposure: 0.62,
    fogNear: 54,
    fogFar: 190,
    sunElevation: -0.42,
  },
  {
    minute: 300,
    sky: 0x344a77,
    ground: 0x25273a,
    background: 0x1a2946,
    fog: 0x39445c,
    sun: 0xd9a07a,
    hemisphereIntensity: 0.34,
    ambientIntensity: 0.2,
    sunIntensity: 0.12,
    exposure: 0.76,
    fogNear: 65,
    fogFar: 240,
    sunElevation: -0.12,
  },
  {
    minute: 390,
    sky: 0xf1a36c,
    ground: 0x4b392f,
    background: 0xc66f4f,
    fog: 0xcf9274,
    sun: 0xffc173,
    hemisphereIntensity: 0.65,
    ambientIntensity: 0.34,
    sunIntensity: 0.72,
    exposure: 0.93,
    fogNear: 85,
    fogFar: 330,
    sunElevation: 0.08,
  },
  {
    minute: 660,
    sky: 0x8ed6f2,
    ground: 0x71865d,
    background: 0x80c8e9,
    fog: 0xb9deea,
    sun: 0xfff1ca,
    hemisphereIntensity: 1.05,
    ambientIntensity: 0.48,
    sunIntensity: 2.25,
    exposure: 1.08,
    fogNear: 135,
    fogFar: 720,
    sunElevation: 1.03,
  },
  {
    minute: 1020,
    sky: 0x8ccae5,
    ground: 0x6d7d59,
    background: 0x78bbd8,
    fog: 0xaacfdc,
    sun: 0xffdfad,
    hemisphereIntensity: 0.96,
    ambientIntensity: 0.44,
    sunIntensity: 1.72,
    exposure: 1.03,
    fogNear: 125,
    fogFar: 650,
    sunElevation: 0.42,
  },
  {
    minute: 1200,
    sky: 0x5d426d,
    ground: 0x332c3a,
    background: 0x392f53,
    fog: 0x574760,
    sun: 0xff9a66,
    hemisphereIntensity: 0.46,
    ambientIntensity: 0.25,
    sunIntensity: 0.28,
    exposure: 0.8,
    fogNear: 72,
    fogFar: 300,
    sunElevation: -0.08,
  },
  {
    minute: 1440,
    sky: 0x101b3d,
    ground: 0x0c1322,
    background: 0x071126,
    fog: 0x111a31,
    sun: 0x8098c8,
    hemisphereIntensity: 0.2,
    ambientIntensity: 0.11,
    sunIntensity: 0.025,
    exposure: 0.62,
    fogNear: 54,
    fogFar: 190,
    sunElevation: -0.42,
  },
]

const SEASON_PROFILES: Readonly<Record<EnvironmentSeason, EnvironmentProfile>> = {
  spring: {
    skyTint: 0xb6e8dc,
    groundTint: 0x7fa86f,
    backgroundTint: 0xa8dfd0,
    fogTint: 0xc6e5dc,
    sunTint: 0xfff0c2,
    tintStrength: 0.1,
    hemisphereMultiplier: 1,
    ambientMultiplier: 1,
    sunMultiplier: 1,
    exposureMultiplier: 1,
    fogNearMultiplier: 1,
    fogFarMultiplier: 1,
  },
  summer: {
    skyTint: 0x75d9ef,
    groundTint: 0x779b4e,
    backgroundTint: 0x71cce9,
    fogTint: 0xb6e0e4,
    sunTint: 0xffe7a0,
    tintStrength: 0.13,
    hemisphereMultiplier: 1.06,
    ambientMultiplier: 1.02,
    sunMultiplier: 1.12,
    exposureMultiplier: 1.04,
    fogNearMultiplier: 1.05,
    fogFarMultiplier: 1.12,
  },
  fall: {
    skyTint: 0xc8a27a,
    groundTint: 0x8c6240,
    backgroundTint: 0xc58f66,
    fogTint: 0xc9a986,
    sunTint: 0xffc47f,
    tintStrength: 0.18,
    hemisphereMultiplier: 0.96,
    ambientMultiplier: 1.03,
    sunMultiplier: 0.92,
    exposureMultiplier: 0.98,
    fogNearMultiplier: 0.92,
    fogFarMultiplier: 0.88,
  },
  winter: {
    skyTint: 0xb9d6e9,
    groundTint: 0xc6ced0,
    backgroundTint: 0xaac9dc,
    fogTint: 0xd5e1e5,
    sunTint: 0xdfeaff,
    tintStrength: 0.22,
    hemisphereMultiplier: 0.92,
    ambientMultiplier: 1.1,
    sunMultiplier: 0.76,
    exposureMultiplier: 0.94,
    fogNearMultiplier: 0.82,
    fogFarMultiplier: 0.72,
  },
}

const WEATHER_PROFILES: Readonly<Record<EnvironmentWeather, EnvironmentProfile>> = {
  clear: {
    skyTint: 0xffffff,
    groundTint: 0xffffff,
    backgroundTint: 0xffffff,
    fogTint: 0xffffff,
    sunTint: 0xffffff,
    tintStrength: 0,
    hemisphereMultiplier: 1,
    ambientMultiplier: 1,
    sunMultiplier: 1,
    exposureMultiplier: 1,
    fogNearMultiplier: 1,
    fogFarMultiplier: 1,
  },
  rain: {
    skyTint: 0x718397,
    groundTint: 0x4b5a58,
    backgroundTint: 0x64798b,
    fogTint: 0x84949e,
    sunTint: 0xb7c5d2,
    tintStrength: 0.42,
    hemisphereMultiplier: 0.72,
    ambientMultiplier: 1.08,
    sunMultiplier: 0.34,
    exposureMultiplier: 0.88,
    fogNearMultiplier: 0.58,
    fogFarMultiplier: 0.5,
  },
  storm: {
    skyTint: 0x344052,
    groundTint: 0x2d353a,
    backgroundTint: 0x303b4d,
    fogTint: 0x4a5662,
    sunTint: 0x8895a5,
    tintStrength: 0.68,
    hemisphereMultiplier: 0.46,
    ambientMultiplier: 0.94,
    sunMultiplier: 0.1,
    exposureMultiplier: 0.72,
    fogNearMultiplier: 0.42,
    fogFarMultiplier: 0.32,
  },
  snow: {
    skyTint: 0xd9e6ee,
    groundTint: 0xf1f2ed,
    backgroundTint: 0xcbdce5,
    fogTint: 0xe8eeef,
    sunTint: 0xe9f0ff,
    tintStrength: 0.5,
    hemisphereMultiplier: 0.9,
    ambientMultiplier: 1.24,
    sunMultiplier: 0.58,
    exposureMultiplier: 0.91,
    fogNearMultiplier: 0.46,
    fogFarMultiplier: 0.38,
  },
}

const STABLE_PRECISION = 1_000_000

function stable(value: number): number {
  return Math.round(value * STABLE_PRECISION) / STABLE_PRECISION
}

function smoothstep(progress: number): number {
  const value = Math.max(0, Math.min(1, progress))
  return value * value * (3 - 2 * value)
}

function colorChannels(color: number): readonly [number, number, number] {
  return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff]
}

function colorFromChannels(red: number, green: number, blue: number): number {
  return (Math.round(red) << 16) | (Math.round(green) << 8) | Math.round(blue)
}

function mixColor(from: number, to: number, amount: number): number {
  const a = colorChannels(from)
  const b = colorChannels(to)
  return colorFromChannels(
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount,
  )
}

function weightedNumber<Key extends string, Value>(
  keys: readonly Key[],
  weights: EnvironmentWeights<Key>,
  values: Readonly<Record<Key, Value>>,
  select: (value: Value) => number,
): number {
  return keys.reduce((total, key) => total + weights[key] * select(values[key]), 0)
}

function weightedColor<Key extends string, Value>(
  keys: readonly Key[],
  weights: EnvironmentWeights<Key>,
  values: Readonly<Record<Key, Value>>,
  select: (value: Value) => number,
): number {
  let red = 0
  let green = 0
  let blue = 0
  for (const key of keys) {
    const channels = colorChannels(select(values[key]))
    red += channels[0] * weights[key]
    green += channels[1] * weights[key]
    blue += channels[2] * weights[key]
  }
  return colorFromChannels(red, green, blue)
}

function timeFrame(minute: number): TimeLightingKeyframe {
  const upperIndex = TIME_KEYFRAMES.findIndex((frame) => frame.minute >= minute)
  const upper = TIME_KEYFRAMES[Math.max(1, upperIndex)]
  const lower = TIME_KEYFRAMES[Math.max(0, upperIndex - 1)]
  const amount = smoothstep((minute - lower.minute) / (upper.minute - lower.minute))

  return {
    minute,
    sky: mixColor(lower.sky, upper.sky, amount),
    ground: mixColor(lower.ground, upper.ground, amount),
    background: mixColor(lower.background, upper.background, amount),
    fog: mixColor(lower.fog, upper.fog, amount),
    sun: mixColor(lower.sun, upper.sun, amount),
    hemisphereIntensity: lower.hemisphereIntensity +
      (upper.hemisphereIntensity - lower.hemisphereIntensity) * amount,
    ambientIntensity: lower.ambientIntensity +
      (upper.ambientIntensity - lower.ambientIntensity) * amount,
    sunIntensity: lower.sunIntensity + (upper.sunIntensity - lower.sunIntensity) * amount,
    exposure: lower.exposure + (upper.exposure - lower.exposure) * amount,
    fogNear: lower.fogNear + (upper.fogNear - lower.fogNear) * amount,
    fogFar: lower.fogFar + (upper.fogFar - lower.fogFar) * amount,
    sunElevation: lower.sunElevation + (upper.sunElevation - lower.sunElevation) * amount,
  }
}

function tintForProfiles<Key extends string>(
  base: number,
  keys: readonly Key[],
  weights: EnvironmentWeights<Key>,
  profiles: Readonly<Record<Key, EnvironmentProfile>>,
  select: (profile: EnvironmentProfile) => number,
): number {
  const tint = weightedColor(keys, weights, profiles, select)
  const strength = weightedNumber(keys, weights, profiles, (profile) => profile.tintStrength)
  return mixColor(base, tint, strength)
}

function computeLighting(
  minuteOfDay: number,
  seasonWeights: EnvironmentWeights<EnvironmentSeason>,
  weatherWeights: EnvironmentWeights<EnvironmentWeather>,
): EnvironmentLightingOutput {
  const time = timeFrame(minuteOfDay)

  const seasonSky = tintForProfiles(
    time.sky,
    ENVIRONMENT_SEASONS,
    seasonWeights,
    SEASON_PROFILES,
    (profile) => profile.skyTint,
  )
  const seasonGround = tintForProfiles(
    time.ground,
    ENVIRONMENT_SEASONS,
    seasonWeights,
    SEASON_PROFILES,
    (profile) => profile.groundTint,
  )
  const seasonBackground = tintForProfiles(
    time.background,
    ENVIRONMENT_SEASONS,
    seasonWeights,
    SEASON_PROFILES,
    (profile) => profile.backgroundTint,
  )
  const seasonFog = tintForProfiles(
    time.fog,
    ENVIRONMENT_SEASONS,
    seasonWeights,
    SEASON_PROFILES,
    (profile) => profile.fogTint,
  )
  const seasonSun = tintForProfiles(
    time.sun,
    ENVIRONMENT_SEASONS,
    seasonWeights,
    SEASON_PROFILES,
    (profile) => profile.sunTint,
  )

  const sky = tintForProfiles(
    seasonSky,
    ENVIRONMENT_WEATHERS,
    weatherWeights,
    WEATHER_PROFILES,
    (profile) => profile.skyTint,
  )
  const ground = tintForProfiles(
    seasonGround,
    ENVIRONMENT_WEATHERS,
    weatherWeights,
    WEATHER_PROFILES,
    (profile) => profile.groundTint,
  )
  const background = tintForProfiles(
    seasonBackground,
    ENVIRONMENT_WEATHERS,
    weatherWeights,
    WEATHER_PROFILES,
    (profile) => profile.backgroundTint,
  )
  const fog = tintForProfiles(
    seasonFog,
    ENVIRONMENT_WEATHERS,
    weatherWeights,
    WEATHER_PROFILES,
    (profile) => profile.fogTint,
  )
  const sun = tintForProfiles(
    seasonSun,
    ENVIRONMENT_WEATHERS,
    weatherWeights,
    WEATHER_PROFILES,
    (profile) => profile.sunTint,
  )

  const seasonHemisphere = weightedNumber(
    ENVIRONMENT_SEASONS,
    seasonWeights,
    SEASON_PROFILES,
    (profile) => profile.hemisphereMultiplier,
  )
  const weatherHemisphere = weightedNumber(
    ENVIRONMENT_WEATHERS,
    weatherWeights,
    WEATHER_PROFILES,
    (profile) => profile.hemisphereMultiplier,
  )
  const seasonAmbient = weightedNumber(
    ENVIRONMENT_SEASONS,
    seasonWeights,
    SEASON_PROFILES,
    (profile) => profile.ambientMultiplier,
  )
  const weatherAmbient = weightedNumber(
    ENVIRONMENT_WEATHERS,
    weatherWeights,
    WEATHER_PROFILES,
    (profile) => profile.ambientMultiplier,
  )
  const seasonSunMultiplier = weightedNumber(
    ENVIRONMENT_SEASONS,
    seasonWeights,
    SEASON_PROFILES,
    (profile) => profile.sunMultiplier,
  )
  const weatherSunMultiplier = weightedNumber(
    ENVIRONMENT_WEATHERS,
    weatherWeights,
    WEATHER_PROFILES,
    (profile) => profile.sunMultiplier,
  )
  const seasonExposure = weightedNumber(
    ENVIRONMENT_SEASONS,
    seasonWeights,
    SEASON_PROFILES,
    (profile) => profile.exposureMultiplier,
  )
  const weatherExposure = weightedNumber(
    ENVIRONMENT_WEATHERS,
    weatherWeights,
    WEATHER_PROFILES,
    (profile) => profile.exposureMultiplier,
  )
  const seasonFogNear = weightedNumber(
    ENVIRONMENT_SEASONS,
    seasonWeights,
    SEASON_PROFILES,
    (profile) => profile.fogNearMultiplier,
  )
  const weatherFogNear = weightedNumber(
    ENVIRONMENT_WEATHERS,
    weatherWeights,
    WEATHER_PROFILES,
    (profile) => profile.fogNearMultiplier,
  )
  const seasonFogFar = weightedNumber(
    ENVIRONMENT_SEASONS,
    seasonWeights,
    SEASON_PROFILES,
    (profile) => profile.fogFarMultiplier,
  )
  const weatherFogFar = weightedNumber(
    ENVIRONMENT_WEATHERS,
    weatherWeights,
    WEATHER_PROFILES,
    (profile) => profile.fogFarMultiplier,
  )

  const azimuth = (minuteOfDay / 1440) * Math.PI * 2 - Math.PI / 2
  const horizontal = Math.cos(time.sunElevation) * 100
  const sunPosition = [
    stable(Math.cos(azimuth) * horizontal),
    stable(Math.sin(time.sunElevation) * 100),
    stable(Math.sin(azimuth) * horizontal),
  ] as const

  const fogNear = stable(Math.max(8, time.fogNear * seasonFogNear * weatherFogNear))
  const fogFar = stable(Math.max(fogNear + 24, time.fogFar * seasonFogFar * weatherFogFar))

  return {
    background,
    fog: { color: fog, near: fogNear, far: fogFar },
    exposure: stable(time.exposure * seasonExposure * weatherExposure),
    hemisphere: {
      skyColor: sky,
      groundColor: ground,
      intensity: stable(time.hemisphereIntensity * seasonHemisphere * weatherHemisphere),
    },
    ambient: {
      color: mixColor(sky, ground, 0.34),
      intensity: stable(time.ambientIntensity * seasonAmbient * weatherAmbient),
    },
    sun: {
      color: sun,
      intensity: stable(time.sunIntensity * seasonSunMultiplier * weatherSunMultiplier),
      position: sunPosition,
    },
  }
}

export function computeEnvironmentFrame(state: EnvironmentState): EnvironmentFrame {
  const seasonWeights = environmentSeasonWeights(state)
  const weatherWeights = environmentWeatherWeights(state)
  return {
    tick: state.tick,
    minuteOfDay: state.minuteOfDay,
    season: state.season,
    weather: state.weather,
    seasonWeights,
    weatherWeights,
    lighting: computeLighting(state.minuteOfDay, seasonWeights, weatherWeights),
  }
}
