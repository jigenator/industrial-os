# Crate banner

The maker's plate at the top of a crate pane, modeled on Lunalee's chat pane header (approved mockups, 31 October 2026; the brushed-aluminium ground, frosted strip and division row from round 5): a six-row brushed-aluminium plate with a grid of hairlines, the maker with the division under it, serial, HOLD count, clock, unit and barcode, one slanted acid stroke, and a strip of tools under it, solid black or frosted over the host's background. A one-row compact form is for short or narrow panes.

```
██+──────────────────────────◢────◤───────+────────────────+
██│ INDUSTRIAL-OS ®         ◢████◤     ⟁  │ HOLD 2   09:34 │
██│ HALDENN DYNAMICS       ◢████◤         +────────────────+
██│                       ◢████◤          │ UNIT      M-02 │
██│                      ◢████◤           │ ▌▏▏▍▐▐█▏▍▐▍▍▍▐ │
██+ S/N 2610-0427 ──────◢────◤────────────+────────────────+
  ▦ BOARD · │ ≡ NOTES · │                                     (black or frosted strip)
```

Here `█` stands for an acid background cell: the stripe and the stroke's interior are spaces on acid, and the rules under the stroke keep their `─` in the darker accent. This is the 60-cell plate; at 40 cells the stroke is three cells wide and meets the column line.

## Usage

```js
import { crateBanner } from './crate-banner.mjs';
import { surfaceAt } from '../../foundation/surface.mjs';
const { lines, tools } = crateBanner({
  serial: '2610-0427', hold: 2, clock: '09:34',
  tools: [{ id: 'board', label: 'BOARD', icon: '▦', state: 'open' }, { id: 'notes', label: 'NOTES', icon: '≡', state: 'ready', hover: true }],
}, { width: 60 });
// lines: 7 lines of 60 cells; tools: [{ id: 'board', row: 6, start: 0, end: 12 }, { id: 'notes', row: 6, start: 13, end: 24 }]
crateBanner({ serial: '2610-0427', hold: 0, clock: '09:34' }, { width: 32, form: 'compact' }).lines; // one line
// With the host's background under the strip row (here the default surface gradient), the strip is frosted.
const stripBackdrop = Array.from({ length: 60 }, (_, x) => surfaceAt(x, 6, { width: 60, height: 22 }));
crateBanner({ serial: '2610-0427' }, { width: 60, stripBackdrop });
```

## Contract

`crateBanner(input, { width, form = 'full', measure, stripBackdrop = null })` returns `{ lines, tools }`.

- `input`: `{ maker = 'INDUSTRIAL-OS', registered = true, division = 'HALDENN DYNAMICS', unit = 'M-02', serial, hold = null, clock = null, mark = '⟁', tools = [] }`. `serial` is a required non-empty string. `hold` is a non-negative integer or `null` (unknown). `clock` is an `HH:MM` 24-hour string the host formats, or `null` (unknown). `mark` is one printable-ASCII or curated glyph, or `null` for none.
- Each tool is `{ id, label, icon?, state, hover = false }`: `state` is `'ready'`, `'open'` or `'disabled'`; `hover` is a separate flag the host sets while the pointer is over the tool. `icon` is one printable-ASCII or curated glyph. Ids are unique.
- `lines` are exactly `width` cells each: seven for the full form (rows 0–5 the plate, row 6 the strip), one for the compact form. The full form below **40** cells draws the compact row instead, so check `lines.length`.
- `tools` lists `{ id, row, start, end }` for each tool drawn, in input order: the cells `[start, end)` of `lines[row]` the host hit-tests. The divider after a tool is not part of it. A disabled tool's span is reported too; the host ignores clicks by state. A tool left out for want of space has no span.
- `stripBackdrop`: the host's background under the strip row, one `#rrggbb` string per cell (exactly `width` of them), or `null`. Given, the strip is frosted; `null` keeps it solid black, the fallback for a host without 24-bit color or a known surface. It is validated in both forms; the compact form has no strip and ignores it.
- Data only: the element owns no input, focus, clock, timer or I/O. The host supplies the clock reading and the backdrop, and redraws when either changes.

### Full form

Geometry: an acid stripe in columns 0–1 of the six plate rows; the frame's left line at column 2 and text from column 4; the right edge at `width − 1`. **Wide** (56 cells or more): a 17-cell right column, its line at `sep = width − 18`, and a stroke 6 cells wide whose row-0 left edge is `sep − 13`. **Narrow** (40–55): a 16-cell right column (`sep = width − 17`) and a 3-cell stroke whose row-0 left edge is on the column line. At 60 cells `sep` is 42 and the stroke starts at 29; at 40, 23 and 23, as in the mockup.

