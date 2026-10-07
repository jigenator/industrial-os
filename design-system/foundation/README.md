# Foundation: cells and palette

The small seam every element shares. [palette.mjs](palette.mjs) holds the design system's copy of the Acid / Black values; the Pi extensions are the authority for them, as [design](../../docs/design.md#acid--black) and [the decision](../../docs/decisions/extension-colors-take-precedence.md) record; the check is a comparison of each extension's constants against this file. [cells.mjs](cells.mjs) defines the line model, the text and glyph contract, and painting. Element behavior does not belong here.

## Line model

A rendered line is an array of spans `{ text, style }`. `style` is `{ fg, bg, bold }`: each color is an Acid / Black role or a literal `#RRGGBB` string. Omitted or `undefined` colors default to secondary text on the black field; bold defaults to false. Renderers finish each line with `fitLine(line, width)`, so it is exactly `width` cells: clipped or padded, never wider.

Low-level `span()` and `fitLine()` store styles without validation. They and `paint()` consume already-conforming text; they do not sanitize arbitrary spans. Use `safeText()` when constructing spans from external text. Caller-rendered panel bodies must follow this same contract.

`resolveColor(value)` returns the `#RRGGBB` of a role name or an exact `#RRGGBB` string and throws `TypeError` otherwise; `paint` uses it, and motions that compute colors (such as mixes) use it to read a role's value.

`paint(line, 'truecolor')` validates foreground/background and emits 24-bit SGR codes plus a final reset (including for an empty line). It accepts only own role names from `ACID_BLACK` or primitive strings of exactly seven characters: `#` plus six hexadecimal digits, case-insensitive. Unknown/prototype names, nonstrings, shorthand, alpha, whitespace and control suffixes throw `TypeError`, without coercion. Adjacent equivalent RGB/bold styles share one SGR sequence. The two supported modes are `truecolor` and `none`; other mode values retain the existing color-output behavior.

`paint(line, 'none')` emits the text only and **does not inspect or validate styles**, preserving the existing plain-output contract. Both modes produce the same cells for valid styles; tests check that stripping the escapes from color output gives the plain output.

## Text and glyph contract

This is a deliberately bounded contract, not a general Unicode width engine.

- **Caller text** (labels, values, titles, units) must be a string. Its display form keeps printable ASCII (`U+0020`–`U+007E`). Every other code point—controls, `ESC`, C1 controls, combining marks, wide characters, emoji—is shown as one `?`. Source values are not modified. Non-strings throw `TypeError`.
- **Structural glyphs** come only from `GLYPHS`: light and heavy box drawing, block and half-block elements, eighth blocks, shades and quadrant patterns, squares, dots, a diamond, triangles, a square lozenge, a fork, and the multiplication sign. Each one has East Asian Width Narrow or Ambiguous.
- **Prerequisite:** the terminal must render Ambiguous-width glyphs in one cell. This is the usual setting for Western locales. If a terminal renders them two cells wide, frames and bars will misalign. There is no ASCII-glyph fallback yet.
- Multilingual and emoji text is **not supported**. It is replaced, not measured.

## Color

Color output requires 24-bit color. The showcase host uses it when Node reports a color depth of 24 (`COLORTERM=truecolor`, `FORCE_COLOR=3`). Otherwise it uses uncolored output; `NO_COLOR` also disables automatic color selection unless Node's `FORCE_COLOR` setting overrides it. Explicit `--color` forces truecolor. Live mode still uses cursor/screen controls without color; `--plain` selects an escape-free snapshot. 256-color and 16-color approximations are not implemented. Meaning never depends on color: every state also has a word or shape.

## IndustrialOS colors

[industrialos-colors.mjs](industrialos-colors.mjs) exports `INDUSTRIALOS_COLORS` and `shadeRamp(hex)`, separately from the unchanged Acid / Black default. They are a reference collection, not a theme switch, a complete spectrum, or contrast guidance.

