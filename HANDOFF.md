# Sprout Hollow Valley handoff

Updated: 2026-08-18

## Current release candidate

The source baseline for this handoff is
`0f9d07494d2c079ec142709354a8d31105054027`. It contains the renderer recovery
merge `169c529fef1d9b304669af6a201d2358ee6f2487`, the release preparation commit
`471da91b5d536def31db99150fdba0857dd34bbe`, and the follow-up save, landing,
history, accessibility, and shop corrections that followed. `package.json` and
`package-lock.json` declare version `1.2.12`.

At the time this handoff was drafted, `origin/main` resolved to the same baseline
commit. No `v1.2.12` tag or GitHub Release exists yet. The latest published release
is still `v1.2.11` at `63b377ff81a4a91d0f46cfbc359d9dae7e192b33`; it must remain a
historical record and must not be described as a repaired renderer release.

## Installed renderer recovery

The published `v1.2.11` installer could create its Electron window but the renderer
aborted while importing the content catalogue with 2,240 validation issues. The
recovery branch first repaired that catalogue validation, then found and repaired a
separate startup starvation path: a settings language sample temporarily changed the
live language while its own refresh listener was active. That cycle repeatedly
relabeled and synchronized panels before the first Farm render callback could run.

The integrated recovery keeps catalogue validation fail-closed and additionally:

- namespaces generated taxonomy facets and validates dependent unlocks, capability
  coverage, and alternate outputs correctly;
- avoids a zero-argument Three.js `Object3D.add()` call for empty weather hooks;
- rejects invalid world and interior roots at their mount boundaries;
- avoids recreating an already-visible Farm surface; and
- renders settings samples through a pure requested-language lookup instead of
  mutating the persisted language or notifying listeners.

Recorded recovery evidence is intentionally split by commit:

| Commit | Evidence |
| --- | --- |
| `bc80f5b95f784ca43f7e0dba6dbc5f2daea560fd` | Focused renderer and localization checks passed: 3 files, 32 assertions. `npm run typecheck` and `npm run package` also passed. |
| `0f9d07494d2c079ec142709354a8d31105054027` | A newly built unsigned Squirrel installer silently installed `app-1.2.12`, then a direct headless launch reached a complete Farm document with one 1280×768 Three.js canvas, HUD, controls, tabs, no runtime error state, and a startup-log `application window loaded` record. Chromium recorded no `Object3D.add`, invalid-root, console, uncaught, or error entries. |

The final local `1.2.12` artifacts were not published when this file was written:

| Artifact | SHA-256 |
| --- | --- |
| `Sprout-Hollow-Valley-Setup-1.2.12.exe` | `0FC8A9562CFB4ACEF88959DA1DB2E1977875DFE0D62EF522131B2DA3F343174D` |
| `sprout-hollow-valley-1.2.12-full.nupkg` | `8A8E4959F79B3E286AE96746589C4D6F33191B777638854B5659DD1B0A95F5A3` |
| `sprout-hollow-valley-1.2.12-delta.nupkg` | `4A69A68F76C5FDB6195823E607B49500EAC8405F953A897969BC8A97579F3967` |
| `RELEASES` | `9C8FEF9F7658E311F8EA9586BE760016B469A8E1110DD424C6AB7276C89BFD8F` |

The setup executable reported `NotSigned`, as required. Icon inspection found valid
small 16×16 and standard 32×32 application icon sizes in the packaged executable.

## Remote evidence at the candidate baseline

- CI run [32096476804](https://github.com/Ding-Ding-Projects/sprout-hollow-valley/actions/runs/32096476804)
  completed successfully for `0f9d07494d2c079ec142709354a8d31105054027`.
- Pages run [32096476843](https://github.com/Ding-Ding-Projects/sprout-hollow-valley/actions/runs/32096476843)
  completed successfully for the same commit.
- The source tree has 40 `*.test.ts` files and 978 static `it` / `test` declarations.
  Those declarations are an inventory, not a substitute for an executed result.

## Release-grade completeness gaps

The renderer repair is complete as a source and installed-artifact recovery, but a
release-grade shutdown is not yet complete. The next owner must retain these facts:

1. Run and record the complete current local suite against the exact release commit.
   Do not infer an expanded pass count from the 978 static declarations.
2. Run the declared build and release checks, including `npm run check:build`,
   `npm run build:site`, the real Squirrel packaging route, the committed line counter,
   and a fresh installed-artifact launch against the exact release artifact.
3. `docs/VALLEY-COMPLETENESS.md` still identifies 61 evidence rows as planned and has
   no complete row. It lacks installed-artifact traversal and capture proof for all 700
   structures, their rooms, doors, stations, sanitation routes, estate farming,
   factory production, NPC behavior, and save/reload cycles.
4. The project does not yet have a runnable aggregate harness for the complete
   700-structure traversal, long-run simulation, and performance evidence required by
   `PLAN.md`. Do not represent a source-level or single-Farm launch as that evidence.
5. The release workflow validates Squirrel artifact publication, but it does not run the
   full test suite, site build, installed-artifact interaction, or complete capture
   matrix. Its release notes also need verified workflow timing and the required release
   metadata before a release can be called fully proven.
6. The root one-click build scripts still need a fresh-machine bootstrap proof: they
   currently depend on Node/npm being available on `PATH`, and their silent-mode and
   installer-integrity contracts need end-to-end verification.
7. `docs/VALLEY-LAUNCH.md` contains historical installer evidence; update it when the
   final release artifact and release identifier are verified rather than guessing a
   future release URL.

These are evidence and completeness gaps, not permission to weaken validation or to
call unfinished coverage complete.

## Safe next steps

1. Re-inventory every branch, linked working tree, stash, tag, release, and divergence
   immediately before any integration or cleanup action.
2. Preserve and integrate the completed documentation and verification lanes without
   discarding independent work.
3. Build `v1.2.12` from its exact final `main` commit, inspect every Squirrel artifact,
   and repeat the installed headless Farm launch with that artifact.
4. Create one new immutable `v1.2.12` tag and one non-draft GitHub Release only after
   the final commit, hashes, notes, assets, and release workflow evidence are ready.
   Never overwrite `v1.2.11` or recycle its tag or assets.
5. Verify the published tag, commit, assets, downloads, release notes, and final CI
   result through the GitHub CLI.
6. Do not delete any branch, linked working tree, directory, or stash until every source
   tip is proven merged into the released `main`, all work is committed and pushed, and
   the current user explicitly authorizes that irreversible cleanup.

## Product architecture that remains in scope

- `src/renderer3d/` owns the third-person Three.js Farm runtime, input, camera, world
  streaming, interiors, collisions, NPC presentation, and disposal.
- `src/content/` owns the typed 5,000-definition catalogue, persistent NPC definitions,
  structure definitions, factory capability mapping, and validation.
- `src/game/` owns persistent estate farming, orchard state, factory production, and the
  versioned 3D save section.
- `site/` is a responsive GitHub Pages landing, documentation, status, and download
  surface. It is not a playable substitute for the installed application.

## Handoff ownership notes

This handoff update and the newly added `ROADMAP.md` are documentation-only work. They
must be merged with the other completed lanes before any release decision. Re-run
`git worktree list --porcelain`, `git branch --all --verbose --no-abbrev`, and
`git stash list` at resumption rather than relying on a static branch list in this file.
