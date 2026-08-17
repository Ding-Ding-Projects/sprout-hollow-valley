import type { InputController } from './controller'
import type { GamepadSample } from './types'

export interface DomInputTargets {
  readonly keyboard: EventTarget
  readonly pointer?: EventTarget
  readonly lifecycle?: EventTarget
}

export interface DomInputAdapterOptions {
  readonly preventDefaultCodes?: readonly string[]
  readonly preventContextMenu?: boolean
  readonly preventWheel?: boolean
}

function eventNumber(event: Event, property: string): number | undefined {
  const candidate = (event as unknown as Record<string, unknown>)[property]
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : undefined
}

function eventBoolean(event: Event, property: string): boolean | undefined {
  const candidate = (event as unknown as Record<string, unknown>)[property]
  return typeof candidate === 'boolean' ? candidate : undefined
}

function eventString(event: Event, property: string): string | undefined {
  const candidate = (event as unknown as Record<string, unknown>)[property]
  return typeof candidate === 'string' ? candidate : undefined
}

/** Thin browser listener adapter; it owns no gameplay state and contains no frame clock. */
export class DomInputAdapter {
  private readonly pointerTarget: EventTarget
  private readonly lifecycleTarget: EventTarget
  private readonly preventedCodes: ReadonlySet<string>
  private readonly preventContextMenu: boolean
  private readonly preventWheel: boolean
  private disposed = false

  private readonly onKeyDown: EventListener = (event) => {
    const code = eventString(event, 'code')
    if (code === undefined) return
    if (this.preventedCodes.has(code)) event.preventDefault()
    if (eventBoolean(event, 'repeat') === true) return
    this.controller.setKey(code, true)
  }

  private readonly onKeyUp: EventListener = (event) => {
    const code = eventString(event, 'code')
    if (code === undefined) return
    if (this.preventedCodes.has(code)) event.preventDefault()
    this.controller.setKey(code, false)
  }

  private readonly onPointerMove: EventListener = (event) => {
    if (eventBoolean(event, 'isPrimary') === false) return
    this.controller.addPointerDelta(
      eventNumber(event, 'movementX') ?? 0,
      eventNumber(event, 'movementY') ?? 0,
    )
  }

  private readonly onPointerDown: EventListener = (event) => {
    if (eventBoolean(event, 'isPrimary') === false) return
    const button = eventNumber(event, 'button')
    if (button === undefined || !Number.isInteger(button) || button < 0) return
    this.controller.setMouseButton(button, true)
  }

  private readonly onPointerUp: EventListener = (event) => {
    if (eventBoolean(event, 'isPrimary') === false) return
    const button = eventNumber(event, 'button')
    if (button === undefined || !Number.isInteger(button) || button < 0) return
    this.controller.setMouseButton(button, false)
  }

  private readonly onPointerCancel: EventListener = () => {
    this.controller.clearPointer()
  }

  private readonly onWheel: EventListener = (event) => {
    const delta = eventNumber(event, 'deltaY')
    if (delta === undefined) return
    if (this.preventWheel) event.preventDefault()
    this.controller.addWheelDelta(delta)
  }

  private readonly onBlur: EventListener = () => {
    this.controller.clear()
  }

  private readonly onContextMenu: EventListener = (event) => {
    if (this.preventContextMenu) event.preventDefault()
  }

  constructor(
    private readonly controller: InputController,
    private readonly targets: DomInputTargets,
    options: DomInputAdapterOptions = {},
  ) {
    this.pointerTarget = targets.pointer ?? targets.keyboard
    this.lifecycleTarget = targets.lifecycle ?? targets.keyboard
    this.preventedCodes = new Set(options.preventDefaultCodes ?? [])
    this.preventContextMenu = options.preventContextMenu ?? true
    this.preventWheel = options.preventWheel ?? false

    targets.keyboard.addEventListener('keydown', this.onKeyDown)
    targets.keyboard.addEventListener('keyup', this.onKeyUp)
    this.pointerTarget.addEventListener('pointermove', this.onPointerMove)
    this.pointerTarget.addEventListener('pointerdown', this.onPointerDown)
    this.pointerTarget.addEventListener('pointerup', this.onPointerUp)
    this.pointerTarget.addEventListener('pointercancel', this.onPointerCancel)
    this.pointerTarget.addEventListener('wheel', this.onWheel)
    this.pointerTarget.addEventListener('contextmenu', this.onContextMenu)
    this.lifecycleTarget.addEventListener('blur', this.onBlur)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.targets.keyboard.removeEventListener('keydown', this.onKeyDown)
    this.targets.keyboard.removeEventListener('keyup', this.onKeyUp)
    this.pointerTarget.removeEventListener('pointermove', this.onPointerMove)
    this.pointerTarget.removeEventListener('pointerdown', this.onPointerDown)
    this.pointerTarget.removeEventListener('pointerup', this.onPointerUp)
    this.pointerTarget.removeEventListener('pointercancel', this.onPointerCancel)
    this.pointerTarget.removeEventListener('wheel', this.onWheel)
    this.pointerTarget.removeEventListener('contextmenu', this.onContextMenu)
    this.lifecycleTarget.removeEventListener('blur', this.onBlur)
    this.controller.clearKeyboardAndPointer()
  }
}

export interface BrowserGamepadButtonLike {
  readonly value: number
  readonly pressed?: boolean
}

export interface BrowserGamepadLike {
  readonly index: number
  readonly connected?: boolean
  readonly axes: ArrayLike<number>
  readonly buttons: ArrayLike<number | BrowserGamepadButtonLike>
}

export type GamepadProvider = () => ArrayLike<BrowserGamepadLike | null>

function buttonValue(button: number | BrowserGamepadButtonLike): number {
  if (typeof button === 'number') return Number.isFinite(button) ? button : 0
  if (Number.isFinite(button.value)) return button.value
  return button.pressed === true ? 1 : 0
}

/** Samples `navigator.getGamepads()`-shaped data without importing or reading `navigator`. */
export class GamepadInputAdapter {
  private disposed = false

  constructor(
    private readonly controller: InputController,
    private readonly provider: GamepadProvider,
  ) {}

  poll(): readonly number[] {
    if (this.disposed) return Object.freeze([])
    const pads = this.provider()
    const samples: GamepadSample[] = []
    for (let position = 0; position < pads.length; position++) {
      const pad = pads[position]
      if (pad === null) continue
      samples.push({
        index: pad.index,
        connected: pad.connected ?? true,
        axes: Array.from(pad.axes),
        buttons: Array.from(pad.buttons, buttonValue),
      })
    }
    this.controller.updateGamepads(samples)
    return Object.freeze(
      samples
        .filter((sample) => sample.connected)
        .map((sample) => sample.index)
        .sort((left, right) => left - right),
    )
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.controller.clearGamepads()
  }
}
