# Sprout Hollow Valley content catalog

Sprout Hollow Valley's expanded catalog is a typed, deterministic source of
truth for **5,000 non-NPC definitions**. It is separate from the smaller legacy
tables in `src/game`: the Valley catalog adds localization, progression,
seasonality, regional participation, economy data, and cross-category references
without changing the contracts that still consume the original tables.

The shared schema lives in `src/content/types.ts`. Category modules depend only
on that schema and are injected into the registry as `ContentRegistrySources`.
That one-way dependency keeps category construction independent of module load
order and makes the same source data produce the same canonical registry.

## Required catalog size

`CONTENT_MINIMA` and `CONTENT_CATEGORY_ORDER` are the executable count contract.
The minima sum to exactly 5,000 definitions; NPCs are deliberately outside this
catalog.

| Collection key | Definition type | Minimum |
| --- | --- | ---: |
| `crops` | `CropDef` | 500 |
| `orchardPlants` | `OrchardPlantDef` | 250 |
| `animals` | `AnimalDef` | 150 |
| `factories` | `FactoryDef` | 400 |
| `buildings` | `BuildingDef` | 300 |
| `products` | `ProductDef` | 1,500 |
| `recipes` | `RecipeDef` | 1,200 |
| `materials` | `MaterialDef` | 300 |
| `decorations` | `DecorationDef` | 400 |
| **Total** | `ContentDefinition` | **5,000** |

Validation accepts an `at-least` or `exact` count mode. `at-least` enforces the
release minima while permitting a future catalog to grow. `exact` is useful when
a caller needs the currently curated release boundary to remain byte-for-byte
stable. Custom minima may narrow a tool's input, but the default contract is the
complete `CONTENT_MINIMA` table above.

## Definition contract

Every category extends `BaseContentDef` and therefore carries the same core
evidence:

- a globally unique, stable, namespaced `id` and a matching discriminated
  `kind`;
- an authored English `name` and explanatory `description`, plus separate
  `nameKey` and `descriptionKey` localization keys;
- one or more valid entries from the canonical `ALL_SEASONS` order and authored
  Valley `regions`;
- an `UnlockDef` with a level from 1 through 100, reputation from 0 through
  1,000, optional region and quest gates, and resolvable prerequisite IDs;
- an `EconomyDef` with purchase, sale, craft, and maintenance values, bounded
  market elasticity, and positive demand multipliers for all four seasons; and
- authored taxonomy `tags` for catalog search and filtering.

The category-specific interfaces then make a definition functional rather than
just named:

- Crops record family, cultivar, growth and optional regrowth, water and soil
  needs, harvest method, and a bounded product yield.
- Orchard plants distinguish trees, orchard plants, bushes, and vines; they
  record cultivar, maturity and harvest cadence, dormancy, pollination, canopy,
  and a bounded product yield.
- Animals record species group and breed, compatible housing, diet,
  temperament, care difficulty, maturity, lifespan, and one or more timed
  product yields.
- Materials record category, acquisition sources, renewability, available
  quality grades, stack size, and weight.
- Products record category and source kind, the source definition IDs that
  create them, perishability, quality grades, unit, and supported selling
  channels.
- Recipes record real input and output quantities, production duration and
  cost, and the exact factory capabilities required to run them.
- Factories record footprint, queue and staffing capacity, production
  capabilities, purposeful rooms and stations, access, and sanitation.
- Non-factory buildings record footprint, occupants, visitors, storage,
  services and capabilities, purposeful rooms and stations, access, and
  sanitation.
- Decorations record a placement footprint and surfaces plus functional
  behavior such as lighting, seating, storage, navigation, barriers, signage,
  connectivity, or weather shelter.

The deliberately shared economy and unlock shapes let tools inspect balance and
progression without category-specific casts. A zero economy channel is allowed
only when that channel is genuinely inapplicable; every definition still needs
at least one positive economic value, and category validation applies stricter
rules to goods, recipes, and structures.

## Deterministic registry shape

`ContentRegistrySources` accepts readonly arrays for all nine categories.
`ContentRegistry` exposes those arrays together with:

- `definitions`, canonically sorted by content kind and stable ID;
- `byId`, a read-only global lookup across every category;
- per-category `counts` and the non-NPC `total`;
- a localization catalog;
- and a stable `fnv1a32:` fingerprint over canonical content data.

The fingerprint is an identity for the catalog data, not a gameplay random seed.
Stable IDs, explicit authored tuples, integer or bounded numeric formulas, fixed
category ordering, and canonical sorting make construction independent of wall
clock, locale-dependent sorting, unseeded randomness, and input array order.
Definitions must never derive identity or balance from display-copy ordering.

