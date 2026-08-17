import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'

/**
 * Keep the sandboxed preload self-contained. Electron gives sandboxed preloads a
 * restricted CommonJS loader which cannot resolve local modules such as
 * `./identity`; a relative import here would prevent the bridge from being exposed.
 * These stable transport names intentionally mirror `identity.ts`.
 */
const IPC_CHANNELS = Object.freeze({
  saveRead: 'sprout-hollow-valley:save:read',
  saveWrite: 'sprout-hollow-valley:save:write',
  saveClear: 'sprout-hollow-valley:save:clear',
  windowMinimize: 'sprout-hollow-valley:window:minimize',
  windowMaximize: 'sprout-hollow-valley:window:maximize',
  windowClose: 'sprout-hollow-valley:window:close',
  windowIsMaximized: 'sprout-hollow-valley:window:is-maximized',
  windowMaximizedChanged: 'sprout-hollow-valley:window:maximized-changed',
})

/** Called with the window's new maximised state whenever the main process reports one. */
type MaximizedListener = (maximized: boolean) => void

/**
 * The entire surface the renderer gets. Three save channels and the four window
 * controls behind the custom title bar, nothing else — no fs, no ipcRenderer, no
 * process. Every value crossing back is narrowed here, so the renderer never has to
 * trust the shape of an IPC reply.
 */
contextBridge.exposeInMainWorld('sprout', {
  readSave: (): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.saveRead),
  writeSave: async (json: string): Promise<void> => {
    await ipcRenderer.invoke(IPC_CHANNELS.saveWrite, json)
  },
  clearSave: async (): Promise<void> => {
    await ipcRenderer.invoke(IPC_CHANNELS.saveClear)
  },

  minimizeWindow: async (): Promise<void> => {
    await ipcRenderer.invoke(IPC_CHANNELS.windowMinimize)
  },
  /** Maximises a restored window and restores a maximised one. Resolves to the new state. */
  toggleMaximizeWindow: async (): Promise<boolean> => {
    const maximized: unknown = await ipcRenderer.invoke(IPC_CHANNELS.windowMaximize)
    return maximized === true
  },
  closeWindow: async (): Promise<void> => {
    await ipcRenderer.invoke(IPC_CHANNELS.windowClose)
  },
  isWindowMaximized: async (): Promise<boolean> => {
    const maximized: unknown = await ipcRenderer.invoke(IPC_CHANNELS.windowIsMaximized)
    return maximized === true
  },
  /**
   * Subscribes to maximise and unmaximise, including changes the OS makes on its own
   * (a snap, a title-bar double-click, a window-manager shortcut). Returns an
   * unsubscribe function; call it or the listener outlives the component.
   */
  onWindowMaximizedChanged: (listener: MaximizedListener): (() => void) => {
    const handler = (_event: IpcRendererEvent, maximized: unknown): void => {
      listener(maximized === true)
    }
    ipcRenderer.on(IPC_CHANNELS.windowMaximizedChanged, handler)
    return (): void => {
      ipcRenderer.removeListener(IPC_CHANNELS.windowMaximizedChanged, handler)
    }
  },
})
