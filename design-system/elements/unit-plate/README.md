# Unit plate

A unit's maker's plate, modeled on the Pi droid header (approved mockup, droid-header concepts k-motion `g-shared.mjs`, 1 November 2026): a six-row brushed-aluminium plate with hairline rules at top and bottom, the maker over a pixel wordmark of the unit code, the serial set into the bottom hairline, and optionally a title block (mark and title, a seeded barcode, the division) at the right margin with a hollow acid peak between the two blocks.

```
+─────────────────────────────────────────────────────◢───◤◥───◣───────────────────────────────────────+
  INDUSTRIAL-OS ®                                    ◢   ◤  ◥   ◣                     ⟁ PI AGENT DROID
  █▀▄ █▀▄ █▀▄     █▀▀ █▀█ █▀▄ █▀▀                   ◢   ◤    ◥   ◣                    ▌ ▌ ▍ ▍▏█▎▍ ▏█▎▐
  █ █ █▀▄ █ █ ▀▀▀ █   █ █ █ █ █▀▀                  ◢   ◤      ◥   ◣                   ▌ ▌ ▍ ▍▏█▎▍ ▏█▎▐
  ▀▀  ▀ ▀ ▀▀      ▀▀▀ ▀▀▀ ▀▀  ▀▀▀                 ◢   ◤        ◥   ◣                  HALDENN DYNAMICS
+ S/N 0000-BEEF ─────────────────────────────────◢───◤──────────◥───◣──────────────────────────────────+
```

The 104-cell plate. Here `◢ ◤ ◥ ◣` stand for the peak's edges, which are drawn with the Powerline triangles U+E0BA, U+E0BC, U+E0BE and U+E0B8 (see the peak below). Between each `◢ ◤` and `◥ ◣` pair the background is acid; under it the hairlines keep their `─` in the darker accent.

## Usage

```js
import { unitPlate } from './unit-plate.mjs';
const { lines, paint } = unitPlate({ unit: 'DRD-C0DE', serial: '0000-BEEF', seed: 0xbeef }, { width: 104 });
// lines: 6 lines of 104 cells; paint: the peak's 12 painted runs, [{ row: 0, start: 54, end: 59 }, …]
unitPlate({ unit: 'DRD-????', serial: '????-????' }, { width: 48, titleBlock: false }).lines; // the left block only
// A pane plate: a 16-column block, unlit; and a shell's plate with no barcode or peak.
unitPlate(sessionUnit('01a1e81c-27f3-70f3-b278-150c4f01fa03'), { width: 99, blockWidth: 16, lighting: 'dark' });
unitPlate({ unit: fitUnitCode('TERM', 'ZSH', { width: 99 }), serial: '~/projects', serialLabel: 'DIR', mark: null, title: '', division: ['BRANCH', 'MAIN'] }, { width: 99, blockWidth: 16, barcode: false, peak: false });
```

## Contract

`unitPlate(input, { width, titleBlock = true, blockWidth = 0, barcode = true, peak = true, lighting = 'lit', peakFrom = null })` returns `{ lines, paint, regions }`; `UNIT_PLATE_ROWS` is 6.

