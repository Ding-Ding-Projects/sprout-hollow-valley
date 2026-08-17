# Sprout Hollow Valley interior systems

This document defines the typed, deterministic interior contract for every
enterable structure in Sprout Hollow Valley. The current catalog contains
exactly 700 structures: 400 factories and 300 non-factory buildings. Those
counts supersede earlier planning totals for this subsystem.

The contract is deliberately generic. A new registry entry is not valid merely
because the catalog has the expected total. Every individual definition must
provide a real traversable interior, real door destinations, an eventual access
path for every locked door, an operational accessible restroom, and the
stations appropriate to the structure's work and public purpose.

## Public model

The interior module exports five primary definition models.

### `InteriorGraph`

`InteriorGraph` is the complete interior definition for one registered
structure. It owns the structure identity and category, its public entry room,
and the complete collections of rooms, doors, stations, and fixtures. It also
provides the information needed to resolve exterior transitions, internal
navigation, accessibility, and restricted access without reading renderer
state.

Each graph must be self-contained. A consumer must be able to answer all of
the following from the graph and the explicit runtime state:

- where an exterior entrance leads;
- which rooms are connected by each internal door;
- why a door is unavailable and how it can eventually become available;
- whether every required destination is reachable;
- where every station and fixture is installed;
- whether the restroom and hand-washing sequence is operational; and
- which interactions support players and NPCs.

### `RoomDef`

`RoomDef` describes a real occupiable room. Its stable identifier is unique
within the graph. It records the floor and navigation region, accessibility,
and the doors, stations, and fixtures that belong to the room.

A room cannot exist only as a label or destination token. It must have a
walkable navigation area and must participate in the graph's reachability
proof. Restricted rooms remain real rooms; their access rule must still expose
an eventual route.

### `DoorDef`

`DoorDef` describes one real transition. It distinguishes exterior entrances
and exits from internal links, identifies both sides of the transition, and
defines any immediate or eventual access rule. Visible doors are definitions,
not decoration.

An internal door connects two declared rooms. An exterior door connects a
declared exterior transition point to a declared room. A locked door must have
a stated reason and at least one deterministic eventual-access condition, such
as opening hours, employment, permission, a key, friendship or family status,
a quest, or progression. A permanent lock with no satisfiable route is invalid.

### `StationDef`

`StationDef` describes an operational work or service location. It belongs to
one room and declares its purpose, accessibility, actor support, and
interaction contract. Production stations also declare their input/output or
service role so runtime state can represent visible progress and a useful
failure reason.

Stations are functional definitions rather than scenery. Each required
station must have a reachable interaction point and must support the actor
types declared by its structure.

### `FixtureDef`

`FixtureDef` describes a persistent interactive utility, safety, furniture, or
sanitation fixture. It belongs to one room and declares its fixture role,
operational state, accessibility, and supported actors.

Sanitation fixtures additionally participate in the ordered hygiene state
machine. A fixture with the right label but no usable interaction cannot
satisfy the contract.

## Supporting runtime concepts

The primary definitions are immutable catalog data. Runtime concepts keep the
mutable state separate:

- a stable actor reference identifies a player or NPC;
- actor location records whether that actor is outside, in transit, or in a
  specific room;
- a use state records idle, moving, queued, using, completed, cancelled, or
  blocked interaction status;
- station and fixture state records availability, occupancy, progress, and any
  deterministic refusal reason;
- access state records the explicit facts used by a door rule; and
- sanitation progress records the next valid hygiene step for each actor.

All transitions return new plain data. Definitions are never mutated, and
runtime operations do not consult the wall clock, renderer, DOM, audio engine,
or unseeded randomness.

## Fail-closed invariants

Validation applies to the entire registry and then to every structure in stable
identifier order. The registry is invalid when any row below is not satisfied.

