/**
 * Progressive enhancements for the Sprout Hollow Valley landing page.
 *
 * English content and direct repository/release links remain useful without
 * scripting. This module adds a local language preference, local section
 * search, optional regular-expression matching, and release metadata from the
 * public GitHub API.
 */

type LanguageMode = 'en' | 'yue' | 'bi'

const REPOSITORY = 'Ding-Ding-Projects/sprout-hollow-valley'
const LANGUAGE_STORAGE_KEY = 'sprout-hollow-valley.site.language-mode.v1'

const TITLES = {
  en: 'Sprout Hollow Valley — a low-poly 3D farming life simulation',
  yue: 'Sprout Hollow Valley — 低多邊形 3D 農莊生活模擬',
} as const

const DESCRIPTIONS = {
  en: 'Sprout Hollow Valley is a Windows-only third-person low-poly 3D farming life simulation set in one authored open world.',
  yue: '《Sprout Hollow Valley》係 Windows 專屬第三身低多邊形 3D 農莊生活模擬，舞台係一個精心設計嘅開放山谷。',
} as const

let languageMode: LanguageMode = readStoredLanguage()

function isLanguageMode(value: string | null): value is LanguageMode {
  return value === 'en' || value === 'yue' || value === 'bi'
}

function readStoredLanguage(): LanguageMode {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return isLanguageMode(stored) ? stored : 'en'
  } catch {
    return 'en'
  }
}

function rememberLanguage(mode: LanguageMode): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, mode)
  } catch {
    // A private or restricted browser can decline storage. The active page
    // still changes language for the rest of this visit.
  }
}

function localize(english: string, cantonese: string): string {
  if (languageMode === 'yue') return cantonese
  if (languageMode === 'bi') return english === cantonese ? english : `${english} ／ ${cantonese}`
  return english
}

function applyLanguage(mode: LanguageMode, announce = true): void {
  languageMode = mode
  document.documentElement.lang = mode === 'yue' ? 'yue-Hant-HK' : 'en'
  document.documentElement.dataset.language = mode

  for (const element of document.querySelectorAll<HTMLElement>('[data-copy-en][data-copy-yue]')) {
    const english = element.dataset.copyEn
    const cantonese = element.dataset.copyYue
    if (english && cantonese) element.textContent = localize(english, cantonese)
  }

  for (const element of document.querySelectorAll<HTMLElement>('[data-aria-en][data-aria-yue]')) {
    const english = element.dataset.ariaEn
    const cantonese = element.dataset.ariaYue
    if (english && cantonese) element.setAttribute('aria-label', localize(english, cantonese))
  }

  for (const element of document.querySelectorAll<HTMLInputElement>('[data-placeholder-en][data-placeholder-yue]')) {
    const english = element.dataset.placeholderEn
    const cantonese = element.dataset.placeholderYue
    if (english && cantonese) element.placeholder = localize(english, cantonese)
  }

  const selected = document.querySelector<HTMLInputElement>(
    `input[name="language-mode"][value="${mode}"]`,
  )
  if (selected) selected.checked = true

  document.title = localize(TITLES.en, TITLES.yue)
  const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
  if (description) description.content = localize(DESCRIPTIONS.en, DESCRIPTIONS.yue)

  renderReleaseStatus()
  renderPaletteResults()

  if (announce) {
    const status = document.getElementById('language-status')
    if (status) {
      const names: Record<LanguageMode, string> = {
        en: 'English',
        yue: '香港粵語',
        bi: 'English and 香港粵語',
      }
      status.textContent = localize(
        `Page language changed to ${names[mode]}.`,
        `網頁語言已轉做 ${names[mode]}。`,
      )
    }
  }
}

/* ---------------------------------------------------------------- release */

interface ReleaseAsset {
  name: string
  browser_download_url: string
  size: number
}

interface Release {
  tag_name: string
  published_at: string
  html_url: string
  assets: ReleaseAsset[]
}

type ReleaseState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'available'; release: Release; installer?: ReleaseAsset }

