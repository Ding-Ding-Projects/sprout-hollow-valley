import {
  compareWorldCellDescriptors,
  planWorldCells,
  validateWorldCellPlanOptions,
  type WorldCellDescriptor,
  type WorldCellKey,
  type WorldCellPlanOptions,
  type WorldXZ,
} from './cells'

export interface WorldCellSource<T> {
  load(descriptor: WorldCellDescriptor, signal: AbortSignal): Promise<T>
  unload?(cell: LoadedWorldCell<T>): void | Promise<void>
}

export interface LoadedWorldCell<T> {
  readonly descriptor: WorldCellDescriptor
  readonly data: T
}

export interface WorldCellStreamerOptions extends WorldCellPlanOptions {
  readonly maxConcurrentLoads?: number
}

export interface WorldCellFailure {
  readonly phase: 'load' | 'unload'
  readonly descriptor: WorldCellDescriptor
  readonly error: unknown
}

export interface WorldCellUpdate<T> {
  readonly center: WorldCellDescriptor['coordinate']
  readonly loaded: readonly LoadedWorldCell<T>[]
  readonly retained: readonly LoadedWorldCell<T>[]
  readonly unloaded: readonly WorldCellKey[]
  readonly failures: readonly WorldCellFailure[]
  readonly residentCount: number
}

interface CellLoadSuccess<T> {
  readonly succeeded: true
  readonly descriptor: WorldCellDescriptor
  readonly data: T
}

interface CellLoadFailure {
  readonly succeeded: false
  readonly descriptor: WorldCellDescriptor
  readonly error: unknown
}

type CellLoadResult<T> = CellLoadSuccess<T> | CellLoadFailure

function requireConcurrency(value: number | undefined): number {
  const normalized = value ?? 4
  if (!Number.isSafeInteger(normalized) || normalized < 1) {
    throw new RangeError('maxConcurrentLoads must be a positive integer')
  }
  return normalized
}

export class WorldCellDisposalError extends Error {
  readonly failures: readonly WorldCellFailure[]

  constructor(failures: readonly WorldCellFailure[]) {
    super(`Failed to unload ${failures.length} world cell${failures.length === 1 ? '' : 's'}`)
    this.name = 'WorldCellDisposalError'
    this.failures = failures
  }
}

export class WorldCellStreamer<T> {
  readonly #source: WorldCellSource<T>
  readonly #options: WorldCellStreamerOptions
  readonly #maxConcurrentLoads: number
  readonly #resident = new Map<WorldCellKey, LoadedWorldCell<T>>()
  readonly #abortController = new AbortController()
  #tail: Promise<void> = Promise.resolve()
  #disposePromise: Promise<void> | undefined
  #disposed = false

  constructor(source: WorldCellSource<T>, options: WorldCellStreamerOptions) {
    this.#source = source
    this.#options = { ...options }
    this.#maxConcurrentLoads = requireConcurrency(options.maxConcurrentLoads)
    validateWorldCellPlanOptions(options)
  }

  get residentCount(): number {
    return this.#resident.size
  }

  has(key: WorldCellKey): boolean {
    return this.#resident.has(key)
  }

  get(key: WorldCellKey): LoadedWorldCell<T> | undefined {
    return this.#resident.get(key)
  }

  snapshot(): readonly LoadedWorldCell<T>[] {
    return [...this.#resident.values()].sort((left, right) =>
      compareWorldCellDescriptors(left.descriptor, right.descriptor),
    )
  }

  /** Updates are serialized so asynchronous completion order cannot alter resident order. */
  update(position: WorldXZ): Promise<WorldCellUpdate<T>> {
    if (this.#disposed) return Promise.reject(new Error('WorldCellStreamer is disposed'))
    const requestedPosition = { x: position.x, z: position.z }
    const run = this.#tail.then(() => this.#performUpdate(requestedPosition))
    this.#tail = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  dispose(): Promise<void> {
    if (this.#disposePromise) return this.#disposePromise
    this.#disposed = true
    this.#abortController.abort()
    this.#disposePromise = this.#finishDispose()
    return this.#disposePromise
  }

  async #finishDispose(): Promise<void> {
    await this.#tail
    const cells = this.snapshot().reverse()
    this.#resident.clear()
    if (!this.#source.unload) return
    const failures: WorldCellFailure[] = []
    for (const cell of cells) {
      try {
        await this.#source.unload(cell)
      } catch (error) {
        failures.push({ phase: 'unload', descriptor: cell.descriptor, error })
      }
    }
    if (failures.length > 0) throw new WorldCellDisposalError(failures)
  }

  async #performUpdate(position: WorldXZ): Promise<WorldCellUpdate<T>> {
    if (this.#disposed) throw new Error('WorldCellStreamer is disposed')
    const plan = planWorldCells(position, this.#options, this.#resident.keys())
    const failures: WorldCellFailure[] = []
    const unloaded: WorldCellKey[] = []

    const retained: LoadedWorldCell<T>[] = []
    for (const descriptor of plan.retain) {
      const cell = this.#resident.get(descriptor.key)
      if (!cell) continue
      const refreshed = { descriptor, data: cell.data }
      this.#resident.set(descriptor.key, refreshed)
      retained.push(refreshed)
    }

    for (const key of plan.unload) {
      const cell = this.#resident.get(key)
      if (!cell) continue
      this.#resident.delete(key)
      unloaded.push(key)
      try {
        await this.#source.unload?.(cell)
      } catch (error) {
        failures.push({ phase: 'unload', descriptor: cell.descriptor, error })
      }
    }

    const results = await this.#loadCells(plan.load)
    const loaded: LoadedWorldCell<T>[] = []
    for (const result of results) {
      if (!result.succeeded) {
        failures.push({ phase: 'load', descriptor: result.descriptor, error: result.error })
        continue
      }
      const cell = { descriptor: result.descriptor, data: result.data }
      this.#resident.set(result.descriptor.key, cell)
      loaded.push(cell)
    }

    return {
      center: plan.center,
      loaded,
      retained,
      unloaded,
      failures,
      residentCount: this.#resident.size,
    }
  }

  async #loadCells(descriptors: readonly WorldCellDescriptor[]): Promise<CellLoadResult<T>[]> {
    const results = new Array<CellLoadResult<T>>(descriptors.length)
    let cursor = 0
    const worker = async (): Promise<void> => {
      while (cursor < descriptors.length) {
        const index = cursor
        cursor += 1
        const descriptor = descriptors[index]
        try {
          const data = await this.#source.load(descriptor, this.#abortController.signal)
          results[index] = { succeeded: true, descriptor, data }
        } catch (error) {
          results[index] = { succeeded: false, descriptor, error }
        }
      }
    }
    const workerCount = Math.min(this.#maxConcurrentLoads, descriptors.length)
    await Promise.all(Array.from({ length: workerCount }, () => worker()))
    return results
  }
}
