# Sprout Hollow Valley implementation plan

## Product

Sprout Hollow Valley is a new, independent public Electron application and
repository derived from Sprout Hollow v1.1.0 at commit
`ccb5d03a2750b5a4c49d9b7d82e6ff068cca340d`. It preserves the original MIT
license, attribution, deterministic farming rules, economy, progression,
desktop shell, website, and documentation while rebuilding the game as a
third-person low-poly 3D open world.

The original `Ding-Ding-Projects/farming-game` repository and its saves remain
untouched. Sprout Hollow Valley uses a separate application identity, data
directory, update feed, executable, and fresh versioned save format.

## Locked product decisions

- Name: **Sprout Hollow Valley**.
- Repository: `Ding-Ding-Projects/sprout-hollow-valley`.
- Perspective: third-person low-poly 3D.
- World: one expanded authored valley rather than an endless procedural world.
- Starting farms: meadow, forest, riverland, mountain, coastal, marsh, arid,
  and alpine estates.
- Interiors: fast exterior doorway transitions into fully traversable room
  graphs.
- Doors: every visible external or internal door leads to a real room and is
  immediately or eventually usable.
- Sanitation: every building and factory has functional restrooms and hand
  washing.
- NPC population: exactly 240 persistent named NPCs.
- Life simulation: households, jobs, needs, schedules, memories, rivalries,
  relationships, and deterministic dynamic events.
- Player relationships: friendship, dating, marriage, shared homes, and
  optional adoption.
- Consequences: cozy and reversible, with no permanent NPC death or
  unrecoverable character loss.
- Conversations: authored and local; no online-generated dialogue.
- Assets: bundled authored 3D models, animation, textures, materials, and
  audio, with no runtime asset downloads.
- Input: complete keyboard/mouse and gamepad parity.
- Platform: Windows-only packaged application plus a responsive Pages site.
- Saves: fresh format only; no import or shared-save support.
- Excluded from the first complete release: multiplayer, online accounts,
  cloud saves, microtransactions, and paid content.

## Implementation worktrees

Major implementation areas are developed in separate Git worktrees so builds,
tests, generated assets, and edits cannot invalidate another lane's evidence.
Each worktree owns one feature branch and a non-overlapping path boundary:

- `feat/three-world`: Three.js rendering, third-person input and camera,
  collision, asset loading, and deterministic world-cell streaming.
- `feat/expanded-content`: the typed 5,000-definition content catalogue,
  reference validation, and catalogue documentation.
- `feat/enterable-interiors`: room graphs, real doors, stations, fixtures,
  restrooms, hand washing, sanitation, and interior validation.
- `feat/npc-life-simulation`: the 240 named NPCs, households, work,
  schedules, needs, dialogue, relationships, and reversible life events.
- `feat/valley-shell-docs`: product identity, desktop shell, responsive site,
  localization, accessibility inventory, and release-facing documentation.

Each lane commits and publishes its own branch without merging the default
branch. Integration reviews exact branch tips, resolves shared-manifest edits
centrally, runs local checks against the integrated commit, and proves each
source tip is contained before any worktree or branch becomes a cleanup
candidate. Long-running verification and packaging use their own clean
worktrees pinned to the exact commit being judged.

## World, farming, and content

The connected valley contains the player estate, town, market district,
residential areas, forest, river and wetlands, mountain and mine, coast,
alpine region, industrial district, roads, trails, wilderness resources, and
unlockable land.

The original contracts remain binding: four 28-day seasons, a 6:00 AM to 2:00
AM day, energy and time costs, weather, watering and withering, quality,
livestock care, production queues, building placement, levels 1-100, storage,
moving prices, market events, contracts, five selling channels, reputation,
credit, tax, deterministic simulation, and no unwinnable fail state.

The complete release must contain at least 5,000 unique non-NPC content
definitions, distributed as follows:

- 500 field crops.
- 250 trees, orchard plants, bushes, and vines.
- 150 animal species.
- 400 factory or production-facility definitions.
- 300 non-factory building definitions.
- 1,500 sellable products.
- 1,200 production recipes.
- 300 raw-material types.
- 400 functional decorations, paths, fences, signs, lights, and outdoor
  objects.