| Area | Required invariant |
|---|---|
| Catalog totals | Exactly 700 structures are registered: exactly 400 factories and exactly 300 non-factory buildings. |
| Identity | Structure, graph, room, door, station, and fixture identifiers are non-empty and unique in their applicable scope. |
| Graph ownership | Every registered structure resolves to exactly one `InteriorGraph`, and no graph refers to a missing or different structure. |
| Real rooms | Every graph has a declared public entry room and at least one occupiable room with a walkable navigation area. |
| Traversal | Every required room, door endpoint, station, fixture, and exit is reachable from the public entry, immediately or after satisfying a declared eventual-access rule. |
| Exterior doors | Every visible exterior door has a declared transition point and a real destination room; every required exit returns to a declared exterior destination. |
| Internal doors | Every visible internal door links declared room endpoints. No endpoint is a label, placeholder, or missing room. |
| Eventual access | Every unavailable door states a reason and at least one deterministic, satisfiable eventual-access condition. Permanent unreachable locks are rejected. |
| Station references | Every station belongs to a declared reachable room, has a supported interaction, and satisfies the required station set for its structure context. |
| Fixture references | Every fixture belongs to a declared reachable room and has a supported operational interaction. |
| Restroom | Every structure has at least one reachable operational sanitation suite containing the complete fixture and privacy contract below. |
| Accessibility | The public entry, required rooms, restroom, accessible toilet, sink, required stations, fixtures, and interaction points have an accessible route and accessible interaction description. |
| Actor support | Required door, station, fixture, and sanitation transitions support both player and NPC actors. |
| Determinism | The same graph, runtime state, actor, action, and ordered input produce the same result and the same ordered issues. |
| Diagnostics | Invalid data returns stable, ordered, structure-specific issues; assertion helpers throw rather than returning partially valid registries. |

Unknown structure categories, room references, door destinations, fixture
roles, station roles, actor kinds, access conditions, and runtime states are
errors. Validators do not infer missing data, invent defaults, or skip an
unknown entry.

## Doors, traversal, and eventual access

There are three door relationships:

1. A visible exterior entrance maps an exterior transition point to a declared
   entry room.
2. A visible exterior exit maps a declared room back to a declared exterior
   transition point.
3. A visible internal door links two declared rooms in the same graph.

Each visible doorway must resolve through one of those relationships. A mesh,
sprite, collision opening, sign, or textual reference cannot stand in for a
`DoorDef`. Decorative architecture must not visually promise an occupiable
building or room that the graph does not provide.

Reachability is evaluated as a graph traversal from the public entry room.
Immediately usable doors contribute an ordinary edge. A currently unavailable
door contributes a conditional edge only when its access rule has a declared,
satisfiable path. The validator follows both ordinary and valid conditional
edges to prove eventual access, while the runtime follows only edges whose
conditions are currently satisfied.

A connected graph is necessary but not sufficient. Required stations and
fixtures must also have reachable interaction points inside their rooms, and a
restroom privacy door must remain closable without blocking the accessible
route or trapping its occupant.

## Operational accessible sanitation suite

Every one of the 700 structures has at least one complete sanitation suite.
The suite must be reachable from the public entry under the same immediate or
eventual access rules as the rest of the structure. It must contain all of the
following operational roles:

- a toilet;
- an accessible toilet configuration;
- a sink;
- running water at the sink;
- soap at the sink;
- a drying method;
- a waste receptacle;
- a mirror; and
- closable, opaque privacy enclosing the toilet area.

The accessible toilet, sink, water, soap, drying method, waste receptacle,
mirror, controls, and privacy door must be reachable and usable through the
accessible route. Every interaction has an accessible label and a deterministic
success or refusal result. Privacy is not satisfied by a decorative divider,
an absent door, a transparent closure, a closure that cannot latch, or a door
that makes the toilet unreachable.

Both player and NPC actors use the same ordered sanitation contract:

1. use the toilet;
2. move to and begin using the sink;
3. turn on or otherwise use running water;
4. apply soap;
5. use running water again to rinse; and
6. use the declared drying method.

The state machine rejects skipped, repeated, or out-of-order steps when they
would falsely mark the sequence complete. Waste and mirror interactions remain
operational fixtures even though they are not required to advance the six-step
hand-washing sequence. Completion records the actor's hygiene outcome in plain
runtime state so schedules, readiness, cleanliness, inspections, and selected
production-quality rules can consume it deterministically.

## Factory station contract

Every factory graph must contain an accessible, reachable, operational station
for each of these roles:

- intake;
- inspection;
- storage;
- preparation;
- washing;
- production;
- quality control;
- packaging;
- finished-goods storage;
- shipping;
- maintenance;
- cleaning;
- waste;
- recycling;
- staff facilities;
- office;
- first aid;
- safety;
- restroom; and
- handwashing.

The roles may be distributed across multiple rooms and may have more than one
station for capacity, but no role may be omitted or represented only by a room
name. Restroom and handwashing station roles reference the complete sanitation
suite; they do not replace its required fixtures.

## Non-factory context station contracts

Each of the 300 non-factory buildings declares a supported context. Validation
derives a minimum purpose-specific station set from that context in addition to
the universal restroom and handwashing requirements.

