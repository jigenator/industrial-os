# Status strip

The one frosted row under a pane plate, from the approved sticky droid plate (mockup revision 7): what the pane is doing, packed from the left, and the [keycap bay](../action-label/README.md#keycap-bay) at the right on the plate's 16-column title block.

```
  ■ BASH   npm test -- --watch=false   00:43   esc steer                           [|][-][^][x]
```

The 99-cell strip of a working Pi. The Herdr [droid-plate pane header](../../../herdr/docs/design.md#pane-plate) draws it under a [unit plate](../unit-plate/README.md).

## Usage

```js
import { hintSegments, statusStrip } from './status-strip.mjs';
const keys = [{ glyph: '|' }, { glyph: '-' }, { glyph: '^' }, { glyph: 'x' }];
const { line, keys: hit } = statusStrip([{ kind: 'status', glyph: '■', word: 'BASH', tone: 'accent' }, { kind: 'clock', text: '00:42' }], { width: 99, keys });
// line: 99 cells; hit: each key's cells and click area in strip columns, [{ col: 83, len: 3, hitCol: 81, hitLen: 5 }, …]
statusStrip(hintSegments([['esc', 'steer'], ['/', 'commands']]), { width: 48, keys, lighting: 'dark' });
```

## Contract

`statusStrip(segments, { width, keys = [], lighting = 'lit', hover = null, pressed = null })` returns `{ line, keys, status, shown, dropped, gap, clear }`.

- `segments`, in order, each one of:
  - `{ kind: 'status', glyph, word, tone }`: a lamp and its word in bold; `tone` `accent` (working), `primary` (running) or `ready`.
  - `{ kind: 'chip', glyph, word }`: ` ▲ NEEDS YOU ` in bold `field` on `critical`.
  - `{ kind: 'hint', key, action }`: a key in bold ink and its action.
  - `{ kind: 'field', label, value }`: a label and a value, such as `SETTLED 15:02`.
  - `{ kind: 'text', text, clip? }`: detail text; with `clip` it may be cut with `…`.
  - `{ kind: 'clock', text }`: a clock the host formats.
  - Any segment may carry `drop`, an integer priority: lower drops first.
- `hintSegments(pairs)` turns `[key, action]` pairs into hint segments whose `drop` falls from left to right, so the rightmost goes first.
- `keys` are the bay's keys, `{ glyph }` each; with none, or when the bay would start left of column 2, there is no bay. `hover` and `pressed` are key indexes for the bay.
- `line` is exactly `width` cells. `keys` lists each bay key's three cells (`col`, `len`) and its click area (`hitCol`, `hitLen`) in strip columns. `status` is the first segment's cells when it is a status or chip (for a [latch](../../motions/README.md#latchlines-options-and-latchdurationoptions)), else null. `shown` lists the indexes of the segments drawn, `dropped` how many were not, and `gap` and `clear` the spacing used.
- Data only: no clock, timer, input or I/O.

### Packing

Segments start at column 2. They are tried with a 3-cell gap and 3 clear cells before the bay, then 2 and 2, then 2 and 1 (`STRIP_SPACING`). When none fits, the lowest `drop` priority goes; with no droppable segment left, a clippable text longer than eight cells is cut with `…`; then the last segment goes. Without a bay, text may reach the last cell but two. A strip narrower than four cells shows no segment. The bay is 16 columns, `W − 18 … W − 3`, so its last key ends three cells before the right edge at every width it fits.

## Colors

| Lighting | Ground | Inks |
| --- | --- | --- |
| `lit` | The frost: `FROST_ALPHA` of white over the surface gradient's top row with a steep fall (`STRIP_FROST`), per column (`frostAt`) | Keys and detail `primary`, actions and clocks `SURFACE_PALETTE.frostLamp`, READY `frostLamp` |
| `standby` | The lit frost | Keys, actions and detail from `PLATE_LIGHTING.standby` |
| `dark` | `PLATE_LIGHTING.dark.strip`, the surface | Keys, actions, detail and READY dimmed from `PLATE_LIGHTING.dark` |

Status lamps in `accent` or `primary` and the chip keep their lit inks at every level, so a working or blocked pane reads in the dark. The bay's inks are `BAY_INKS`. No value is restated here; they live in [surface-palette.mjs](../../foundation/surface-palette.mjs).

## Text, errors and checks

Caller text is shown as printable ASCII ([text contract](../../foundation/README.md#text-and-glyph-contract)); glyphs are the host's one-cell lamps. A segment of another kind, a missing or empty string, a status tone other than the three, a non-integer `drop`, a non-boolean `clip`, keys that are not an array, another lighting or an invalid width (1–1000) throws. Inputs are not changed. The frost row is memoised for the last twelve widths, since a strip with a clock redraws every second.

Run [status-strip.test.mjs](status-strip.test.mjs) with `node --test`, then the [full validation sequence](../../CONTRIBUTING.md#full-validation-sequence). It checks the mockup's packing at 48–99 cells, the bay at W − 3 with its hit areas, every state, every lighting level's inks, every width 1–160 with and without the bay, and invalid input. The storybook's STATUS STRIP story shows Pi idle, working, needs you, a narrow strip, dark and standby with a hovered key. Not reviewed at a real font size in a native terminal.
