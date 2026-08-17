import { PerspectiveCamera, Vector3 } from 'three'

const TAU = Math.PI * 2
const POSITION_EPSILON = 1e-6

/** A structural vector type keeps callers and collision adapters independent of Three.js classes. */
export interface CameraVector3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

export type CameraProfileName = 'outdoor' | 'indoor'
export type CameraShoulder = 'left' | 'right'

/**
 * The controller owns no collision world. Implementations return the nearest hit distance along
 * the supplied, normalized ray, or `null` when the whole segment is clear.
 */
export interface CameraObstructionQuery {
  distanceToObstruction(
    origin: CameraVector3,
    direction: CameraVector3,
    maxDistance: number,
  ): number | null
}

export interface CameraDampingProfile {
  /** Follow rate for the player-space target position. */
  readonly target: number
  /** Follow rate for yaw and pitch. */
  readonly orbit: number
  /** Follow rate for user-requested boom distance. */
  readonly zoom: number
  /** Follow rate for a left/right shoulder transition. */
  readonly shoulder: number
  /** Follow rate for profile-owned pivot height and field of view. */
  readonly profile: number
  /** Outward recovery rate after an obstruction clears. Inward movement is always immediate. */
  readonly obstructionRecovery: number
}

export interface ThirdPersonCameraProfile {
  readonly minDistance: number
  readonly maxDistance: number
  readonly defaultDistance: number
  readonly minPitch: number
  readonly maxPitch: number
  readonly defaultPitch: number
  readonly pivotHeight: number
  readonly shoulderOffset: number
  readonly fov: number
  readonly obstructionPadding: number
  readonly damping: CameraDampingProfile
}

export type ThirdPersonCameraProfileOverride = Partial<
  Omit<ThirdPersonCameraProfile, 'damping'>
> & {
  readonly damping?: Partial<CameraDampingProfile>
}

const OUTDOOR_PROFILE: ThirdPersonCameraProfile = Object.freeze({
  minDistance: 2.25,
  maxDistance: 10,
  defaultDistance: 5.5,
  minPitch: (-15 * Math.PI) / 180,
  maxPitch: (70 * Math.PI) / 180,
  defaultPitch: (22 * Math.PI) / 180,
  pivotHeight: 1.45,
  shoulderOffset: 0.65,
  fov: 55,
  obstructionPadding: 0.25,
  damping: Object.freeze({
    target: 18,
    orbit: 14,
    zoom: 12,
    shoulder: 16,
    profile: 10,
    obstructionRecovery: 8,
  }),
})

const INDOOR_PROFILE: ThirdPersonCameraProfile = Object.freeze({
  minDistance: 0.85,
  maxDistance: 4,
  defaultDistance: 2.35,
  minPitch: (-5 * Math.PI) / 180,
  maxPitch: (55 * Math.PI) / 180,
  defaultPitch: (18 * Math.PI) / 180,
  pivotHeight: 1.35,
  shoulderOffset: 0.38,
  fov: 62,
  obstructionPadding: 0.18,
  damping: Object.freeze({
    target: 22,
    orbit: 18,
    zoom: 16,
    shoulder: 20,
    profile: 14,
    obstructionRecovery: 11,
  }),
})

/** Safe defaults are exported so settings UI and tests can present the same hard bounds. */
export const DEFAULT_THIRD_PERSON_CAMERA_PROFILES: Readonly<
  Record<CameraProfileName, ThirdPersonCameraProfile>
> = Object.freeze({
  outdoor: OUTDOOR_PROFILE,
  indoor: INDOOR_PROFILE,
})

export interface ThirdPersonCameraControllerOptions {
  readonly profile?: CameraProfileName
  readonly profiles?: Partial<
    Record<CameraProfileName, ThirdPersonCameraProfileOverride>
  >
  readonly target?: CameraVector3
  /** Orbit yaw in radians. Yaw zero places the camera on the target's positive-Z side. */
  readonly yaw?: number
  /** Elevation in radians above the horizontal orbit plane. */
  readonly pitch?: number
  readonly distance?: number
  readonly shoulder?: CameraShoulder
  readonly reducedMotion?: boolean
  readonly obstructionQuery?: CameraObstructionQuery | null
}

export interface ThirdPersonCameraState {
  readonly profile: CameraProfileName
  readonly target: CameraVector3
  readonly yaw: number
  readonly desiredYaw: number
  readonly pitch: number
  readonly desiredPitch: number
  readonly distance: number
  readonly desiredDistance: number
  readonly shoulder: CameraShoulder
  /** Signed current offset: positive is right, negative is left. */
  readonly shoulderOffset: number
  /** True while a hit, or its damped recovery, shortens the desired camera ray. */
  readonly obstructed: boolean
  /** Actual distance from the look pivot to the camera after shoulder and obstruction. */
  readonly obstructionDistance: number
}

