import { describe, expect, it } from 'vitest'

import {
  configurePointerLook,
  DEFAULT_INPUT_BINDINGS,
  DomInputAdapter,
  GamepadInputAdapter,
  InputController,
  normalizeGamepadAxis,
  normalizeGamepadStick,
  remapAxis,
  remapButton,
} from '../../src/engine3d/input'

function dispatch(target: EventTarget, type: string, fields: Record<string, unknown> = {}): Event {
  const event = new Event(type, { cancelable: true })
  for (const [name, value] of Object.entries(fields)) {
    Object.defineProperty(event, name, { configurable: true, value })
  }
  target.dispatchEvent(event)
  return event
}

describe('InputController', () => {
  it('normalizes diagonal movement and emits immutable, one-tick button edges', () => {
    const input = new InputController()
    input.setKey('KeyW', true)
    input.setKey('KeyD', true)
    input.setKey('KeyE', true)

    const first = input.snapshot()
    expect(first.tick).toBe(0)
    expect(first.axes.moveX).toBeCloseTo(Math.SQRT1_2)
    expect(first.axes.moveY).toBeCloseTo(Math.SQRT1_2)
    expect(first.buttons.interact).toEqual({ down: true, pressed: true, released: false })
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.axes)).toBe(true)
    expect(Object.isFrozen(first.buttons)).toBe(true)
    expect(Object.isFrozen(first.buttons.interact)).toBe(true)
    expect(Object.isFrozen(first.connectedGamepads)).toBe(true)

    const held = input.snapshot()
    expect(held.tick).toBe(1)
    expect(held.buttons.interact).toEqual({ down: true, pressed: false, released: false })

    input.setKey('KeyE', false)
    const released = input.snapshot()
    expect(released.buttons.interact).toEqual({ down: false, pressed: false, released: true })
  })

  it('keeps press and release edges when both happen between snapshots', () => {
    const input = new InputController()
    input.setKey('Space', true)
    input.setKey('Space', false)

    expect(input.snapshot().buttons.jump).toEqual({ down: false, pressed: true, released: true })
    expect(input.snapshot().buttons.jump).toEqual({ down: false, pressed: false, released: false })
  })

  it('supports frozen remapping for buttons and digital axes', () => {
    const remappedButton = remapButton(DEFAULT_INPUT_BINDINGS, 'interact', [
      { kind: 'key', code: 'KeyK' },
      { kind: 'gamepadButton', button: 7 },
    ])
    const bindings = remapAxis(remappedButton, 'moveX', [
      { kind: 'key', code: 'KeyH', value: -1 },
      { kind: 'key', code: 'KeyL', value: 1 },
    ])
    const input = new InputController(bindings)

    expect(Object.isFrozen(bindings)).toBe(true)
    expect(Object.isFrozen(bindings.buttons.interact)).toBe(true)
    input.setKey('KeyE', true)
    expect(input.snapshot().buttons.interact.down).toBe(false)

    input.setKey('KeyK', true)
    input.setKey('KeyL', true)
    const snapshot = input.snapshot()
    expect(snapshot.buttons.interact.pressed).toBe(true)
    expect(snapshot.axes.moveX).toBe(1)
  })

  it('accumulates pointer and wheel deltas once with sensitivity and inversion', () => {
    const bindings = configurePointerLook(DEFAULT_INPUT_BINDINGS, {
      sensitivityX: 0.5,
      sensitivityY: 2,
      invertX: true,
      invertY: false,
    })
    const input = new InputController(bindings)
    input.addPointerDelta(3, -2)
    input.addPointerDelta(5, 3)
    input.addWheelDelta(-4)
    input.addWheelDelta(1)

    const first = input.snapshot()
    expect(first.pointerDelta).toEqual({ x: -4, y: 2 })
    expect(first.wheelDelta).toBe(-3)
    expect(input.snapshot().pointerDelta).toEqual({ x: 0, y: 0 })
    expect(input.snapshot().wheelDelta).toBe(0)
  })

  it('normalizes gamepad dead zones and clears held state on disconnect', () => {
    expect(normalizeGamepadAxis(0.1, 0.2)).toBe(0)
    expect(normalizeGamepadAxis(-0.6, 0.2)).toBeCloseTo(-0.5)
    expect(normalizeGamepadStick(0.12, 0.12, 0.2)).toEqual({ x: 0, y: 0 })
    const halfStick = normalizeGamepadStick(0.3, 0.4, 0.2)
    expect(Math.hypot(halfStick.x, halfStick.y)).toBeCloseTo(0.375)

    const input = new InputController()
    const buttons = Array<number>(14).fill(0)
    buttons[0] = 1
    input.updateGamepads([
      { index: 2, connected: true, axes: [0.6, -0.8, 0, 0], buttons },
    ])

    const connected = input.snapshot()
    expect(connected.connectedGamepads).toEqual([2])
    expect(connected.axes.moveX).toBeCloseTo(0.6)
    expect(connected.axes.moveY).toBeCloseTo(0.8)
    expect(connected.buttons.interact).toEqual({ down: true, pressed: true, released: false })

    input.updateGamepads([])
    const disconnected = input.snapshot()
    expect(disconnected.connectedGamepads).toEqual([])
    expect(disconnected.axes.moveX).toBe(0)
    expect(disconnected.axes.moveY).toBe(0)
    expect(disconnected.buttons.interact).toEqual({ down: false, pressed: false, released: true })
  })

  it('does not release an action while another physical source still holds it', () => {
    const input = new InputController()
    input.setKey('KeyE', true)
    input.updateGamepads([
      { index: 0, connected: true, axes: [], buttons: [1] },
    ])
    input.snapshot()

    input.updateGamepads([])
    expect(input.snapshot().buttons.interact).toEqual({
      down: true,
      pressed: false,
      released: false,
    })

    input.setKey('KeyE', false)
    expect(input.snapshot().buttons.interact.released).toBe(true)
  })
})

