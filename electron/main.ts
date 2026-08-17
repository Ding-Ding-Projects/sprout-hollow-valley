import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron'
import type { IpcMainInvokeEvent, WebContents } from 'electron'
import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { runCapture, wantsCapture } from './capture'
import {
  APP_ID,
  IPC_CHANNELS,
  PRODUCT_NAME,
  SAVE_FILENAME,
  USER_DATA_DIRECTORY_NAME,
} from './identity'

/** 4x the 320x224 logical framebuffer, and 2x as the floor. */
const WINDOW_W = 1280
const WINDOW_H = 896
const MIN_W = 640
const MIN_H = 448

/** PAL.ink — the letterbox colour, so the window never flashes white. */
const INK = '#1b1a24'

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
].join('; ')

// An installed build must never inherit a developer shell's server override.
const DEV_SERVER_URL = app.isPackaged ? '' : (process.env.VITE_DEV_SERVER_URL?.trim() ?? '')

let mainWindow: BrowserWindow | null = null
let fatalStartupReported = false

const STARTUP_LOG_FILENAME = 'startup.log'
const SQUIRREL_EXECUTABLE_NAME = 'SproutHollowValley.exe'
const SQUIRREL_QUIT_DEADLINE_MS = 1_000
const SQUIRREL_EVENTS = new Map<string, 'install' | 'updated' | 'uninstall' | 'obsolete'>([
  ['--squirrel-install', 'install'],
  ['--squirrel-updated', 'updated'],
  ['--squirrel-uninstall', 'uninstall'],
  ['--squirrel-obsolete', 'obsolete'],
])

/** Append path-free startup stages so installed failures remain diagnosable. */
function appendStartupLog(stage: string): void {
  try {
    const directory = path.join(app.getPath('appData'), USER_DATA_DIRECTORY_NAME)
    fs.mkdirSync(directory, { recursive: true })
    fs.appendFileSync(
      path.join(directory, STARTUP_LOG_FILENAME),
      `${new Date().toISOString()} ${stage}\n`,
      'utf8',
    )
  } catch {
    // Logging must never turn a recoverable startup into a failure.
  }
}

/**
 * Squirrel launches the installed executable with a lifecycle argument while it owns the
 * application directory. Never start Chromium, register the single-instance lock, or open a
 * window in that short-lived process: doing so keeps packaged DLLs locked after the hook timeout.
 */
function handleSquirrelLifecycle(): boolean {
  if (process.platform !== 'win32') return false
  const event = SQUIRREL_EVENTS.get(process.argv[1] ?? '')
  if (event === undefined) return false

  appendStartupLog(`squirrel lifecycle ${event}`)
  if (event === 'obsolete') {
    app.exit(0)
    return true
  }

  if (
    !path.isAbsolute(process.execPath) ||
    path.basename(process.execPath).toLocaleLowerCase('en-US') !==
      SQUIRREL_EXECUTABLE_NAME.toLocaleLowerCase('en-US')
  ) {
    appendStartupLog(`squirrel lifecycle ${event} rejected`)
    app.exit(1)
    return true
  }

  const updateExecutable = path.resolve(path.dirname(process.execPath), '..', 'Update.exe')
  const shortcutAction = event === 'uninstall' ? '--removeShortcut' : '--createShortcut'
  let finished = false
  const finish = (exitCode: number): void => {
    if (finished) return
    finished = true
    appendStartupLog(`squirrel lifecycle ${event} complete`)
    app.exit(exitCode)
  }

  try {
    const child = spawn(updateExecutable, [shortcutAction, SQUIRREL_EXECUTABLE_NAME], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })
    child.once('close', (code) => finish(code === 0 ? 0 : 1))
    child.once('error', () => finish(1))
    child.unref()
  } catch {
    finish(1)
    return true
  }

  // Squirrel allows only a short hook window. The detached shortcut command may finish after us.
  setTimeout(() => finish(0), SQUIRREL_QUIT_DEADLINE_MS)
  return true
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message
  const text = String(error)
  return text.trim().length > 0 ? text : 'Unknown startup error.'
}

/** Reports a concise failure without dumping environment variables or a stack trace. */
function reportFatalStartup(stage: string, error: unknown): void {
  if (fatalStartupReported) return
  fatalStartupReported = true
  const message = `${stage}: ${errorMessage(error)}`
  appendStartupLog(`fatal ${stage}`)
  process.stderr.write(`[startup] ${message}\n`)
  if (!wantsCapture(process.argv)) {
    dialog.showErrorBox(`${PRODUCT_NAME} could not start`, message)
  }
  app.exit(1)
}