/**
 * A deterministic, input-agnostic third-person camera rig.
 *
 * Input adapters call the intent methods (`orbitBy`, `zoomBy`, `recenter`, and so on), then the
 * render loop calls `update` with an explicit delta in seconds. The class deliberately reads no
 * DOM, clock, input device, or collision singleton, which also makes it directly testable in Node.
 */
export class ThirdPersonCameraController {
  readonly camera: PerspectiveCamera

  private readonly profiles: Record<CameraProfileName, ThirdPersonCameraProfile>
  private profileName: CameraProfileName
  private obstructionQuery: CameraObstructionQuery | null
  private reducedMotion: boolean

  private readonly desiredTarget = new Vector3()
  private readonly currentTarget = new Vector3()
  private desiredYaw: number
  private currentYaw: number
  private desiredPitch: number
  private currentPitch: number
  private desiredDistance: number
  private currentDistance: number
  private shoulder: CameraShoulder
  private currentShoulderOffset: number
  private currentPivotHeight: number
  private currentFov: number
  private currentObstructionDistance = Number.POSITIVE_INFINITY
  private obstructed = false

  private readonly pivot = new Vector3()
  private readonly orbitOffset = new Vector3()
  private readonly shoulderRight = new Vector3()
  private readonly desiredCameraPosition = new Vector3()
  private readonly obstructionDirection = new Vector3()

  constructor(camera: PerspectiveCamera, options: ThirdPersonCameraControllerOptions = {}) {
    if (!camera.isPerspectiveCamera) {
      throw new TypeError('ThirdPersonCameraController requires a PerspectiveCamera')
    }

    this.camera = camera
    this.profiles = {
      outdoor: mergeAndValidateProfile(
        'outdoor',
        DEFAULT_THIRD_PERSON_CAMERA_PROFILES.outdoor,
        options.profiles?.outdoor,
      ),
      indoor: mergeAndValidateProfile(
        'indoor',
        DEFAULT_THIRD_PERSON_CAMERA_PROFILES.indoor,
        options.profiles?.indoor,
      ),
    }

    this.profileName = requireProfileName(options.profile ?? 'outdoor')
    const profile = this.activeProfile
    copyFiniteVector(this.desiredTarget, options.target ?? { x: 0, y: 0, z: 0 }, 'target')
    this.currentTarget.copy(this.desiredTarget)

    this.desiredYaw = normalizeAngle(finiteNumber(options.yaw ?? 0, 'yaw'))
    this.currentYaw = this.desiredYaw
    this.desiredPitch = clamp(
      finiteNumber(options.pitch ?? profile.defaultPitch, 'pitch'),
      profile.minPitch,
      profile.maxPitch,
    )
    this.currentPitch = this.desiredPitch
    this.desiredDistance = clamp(
      finiteNumber(options.distance ?? profile.defaultDistance, 'distance'),
      profile.minDistance,
      profile.maxDistance,
    )
    this.currentDistance = this.desiredDistance
    this.shoulder = options.shoulder ?? 'right'
    this.currentShoulderOffset = this.signedShoulderOffset(profile)
    this.currentPivotHeight = profile.pivotHeight
    this.currentFov = profile.fov
    this.reducedMotion = options.reducedMotion ?? false
    this.obstructionQuery = options.obstructionQuery ?? null

    this.applyCameraTransform(0, true)
  }

  get state(): ThirdPersonCameraState {
    return Object.freeze({
      profile: this.profileName,
      target: Object.freeze({
        x: this.currentTarget.x,
        y: this.currentTarget.y,
        z: this.currentTarget.z,
      }),
      yaw: this.currentYaw,
      desiredYaw: this.desiredYaw,
      pitch: this.currentPitch,
      desiredPitch: this.desiredPitch,
      distance: this.currentDistance,
      desiredDistance: this.desiredDistance,
      shoulder: this.shoulder,
      shoulderOffset: this.currentShoulderOffset,
      obstructed: this.obstructed,
      obstructionDistance: this.currentObstructionDistance,
    })
  }

  /** Set the tracked world position. `snap` is intended for teleports and room transitions. */
  setTarget(position: CameraVector3, snap = false): this {
    copyFiniteVector(this.desiredTarget, position, 'target')
    if (snap || this.reducedMotion) {
      this.currentTarget.copy(this.desiredTarget)
      this.applyCameraTransform(0, this.reducedMotion)
    }
    return this
  }

