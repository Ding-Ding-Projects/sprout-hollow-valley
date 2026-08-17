import { createThreeRuntime, type ThreeRuntime } from './runtime'

const MAX_FRAME_SECONDS = 1 / 15
const MAX_PIXEL_RATIO = 2
const FARM_CONTROL_CODES = Object.freeze([
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'Enter',
  'KeyA',
  'KeyD',
  'KeyE',
  'KeyF',
  'KeyG',
  'KeyI',
  'KeyQ',
  'KeyR',
  'KeyS',
  'KeyW',
  'Numpad2',
  'Numpad4',
  'Numpad6',
  'Numpad8',
  'Space',
  'Tab',
])

export type ThreeFarmSurfaceState = 'booting' | 'running' | 'paused' | 'failed' | 'disposed'

export interface ThreeFarmSurfaceStatus {
  readonly state: ThreeFarmSurfaceState
  readonly error?: string
}

export interface ThreeFarmSurfaceOptions {
  readonly startPaused?: boolean
  readonly onStateChange?: (status: ThreeFarmSurfaceStatus) => void
  readonly onError?: (message: string) => void
}

export interface ThreeFarmSurfaceHandle {
  readonly canvas: HTMLCanvasElement
  readonly runtime: ThreeRuntime | null
  readonly status: ThreeFarmSurfaceStatus
  pause(): void
  resume(): void
  isRunning(): boolean
  focus(): void
  resize(): void
  dispose(): void
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message
  if (typeof error === 'string' && error.trim().length > 0) return error
  return 'The 3D valley could not start.'
}

function safeNotify(options: ThreeFarmSurfaceOptions, status: ThreeFarmSurfaceStatus): void {
  try {
    options.onStateChange?.(status)
  } catch {
    // A shell notification failure must not stop rendering or teardown.
  }
}

/**
 * Mount the packaged Farm tab's real-time Three.js surface. The shell remains the owner of
 * visibility; this handle owns only the canvas, explicit frame clock, input focus and teardown.
 */
export function mountThreeFarmSurface(
  container: HTMLElement,
  options: ThreeFarmSurfaceOptions = {},
): ThreeFarmSurfaceHandle {
  const canvas = document.createElement('canvas')
  canvas.id = 'game'
  canvas.className = 'sh-farm__canvas'
  canvas.tabIndex = 0
  canvas.setAttribute('aria-label', 'Farm')
  canvas.setAttribute('data-sh-three-runtime', '')
  container.appendChild(canvas)

  let runtime: ThreeRuntime | null = null
  let running = false
  let disposed = false
  let failed = false
  let booted = false
  let animationFrame = 0
  let lastFrameTime = -1
  let lastPixelRatio = -1
  let currentStatus: ThreeFarmSurfaceStatus = Object.freeze({ state: 'booting' })

  const setStatus = (state: ThreeFarmSurfaceState, error?: string): void => {
    if (currentStatus.state === state && currentStatus.error === error) return
    currentStatus = Object.freeze(error === undefined ? { state } : { state, error })
    safeNotify(options, currentStatus)
  }

  const fail = (error: unknown): void => {
    if (disposed || failed) return
    failed = true
    running = false
    if (animationFrame !== 0) cancelAnimationFrame(animationFrame)
    animationFrame = 0
    runtime?.clearInput()
    const message = messageOf(error)
    setStatus('failed', message)
    try {
      console.error('[sprout hollow valley 3d]', error)
    } catch {
      // The visible shell state below remains the primary failure report.
    }
    try {
      options.onError?.(message)
    } catch {
      // A history or notification failure must not hide the canvas failure state.
    }
  }

  const focus = (): void => {
    try {
      canvas.focus({ preventScroll: true })
    } catch {
      canvas.focus()
    }
  }

  const resize = (): void => {
    if (runtime === null || disposed) return
    const bounds = container.getBoundingClientRect()
    const width = Math.max(1, Math.floor(bounds.width || container.clientWidth || 1))
    const height = Math.max(1, Math.floor(bounds.height || container.clientHeight || 1))
    const pixelRatio = Math.min(
      MAX_PIXEL_RATIO,
      Math.max(1, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1),
    )
    if (pixelRatio !== lastPixelRatio) {
      lastPixelRatio = pixelRatio
      runtime.renderer.setPixelRatio(pixelRatio)
    }
    runtime.resize(width, height)
  }

  const scheduleFrame = (): void => {
    if (!running || failed || disposed || animationFrame !== 0) return
    animationFrame = requestAnimationFrame((time) => {
      animationFrame = 0
      void renderFrame(time)
    })
  }

  const renderFrame = async (time: number): Promise<void> => {
    if (!running || failed || disposed || runtime === null) return
    const deltaSeconds =
      lastFrameTime < 0
        ? 0
        : Math.min(MAX_FRAME_SECONDS, Math.max(0, (time - lastFrameTime) / 1_000))
    lastFrameTime = time
    try {
      await runtime.tickPlayer(deltaSeconds)
    } catch (error) {
      fail(error)
      return
    }
    if (disposed || failed) return
    if (!booted) booted = true
    setStatus(running ? 'running' : 'paused')
    scheduleFrame()
  }

  const pause = (): void => {
    if (disposed || failed) return
    running = false
    lastFrameTime = -1
    if (animationFrame !== 0) cancelAnimationFrame(animationFrame)
    animationFrame = 0
    runtime?.clearInput()
    if (booted) setStatus('paused')
  }

  const resume = (): void => {
    if (disposed || failed || runtime === null || running) return
    running = true
    lastFrameTime = -1
    resize()
    setStatus(booted ? 'running' : 'booting')
    scheduleFrame()
  }

  const onPointerDown = (): void => focus()
  const onWindowResize = (): void => resize()
  canvas.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('resize', onWindowResize)

  const resizeObserver =
    typeof ResizeObserver === 'function' ? new ResizeObserver(() => resize()) : null
  resizeObserver?.observe(container)

  try {
    runtime = createThreeRuntime({
      canvas,
      input: {
        keyboardTarget: canvas,
        lifecycleTarget: window,
        dom: {
          preventDefaultCodes: FARM_CONTROL_CODES,
          preventContextMenu: true,
          preventWheel: true,
        },
      },
      renderer: {
        alpha: false,
        antialias: true,
        powerPreference: 'high-performance',
      },
    })
    resize()
  } catch (error) {
    fail(error)
  }

  if (runtime !== null && options.startPaused !== true) resume()
  else safeNotify(options, currentStatus)

  return {
    canvas,
    get runtime(): ThreeRuntime | null {
      return runtime
    },
    get status(): ThreeFarmSurfaceStatus {
      return currentStatus
    },
    pause,
    resume,
    isRunning(): boolean {
      return running && !failed && !disposed
    },
    focus,
    resize,
    dispose(): void {
      if (disposed) return
      disposed = true
      running = false
      if (animationFrame !== 0) cancelAnimationFrame(animationFrame)
      animationFrame = 0
      resizeObserver?.disconnect()
      window.removeEventListener('resize', onWindowResize)
      canvas.removeEventListener('pointerdown', onPointerDown)
      runtime?.clearInput()
      const disposingRuntime = runtime
      runtime = null
      canvas.remove()
      setStatus('disposed')
      void disposingRuntime?.dispose().catch((error: unknown) => {
        try {
          console.error('[sprout hollow valley 3d dispose]', error)
        } catch {
          // Teardown is best effort and must not strand the shell.
        }
      })
    },
  }
}