| Context | Minimum purpose-specific station roles |
|---|---|
| Home | entry, sleep, cooking or food preparation, dining, household storage, cleaning, waste, safety, restroom, handwashing |
| Shop | receiving, stock storage, display or service, checkout or fulfillment, office, staff facilities, cleaning, waste, recycling, safety, first aid, restroom, handwashing |
| Civic | reception or public service, waiting, office, records, meeting or program service, staff facilities, cleaning, maintenance, safety, first aid, public restroom, handwashing |
| Farm | intake or staging, tool or feed storage, preparation, washing, production or animal care, packing, shipping, maintenance, cleaning, waste, recycling, staff facilities, safety, first aid, restroom, handwashing |
| Mine | check-in, equipment storage, changing or lockers, extraction or processing, material staging, maintenance, safety, first aid or rescue, waste, staff facilities, restroom, handwashing |
| Greenhouse | planting or growing, irrigation, preparation, washing, harvest inspection or grading, storage, packing, shipping, maintenance, cleaning, waste, recycling, staff facilities, safety, first aid, restroom, handwashing |
| Restaurant | receiving, dry or cold storage, food preparation, cooking, quality control or service pass, dishwashing, dining or service, staff facilities, office, cleaning, waste, recycling, safety, first aid, public restroom, handwashing |
| Service | reception, waiting where the service admits visitors, service work, secure storage, office, staff facilities, maintenance, cleaning, waste, recycling, safety, first aid, restroom, handwashing |

A definition may add more specific roles but cannot replace a required role
with an unrelated station. If a context is unknown or has no registered minimum
set, validation fails rather than accepting an empty requirement.

## Deterministic runtime operations

Runtime operations are pure functions over an immutable graph and explicit
state. Implementations must provide deterministic operations for these actions:

- resolve a structure identifier to its stable graph;
- resolve rooms, doors, stations, and fixtures by stable identifier;
- evaluate a door's current access state and eventual-access description;
- transition a player or NPC through a usable exterior or internal door;
- begin, advance, complete, block, or cancel a station interaction;
- begin, advance, complete, block, or cancel a fixture interaction;
- advance the sanitation sequence by one valid step; and
- enumerate reachable rooms and interaction points under immediate or eventual
  access rules.

A successful operation returns the next state and a structured event. A refused
operation leaves the input state unchanged and returns a stable reason. An
unknown actor, structure, room, door, station, fixture, action, or transition is
refused explicitly. Runtime code must not silently redirect an actor, create a
missing definition, or treat an inaccessible target as used.

Player and NPC transitions share the same core state machine. Presentation,
input bindings, animation, sound, schedule selection, and accessibility
announcement layers consume the structured result; they do not decide whether
the transition is valid.

## Validation and assertions

Validation has two levels:

- graph validation checks one `InteriorGraph` and reports every issue it can
  identify without accepting the graph; and
- registry validation checks catalog totals, category totals, one-to-one graph
  ownership, stable lookup consistency, and every graph invariant.

Issues are ordered deterministically by structure identifier, then invariant
group, then room, door, station, or fixture identifier. Each issue identifies
the structure and exact definition path, uses a stable issue code, and explains
the unmet contract. Reordering object properties or registry insertion must not
change the issue order.

Assertion helpers use the same validators. They return the original fully
typed value only when no issue exists. Otherwise they throw an error containing
the ordered issue set. There is no warning-only path for missing rooms, fake or
unreachable doors, incomplete sanitation, missing context stations, unsupported
actors, invalid counts, or unstable lookup data.

## Stable registry and lookup surface

The module exposes immutable constants for the required factory count (400),
required non-factory count (300), and required total (700), together with a
stable structure registry and structure-to-graph lookup. Lookups are keyed by
stable structure identifiers and return no implicit fallback graph.

Iteration order is stable and independent of object insertion. Consumers that
need a list use the registry's canonical identifier order. Consumers that need
one graph use the keyed lookup. A missing key remains missing so validation and
runtime callers can fail closed.

The 700-entry total is not a substitute for per-entry validation. A registry
with the correct counts still fails when even one structure lacks a room,
door destination, eventual access path, sanitation role, accessible route,
actor interaction, or required station.

## Delivery verification boundary

This contract was documented during an accelerated delivery pass. Tests, test
suites, lint, type checks, static analysis, accessibility checks, reviews,
audits, and captures were intentionally not run for that pass. The absence of
those activities is not evidence that the implementation satisfies this
contract; it records the verification boundary accurately.