describe('input adapters', () => {
  it('keeps DOM event wiring disposable and separate from the pure core', () => {
    const keyboard = new EventTarget()
    const pointer = new EventTarget()
    const lifecycle = new EventTarget()
    const input = new InputController()
    const adapter = new DomInputAdapter(
      input,
      { keyboard, pointer, lifecycle },
      { preventDefaultCodes: ['KeyE'], preventWheel: true },
    )

    const keyEvent = dispatch(keyboard, 'keydown', { code: 'KeyE', repeat: false })
    dispatch(pointer, 'pointermove', { isPrimary: true, movementX: 4, movementY: -3 })
    dispatch(pointer, 'pointerdown', { isPrimary: true, button: 0 })
    const wheelEvent = dispatch(pointer, 'wheel', { deltaY: 12 })
    const active = input.snapshot()

    expect(keyEvent.defaultPrevented).toBe(true)
    expect(wheelEvent.defaultPrevented).toBe(true)
    expect(active.pointerDelta).toEqual({ x: 4, y: -3 })
    expect(active.wheelDelta).toBe(12)
    expect(active.buttons.interact.down).toBe(true)
    expect(active.buttons.primaryAction.down).toBe(true)

    dispatch(lifecycle, 'blur')
    const blurred = input.snapshot()
    expect(blurred.buttons.interact.released).toBe(true)
    expect(blurred.buttons.primaryAction.released).toBe(true)

    adapter.dispose()
    dispatch(keyboard, 'keydown', { code: 'KeyE', repeat: false })
    expect(input.snapshot().buttons.interact.down).toBe(false)
  })

  it('polls navigator-shaped gamepads and clears them when disposed', () => {
    const input = new InputController()
    const adapter = new GamepadInputAdapter(input, () => [
      {
        index: 3,
        connected: true,
        axes: [0, -1, 0, 0],
        buttons: [{ value: 1, pressed: true }],
      },
    ])

    expect(adapter.poll()).toEqual([3])
    const active = input.snapshot()
    expect(active.connectedGamepads).toEqual([3])
    expect(active.axes.moveY).toBe(1)
    expect(active.buttons.interact.down).toBe(true)

    adapter.dispose()
    const disposed = input.snapshot()
    expect(disposed.connectedGamepads).toEqual([])
    expect(disposed.buttons.interact.released).toBe(true)
    expect(adapter.poll()).toEqual([])
  })
})
