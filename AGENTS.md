# Sprout Hollow Valley contributor instructions

These instructions apply to every change in this repository. Read `PLAN.md`
before implementation. The plan is a binding product contract, not an ideas
list.

## Product boundaries

- This is the independent Sprout Hollow Valley application. Do not mutate or
  write into the original Sprout Hollow application's data directory or save.
- The complete release contains at least 5,000 unique non-NPC content
  definitions using the exact category minima in `PLAN.md`, plus exactly 240
  persistent named NPCs.
- All 400 factories and 300 other buildings are fully enterable. Every visible
  door has a real destination and an immediate or eventual access path.
- Every building and factory has functional restrooms, accessible sanitation,
  hand washing, detailed rooms, context stations, and NPC use behavior.
- Do not satisfy a count with placeholder names, duplicate definitions, empty
  rooms, decorative-only stations, fake doors, or unreachable content.
- Keep the tone cozy and reversible. Do not add permanent NPC death or an
  irreversible path that removes a unique character or essential feature.

## Architecture

- Keep rules and life simulation deterministic. They must not read the wall
  clock or use unseeded randomness.
- Keep simulation independent of rendering and frame rate. Distant world and
  NPC simulation must remain correct when their 3D assets are unloaded.
- Use typed registries and exact-reference validation for all content, rooms,
  doors, fixtures, stations, NPCs, schedules, dialogue, and events.
- Keep the Electron main process isolated from the renderer. Use a hardened,
  typed preload boundary with context isolation and no renderer Node access.
- Bundle application assets locally. Do not add a runtime CDN, analytics,
  telemetry, generated online dialogue, or runtime asset download.
- Preserve atomic saves, bounded backups, integrity validation, explicit save
  versions, and safe rejection of unsupported future data.

## User-facing surfaces

- Every application page, panel, dialog, landing page, and documentation page
  independently implements the repository-wide language, accessibility,
  appearance, navigation, search, regex-builder, notification, history,
  export, customization, and safety contracts recorded in `PLAN.md` and the
  completeness inventory.
- A feature is incomplete until its implementation, localization,
  documentation, focused local test, built-artifact interaction, and real
  capture evidence all exist.
- Every search, dropdown, picker, overflow menu, and context menu exposes local
  plain-text search and its own adjacent full regex builder.
- Keep keyboard/mouse and gamepad behavior equivalent. Preserve visible focus,
  reduced motion, screen-reader announcements, remapping, and controller
  disconnect recovery.
- Public repository prose uses ordinary professional technical language and
  must not contain private working vocabulary, credentials, host details, or
  local machine paths.

## Verification

- Add focused local tests for every behavior change and run the relevant
  suites before committing. Run the complete local suite, type check, build,
  site build, package build, and installed-artifact verification before a
  stable release.
- Maintain hand-written per-surface and per-content completeness inventories.
  Their negative regressions must fail when a required exact row,
  implementation, localization, document, test, interaction, capture, or
  evidence item is removed.
- For every building and factory, verification must enter it, enumerate and
  traverse every room, resolve every door, use every station, use the restroom,
  complete hand washing, observe assigned NPC behavior, save, reload, and
  repeat against the packaged artifact.
- Test deterministic multi-year simulation for stuck NPCs, impossible
  schedules, invalid households, contradictory relationships, queue deadlocks,
  inaccessible rooms, and irreversible character loss.
- Automated GitHub workflows build and publish only. Do not add test, lint,
  type-check, static-analysis, coverage, or other code-quality gates to GitHub
  Actions. State truthfully in release notes which local checks actually ran.

## Packaging and release

- Windows packaging uses unsigned Squirrel.Windows artifacts and never uses or
  requests code signing. Keep the explicit unsigned-artifact warning beside
  update installation controls.
- Each release is unique and non-draft, publishes the complete update asset
  set, records hashes and workflow timing, and uses one unused public dim-sum
  catalogue code name without copying the catalogue photograph into this
  repository.
- Do not force-push, recycle tags, delete unmerged work, commit credentials, or
  discard another contributor's changes.
