# 3D gameplay adapter

The live Three.js farm uses `src/renderer3d/gameplay-adapter` to turn a world-space hit into
one of the existing deterministic farm actions. The adapter is deliberately not a second game
engine. It does not calculate prices, yields, friendship, time, energy, storage, placement cost,
machine progress, or save data. It delegates those decisions to `src/game/**` and returns the
resulting `GameState` unchanged in shape.

## Public entry point

```ts
import {
  createFarmingGameplayAdapter,
  type GameplayTargetHit,
} from './renderer3d/gameplay-adapter'

const gameplay = createFarmingGameplayAdapter({
  transform: {
    origin: { x: 0, y: 0, z: 0 },
    tileSize: 1,
    groundY: 0,
    maxInteractionDistance: 2.15,
  },
})
```

`FarmingGameplayAdapter` is stateless. The farm surface supplies the current `GameState` for
every resolve, overlay, and execute call, then persists `outcome.state` through the existing
Farm-tab save path. A target or command from an earlier frame is rechecked against the current
state before it can act.

## World-space targeting

Rendered objects carry one stable `GameplayTargetRef` in `Object3D.userData`. The raycast layer
returns `GameplayTargetHit` values for tiles, buildings, machines, animals, or interior stations.
The resolver:

1. rejects malformed distances and references that no longer exist in the current state;
2. maps terrain hits to the inherited farm grid through an explicit origin and tile size;
3. chooses the nearest hit, with a stable subject and identifier tie-break;
4. records both ray distance and actor distance; and
5. keeps an out-of-range target visible while disabling its interaction and saying to move
   closer.

The mapping is pure arithmetic. It does not read the wall clock, frame time, scene load order, or
random state. Streaming a mesh out of the scene cannot mutate the farm.

Interior stations use a stable key derived from their canonical kind, cell, footprint, and
reference. The key is resolved against a freshly derived `interiorFor(state, buildingId)` before
station use, so a stale pen or machine bench cannot act on a different occupant.

## Commands and canonical actions

The immutable `GameplayCommand` union covers:

- tool and seed/sapling selection;
- tilling, sowing, watering, harvesting, clearing, sprinkler placement, and fertilizing;
- feeding, petting, letting out, and collecting from livestock;
- building, machine, and held-object placement;
- machine recipe intake and finished-output collection;
- building entry and interior-station use; and
- silo and barn-store inspection.

The default `GameplayRuleBindings` maps those commands directly to the existing action modules:

| Interaction | Canonical owner |
| --- | --- |
| Till, sow, water, harvest, clear, sprinkler, fertilizer | `game/actions.ts` |
| Feed, pet, pasture, animal pickup | `game/livestock.ts` |
| Building placement | `game/placement.ts` |
| Machine placement, intake, collection | `game/production.ts` |
| Building entry, storage/pickup stations, contextual panels | `game/interiors.ts` |
| Silo and barn capacity | `game/storage.ts` |

Harvesting, animal collection, and machine collection are the pickup operations. Their existing
actions deposit into the correct store, preserve output when storage is full, and return the exact
refusal text. Chest, crate, shelf, hayloft, and bag stations remain the storage interaction surface.

### Tree actions fail closed

Tree definitions already provide deterministic growth primitives, but the inherited action module
does not expose one complete plant-sapling or pick-tree transaction. Re-creating seed removal,
yield quality, energy, time, and storage decisions inside the renderer would split the rules engine.

The adapter therefore recognizes tree targets and exposes tree planting and harvesting through the
optional `sowTree` and `harvestTree` rule bindings. Until a canonical rules-layer transaction is
connected, those commands return an accessible refusal and leave the state, item, time, energy, and
tree untouched. It never routes a tree through the field-crop harvest path, which would remove the
standing tree incorrectly.

## Overlay contract

`adapter.overlay(state, target, options)` returns a DOM-free `GameplayOverlay` for both the Three
scene and the accessible HTML layer:

- tile, entity, and per-cell placement highlights with action, valid, blocked, or information
  state;
- one primary prompt and a list of complete labelled command options;
- the exact current target detail and input label;
- silo and barn used/capacity/free rows; and
- one complete `announcement` string suitable for a polite live region.

Placement previews call the existing `canPlace` verdict and preserve its per-tile reasons. A green
spatial preview does not predict that the player can afford the object: the actual placement action
still makes the final level, gold, materials, ownership, occupancy, and reachability decision.

Every execution returns a `GameplayOutcome`: the canonical `ActionResult`, the command and target
identity, optional interior transition, optional panel request, and accessible outcome text. A
failed action begins with “Action unavailable” and includes the canonical refusal. Visual colour or
animation is never the only report of success or failure.

## Live farm integration

The Three farm loop should perform the following steps for each explicit input edge, not every
render frame:

1. raycast and convert mesh metadata into `GameplayTargetHit` values;
2. call `resolveTarget(currentState, { actorPosition, hits, groundPoint })`;
3. render `overlay.highlights`, the visible prompt, and `overlay.announcement`;
4. on the logical primary-action edge, execute the enabled command from the overlay;
5. apply `outcome.state` through the Farm-tab state adapter;
6. route `outcome.fx` and `outcome.sound` to the existing feedback systems;
7. route `outcome.panel` or `outcome.transition` to the shell/interior layer; and
8. announce `outcome.announcement` and save through the established atomic save path.

Keyboard/mouse and gamepad both produce the same logical command. Pointer location and camera frame
rate affect only which rendered target is offered; once selected, the same command and same
`GameState` produce the same canonical result.
