import {
  INPUT_AXES,
  INPUT_BUTTONS,
  type AxisBinding,
  type ButtonBinding,
  type GamepadStickBinding,
  type InputAxis,
  type InputBindings,
  type InputButton,
  type PointerLookOptions,
} from './types'

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer`)
  }
}

function assertFiniteNonZero(value: number, label: string): void {
  if (!Number.isFinite(value) || value === 0) {
    throw new RangeError(`${label} must be a finite non-zero number`)
  }
}

function validateThreshold(threshold: number | undefined): void {
  if (threshold === undefined) return
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new RangeError('gamepad button threshold must be between 0 and 1')
  }
}

function validateKeyCode(code: string): void {
  if (typeof code !== 'string' || code.trim().length === 0) {
    throw new TypeError('keyboard binding code must be a non-empty string')
  }
}

function copyButtonBinding(binding: ButtonBinding): ButtonBinding {
  switch (binding.kind) {
    case 'key':
      validateKeyCode(binding.code)
      return Object.freeze({ kind: 'key', code: binding.code })
    case 'mouseButton':
      assertNonNegativeInteger(binding.button, 'mouse button')
      return Object.freeze({ kind: 'mouseButton', button: binding.button })
    case 'gamepadButton':
      assertNonNegativeInteger(binding.button, 'gamepad button')
      if (binding.gamepadIndex !== undefined) {
        assertNonNegativeInteger(binding.gamepadIndex, 'gamepad index')
      }
      validateThreshold(binding.threshold)
      return Object.freeze({ ...binding })
  }
}

function copyAxisBinding(binding: AxisBinding): AxisBinding {
  assertFiniteNonZero(binding.value, 'digital axis value')
  switch (binding.kind) {
    case 'key':
      validateKeyCode(binding.code)
      return Object.freeze({ kind: 'key', code: binding.code, value: binding.value })
    case 'mouseButton':
      assertNonNegativeInteger(binding.button, 'mouse button')
      return Object.freeze({ kind: 'mouseButton', button: binding.button, value: binding.value })
    case 'gamepadButton':
      assertNonNegativeInteger(binding.button, 'gamepad button')
      if (binding.gamepadIndex !== undefined) {
        assertNonNegativeInteger(binding.gamepadIndex, 'gamepad index')
      }
      validateThreshold(binding.threshold)
      return Object.freeze({ ...binding })
  }
}

function copyStickBinding(binding: GamepadStickBinding): GamepadStickBinding {
  assertNonNegativeInteger(binding.xAxis, 'gamepad x axis')
  assertNonNegativeInteger(binding.yAxis, 'gamepad y axis')
  if (!Number.isFinite(binding.deadZone) || binding.deadZone < 0 || binding.deadZone >= 1) {
    throw new RangeError('gamepad dead zone must be between 0 (inclusive) and 1')
  }
  assertFiniteNonZero(binding.scaleX, 'gamepad x scale')
  assertFiniteNonZero(binding.scaleY, 'gamepad y scale')
  if (binding.gamepadIndex !== undefined) {
    assertNonNegativeInteger(binding.gamepadIndex, 'gamepad index')
  }
  return Object.freeze({ ...binding })
}

function copyPointerOptions(pointer: PointerLookOptions): PointerLookOptions {
  if (!Number.isFinite(pointer.sensitivityX) || pointer.sensitivityX < 0) {
    throw new RangeError('pointer x sensitivity must be a finite non-negative number')
  }
  if (!Number.isFinite(pointer.sensitivityY) || pointer.sensitivityY < 0) {
    throw new RangeError('pointer y sensitivity must be a finite non-negative number')
  }
  if (typeof pointer.invertX !== 'boolean' || typeof pointer.invertY !== 'boolean') {
    throw new TypeError('pointer inversion settings must be boolean')
  }
  return Object.freeze({ ...pointer })
}

/** Validates, defensively copies, and deeply freezes a binding set. */
export function createInputBindings(bindings: InputBindings): InputBindings {
  const axes = {} as Record<InputAxis, readonly AxisBinding[]>
  for (const axis of INPUT_AXES) {
    const configured = bindings.axes[axis]
    if (!Array.isArray(configured)) throw new TypeError(`bindings for ${axis} must be an array`)
    axes[axis] = Object.freeze(configured.map(copyAxisBinding))
  }

  const buttons = {} as Record<InputButton, readonly ButtonBinding[]>
  for (const button of INPUT_BUTTONS) {
    const configured = bindings.buttons[button]
    if (!Array.isArray(configured)) {
      throw new TypeError(`bindings for ${button} must be an array`)
    }
    buttons[button] = Object.freeze(configured.map(copyButtonBinding))
  }

  if (!Array.isArray(bindings.sticks)) throw new TypeError('gamepad stick bindings must be an array')

  return Object.freeze({
    axes: Object.freeze(axes),
    buttons: Object.freeze(buttons),
    sticks: Object.freeze(bindings.sticks.map(copyStickBinding)),
    pointer: copyPointerOptions(bindings.pointer),
  })
}

/** Returns a new frozen binding set with one logical button remapped. */
export function remapButton(
  bindings: InputBindings,
  button: InputButton,
  next: readonly ButtonBinding[],
): InputBindings {
  return createInputBindings({
    ...bindings,
    buttons: { ...bindings.buttons, [button]: next },
  })
}

/** Returns a new frozen binding set with one digital logical axis remapped. */
export function remapAxis(
  bindings: InputBindings,
  axis: InputAxis,
  next: readonly AxisBinding[],
): InputBindings {
  return createInputBindings({
    ...bindings,
    axes: { ...bindings.axes, [axis]: next },
  })
}

/** Returns a new frozen binding set with replacement analog-stick mappings. */
export function remapGamepadSticks(
  bindings: InputBindings,
  sticks: readonly GamepadStickBinding[],
): InputBindings {
  return createInputBindings({ ...bindings, sticks })
}

/** Returns a new frozen binding set with replacement pointer look settings. */
export function configurePointerLook(
  bindings: InputBindings,
  pointer: PointerLookOptions,
): InputBindings {
  return createInputBindings({ ...bindings, pointer })
}

const defaultBindings: InputBindings = {
  axes: {
    moveX: [
      { kind: 'key', code: 'KeyA', value: -1 },
      { kind: 'key', code: 'ArrowLeft', value: -1 },
      { kind: 'key', code: 'KeyD', value: 1 },
      { kind: 'key', code: 'ArrowRight', value: 1 },
    ],
    moveY: [
      { kind: 'key', code: 'KeyS', value: -1 },
      { kind: 'key', code: 'ArrowDown', value: -1 },
      { kind: 'key', code: 'KeyW', value: 1 },
      { kind: 'key', code: 'ArrowUp', value: 1 },
    ],
    lookX: [
      { kind: 'key', code: 'Numpad4', value: -1 },
      { kind: 'key', code: 'Numpad6', value: 1 },
    ],
    lookY: [
      { kind: 'key', code: 'Numpad8', value: -1 },
      { kind: 'key', code: 'Numpad2', value: 1 },
    ],
  },
  buttons: {
    primaryAction: [
      { kind: 'mouseButton', button: 0 },
      { kind: 'key', code: 'KeyF' },
      { kind: 'gamepadButton', button: 2 },
    ],
    secondaryAction: [
      { kind: 'mouseButton', button: 2 },
      { kind: 'key', code: 'KeyG' },
      { kind: 'gamepadButton', button: 3 },
    ],
    interact: [
      { kind: 'key', code: 'KeyE' },
      { kind: 'key', code: 'Enter' },
      { kind: 'gamepadButton', button: 0 },
    ],
    jump: [
      { kind: 'key', code: 'Space' },
      { kind: 'gamepadButton', button: 1 },
    ],
    sprint: [
      { kind: 'key', code: 'ShiftLeft' },
      { kind: 'key', code: 'ShiftRight' },
      { kind: 'gamepadButton', button: 10 },
    ],
    menu: [
      { kind: 'key', code: 'Escape' },
      { kind: 'gamepadButton', button: 9 },
    ],
    inventory: [
      { kind: 'key', code: 'Tab' },
      { kind: 'key', code: 'KeyI' },
      { kind: 'gamepadButton', button: 8 },
    ],
    recenterCamera: [
      { kind: 'key', code: 'KeyR' },
      { kind: 'gamepadButton', button: 11 },
    ],
    switchShoulder: [
      { kind: 'key', code: 'KeyQ' },
      { kind: 'gamepadButton', button: 5 },
    ],
    zoomIn: [
      { kind: 'key', code: 'Equal' },
      { kind: 'key', code: 'NumpadAdd' },
      { kind: 'gamepadButton', button: 12 },
    ],
    zoomOut: [
      { kind: 'key', code: 'Minus' },
      { kind: 'key', code: 'NumpadSubtract' },
      { kind: 'gamepadButton', button: 13 },
    ],
  },
  sticks: [
    {
      target: 'move',
      xAxis: 0,
      yAxis: 1,
      deadZone: 0.18,
      scaleX: 1,
      scaleY: -1,
    },
    {
      target: 'look',
      xAxis: 2,
      yAxis: 3,
      deadZone: 0.15,
      scaleX: 1,
      scaleY: 1,
    },
  ],
  pointer: {
    sensitivityX: 1,
    sensitivityY: 1,
    invertX: false,
    invertY: false,
  },
}

export const DEFAULT_INPUT_BINDINGS = createInputBindings(defaultBindings)