Typed registries define every crop, tree, animal, product, recipe, material,
factory, building, room, station, fixture, decoration, region, estate, and NPC
role. Completeness checks fail when a registered definition lacks rules,
assets, localization, documentation, tests, built-artifact interaction, or
capture evidence.

## Fully enterable buildings and factories

Every one of the 700 building and factory definitions has a complete exterior,
collision footprint, usable entrance and exit, separately streamed interior,
and room graph covering every floor, room, door, stair, elevator, and
restricted area. Interiors include functional lighting, furniture, storage,
safety equipment, utilities, signs, context-appropriate detail, NPC staffing,
visitor behavior, opening hours, and accessible navigation.

Every visible door has a real destination. A door may be locked only when the
game states the reason and provides an eventual access path through opening
hours, employment, permission, keys, friendship, family status, quests, or
progression. Decorative objects must never imitate occupiable buildings or
present fake doors.

Each building includes context-appropriate secondary rooms such as offices,
storage, staff rooms, kitchens, bedrooms, laboratories, workshops, locker
rooms, maintenance rooms, janitorial rooms, loading areas, waiting areas,
archives, inspection rooms, break rooms, and secure rooms. Every room has a
simulation or gameplay purpose.

### Restrooms and hand washing

Every building and factory contains at least one operational sanitation suite
with a toilet, accessible toilet configuration, sink with running water, soap,
drying method, waste bin, mirror, closable door, privacy behavior, accessible
interaction labels, and an accessible route.

Large workplaces and public venues add capacity-appropriate facilities such
as multiple stalls, urinals where appropriate, accessible stalls, changing
stations, showers, lockers, staff facilities, and public facilities.

Fixtures are interactive and persistent. Players and NPCs can use toilets and
complete hand washing with corresponding animation, sound, state, and
accessibility announcements. NPC schedules include restroom use, and workers
wash before relevant food, animal-care, medical, cosmetic, or production
tasks. Hygiene affects routines, workplace readiness, cleanliness,
inspections, and selected production quality without graphic illness or
irreversible punishment.

### Functional stations

Factories receive appropriate operational stations for intake, inspection,
storage, preparation, washing, production, quality control, packaging,
finished-goods storage, shipping, maintenance, cleaning, waste, recycling,
staff facilities, offices, first aid, safety equipment, restrooms, and hand
washing. Farms, homes, shops, civic buildings, mines, greenhouses,
restaurants, and service buildings receive purpose-specific station sets.

Every station has a real interaction, assigned NPC role, animation state,
input/output or service contract, failure explanation, accessibility copy,
and save representation. Production remains visible as workers move
materials, machines change state, queues advance, and finished goods appear.

## NPC and life simulation

The game ships exactly 240 persistent named NPCs. Each has authored identity,
appearance, traits, preferences, skills, home, household, work state,
deterministic schedule, seasonal and event variants, relationships, needs,
conversation memory, requests, gifts, conflicts, reconciliation state, and
context-aware building and station behavior.

Nearby NPCs use full movement, collision, animation, station, fixture, and
conversation simulation. Distant NPCs use deterministic schedule and event
resolution so the complete population remains active without keeping every
model loaded.

The simulation includes households, friendships, romances, marriages,
families, rivalries, employment changes, promotions, resignations, household
moves, community events, and changing routines. NPCs may temporarily move,
change jobs, argue, separate, become unavailable, or close a business, but
every major loss has a recoverable route and essential game content cannot be
removed permanently.

Player relationships support friendship, dating, marriage, shared homes, and
optional adoption. Relationship actions require clear mutual consent and are
reversible through respectful dialogue and household transitions.

Dialogue is authored, branching, and conditioned by location, room, task,
time, season, weather, relationship tier, household, work, recent events,
gifts, quests, nearby NPCs, and remembered actions. Every NPC has coverage for
introductions, routines, work, home life, seasons, weather, festivals,
relationship progression, conflict, reconciliation, requests, and major
community events.

## Architecture and interfaces

The project retains TypeScript, Vite, a hardened Electron process boundary,
Squirrel.Windows packaging, and deterministic pure game rules. Three.js
renders the world using bundled glTF assets and deterministic terrain-cell
streaming with distance-based detail, occlusion, bounded memory, collision,
navigation data, and explicit asset-load recovery.