  setOrbit(yaw: number, pitch: number): this {
    const profile = this.activeProfile
    this.desiredYaw = normalizeAngle(finiteNumber(yaw, 'yaw'))
    this.desiredPitch = clamp(
      finiteNumber(pitch, 'pitch'),
      profile.minPitch,
      profile.maxPitch,
    )
    this.applyReducedMotionIntent()
    return this
  }

  orbitBy(deltaYaw: number, deltaPitch: number): this {
    return this.setOrbit(
      this.desiredYaw + finiteNumber(deltaYaw, 'deltaYaw'),
      this.desiredPitch + finiteNumber(deltaPitch, 'deltaPitch'),
    )
  }

  setDistance(distance: number): this {
    const profile = this.activeProfile
    this.desiredDistance = clamp(
      finiteNumber(distance, 'distance'),
      profile.minDistance,
      profile.maxDistance,
    )
    this.applyReducedMotionIntent()
    return this
  }

  /** Positive deltas pull back; negative deltas zoom in. */
  zoomBy(delta: number): this {
    return this.setDistance(this.desiredDistance + finiteNumber(delta, 'delta'))
  }

  setShoulder(shoulder: CameraShoulder): this {
    if (shoulder !== 'left' && shoulder !== 'right') {
      throw new TypeError("shoulder must be 'left' or 'right'")
    }
    this.shoulder = shoulder
    this.applyReducedMotionIntent()
    return this
  }

  toggleShoulder(): CameraShoulder {
    this.setShoulder(this.shoulder === 'right' ? 'left' : 'right')
    return this.shoulder
  }

  /**
   * Recenter toward a caller-supplied orbit yaw. The controller takes the shortest angular path;
   * callers remain free to define which character-facing convention maps to "behind".
   */
  recenter(yaw: number, immediate = false): this {
    this.desiredYaw = normalizeAngle(finiteNumber(yaw, 'yaw'))
    if (immediate || this.reducedMotion) {
      this.currentYaw = this.desiredYaw
      this.applyCameraTransform(0, this.reducedMotion)
    }
    return this
  }

  setProfile(profileName: CameraProfileName, immediate = false): this {
    this.profileName = requireProfileName(profileName)
    const profile = this.activeProfile
    this.desiredPitch = clamp(this.desiredPitch, profile.minPitch, profile.maxPitch)
    this.currentPitch = clamp(this.currentPitch, profile.minPitch, profile.maxPitch)
    this.desiredDistance = clamp(
      this.desiredDistance,
      profile.minDistance,
      profile.maxDistance,
    )
    this.currentDistance = clamp(this.currentDistance, profile.minDistance, profile.maxDistance)

    if (immediate || this.reducedMotion) this.snap()
    return this
  }

  setReducedMotion(enabled: boolean): this {
    this.reducedMotion = enabled
    if (enabled) this.snap()
    return this
  }

  setObstructionQuery(query: CameraObstructionQuery | null): this {
    this.obstructionQuery = query
    this.applyCameraTransform(0, this.reducedMotion)
    return this
  }

  /** Immediately synchronise every damped value with its requested value. */
  snap(): this {
    const profile = this.activeProfile
    this.currentTarget.copy(this.desiredTarget)
    this.currentYaw = this.desiredYaw
    this.currentPitch = this.desiredPitch
    this.currentDistance = this.desiredDistance
    this.currentShoulderOffset = this.signedShoulderOffset(profile)
    this.currentPivotHeight = profile.pivotHeight
    this.currentFov = profile.fov
    this.applyCameraTransform(0, true)
    return this
  }

