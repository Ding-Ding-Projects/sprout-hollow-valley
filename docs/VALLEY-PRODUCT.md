# Sprout Hollow Valley product contract

## Purpose and current status

Sprout Hollow Valley is a new Windows-only third-person, low-poly 3D open-world
farming and life-simulation game. It is derived from Sprout Hollow, but it is a
separate installed product with separate local data, saves, updates, and release
artifacts.

This document defines the complete product target. It is not evidence that the
target has already shipped. The inherited shell and farming rules provide a useful
foundation; the 3D valley, the complete content registries, all 700 enterable
structures, and the full surface evidence remain subject to the acceptance checks
below. Current per-surface status is recorded in
[VALLEY-COMPLETENESS.md](VALLEY-COMPLETENESS.md).

## Product at a glance

| Contract | Sprout Hollow Valley decision |
| --- | --- |
| Product | Sprout Hollow Valley |
| Platform | Packaged Windows application and responsive GitHub Pages site |
| Genre | Farming and life simulation in one authored open world |
| Presentation | Third-person low-poly 3D with bundled models, animation, textures, materials, and audio |
| Camera | Orbit, zoom, recenter, shoulder switching, obstruction handling, indoor profiles, reduced motion, and accessible targeting |
| Starting estates | Meadow, forest, riverland, mountain, coastal, marsh, arid, and alpine |
| Population | Exactly 240 persistent named non-player characters |
| Non-NPC content | At least 5,000 unique definitions across the nine locked categories below |
| Structures | 400 factories or production facilities plus 300 other buildings; all 700 are fully enterable |
| Saves | Fresh, versioned Valley saves only; no Sprout Hollow save import or shared save directory |
| Online boundaries | No multiplayer, online account, cloud save, runtime asset download, online-generated dialogue, microtransaction, or paid content in the first complete release |

### Playable-product boundary

The game itself exists only in the packaged desktop Electron application. The responsive
Pages site is a non-playable landing, marketing, documentation, download, settings,
accessibility, and release-information surface. It never embeds, hosts, streams, or runs
gameplay, a playable 3D scene, the farm simulation, NPC simulation, or desktop game input.

The site may later present genuine screenshots from the packaged application and verified
links to downloadable releases. Those items are evidence and distribution information,
not playable gameplay. No screenshot, capture, or packaged interaction proof was produced
by the documentation work that created this contract.

## Independent installed identity

The original Sprout Hollow repository, installation, and saves must remain untouched.
The following boundaries are independent and must never fall back to the original
product's values:

| Boundary | Valley contract | Owning implementation |
| --- | --- | --- |
| Package identity | A unique package name and application ID containing the Valley product identity | `package.json` build metadata |
| Display identity | **Sprout Hollow Valley** in the title bar, About surface, installer, executable metadata, and release assets | `package.json`, `electron/main.ts`, `src/shell/app.ts` |
| Executable and installer | Valley-specific executable and Squirrel.Windows artifact names | `package.json` packaging configuration |
| User-data directory | A Valley-specific Electron application path that cannot resolve to the Sprout Hollow directory | `electron/main.ts` before any `app.getPath('userData')` read or write |
| Save identity | A fresh `ValleySaveV1` schema, Valley-specific filename or subdirectory, strict validation, atomic writes, and bounded recovery backups | `electron/main.ts`, preload bridge, and the Valley save module |
| Update identity | A Valley-only HTTPS feed, product slug, package hashes, and Squirrel.Windows assets | update configuration and release metadata |
| Settings and history | Valley-specific stores below the Valley user-data directory | `src/shell/core/store.ts` and local history modules |

A custom user-selected logo may change visible branding inside the application or site,
but it must never change any stable identity in this table. An update, reset, uninstall,
or save operation must resolve its target from the Valley identity and must not probe or
modify the original product's data.

## Authored valley and eight estates

The world is one connected, authored valley rather than an endless procedural map. It
contains the player estate, town, market district, residential areas, forest, river and
wetlands, mountain and mine, coast, alpine region, industrial district, roads, trails,
wilderness resources, and unlockable land.

Players choose one of eight starting estates:

1. Meadow
2. Forest
3. Riverland
4. Mountain
5. Coastal
6. Marsh
7. Arid
8. Alpine

