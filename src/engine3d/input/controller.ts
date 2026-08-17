import { createInputBindings, DEFAULT_INPUT_BINDINGS } from './bindings'
import { normalizeGamepadStick } from './dead-zone'
import {
  INPUT_AXES,
  INPUT_BUTTONS,
  type AxisBinding,
  type ButtonBinding,
  type GamepadSample,
  type InputAxis,
  type InputBindings,
  type InputButton,
  type InputButtonSnapshot,
  type InputSnapshot,
} from './types'

const DEFAULT_BUTTON_THRESHOLD = 0.5

interface StoredGamepad {
  readonly axes: readonly number[]
  readonly buttons: readonly number[]
}

function cleanZero(value: number): number {
  return Object.is(value, -0) ? 0 : value
}

function clampUnitPair(x: number, y: number): readonly [number, number] {
  const magnitude = Math.hypot(x, y)
  if (magnitude <= 1) return [cleanZero(x), cleanZero(y)]
  return [cleanZero(x / magnitude), cleanZero(y / magnitude)]
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function assertPhysicalCode(code: string): void {
  if (typeof code !== 'string' || code.trim().length === 0) {
    throw new TypeError('keyboard code must be a non-empty string')
  }
}

function assertPhysicalIndex(index: number, label: string): void {
  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError(`${label} must be a non-negative integer`)
  }
}

/**
 * Pure deterministic input state. Browser event listeners and gamepad polling live in
 * separate adapters so this class can be driven by tests, replay files, or another shell.
 */
export class InputController {
  private bindings: InputBindings
  private readonly keys = new Set<string>()
  private readonly mouseButtons = new Set<number>()
  private readonly gamepads = new Map<number, StoredGamepad>()
  private readonly pressedButtons = new Set<InputButton>()
  private readonly releasedButtons = new Set<InputButton>()
  private pointerX = 0
  private pointerY = 0
  private wheel = 0
  private tick = 0

  constructor(bindings: InputBindings = DEFAULT_INPUT_BINDINGS) {
    this.bindings = createInputBindings(bindings)
  }

  getBindings(): InputBindings {
    return this.bindings
  }

  /** Remapping is fail-safe: all held physical state is cleared before the new map applies. */
  setBindings(bindings: InputBindings): void {
    const next = createInputBindings(bindings)
    this.clear()
    this.bindings = next
    this.pressedButtons.clear()
    this.releasedButtons.clear()
  }

  setKey(code: string, down: boolean): void {
    assertPhysicalCode(code)
    if (this.keys.has(code) === down) return
    this.captureButtonTransitions(() => {
      if (down) this.keys.add(code)
      else this.keys.delete(code)
    })
  }

  setMouseButton(button: number, down: boolean): void {
    assertPhysicalIndex(button, 'mouse button')
    if (this.mouseButtons.has(button) === down) return
    this.captureButtonTransitions(() => {
      if (down) this.mouseButtons.add(button)
      else this.mouseButtons.delete(button)
    })
  }

  addPointerDelta(deltaX: number, deltaY: number): void {
    if (Number.isFinite(deltaX)) this.pointerX += deltaX
    if (Number.isFinite(deltaY)) this.pointerY += deltaY
  }

  addWheelDelta(delta: number): void {
    if (Number.isFinite(delta)) this.wheel += delta
  }

  /** Replaces the complete connected-controller sample for this input tick. */
  updateGamepads(samples: readonly GamepadSample[]): void {
    const next = new Map<number, StoredGamepad>()
    const ordered = [...samples].sort((left, right) => left.index - right.index)
    for (const sample of ordered) {
      assertPhysicalIndex(sample.index, 'gamepad index')
      if (!sample.connected) continue
      if (next.has(sample.index)) throw new Error(`duplicate gamepad index ${sample.index}`)
      next.set(sample.index, {
        axes: Object.freeze(sample.axes.map((axis) => (Number.isFinite(axis) ? clamp(axis, -1, 1) : 0))),
        buttons: Object.freeze(
          sample.buttons.map((button) => (Number.isFinite(button) ? clamp(button, 0, 1) : 0)),
        ),
      })
    }

    this.captureButtonTransitions(() => {
      this.gamepads.clear()
      for (const [index, state] of next) this.gamepads.set(index, state)
    })
  }

  disconnectGamepad(index: number): void {
    assertPhysicalIndex(index, 'gamepad index')
    if (!this.gamepads.has(index)) return
    this.captureButtonTransitions(() => {
      this.gamepads.delete(index)
    })
  }

  clearGamepads(): void {
    if (this.gamepads.size === 0) return
    this.captureButtonTransitions(() => {
      this.gamepads.clear()
    })
  }

  clearKeyboardAndPointer(): void {
    const hasState =
      this.keys.size > 0 ||
      this.mouseButtons.size > 0 ||
      this.pointerX !== 0 ||
      this.pointerY !== 0 ||
      this.wheel !== 0
    if (!hasState) return
    this.captureButtonTransitions(() => {
      this.keys.clear()
      this.mouseButtons.clear()
    })
    this.pointerX = 0
    this.pointerY = 0
    this.wheel = 0
  }