  /** Advance camera state by an explicit number of seconds. */
  update(deltaSeconds: number): void {
    const delta = finiteNumber(deltaSeconds, 'deltaSeconds')
    if (delta < 0) throw new RangeError('deltaSeconds must be non-negative')

    const profile = this.activeProfile
    if (this.reducedMotion) {
      this.currentTarget.copy(this.desiredTarget)
      this.currentYaw = this.desiredYaw
      this.currentPitch = this.desiredPitch
      this.currentDistance = this.desiredDistance
      this.currentShoulderOffset = this.signedShoulderOffset(profile)
      this.currentPivotHeight = profile.pivotHeight
      this.currentFov = profile.fov
    } else if (delta > 0) {
      this.currentTarget.lerp(
        this.desiredTarget,
        exponentialAlpha(profile.damping.target, delta),
      )
      this.currentYaw = dampAngle(
        this.currentYaw,
        this.desiredYaw,
        profile.damping.orbit,
        delta,
      )
      this.currentPitch = damp(
        this.currentPitch,
        this.desiredPitch,
        profile.damping.orbit,
        delta,
      )
      this.currentDistance = damp(
        this.currentDistance,
        this.desiredDistance,
        profile.damping.zoom,
        delta,
      )
      this.currentShoulderOffset = damp(
        this.currentShoulderOffset,
        this.signedShoulderOffset(profile),
        profile.damping.shoulder,
        delta,
      )
      this.currentPivotHeight = damp(
        this.currentPivotHeight,
        profile.pivotHeight,
        profile.damping.profile,
        delta,
      )
      this.currentFov = damp(
        this.currentFov,
        profile.fov,
        profile.damping.profile,
        delta,
      )
    }

    this.applyCameraTransform(delta, this.reducedMotion)
  }

  private get activeProfile(): ThirdPersonCameraProfile {
    return this.profiles[this.profileName]
  }

  private signedShoulderOffset(profile: ThirdPersonCameraProfile): number {
    return this.shoulder === 'right' ? profile.shoulderOffset : -profile.shoulderOffset
  }

  private applyReducedMotionIntent(): void {
    if (!this.reducedMotion) return
    this.currentYaw = this.desiredYaw
    this.currentPitch = this.desiredPitch
    this.currentDistance = this.desiredDistance
    this.currentShoulderOffset = this.signedShoulderOffset(this.activeProfile)
    this.applyCameraTransform(0, true)
  }

  private applyCameraTransform(deltaSeconds: number, snapObstruction: boolean): void {
    const profile = this.activeProfile
    this.pivot.copy(this.currentTarget)
    this.pivot.y += this.currentPivotHeight

    const horizontalDistance = Math.cos(this.currentPitch) * this.currentDistance
    this.orbitOffset.set(
      Math.sin(this.currentYaw) * horizontalDistance,
      Math.sin(this.currentPitch) * this.currentDistance,
      Math.cos(this.currentYaw) * horizontalDistance,
    )
    this.shoulderRight.set(Math.cos(this.currentYaw), 0, -Math.sin(this.currentYaw))

    this.desiredCameraPosition
      .copy(this.pivot)
      .add(this.orbitOffset)
      .addScaledVector(this.shoulderRight, this.currentShoulderOffset)

    this.obstructionDirection.copy(this.desiredCameraPosition).sub(this.pivot)
    const desiredRayDistance = this.obstructionDirection.length()
    if (desiredRayDistance > POSITION_EPSILON) {
      this.obstructionDirection.multiplyScalar(1 / desiredRayDistance)
    } else {
      this.obstructionDirection.set(0, 0, 1)
    }

    const hitDistance = this.queryObstructionDistance(desiredRayDistance)
    let allowedDistance = desiredRayDistance
    let hasCurrentHit = false
    if (hitDistance !== null && hitDistance < desiredRayDistance) {
      const paddedDistance = hitDistance - profile.obstructionPadding
      // When a hit is inside the padding radius, remain between the pivot and the hit instead of
      // enforcing the normal zoom minimum and clipping through the obstacle.
      allowedDistance = paddedDistance >= 0 ? paddedDistance : hitDistance * 0.5
      hasCurrentHit = allowedDistance < desiredRayDistance - POSITION_EPSILON
    }

    if (!Number.isFinite(this.currentObstructionDistance)) {
      this.currentObstructionDistance = allowedDistance
    } else if (allowedDistance <= this.currentObstructionDistance || snapObstruction) {
      // Safety is fail-closed: moving inward never waits for a smoothing pass.
      this.currentObstructionDistance = allowedDistance
    } else {
      this.currentObstructionDistance = damp(
        this.currentObstructionDistance,
        allowedDistance,
        profile.damping.obstructionRecovery,
        deltaSeconds,
      )
    }
    this.currentObstructionDistance = clamp(
      this.currentObstructionDistance,
      0,
      desiredRayDistance,
    )
    this.obstructed =
      hasCurrentHit ||
      this.currentObstructionDistance < desiredRayDistance - POSITION_EPSILON

    this.camera.position
      .copy(this.pivot)
      .addScaledVector(this.obstructionDirection, this.currentObstructionDistance)
    this.camera.fov = this.currentFov
    this.camera.lookAt(this.pivot)
    this.camera.updateProjectionMatrix()
    this.camera.updateMatrixWorld()
  }

