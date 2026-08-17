import type { ReadonlyVector2 } from './types'

function assertDeadZone(deadZone: number): void {
  if (!Number.isFinite(deadZone) || deadZone < 0 || deadZone >= 1) {
    throw new RangeError('gamepad dead zone must be a finite number from 0 (inclusive) to 1')
  }
}

function finiteAxis(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(-1, Math.min(1, value))
}

function cleanZero(value: number): number {
  return Object.is(value, -0) ? 0 : value
}

/**
 * Removes an axial dead zone and rescales the remaining travel back to the full range.
 */
export function normalizeGamepadAxis(value: number, deadZone: number): number {
  assertDeadZone(deadZone)
  const axis = finiteAxis(value)
  const magnitude = Math.abs(axis)
  if (magnitude <= deadZone) return 0
  return cleanZero(Math.sign(axis) * ((magnitude - deadZone) / (1 - deadZone)))
}

/**
 * Applies a circular dead zone while preserving stick direction and full outer travel.
 * Values outside the physical unit circle are projected onto it deterministically.
 */
export function normalizeGamepadStick(
  rawX: number,
  rawY: number,
  deadZone: number,
): ReadonlyVector2 {
  assertDeadZone(deadZone)
  const x = finiteAxis(rawX)
  const y = finiteAxis(rawY)
  const rawMagnitude = Math.hypot(x, y)
  if (rawMagnitude === 0) return { x: 0, y: 0 }

  const magnitude = Math.min(1, rawMagnitude)
  if (magnitude <= deadZone) return { x: 0, y: 0 }

  const normalizedMagnitude = (magnitude - deadZone) / (1 - deadZone)
  return {
    x: cleanZero((x / rawMagnitude) * normalizedMagnitude),
    y: cleanZero((y / rawMagnitude) * normalizedMagnitude),
  }
}
