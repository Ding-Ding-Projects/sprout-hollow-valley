# Sprout Hollow Valley design direction

This document defines the intended look, interaction model, and accessibility baseline for
Sprout Hollow Valley. It applies independently to the Windows application shell, every
in-application page, and the public website. The third-person world direction also applies to
the future playable 3D surface.

The current repository is a foundation. Its inherited farming rules and desktop mechanisms
provide useful starting material, while the low-poly world, complete content catalogue,
enterable structures, and life simulation remain planned work. A design contract describes
the target; it is not evidence that every target is implemented.

## 1. Product character

Sprout Hollow Valley is a warm, legible farm and town rather than a miniature imitation of a
real landscape. Materials have broad planes, silhouettes are readable at a distance, and
important objects are distinguished by shape, label, and state as well as colour. The mood is
hopeful and unhurried without making information vague or controls ornamental.

The visual language combines a low-poly 3D world with an accessible farm-themed Material 3
shell. The website uses the same named tokens and component anatomy, but remains a complete,
responsive surface in its own right. Neither surface delegates accessibility, language,
appearance, search, navigation, or status communication to the other.

## 2. Material 3 foundation

### 2.1 Colour tokens

Components consume semantic roles, never raw palette values. Theme generation may change the
reference palette while preserving each role relationship.

| Reference role | Light seed | Dark seed | Intent |
|---|---:|---:|---|
| Primary | `#386A20` | `#9CD67D` | Growth, primary action, active navigation |
| Secondary | `#55624C` | `#BCCBAD` | Tools, supporting actions, secondary emphasis |
| Tertiary | `#19686A` | `#80D4D5` | Water, information, selected contextual content |
| Error | `#BA1A1A` | `#FFB4AB` | Failure, danger, and irreversible-action warnings |
| Neutral | `#5F5F58` | `#C8C7BE` | Text, borders, quiet controls, and structure |
| Neutral variant | `#5B6056` | `#C4C8BB` | Surface containers and dividers |

The implementation derives the Material 3 roles `primary`, `on-primary`,
`primary-container`, `on-primary-container`, corresponding secondary and tertiary roles,
`surface`, `surface-container-*`, `on-surface`, `on-surface-variant`, `outline`,
`outline-variant`, `inverse-*`, and error roles from these seeds. Seasonal themes may shift
reference hues, but must not change the meaning of a semantic role.

Ordinary text targets at least 4.5:1 contrast; large text, focus indicators, control
boundaries, and meaningful graphics target at least 3:1. Disabled styling may be quieter but
must remain identifiable from its label and state. Success, warning, selection, freshness,
quality, and ownership are never communicated by colour alone.

### 2.2 Typography

Use a local system-font stack headed by Segoe UI Variable and Segoe UI; no remote font is
required to understand or operate the product. The type scale follows Material 3 roles:

| Role | Size / line height | Typical use |
|---|---:|---|
| Display small | 36 / 44 px | Landing-page hero and rare major milestones |
| Headline medium | 28 / 36 px | Page titles |
| Headline small | 24 / 32 px | Major sections and dialogs |
| Title large | 22 / 28 px | Cards, panels, and building headings |
| Title medium | 16 / 24 px | Navigation and dense group headings |
| Body large | 16 / 24 px | Default prose and form values |
| Body medium | 14 / 20 px | Supporting copy and tables |
| Label large | 14 / 20 px | Buttons, tabs, and input labels |
| Label medium | 12 / 16 px | Metadata when a larger role would obstruct scanning |

Text zoom and Windows display scaling must reflow the layout rather than clip or overlap it.
Cantonese and bilingual copy use system glyph coverage and the same semantic type roles.

### 2.3 Shape, elevation, and spacing

Farm character comes from colour, illustration, and restrained texture—not from breaking
component anatomy.

- Shape tokens are 0 px for full-bleed tables, 8 px for small controls, 12 px for cards and
  menus, 16 px for prominent containers, and 28 px for large dialogs and hero panels.
- A 4 px spacing base governs padding and gaps, with common intervals of 4, 8, 12, 16, 24,
  32, and 48 px.
- Elevation levels 0–5 use Material 3 tonal surface separation first and a restrained shadow
  second. More elevation means temporary or modal prominence, not decoration.
- Dividers and outlines use semantic outline roles. Texture never crosses text, controls,
  focus rings, or data graphics.

### 2.4 States and feedback

Every interactive component exposes default, hover, keyboard-focus, pressed, selected,
dragged, loading, disabled, error, and success states where those states are meaningful.
State layers use the current content colour at approximately 8% for hover, 12% for focus and
pressed, and 16% for dragged. A visible 2 px focus indicator with sufficient contrast is
never replaced by a colour wash.

Progress and non-decision feedback use a non-blocking status region that does not steal
focus. Dialogs are reserved for consent, unsaved work, and destructive decisions. Loading
states keep their accessible names, announce meaningful changes without repetition, and
offer a textual failure and recovery path.

### 2.5 Motion

Motion explains location, hierarchy, or cause. Small state changes target 100 ms, ordinary
container and navigation transitions 200 ms, and major spatial changes no more than 300 ms.
Animations are interruptible and never delay input.

Reduced-motion mode removes parallax, camera shake, decorative loops, long pans, and large
scale transitions. It retains immediate state changes and short orientation cues where
removing them would make the interface harder to follow.

### 2.6 Input, touch, and focus

