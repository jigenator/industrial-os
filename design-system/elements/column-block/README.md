# Column block

herdr-sidebar's layout B geometry as a generic block: gutter · value · right-aligned slot, with optional fixed marks after the value. **Geometry only:** callers supply all data, state and rendered pieces. The element imports no other elements.

## Usage

```js
import { columnBlock } from './column-block.mjs';
import { lineMeter } from '../line-meter/line-meter.mjs';
import { countPlate, COUNT_PLATES } from '../count-plate/count-plate.mjs';
import { span } from '../../foundation/cells.mjs';
columnBlock([
  { head: true, gutter: [span('○ IDL')], value: 'release', right: '2h33m' },
  { gutter: '02AU', value: (cells) => lineMeter({ percent: 67 }, { maxWidth: cells }),
    right: countPlate(18, COUNT_PLATES.compactions, { maxWidth: 6 }) },
  { gutter: 'ACT', value: [span('feat/sidebar*', { fg: 'warning' })], right: '#42' },
  { gutter: 'MDL', value: 'opus-5.5/hi' },
  { gutter: 'PNE', value: 'Updating sidebar', right: '12s' },
], { width: 34 });
```

```text
 ○ IDL  · release         ·  2h33m
   02AU · ━━━━━━━━─── 67% · CMP×18
   ACT  · feat/sidebar*   ·    #42
   MDL  · opus-5.5/hi
   PNE  · Updating sideb… ·    12s
```

Fixture values, not telemetry. The count plate's bare six-cell form fits the slot; its default padded form would be cut. For sidebar-style foreground-only count ink, the caller supplies those styles instead of the count plate's filled badge styles.

## Contract

`columnBlock(rows, options)` returns lines, each exactly `width` cells, padded with normal field spaces.

| Input/option | Contract | Default |
| --- | --- | --- |
| `rows` | array of row objects; an empty array renders no lines | required |
| `head` | boolean, selects headIndent for this row (not inferred from position) | false |
| `gutter`, `value`, `right` | string or array of caller-rendered spans; empty text/arrays or omitted means absent. `value` may also be a function `(cells) => part`, called with its cell budget; it must render within it or a `RangeError` is thrown | absent |
| `marks` | array of fixed parts (each a string or span array), placed after value | `[]` |
| `width` | integer 1–1000 | required |
| `gutterEnd` | end of gutter, zero-based exclusive; integer 1–1000 | `7` |
| `headIndent`, `indent` | integer from 0 to gutterEnd−1 | `1`, `3` |
| `separator` | nonempty string of printable ASCII/curated glyphs | `' · '` |
| `textCells` | integer 1–1000, text-area cap | `24` |
| `rightCells` | integer 1–1000; rightCells + separator width must be below textCells | `6` |

Strings go through `safeText`: default ink is decorative for gutter, secondary for value, marks and right. Caller spans keep their styles and must follow the [foundation text/glyph contract](../../foundation/README.md#text-and-glyph-contract); their text/styles are validated, not sanitized or mutated. Separators use decorative ink. State ink is caller-owned: use warning/critical roles for motion protection.

## States and presence

No state is inferred. The caller can pass unknown readouts, idle tones, warning-colored dirty branches or critical marks. Empty parts do not generate separators; a wholly empty row generates no line. Whitespace-only parts are present. Null is not an absent part: omit the field instead. A row with only a gutter renders that gutter without a separator. A value without a gutter is a continuation at the text column, including when it is the first supplied row.

## Normal geometry

Default natural width is `gutterEnd + separator width + textCells = 34`. The text starts at zero-based column 10, after a six-cell head gutter at column 1 or a four-cell ordinary gutter at column 3. Gutters are cut/padded to their slot. Wider blocks pad on the right rather than stretching columns.

With right present, the left area is 15 cells (`24 − 3 − 6`), padded or cut with `…` in the last cell, then the separator and six-cell right-aligned slot. An oversized right value is cut to five cells plus `…`. Without right, value has up to 24 cells (23 plus `…` on overflow), without padding before marks. Each mark is preceded by a separator only when another part precedes it. Marks reserve their whole width and separators from the value's budget, never from the right slot.

```text
 ○ IDL  · long-project-n… ·  2h33m
 ○ IDL  · long-proje… · ● ·  2h33m
   ASK  · Choose a target
          then confirm
```

## Narrow rule

1. Keep the text column while at least one text cell fits. Its available width is `min(textCells, width − textColumn)`. Reserve all marks, the right slot and separators first. If a present value gets at least one cell, cut it to the remainder (`…` even at one cell). The right slot ends at the available area's right edge. With no value, fixed parts may occupy the entire area.
2. If that reservation cannot fit, put the cut value on the gutter's first line, then **every mark in order on its own continuation line, then right**. No separators occur across lines. A gutter with no value takes its own first line; no empty first line is invented.
3. A fixed part that fits the text area starts at the text column, a stacked right value right-aligned to the area's edge. Otherwise it moves to an unindented line, a right value right-aligned to the line's edge. If the part itself exceeds the whole width, hard-wrap it across full-width lines with every cell/style retained. This is wrapping, not silently clipping a partial badge or dropping a mark.
4. At or below the text column (default width 10), omit alignment/indent: gutter on its own wrapped lines, value cut to `min(textCells, width)`, then fixed parts as above. Wider than natural, field-pad on the right.

Values are truncatable; fixed marks are not. Oversized right values always obey the explicit rightCells cut before stacking. A string or span value is cut with `…`, so pass a reading such as a line meter as a function: it is rendered at its budget and keeps its own narrow fallback (`━━━─ 67%`, then `67%`) instead of losing its readout. This layout does not inspect or reinterpret another element's meaning.

## Invalid input

Invalid row/part/span/style shapes, unsafe span text, nonboolean head, or unsafe/nonstring separator throw `TypeError`. Invalid dimensions, indents or incompatible slot/separator sizes throw `RangeError`. Nothing is silently coerced. Normal string sanitization is not an error. No I/O, interaction, timers or data lookup is owned here.

## Differences from herdr-sidebar

Modeled on [layout B](../../../herdr/docs/design.md#layout-b) and its [token geometry](../../../pi/herdr-sidebar/docs/token-contract.md#geometry), not its reporting/runtime. The default column sizes match, but this kit also supports narrow stacking and wider field padding. It emits ordinary spaces: U+2800 exists only because Herdr trims transport values. Strings follow the DS printable-ASCII contract rather than Herdr's grapheme-aware control removal/Unicode measurement; rendered spans can use curated structural glyphs. The sidebar's `◐` and `✓` are now curated in foundation and can be supplied in rendered spans; `◐`'s one-cell prerequisite is verified in Herdr only (see the [foundation glyph contract](../../foundation/README.md#text-and-glyph-contract)). Fixtures also use `○ IDL`, `× QNS` or `· UNK` spans. String glyphs are still ASCII-sanitized like any other caller string.

## Checks

From `design-system/`: `node --test elements/column-block/column-block.test.mjs`, then `node --test`. Node 22 standard library only; no install, I/O or side effects beyond test output. [column-block.test.mjs](column-block.test.mjs) covers layout B snapshots, aligned right slots with/without marks, continuations/empty parts, style retention, custom geometry, explicit narrow transitions, widths 1–160, plain/color equivalence, invalid inputs and injection. The storybook composes real line meters and count plates and checks that displayed calls reproduce specimens. Full validation: [Contributing](../../CONTRIBUTING.md#full-validation-sequence). Automated checks only; native Herdr checks not run.
