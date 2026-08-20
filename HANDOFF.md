# Sprout Hollow Valley handoff

Updated: 2026-08-18

## Fresh-host build bootstrap

The root `build.bat` and `build-installer.bat` routes now call one shared
`download-dependencies.bat` entry point. It prepares a project-local Node.js
22.23.2 runtime from the canonical archive only after verifying the committed
SHA-256, then both routes use the committed npm lock. The focused contract test
and a cold dependency-fetch run are the directly related evidence; installed
application lifecycle proof remains separate.

On 2026-08-20, `npm run test:dependency-bootstrap` passed, the cold fetch
verified SHA-256
`1177b4137ba5adaa56354ae40f1080c7450e8ae09cecb47da459d1c52ac99f97`,
prepared Node.js v22.23.2, and `build.bat /s` completed type checking plus the
main and renderer builds. No installer was executed.

## Published release baseline

The published `v1.2.12` baseline is
`941c922a45c4658a34b321bdcdadd468e15633ef`. It includes the renderer recovery
merge `169c529fef1d9b304669af6a201d2358ee6f2487`, the release preparation commit
`471da91b5d536def31db99150fdba0857dd34bbe`, the handoff/roadmap commit
`04ba585bb9f95e6f01da5dbf9c0cc745c6e1071a`, and the follow-up save, landing,
history, accessibility, and shop corrections. `package.json` and
`package-lock.json` declare version `1.2.12`.

[`v1.2.12`](https://github.com/Ding-Ding-Projects/sprout-hollow-valley/releases/tag/v1.2.12)
is the one published non-draft, non-prerelease release for this handoff. Its tag
resolves to `941c922a45c4658a34b321bdcdadd468e15633ef`, and release run
[32098991897](https://github.com/Ding-Ding-Projects/sprout-hollow-valley/actions/runs/32098991897)
completed successfully for that exact commit. `v1.2.11` remains a historical
broken-renderer release and must not be relabeled as repaired.

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

The published `1.2.12` release assets were read back after publication:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| [`Sprout-Hollow-Valley-Setup-1.2.12.exe`](https://github.com/Ding-Ding-Projects/sprout-hollow-valley/releases/download/v1.2.12/Sprout-Hollow-Valley-Setup-1.2.12.exe) | 147,107,840 | `838bc3f2b18e8325c2079d3f616702d2b7edca39ebbe2319072c88887d7f3c30` |
| [`sprout-hollow-valley-1.2.12-full.nupkg`](https://github.com/Ding-Ding-Projects/sprout-hollow-valley/releases/download/v1.2.12/sprout-hollow-valley-1.2.12-full.nupkg) | 146,324,297 | `d09af8014c6b51153843e112588e4cc7f6e53808b03c893528adc74157c53a76` |
| [`RELEASES`](https://github.com/Ding-Ding-Projects/sprout-hollow-valley/releases/download/v1.2.12/RELEASES) | 92 | `ed3eb0c882c8ba79e7e87db973a9eb78303565c3a9f6a92371daa08e383b6dab` |

The setup executable reported `NotSigned`, as required. Icon inspection found valid
small 16×16 and standard 32×32 application icon sizes in the packaged executable.

## Remote evidence

- CI run [32096476804](https://github.com/Ding-Ding-Projects/sprout-hollow-valley/actions/runs/32096476804)
  completed successfully for `0f9d07494d2c079ec142709354a8d31105054027`.
- Pages run [32096476843](https://github.com/Ding-Ding-Projects/sprout-hollow-valley/actions/runs/32096476843)
  completed successfully for the same commit.
- Release run [32098991897](https://github.com/Ding-Ding-Projects/sprout-hollow-valley/actions/runs/32098991897)
  completed successfully at the published tag target
  `941c922a45c4658a34b321bdcdadd468e15633ef`.
- The source tree has 40 `*.test.ts` files and 978 static `it` / `test` declarations.
  Those declarations are an inventory, not a substitute for an executed result.

## Release-grade completeness gaps

The renderer repair is complete as a source and installed-artifact recovery, but a
release-grade shutdown is not yet complete. The next owner must retain these facts:

1. Run and record the complete current local suite against the exact published release commit.
   Do not infer an expanded pass count from the 978 static declarations.
2. Preserve a release-grade acceptance record for every declared local check, including
   `npm run check:build`, `npm run build:site`, the committed line counter, the real
   Squirrel packaging route, and installed-artifact interaction tied to the exact artifact.
3. `docs/VALLEY-COMPLETENESS.md` still identifies 61 evidence rows as planned and has
   no complete row. It lacks installed-artifact traversal and capture proof for all 700
   structures, their rooms, doors, stations, sanitation routes, estate farming,
   factory production, NPC behavior, and save/reload cycles.
4. The project does not yet have a runnable aggregate harness for the complete
   700-structure traversal, long-run simulation, and performance evidence required by
   `PLAN.md`. Do not represent a source-level or single-Farm launch as that evidence.
5. The successful release workflow validates this release's Squirrel artifact publication,
   but its scope does not replace a full test suite, site build, installed-artifact
   interaction, or complete capture matrix.
6. The root one-click build scripts still need a fresh-machine bootstrap proof: they
   currently depend on Node/npm being available on `PATH`, and their silent-mode and
   installer-integrity contracts need end-to-end verification.
7. `docs/VALLEY-LAUNCH.md` contains historical installer evidence; update it with the
   verified `v1.2.12` release facts in its own focused documentation change.

These are evidence and completeness gaps, not permission to weaken validation or to
call unfinished coverage complete.

## Safe next steps

1. Re-inventory every branch, linked working tree, stash, tag, release, and divergence
   immediately before any integration or cleanup action.
2. Preserve and integrate the completed documentation and verification lanes without
   discarding independent work.
3. Keep the published `v1.2.12` tag, release, hashes, and assets immutable. Any future
   correction needs a new version rather than replacement assets or a moved tag.
4. Complete the remaining local acceptance, capture, and completeness evidence against
   the published source or a later explicitly versioned release candidate.
5. Verify any future release through the GitHub CLI: tag target, draft state, asset names,
   sizes, digests, downloads, release notes, and the final remote run.
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

This post-release handoff update is documentation-only work. Re-run
`git worktree list --porcelain`, `git branch --all --verbose --no-abbrev`, and
`git stash list` at resumption rather than relying on a static branch list in this file.