/**
 * This product is intentionally installed beside Sprout Hollow, never over it.
 * Configure its stable data root before Electron creates a session.
 */
function configureApplicationIdentity(): void {
  app.setName(PRODUCT_NAME)
  const userDataPath = path.join(app.getPath('appData'), USER_DATA_DIRECTORY_NAME)
  fs.mkdirSync(userDataPath, { recursive: true })
  app.setPath('userData', userDataPath)
  if (process.platform === 'win32') app.setAppUserModelId(APP_ID)
  appendStartupLog('application identity ready')
}

function requiredApplicationFile(label: string, ...segments: string[]): string {
  const file = path.join(app.getAppPath(), ...segments)
  if (!fs.existsSync(file)) {
    throw new Error(`${label} is missing from the application bundle.`)
  }
  return file
}

/** Generous ceiling on an incoming save. A full farm serialises to a fraction of this. */
const MAX_SAVE_BYTES = 4 * 1024 * 1024

function saveFile(): string {
  return path.join(app.getPath('userData'), SAVE_FILENAME)
}

async function readSaveFile(): Promise<string | null> {
  try {
    const text = await fs.promises.readFile(saveFile(), 'utf8')
    return text.length > 0 ? text : null
  } catch {
    return null
  }
}

/** Writes through a temp file so a crash mid-write cannot leave a half-written save. */
async function writeSaveFile(json: string): Promise<boolean> {
  const file = saveFile()
  const temp = `${file}.tmp`
  try {
    await fs.promises.mkdir(path.dirname(file), { recursive: true })
    await fs.promises.writeFile(temp, json, 'utf8')
    await fs.promises.rename(temp, file)
    return true
  } catch {
    try {
      await fs.promises.rm(temp, { force: true })
    } catch {
      // Nothing to clean up, or the disk is refusing us entirely. Either way, report failure.
    }
    return false
  }
}

async function clearSaveFile(): Promise<boolean> {
  try {
    await fs.promises.rm(saveFile(), { force: true })
    return true
  } catch {
    return false
  }
}

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

/** True only for the page this app actually serves: the dev server, or a local file. */
function isAppUrl(raw: string): boolean {
  const url = parseUrl(raw)
  if (!url) return false
  if (DEV_SERVER_URL) {
    const dev = parseUrl(DEV_SERVER_URL)
    return dev !== null && url.origin === dev.origin
  }
  return url.protocol === 'file:'
}

function openExternally(raw: string): void {
  const url = parseUrl(raw)
  if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) return
  shell.openExternal(raw).catch(() => undefined)
}

function harden(contents: WebContents): void {
  contents.setWindowOpenHandler(({ url }) => {
    openExternally(url)
    return { action: 'deny' }
  })
  contents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) return
    event.preventDefault()
    openExternally(url)
  })
  contents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })
}

/**
 * Tells the renderer the window's maximised state changed, so the title bar's
 * maximise button can follow a double-click, a drag to the top edge, or the OS
 * doing it for us. Sent on both `maximize` and `unmaximize`.
 */
function pushMaximizedState(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  win.webContents.send(IPC_CHANNELS.windowMaximizedChanged, win.isMaximized())
}

function revealWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  if (!win.isVisible()) win.show()
  win.focus()
}

async function createWindow(): Promise<void> {
  const preloadFile = requiredApplicationFile('The secure preload', 'dist-electron', 'preload.js')
  const rendererFile = DEV_SERVER_URL
    ? null
    : requiredApplicationFile('The application interface', 'dist', 'index.html')
  const win = new BrowserWindow({
    width: WINDOW_W,
    height: WINDOW_H,
    minWidth: MIN_W,
    minHeight: MIN_H,
    useContentSize: true,
    backgroundColor: INK,
    title: PRODUCT_NAME,
    // Frameless: src/shell/ui/titlebar.ts draws the bar and owns the controls.
    frame: false,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: preloadFile,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: false,
      // Screenshot mode runs the window hidden; without this the game loop is
      // throttled to a crawl and every capture photographs the same frame.
      backgroundThrottling: !wantsCapture(process.argv),
    },
  })
  mainWindow = win
  win.once('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  if (wantsCapture(process.argv)) {
    // Deliberately never shown. On a GPU-less off-screen desktop the first paint
    // never completes, so `ready-to-show` never fires — and calling show() before
    // that paint wedges the renderer outright (no dom-ready, no console, nothing).
    // Left hidden, the renderer runs normally and the canvas can be read directly.
    // `backgroundThrottling: false` keeps requestAnimationFrame ticking while hidden.
    runCapture(win, process.argv).catch((err) => {
      process.stdout.write(`capture failed: ${String(err)}\n`)
      app.exit(1)
    })
  } else {
    win.once('ready-to-show', () => revealWindow(win))
  }
  win.setMenuBarVisibility(false)
  win.on('maximize', () => pushMaximizedState(win))
  win.on('unmaximize', () => pushMaximizedState(win))
  win.webContents.once('preload-error', (_event, _preloadPath, error) => {
    reportFatalStartup('The secure desktop bridge could not load', error)
  })
  harden(win.webContents)

  try {
    if (rendererFile !== null) await win.loadFile(rendererFile)
    else await win.loadURL(DEV_SERVER_URL)
  } catch (error) {
    if (!win.isDestroyed()) win.destroy()
    throw new Error(`The application interface could not load: ${errorMessage(error)}`)
  }

  // `ready-to-show` is paint-dependent. A successful document load is a safe
  // fallback that prevents an otherwise healthy frameless window staying hidden.
  if (!wantsCapture(process.argv)) revealWindow(win)
  appendStartupLog('application window loaded')
}

function registerSaveHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.saveRead, () => readSaveFile())
  ipcMain.handle(IPC_CHANNELS.saveWrite, (_event, json: unknown) => {
    if (typeof json !== 'string' || Buffer.byteLength(json, 'utf8') > MAX_SAVE_BYTES) {
      return Promise.resolve(false)
    }
    return writeSaveFile(json)
  })
  ipcMain.handle(IPC_CHANNELS.saveClear, () => clearSaveFile())
}

/** The window that asked, or null if it has already gone away mid-call. */
function senderWindow(event: IpcMainInvokeEvent): BrowserWindow | null {
  const win = BrowserWindow.fromWebContents(event.sender)
  return win !== null && !win.isDestroyed() ? win : null
}

/**
 * The four channels behind the custom title bar. Each one acts on the window that
 * asked, never on a window it was handed, so a renderer cannot reach another window.
 */
function registerWindowHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.windowMinimize, (event: IpcMainInvokeEvent) => {
    const win = senderWindow(event)
    if (win !== null && win.isMinimizable()) win.minimize()
  })

  ipcMain.handle(IPC_CHANNELS.windowMaximize, (event: IpcMainInvokeEvent) => {
    const win = senderWindow(event)
    if (win === null) return false
    if (win.isMaximized()) win.unmaximize()
    else if (win.isMaximizable()) win.maximize()
    return win.isMaximized()
  })

  ipcMain.handle(IPC_CHANNELS.windowClose, (event: IpcMainInvokeEvent) => {
    const win = senderWindow(event)
    if (win !== null) win.close()
  })

  ipcMain.handle(IPC_CHANNELS.windowIsMaximized, (event: IpcMainInvokeEvent) => {
    const win = senderWindow(event)
    return win !== null && win.isMaximized()
  })
}

function applySecurityHeaders(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers: Record<string, string | string[]> = { ...(details.responseHeaders ?? {}) }
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === 'content-security-policy') delete headers[key]
    }
    headers['Content-Security-Policy'] = [CSP]
    callback({ responseHeaders: headers })
  })
  // The game needs no camera, microphone, geolocation or notifications. Ever.
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, done) => done(false))
}

async function startApplication(): Promise<void> {
  await app.whenReady()
  appendStartupLog('electron ready')
  applySecurityHeaders()
  registerSaveHandlers()
  registerWindowHandlers()
  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow().catch((error: unknown) => {
        reportFatalStartup('The application window could not be created', error)
      })
      return
    }
    if (mainWindow !== null) revealWindow(mainWindow)
  })
}

if (!handleSquirrelLifecycle()) {
  appendStartupLog(`application launch ${app.getVersion()}`)
  let identityConfigured = true
  try {
    configureApplicationIdentity()
  } catch (error) {
    identityConfigured = false
    reportFatalStartup('The application data directory could not be prepared', error)
  }

  if (identityConfigured) {
    const hasSingleInstanceLock = app.requestSingleInstanceLock()
    if (!hasSingleInstanceLock) {
      appendStartupLog('secondary instance redirected')
      app.quit()
    } else {
      appendStartupLog('primary instance lock acquired')
      app.on('second-instance', () => {
        appendStartupLog('secondary instance activated primary')
        if (mainWindow !== null) revealWindow(mainWindow)
      })
      void startApplication().catch((error: unknown) => {
        reportFatalStartup('Application startup failed', error)
      })
    }
  }

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
