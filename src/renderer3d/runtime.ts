import {
  CollisionWorld,
  DomInputAdapter,
  GamepadInputAdapter,
  InputController,
  ThirdPersonCameraController,
  WorldCellStreamer,
  type CameraVector3,
  type DomInputAdapterOptions,
  type GamepadProvider,
  type InputBindings,
  type InputSnapshot,
  type WorldCellSource,
  type WorldCellStreamerOptions,
  type WorldCellUpdate,
  type WorldXZ,
} from '../engine3d'
import {
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  type WebGLRendererParameters,
} from 'three'
import {
  createCoreGltfAssetRegistry,
  type CoreGltfAssetRegistry,
} from './assets'
import {
  EnvironmentSystem,
  type EnvironmentSeedState,
  type EnvironmentSystemOptions,
} from './environment'
import {
  ThreeWorldCellSource,
  type LoadedThreeWorldCell,
  type ThreeWorldCellBuilder,
} from './world'

const DEFAULT_ENVIRONMENT: EnvironmentSeedState = Object.freeze({
  minuteOfDay: 600,
  season: 'spring',
  weather: 'clear',
})

const DEFAULT_WORLD: Pick<WorldCellStreamerOptions, 'worldSeed' | 'cellSize' | 'loadRadius'> =
  Object.freeze({
    worldSeed: 1,
    cellSize: 16,
    loadRadius: 1,
  })

export interface ThreeRuntimeInputOptions {
  readonly bindings?: InputBindings
  readonly keyboardTarget?: EventTarget
  readonly lifecycleTarget?: EventTarget
  readonly dom?: DomInputAdapterOptions
  readonly gamepadProvider?: GamepadProvider
}

export interface ThreeRuntimeOptions {
  readonly canvas: HTMLCanvasElement
  /** Supply a source for authored gameplay cells, or omit it to use the bundled Three fallback. */
  readonly worldSource?: WorldCellSource<unknown>
  readonly world?: Partial<WorldCellStreamerOptions>
  readonly buildCell?: ThreeWorldCellBuilder
  readonly assets?: CoreGltfAssetRegistry
  readonly environment?: Omit<EnvironmentSystemOptions, 'scene' | 'initial'> & {
    readonly initial?: EnvironmentSeedState
  }
  readonly input?: ThreeRuntimeInputOptions
  readonly renderer?: Omit<WebGLRendererParameters, 'canvas'>
}

export interface ThreeRuntimeTick {
  readonly input: InputSnapshot
  readonly world: WorldCellUpdate<unknown>
}

function defaultGamepadProvider(): ReturnType<GamepadProvider> {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return []
  return navigator.getGamepads()
}

function defaultEventTarget(canvas: HTMLCanvasElement): EventTarget {
  return typeof window === 'undefined' ? canvas : window
}

function resolveDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.max(1, Math.floor(value)) : 1
}

/**
 * Small explicit Three.js composition root. It deliberately owns no animation loop, gameplay
 * definition loader, or wall-clock; the caller drives every frame through `tick`.
 */
export class ThreeRuntime {
  readonly scene = new Scene()
  readonly camera = new PerspectiveCamera(55, 1, 0.1, 2_000)
  readonly renderer: WebGLRenderer
  readonly input: InputController
  readonly domInput: DomInputAdapter
  readonly gamepadInput: GamepadInputAdapter
  readonly collision: CollisionWorld
  readonly cameraController: ThirdPersonCameraController
  readonly environment: EnvironmentSystem
  readonly world: WorldCellStreamer<unknown>
  readonly assets: CoreGltfAssetRegistry

  private readonly ownsAssets: boolean
  private disposed = false
  private disposePromise: Promise<void> | undefined