- Rows 0 and 5 are hairline rules, row 2 a rule across the right column, with `│` hairlines at the left line, the column line and the right edge on rows 1–4. Bold ink `+` crosses mark where they meet.
- Row 1: the maker in bold ink, one blank cell and `®`; the mark in bold ink three cells left of the column line, always followed by a blank cell, because `⟁` is not in common terminal fonts and its fallback can spill about 0.6 cell. On the right: `HOLD` and the count, then the clock at the cell's right end. Row 2: the division in label grey, directly under the maker (at 40 cells a blank cell is left before the stroke). Row 3: on the right `UNIT` and the unit, right-aligned in bold ink; on the left open ground, as is row 4. Row 4: a barcode generated from the serial, filling the right cell. Row 5: ` S/N <serial> ` in label grey on the bottom rule, its `S` under the maker's first letter.
- The stroke `/` steps one cell left on each row down. Its edges are `◢` and `◤` in acid on paper; between them the background is acid and a hairline under it turns `SIGNAL_COLORS.accent75`; crosses keep their ink. In narrow geometry the edges replace the crosses they land on. The stroke never sits behind text: the maker stops before it (and one cell before the mark), the division and serial before it, and each is cut with `…` when it would reach it. `®` goes before the maker is cut.
- HOLD: the count in bold ink when above zero, label grey at 0, `99+` above 99 and a grey `?` when unknown. The clock is bold ink, or a grey `--:--` when unknown. When `HOLD 99+`, a gap and the clock do not fit the cell (narrow geometry), the clock is left out: HOLD has priority.
- The unit is cut with `…` to the cell beside `UNIT`.
- Strip (row 6, black or frosted): a blank cell, then each tool as ` ▦ LABEL · ` and a structural `│` divider; the icon and the trailing blank only in wide geometry. Labels are bold white, never cut; a tool that does not fit whole is left out with every tool after it.

Tool states, each with a shape as well as a color: **ready** shows a decorative `·` lamp; **open** an acid `●`; **disabled** a structural, regular-weight label and no lamp (blank cells keep the item's width, so nothing moves). **Hover** paints the whole item black on acid and keeps the lamp's shape (`●` open, `·` ready); it is ignored on a disabled tool. On the full form's strip the first tool also owns the strip's leading cell (its span starts at column 0), so its hover lines up with the stripe above it; in the compact row tools keep their leading blank.

**Frosted strip:** every strip cell that would be black takes white at `FROST_ALPHA` (10%) over the backdrop's cell below it. The ready lamp lifts to `frostLamp` and the dividers and disabled labels to `frostRule`, so they keep at least 3:1 over a dark pane: over `#131416`–`#222325` the lamp is 4.21–5.10:1 and the dividers and disabled labels 3.18–3.84:1 (on solid black they are 4.30:1 and 2.82:1, as before). The frost is designed for a dark backdrop; a light one lowers these. White labels and the acid lamp are unchanged. A hovered item stays solid acid. Glyphs, spans and the plate are the same in both strip modes.

### Compact form

One aluminium row: the two-cell stripe and a blank, the maker and `®`, then at least two cells on, `HOLD n`, two blanks, the clock and a blank, and the tools as strip chips (black, the same states) to the right edge. As the width shrinks, parts are shed in this order: tool icons, `®`, the clock, HOLD, then tools from the last; the maker is cut with `…` last of all. Below six cells the stripe gives way to the maker. Division, unit, serial and barcode are not shown. Tool spans are on row 0.

## Colors

**Aluminium ground.** Every plate cell that is not acid paint takes its own color, as the approved mockup computes it from `ALUMINIUM_GROUND` (foundation [surface-palette](../../foundation/surface-palette.mjs)): `l = base + band·(1 − u²) − fall·t + Σ amplitude·sin(x·streak.x + y·streak.y)`, RGB `l` plus `channels` on each channel, rounded and clamped to 0–255. `x` is the column, `y` the plate row, `u = 2x/(width − 1) − 1` (0 on a one-cell row) and `t = y/5`. The compact row is brushed as plate row 0 (`y = 0`, `t = 0`): the mockup has no compact form, and row 0 is the plate's top. A hairline is its cell's ground plus `hair` on each channel (28 darker). Color only: no texture glyph is added.

Ink and the strip are `field`, white is `primary`; labels on the plate are `SURFACE_PALETTE.aluminiumLabel` `#4f5257`, at least 4.82:1 on the darkest possible ground (`l` 203.2), so at every width. The ready lamp is `decorative`, dividers and disabled labels `structural` on the solid strip, and `frostLamp` and `frostRule` on the frosted one; the stripe, stroke, open lamp and hover are `accent`, and a hairline under the paint `SIGNAL_COLORS.accent75`. The frosted ground is `blendFill('primary', backdrop[x], FROST_ALPHA)`. No value is restated here.

## Text, errors and checks

Strings are shown as printable ASCII unless `measure` is supplied ([measured text](../../foundation/README.md#measured-text-slots)); then the maker, division, unit, serial and labels keep Unicode and are cut at whole graphemes. Element glyphs (`® ⟁ ▦ ≡ ◢ ◤`, the bars) are curated one-cell glyphs. A non-object input or tool, a non-string text, a non-boolean flag, or a mark or icon that is not one approved glyph throws `TypeError`; an invalid width (1–1000), form, tool state, an empty serial, a duplicate id, a negative or fractional hold or a malformed clock throws `RangeError`. A `stripBackdrop` that is not an array or `null`, or holds anything but `#rrggbb` strings, throws `TypeError`; one whose length is not `width` throws `RangeError`. Inputs are not changed.

Run [crate-banner.test.mjs](crate-banner.test.mjs) with `node --test`, then the [full validation sequence](../../CONTRIBUTING.md#full-validation-sequence). It holds goldens of the glyph and the color, background and weight of every visible cell at 60 and 40 cells, for HOLD 0, 2 and 12 with both strip modes, taken from the approved mockup's own cell engine, and checks every width from 1 to 160 in both forms, including the ground formula, the hairlines and the label contrast at every cell. The storybook's CRATE BANNER story shows both geometries, HOLD 0 and many, every tool state, the frosted strip and the compact row at several widths. `⟁`, the stroke edges, the barcode glyphs and how the per-cell aluminium steps read at a real font size have not been checked in a native terminal.
