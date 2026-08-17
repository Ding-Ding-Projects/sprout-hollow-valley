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

If the data directory cannot be prepared, a required packaged file is missing, or the
interface cannot load, startup writes one concise error to standard error and opens a
`Sprout Hollow Valley could not start` dialog. The report names the failed stage and
error message without dumping environment variables or a stack trace.

This accelerated launch repair was traced statically. It did not launch the application,
run tests, type checking, linting, auditing, packaging, review, or capture workflows.
