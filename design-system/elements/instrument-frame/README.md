# Instrument frame

status-bar's framed footer layout as a reusable frame: heavy corner stubs and side stubs with no continuous rule, a header line, an eight-cell plate column, content that wraps at the content column, and a minimal fallback with inline plates below 40 columns. **The frame owns geometry only.** Plates, the title, the header aside and every content line are caller-rendered spans; the frame never invents or truncates a value it can wrap.

## Usage

```js
import { frameGeometry, instrumentFrame, wrapLine } from './instrument-frame.mjs';
import { labelPlate } from '../label-plate/label-plate.mjs';
import { COUNT_PLATES, countPlate } from '../count-plate/count-plate.mjs';
import { threadRailPieces } from '../thread-rail/thread-rail.mjs';

const activity = { working: true, units: 3 };
const slab = (text, tone) => labelPlate(text, { form: 'slab', tone });
const { contentWidth } = frameGeometry(80);            // render gauges and other fixed rows at this width
instrumentFrame({
  header: {
    plate: countPlate(12, COUNT_PLATES.compactions),
    title: [{ text: '■ owner/repo · PR #42', style: {} }],
    aside: [threadRailPieces(activity), threadRailPieces(activity, { marks: false })],
  },
  spacer: [[{ text: 'cwd /launch unrelated', style: { fg: 'secondary' } }]],
  rows: [
    { plate: slab('01 ACT', 'accent'), lines: [[{ text: '⑂ feature/ui modified', style: {} }]] },
    { plate: slab('03 MDL', 'bright'), lines: [[{ text: 'provider/model · thinking high', style: { bg: 'surface' } }]], bg: 'surface' },
    { plate: slab('05 EXT'), lines: [[{ text: 'Other status', style: {} }], [{ text: 'Ponytail: ready', style: {} }]] },
  ],
}, { width: 80 });
```

```text
┏━ CMP×12  ■ owner/repo · PR #42        ┼       █  ROOT  █·█·█·······  03 AU  ━┓
┃          cwd /launch unrelated                                               ┃
   01 ACT  ⑂ feature/ui modified
   03 MDL  provider/model · thinking high
┃  05 EXT  Other status                                                        ┃
┗━         Ponytail: ready                                                    ━┛
```

At 30 columns the same input is the minimal fallback:

```text
 CMP×12  ■ owner/repo · PR #42
█  ROOT   03 AU
cwd /launch unrelated
 01 ACT  ⑂ feature/ui modified
 03 MDL  provider/model ·
thinking high
 05 EXT  Other status
Ponytail: ready
```

## Contract

`instrumentFrame({ header, spacer, rows }, { width, centerMark = true })` returns lines of exactly `width` cells (1–1000).

| Input | Contract | Default |
| --- | --- | --- |
| `header.plate` | spans, at most 8 cells, placed on the plate column of the header line | none |
| `header.title` | one line of spans, starting on the content column; wraps | none |
| `header.aside` | alternatives, widest first; each is a non-empty array of pieces (arrays of spans), joined by one field cell | none |
| `spacer` | lines for the one framed row between the header and the numbered rows; blank when empty | `[]` |
| `rows[].plate` | spans, at most 8 cells, on the row's first line | none |
| `rows[].lines` | lines of spans; the first follows the plate, the rest continue without one | `[]` (one empty line) |
| `rows[].bg` | a role or `#RRGGBB` that fills the row's gap cell and the padding after its content | field |
| `centerMark` | draw the standalone center `┼` when it has clear space | `true` |

`frameGeometry(width)` returns `{ minimal, gutter, plateWidth, contentColumn, contentWidth }`, so a caller can render fixed rows such as a gauge at `contentWidth`. `wrapLine(line, width)` is the frame's span-preserving word wrap.

## Framed layout (40 columns and wider)