  clearPointer(): void {
    if (this.mouseButtons.size > 0) {
      this.captureButtonTransitions(() => {
        this.mouseButtons.clear()
      })
    }
    this.pointerX = 0
    this.pointerY = 0
    this.wheel = 0
  }

  /** Clears every source while preserving appropriate released edges for the next tick. */
  clear(): void {
    const hasButtons = this.keys.size > 0 || this.mouseButtons.size > 0 || this.gamepads.size > 0
    if (hasButtons) {
      this.captureButtonTransitions(() => {
        this.keys.clear()
        this.mouseButtons.clear()
        this.gamepads.clear()
      })
    }
    this.pointerX = 0
    this.pointerY = 0
    this.wheel = 0
  }

  isButtonDown(button: InputButton): boolean {
    return this.readButton(button)
  }

  /**
   * Produces and deeply freezes one immutable tick. Transient edges, pointer movement,
   * and wheel movement are consumed; held input remains for the following tick.
   */
  snapshot(): InputSnapshot {
    const axes = Object.freeze(this.readAxes())
    const pointerDirectionX = this.bindings.pointer.invertX ? -1 : 1
    const pointerDirectionY = this.bindings.pointer.invertY ? -1 : 1
    const pointerDelta = Object.freeze({
      x: cleanZero(this.pointerX * this.bindings.pointer.sensitivityX * pointerDirectionX),
      y: cleanZero(this.pointerY * this.bindings.pointer.sensitivityY * pointerDirectionY),
    })

    const buttons = {} as Record<InputButton, InputButtonSnapshot>
    for (const button of INPUT_BUTTONS) {
      buttons[button] = Object.freeze({
        down: this.readButton(button),
        pressed: this.pressedButtons.has(button),
        released: this.releasedButtons.has(button),
      })
    }

    const snapshot = Object.freeze({
      tick: this.tick,
      axes,
      pointerDelta,
      wheelDelta: cleanZero(this.wheel),
      buttons: Object.freeze(buttons),
      connectedGamepads: Object.freeze([...this.gamepads.keys()].sort((left, right) => left - right)),
    })

    this.tick++
    this.pressedButtons.clear()
    this.releasedButtons.clear()
    this.pointerX = 0
    this.pointerY = 0
    this.wheel = 0
    return snapshot
  }

  private captureButtonTransitions(mutate: () => void): void {
    const before = new Map<InputButton, boolean>()
    for (const button of INPUT_BUTTONS) before.set(button, this.readButton(button))
    mutate()
    for (const button of INPUT_BUTTONS) {
      const wasDown = before.get(button) ?? false
      const isDown = this.readButton(button)
      if (!wasDown && isDown) this.pressedButtons.add(button)
      if (wasDown && !isDown) this.releasedButtons.add(button)
    }
  }

  private readAxes(): Record<InputAxis, number> {
    const values: Record<InputAxis, number> = {
      moveX: 0,
      moveY: 0,
      lookX: 0,
      lookY: 0,
    }

    for (const axis of INPUT_AXES) {
      for (const binding of this.bindings.axes[axis]) {
        if (this.readPhysicalBinding(binding)) values[axis] += binding.value
      }
    }

    for (const stick of this.bindings.sticks) {
      for (const [index, state] of this.gamepads) {
        if (stick.gamepadIndex !== undefined && stick.gamepadIndex !== index) continue
        const normalized = normalizeGamepadStick(
          state.axes[stick.xAxis] ?? 0,
          state.axes[stick.yAxis] ?? 0,
          stick.deadZone,
        )
        const targetX = stick.target === 'move' ? 'moveX' : 'lookX'
        const targetY = stick.target === 'move' ? 'moveY' : 'lookY'
        values[targetX] += normalized.x * stick.scaleX
        values[targetY] += normalized.y * stick.scaleY
      }
    }

    ;[values.moveX, values.moveY] = clampUnitPair(values.moveX, values.moveY)
    ;[values.lookX, values.lookY] = clampUnitPair(values.lookX, values.lookY)
    return values
  }

  private readButton(button: InputButton): boolean {
    return this.bindings.buttons[button].some((binding) => this.readPhysicalBinding(binding))
  }

  private readPhysicalBinding(binding: ButtonBinding | AxisBinding): boolean {
    switch (binding.kind) {
      case 'key':
        return this.keys.has(binding.code)
      case 'mouseButton':
        return this.mouseButtons.has(binding.button)
      case 'gamepadButton': {
        const threshold = binding.threshold ?? DEFAULT_BUTTON_THRESHOLD
        if (binding.gamepadIndex !== undefined) {
          return (this.gamepads.get(binding.gamepadIndex)?.buttons[binding.button] ?? 0) >= threshold
        }
        for (const state of this.gamepads.values()) {
          if ((state.buttons[binding.button] ?? 0) >= threshold) return true
        }
        return false
      }
    }
  }
}
