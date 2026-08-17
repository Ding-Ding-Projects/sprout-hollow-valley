# Sprout Hollow Valley

Sprout Hollow Valley is an independent Windows-only third-person low-poly 3D open-world
farming and life-simulation product. It is derived from Sprout Hollow under the MIT license,
but it has its own application identity, local data, save format, updates, executable,
installer, exports, repository, and release channel.

The packaged Farm tab now composes the authored connected valley, canonical deterministic farm
state, 240-person life state and presentation, farming interaction adapter, and all 700 detailed
interior graphs into one live third-person Three.js surface. The same canonical save is restored,
mutated, autosaved, and exposed to shell panels; rendering does not recreate farming or NPC rules.
This composition milestone does not by itself claim the repository-wide test, packaged-artifact,
capture, or long-running simulation evidence required for a complete release.

Start with:

- [PLAN.md](PLAN.md) for locked scope, exact content counts, architecture, and completion
  requirements;
- [docs/VALLEY-PRODUCT.md](docs/VALLEY-PRODUCT.md) for the 3D product contract;
- [docs/VALLEY-COMPLETENESS.md](docs/VALLEY-COMPLETENESS.md) for the hand-written,
  per-surface implementation and evidence inventory;
- [DESIGN.md](DESIGN.md) for the Material 3 shell/site and low-poly 3D direction.

## Product direction

The complete product is one authored connected valley with eight starting estate types:
meadow, forest, riverland, mountain, coastal, marsh, arid, and alpine. It retains the cozy,
deterministic farming and economy foundations while moving play into a third-person 3D world
with authored terrain, bundled assets, enterable interiors, persistent residents, and
recoverable consequences.

