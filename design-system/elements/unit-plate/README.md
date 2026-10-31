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

The 104-cell plate. Between each `◢ ◤` and `◥ ◣` pair the background is acid; under it the hairlines keep their `─` in the darker accent.

## Usage

```js
import { unitPlate } from './unit-plate.mjs';
const { lines, paint } = unitPlate({ unit: 'DRD-C0DE', serial: '0000-BEEF', seed: 0xbeef }, { width: 104 });
// lines: 6 lines of 104 cells; paint: the peak's 12 painted runs, [{ row: 0, start: 54, end: 59 }, …]
unitPlate({ unit: 'DRD-????', serial: '????-????' }, { width: 48, titleBlock: false }).lines; // the left block only
```

## Contract

`unitPlate(input, { width, titleBlock = true })` returns `{ lines, paint }`; `UNIT_PLATE_ROWS` is 6.

- `input`: `{ maker = 'INDUSTRIAL-OS', registered = true, unit, serial, title = 'PI AGENT DROID', mark = '⟁', division = ['HALDENN', 'DYNAMICS'], seed = 0 }`. `unit` is pixel text: characters of the [pixel numeral](../pixel-numeral/README.md) `FONT`, `HEX_FONT` and `LETTER_FONT`, such as `DRD-C0DE`; a `?` is an unknown digit. `serial` is a non-empty string. `mark` is one printable-ASCII or curated glyph, or `null` for none. `division` is two strings, set at the block's left and right ends. `seed` is an integer and seeds the barcode.
- `lines` are six lines of exactly `width` cells. `paint` lists `{ row, start, end }`, the cells `[start, end)` of `lines[row]` the peak's paint covers, edges included, for a motion that must treat the paint as decoration on the ground (the [CRT boot](../../motions/README.md#crtbootlines-options-and-crtbootdurationlines-options)'s `paint` option). It is empty when there is no peak.
- Data only: no input, clock, timer or I/O. The host supplies every value and the seed.

### Geometry

- Rows 0 and 5 are hairline rules with bold `+` ends. Row 5 holds ` S/N <serial> ` from column 1, the label in label grey and the serial in ink, cut with `…` to fit.
- The left block starts at column 2: the maker in bold ink with ` ®` on row 1, and the unit's 3×5 pixel wordmark on rows 2–4 in bold ink, unknown `?` digits in label grey. When the wordmark does not fit whole before the last cell, the unit is bold text on row 2 instead, cut with `…`.
- The title block hugs the right margin (its last cell at `width − 3`), as wide as its longest line: the mark and title in bold ink on row 1, the seeded barcode on rows 2 and 3 (the same bars on both), and the division on row 4 in label grey. It is drawn only when `titleBlock` is true and it starts at least three cells after the left block's last cell; otherwise the left block takes the row. A maker too long to share the row displaces the title block.
- The maker loses ` ®` before it is cut, and is cut with `…` to the room it has: up to two cells before the title block, or to the last cell but one.
- The peak: a slash stroke `◢…◤` and its mirror `◥…◣` meeting at the top as a hollow `/\`, across all six rows and centred between the blocks. Each stroke moves out one cell a row. Its interior is 3 cells wide, narrowing to 2 and then 1 when that is what keeps it two cells clear of the left block (the longest of its maker, wordmark or unit text) and three of the title block; with no title block, or no room even for 1, there is no peak. At 104 cells the stroke is 3 cells wide; there is no peak below 72 cells with the default text.

## Colors

The ground is the crate banner's brushed aluminium, per cell, from [`aluminiumAt`](../../foundation/README.md#surface) (`ALUMINIUM_GROUND`): every cell but the peak's acid takes its ground, and a hairline its ground's hairline (28 darker). Ink is `field`, labels and unknown digits `SURFACE_PALETTE.aluminiumLabel`, the peak's edges and interior `accent`, and a hairline under the paint `SIGNAL_COLORS.accent75`. No value is restated here.

## Text, errors and checks

Caller text is shown as printable ASCII ([text contract](../../foundation/README.md#text-and-glyph-contract)); element glyphs (`® ⟁ ◢ ◣ ◤ ◥`, the pixel blocks and barcode bars) are curated one-cell glyphs. A non-object input, a non-string text, a non-boolean flag, a mark that is not one approved glyph or a division that is not two strings throws `TypeError`; an empty unit or serial, a unit character the pixel font lacks, a non-integer seed or an invalid width (1–1000) throws `RangeError`. Inputs are not changed.

Run [unit-plate.test.mjs](unit-plate.test.mjs) with `node --test`, then the [full validation sequence](../../CONTRIBUTING.md#full-validation-sequence). It holds the approved mockup's plate text at 104 and 64 cells and the peak's spans, checks every width 1–160 with and without the title block for the ground and hairline formula at every cell, the listed paint, and curated glyphs only, and covers the room rules, the text fallback, unknown digits, the barcode seed, the long-maker order and invalid input. The storybook's UNIT PLATE story shows the hanging, stacked, plate-only and unknown plates. `⟁`, the peak edges and the barcode glyphs have not been reviewed at a real font size in a native terminal.