| Width | Gutter `G` | Corner stubs | Plate column | Content column | Content width |
| --- | --- | --- | --- | --- | --- |
| 40–59 | 1 | `┏` `┓` `┗` `┛` | `G` to `G + 7` | `G + 9` = 10 | `width - 11` |
| 60+ | 2 | `┏━` `━┓` `┗━` `━┛` | `G` to `G + 7` | `G + 9` = 11 | `width - 13` |

- **Stubs, not borders.** The header line carries the top corner stubs and the last row the bottom ones. `┃` side stubs appear only on the first and the next-to-last inner rows; other rows have blank gutters. There is no continuous top, bottom or side rule. Stubs are decorative grey and carry no meaning.
- **Header line:** the plate on the plate column, the title's first line on the content column, the center `┼` at `floor(width / 2)` only when it is clear of the title and of the aside by at least two cells, and the aside right-aligned with one field cell of clearance before the corner.
- **Aside yielding:** the widest alternative that fits beside the whole (unwrapped) title is used. If none fits, the aside takes its own row after the title's continuation lines, right-aligned, using the widest alternative that fits the row, and the title then wraps up to the corner clearance. With the [thread rail](../thread-rail/README.md)'s two forms this is status-bar's yielding: marks go first, then the rail moves to its own row. An alternative wider than its own row is clipped; give a narrower alternative to avoid that.
- **Spacer row:** one framed row, blank or the caller's spacer lines (status-bar's `cwd` line), so the numbered plates stay together and the frame's height does not change when the spacer fills.
- **Rows:** the plate, one gap cell, then content. Every line wraps at the content width; continuation lines and further lines leave the plate column as plain field, with no plate color below a plate. Plates narrower than 8 cells are padded with field.

## Minimal fallback (below 40 columns)

No stubs, gutters, plate column or spacer row. The header is the plate, one field cell and the title, wrapped together; then the narrowest aside alternative, its pieces packed one field cell apart onto as many lines as needed (a piece wider than the line wraps); then the spacer lines; then each row's plate inline, one field cell and its first line, wrapped together, and its further lines. Every value wraps rather than truncating, so at very narrow widths a plate's own words can wrap apart, as in status-bar.

## Wrapping

`wrapLine` follows the rules of Pi's `wrapTextWithAnsi` as status-bar uses it: a line that fits is unchanged; otherwise it breaks at spaces, splits a word longer than the line into line-width pieces, trims trailing spaces of wrapped lines, and drops lines left blank. Each span keeps its style. Caller spans must already follow the [text contract](../../foundation/README.md#text-and-glyph-contract): use `safeText` for external text.

## Glyphs and colors

`┏ ┓ ┗ ┛ ━ ┃ ┼` from the curated set, in the decorative role. Everything else comes from the caller's spans.

## Differences from status-bar

- **No anchors to a context numeral.** status-bar aligns ROOT and the AU badge to its large numeral's divider and captions when they fit; the frame right-aligns the aside. A caller can reproduce an anchored spacing by adding cells to a piece (the 100-column test does this).
- **No numeral side panel.** status-bar places its numeral beside the last three context rows; here anything beside the rows is part of the caller's content lines.
- **Fixed rows are the caller's.** status-bar builds its gauge and scale at the content width; a caller does the same with `frameGeometry(width).contentWidth`. Lines wider than that wrap at spaces.
- **Pre-styled runs.** status-bar measures other extensions' SGR-styled text with Pi's width functions; the design system's content is spans under the narrow text contract.
- **Boot and ambient motion** (corner draw-in, `┼` nudge, plate wipes, ghosts, re-strikes) are not part of the frame.

## Checks

[instrument-frame.test.mjs](instrument-frame.test.mjs): status-bar's own footer snapshots at 100, 72, 48 and 30 columns reproduced from caller content, the geometry by width, wrapping at the content column with plain continuation plate columns, row backgrounds, the title/aside/own-row and center-mark rules, `wrapLine`, every width from 1 to 160 with no value lost and plain/color equivalence, and invalid input. The tests import the label plate, count plate and thread rail to build content; the frame itself imports only `foundation/`.
