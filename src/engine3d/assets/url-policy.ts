import type { BundledAssetUrl } from './types'

const BUNDLE_ORIGIN = 'https://sprout-hollow.invalid/'
export const BUNDLED_ASSET_ROOT = 'assets/3d/core/' as const
const URI_SCHEME = /^[a-z][a-z\d+.-]*:/i
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/

export class InvalidBundledAssetUrlError extends Error {
  readonly url: string

  constructor(url: string, reason: string) {
    super(`Asset URL must refer to a bundled local file: ${reason}`)
    this.name = 'InvalidBundledAssetUrlError'
    this.url = url
  }
}

function decodedPath(path: string, original: string): string {
  let decoded = path
  for (let pass = 0; pass < 3; pass += 1) {
    let next: string
    try {
      next = decodeURIComponent(decoded)
    } catch {
      throw new InvalidBundledAssetUrlError(original, 'the path has invalid percent encoding')
    }
    if (next === decoded) return decoded
    decoded = next
  }
  return decoded
}

/**
 * Validates a descriptor URL without touching the filesystem or network.
 *
 * Descriptors use logical package paths under `assets/3d/core/`; a renderer adapter maps
 * those keys to build-generated URLs. Schemes, authorities, absolute paths, path traversal,
 * control characters and Windows-style separators are rejected.
 */
export function toBundledAssetUrl(url: string): BundledAssetUrl {
  if (url.length === 0) throw new InvalidBundledAssetUrlError(url, 'the value is empty')
  if (url !== url.trim()) {
    throw new InvalidBundledAssetUrlError(url, 'leading or trailing whitespace is not allowed')
  }
  if (CONTROL_CHARACTER.test(url)) {
    throw new InvalidBundledAssetUrlError(url, 'control characters are not allowed')
  }
  if (url.includes('\\')) {
    throw new InvalidBundledAssetUrlError(url, 'backslash separators are not allowed')
  }
  if (URI_SCHEME.test(url)) {
    throw new InvalidBundledAssetUrlError(url, 'URI schemes are not allowed')
  }
  if (url.startsWith('//')) {
    throw new InvalidBundledAssetUrlError(url, 'network-path references are not allowed')
  }
  if (url.startsWith('/')) {
    throw new InvalidBundledAssetUrlError(url, 'absolute paths are not allowed')
  }
  if (url.includes('?') || url.includes('#')) {
    throw new InvalidBundledAssetUrlError(url, 'queries and fragments are not allowed')
  }
  if (url.includes('%')) {
    throw new InvalidBundledAssetUrlError(url, 'percent escapes are not allowed')
  }
  if (!url.startsWith(BUNDLED_ASSET_ROOT)) {
    throw new InvalidBundledAssetUrlError(url, `the path must start with ${BUNDLED_ASSET_ROOT}`)
  }

  let parsed: URL
  try {
    parsed = new URL(url, BUNDLE_ORIGIN)
  } catch {
    throw new InvalidBundledAssetUrlError(url, 'the value is not a valid relative URL')
  }

  if (parsed.origin !== new URL(BUNDLE_ORIGIN).origin) {
    throw new InvalidBundledAssetUrlError(url, 'the URL resolves outside the application bundle')
  }

  const path = decodedPath(url, url)
  if (path.length === 0 || path === '.' || path === '/') {
    throw new InvalidBundledAssetUrlError(url, 'a bundled file path is required')
  }
  if (CONTROL_CHARACTER.test(path) || path.includes('\\') || path.startsWith('//')) {
    throw new InvalidBundledAssetUrlError(url, 'the decoded path is not local')
  }
  const segments = path.split('/')
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new InvalidBundledAssetUrlError(url, 'empty or relative path segments are not allowed')
  }

  return url as BundledAssetUrl
}

export function isBundledAssetUrl(url: string): url is BundledAssetUrl {
  try {
    toBundledAssetUrl(url)
    return true
  } catch {
    return false
  }
}