Each estate changes terrain, starting layout, resources, travel, farming constraints,
and early opportunities without creating an unwinnable state. The inherited four
28-day seasons, 6:00 AM to 2:00 AM day, energy and time costs, weather, quality,
livestock, production, economy, storage, reputation, credit, tax, and deterministic
simulation contracts continue to apply.

## Locked content baseline

The complete release contains at least 5,000 unique non-NPC definitions. The exact
category baselines from `PLAN.md` are:

| Category | Minimum unique definitions |
| --- | ---: |
| Field crops | 500 |
| Trees, orchard plants, bushes, and vines | 250 |
| Animal species | 150 |
| Factories or production facilities | 400 |
| Non-factory buildings | 300 |
| Sellable products | 1,500 |
| Production recipes | 1,200 |
| Raw-material types | 300 |
| Functional decorations, paths, fences, signs, lights, and outdoor objects | 400 |
| **Total baseline** | **5,000** |

These categories are counted by stable unique definition ID. A translated name, skin,
quality tier, placement, state, or duplicate registration does not create another unique
definition. NPC definitions are excluded from this total and are checked separately.
Every definition requires rules, bundled assets, localization, documentation, focused
tests, built-artifact interaction evidence, and a real capture record before it may count
toward release acceptance.

Typed registries cover crops, trees, animals, products, recipes, materials, factories,
buildings, rooms, stations, fixtures, decorations, regions, estates, and NPC roles.
Registry validation must reject duplicate IDs, missing references, unreachable outputs,
unlocalized fields, missing assets, and definitions without their evidence links.

## All 700 structures are fully enterable

The 400 factory or production-facility definitions and 300 non-factory building
definitions form one 700-structure acceptance set. Every one of those 700 structures is
fully enterable; none may satisfy the count as a facade, inaccessible prop, decorative
shell, or duplicate variant.

Each structure requires:

- a complete exterior, collision footprint, usable entrance and exit, and separately
  streamed interior;
- a traversable room graph for every floor, room, visible door, stair, elevator, and
  restricted area;
- a real destination and an immediate or clearly explained eventual access path for every
  visible door;
- functional lighting, furniture, storage, utilities, safety equipment, signs, opening
  hours, staff behavior, visitor behavior, and accessible navigation;
- context-appropriate working stations with real input, output, service, animation,
  failure, accessibility, and save-state contracts;
- at least one operational sanitation suite with an accessible toilet arrangement, sink,
  running water, soap, drying method, waste bin, mirror, privacy behavior, accessible
  labels, and an accessible route; and
- persistent player and NPC interaction state across save and reload.

Factories also need functional intake, inspection, preparation, production, quality
control, packaging, storage, shipping, maintenance, cleaning, waste, recycling, first-aid,
safety, staff, restroom, and hand-washing stations appropriate to their purpose.

## Exactly 240 persistent named NPCs

The game ships exactly 240 persistent named NPCs. Each has an authored identity,
appearance, traits, preferences, skills, home, household, employment state,
deterministic schedule, seasonal and event variants, relationships, needs,
conversation memory, requests, conflicts, reconciliation state, and behavior tied to
real rooms, stations, and fixtures.

Nearby NPCs use full movement, collision, animation, interaction, and conversation.
Distant NPCs use deterministic schedule and event resolution so the complete population
continues to live without requiring every model to remain loaded. Friendship, dating,
marriage, shared homes, and optional adoption require clear consent and reversible,
respectful transitions. Major losses remain recoverable; there is no permanent NPC death
or unrecoverable character loss.

Dialogue is authored and local. It may react to place, room, work, time, season, weather,
relationships, household, recent events, gifts, quests, nearby characters, and remembered
actions, but it is never generated by an online service.

## 3D runtime contract

The packaged game retains TypeScript, Vite, a hardened Electron boundary,
Squirrel.Windows packaging, and deterministic pure game rules. Three.js renders bundled
glTF assets for the authored world. Terrain-cell streaming, distance-based detail,
occlusion, collision, navigation, interiors, and recovery from asset-load failures must
have explicit memory and timing bounds.

The world simulation never reads the wall clock and never uses unseeded randomness.
Simulation results do not depend on frame rate. The packaged target is 60 frames per
second on the supported default preset and a usable 30 frames per second on the low
preset, with bounded terrain, interior, NPC, queue, and event memory.

Keyboard and mouse and gamepad must have complete parity, including remapping, camera
sensitivity, axis inversion, vibration, focus navigation, and controller-disconnect
recovery.

