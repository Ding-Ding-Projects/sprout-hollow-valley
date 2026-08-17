/** Logical axes consumed by the third-person movement and camera systems. */
export const INPUT_AXES = ['moveX', 'moveY', 'lookX', 'lookY'] as const

export type InputAxis = (typeof INPUT_AXES)[number]

/**
 * Logical buttons shared by keyboard/mouse and gamepad defaults.
 *
 * The names describe gameplay intent rather than a particular device so callers never
 * need to branch on the active input source.
 */
export const INPUT_BUTTONS = [
  'primaryAction',
  'secondaryAction',
  'interact',
  'jump',
  'sprint',
  'menu',
  'inventory',
  'recenterCamera',
  'switchShoulder',
  'zoomIn',
  'zoomOut',
] as const

export type InputButton = (typeof INPUT_BUTTONS)[number]

export interface ReadonlyVector2 {
  readonly x: number
  readonly y: number
}

export interface InputButtonSnapshot {
  /** Whether at least one binding for this logical button is currently held. */
  readonly down: boolean
  /** Whether the logical button changed from up to down during this tick. */
  readonly pressed: boolean
  /** Whether the logical button changed from down to up during this tick. */
  readonly released: boolean
}

export interface InputSnapshot {
  /** Monotonic input tick, beginning at zero. */
  readonly tick: number
  /** Movement and gamepad/digital camera axes, each clamped to a unit circle. */
  readonly axes: Readonly<Record<InputAxis, number>>
  /** Accumulated pointer movement since the previous snapshot, after user settings. */
  readonly pointerDelta: ReadonlyVector2
  /** Accumulated wheel delta since the previous snapshot. */
  readonly wheelDelta: number
  readonly buttons: Readonly<Record<InputButton, InputButtonSnapshot>>
  /** Connected controller indices in deterministic ascending order. */
  readonly connectedGamepads: readonly number[]
}

interface KeyButtonBinding {
  readonly kind: 'key'
  readonly code: string
}

interface MouseButtonBinding {
  readonly kind: 'mouseButton'
  readonly button: number
}

interface GamepadButtonBinding {
  readonly kind: 'gamepadButton'
  readonly button: number
  /** Omit to accept the binding from any connected controller. */
  readonly gamepadIndex?: number
  /** Analog button value at or above this value counts as down. Defaults to 0.5. */
  readonly threshold?: number
}

export type ButtonBinding = KeyButtonBinding | MouseButtonBinding | GamepadButtonBinding

interface KeyAxisBinding {
  readonly kind: 'key'
  readonly code: string
  readonly value: number
}

interface MouseButtonAxisBinding {
  readonly kind: 'mouseButton'
  readonly button: number
  readonly value: number
}

interface GamepadButtonAxisBinding {
  readonly kind: 'gamepadButton'
  readonly button: number
  readonly value: number
  readonly gamepadIndex?: number
  readonly threshold?: number
}

/** A digital physical input contributing a signed value to a logical axis. */
export type AxisBinding = KeyAxisBinding | MouseButtonAxisBinding | GamepadButtonAxisBinding

export interface GamepadStickBinding {
  readonly target: 'move' | 'look'
  readonly xAxis: number
  readonly yAxis: number
  readonly deadZone: number
  readonly scaleX: number
  readonly scaleY: number
  /** Omit to accept this stick mapping from any connected controller. */
  readonly gamepadIndex?: number
}

export interface PointerLookOptions {
  readonly sensitivityX: number
  readonly sensitivityY: number
  readonly invertX: boolean
  readonly invertY: boolean
}

/** Complete, serializable remapping contract for the deterministic input core. */
export interface InputBindings {
  readonly axes: Readonly<Record<InputAxis, readonly AxisBinding[]>>
  readonly buttons: Readonly<Record<InputButton, readonly ButtonBinding[]>>
  readonly sticks: readonly GamepadStickBinding[]
  readonly pointer: PointerLookOptions
}

/** Renderer-independent sample accepted by the input core. */
export interface GamepadSample {
  readonly index: number
  readonly connected: boolean
  readonly axes: readonly number[]
  /** Normalized analog button values in the inclusive range 0..1. */
  readonly buttons: readonly number[]
}