let releaseState: ReleaseState = { kind: 'loading' }

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function releaseDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return ''
  const locale = languageMode === 'yue' ? 'zh-HK' : 'en-CA'
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function renderReleaseStatus(): void {
  const status = document.getElementById('release-status')
  const detail = document.getElementById('download-detail')
  if (!status || !detail) return

  if (releaseState.kind === 'loading') {
    status.textContent = localize(
      'Checking GitHub for a published release. The button already points to the static latest-release page.',
      '而家正喺 GitHub 睇吓有冇已發佈版本；個按鈕本身已經直接指去最新版本頁。',
    )
    return
  }

  if (releaseState.kind === 'unavailable') {
    status.textContent = localize(
      'Release details could not be loaded. The button still opens the static latest-release page.',
      '暫時載入唔到版本資料；個按鈕仍然可以打開靜態最新版本頁。',
    )
    detail.textContent = localize(
      'Open the published release, if available',
      '如有已發佈版本，就會打開下載頁',
    )
    return
  }

  const { release, installer } = releaseState
  const published = releaseDate(release.published_at)
  const datePhrase = published
    ? localize(` published ${published}`, `喺 ${published} 發佈`)
    : ''

  if (installer) {
    status.textContent = localize(
      `${release.tag_name}${datePhrase}. GitHub lists a Windows installer.`,
      `${release.tag_name}${datePhrase}。GitHub 有列出 Windows 安裝程式。`,
    )
    detail.textContent = localize(
      `Windows installer — ${megabytes(installer.size)}`,
      `Windows 安裝程式 — ${megabytes(installer.size)}`,
    )
    return
  }

  status.textContent = localize(
    `${release.tag_name}${datePhrase}. No Windows installer is listed, so the button opens the release page.`,
    `${release.tag_name}${datePhrase}。暫時未見 Windows 安裝程式，所以按鈕會打開版本頁。`,
  )
  detail.textContent = localize('Open release details', '打開版本詳情')
}

async function loadLatestRelease(): Promise<void> {
  const download = document.getElementById('download-windows')

  try {
    const response = await fetch(
      `https://api.github.com/repos/${REPOSITORY}/releases/latest`,
      { headers: { Accept: 'application/vnd.github+json' } },
    )
    if (!response.ok) {
      releaseState = { kind: 'unavailable' }
      renderReleaseStatus()
      return
    }

    const release = (await response.json()) as Release
    const installer = release.assets.find(
      (asset) => asset.name.toLowerCase().endsWith('.exe') && asset.size > 0,
    )
    releaseState = { kind: 'available', release, installer }

    if (download instanceof HTMLAnchorElement) {
      download.href = installer?.browser_download_url || release.html_url
    }
  } catch {
    releaseState = { kind: 'unavailable' }
  }

  renderReleaseStatus()
}

/* -------------------------------------------------------- command palette */

interface CommandItem {
  id: string
  titleEn: string
  titleYue: string
  haystack: string
}

const palette = document.getElementById('command-palette')
const paletteQuery = document.getElementById('palette-query')
const paletteRegex = document.getElementById('palette-regex')
const paletteStatus = document.getElementById('palette-status')
const paletteResults = document.getElementById('palette-results')

function collectCommandItems(): CommandItem[] {
  const items: CommandItem[] = []

  for (const section of document.querySelectorAll<HTMLElement>('[data-command][id]')) {
    const titleEn = section.dataset.searchTitleEn
    const titleYue = section.dataset.searchTitleYue
    if (!titleEn || !titleYue) continue

    const localizedCopy = Array.from(
      section.querySelectorAll<HTMLElement>('[data-copy-en][data-copy-yue]'),
    ).flatMap((element) => [element.dataset.copyEn ?? '', element.dataset.copyYue ?? ''])

    items.push({
      id: section.id,
      titleEn,
      titleYue,
      haystack: [
        titleEn,
        titleYue,
        section.dataset.searchKeywords ?? '',
        ...localizedCopy,
      ].join(' '),
    })
  }

  return items
}

const commandItems = collectCommandItems()

