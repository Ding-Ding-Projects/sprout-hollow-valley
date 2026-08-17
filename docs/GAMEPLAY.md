# Gameplay contract — livestock, buildings and processing

Extends the rules layer described in `docs/ARCHITECTURE.md`. Everything here lives in
`src/game/**` and obeys the same purity rule: no canvas, no DOM, no `Date`, no
`Math.random` — all randomness through `rngFor(seed, salt)`, so a save always replays.

## 1. Buildings

Purchased from the shop, then **placed** by the player on cleared ground.

| Building | Footprint | Cost | Holds |
|---|---|---|---|
| Coop | 4 × 3 | 4,000 | 4 birds |
| Big Coop | 4 × 3 | 10,000 | 8 birds, unlocks ducks |
| Deluxe Coop | 4 × 3 | 20,000 | 12 birds, unlocks rabbits, auto-feeds |
| Barn | 5 × 4 | 6,000 | 4 large animals |
| Big Barn | 5 × 4 | 12,000 | 8, unlocks goats and sheep |
| Deluxe Barn | 5 × 4 | 25,000 | 12, unlocks pigs, auto-feeds |
| Silo | 3 × 3 | 1,500 | 240 hay |
| Well | 2 × 2 | 1,000 | Refills the can without walking to the pond |

Upgrades replace in place and **never destroy the animals inside**.

### Placement rules

Free-form. The player enters placement mode from the shop, a ghost footprint follows the
cursor, and the build commits only when every rule passes:

- Entirely in bounds.
- Every covered tile is `grass`, `soil` or `path` — never `water`, `rock`, `log` or `weeds`.
- No tile carries a plant, a sprinkler or a machine.
- Does not overlap another building or the farmhouse.
- At least one tile of the footprint's bottom edge is reachable — a building you cannot walk
  up to is a bug, not a choice.

The ghost renders valid tiles tinted `grassLit` and blocked tiles `berry`, per tile, so the
player can see *which* corner is the problem. Esc cancels and refunds nothing because
nothing was spent — the purchase commits on placement, not on selection.

Buildings can be **moved** later for a small fee, and **demolished** with a confirmation that
states plainly what happens to the animals inside (they are sold at half value; the dialog
says so before it happens, and refuses entirely if there is nowhere for them to go).

## 2. Animals

```ts
interface Animal {
  id: string
  species: SpeciesId
  name: string
  buildingId: string
  age: number          // days since purchase
  friendship: number   // 0..1000
  fedToday: boolean
  pettedToday: boolean
  producedToday: boolean
  daysUntilProduce: number
  outside: boolean
}
```

| Species | Building | Cost | Produces | Every | Needs |
|---|---|---|---|---|---|
| Chicken | Coop | 800 | Egg | 1 day | — |
| Duck | Big Coop | 1,200 | Duck egg, feather | 2 days | — |
| Rabbit | Deluxe Coop | 4,000 | Wool | 4 days | — |
| Cow | Barn | 1,500 | Milk | 1 day | — |
| Goat | Big Barn | 4,000 | Goat milk | 2 days | — |
| Sheep | Big Barn | 8,000 | Wool | 3 days | Shears |
| Pig | Deluxe Barn | 16,000 | Truffle | 1 day | Must be outside, not winter |

### The daily loop

- **Feed.** Hay from the silo, or free grazing outside in spring, summer and autumn. In
  **winter nothing grazes** — every animal eats stored hay, so the silo is the winter tax and
  cutting grass through autumn is the preparation for it.
- **Pet.** Costs a moment, raises friendship. Skipping it is the slow leak.
- **Collect.** Produce appears in the building or, for pigs, on the ground outside.

Friendship rises with feeding and petting, falls when an animal goes unfed or is shut out
overnight, and drives both **yield** and **quality odds**. A neglected animal produces less,
then nothing, and the UI says which animal and why — never a silent shortfall.

Animals let outside return home at nightfall on their own. One left outside overnight loses
friendship and may be found unwell in the morning.

## 3. Machines and production chains

Placed on any single walkable tile. Each machine holds a **queue of jobs** and works through
them one at a time, so the player sets up a morning's production and walks away.

Recipes take **one or more ingredients**, which is what turns this from a value multiplier
into an actual production chain: the output of one machine is the input of the next, and the
deep chains are where the money is.

| Machine | Cost | Recipe | Hours |
|---|---|---|---|
| Feed Mill | 2,000 | 2 corn + 1 wheat → animal feed | 4 |
| Dairy | 4,000 | 1 milk → cream · 2 milk → butter · 1 cream + 1 milk → cheese | 3–8 |
| Bakery | 5,000 | 1 flour + 1 egg → bread · 2 flour + 1 jam → pie | 6–12 |
| Mill | 6,000 | 3 wheat → flour · 3 corn → cornmeal | 4 |
| Preserves Jar | 3,000 | 2 of any fruit → jam, named for the fruit | 16 |
| Juice Press | 4,500 | 3 of any fruit → juice · 2 carrot + 1 apple → blend | 10 |
| Loom | 4,000 | 3 wool → cloth · 2 cloth + 1 dye → fabric | 8 |
| Sugar Mill | 5,500 | 3 sugarcane → sugar syrup | 6 |
| BBQ Grill | 7,000 | 1 bacon + 1 cornmeal → skewer | 14 |
| Keg | 5,000 | 4 of any fruit → wine, named for the fruit | 72 |