  private queryObstructionDistance(maxDistance: number): number | null {
    if (this.obstructionQuery === null || maxDistance <= POSITION_EPSILON) return null
    const distance = this.obstructionQuery.distanceToObstruction(
      this.pivot,
      this.obstructionDirection,
      maxDistance,
    )
    if (distance === null) return null
    if (!Number.isFinite(distance) || distance < 0) {
      throw new RangeError('obstruction query must return null or a finite non-negative distance')
    }
    return distance
  }
}

function mergeAndValidateProfile(
  name: CameraProfileName,
  base: ThirdPersonCameraProfile,
  override: ThirdPersonCameraProfileOverride | undefined,
): ThirdPersonCameraProfile {
  const profile: ThirdPersonCameraProfile = {
    ...base,
    ...override,
    damping: {
      ...base.damping,
      ...override?.damping,
    },
  }
  validateProfile(name, profile)
  return Object.freeze({ ...profile, damping: Object.freeze({ ...profile.damping }) })
}

function validateProfile(name: CameraProfileName, profile: ThirdPersonCameraProfile): void {
  const values: ReadonlyArray<readonly [string, number]> = [
    ['minDistance', profile.minDistance],
    ['maxDistance', profile.maxDistance],
    ['defaultDistance', profile.defaultDistance],
    ['minPitch', profile.minPitch],
    ['maxPitch', profile.maxPitch],
    ['defaultPitch', profile.defaultPitch],
    ['pivotHeight', profile.pivotHeight],
    ['shoulderOffset', profile.shoulderOffset],
    ['fov', profile.fov],
    ['obstructionPadding', profile.obstructionPadding],
    ['damping.target', profile.damping.target],
    ['damping.orbit', profile.damping.orbit],
    ['damping.zoom', profile.damping.zoom],
    ['damping.shoulder', profile.damping.shoulder],
    ['damping.profile', profile.damping.profile],
    ['damping.obstructionRecovery', profile.damping.obstructionRecovery],
  ]
  for (const [key, value] of values) finiteNumber(value, `${name}.${key}`)

  if (profile.minDistance <= 0 || profile.maxDistance < profile.minDistance) {
    throw new RangeError(`${name} camera distances must be positive and ordered`)
  }
  if (
    profile.defaultDistance < profile.minDistance ||
    profile.defaultDistance > profile.maxDistance
  ) {
    throw new RangeError(`${name}.defaultDistance must be inside its distance range`)
  }
  if (profile.maxPitch <= profile.minPitch) {
    throw new RangeError(`${name} camera pitches must be ordered`)
  }
  if (profile.defaultPitch < profile.minPitch || profile.defaultPitch > profile.maxPitch) {
    throw new RangeError(`${name}.defaultPitch must be inside its pitch range`)
  }
  if (profile.shoulderOffset < 0 || profile.obstructionPadding < 0) {
    throw new RangeError(`${name} camera offsets and padding must be non-negative`)
  }
  if (profile.fov <= 0 || profile.fov >= 180) {
    throw new RangeError(`${name}.fov must be between 0 and 180 degrees`)
  }
  for (const [key, value] of Object.entries(profile.damping)) {
    if (value < 0) throw new RangeError(`${name}.damping.${key} must be non-negative`)
  }
}

function copyFiniteVector(target: Vector3, source: CameraVector3, label: string): void {
  target.set(
    finiteNumber(source.x, `${label}.x`),
    finiteNumber(source.y, `${label}.y`),
    finiteNumber(source.z, `${label}.z`),
  )
}

function requireProfileName(profileName: CameraProfileName): CameraProfileName {
  if (profileName !== 'outdoor' && profileName !== 'indoor') {
    throw new TypeError("profile must be 'outdoor' or 'indoor'")
  }
  return profileName
}

function finiteNumber(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`)
  return value
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeAngle(angle: number): number {
  const wrapped = ((angle + Math.PI) % TAU + TAU) % TAU - Math.PI
  return Object.is(wrapped, -0) ? 0 : wrapped
}

function exponentialAlpha(rate: number, deltaSeconds: number): number {
  if (deltaSeconds <= 0 || rate <= 0) return 0
  return 1 - Math.exp(-rate * deltaSeconds)
}

function damp(current: number, target: number, rate: number, deltaSeconds: number): number {
  return current + (target - current) * exponentialAlpha(rate, deltaSeconds)
}

function dampAngle(current: number, target: number, rate: number, deltaSeconds: number): number {
  const delta = normalizeAngle(target - current)
  return normalizeAngle(current + delta * exponentialAlpha(rate, deltaSeconds))
}