`INDUSTRIALOS_COLORS` is an immutable array of 22 immutable records `{ id, name, hex, family, role }`:

- `id`: unique kebab-case identifier.
- `name`: short display name.
- `hex`: uppercase six-digit `#RRGGBB`.
- `family`: hue family used for grouping (`lime`, `red-orange`, `orange`, `magenta`, `violet`, `indigo`, `blue`, `mint`, `yellow`, or `neutral`). Record order is not a hue sort.
- `role`: a short description of intended use.

Derived ramps are a separate category: their generated steps are not members of the collection.

### Derived shade ramp

`shadeRamp(hex)` accepts only a primitive, exact `#RRGGBB` string (six case-insensitive hex digits; no spaces, shorthand, alpha or trailing newline). Invalid input throws `TypeError`. It returns a frozen five-record array; each record is frozen and has `{ id, label, kind, hex }`. All output hex values are uppercase. The base is the exact input RGB, case-canonicalized.

| Order / id | Label | `kind` | Channel math |
| --- | --- | --- | --- |
| `dark-75` | BLACK 75% | `derived` | `Math.round(c * 0.25)` |
| `dark-40` | BLACK 40% | `derived` | `Math.round(c * 0.6)` |
| `base` | BASE | `base` | `c` unchanged |
| `light-40` | WHITE 40% | `derived` | `Math.round(c * 0.6 + 255 * 0.4)` |
| `light-75` | WHITE 75% | `derived` | `Math.round(c * 0.25 + 255 * 0.75)` |

These are deterministic mixes of encoded 8-bit sRGB channels toward black/white, rounded to nearest integer (ties upward), **not** linear-light mixing or perceptually uniform shades. Mark the four generated entries DERIVED wherever they are shown. Black/white bases can produce repeated values; do not invent alternate values to force five distinct colors. The helper is pure: no clock, randomness, I/O, palette mutation or background work.

## Signal colors

[signal-colors.mjs](signal-colors.mjs) mirrors the product colors the Pi extensions use beside the nine Acid / Black roles: count tiers and mode inks, gauge zone tracks, the ghost grey of a lost segment, the checking fade, warm-up steps, and the usage providers' lit, used and burn-out colors. Status-bar's `C` palette in `pi/status-bar/src/footer.ts` is their authority, under [the same decision](../../docs/decisions/extension-colors-take-precedence.md) as the roles; agreement is a review comparison, not an import or test. They are literal `#rrggbb` values that `paint()` accepts directly, not new role names, and not part of Acid / Black.

`SIGNAL_COLORS` is a frozen object of lowercase `#rrggbb` strings. Each entry's comment names its `C` constant.

`mixOver(color, proportion)` returns `proportion` (0–1) of a role or `#RRGGBB` color over the black field: each 8-bit sRGB channel times `proportion`, rounded to nearest with ties up, as lowercase `#rrggbb`. Where status-bar declares a mix, the mirrored value is returned exactly, because the extension rounded some of its mixes differently (accent at 75% is `#90be03`, where ties up would give `#90bf03`). Out-of-range proportions throw `RangeError`; invalid colors throw `TypeError`. It is pure, like `shadeRamp`, and differs from it: `shadeRamp` derives a fixed five-step ramp toward black and white for the reference collection.

The IndustrialOS reference collection is separate data: its `Magenta` is `#FF15BE`, one step from status-bar's pink `#ff15bd`. The extension's value is the one elements use.

## Checks

`node --test foundation/*.test.mjs` covers the signal colors' format and `mixOver`'s rounding, range and mirrored values, sanitization, truncation, exact line widths, unchanged named-role SGR, literal RGB and invalid-style boundaries, color/plain equivalence for all 110 color/ramp swatches, the 22 color records (unique ids, uppercase hex, families) and their immutability, exact ramp centers and all 256 channel values. Full validation remains in [Contributing](../CONTRIBUTING.md).
