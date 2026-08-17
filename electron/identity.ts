/** Stable installed identities for the independent Sprout Hollow Valley product. */
export const PRODUCT_NAME = 'Sprout Hollow Valley'
export const APP_ID = 'com.dingdingprojects.sprouthollowvalley'
export const USER_DATA_DIRECTORY_NAME = 'Sprout Hollow Valley'
export const SAVE_SCHEMA_ID = 'ValleySaveV1'
export const SAVE_FILENAME = 'sprout-hollow-valley.save.v1.json'
export const GITHUB_UPDATE_REPOSITORY = 'Ding-Ding-Projects/sprout-hollow-valley'
export const UPDATE_FEED_BASE_URL =
  'https://github.com/Ding-Ding-Projects/sprout-hollow-valley/releases/latest/download'

/**
 * IPC remains behind the compatible `window.sprout` bridge, but every transport channel
 * is namespaced so this installation cannot collide with the original application.
 */
export const IPC_CHANNELS = Object.freeze({
  saveRead: 'sprout-hollow-valley:save:read',
  saveWrite: 'sprout-hollow-valley:save:write',
  saveClear: 'sprout-hollow-valley:save:clear',
  windowMinimize: 'sprout-hollow-valley:window:minimize',
  windowMaximize: 'sprout-hollow-valley:window:maximize',
  windowClose: 'sprout-hollow-valley:window:close',
  windowIsMaximized: 'sprout-hollow-valley:window:is-maximized',
  windowMaximizedChanged: 'sprout-hollow-valley:window:maximized-changed',
})
