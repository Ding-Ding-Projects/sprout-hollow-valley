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
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
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
  AUTHORED_VALLEY_CELL_SIZE,
  buildAuthoredValleyWorldCell,
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
    cellSize: AUTHORED_VALLEY_CELL_SIZE,
    loadRadius: 1,
  })

const DEFAULT_PLAYER = Object.freeze({
  spawn: Object.freeze({ x: 8, y: 0, z: 8 }),
  walkSpeed: 4.2,
  sprintSpeed: 7,
  jumpVelocity: 5.4,
  gravity: 16,
  radius: 0.34,
  height: 1.72,
})

const POINTER_ORBIT_SCALE = 0.0025
const KEYBOARD_AND_GAMEPAD_ORBIT_SPEED = 2.2
const WHEEL_ZOOM_SCALE = 0.01

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
  readonly player?: {
    readonly spawn?: CameraVector3
    readonly walkSpeed?: number
    readonly sprintSpeed?: number
    readonly jumpVelocity?: number
    readonly gravity?: number
  }
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

function positiveOption(value: number | undefined, fallback: number, label: string): number {
  const resolved = value ?? fallback
  if (!Number.isFinite(resolved) || resolved <= 0) {
    throw new RangeError(`${label} must be a finite positive number`)
  }
  return resolved
}

function finitePosition(position: CameraVector3): Vector3 {
  if (![position.x, position.y, position.z].every(Number.isFinite)) {
    throw new RangeError('player spawn must contain finite coordinates')
  }
  return new Vector3(position.x, Math.max(0, position.y), position.z)
}

function createPlayerVisual(): {
  readonly root: Group
  readonly shadow: Mesh
  readonly dispose: () => void
} {
  const root = new Group()
  root.name = 'player-avatar'

  const bodyGeometry = new CylinderGeometry(0.38, 0.44, 0.82, 7)
  const limbGeometry = new CylinderGeometry(0.12, 0.12, 0.58, 6)
  const faceGeometry = new BoxGeometry(0.18, 0.18, 0.16)
  const shadowGeometry = new CircleGeometry(0.48, 16)
  const hatGeometry = new ConeGeometry(0.48, 0.26, 8)
  const headGeometry = new CylinderGeometry(0.29, 0.31, 0.48, 8)
  const geometries = [
    bodyGeometry,
    limbGeometry,
    faceGeometry,
    shadowGeometry,
    hatGeometry,
    headGeometry,
  ]
  const materials = [
    new MeshStandardMaterial({ color: 0x3f7d45, roughness: 0.86, flatShading: true }),
    new MeshStandardMaterial({ color: 0xe6b98b, roughness: 0.9, flatShading: true }),
    new MeshStandardMaterial({ color: 0x5b3a29, roughness: 0.94, flatShading: true }),
    new MeshStandardMaterial({ color: 0xe8c66e, roughness: 0.9, flatShading: true }),
    new MeshStandardMaterial({ color: 0x17251a, transparent: true, opacity: 0.24, depthWrite: false }),
  ]
  const [overallMaterial, skinMaterial, bootMaterial, hatMaterial, shadowMaterial] = materials

  const body = new Mesh(bodyGeometry, overallMaterial)
  body.name = 'player-body'
  body.position.y = 0.98

  const head = new Mesh(headGeometry, skinMaterial)
  head.name = 'player-head'
  head.position.y = 1.61

  const hat = new Mesh(hatGeometry, hatMaterial)
  hat.name = 'player-hat'
  hat.position.y = 1.98

  const face = new Mesh(faceGeometry, bootMaterial)
  face.name = 'player-facing-marker'
  face.scale.set(0.72, 0.5, 0.48)
  face.position.set(0, 1.62, 0.3)

  const leftLeg = new Mesh(limbGeometry, bootMaterial)
  leftLeg.name = 'player-left-leg'
  leftLeg.position.set(-0.18, 0.33, 0)
  const rightLeg = new Mesh(limbGeometry, bootMaterial)
  rightLeg.name = 'player-right-leg'
  rightLeg.position.set(0.18, 0.33, 0)

  for (const mesh of [body, head, hat, face, leftLeg, rightLeg]) {
    mesh.castShadow = true
    mesh.receiveShadow = true
    root.add(mesh)
  }

  const shadow = new Mesh(shadowGeometry, shadowMaterial)
  shadow.name = 'player-ground-shadow'
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.018
  shadow.renderOrder = 1

  return {
    root,
    shadow,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose()
      for (const material of materials) material.dispose()
    },
  }
}

