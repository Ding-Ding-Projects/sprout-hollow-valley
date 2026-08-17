import { Group, Scene } from 'three'
import type { EnvironmentFrame } from './types'

export type WeatherHookPhase = 'attach' | 'update' | 'detach'

export interface WeatherHookContext {
  /** A hook-owned scene group. The registry removes and clears it on detach. */
  readonly layer: Group
  readonly frame: EnvironmentFrame
}

export interface WeatherHookDefinition {
  readonly id: string
  /** Lower values run first. Equal values are ordered by id. */
  readonly order?: number
  readonly enabled?: boolean
  /** Required declaration: weather effects may reference bundled registry ids only. */
  readonly bundled: true
  /** Local asset-registry ids, never URLs or filesystem paths. */
  readonly assetIds?: readonly string[]
  readonly attach?: (context: WeatherHookContext) => void
  readonly update?: (context: WeatherHookContext) => void
  readonly detach?: (context: WeatherHookContext) => void
}

export interface WeatherHookError {
  readonly hookId: string
  readonly phase: WeatherHookPhase
  readonly tick: number
  readonly message: string
}

export interface WeatherHookStatus {
  readonly id: string
  readonly order: number
  readonly enabled: boolean
  readonly attached: boolean
}

export interface WeatherHookRegistryOptions {
  readonly onError?: (error: WeatherHookError) => void
}

export interface WeatherHookAttachContext {
  readonly scene: Scene
  readonly frame: EnvironmentFrame
}

interface WeatherHookRecord {
  readonly definition: WeatherHookDefinition
  readonly layer: Group
  enabled: boolean
  attached: boolean
}

const HOOK_ID = /^[a-z][a-z0-9._-]*$/
const ASSET_ID = /^[a-z0-9][a-z0-9._/-]*$/