- `input`: `{ maker = 'INDUSTRIAL-OS', registered = true, unit, serial, serialLabel = 'S/N', title = 'PI AGENT DROID', mark = '⟁', division = ['HALDENN', 'DYNAMICS'], seed = 0 }`. `serialLabel` is 1–8 printable ASCII characters without spaces, such as `DIR`. `unit` is pixel text: characters of the [pixel numeral](../pixel-numeral/README.md) `FONT`, `HEX_FONT` and `LETTER_FONT`, such as `DRD-C0DE`; a `?` is an unknown digit. `serial` is a non-empty string. `mark` is one printable-ASCII or curated glyph, or `null` for none. `division` is two strings, set at the block's left and right ends. `seed` is an integer and seeds the barcode.
- `lines` are six lines of exactly `width` cells. `paint` lists `{ row, start, end }`, the cells `[start, end)` of `lines[row]` the peak's paint covers, edges included, for a motion that must treat the paint as decoration on the ground (the [CRT boot](../../motions/README.md#crtbootlines-options-and-crtbootdurationlines-options)'s `paint` option). It is empty when there is no peak.
- `blockWidth` is the title block's minimum width (0: as wide as its widest line). The pane plate uses 16, so every block, and the [keycap bay](../action-label/README.md#keycap-bay) under it, spans `W − 18 … W − 3`. With a `blockWidth`, a division wider than the block widens it while it stays three cells clear of the left block; past that its second part is cut with `…`, to no fewer than four cells.
- `barcode: false` leaves the barcode rows blank; `peak: false` draws no peak, and `paint` is empty.
- `lighting` is `lit` (the aluminium plate), or `standby` or `dark`, the graphite levels of an unfocused pane (see Colors).
- `peakFrom` is the first column the peak may paint, an integer 0–1000, or `null` (the default), which centres the peak between the blocks. With a column, the peak's left-most painted cell is that column, or the first cell two clear of the left block if that is later, and the stroke is the widest of 3, 2 and 1 that still ends three cells before the title block; when none fits there is no peak. A host whose own chrome covers the plate's middle uses it: the Herdr pane plate passes the column right of Herdr's drag grip (see [the pane plate](../../../herdr/docs/design.md#pane-plate)).
- `regions` gives the plate's parts as `{ top, left, rows, cols }`, for motions: `wordmark` (with `glyphs`, each unit character's first column; null when the unit is drawn as text), `serial` (the serial's text), and `block` and `barcode` (null when not drawn).
- `fitUnitCode(prefix, code, { width, titleBlock = true, blockWidth = 16 })` returns `<prefix>-<code>` when every character is upper-case A–Z or 0–9 with a pixel glyph and the wordmark fits whole three cells before the block (or before the margin with no block), else the bare `prefix`: never a cut name.
- `sessionUnit(sessionId)` returns a Pi droid's `{ unit, serial, seed }`: `DRD-` and the session ID's last four hex digits, the serial from the first eight of its last twelve, and the barcode seed from its last eight, or null when the ID has fewer than twelve hex digits. The droid header and the Herdr pane plate both use it, so a session reads the same in both.
- Data only: no input, clock, timer or I/O. The host supplies every value and the seed.

### Geometry

- Rows 0 and 5 are hairline rules with bold `+` ends. Row 5 holds ` S/N <serial> ` from column 1, the label in label grey and the serial in ink, cut with `…` to fit.
- The left block starts at column 2: the maker in bold ink with ` ®` on row 1, and the unit's 3×5 pixel wordmark on rows 2–4 in bold ink, unknown `?` digits in label grey. When the wordmark does not fit whole before the last cell, the unit is bold text on row 2 instead, cut with `…`.
- The title block hugs the right margin (its last cell at `width − 3`), as wide as its longest line: the mark and title in bold ink on row 1, the seeded barcode on rows 2 and 3 (the same bars on both), and the division on row 4 in label grey. It is drawn only when `titleBlock` is true and it starts at least three cells after the left block's last cell; otherwise the left block takes the row. A maker too long to share the row displaces the title block.
- The maker loses ` ®` before it is cut, and is cut with `…` to the room it has: up to two cells before the title block, or to the last cell but one.
- The peak: a slash stroke `◢…◤` and its mirror `◥…◣` meeting at the top as a hollow `/\`, across all six rows and centred between the blocks. Its edges are the Powerline full-cell triangles U+E0BA (lower right, the shape of `◢`), U+E0BC (upper left, `◤`), U+E0BE (upper right, `◥`) and U+E0B8 (lower left, `◣`), so a terminal that draws Powerline shapes across the whole cell, as Herdr Desktop does, joins them to the paint smoothly where the font's small triangles would step; a terminal with neither built-in Powerline shapes nor a Powerline-patched font shows an empty box in their place (David accepted this on 2026-11-12). Each stroke moves out one cell a row. Its interior is 3 cells wide, narrowing to 2 and then 1 when that is what keeps it two cells clear of the left block (the longest of its maker, wordmark or unit text) and three of the title block; with no title block, or no room even for 1, there is no peak. At 104 cells the stroke is 3 cells wide; there is no peak below 72 cells with the default text. `peakFrom` moves it right (see Contract).

## Colors

The ground is the crate banner's brushed aluminium, per cell, from [`aluminiumAt`](../../foundation/README.md#surface) (`ALUMINIUM_GROUND`): every cell but the peak's acid takes its ground, and a hairline its ground's hairline (28 darker). Ink is `field`, labels and unknown digits `SURFACE_PALETTE.aluminiumLabel`, the peak's edges and interior `accent`, and a hairline under the paint `SIGNAL_COLORS.accent75`. Unlit, the ground is the graphite of [`graphiteAt`](../../foundation/README.md#surface) (`GRAPHITE_GROUND`, the aluminium formula re-based dark) and every ink is its role's `PLATE_LIGHTING` value: wordmark, values, labels, barcode bars, the `+` corners and the peak, whose paint and edges take one dim acid. No value is restated here.

## Text, errors and checks

Caller text is shown as printable ASCII ([text contract](../../foundation/README.md#text-and-glyph-contract)); element glyphs (`® ⟁`, U+E0BA, U+E0BC, U+E0BE, U+E0B8, the pixel blocks and barcode bars) are curated one-cell glyphs. A non-object input, a non-string text, a non-boolean flag, a mark that is not one approved glyph or a division that is not two strings throws `TypeError`; an empty unit or serial, a unit character the pixel font lacks, a non-integer seed or an invalid width (1–1000) throws `RangeError`. Inputs are not changed.

Run [unit-plate.test.mjs](unit-plate.test.mjs) with `node --test`, then the [full validation sequence](../../CONTRIBUTING.md#full-validation-sequence). It holds the approved mockup's plate text at 104 and 64 cells (its `◢ ◤ ◥ ◣` replaced by the Powerline triangles; no other cell differs) and the peak's spans, checks every width 1–160 with and without the title block for the ground and hairline formula at every cell, the listed paint, and curated glyphs only, and covers the room rules, the text fallback, unknown digits, the barcode seed, the long-maker order and invalid input. It also checks caller text outside printable ASCII (a Unicode branch, maker, title or serial) drawn as `?` at every width 1–160, `peakFrom` over widths 56–200 (its first cell, its right limit, the stroke widths and the left-block floor), `blockWidth`, `serialLabel`, no barcode or peak, both graphite levels, the regions, `fitUnitCode` and `sessionUnit`; the lit output with the default options is unchanged. The storybook's UNIT PLATE story shows the hanging, stacked, plate-only and unknown plates, and the pane plate dark, at standby and as a terminal. The Powerline edges were seen smooth in one Herdr Desktop shot (see [Contributing](../../CONTRIBUTING.md#unit-plate-powerline-edges-2026-11-12)); `⟁` and the barcode glyphs have not been reviewed at a real font size in a native terminal.