function paletteMatches(): { items: CommandItem[]; invalidRegex: boolean } {
  if (!(paletteQuery instanceof HTMLInputElement) || !(paletteRegex instanceof HTMLInputElement)) {
    return { items: commandItems, invalidRegex: false }
  }

  const query = paletteQuery.value.trim()
  if (!query) return { items: commandItems, invalidRegex: false }

  if (paletteRegex.checked) {
    try {
      const expression = new RegExp(query, 'i')
      return {
        items: commandItems.filter((item) => expression.test(item.haystack)),
        invalidRegex: false,
      }
    } catch {
      return { items: [], invalidRegex: true }
    }
  }

  const needle = query.toLocaleLowerCase()
  return {
    items: commandItems.filter((item) => item.haystack.toLocaleLowerCase().includes(needle)),
    invalidRegex: false,
  }
}

function closePalette(): void {
  if (!(palette instanceof HTMLDialogElement)) return
  if (palette.open && typeof palette.close === 'function') palette.close()
  else palette.removeAttribute('open')
}

function renderPaletteResults(): void {
  if (!paletteStatus || !(paletteResults instanceof HTMLOListElement)) return
  const { items, invalidRegex } = paletteMatches()
  paletteResults.replaceChildren()

  if (invalidRegex) {
    paletteStatus.textContent = localize(
      'That regular expression is not valid. Edit it to continue searching this page.',
      '呢個正規表示式唔成立，改一改先可以繼續搜尋呢一頁。',
    )
    return
  }

  paletteStatus.textContent = localize(
    `${items.length} section${items.length === 1 ? '' : 's'} found. Search stays on this page.`,
    `搵到 ${items.length} 個章節。搜尋只會喺呢一頁進行。`,
  )

  for (const item of items) {
    const listItem = document.createElement('li')
    listItem.className = 'palette-result'

    const link = document.createElement('a')
    link.href = `#${item.id}`

    const title = document.createElement('strong')
    title.textContent = localize(item.titleEn, item.titleYue)

    const hint = document.createElement('span')
    hint.textContent = localize('Jump to section', '跳去章節')

    link.append(title, hint)
    link.addEventListener('click', () => {
      closePalette()
      window.requestAnimationFrame(() => {
        const target = document
          .getElementById(item.id)
          ?.querySelector<HTMLElement>('h2[tabindex="-1"]')
        target?.focus()
      })
    })

    listItem.append(link)
    paletteResults.append(listItem)
  }
}

function openPalette(): void {
  if (!(palette instanceof HTMLDialogElement)) return
  renderPaletteResults()

  if (typeof palette.showModal === 'function') palette.showModal()
  else palette.setAttribute('open', '')

  window.requestAnimationFrame(() => {
    if (paletteQuery instanceof HTMLInputElement) {
      paletteQuery.focus()
      paletteQuery.select()
    }
  })
}

document.getElementById('open-command-palette')?.addEventListener('click', openPalette)
document.getElementById('close-command-palette')?.addEventListener('click', closePalette)
paletteQuery?.addEventListener('input', renderPaletteResults)
paletteRegex?.addEventListener('change', renderPaletteResults)

palette?.addEventListener('click', (event) => {
  if (event.target === palette) closePalette()
})

document.addEventListener('keydown', (event) => {
  if (
    event.ctrlKey
    && event.shiftKey
    && !event.altKey
    && !event.metaKey
    && event.key.toLocaleLowerCase() === 'f'
  ) {
    event.preventDefault()
    openPalette()
  }
})

/* -------------------------------------------------------------------- boot */

const languageControl = document.getElementById('language-control')
if (languageControl instanceof HTMLFieldSetElement) {
  languageControl.disabled = false
  languageControl.addEventListener('change', (event) => {
    const input = event.target
    if (!(input instanceof HTMLInputElement) || !isLanguageMode(input.value)) return
    rememberLanguage(input.value)
    applyLanguage(input.value)
  })
}

for (const element of document.querySelectorAll<HTMLElement>('[data-js-only]')) {
  element.hidden = false
}

applyLanguage(languageMode, false)
void loadLatestRelease()