`src/content/deterministic.ts` supplies the construction primitives used by the
category modules and registry:

| Export | Contract |
| --- | --- |
| `compareContentIds` | Locale-independent lexical comparison using the stable ID bytes. |
| `sortByContentId` | Returns a new ID-sorted array without mutating a category export. |
| `canonicalizeContentSources` | Sorts all nine category arrays independently. |
| `flattenContentSources` | Concatenates arrays in `CONTENT_CATEGORY_ORDER`. |
| `stableStringify` | Sorts object keys and rejects circular, non-finite, or unsupported values before JSON serialization. |
| `fnv1a32` / `contentFingerprint` | Hashes the canonical serialized source data. |
| `makeContentId` / `slug` | Builds explicit namespaced ASCII IDs from authored taxonomy fragments. |
| `seasonalValues` | Expands a base demand value into an explicit four-season record with authored overrides. |
| `cartesianProduct` | Expands finite authored taxonomy dimensions in declared order. |

`makeContentId` accepts an ordinal only to disambiguate genuinely repeated
authored labels. An ordinal does not make a numbered filler name substantive.
Likewise, `cartesianProduct` is a deterministic expansion tool, not permission to
cross arbitrary adjectives with nouns: each dimension has to describe real
category behavior, and the finished name and description still pass placeholder
and substance validation.

## Registry API

`src/content/registry.ts` is the assembly and validation entry point.

| Export | Purpose |
| --- | --- |
| `createContentRegistry` | Canonicalizes and freezes injected sources, builds indexes, localization, counts, total, and fingerprint, then validates by default. |
| `validateContentRegistry` | Returns every issue found in a deterministic validation traversal without throwing. |
| `assertContentRegistry` | Throws `ContentValidationError` when that same result is not valid. |
| `formatContentValidation` | Formats either the successful fingerprint/total or one line per issue. |
| `VALLEY_CONTENT_SOURCES` | Connects the nine shipped category-array exports. |
| `VALLEY_CONTENT_REGISTRY` | The shipped registry, constructed with exact counts, English localization, and canonical ordering required. |
| `VALLEY_CONTENT_VALIDATION` | The corresponding exact-count validation result. |

`CreateContentRegistryOptions` extends the validation options with supplied
localization and a focused-fixture escape hatch, `validate: false`. Production
construction validates. `ContentValidationError` preserves the entire structured
result and limits its exception-message preview to the first eight issues; callers
that need every path should consume `error.result` or
`formatContentValidation(error.result)`.

Game code imports the same contract through `src/game/valley-content.ts`. That
facade re-exports the shipped sources, registry, validation functions and error,
count/season/locale/capability constants, and all nine definition types. It keeps
callers inside the game layer independent of category-module file layout.

## Curated category construction

### Field crops

`VALLEY_CROPS` in `src/content/valley-flora-fauna.ts` expands 100 explicitly
authored crop-family records, each with an exact five-name cultivar tuple, into
500 definitions. The families cover cool and warm grains, pulses, oil/fibre/sugar
crops, roots and tubers, specialty roots and alliums, leafy greens, brassica and
salad crops, fruiting vegetables, and cucurbits, herbs, and flowers. Names such as
Red Fife Wheat, Nantes Carrot, Brandywine Tomato, and Buttercrunch Lettuce come
from those curated tuples; they are not an adjective-and-number template.

Five cultivar roles—early-maturing, flavour-selected, high-yield,
storage-selected, and climate-resilient—supply a stable agronomic distinction
within each family. The authored family and cultivar positions produce five crop
unlocks at every level from 1 through 100. Stable ID hashing then selects two of
the eight estate regions and bounded variations for growth, yield, seed and unit
value, soil affinity, water need, market elasticity, and seasonal demand. This
hashing is deterministic and only varies numeric rules within the authored
taxonomy; it never invents a display name.

Crops capable of repeated picking—fruiting, leafy, herb, and flower families—get
a bounded regrowth interval; other families are single-harvest. Family type also
selects a credible harvest method. Every row references its distinct
`product:fresh-...` output, and product validation requires that output to name
the crop reciprocally as its source.

## Localization

`SUPPORTED_LOCALES` declares three catalog views: `en`, `yue-Hant`, and
`bilingual`. Every definition provides two distinct keys, one for its name and
one for its description. The English fields on the definition remain authored
fallback copy and catalog evidence; they do not replace the localization maps.