## Accessible Material 3 farm theme

Both surfaces use one accessible Material 3 design system shaped for the Valley rather
than the inherited pixel-art shell. Seed and leaf greens, soil and timber neutrals, warm
harvest accents, sky and water roles, and cream surfaces are semantic roles rather than
hard-coded decoration. Material 3 typography, component anatomy, shape, elevation, state
layers, and motion remain readable over the farm theme in light, dark, and high-contrast
settings.

Every interactive state has a text or structural equivalent, visible focus, sufficient
contrast, a reduced-motion path, and an accessible name. The desktop shell supports the
100%, 125%, 150%, and 200% scale ladder and a usable narrow-window layout. The Pages site
supports approximately 320-pixel viewports, touch and keyboard input, viewport-bounded
overlays, internally scrolling wide content, landscape and portrait layouts, and no
sideways body scroll. Appearance customization never changes product identity or weakens
focus, contrast, target size, or semantic structure.

## Universal surface contract

The desktop shell and the responsive Pages site independently implement the same complete
universal user-interface feature contract. A feature on one surface does not satisfy the
other. This shared contract governs each surface's own navigation, settings, utilities,
accessibility, documentation, and evidence presentation; it does not turn the site into a
game client. Desktop gameplay controls and simulation remain exclusive to the packaged
application and are not applicable to the non-playable site. The universal contract
includes:

- English, playful Hong Kong Cantonese, and compact bilingual modes; independent English
  and Cantonese funny-level controls; an emoji switch; School mode; and optional serialized
  narration;
- scheduled and external settings, a local dim-sum surprise, full anchored ECMAScript
  regex builders for every search, dropdown, picker, menu, and context menu, and
  non-blocking notifications;
- Material 3 tokens and components, persisted per-element appearance editors, and an
  infinite color picker with bidirectional named, HEX/HEX8, RGB/A, HSL/A, HSV/HSB, HWB,
  Lab/LCH, OKLab/OKLCH, and CMYK translation;
- persistent tabs, pinning, groups, four independent tab searches, both close-by-text
  actions, offline documentation, a complete landing surface, and the `Ctrl+Shift+F`
  command palette with exact teleports;
- destructive-action confirmation, local history, changelog, external-editor handoff,
  export, bulk actions, accessibility, responsive sizing, and a local personal-vocabulary
  JSON upload;
- per-element toy locks, local Support Tickets guidance, the unlock ladder, local TOTP QR
  pairing, an authenticator destination, and protected redacted credential and display-name
  history;
- the shared-link graphic, local app-logo customization, an offline local file converter,
  and an independent local Ollama suite manager; and
- truthful 3D product, content-count, NPC-count, and enterable-structure evidence.

The detailed hand-written rows, implementation targets, localization targets, tests,
packaged interaction scenarios, capture targets, and current states are in
[VALLEY-COMPLETENESS.md](VALLEY-COMPLETENESS.md).

## Evidence and release acceptance

Release acceptance is based on executable registries and real built artifacts, not this
document alone.

For content, checks must prove the nine exact category baselines, uniqueness, reference
integrity, exactly 240 named NPCs, and the required implementation, asset, localization,
documentation, test, interaction, and capture links for every counted definition.

For each of the 700 structures, a packaged interaction run must locate or place the
structure, enter it, enumerate and traverse every room and door, prove each access path,
use every station, use the restroom, complete hand washing, observe assigned NPC behavior,
exit, save, reload, and repeat. The run fails for fake doors, unreachable rooms or stations,
missing sanitation, queue deadlocks, stuck NPCs, or state that does not survive reload.

Long-running deterministic simulations cover all estates, seasons, NPC schedules,
relationships, jobs, businesses, structures, room transitions, and events. Real captures,
when they are produced, must come from the packaged Windows application and deployed
responsive site. Source previews, mocked bridges, injected states, and reused captures are
not acceptance evidence. This documentation run produced no capture proof; genuine
packaged screenshots and verified release links may be added later with matching build
identity and evidence records.

Each surface also requires the exact-match negative regression described in
[VALLEY-COMPLETENESS.md](VALLEY-COMPLETENESS.md#executable-negative-regression-design).
The complete release remains blocked until every required row has implementation,
documentation, localization, focused tests, packaged interaction proof, and real capture
evidence.