The complete-release baseline is **at least 5,000 unique non-NPC content definitions**. The
category counts in [PLAN.md](PLAN.md#world-farming-and-content) are:

| Category | Definitions |
|---|---:|
| Field crops | 500 |
| Trees, orchard plants, bushes, and vines | 250 |
| Animal species | 150 |
| Factories or production facilities | 400 |
| Non-factory buildings | 300 |
| Sellable products | 1,500 |
| Production recipes | 1,200 |
| Raw-material types | 300 |
| Functional decorations, paths, fences, signs, lights, and outdoor objects | 400 |
| **Minimum non-NPC total** | **5,000** |

The 400 factories or production facilities and 300 non-factory buildings form **700 fully
enterable structures**. Every structure is planned with a complete exterior, usable entrance
and exit, separately streamed interior, traversable room graph, functional stations,
context-appropriate sanitation and hand washing, and a real eventual destination for every
visible door.

NPC content is counted separately: the complete product contains **exactly 240 persistent
named NPCs**, each with an authored identity, home, household, work state, deterministic
schedule, relationships, needs, memories, dialogue, and context-aware behavior.

## Live Farm controls

The Farm tab loads an existing Valley save or creates a new canonical state, then places the
third-person player at the saved farm coordinate. Camera-center raycasting drives the readable
HUD and the same commands are available through its focusable buttons.

| Action | Keyboard and mouse | Gamepad |
|---|---|---|
| Move | `WASD` or arrow keys | Left stick |
| Look | Pointer or number-pad look keys | Right stick |
| Use the targeted NPC, door, connector, station, fixture, or farm option | `E` or `Enter` | A |
| Run the targeted farm action | `F` or primary click | X |
| Select the next farming tool | `G` or secondary click | Y |
| Jump | `Space` | B |
| Recenter / change shoulder / zoom | `R` / `Q` / wheel or `+` and `-` | Right-stick press / right bumper / D-pad |

Authored building and factory doors map deterministically onto the complete 400 factory and 300
building interior graphs. Inside, visible doors and vertical connectors traverse real rooms;
stations and fixtures execute their typed interaction contracts; and the persistent HUD exposes
an accessible restroom-and-hand-washing route. Leaving through the entry door returns the player
to the exact exterior position and facing. Switching shell tabs pauses the frame loop and writes
the canonical save without replacing the active Farm tab.

### Persistent 3D Valley state

`GameState` carries an optional, versioned `valley3d` section. Version 1 preserves the exact
`LifeSimulationState` for all 240 residents and event progress; the exterior player pose, authored
region, and estate; and, while inside a structure, its content and graph IDs, current room and
floor, position, exterior return pose, resolved door access, active station or fixture use, and
sanitation progress.

The section remains optional so saves written before the live 3D composition can still load.
Missing, malformed, or unsupported `valley3d` data migrates to deterministic defaults without
invalidating an otherwise valid canonical farm save. The Farm tab refreshes the section on state
mutations, autosaves, explicit saves, pause, and disposal. Restore revalidates every authored ID;
if a region, estate, structure, graph, room, door, station, or fixture no longer exists, the
corresponding 3D location or interaction is not activated and recovery uses the safe deterministic
exterior state.

## Independent product identity

Sprout Hollow Valley must never read, overwrite, import, update, uninstall, reset, or export
through Sprout Hollow's identity. These names are stable boundaries, not display-only labels:

| Boundary | Sprout Hollow Valley identity |
|---|---|
| Product name | `Sprout Hollow Valley` |
| Package and export app slug | `sprout-hollow-valley` |
| Electron application ID | `com.dingdingprojects.sprouthollowvalley` |
| User-data directory | `%APPDATA%\Sprout Hollow Valley` |
| Save schema and file | `ValleySaveV1` in `sprout-hollow-valley.save.v1.json`; no legacy save import |
| Shell storage | `sprout-hollow-valley.shell.v1` |
| IPC namespace | `sprout-hollow-valley:` |
| Export kinds | `valley-shell-export` and `valley-ledger-export` |
| Export filenames | Every download begins with `sprout-hollow-valley-` |
| Executable | `SproutHollowValley.exe` |
| Squirrel.Windows installer | `Sprout-Hollow-Valley-Setup-${version}.exe` |
| Repository and update provider | `Ding-Ding-Projects/sprout-hollow-valley` |
| Public release-asset base | `https://github.com/Ding-Ding-Projects/sprout-hollow-valley/releases/latest/download` |

Electron sets the user-data path to `%APPDATA%\Sprout Hollow Valley` before any application
data or save access. The `window.sprout` renderer bridge name is retained temporarily for
source compatibility; it is only an interface name and does not reuse Sprout Hollow storage,
save, update, or export identities.

Valley saves are fresh and versioned. The product does not import Sprout Hollow saves, share
their directory, or probe for them. The update identity is likewise restricted to the Valley
repository and its Squirrel.Windows assets.

## Accessible shell and website foundation

The Windows application shell and the public website use a farm-themed Material 3 foundation
with semantic colour roles, scalable typography, clear focus, state layers, restrained motion,
48 px interaction targets, responsive layouts, and textual recovery paths. Each surface is
responsible for its own accessibility, language, navigation, search, feedback, appearance,
documentation, and persistence contracts.

**Sprout Hollow Valley is playable only in the Windows desktop Electron application.** The
website is a non-playable landing, marketing, documentation, download, settings,
accessibility, and release-information surface. It must not host, stream, emulate, or imitate
the game, present a browser-playable farm, create browser saves, or turn a decorative scene
into simulated gameplay. Site-level language and appearance settings affect the website only.

Genuine application screenshots and verified release links may be added to the website when
those artifacts exist. No captures were produced for this foundation delivery, so the current
records do not present mock-ups or inherited pixel-art frames as Valley gameplay evidence.

Three persisted language modes remain part of the product:

- English;
- playful Hong Kong Cantonese;
- compact English and Cantonese bilingual mode.

English and Cantonese each have an independent funny-level control from 1 to 5. The controls
change tone, never facts: names, quantities, dates, prices, paths, key bindings, errors,
warnings, consent, and recovery instructions keep the same meaning at every level.

## Building locally

Use Node.js 22 or newer. From Command Prompt or PowerShell, install the locked dependencies,
build the application, and launch it with:

```powershell
.\run.bat
```

`run.bat` checks for Node.js, npm, and `package-lock.json`, installs the locked dependencies
with `npm ci --no-audit`, and runs `npm start` in the foreground. It waits until the application
exits and returns the command's eventual exit code.

To build the application without launching it, run:

```powershell
.\build.bat
```

`build.bat` checks for Node.js, npm, and `package-lock.json`, installs the locked dependencies
with `npm ci --no-audit`, runs `npm run build`, and reports the `dist/` and `dist-electron/`
output paths. It returns a nonzero exit code if a prerequisite, dependency install, or build
step fails.

To build the unsigned Squirrel.Windows installer and update files, run:

```powershell
.\build-installer.bat
```

`build-installer.bat` performs the same prerequisite and locked-dependency checks, runs
`npm run package`, reads the current version from `package.json`, and succeeds only when the
versioned installer, full NuGet package, and `RELEASES` manifest exist and are nonempty under
`release/squirrel-windows/`.

The batch entrypoints always reinstall from `package-lock.json`. To run an individual npm script
manually, install the locked dependencies first with `npm ci --no-audit`.

The following scripts are defined by the repository. This list documents supported commands;
it does not claim that a command has passed in the current foundation update.

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm start` | Build the Electron main process and renderer, then launch the desktop application |
| `npm run build:main` | Compile the Electron main and preload processes |
| `npm run build:renderer` | Build the application renderer |
| `npm run build:site` | Build the public website |
| `npm run build:icon` | Regenerate the multi-resolution Windows icon from its committed master |
| `npm run build` | Run the repository's complete application build script |
| `npm run package` | Build and create unsigned Squirrel.Windows release artifacts in `release/` |

The project is Windows-only. There is no supported macOS or Linux package. Release artifacts
are unsigned, so Windows may display an unknown-publisher or SmartScreen warning.

Windows packaging regenerates `assets/branding/sprout-hollow-valley.ico` from the committed
alpha master before the application build. The deterministic generator embeds PNG-compressed
16, 20, 24, 32, 40, 48, 64, 96, 128, and 256 pixel frames for Windows shell sizes. The master
PNG is the source of truth; do not edit the generated ICO by hand.

## Repository map

```text
electron/                    Electron main process, preload boundary, and Windows identity
assets/branding/             Original application mark, source master, and generated Windows icon
src/shell/                   Application-shell state, language, navigation, and UI foundation
src/renderer3d/              Live Three.js Farm surface, player, camera, streamed world, and assets
site/                        Responsive public website
docs/VALLEY-PRODUCT.md       Third-person 3D product contract
docs/VALLEY-COMPLETENESS.md  Per-surface completeness and evidence inventory
PLAN.md                      Locked product scope and exact completion targets
DESIGN.md                    Material 3 and low-poly 3D design direction
CHANGELOG.md                 Valley foundation changes and inherited project history
```

## Inherited Sprout Hollow history

Sprout Hollow Valley began from Sprout Hollow v1.1.0 at commit
`ccb5d03a2750b5a4c49d9b7d82e6ff068cca340d`. The inherited project is a deterministic
pixel-art farming game with an Electron shell. Its farming rules, economy, progression,
documentation, and implementation history are useful source material, but its pixel-art
presentation and product identity are not the current Valley product contract.

The original [`Ding-Ding-Projects/farming-game`](https://github.com/Ding-Ding-Projects/farming-game)
repository, installations, and saves remain separate and untouched. Historical release notes
are retained in [CHANGELOG.md](CHANGELOG.md) under clearly labelled inherited sections.

## License

MIT. See [LICENSE](LICENSE). The derivation retains the original license and attribution.
