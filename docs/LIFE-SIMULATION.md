# Life simulation

Sprout Hollow Valley's life simulation is a typed, deterministic system for the
valley's persistent population. Authored definitions are kept separate from
mutable runtime state, and every logical result is derived from the save seed,
the in-game calendar, explicit inputs, and stable IDs. The life modules do not
read the wall clock, call an online dialogue service, or use unseeded randomness.

## Content and population contracts

The shipped contract contains exactly **240 persistent named NPC definitions**
and **80 households**. The 240 names and identities are explicitly authored;
each consecutive group of three belongs to one household. Deterministic helpers
attach the rest of each typed `NPCDef`: appearance seed, three traits,
preferences, skills, home, initial employment, schedule, dialogue profile,
requests, and romance eligibility. Runtime values such as needs, current
activity, memories, availability, employment status, and simulation tier live
in `NPCState`, never in the authored definition.

Household blueprints assign every NPC exactly once. `HouseholdState` stores the
mutable members, home definition, optional active home instance, shared funds,
and a bounded temporary-move state. Initial `RelationshipEdge` records connect
family members and seed friendships, coworkers, rivalries, and romances with
explicit affinity, trust, romance, rivalry, and memory fields.

NPCs are separate from the exact **5,000 non-NPC definitions**:

| Category | Exact count |
| --- | ---: |
| Field crops | 500 |
| Perennial plants | 250 |
| Animal species | 150 |
| Factories | 400 |
| Buildings | 300 |
| Products | 1,500 |
| Recipes | 1,200 |
| Raw materials | 300 |
| World objects | 400 |
| **Total** | **5,000** |

Every `NonNPCDefinition` carries a stable ID, unique registry and localization
keys, asset and documentation keys, a display name, a category, and rule tags.
The 400 factory and 300 building definitions also form the exact **700
`StructureDefinition` records**. These definitions are the complete possible
catalogue; they are not 700 structures that must be spawned into every save.

### Sparse and player-built structures

`StructureDefinition` describes an enterable blueprint, its supported station
roles, capacity, kind, and whether the player may build instances. A
`StructureInstance` represents one structure that currently exists and carries
its own ID, definition ID, valley/household/player owner, enabled state, and
station-instance IDs.

`createStructureInstanceRegistry()` indexes only the supplied live instances.
An empty registry is valid. Immutable upsert and removal helpers allow the
valley or the player to add and remove instances without materializing all 700
definitions. Definition references remain stable when an instance is absent.

Employment follows the same separation:

- `StationRoleDef` names a reusable capability, its valid schedule activities,
  and whether hygiene is required.
- `EmploymentRoleDef` refers to station roles by stable ID, declares permitted
  structure kinds, and provides a default shift.
- `EmploymentAssignment` refers to an employment role, a structure definition,
  and a station role. Its `structureInstanceId` is nullable, so authored work can
  remain valid before a valley or player-built instance exists.
- Structure definitions list compatible station-role IDs instead of embedding
  NPC-specific jobs. This keeps assignment cost proportional to the 240 NPCs
  and currently live structures, not to every possible structure definition.

`bindEmploymentInstances()` deterministically selects from enabled instances
of the required definition, after sorting them by stable instance ID. It keeps
an existing valid binding, leaves the field `null` when no instance exists, and
can bind a later player-built instance through `rebindSimulationStructures()`.
Household homes use the same deterministic sparse-binding model, preferring an
instance owned by that household.

## Calendar, schedules, and needs

The calendar has four 28-day seasons and 112 days per year. `absoluteDay` is the
canonical zero-based timeline; displayed years and season days are one-based.
Minutes wrap within a 1,440-minute day, and a new simulation starts at 06:00 on
spring 1 of year 1. Seeded daily weather is derived from the simulation seed and
absolute day.

Every NPC has weekday, weekend, seasonal, and life-event schedule blocks. Block
IDs are stable and destinations are typed as home, work, community location, or
a toilet/sink/shower fixture. Selection precedence is:

1. an eligible life-event variant;
2. an eligible seasonal variant;
3. the ordinary weekend or weekday plan.

Conditions may filter by season, weather, active life-event kind, and
employment status. Baseline schedules cover the whole day and include sleep,
meals, commuting, work, errands, leisure, social time, rest, toilet use,
hand-washing, and showers. Work destinations retain a structure-definition and
station-role reference even when the live instance is temporarily absent.

`NeedState` contains four bounded values from 0 to 100:

- `energy`, `social`, and `hygiene` are wellbeing gauges; higher is better.
- `hunger` is pressure; higher means hungrier.

Each activity applies deterministic per-minute effects. Entering a toilet,
hand-washing, or shower block also applies an explicit one-time effect: toilet
use reduces hygiene by 8, hand-washing restores 18, and showering restores 35
hygiene plus 3 energy. The values are clamped and rounded to three decimal
places. Completed hygiene routines create expiring local memories, and station
roles expose `hygieneRequired` so downstream workplace readiness and production
rules can enforce sanitation consistently.

