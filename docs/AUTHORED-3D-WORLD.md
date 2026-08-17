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
through the existing `ThreeRuntimeOptions.buildCell` seam. The world source does not modify the
Farm tab, create a runtime, own an animation loop, or read gameplay saves. The integration owner
retains control over when the authored source becomes the live Farm selection.
