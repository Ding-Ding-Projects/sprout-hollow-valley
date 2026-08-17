# Authored 3D valley world source

Sprout Hollow Valley's authored exterior is available as a deterministic Three.js world-cell
builder. It is a finite connected valley, not an endless procedural map. The source lives in
`src/renderer3d/world/authored-valley-world.ts` and uses only bundled Three.js geometry and
materials; it does not make network requests or download runtime assets.

## Layout

The playable valley occupies world-cell coordinates `x = -8..8` and `z = -6..7`. Cells beyond
that authored rectangle render natural ridge scenery and publish solid boundary collision so the
streamer can retain its normal square-cell contract without turning the valley into an infinite
play space.

Eight named terrain regions divide the valley:

| Region ID | Authored region | Starting estate zone |
|---|---|---|
| `region:meadow` | Meadow Commons | Meadowbrook Estate |
| `region:forest` | Fernwood Wilds | Fernwood Estate |
| `region:riverland` | Riverbend Terraces | Riverbend Estate |
| `region:mountain` | Copper Highridge | Highridge Estate |
| `region:coastal` | Saltwind Coast | Seagrass Estate |
| `region:marsh` | Willowfen Wetlands | Willowfen Estate |
| `region:arid` | Sunstone Mesa | Redmesa Estate |
| `region:alpine` | Snowcap Highlands | Snowcap Estate |

The Valley Spine Road, Market Ring Road, and eight named estate approaches are clipped into every
intersected cell from shared world-space line segments. This makes adjacent path meshes meet at
the same cell boundary. Sprout River uses the same cross-cell clipping contract, while terrain
height is sampled from one global function so its edge vertices agree across loaded cells.

Sprout Square, the Lantern Market District, and the Valley Works Industrial Quarter provide civic,
commercial, and production landmarks. Every estate anchor adds a crop plot, orchard, agricultural
building, production facility, fence, gate opening, and lantern. Remaining cells receive
region-appropriate vegetation while preserving road and river clearances.

The farm space at every estate anchor follows one shared authored layout. Local coordinates
`x = 2..6`, `z = 9..12` form a 5-by-4 designated field, and local coordinates `(10, 11)`,
`(12, 11)`, and `(14, 11)` form three orchard slots. Absolute farm coordinates are
`worldX = cellX * 16 + localX` and `worldZ = cellZ * 16 + localZ`; their persistent key is
`estate:<id>@<worldX>,<worldZ>`. Across all eight estates this yields exactly 160 field records
and 24 possible orchard occupants.

## Typed content binding

The default builder is bound to `VALLEY_CONTENT_REGISTRY`. Region-aware deterministic selection
chooses real registered crops, orchard plants, buildings, factories, path definitions, and light
definitions. Both `region:meadow` and the structure catalogue's compact `meadow` spelling normalize
to the same region key. Scene object names and cell metadata retain the selected stable content IDs
and the registry fingerprint.

All placement derives from the engine-provided cell descriptor seed plus stable string salts.
There is no `Math.random()`, wall-clock dependency, or frame-rate input. Rebuilding a descriptor
with the same registry fingerprint and cell size produces the same content, transforms, names, and
collider IDs.

## Complete structure placement directory

The authored exterior has a finite, deterministic placement directory for the complete structure
catalogue: all 400 registered factories and all 300 registered buildings. Every registered
structure content ID owns exactly one exterior placement, and no placement is synthesized for an
unknown ID. A placement keeps the canonical content ID and binds it to that same structure's
existing `InteriorGraph`; exterior entry never substitutes a generic, inferred, or unrelated
interior.

Each placement records enough authored data to be reconstructed independently of load order:

- the region, named district, finite world-cell coordinates, and visible access-lane ID;
- an exact world pose and cell-local pose, including facing, footprint, and elevation;
- a real exterior-door pose, facing, and destination plus a walkable approach point and approach
  clearance; and
- the canonical interior graph ID for the registered structure content ID.

The directory distributes structures across the eight regions and their civic, commercial,
agricultural, and industrial districts. Access lanes are visible bundled road, path, yard, or
forecourt geometry that connect each approach to the surrounding authored route network. A door is
rendered only when its placement supplies the real approach and canonical interior destination:
decorative fake doors and door-shaped meshes without a destination are not part of the contract.

Placement geometry is procedural but bundled and recognizable. Factory exteriors use
content-derived production silhouettes such as halls, loading areas, vents, stacks, tanks, or
utility annexes. Other buildings use content-derived homes, shops, civic halls, agricultural
structures, community spaces, and service facilities. These variants change visible exterior
composition without changing stable identity, footprint, door metadata, or interior binding, and
they require no runtime downloads.

The directory supports complete iteration, exact lookup by structure content ID, and bounded lookup
by finite cell. The world-cell builder requests only the placements for the cell being composed,
so streaming work and resident exterior objects are bounded by that cell rather than all 700
structures. Unloading a cell releases only its procedural exterior resources; directory records and
canonical interior graphs remain immutable and can be resolved again when the cell becomes
resident.

## Persistent estate farming

The configurable world source receives the current validated `valley3d.estateFarming` snapshot
through a read-only callback. Field tiles, plants, debris, empty orchard pads, and orchard trees are
rebuilt from exact estate/world keys whenever their resident cell is composed or refreshed. Crop
and tree appearance resolves through the canonical crop, tree, and valley content registries;
meshes use bundled primitive geometry and local materials, with no runtime downloads.

Authored farming meshes carry one of `estate-farm-tile`, `estate-farm-crop`,
`estate-farm-debris`, `estate-orchard-slot`, or `estate-orchard-tree` plus the exact
`estateFarmKey`. These values let the Farm tab climb a ray hit to its semantic owner without
deriving farm identity from mesh order or presentation names. Presentation never mutates the save.
The rules layer independently revalidates the key, estate, coordinates, and designated field or
orchard slot before an action can change state.

## Rendering and collision

The source creates low-poly terrain, roads, water, crops, orchard trees, fences, buildings,
factories, chimneys, doors, windows, and lanterns with procedural geometry and local materials.
Buildings and factories expose their registered content IDs on clearly named exterior groups and
carry visible entrance meshes for the interior-transition layer to target. Point lights can be
disabled for a low preset without removing their physical lantern meshes.

Stable world-space axis-aligned colliders cover tree trunks, buildings, factories, lantern posts,
and the natural boundary cells. The `ThreeWorldCellSource` owns registration and removal of those
colliders. The authored builder owns and disposes only the geometry and materials it created for
the cell.

## Integration contract

The renderer exports both a ready default builder and a configurable factory:

```ts
import {
  buildAuthoredValleyWorldCell,
  createAuthoredValleyWorldCellBuilder,
} from './renderer3d'

// Select the canonical registry-backed authored world.
const runtimeOptions = {
  canvas,
  buildCell: buildAuthoredValleyWorldCell,
}

// Or choose a lower terrain density and physical lanterns without point lights.
const lowPresetOptions = {
  canvas,
  buildCell: createAuthoredValleyWorldCellBuilder({
    pointLights: false,
    terrainSegments: 4,
  }),
}
```

The exported builder matches `ThreeWorldCellBuilder`, so the live Three Farm surface can select it
through the existing `ThreeRuntimeOptions.buildCell` seam. The world source does not mutate
gameplay saves, modify the Farm tab, create a runtime, or own an animation loop. The integration
owner supplies the read-only estate-farming snapshot, requests resident-cell refresh after an
accepted action, and retains control over when the authored source is the live Farm selection.
