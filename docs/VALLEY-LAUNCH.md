# Sprout Hollow Valley desktop launch

The packaged application starts from `dist-electron/main.js`. The Electron main
process is emitted as CommonJS, matching the package's CommonJS interpretation and
preserving `__dirname` support for main-process helpers.

Packaged startup resolves both required artifacts from `app.getAppPath()`:

- `dist-electron/preload.js` is the sandboxed renderer bridge.
- `dist/index.html` is the locally bundled application interface.

The preload is deliberately self-contained. Sandboxed Electron preloads have a
restricted module loader and cannot depend on another compiled local module. Its IPC
channel names therefore mirror the stable names in `electron/identity.ts` without a
runtime relative import.

Installed builds ignore `VITE_DEV_SERVER_URL` and always load their bundled interface.
After the document loads, the frameless window is shown even if the paint-dependent
`ready-to-show` event has not arrived. A second launch activates and focuses the existing
application instance instead of opening another process window.

Squirrel.Windows maintenance launches are handled before normal application startup.
`--squirrel-install` and `--squirrel-updated` create the packaged executable's shortcuts,
`--squirrel-uninstall` removes them, and `--squirrel-obsolete` exits immediately. Each
maintenance process exits within one second without creating Chromium processes, taking the
single-instance lock, or opening a game window. Squirrel owns the version directory during
these hooks; a normal application launch can otherwise outlive the hook timeout and keep DLLs
locked, making the next installation fail while deleting the old version.

If the data directory cannot be prepared, a required packaged file is missing, or the
interface cannot load, startup writes one concise error to standard error and opens a
`Sprout Hollow Valley could not start` dialog. The report names the failed stage and
error message without dumping environment variables or a stack trace.

Installed startup also appends path-free stage records to
`%APPDATA%\Sprout Hollow Valley\startup.log`. The log distinguishes Squirrel lifecycle work,
normal primary and secondary launches, document load, and fatal startup stage without recording
command arguments, environment variables, local file paths, save data, or stack traces.

This installer repair was reproduced against the released v1.2.6 Squirrel package and then
verified by installing a replacement package and launching its installed executable on a named
off-screen Windows desktop. No screenshot or capture workflow was used.

## Create-once releases

The release workflow runs only for an explicit `v*` tag or a manual workflow dispatch. Its
preflight reads the version and Squirrel artifact template from `package.json` before packaging.
A tag-triggered run must use exactly `v${package.version}`, point at the checked-out commit, and
have no existing GitHub release. A manual run requires both the derived tag and its release to be
unused.

Publication creates one new non-draft release. It never moves a tag, edits an existing release,
or overwrites an asset. The installer name is derived from the Squirrel template and must resolve
to `Sprout-Hollow-Valley-Setup-${version}.exe`; the unsigned assertion and post-publication tag,
asset-size, and download-URL checks remain mandatory.