Chains run three deep on purpose: `wheat → flour → bread`, `milk → cream → cheese`,
`wool → cloth → fabric`. A player who only sells raw crops earns a fraction of one who runs
the chain, and the Almanac shows the full tree with real numbers.

**Quality carries through** the whole chain. A gold melon makes gold jam makes a gold pie,
each step multiplying an already-multiplied price. That is what finally makes fertilizer
matter past the harvest, and it is the backbone of the late economy.

Queues are visible: a machine shows what is cooking, what is waiting behind it, and how long
is left. Inserting a recipe the player lacks ingredients for is refused with a message naming
exactly what is short and how many. A finished machine shows a ready glow.

### Valley-wide factory production

The homestead machines above remain the compact farmyard production path. The connected-valley
runtime applies the same visible, deterministic and non-lossy rules to **all 400 enterable
factory definitions** and **all 1,200 production recipes** in the typed content registry.
Factories are operational locations rather than decorative catalogue rows: their production
state continues while their 3D rooms are unloaded, and entering a factory exposes the same
state through its authored stations.

A recipe is compatible only when the selected factory provides every capability named by the
recipe's `factoryCapabilities` contract. Queue capacity comes from that factory definition;
there is no universal capacity and no silent overflow. The primary production console lists
only compatible recipes, while intake, inspection, raw-storage, preparation, washing, quality,
packaging, finished-goods, shipping, maintenance, cleaning, staff-facilities and sanitation
stations expose the corresponding part of the same factory record. A station never maintains
a second private queue or inventory.

#### Queue transaction and advancement

Enqueue is an atomic transaction. It validates the factory, recipe, strict capability match,
queue space, staged inputs, canonical production cost, completed interior hygiene route,
`staffReadiness`, cleanliness, inspection and maintenance before reserving any stock or money. A
successful enqueue appends one stable job record with the exact recipe ID, remaining duration and
quality to that factory's FIFO queue, and uses `nextJobSerial` to assign the next stable
per-factory job identity. A refusal leaves the queue, storage, inventory, money and serial
unchanged and returns an accessible reason that identifies the failed condition.

Advancement rechecks readiness and the operational gates, then uses explicit integer valley
minutes. It starts at `lastAdvancedMinute`, spends time on the queue head, carries unused minutes
to the next job in order, and records the target minute. Completed output moves to
`finishedGoods`; lack of collection or destination storage never deletes it. Repeating the same
target minute is a no-op, and a target earlier than `lastAdvancedMinute` is refused. Nothing reads
the wall clock, depends on render frames or calls unseeded randomness, so the same state,
catalogue and target minute always produce the same queue, storage and finished goods.

#### Station gates and fail-closed rules

Station interactions operate on authored station IDs inside the selected factory:

| Station contract | Factory-production effect |
|---|---|
| Intake and raw storage | Select a strictly compatible recipe and stage the exact canonical inputs it still needs in persistent `storage`. |
| Inspection | Inspect staged input; an empty or incomplete staged batch cannot pass. |
| Staff facilities | Resolve an eligible on-shift NPC, or explicitly establish `player-ready` only when no such NPC is available. |
| Restroom and hand washing | Complete the real interior hygiene route required before production; these remain separate stateful interactions. |
| Washing and cleaning | Restore the persistent `cleanliness` production gate. |
| Maintenance | Restore the persistent `maintenance` production gate. |
| Production console | Inspect or enqueue work only after compatibility, capacity, readiness, hygiene, cleanliness, inspection, maintenance, staged-input and canonical-cost checks pass. |
| Quality control, packaging and storage | Expose the accepted queue, held stock, gate state and finished lots without maintaining duplicate state. |
| Finished-goods storage | Collect finished lots only within the canonical player-inventory capacity; rejected overflow remains held. |
| Shipping | Dispatch canonical products using their exact registered sell prices rather than a station-local price table. |
| Waste, recycling, safety, first aid and office | Remain state-aware usable services even when they do not mutate the queue. |

Existing interior rules still require the actor to be in the correct structure and room.
Sanitation is never replaced by a production-menu toggle, and a station never maintains a second
private queue, inventory or price source.