function hookOrder(record: WeatherHookRecord): number {
  return record.definition.order ?? 0
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** A local registry id cannot contain traversal segments, a URL scheme, or a root path. */
export function isBundledAssetId(value: string): boolean {
  return ASSET_ID.test(value) &&
    !value.includes('://') &&
    !value.startsWith('/') &&
    !value.split('/').includes('..')
}

/**
 * Owns weather-effect hook ordering and lifecycle. Each callback is isolated so one
 * broken effect cannot prevent later effects or core lighting from updating.
 */
export class WeatherHookRegistry {
  readonly root = new Group()

  private readonly records = new Map<string, WeatherHookRecord>()
  private readonly failures: WeatherHookError[] = []
  private readonly onError: ((error: WeatherHookError) => void) | undefined
  private attachedScene: Scene | undefined
  private currentFrame: EnvironmentFrame | undefined

  constructor(options: WeatherHookRegistryOptions = {}) {
    this.root.name = 'environment-weather-hooks'
    this.onError = options.onError
  }

  register(definition: WeatherHookDefinition): () => void {
    this.validateDefinition(definition)
    if (this.records.has(definition.id)) {
      throw new Error(`Weather hook already registered: ${definition.id}`)
    }

    const layer = new Group()
    layer.name = `weather-hook:${definition.id}`
    const record: WeatherHookRecord = {
      definition,
      layer,
      enabled: definition.enabled ?? true,
      attached: false,
    }
    this.records.set(definition.id, record)
    if (this.attachedScene && this.currentFrame && record.enabled) {
      this.activate(record, this.currentFrame)
      this.syncLayerOrder()
    }
    return () => this.unregister(definition.id)
  }

  unregister(id: string): boolean {
    const record = this.records.get(id)
    if (!record) return false
    if (record.attached && this.currentFrame) this.deactivate(record, this.currentFrame)
    this.records.delete(id)
    this.syncLayerOrder()
    return true
  }

  attach(context: WeatherHookAttachContext): void {
    if (this.attachedScene === context.scene) {
      this.currentFrame = context.frame
      return
    }
    this.detach()
    this.attachedScene = context.scene
    this.currentFrame = context.frame
    context.scene.add(this.root)
    for (const record of this.orderedRecords()) {
      if (record.enabled) this.activate(record, context.frame)
    }
    this.syncLayerOrder()
  }

  update(frame: EnvironmentFrame): void {
    this.currentFrame = frame
    if (!this.attachedScene) return
    for (const record of this.orderedRecords()) {
      if (!record.enabled || !record.attached || !record.definition.update) continue
      this.invoke(record, 'update', frame, record.definition.update)
    }
  }

  setEnabled(id: string, enabled: boolean): boolean {
    const record = this.records.get(id)
    if (!record) return false
    if (record.enabled === enabled) return true
    record.enabled = enabled
    if (this.attachedScene && this.currentFrame) {
      if (enabled) this.activate(record, this.currentFrame)
      else if (record.attached) this.deactivate(record, this.currentFrame)
      this.syncLayerOrder()
    }
    return true
  }

  isEnabled(id: string): boolean | undefined {
    return this.records.get(id)?.enabled
  }

  list(): readonly WeatherHookStatus[] {
    return this.orderedRecords().map((record) => ({
      id: record.definition.id,
      order: hookOrder(record),
      enabled: record.enabled,
      attached: record.attached,
    }))
  }

  errors(): readonly WeatherHookError[] {
    return this.failures.map((failure) => ({ ...failure }))
  }

  drainErrors(): readonly WeatherHookError[] {
    const errors = this.errors()
    this.failures.length = 0
    return errors
  }

  detach(): void {
    if (!this.attachedScene) return
    const frame = this.currentFrame
    if (frame) {
      for (const record of [...this.orderedRecords()].reverse()) {
        if (record.attached) this.deactivate(record, frame)
      }
    }
    this.attachedScene.remove(this.root)
    this.attachedScene = undefined
    this.root.clear()
  }

  private orderedRecords(): WeatherHookRecord[] {
    return [...this.records.values()].sort((left, right) => {
      const orderDifference = hookOrder(left) - hookOrder(right)
      if (orderDifference !== 0) return orderDifference
      return left.definition.id < right.definition.id
        ? -1
        : left.definition.id > right.definition.id
          ? 1
          : 0
    })
  }

  private validateDefinition(definition: WeatherHookDefinition): void {
    if (!HOOK_ID.test(definition.id)) {
      throw new Error(`Invalid weather hook id: ${definition.id}`)
    }
    if (definition.bundled !== true) {
      throw new Error(`Weather hook ${definition.id} must declare bundled: true`)
    }
    const order = definition.order ?? 0
    if (!Number.isFinite(order)) throw new Error(`Weather hook ${definition.id} has invalid order`)
    for (const assetId of definition.assetIds ?? []) {
      if (!isBundledAssetId(assetId)) {
        throw new Error(`Weather hook ${definition.id} has non-bundled asset id: ${assetId}`)
      }
    }
  }

  private activate(record: WeatherHookRecord, frame: EnvironmentFrame): void {
    if (record.attached) return
    this.root.add(record.layer)
    if (record.definition.attach && !this.invoke(record, 'attach', frame, record.definition.attach)) {
      this.root.remove(record.layer)
      record.layer.clear()
      return
    }
    record.attached = true
  }

  private deactivate(record: WeatherHookRecord, frame: EnvironmentFrame): void {
    if (!record.attached) return
    if (record.definition.detach) {
      this.invoke(record, 'detach', frame, record.definition.detach)
    }
    record.attached = false
    this.root.remove(record.layer)
    record.layer.clear()
  }

  private syncLayerOrder(): void {
    const layers = this.orderedRecords()
      .filter((record) => record.attached)
      .map((record) => record.layer)
    this.root.clear()
    this.root.add(...layers)
  }

  private invoke(
    record: WeatherHookRecord,
    phase: WeatherHookPhase,
    frame: EnvironmentFrame,
    callback: (context: WeatherHookContext) => void,
  ): boolean {
    try {
      callback({ layer: record.layer, frame })
      return true
    } catch (error) {
      const failure: WeatherHookError = {
        hookId: record.definition.id,
        phase,
        tick: frame.tick,
        message: errorMessage(error),
      }
      this.failures.push(failure)
      try {
        this.onError?.(failure)
      } catch {
        // Error reporting is isolated from both the registry and the next hook.
      }
      return false
    }
  }
}