  constructor(private readonly options: ThreeRuntimeOptions) {
    const worldOptions: WorldCellStreamerOptions = {
      ...DEFAULT_WORLD,
      ...options.world,
    }
    this.renderer = new WebGLRenderer({ antialias: true, ...options.renderer, canvas: options.canvas })
    this.collision = new CollisionWorld(worldOptions.cellSize)
    this.cameraController = new ThirdPersonCameraController(this.camera, {
      obstructionQuery: {
        distanceToObstruction: (origin, direction, maxDistance) =>
          this.collision.raycast(origin, direction, maxDistance)?.distance ?? null,
      },
    })
    this.environment = new EnvironmentSystem({
      ...options.environment,
      initial: options.environment?.initial ?? DEFAULT_ENVIRONMENT,
      scene: this.scene,
    })
    this.environment.applyExposure(this.renderer)

    this.assets = options.assets ?? createCoreGltfAssetRegistry()
    this.ownsAssets = options.assets === undefined
    const source = options.worldSource ?? this.createDefaultWorldSource(worldOptions.cellSize)
    this.world = new WorldCellStreamer(source, worldOptions)

    this.input = new InputController(options.input?.bindings)
    const keyboardTarget = options.input?.keyboardTarget ?? defaultEventTarget(options.canvas)
    this.domInput = new DomInputAdapter(
      this.input,
      {
        keyboard: keyboardTarget,
        pointer: options.canvas,
        lifecycle: options.input?.lifecycleTarget ?? keyboardTarget,
      },
      options.input?.dom,
    )
    this.gamepadInput = new GamepadInputAdapter(
      this.input,
      options.input?.gamepadProvider ?? defaultGamepadProvider,
    )
    this.resize(options.canvas.clientWidth, options.canvas.clientHeight)
  }

  /** Poll adapters, advance explicit systems, stream near the player, then render one frame. */
  async tick(deltaSeconds: number, playerPosition: CameraVector3): Promise<ThreeRuntimeTick> {
    if (this.disposed) throw new Error('ThreeRuntime is disposed')
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError('deltaSeconds must be a finite non-negative number')
    }

    this.gamepadInput.poll()
    const input = this.input.snapshot()
    this.cameraController.orbitBy(input.axes.lookX * deltaSeconds + input.pointerDelta.x, input.axes.lookY * deltaSeconds + input.pointerDelta.y)
    this.cameraController.zoomBy(input.wheelDelta + (input.buttons.zoomOut.down ? deltaSeconds : 0) - (input.buttons.zoomIn.down ? deltaSeconds : 0))
    if (input.buttons.switchShoulder.pressed) this.cameraController.toggleShoulder()
    if (input.buttons.recenterCamera.pressed) this.cameraController.recenter(0)

    this.cameraController.setTarget(playerPosition)
    this.cameraController.update(deltaSeconds)
    this.environment.update({ deltaTicks: deltaSeconds })
    this.environment.applyExposure(this.renderer)
    const world = await this.world.update(this.worldPosition(playerPosition))
    this.renderer.render(this.scene, this.camera)
    return Object.freeze({ input, world })
  }

  resize(width = this.options.canvas.clientWidth, height = this.options.canvas.clientHeight): void {
    const resolvedWidth = resolveDimension(width)
    const resolvedHeight = resolveDimension(height)
    this.renderer.setSize(resolvedWidth, resolvedHeight, false)
    this.camera.aspect = resolvedWidth / resolvedHeight
    this.camera.updateProjectionMatrix()
  }

  async dispose(): Promise<void> {
    if (this.disposePromise) return this.disposePromise
    this.disposed = true
    this.disposePromise = this.disposeRuntime()
    return this.disposePromise
  }

  private createDefaultWorldSource(cellSize: number): WorldCellSource<LoadedThreeWorldCell> {
    return new ThreeWorldCellSource({
      scene: this.scene,
      collision: this.collision,
      assets: this.assets,
      cellSize,
      buildCell: this.options.buildCell,
    })
  }

  private worldPosition(position: CameraVector3): WorldXZ {
    return { x: position.x, z: position.z }
  }

  private async disposeRuntime(): Promise<void> {
    this.domInput.dispose()
    this.gamepadInput.dispose()
    let failure: unknown
    try {
      await this.world.dispose()
    } catch (error) {
      failure = error
    }
    this.environment.dispose()
    this.collision.clearStaticColliders()
    if (this.ownsAssets) this.assets.clearUnused()
    this.renderer.dispose()
    if (failure !== undefined) throw failure
  }
}

export function createThreeRuntime(options: ThreeRuntimeOptions): ThreeRuntime {
  return new ThreeRuntime(options)
}