Primary interfaces include:

- `EstateType` for the eight starting estate definitions.
- `WorldPosition` for region, terrain cell, local coordinates, facing, floor,
  and interior.
- `ContentRegistry` for all gameplay and world definitions.
- `InteriorGraph`, `RoomDef`, and `DoorDef` for floors, rooms, access rules,
  links, navigation, and exits.
- `StationDef` and `FixtureDef` for functional work, sanitation, safety,
  storage, furniture, and utility behavior.
- `NPCDef`, `NPCState`, `HouseholdState`, `EmploymentState`,
  `RelationshipEdge`, `SchedulePlan`, and `LifeEvent` for the life simulation.
- `ValleySaveV1` for deterministic world, farm, interior, station, fixture,
  NPC, household, relationship, employment, conversation, event, unlock, and
  settings state.

Rules and life simulation never read the wall clock or use unseeded
randomness. Saves are atomic, validated, integrity-checked, recoverable from
bounded backups, and explicitly reject unsupported future versions.

## Shell, accessibility, and documentation

Keyboard/mouse and gamepad provide complete parity, including remapping,
camera sensitivity, axis inversion, vibration control, focus navigation, and
controller-disconnect recovery. The camera supports orbit, zoom, recenter,
shoulder switching, obstruction handling, indoor profiles, reduced motion,
and accessible targeting.

Every user-facing application and page independently implements the shared
feature inventory: language modes, funny-level controls, emoji switch, School
mode, narration, scheduled and external settings, dim-sum surprise, regex
builders, notifications, Material 3 appearance and element editors, tabs,
groups and searches, landing pages and offline documentation, command palette,
destructive-action confirmation, local history, changelog, external-editor
handoff, exports, bulk actions, accessibility, responsive sizing, personal
vocabulary upload, toy locks and Support Tickets, unlock ladders, shared-link
graphics, app-logo customization, file conversion, Ollama management, and all
other repository-wide contracts.

Documentation covers every gameplay definition, room, station, fixture,
estate, region, NPC system, relationship system, setting, failure mode,
security boundary, and verification path. The building catalogue includes a
searchable room-and-station inventory proving restroom, hand-washing, staffing,
NPC-access, and door-access coverage.

## Verification and release acceptance

Local tests compare inherited behavior with Sprout Hollow v1.1.0 and validate
all content totals, deterministic rules, saves, terrain streaming, controls,
accessibility, and performance.

For every building and factory, automated built-artifact verification must
locate or place it, enter it, enumerate every room and door, prove every door's
destination and access path, traverse every room, use every station, use the
restroom, complete hand washing, observe assigned NPC behavior, exit, save,
reload, and repeat.

Long-running deterministic simulations cover all estates, seasons, NPC
schedules, relationships, jobs, businesses, buildings, factories, room
transitions, and events. Verification fails on stuck NPCs, unreachable rooms
or stations, contradictory relationships, invalid households, queue deadlocks,
permanently inaccessible doors, or irreversible character loss.

The packaged target is 60 FPS on the supported default preset and a usable 30
FPS on the low preset, with bounded terrain, interior, NPC, queue, and event
memory. Simulation results must not depend on frame rate.

Each user-facing surface maintains a hand-written completeness inventory and
an executable negative regression that turns red when any required
implementation, registration, localization, documentation article, test,
built-artifact interaction, capture, or evidence row is removed.

The Windows release uses unsigned Squirrel.Windows artifacts, explicit
unsigned warnings, verified hashes, a unique non-draft release, complete
update assets, workflow timing evidence, and an unused public dim-sum code
name. GitHub Actions builds and publishes but does not run tests, lint,
type-checking, static analysis, or coverage gates; those checks run locally.

Completion requires all 700 structures to be fully enterable and detailed,
every visible door to have a real eventual destination, all sanitation and
work stations to function, all 240 NPCs to simulate and converse correctly,
all local checks to pass, the installed application to be exercised through
the approved headless route, the responsive site to deploy, and the complete
downloadable `v1.0.0` release to be verified.