/**
 * Small explicit Three.js composition root. It owns the default third-person player but no
 * animation loop or wall-clock; the Farm surface drives every frame explicitly.
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
  readonly playerPosition: Vector3
  readonly playerAvatar: Group

  private readonly ownsAssets: boolean
  private readonly playerShadow: Mesh
  private readonly disposePlayerVisual: () => void
  private readonly playerWalkSpeed: number
  private readonly playerSprintSpeed: number
  private readonly playerJumpVelocity: number
  private readonly playerGravity: number
  private playerVerticalVelocity = 0
  private playerGrounded = true
  private playerGroundHeight = 0
  private playerFacing = Math.PI
  private worldVisible = true
  private requestedEnvironment: EnvironmentSeedState | null = null
  private disposed = false
  private disposePromise: Promise<void> | undefined

  constructor(private readonly options: ThreeRuntimeOptions) {
    const worldOptions: WorldCellStreamerOptions = {
      ...DEFAULT_WORLD,
      ...options.world,
    }
    this.renderer = new WebGLRenderer({ antialias: true, ...options.renderer, canvas: options.canvas })
    this.renderer.shadowMap.enabled = true
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

    this.playerPosition = finitePosition(options.player?.spawn ?? DEFAULT_PLAYER.spawn)
    this.playerGroundHeight = this.playerPosition.y
    this.playerWalkSpeed = positiveOption(
      options.player?.walkSpeed,
      DEFAULT_PLAYER.walkSpeed,
      'player walk speed',
    )
    this.playerSprintSpeed = positiveOption(
      options.player?.sprintSpeed,
      DEFAULT_PLAYER.sprintSpeed,
      'player sprint speed',
    )
    this.playerJumpVelocity = positiveOption(
      options.player?.jumpVelocity,
      DEFAULT_PLAYER.jumpVelocity,
      'player jump velocity',
    )
    this.playerGravity = positiveOption(
      options.player?.gravity,
      DEFAULT_PLAYER.gravity,
      'player gravity',
    )
    const playerVisual = createPlayerVisual()
    this.playerAvatar = playerVisual.root
    this.playerShadow = playerVisual.shadow
    this.disposePlayerVisual = playerVisual.dispose
    this.scene.add(this.playerShadow, this.playerAvatar)
    this.syncPlayerVisual()

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
    this.assertTick(deltaSeconds)
    const input = this.captureInput()
    this.applyCameraInput(deltaSeconds, input, 0)
    return this.renderFrame(deltaSeconds, playerPosition, input)
  }

  /** Advance the built-in controllable player and render it in the streamed world. */
  async tickPlayer(deltaSeconds: number): Promise<ThreeRuntimeTick> {
    this.assertTick(deltaSeconds)
    const input = this.captureInput()
    this.applyCameraInput(deltaSeconds, input, this.playerFacing - Math.PI)
    this.movePlayer(deltaSeconds, input)
    return this.renderFrame(deltaSeconds, this.playerPosition, input)
  }

  /** Drop held and transient input when the shell suspends the Farm tab. */
  clearInput(): void {
    this.input.clear()
  }

  /** Current player yaw, exposed so the canonical save can retain its four-way facing. */
  get playerYaw(): number {
    return this.playerFacing
  }

  /**
   * Places the controllable actor at a deterministic exterior or interior arrival point.
   * The supplied Y coordinate also becomes the local walkable ground until the next pose.
   */
  setPlayerPose(position: CameraVector3, facingRadians = this.playerFacing): void {
    if (this.disposed) throw new Error('ThreeRuntime is disposed')
    const next = finitePosition(position)
    if (!Number.isFinite(facingRadians)) throw new RangeError('player facing must be finite')
    this.playerPosition.copy(next)
    this.playerGroundHeight = next.y
    this.playerFacing = facingRadians
    this.playerVerticalVelocity = 0
    this.playerGrounded = true
    this.syncPlayerVisual()
    this.cameraController.setTarget(this.playerPosition)
  }

  /** Hides only streamed exterior cells while a separately mounted interior is active. */
  setWorldVisible(visible: boolean): void {
    this.worldVisible = visible
    this.syncWorldVisibility()
  }

  /** Retargets lighting from canonical game state without letting rendering own the clock. */
  syncEnvironment(state: EnvironmentSeedState): void {
    this.requestedEnvironment = Object.freeze({ ...state })
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
      buildCell: this.options.buildCell ?? buildAuthoredValleyWorldCell,
    })
  }

  private worldPosition(position: CameraVector3): WorldXZ {
    return { x: position.x, z: position.z }
  }

  private assertTick(deltaSeconds: number): void {
    if (this.disposed) throw new Error('ThreeRuntime is disposed')
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError('deltaSeconds must be a finite non-negative number')
    }
  }

  private captureInput(): InputSnapshot {
    this.gamepadInput.poll()
    return this.input.snapshot()
  }

  private applyCameraInput(
    deltaSeconds: number,
    input: InputSnapshot,
    recenterYaw: number,
  ): void {
    this.cameraController.orbitBy(
      input.axes.lookX * deltaSeconds * KEYBOARD_AND_GAMEPAD_ORBIT_SPEED +
        input.pointerDelta.x * POINTER_ORBIT_SCALE,
      input.axes.lookY * deltaSeconds * KEYBOARD_AND_GAMEPAD_ORBIT_SPEED +
        input.pointerDelta.y * POINTER_ORBIT_SCALE,
    )
    this.cameraController.zoomBy(
      input.wheelDelta * WHEEL_ZOOM_SCALE +
        (input.buttons.zoomOut.down ? deltaSeconds : 0) -
        (input.buttons.zoomIn.down ? deltaSeconds : 0),
    )
    if (input.buttons.switchShoulder.pressed) this.cameraController.toggleShoulder()
    if (input.buttons.recenterCamera.pressed) this.cameraController.recenter(recenterYaw)
  }

  private movePlayer(deltaSeconds: number, input: InputSnapshot): void {
    if (input.buttons.jump.pressed && this.playerGrounded) {
      this.playerGrounded = false
      this.playerVerticalVelocity = this.playerJumpVelocity
    }

    if (!this.playerGrounded || this.playerVerticalVelocity !== 0) {
      this.playerVerticalVelocity -= this.playerGravity * deltaSeconds
      this.playerPosition.y += this.playerVerticalVelocity * deltaSeconds
      if (this.playerPosition.y <= this.playerGroundHeight) {
        this.playerPosition.y = this.playerGroundHeight
        this.playerVerticalVelocity = 0
        this.playerGrounded = true
      }
    }

    const yaw = this.cameraController.state.desiredYaw
    const rightX = Math.cos(yaw)
    const rightZ = -Math.sin(yaw)
    const forwardX = -Math.sin(yaw)
    const forwardZ = -Math.cos(yaw)
    const moveX = rightX * input.axes.moveX + forwardX * input.axes.moveY
    const moveZ = rightZ * input.axes.moveX + forwardZ * input.axes.moveY
    const magnitude = Math.hypot(moveX, moveZ)
    const normalX = magnitude > 1 ? moveX / magnitude : moveX
    const normalZ = magnitude > 1 ? moveZ / magnitude : moveZ
    const speed = input.buttons.sprint.down ? this.playerSprintSpeed : this.playerWalkSpeed
    const moved = this.collision.moveHorizontal(
      {
        position: this.playerPosition,
        radius: DEFAULT_PLAYER.radius,
        height: DEFAULT_PLAYER.height,
      },
      { x: normalX * speed * deltaSeconds, z: normalZ * speed * deltaSeconds },
    )
    this.playerPosition.x = moved.position.x
    this.playerPosition.z = moved.position.z

    if (Math.hypot(moved.applied.x, moved.applied.z) > 1e-5) {
      this.playerFacing = Math.atan2(moved.applied.x, moved.applied.z)
    }
    this.syncPlayerVisual()
  }

  private syncPlayerVisual(): void {
    this.playerAvatar.position.copy(this.playerPosition)
    this.playerAvatar.rotation.y = this.playerFacing
    this.playerShadow.position.x = this.playerPosition.x
    this.playerShadow.position.z = this.playerPosition.z
    const airborneScale = Math.max(0.55, 1 - this.playerPosition.y * 0.12)
    this.playerShadow.scale.setScalar(airborneScale)
  }

  private async renderFrame(
    deltaSeconds: number,
    playerPosition: CameraVector3,
    input: InputSnapshot,
  ): Promise<ThreeRuntimeTick> {
    this.cameraController.setTarget(playerPosition)
    this.cameraController.update(deltaSeconds)
    const requested = this.requestedEnvironment
    this.environment.update(
      requested === null
        ? { deltaTicks: deltaSeconds }
        : {
            deltaTicks: deltaSeconds,
            minuteOfDay: requested.minuteOfDay,
            season: requested.season,
            weather: requested.weather,
          },
    )
    this.environment.applyExposure(this.renderer)
    const world = await this.world.update(this.worldPosition(playerPosition))
    if (this.disposed) throw new Error('ThreeRuntime is disposed')
    this.syncWorldVisibility()
    this.renderer.render(this.scene, this.camera)
    return Object.freeze({ input, world })
  }

  private syncWorldVisibility(): void {
    for (const child of this.scene.children) {
      if (
        child.name.startsWith('authored-valley-cell:') ||
        child.name.startsWith('world-cell:')
      ) {
        child.visible = this.worldVisible
      }
    }
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
    this.scene.remove(this.playerAvatar, this.playerShadow)
    this.disposePlayerVisual()
    if (this.ownsAssets) this.assets.clearUnused()
    this.renderer.dispose()
    if (failure !== undefined) throw failure
  }
}

export function createThreeRuntime(options: ThreeRuntimeOptions): ThreeRuntime {
  return new ThreeRuntime(options)
}
