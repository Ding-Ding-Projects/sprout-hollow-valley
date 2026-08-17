# Interiors

Every building on the farm is enterable. Walking up to its door and using it does not open a
menu over the farm — it takes the farmer *inside*, into a room that is its own small world
with its own floor, its own walls and its own set of things to walk up to and use.

This document is the contract. `src/game/interiors.ts` implements it, `tests/interiors.test.ts`
proves it, and `src/renderer/scenes/interior.ts` draws it.

## 1. Why a room and not a panel

The farm is one screen of twenty by eleven tiles. A coop on that screen is four tiles by three
— there is no room on the farm itself to show four birds, their feed, their nests and their
hay. The obvious answer is a panel listing them.

A panel is not what this game is. The whole game is *walking up to a thing and using it*: you
do not pick TILL from a list, you stand on the row and swing. A coop that opens a list would
be the only place in the game where the verb is chosen from a menu instead of by standing
somewhere. So the coop gets a room, the room gets nest boxes and a feed trough laid out in it,
and tending a bird is the same act as watering a crop: face it, use it.

This also gives every building something to *be*. A silo on the farm is a cylinder you walk
past. A silo you can enter is a hayloft you stand in with the season's hay stacked to a
visible line.

## 2. The room

An interior is a rectangle of tiles, at most twenty by eleven, so it draws inside the same
world band the farm uses at the same `TILE` size with no camera and no new layout maths. It is
centred in that band; the ground outside the room is the void colour, not more floor.

Row `0` is the back wall. Columns `0` and `w-1` are the side walls. Row `h-1` is the front
wall, and it is the wall the door is cut into. Everything from `(1,1)` to `(w-2,h-2)` is floor.

The **door** is always the centre column of the front wall, `(floor(w/2), h-1)`. Standing on
the mat — the floor tile directly above it — and facing down leaves. So does `Esc`.

Room size is a property of the building kind, not of its footprint. A coop is four by three on
the farm and eleven by seven inside, the same way a house in any game of this shape is bigger
inside than the roof you see from the road. The sizes are in `INTERIOR_ROOMS`.

## 3. Stations

A **station** is a thing in the room you can face and use. It has a position, a size, a label,
and usually a reference to the thing it stands for — an animal, a machine, a stall slot.

| Station | Where | Using it |
|---|---|---|
| `pen` | animal buildings, one per capacity | Tends the occupant: collect, then feed, then pet |
| `trough` | animal buildings | Feeds every hungry occupant, one energy cost each |
| `nest` | animal buildings | Collects everything ready in this building at once |
| `hayloft` | animal buildings, silo | Reads the hay level against its cap |
| `bench` | production buildings | Opens the recipe picker for a machine |
| `counter` | the roadside stall, one per slot | Opens pricing for that slot |
| `ledger` | farmhouse | Opens the order board |
| `bed` | farmhouse | Sleeps |
| `chest` | farmhouse, barn store | Opens the bag |
| `crate` | most buildings | Reads what the building is holding |
| `shelf` | barn store | Reads the barn capacity this store is adding |
| `basin` | the well | Refills the watering can |
| `plot` | greenhouse | Reads the bed's out-of-season growing |
| `exit` | the mat | Leaves |

Stations in this inherited tile-interior layer are **derived, never stored**.
`interiorFor(state, buildingId)` reads the live state every time it is called, so a bird bought a
second ago is standing in its pen and a machine pulled down is not on the bench. The station
definitions and tile-room presentation are not copied into the save file. The separately streamed
3D interior composition persists only its active logical location and interaction progress, as
described in section 7.

## 4. Pens

An animal building lays out exactly `def.capacity` pens, so an empty coop shows four empty
nests rather than nothing — the player can see what they have paid for and what is still free.
Pens are laid out left to right with a tile of straw between them, wrapping to a second row,
and never on the door column or the mat row.

Occupancy is by index: pen `i` holds `animalsIn(state, buildingId)[i]`. That list is stable in
purchase order, so a bird does not move house between frames.

## 5. Using a pen

One button, and it does the most useful thing that is pending, in this order:

1. Something is ready to collect → collect it.
2. It has not eaten today → feed it.
3. It has not been petted today → pet it.
4. Otherwise say so, and spend nothing.

Every one of those calls the existing verb in `src/game/livestock.ts` unchanged. Interiors add
no rules: energy costs, friendship, quality and refusals are all decided where they already
were. This layer only decides *which* verb the player meant.

## 6. What the pure layer may not do

`src/game/interiors.ts` is inside `src/game`, so the same rules apply as everywhere else in
that directory: no canvas, no DOM, no `Date`, no `Math.random`. It returns plain data. Opening
a panel is expressed as a *request* — `{ open: 'recipes', ref: machineId }` — which the scene
layer honours. The pure layer never knows a scene exists.

## 7. Persistent 3D interior progress

The optional `GameState.valley3d` version 1 section records the live 3D composition without
serializing an authored interior graph or any Three.js object. When the player is inside, the
snapshot identifies the structure content definition and graph, current room and floor, local
position, and exact exterior return position and yaw. It also records resolved access-step IDs,
the active station or fixture use, sanitation stage and hygiene completion, and the logical
runtime serial, tick, use counts, and revision. When the player is outside, `interior` is `null`.

The Farm tab refreshes this logical snapshot on a canonical mutation and at every autosave,
explicit save, pause save, and disposal save. Restore first rebuilds the current graph from the
authored registries, then resolves the saved structure, graph, room, door, station, and fixture
IDs. Missing IDs fail closed: the runtime does not substitute a similarly named room or apply
door, work-station, fixture, or sanitation progress to a different object. It instead leaves the
interior inactive and returns to the deterministic exterior state. Missing, malformed, or
unsupported `valley3d` sections use the same deterministic migration defaults, preserving
backward compatibility with saves that predate 3D interior persistence.