## Near and distant simulation tiers

The `near` and `distant` tiers have identical logical semantics. Both tiers use
the same calendar, schedule selection, need effects, event resolution,
employment and household bindings, memories, and state transitions.

The caller supplies a set of nearby NPC IDs. A nearby NPC receives tier
`near` and a normalized `presentationProgress` value for movement and animation;
a distant NPC receives tier `distant` and zero presentation progress. No logical
outcome branches on that presentation value. Consequently, moving an NPC
between tiers changes rendering work without changing their life result.

Advancement is segmented at schedule and midnight boundaries instead of being
tied to rendered frames. `simulateDays()` advances whole days through the same
logical path, making multi-year simulation practical without loading all NPC
models or all structure instances.

### Three.js presentation adapter

`src/renderer3d/npcs` bridges that complete logical population into the live
Three.js scene without becoming a second simulation. `NpcPresentationAdapter`
validates that the supplied definitions and state cover exactly 240 unique,
named NPCs, resolves a deterministic presentation placement for every member of
the roster, and materializes only NPCs in the viewer's streamed exterior or
interior space and within the configured radius. Culling removes an avatar and
its moving collision proxy; it does not remove, pause, or modify the NPC's life
state.

The default placement resolver covers every typed schedule destination:

- commute blocks follow a deterministic exterior path between the bound home
  and workplace;
- community blocks use stable authored valley anchors plus per-NPC crowd and
  schedule-progress offsets;
- home and work blocks carry the bound structure instance and corresponding
  primary or operations room;
- toilet, sink, and shower blocks resolve to the structure's real restroom
  room context.

The resolver is replaceable, so an authored valley/interior renderer can supply
exact door, room, station, fixture, and navigation anchors while keeping the
same lifecycle. The procedural fallback avatars use only bundled Three.js
geometry and materials. Their low-poly appearance, pose phase, facing, gait,
and work gesture come from the NPC definition and logical
`presentationProgress`; there are no model downloads, wall-clock animation
inputs, or unseeded random values.

The integration surface is intentionally small:

```ts
const npcPresentation = createNpcPresentationAdapter({
  parent: threeRuntime.scene,
  collision: threeRuntime.collision,
})

const frame = npcPresentation.update({
  state: lifeState,
  viewer: {
    position: playerPosition,
    space: { kind: 'exterior', worldId: 'sprout-hollow-valley' },
  },
})
```

`frame.nearbyNpcIds` is the presentation adapter's only feedback to the life
layer; callers can pass it to the next deterministic simulation advancement to
select near-tier presentation progress. The adapter never advances or mutates
the state itself. `frame.interactionTargets` supplies stable collider IDs,
Three objects, positions, distances, accessible talk labels, and a selected
local authored line. Ray-based callers can map a collision hit through
`interactionTargetForCollider()`, while `conversationPrompt()` and
`conversationPrompts()` expose one topic or all 12 authored topics using the
current location, room, activity, calendar, relationships, events, nearby
population, memories, gifts, and requests.

## Local authored dialogue

Dialogue is bundled and local. Each of the 240 NPCs has a contextual line and
an unconditional fallback for each of 12 topics: introduction, routine, work,
home, season, weather, festival, relationship, conflict, reconciliation,
request, and community event. This produces 5,760 deterministic local lines.

Context conditions can use all of these axes:

- location and room;
- current activity and minute range;
- season and weather;
- friendship tier and household;
- employment status;
- recent life events;
- gift tags and quest IDs;
- nearby NPC IDs;
- remembered action keys.

`matchesDialogueCondition()` evaluates the complete condition object.
`selectDialogue()` filters by speaker and topic, then sorts matches by priority
descending and stable line ID ascending. A known NPC/topic pair therefore uses
the contextual line when eligible and otherwise uses its local fallback. An
unknown speaker or a caller-supplied line set with no match returns `null`.

## Relationships and consent

Player/NPC relationships are explicit state machines:

- Friendship: `stranger` -> `acquaintance` -> `friend` -> `close-friend`.
- Romance: `none` -> `dating` -> `engaged` -> `married`.
- Shared home: an independent boolean available while dating, engaged, or
  married.
- Adoption: `none` -> `considering` -> `approved` -> `placed`.

Every action, including a reversal, requires affirmative player and NPC
consent and records that consent with the in-game day. Dating may end,
cohabitants may move apart, an engagement or marriage may separate, and an
adoption plan may be cancelled before placement. These operations preserve
friendship and unrelated commitments. A placed adoption cannot be cancelled;
if partners separate, the child remains a cared-for family commitment.

Transitions are immutable. Invalid days, missing consent, skipped prerequisite
stages, duplicate steps, or unsupported reversals return `ok: false`, an
explanatory message, and a cloned unchanged state. Callers must also respect the
authored `NPCDef.romanceable` flag before offering romance actions.