`src/content/localization.ts` exports `localizationEntriesFor` and
`localizationEntries` to enumerate definition copy. Factory and building room and
station names are included alongside the top-level names and descriptions.
`createLocalizationCatalog` derives the English dictionary directly from those
authored fields, applies any explicit English overrides, and freezes the result.
`localizationValue`, `missingLocalizationKeys`, and
`mergeLocalizationDictionary` provide lookup, deterministic missing-key
reporting, and immutable dictionary composition for callers.

Localization completeness is fail-closed. Required locale dictionaries must
contain nonblank values for both keys of every definition. Reusing a name or
description key across definitions is rejected even when the visible copy happens
to match. This preserves stable lookups and prevents one entry's translation from
silently overwriting another's.

## Seasons, unlocks, and economy

Season arrays use only `spring`, `summer`, `fall`, and `winter`. They are
nonempty, duplicate-free, and interpreted in the canonical `ALL_SEASONS` order.
Crop growing windows, orchard harvest and dormant windows, availability, and
seasonal market relevance are therefore explicit data rather than date-dependent
behavior.

Unlocks combine level progression with reputation, region, quest, and content
prerequisites. A prerequisite must resolve globally and may not be a self
reference. Region- or quest-neutral content uses `null` rather than a magic
sentinel. This makes an unavailable entry explainable by real gates and keeps the
progression graph inspectable.

The common economy record preserves the five-channel market contract while
allowing category-specific use. Products name their supported selling channels;
recipes add production cost and duration; factories and buildings carry purchase
and daily maintenance costs; raw and cultivated content carries acquisition and
sale value. Seasonal demand always has four positive values, and invalid,
negative, non-finite, or implausibly unbounded values are rejected rather than
normalized silently.

## Cross-reference rules

IDs share one global namespace. Registration rejects a reference that merely
exists under the wrong kind as well as one that is missing entirely.

- Crop and orchard yields resolve to products.
- Every animal product yield resolves to a product.
- Product `sourceIds` resolve to the declared source kind: animal, crop,
  material, orchard plant, recipe, or authored forage source.
- Recipe input and output IDs resolve to materials or products, quantities are
  positive, and a recipe cannot have empty sides.
- Every recipe capability is supplied by at least one registered factory.
- Station inputs and outputs resolve to materials or products; every structure
  provides sanitation and exposes at least one station matching a capability the
  structure declares.
- Unlock prerequisite IDs resolve globally.

These checks are intentionally performed after the global `byId` index is built,
so independently authored category modules can reference one another without
importing one another.

## Structural completeness

Factories and non-factory buildings are validated as usable places rather than
count-only shells. Footprints, capacity, rooms, stations, access, and sanitation
must be positive and coherent. Room and station IDs and localization keys are
unique within their structure; every room has a purpose and accessibility state;
and every station has a real interaction, assigned NPC role, capability, and
input/output contract.

Access data requires an entrance, valid opening hours, an accessible route, and
an eventual-access explanation. A locked structure also needs a real lock reason.
Sanitation requires toilets, an accessible toilet configuration, sinks, soap,
drying, bins, mirrors, privacy doors, and hand-washing capacity. These fields
carry the catalog contract; later room-graph and built-artifact interaction
evidence remains a separate release requirement.

Decorations are functional definitions, not structure-shaped facades. Placement
must name a valid surface, and at least one function must be effective. Examples
include a positive light radius, seating or storage capacity, path-speed effect,
barrier strength, connection behavior, or a nonblank sign topic. A decoration
cannot present itself as a building or create a fake occupiable doorway.

## Completeness failures

Validation returns a `ContentValidationResult` with `ok`, deterministically
traversed issues, actual
counts, expected minima, count mode, total, and fingerprint. Each
`ContentValidationIssue` has a stable code, data path, and human-readable message.
The declared failure classes are:

- count below minimum or not exact;
- duplicate, malformed, mismatched-kind, or nondeterministically ordered IDs;
- duplicate localization keys, missing localized copy, invalid names, placeholder
  names, or descriptions that are blank or merely restate the name;
- invalid seasons, unlock ranges, or unresolved prerequisites;
- invalid economy data or missing category-specific functional data;
- unknown references or references to the wrong content kind;
- empty, nonpositive, or otherwise invalid recipes and missing factory
  capability coverage;
- invalid footprints, capacities, rooms, stations, access, or sanitation; and
- decorations without a coherent placement rule or functional effect.

The registry must report all deterministic issues it can find in one pass so a
catalog author can repair a complete set of paths. Assertion-oriented callers may
then turn the same result into a hard failure instead of maintaining a second set
of completeness rules.

## Delivery verification status

This catalog page documents the typed implementation contract and must not be
treated as runtime, visual, or release proof. Tests, independent review, and
capture workflows were intentionally not run for this accelerated documentation
delivery.