Every action supports keyboard and mouse, and the packaged game targets complete gamepad
parity. Interactive targets are at least 48 by 48 CSS px or have an equivalent unobstructed
hit area. Pointer hover is never the only way to reveal an action. Focus order follows the
visual reading order, focus is restored after temporary surfaces close, and shortcuts never
trap standard text-editing keys.

### 2.7 Responsive layout

The shell and site use content-led layouts with three baseline breakpoints:

- compact: below 600 px, one primary column, bottom or condensed navigation, no horizontal
  page scrolling;
- medium: 600–839 px, one or two columns according to content, navigation rail when useful;
- expanded: 840 px and above, persistent navigation plus bounded reading and tool panes.

Dense tables gain a labelled card or scroll-region alternative rather than shrinking text.
Controls wrap by logical groups. At 200% zoom, all tasks remain available without hidden
content or overlapping controls. Safe areas and window controls remain clear at every size.

## 3. Application shell and website

The Windows shell uses a frameless window with an accessible custom title bar, persistent
tabs, grouped navigation, searchable settings, non-blocking notifications, command palette,
offline documentation, history, appearance editing, and explicit destructive confirmation.
Native HTML elements and truthful accessibility semantics are preferred to simulated
controls.

The website is the public entrance to the same product identity. It carries the farm-themed
tokens, language controls, responsive navigation, foundation-status disclosure, source and
download paths, documentation access, and accessible status messages. Its layout may be more
editorial, but its controls use the same state, focus, contrast, sizing, and motion rules.

Product identity is consistent across title bar, headings, metadata, installer language,
exports, and links. Sprout Hollow Valley must not reuse Sprout Hollow's local data, saves,
update channel, executable identity, or export namespace.

## 4. Third-person low-poly 3D world

### 4.1 Art direction

The world uses authored low-poly meshes with clear silhouettes, flat or lightly graded
materials, restrained texture density, and a consistent human-readable scale. Crops remain
recognisable across growth stages; tools and workstations show their current function from
more than one angle; doors, stairs, lifts, sanitation fixtures, and accessible routes are
visually distinct.

Lighting supports time, season, weather, and interior use without hiding interaction cues.
Sunlight, practical lamps, and emissive accents use bounded intensity. A high-visibility
mode may simplify materials and strengthen outlines or markers without changing collision
or gameplay rules.

Bundled glTF assets are the release source. Runtime asset downloads and online-generated
dialogue are outside the product contract.

### 4.2 Camera and targeting

The default camera follows behind and above the player with orbit, zoom, recenter, shoulder
switching, and obstruction handling. It avoids rapid automatic yaw, wall clipping, and
placing the avatar between the player and the current target.

Indoor profiles shorten the camera arm and adjust collision without changing control
meaning. Camera sensitivity, axis inversion, field of view, shake, recenter strength, and
motion assistance are configurable. Targeting identifies the selected object in shape,
text, and accessible announcements; it does not depend on a faint outline alone.

### 4.3 World streaming

The connected valley is partitioned into deterministic terrain cells with explicit load,
ready, degraded, and failed states. Distance-based detail, occlusion, instancing, and bounded
budgets control mesh, texture, navigation, animation, NPC, and audio memory. Simulation
state remains authoritative when its presentation cell is unloaded.

Cell transitions prefetch along likely travel paths, preserve input responsiveness, and use
a visible recovery state when an asset or cell cannot load. Teleports, save reloads, and
region changes resolve from stable identifiers rather than transient scene objects.

### 4.4 Buildings and interiors

All 700 planned building and factory definitions are fully enterable structures. Exterior
doorways transition quickly into separately streamed, traversable room graphs. Every floor,
room, stair, elevator, restricted space, station, fixture, entrance, and exit has a stable
definition and navigation path.

Every visible door has a real destination. A locked door states why it is locked and how it
can eventually become usable. Interiors include functional, context-appropriate rooms,
lighting, signs, furniture, staffing, storage, utilities, safety equipment, restrooms, and
hand-washing facilities. Decorative shells and fake doors must not imply inaccessible space.

## 5. Language and voice

Every user-facing surface supports three persisted modes:

- English;
- playful Hong Kong Cantonese written for local readability rather than literal word-for-word
  substitution;
- compact bilingual English and Cantonese.

English and Cantonese each have an independent funny-level control from 1 to 5. The level
changes warmth and comic framing, never a fact. Names, quantities, dates, prices, controls,
paths, identifiers, warnings, consent, and recovery instructions retain exactly the same
meaning at every level. Safety-critical copy stays direct even at the highest setting.

Language changes apply immediately, persist locally, preserve the user's place and focus,
and cover accessible names, announcements, validation, empty states, loading, errors, and
offline documentation as well as visible labels. Bilingual layouts reflow instead of
reducing either language to unreadable text.

## 6. Inherited design history

Sprout Hollow Valley is derived from Sprout Hollow under the MIT license. The inherited
product used a fixed-resolution pixel-art canvas, a dusk palette, bitmap typography,
integer scaling, carved-wood panels, and synthesised sound. That work remains part of the
project's history and may inform tone, farming rules, and respectful attribution, but it is
not the current visual contract for Sprout Hollow Valley's shell, website, or 3D world.

See [PLAN.md](PLAN.md), [the product contract](docs/VALLEY-PRODUCT.md), and
[the per-surface completeness inventory](docs/VALLEY-COMPLETENESS.md) for scope and delivery
status.