## Cozy reversible life events

The event model supports arguments, reconciliation, temporary moves, returns
home, job changes, promotions, resignations, business breaks and reopenings,
community celebrations, and routine changes. Events have stable IDs,
participants, start and resolution days, status, and optional recovery links.

Durations are bounded, and event effects adjust needs, availability,
households, employment, relationship metrics, and memories without permanent
NPC death or unrecoverable character removal. Disruptive events schedule a
cozy recovery when they resolve:

- argument -> reconciliation;
- temporary move -> return home;
- resignation -> job change;
- business break -> business reopen.

Recovery events link back to their source and are created at most once.
Applying the same event ID twice is an immutable no-op. Due events resolve in a
stable order by resolution day, start day, and event ID.

## Determinism

All logical inputs are explicit. The simulation seed is normalized to an
unsigned 32-bit value. Weather and sparse structure assignment use seeded,
salted RNG streams; event identity uses stable hashing of the seed, kind, day,
participants, and source. Participant IDs and candidate structure instances
are sorted before a deterministic choice is made.

The life modules do not consult `Date`, timers, frame delta, or `Math.random`.
Given the same definitions, seed, initial state, elapsed in-game minutes,
nearby-ID set, and structure instances, they produce the same logical result.
Tier-specific presentation progress is excluded from gameplay decisions.

## State and save considerations

`LifeSimulationState` is the complete mutable life snapshot: seed, calendar,
NPCs, households, employment records, NPC relationship edges, player
relationships, sparse structure instances, active events, and event history.
Definitions and registries are static content and should be referenced by
stable ID rather than copied into each save.

`createLifeSimulation()` clones authored and caller-owned arrays before
returning mutable state. `rebindSimulationStructures()` snapshots replacement
instances, updates household and employment bindings deterministically, and
synchronizes each NPC's employment status. Save readers should preserve nullable
instance bindings, event source IDs, consent history, memories and expiry days,
and the absolute calendar position. Unsupported or malformed save data should
be rejected before simulation rather than silently repairing unknown IDs.

## Public module map

There is no required global singleton; consumers import the focused modules
directly.

| Module | Primary public contract |
| --- | --- |
| `src/life/types.ts` | Constants and all definition, state, schedule, dialogue, relationship, event, structure, and validation types. |
| `src/life/catalog.ts` | Exact content/structure registries, role registries, stable ID and lookup helpers, sparse instance registry helpers, and `validateContentCatalog()`. |
| `src/life/npcs.ts` | Authored identity roster, `NPC_DEFINITIONS`, 80 household blueprints, and initial NPC relationship edges. |
| `src/life/state.ts` | `createLifeSimulation()` for a cloned deterministic initial state. |
| `src/life/simulation.ts` | Calendar/weather helpers, schedule selection, needs and hygiene effects, sparse binding, minute/day advancement, and `simulateDays()`. |
| `src/life/relationships.ts` | Immutable consent-gated relationship transitions. |
| `src/life/events.ts` | Deterministic event creation, idempotent application, individual resolution, and stable due-event resolution. |
| `src/life/dialogue.ts` | Local dialogue catalogue, condition matching, and stable dialogue selection. |
| `src/renderer3d/npcs` | Deterministic placement, bounded procedural avatar and collision lifecycle, interaction targets, and local authored conversation prompts for all 240 NPCs. |

## Validation and failure behavior

`validateContentCatalog()` returns `{ ok, problems }` and accepts optional
registry overrides so callers can validate production or fixture data without
mutating the frozen built-ins. It reports, rather than hides:

- any total other than exactly 5,000 non-NPC definitions or 700 structures;
- category-count, stable-ID sequence, duplicate name/key/ID, blank-field, and
  missing-rule-tag errors;
- structure-to-content mismatches, invalid capacities, missing sanitation or
  purpose-specific roles, and incomplete factory role coverage;
- unknown or duplicate station/employment references and invalid shifts;
- malformed sparse instances, unknown definitions, invalid player-built
  assignments, blank owner/station IDs, and duplicate instance/station IDs.

The NPC module fails fast during initialization if the roster is not exactly
240 unique names and IDs in exactly 80 unique three-person households. Stable
ID constructors reject non-positive or unsafe indexes. Initial-state creation
throws when an NPC has no usable weekday schedule block. Numeric simulation
inputs are bounded and normalized; missing live structure instances remain
explicitly unbound. Relationship transitions return descriptive refusals,
unknown event resolutions are no-ops, and dialogue selection returns `null`
when no line is eligible.

## Verification status

This implementation pass intentionally did not run tests, lint, type checks,
static analysis, reviews, audits, or captures. That speed-focused boundary is
not evidence that those checks pass; the repository's normal verification must
be run in a later verification-enabled pass before treating the implementation
as release-proven.