The runtime fails closed for an unknown factory, recipe, job, station, item, capability or NPC;
the wrong factory or room; a capability mismatch; a full queue; insufficient inputs or cost;
invalid or non-forward minutes; incomplete hygiene; unavailable staff; or a cleanliness,
inspection or maintenance gate that is not ready. It never substitutes a similarly named
definition, invents output, partially consumes a rejected batch, skips a blocked queue head or
silently repairs an authored reference. Finished goods remain held until a capacity-checked
collection or canonical-price shipping route accepts them.

#### NPC and player readiness

Each `Valley3DFactoryProductionFactoryV1` records one of four explicit `staffReadiness` values:

| Value | Meaning |
|---|---|
| `unassessed` | Readiness has not yet been resolved for this shift. The queue does not advance. |
| `npc-ready` | An existing persistent NPC has matching employment, is on shift and can operate the factory. |
| `player-ready` | The player explicitly accepted the operating role at the factory's staff-facilities station. |
| `unavailable` | No eligible operator is ready. The queue remains unchanged and the reason is exposed. |

NPC readiness is derived read-only from the existing life-simulation state; production does not
rewrite employment, schedules or NPC positions to make a shift pass. An unstaffed factory can be
made `player-ready` through its staff-facilities station, so every one of the 400 factories stays
operable without fabricating an NPC. Only `npc-ready` and `player-ready` permit queue advancement.

#### Version-one persistence

Factory production is an additive `Valley3DSaveV1.factoryProduction` record with the type
`Valley3DFactoryProductionStateV1`. Every persisted factory row is a
`Valley3DFactoryProductionFactoryV1` containing:

| Field | Persisted responsibility |
|---|---|
| `queue` | Ordered accepted jobs and their remaining deterministic work. |
| `storage` | Factory-held recipe inputs and intermediate stock. |
| `finishedGoods` | Completed output waiting for a valid collection or shipping route. |
| `staffReadiness` | The explicit `unassessed`, `npc-ready`, `player-ready` or `unavailable` state. |
| `cleanliness` | The factory's production-cleanliness gate. |
| `inspection` | The current inspection gate and hold state. |
| `maintenance` | The current operational-maintenance gate. |
| `lastAdvancedMinute` | The last absolute valley minute already applied to this queue. |
| `nextJobSerial` | The next stable per-factory job serial; completed or removed jobs do not reuse it. |

The outer save version remains version one. A version-one save written before
`factoryProduction` existed loads with exactly one deterministic safe idle row per canonical
factory; existing farm, interior and life state is not rewritten. Present records are validated
against the exact 400 factory and 1,200 recipe definitions before use. Unknown or malformed
authored references are refused rather than guessed, and unsupported future save versions remain
rejected. Restore and save therefore preserve active jobs, held stock, readiness and gate states
without weakening older version-one save compatibility.

## 4. New state

`GameState` gains:

```ts
buildings: Building[]
animals: Animal[]
machines: Machine[]
hay: number
```

`Tile` gains `buildingId: string | null` and `machineId: string | null` so occupancy is
answerable per tile without scanning every building.

## 5. New verbs in `src/game/actions.ts`

```ts
export function placeBuilding(state, kind: BuildingKind, x: number, y: number): ActionResult
export function moveBuilding(state, id: string, x: number, y: number): ActionResult
export function demolishBuilding(state, id: string): ActionResult
export function canPlace(state, footprint: Footprint, x: number, y: number): PlacementCheck
export function buyAnimal(state, species: SpeciesId, buildingId: string, name: string): ActionResult
export function feedAnimal(state, id: string): ActionResult
export function petAnimal(state, id: string): ActionResult
export function collectProduce(state, id: string): ActionResult
export function cutGrass(state, index: number): ActionResult        // -> hay, needs a silo
export function placeMachine(state, kind: MachineKind, index: number): ActionResult
export function insertIntoMachine(state, id: string, item: ItemRef): ActionResult
export function collectMachine(state, id: string): ActionResult
```

`canPlace` returns a per-tile verdict, not a boolean — the ghost renderer needs to know
*which* tiles are blocked, and the refusal message needs to say why.

`sleep()` gains an overnight pass for the new systems, in this order: animals eat (silo
first, then grazing where the season allows), unfed animals lose friendship, produce timers
tick, machines advance and finish, animals left outside are resolved. The `DayReport` gains
`fed`, `unfed`, `produced`, `machinesFinished` and `animalsUnwell`, and the morning panel
reports them truthfully — a report that hides a starving cow is worse than no report.

## 6. Balance intent

Not rules, but the shape the numbers should hold:

- A coop of four chickens should roughly match one good crop plot for daily income, with far
  less daily effort and a much higher up-front cost.
- Processing should roughly **double** raw value, and the keg should roughly triple it in
  exchange for seven days of patience and a tied-up machine.
- Winter should be survivable on animals and processing alone, but only for a player who
  cut hay through autumn. A first-year player is *supposed* to find winter tight.
- Nothing should be a strict dominant strategy. If wine is always correct, the keg is
  mispriced.
