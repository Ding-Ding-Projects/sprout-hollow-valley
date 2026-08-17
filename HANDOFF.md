# Sprout Hollow Valley handoff

Updated: 2026-08-17

## What the project is now

Sprout Hollow Valley is a public Windows Electron farming and life-simulation application whose
Farm tab now mounts a Three.js third-person open valley rather than the inherited pixel canvas.
The current source contains the exact typed catalogue promised by `PLAN.md` (5,000 non-NPC
definitions), exactly 240 persistent NPC definitions, exactly 400 factory and 300 non-factory
building definitions, one deterministic exterior placement and real interior mapping for every
structure, persistent farming in all eight estates, and persistent production state for all 400
factories and 1,200 recipes. The GitHub Pages site is a responsive landing, documentation, status,
and download surface; it is not a playable build of the application.

## Published baseline

- Latest published release: [`v1.2.11`](https://github.com/Ding-Ding-Projects/sprout-hollow-valley/releases/tag/v1.2.11).
- Tag target: `63b377ff81a4a91d0f46cfbc359d9dae7e192b33`.
- Release state: one matching release, non-draft and non-prerelease, published 2026-08-17.
- Windows installer: [`Sprout-Hollow-Valley-Setup-1.2.11.exe`](https://github.com/Ding-Ding-Projects/sprout-hollow-valley/releases/download/v1.2.11/Sprout-Hollow-Valley-Setup-1.2.11.exe), 147,233,280 bytes, SHA-256 `330a689e57178a323e13756f849a38e5f637146333970bf63ddb44978f5b357d`.
- Full update package: [`sprout-hollow-valley-1.2.11-full.nupkg`](https://github.com/Ding-Ding-Projects/sprout-hollow-valley/releases/download/v1.2.11/sprout-hollow-valley-1.2.11-full.nupkg), 146,450,137 bytes, SHA-256 `552f3ee7f48065e0c6324130459f796d3421a5a3192f0bb6ae1046082b4d8935`.
- Update feed: [`RELEASES`](https://github.com/Ding-Ding-Projects/sprout-hollow-valley/releases/download/v1.2.11/RELEASES), 92 bytes, SHA-256 `185ffbc13d19a092321b6194e7b1509990ba6d1d9e6fb19f77bbd8387595b3ea`.
- Release workflow: [run 32073833423](https://github.com/Ding-Ding-Projects/sprout-hollow-valley/actions/runs/32073833423), successful at the tag target. Unique-tag validation, Squirrel packaging, unsigned-executable assertion, create-only publication, and download checks all passed.
- Tag CI: [run 32073833481](https://github.com/Ding-Ding-Projects/sprout-hollow-valley/actions/runs/32073833481), successful at the tag target.
- Pages deployment: [run 32073819458](https://github.com/Ding-Ding-Projects/sprout-hollow-valley/actions/runs/32073819458), successful at the tag target.
- Landing site: <https://ding-ding-projects.github.io/sprout-hollow-valley/>. A hidden 390×844 browser check confirmed 200 responses for the compiled CSS and JavaScript, no horizontal overflow, styled Material controls, and the explicit non-playable-site boundary.

## Important installed-build finding

The release workflow and installer complete, and a clean hidden installation of the exact v1.2.11
package produced `app-1.2.11` with an intact `resources/app.asar`. Squirrel install handling
completed in 436 ms. A direct cheap-headless launch reached a real 1296×904 Electron window, and
the startup log recorded identity, primary-instance lock, Electron readiness, and document load in
0.879 seconds.

The published v1.2.11 renderer then aborts during module import. Chromium reports:

```text
Uncaught ContentValidationError: Sprout Hollow Valley content validation failed (2240 issues)
```

The exact 2,240 issues were 80 invalid generated-category values, 950 invalid dependent unlocks,
280 missing-capability reports, and 930 recipe-output reference-kind mismatches. The shell window
therefore exists in the published build but the Farm surface does not finish mounting.

Fix branch `fix/v1211-installed-launch` now contains commit
`d1ea96aa4e3d4e5877b8e591f3c56012ce5bcfcd` (`fix(startup): validate generated content graph`). It keeps validation enabled, removes
diagnostic probes, namespaces and deduplicates generated taxonomy facets, floors dependent unlocks,
assigns deterministic recipes to the 14 previously uncovered capabilities, and validates alternate
recipe output identity without requiring every technique to appear in a product's primary-source
list. The exact fix commit passed the real package command. Its local artifacts are: setup
147,234,304 bytes (SHA-256 `30a8afe5e60b876215a7ad8d8e0666f742620cba73ce29b81af950174e462ec3`),
full package 146,451,446 bytes (SHA-256 `4a64b220025cbe6d6fedbf1a5e94be35f0282b7d586a127658da55f5450e37bc`),
and a 92-byte `RELEASES` feed (SHA-256 `ff9f1915e9be6ff100f2c660208f6bfe2cc8c16f948320186ee60146feec6f2c`).

A same-version hidden reinstall of that fix completed its Squirrel hook in 380 ms. A direct hidden
launch produced a dynamic 1296×904 `Chrome_WidgetWin_1` Farm window titled
`農場 — Sprout Hollow Valley`; Chromium contained no `ContentValidationError` and no uncaught
exception. One nonfatal Three.js diagnostic remains (`Object3D.add: object not an instance ...
undefined`), and the CDP DOM-detail probe timed out after its WebSocket connection produced no
parseable response. The real Farm HWND is stronger evidence that renderer routing completed, but
those two limitations remain tracked under [issue #1](https://github.com/Ding-Ding-Projects/sprout-hollow-valley/issues/1).

## Implemented architecture

- `src/renderer3d/runtime.ts` and `src/renderer3d/farm-surface.ts` own the WebGL renderer, third-person player, camera-relative movement, gamepad/keyboard/pointer input, collision, streaming, frame loop, pause/resume, resize, and disposal.
- `src/renderer3d/world/authored-valley-world.ts` renders the finite connected terrain, roads, river, eight regions and estates, saved estate plots, vegetation, lighting, and streamed structure cells.
- `src/renderer3d/world/authored-structure-placements.ts` contains the complete 700-row exterior placement index. Each content ID maps one-to-one to its exact `InteriorGraph`, entry door, entry room, approach, collider, region, district, cell, pose, and real entrance. Cells are capped at five structures.
- `src/renderer3d/interiors/` renders and operates multi-room/multi-floor interiors, real doors, stairs/elevators, stations, fixtures, restrooms, and hand-washing sequences.
- `src/renderer3d/npcs/` presents the exact 240-NPC life state with deterministic placement, culling, collision targets, and authored local dialogue.
- `src/game/valley3d-save.ts` provides the optional version-one 3D save section and fail-closed migration/defaulting for exterior pose, NPC life state, interiors, access progress, sanitation, estate farming, and factory production.
- `src/game/estate-farming.ts`, `estate-farm-state.ts`, and `valley-plants.ts` add persistent 5×4 fields and three orchard positions to each of eight estates (160 field plots and 24 orchard positions), using all 500 crop and 250 orchard definitions through the canonical time, energy, weather, season, inventory, yield, quality, and economy rules.
- `src/game/valley-factory-production.ts` validates and operates all 400 factories and 1,200 recipes with capability-matched deterministic queues, input/output storage, staffing readiness, cleanliness, inspection, maintenance, quality, collection, shipping, and station actions.
- `.github/workflows/release.yml` is create-only: ordinary `main` updates do not publish; explicit version tags must be unused and match the manifest; tags are never moved and release assets are never replaced.

## Test inventory

The repository currently contains 38 `*.test.ts` files and 994 static `it`/`test` declarations.
Static declarations are not a runtime pass count: parameterized cases can expand, conditional
capture cases can skip, and none of these files was executed during the accelerated v1.2.9–v1.2.11
feature passes.

| File | Static declarations |
|---|---:|
| `tests/actions.test.ts` | 60 |
| `tests/bands.test.ts` | 6 |
| `tests/buildings.test.ts` | 23 |
| `tests/crops.test.ts` | 18 |
| `tests/economy.test.ts` | 49 |
| `tests/engine3d/assets.test.ts` | 12 |
| `tests/engine3d/input.test.ts` | 8 |
| `tests/engine3d/world-streaming.test.ts` | 8 |
| `tests/factories.test.ts` | 34 |
| `tests/hay.test.ts` | 12 |
| `tests/history.test.ts` | 61 |
| `tests/i18n.test.ts` | 29 |
| `tests/integration.test.ts` | 33 |
| `tests/interiors.test.ts` | 48 |
| `tests/livestock.test.ts` | 40 |
| `tests/market.test.ts` | 54 |
| `tests/motion.test.ts` | 7 |
| `tests/placement.test.ts` | 35 |
| `tests/production.test.ts` | 34 |
| `tests/progression.test.ts` | 37 |
| `tests/reachable.test.ts` | 10 |
| `tests/reduced-motion.test.ts` | 11 |
| `tests/regex.test.ts` | 67 |
| `tests/rng.test.ts` | 17 |
| `tests/save.test.ts` | 15 |
| `tests/search-catalogue.test.ts` | 14 |
| `tests/shop.test.ts` | 20 |
| `tests/shots.test.ts` | 2 |
| `tests/site-palette.test.ts` | 2 |
| `tests/site.test.ts` | 7 |
| `tests/species.test.ts` | 17 |
| `tests/state.test.ts` | 23 |
| `tests/store.test.ts` | 32 |
| `tests/tabmodel.test.ts` | 52 |
| `tests/time.test.ts` | 15 |
| `tests/tokens.test.ts` | 20 |
| `tests/trees.test.ts` | 26 |
| `tests/unlocks.test.ts` | 36 |

### Current command verdicts

- `npm test`: **not run against the current v1.2.11 tree**. The older claim in issue #1 (997 passed and two capture cases skipped at commit `f51997e`) is not evidence for the current source.
- `npm run typecheck`: passed as part of the exact v1.2.11 `npm run package` path at `63b377ff81a4a91d0f46cfbc359d9dae7e192b33`; it was not launched separately.
- `npm run build:main`, `npm run build:renderer`, and `npm run build:site`: passed in tag CI run 32073833481 at the exact release commit.
- `npm run package`: passed locally at the exact release commit and in release run 32073833423.
- `npm run shots` / HuiShots: not run during the accelerated passes.

### Built-artifact coverage

None of the 38 Vitest files launches the installed Squirrel application. `tests/shots.test.ts`
drives source rendering and `tests/site.test.ts` checks source/committed site assets; neither proves
the packaged Electron runtime. The cheap-headless installed interaction described above is the only
current built-artifact launch evidence, and it found the renderer-import failure. Automated
installed traversal of all 700 structures, every room/door/station, sanitation, all estate plots,
all 400 factory queues, save/reload, and the exact 240-NPC simulation is still absent.

## Open boundaries and next actions

All items remain tracked by [issue #1](https://github.com/Ding-Ding-Projects/sprout-hollow-valley/issues/1):

1. Integrate `d1ea96aa4e3d4e5877b8e591f3c56012ce5bcfcd`, then bump to a new unused version and publish it only through the create-only release workflow when release work is explicitly requested. Do not replace v1.2.11 assets.
2. Trace and remove the nonfatal Three.js `Object3D.add` diagnostic, then repeat the installed interaction with a reliable renderer-DOM or semantic-state probe.
3. Run the current 38-file Vitest suite and record its exact expanded pass/fail/skip count at the commit tested.
4. Add installed-artifact automation for the 700-structure traversal, sanitation, estate-farming, factory-production, NPC, and save/reload contracts.
5. Produce genuine current-build captures only after the renderer works; existing committed images predate the live Valley runtime and are not evidence for the new 3D implementation.
6. Reconcile `docs/VALLEY-COMPLETENESS.md`, whose evidence rows still describe several Valley contracts as planned because the required automated interaction/capture evidence has not been produced.
7. Review the five dependency advisories reported by locked installation. No dependency remediation was attempted during the feature passes.
8. Preserve the historical record that pre-v1.2.9 publishing moved/replaced `v1.2.8`; the create-only workflow prevents recurrence but does not rewrite that published history.

## Repository state at handoff drafting

- Default branch and GitHub `main`: `63b377ff81a4a91d0f46cfbc359d9dae7e192b33` before the active installed-launch fix is integrated.
- The feature and release branches listed by `git worktree list` are already ancestors of `main`, except `fix/v1211-installed-launch` at `d1ea96aa4e3d4e5877b8e591f3c56012ce5bcfcd`, which is package- and installed-runtime-proven but not yet integrated at the time this handoff is written.
- No stash exists.
- The primary worktree is clean apart from this newly created handoff file.
- Worktree and branch cleanup must happen only after the active fix and this handoff are committed, integrated, pushed, and proven ancestors of the final `main`.
