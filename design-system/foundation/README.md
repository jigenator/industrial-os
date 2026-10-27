# Foundation: cells and palette

The small seam every element shares. [palette.mjs](palette.mjs) is the source of the Acid / Black values, as [design](../../docs/design.md#acid--black) and [the decision](../../docs/decisions/in-repo-design-system-package.md) record; the Pi extensions consume them through exported package subpaths and host adapters. [cells.mjs](cells.mjs) defines the line model, the text and glyph contract, and painting. Element behavior does not belong here.

## Line model

A rendered line is an array of spans `{ text, style }`. `style` is `{ fg, bg, bold, italic?, underline? }`: each color is an Acid / Black role, a literal `#RRGGBB` string, or the reserved value `'default'`. Omitted or `undefined` colors default to secondary text on the black field; bold defaults to false. Renderers finish each line with `fitLine(line, width)`, so it is exactly `width` cells: clipped or padded, never wider.

An explicit `'default'` foreground or background preserves that terminal channel (transparent background); it is not the black field, and is not the same as omission. Foreground and background defaults are independent unknown host colors, so no RGB or contrast is inferred from them. Existing omitted-channel behavior is unchanged.

Low-level `span()` and `fitLine()` store styles without validation. They and `paint()` consume already-conforming text; they do not sanitize arbitrary spans. Use `safeText()` when constructing spans from external text. Caller-rendered panel bodies must follow this same contract.

`isTerminalDefault(value)` returns true only for the primitive string `'default'`.

`resolveStyle(style = {})` returns `{ fg, bg, bold, italic?, underline? }` (italic/underline are retained only when supplied) with roles resolved to `#RRGGBB`, explicit defaults retained as `'default'`, and omitted fields normalized to secondary/field/false. This pure helper is for host adapters: translate the sentinel to the host's default-channel mechanism, and let the host convert RGB to its terminal color mode. It validates concrete colors without host imports or I/O.

`resolveColor(value)` returns the `#RRGGBB` of a role name or an exact `#RRGGBB` string and throws `TypeError` otherwise, **including for `'default'`**, whose RGB is unknown; motions that compute colors (such as mixes) use it to read a role's value. Numeric color operations must reject terminal defaults rather than guess RGB.

`paint(line, 'truecolor')` validates foreground/background and emits 24-bit SGR codes plus a final reset (including for an empty line). Explicit defaults emit SGR `39` (foreground) and `49` (background). Concrete channels accept only own role names from `ACID_BLACK` or primitive strings of exactly seven characters: `#` plus six hexadecimal digits, case-insensitive. Unknown/prototype names, nonstrings, shorthand, alpha, whitespace and control suffixes throw `TypeError`, without coercion. Adjacent equivalent RGB/bold styles share one SGR sequence. The two supported modes are `truecolor` and `none`; other mode values retain the existing color-output behavior.

`paint(line, 'none')` emits the text only and **does not inspect or validate styles**, preserving the existing plain-output contract. Both modes produce the same cells for valid styles; tests check that stripping the escapes from color output gives the plain output.

## Text and glyph contract

This is a deliberately bounded contract, not a general Unicode width engine.

- **Caller text** (labels, values, titles, units) must be a string. Its display form keeps printable ASCII (`U+0020`–`U+007E`). Every other code point—controls, `ESC`, C1 controls, combining marks, wide characters, emoji—is shown as one `?`. Source values are not modified. Non-strings throw `TypeError`.
- **Structural glyphs** come only from `GLYPHS`: light and heavy box drawing, block and half-block elements, eighth blocks, shades and quadrant patterns, squares (including hollow `□` and half-filled `◩`), dots, diamonds, triangles, a square lozenge, a fork, chevrons, the multiplication sign, a low bar `▁`, the pointer `▶`, the arrows `↑` `↓`, the en and em dashes `–` `—` (the automations monitor's glyph set) and braille patterns. They have East Asian Width Narrow, Ambiguous or Neutral; the host must render every curated glyph as one cell, including Neutral braille and `›`.
- **Prerequisite:** the terminal must render Ambiguous-width glyphs in one cell. This is the usual setting for Western locales. If a terminal renders them two cells wide, frames and bars will misalign. There is no ASCII-glyph fallback yet.
- Without a measurer multilingual and emoji text is replaced, not measured. The opt-in contract below preserves it.

## Measured text slots

No Unicode width engine or host import is added. Supply `measure(text) -> cells` (Lunalee uses pi-tui `visibleWidth`) to opt in; it must measure plain text, with structural glyphs and spaces one cell wide. Every returned width must be a finite nonnegative safe integer. Text remains structured spans, **never ANSI**.

```js
const title = textSlot([
  span('日本語', { italic: true, bg: 'default' }),
  span(' 👩‍💻', { underline: true, bg: 'default' }),
], measure('日本語 👩‍💻'), { measure });
labelPlate(title, { form: 'slab', maxWidth: 20, measure });
```

- A slot is `{ spans, width }`: `textSlot(spans, width, { measure })` checks its supplied width against the measured concatenation and sum of spans, validates styles and copies the input. Elements revalidate supplied slot objects, so forging the shape does not bypass the boundary. Slots require a measurer; strings without one retain the historical ASCII sanitising.
- Controls (including ESC/C1/newline/tab), bidi controls and line/paragraph separators are rejected with `TypeError`, not passed through as trusted text. Wide, combining, emoji and ZWJ graphemes remain literal, never `?`. Span boundaries inside a grapheme are rejected (`RangeError`); the host must keep each cluster in one span. Measured strings and slots starting with an Extend code point (including combining marks/emoji modifiers) or ZWJ are also rejected with `RangeError`, before they can attach to element padding or gaps.
- `cells(text, { measure })`, `lineWidth(line, { measure })`, `fit(text, n, { measure })` and `fitLine(line, n, padStyle, { measure })` opt in individually. `fitLine` clips complete `Intl.Segmenter` graphemes and pads spaces to exactly n cells. It does not split a wide character into a one-cell fragment.
- `fitText(stringOrSlot, n, { measure, style })` returns spans no wider than n; it preserves rich slot styles and applies `style` to a string. An overflow uses a whole-grapheme prefix and `…` when it fits (at n=1 a fitting first grapheme is kept, unless `ellipsis: 'always'`, which shows `…` alone so a one-cell cut still reads as cut; the automations monitor relies on this). Budgets are 0–1000 or Infinity; wrong text/measurer types throw `TypeError`, invalid widths/mismatches throw `RangeError`. No input is mutated.
- `italic` and `underline` are optional boolean styles, preserved by `resolveStyle` when present and emitted as SGR 3/4 by `paint`. Existing omitted-style output stays byte-identical. Measured label-plate caps and new word/lamp chrome explicitly use `bg: 'default'` for transparent channels; this **does not** change historical `paint`/`resolveStyle` omission, which remains black field. Slot channel overrides remain explicit.
- This is not blanket Unicode support for every element or motion. Measured label plates, word chips and survey chrome opt in individually. Reveal, feed-scan and corner-snap explicitly admit a measurer; other old motions still walk code points, so animate isolated narrow structural pieces, never opaque rich body slots. See each element/motion contract.

The curated survey glyphs include `╴╶┄├└┬┤┴┸▤▣▸▾▼◇›` and the braille block (U+2800–U+28FF); the heavy junctions `┣┫┻` join a heavy frame to a divider or a tick, as in the Pi droid header. Their one-cell rulers are tested algorithmically; actual terminal/font width verification remains a native-host check.

## Surface

[surface.mjs](surface.mjs) is a pure, I/O-free **cell compositor**, not a span renderer or ANSI parser. [surface-palette.mjs](surface-palette.mjs) exports the frozen `SURFACE_PALETTE`, the canonical survey colors including neutral plate `#a8a8a8`, code cyan and the operation dot-leader grey, the four minor-dot inks and the major-dot ink. These do not change Acid / Black roles. Lunalee owns role selection and alpha configuration; the story's locked strength-1.5 values are a synthetic fixture, not defaults in the compositor.

- `surfaceAt(x, y, { width, height, gradient? })` returns the gradient RGB: `l = max(0, round(top - drop*y/(height-1) - edge*u²))`, `u = 2*x/(width-1)-1`, RGB `(l,l+1,l+3)`. `SURFACE_GRADIENT` is the default `{top:19, drop:10, edge:3}`; `gradient` overrides any of its numbers (`top` 0–252, `drop`/`edge` nonnegative, otherwise `RangeError`/`TypeError`). `composeSurface` takes the same `gradient` option. Height 1 samples the top; width 1 samples the center. Coordinates are nonnegative safe integers inside a 1–1000 by 1–1000 surface. Invalid dimensions/coordinates throw `RangeError`.
- `dotAt(x, y)` returns an ink or null. The lattice starts at `(2,1)`, steps `(4,2)`, and every fifth intersection on **both** axes is major. Minor ink uses the stable unsigned coordinate hash; neither scroll position, time nor viewport size enters it.
- `blendFill(fill, under, alpha)` mixes encoded 8-bit RGB with `round(fill*alpha + under*(1-alpha))`. Alpha must be a number in 0–1; nonnumbers throw `TypeError`, invalid ranges `RangeError`. Unknown terminal-default RGB is never guessed.
- `composeSurface(rows, { width, height, origin = {x:0,y:0}, fills = {}, exclude = [], color = true })` returns fresh cells of the **same geometry**. Width/height are the full pane/popup gradient size; rows are a nonempty rectangle starting at absolute origin and must fit within that size. **Hosts must compose full viewport rows**: clearance sees only supplied cells, so horizontal crops cannot account for text just outside their edges. Whole-row vertical slices are safe because clearance is row-local. Each cell is `{ text, style?, continuation? }`. A leading cell holds exactly one safe grapheme; a two-cell grapheme has one following `{text:'', continuation:true}`. Extra host cell properties pass through unchanged at runtime and in the generic declaration. The host supplies correct widths; this module does not guess whether Unicode is wide. Continuations cannot start a row or chain.
- Omitted/`'default'` background gets the gradient. `fills` maps a concrete background role/RGB to `{ alpha, solid? }`; a solid entry forces alpha 1. An unconfigured explicit background stays opaque, including solid black and white locks. Background matching resolves roles and case-normalises RGB; two keys resolving to the same color throw `RangeError` instead of silently overriding alpha. Text ink is unchanged.
- Only a blank noncontinuation cell can receive a dot. Every occupied cell (including wide continuations and genuine authored `·` separators) clears ±2 cells **in the same row**. A configured translucent fill gets both blended background and dot ink (`fill*alpha + dot*(1-alpha)`); alpha 1 never receives dots. Clearance and cell work are linear in crop cells; exclusion rasterisation visits their intersections with the crop. No retained transcript is scanned.
- `exclude` contains absolute `{x,y,width,height,mode?}` rectangles. `mode:'floor'` (default) suppresses dots only, for image reservations whose transparent pixels still need background. `mode:'all'` preserves original cells/styles, for host selection/cursor/search/native image tokens. The host must cover both cells of any wide glyph and keep ANSI/OSC8/Kitty payloads out of cell text/style fields; extra metadata is opaque to the compositor.
- `color:false` is plain/NO_COLOR: no colors or floor dots are generated, and input foreground/background channels are removed while noncolor attributes and semantic text remain. No environment variable is read; the host decides this flag. Input must be the semantic cells, not previously decorated cells. Copy/search must likewise use the host's separate semantic representation, never guess floor dots by glyph or ink.

The surface story covers clear, translucent fills, solid roles and NO_COLOR using real public functions and synthetic fixtures. It is not proof of a host ANSI adapter, copy/selection isolation, Kitty alpha, contrast or native appearance. Those are separate Lunalee integration checks.

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

[signal-colors.mjs](signal-colors.mjs) is the source of the product colors the Pi extensions use beside the nine Acid / Black roles: count tiers and mode inks, gauge zone tracks, the ghost grey of a lost segment, the checking fade, warm-up steps, and the usage providers' lit, used and burn-out colors. Status-bar's `COLORS` alias map in `pi/status-bar/src/footer.ts` imports these tokens under [the same decision](../../docs/decisions/in-repo-design-system-package.md) as the roles; `C` converts them with Pi's `rgbColor`. They are literal `#rrggbb` values that `paint()` accepts directly, not new role names, and not part of Acid / Black.

`SIGNAL_COLORS` is a frozen object of lowercase `#rrggbb` strings. Each entry's comment names its `C` constant.

`mixOver(color, proportion)` returns `proportion` (0–1) of a role or `#RRGGBB` color over the black field: each 8-bit sRGB channel times `proportion`, rounded to nearest with ties up, as lowercase `#rrggbb`. Where status-bar declares a mix, the declared signal color is returned exactly, matching status-bar's current computed value, because the extension rounded some of its mixes differently (accent at 75% is `#90be03`, where ties up would give `#90bf03`). Out-of-range proportions throw `RangeError`; invalid colors, including `'default'` (unknown RGB), throw `TypeError`. It is pure, like `shadeRamp`, and differs from it: `shadeRamp` derives a fixed five-step ramp toward black and white for the reference collection.

The IndustrialOS reference collection is separate data. Where one of its colors is also a signal color, it has the same value: its `Magenta` is `#FF15BD`, the signal colors' `pink`.

### Herdr chrome colors

Signal colors now also serve Herdr chrome. `HERDR_CHROME`, exported from the same module, is a frozen object of the two product colors [herdr/theme.toml](../../herdr/theme.toml) restates that are neither roles nor status-bar colors: `signalOrange` `#ff5c00`, the Marathon signal orange (Herdr's `overlay1`), and `signalOrange30` `#4d1c00`, `mixOver(signalOrange, 0.3)`, 30% of it over the field (Herdr's `surface1`). The other Herdr theme values are roles or `SIGNAL_COLORS.ghost`. They are not part of Acid / Black and status-bar does not mirror or import them. `signalOrange` has the same value as `SIGNAL_COLORS.cld` and the IndustrialOS collection's `Signal orange`, in a separate role: a Herdr chrome color, not the Claude provider's ink. They are kept out of `SIGNAL_COLORS` because status-bar maps every value there to a footer alias (`pi/status-bar/test/footer-colors.test.ts`); these colors have a different consumer, so they get their own object rather than an unused status-bar alias. The SIGNAL COLORS story shows `SIGNAL_COLORS` only.

### Board inks and tones

`BOARD_INKS`, exported from the same module, is a frozen object of white mixed over the field for the automations monitor's board, each the exact `mixOver('primary', p)` value: `selection` `#1a1a1a` (10%), `faint` `#242424` (14%, rules and dots), `chip` `#292929` (16%, quiet chip fills), `base` `#333333` (20%, history bars, the same value as `SIGNAL_COLORS.ghost`) and `hatch` `#3d3d3d` (24%, a quiet track).

[board-tones.mjs](board-tones.mjs) maps the board's six states to colors. `BOARD_TONES[tone]` (or `boardTone(tone)`, which throws `RangeError` for an unknown or inherited name) gives `ink` (text), `cell` (a one-cell state color) and `chip` (`{ fg, bg }`):

| Tone | Ink | Cell | Chip |
| --- | --- | --- | --- |
| `live` | primary | accent | field on accent |
| `crit` | critical | critical | primary on critical |
| `warn` | warning | warning | field on warning |
| `idle` | decorative | structural | secondary on `BOARD_INKS.chip` |
| `off` | decorative | `BOARD_INKS.faint` | primary on structural |
| `ok` | secondary | structural | secondary on `BOARD_INKS.chip` |

State colors are role names so motions recognise warning and critical cells. `CATEGORY_TONES` is seven [IndustrialOS](#industrialos-colors) fills for categories such as pipelines, in this order, each with the ink that reads on it: pale-blue, magenta, mint, lavender and yellow with the field, steel-blue and violet with primary.

### Pi chrome colors

`PI_CHROME`, exported from the same module, is a frozen object of the product colors [the Pi theme](../../pi/theme/industrial-os.json) and the Pi extensions use that are neither roles nor status-bar colors: `bone` `#e2dccb`, a warm off-white for the editor border at every thinking level, and `lamp` `#ff5c00`, the Pi droid header's signal lamp. `bone` is a Marathon-inspired value chosen for this theme, not a published Marathon brand color. `lamp` has the same value as `HERDR_CHROME.signalOrange` and `SIGNAL_COLORS.cld`, in a separate role, and a different name because no `PI_CHROME` name may shadow another object's. The theme's other values are roles or signal colors. Like `HERDR_CHROME`, they are not part of Acid / Black and are kept out of `SIGNAL_COLORS`, which status-bar maps to footer aliases. No storybook story shows them.

## Seeded randomness

[seeded.mjs](seeded.mjs) gives decorations that vary a repeatable source of chance: `random(seed)` returns a generator of numbers in [0, 1) (mulberry32, ported from status-bar's footer), `hash(a, b, c)` a stateless number in [0, 1) for three integers, and `between`, `pick`, `shuffle`, and `seedFrom` draw from a generator. The same seed always gives the same plan. A non-integer seed throws `RangeError`; status-bar preserves its previous seed coercion by passing `seed | 0` before this boundary, and keeps the original draw order/cursor memory. Nothing here reads a clock or calls `Math.random`.

## TypeScript hosts

Status-bar's consumed element, token, seeded and motion subpaths also have declarations, checked by its compile-only public-contract specimen using the existing claude-interrupt TypeScript compiler (no new toolchain dependency). Typed modules ship a colocated `.d.mts` (for example `cells.d.mts` beside `cells.mjs`); NodeNext consumers find it through the existing exported `.mjs` subpath without exports-map conditions or emitted code. Extend this pattern as modules gain TypeScript consumers, and keep declarations aligned with their runtime contracts. `Color` includes roles, `#${string}` and `'default'`; exact hex validity is still checked at runtime. `ResolvedColor` is RGB or the explicit default sentinel, while `resolveColor` returns RGB only. `Style`, `Span` and `Line` describe the shared line model. Strict compile-only positive/negative checks live in each consuming extension's `test/design-system-types.ts`.

## Checks

`node --test foundation/*.test.mjs` covers seeded determinism and bounds, the signal colors' format and `mixOver`'s rounding, range and declared mixes, the Herdr chrome colors' format and 30% mix, the Pi chrome colors' format and names, sanitization, truncation, exact line widths, unchanged named-role SGR, literal RGB and invalid-style boundaries, color/plain equivalence for all 110 color/ramp swatches, the 22 color records (unique ids, uppercase hex, families) and their immutability, exact ramp centers and all 256 channel values. Full validation remains in [Contributing](../CONTRIBUTING.md).

## Dashboard foundation

`type-colors.mjs` exports TYPE_COLORS and typeColor(token): type.pr violet, type.todo the dashboard bone, type.linear indigo, type.msg teal, type.email sand. Missing/unknown/prototype tokens fall back to bone, never arbitrary RGB. These identify sources, not state. `cell-grid.mjs` exports CellGrid: bounded width/height 1–1000, approved one-cell put(), ASCII-sanitized text(), span-preserving place(), and copied lines(). It owns no I/O. `new CellGrid(width, height, { measure })` opts in to [measured text](#measured-text-slots): `text()` then shows real Unicode through `fitText` (whole graphemes, `…` on overflow) and returns the cells written, `place()` validates lines as slots, and a wide grapheme fills its cell plus `{ text: '' }` continuation cells, as in surface. Overwriting either half blanks the whole grapheme; one that would cross the grid edge becomes spaces. Unsafe text still throws: the host sanitizes untrusted text first. Structural glyphs now also include dotted rules, week blocks, empty squares/diamonds, enter and the 256 braille cells (U+2800–U+28FF); the one-cell terminal prerequisite still applies.

`dashboard-colors.mjs` exports DASHBOARD_INKS: the survey palette's bone and rule (edge), checkMid (muted), ghost (rule), and a DERIVED 74% bone dim. These are aliases/derivations, not new near-duplicate hues.

## Ambient geometry and glyph projection

`ambient.mjs` owns AMBIENT_GRID's fixed pitch/offset/ink/timing constants, the immutable AMBIENT_MARKS, ambientPosition(x,y), ambientInk(background, proportion), ambientSweepLift(row,height,time,period,run), and ambientRegistrations(lines). Static ambient-field and pure ambient motions consume the same geometry. Coordinates are integers, dimensions 1–1000, sweep time nonnegative finite and period/run positive with run ≤ period; invalid values throw. Inks resolve known palette/RGB backgrounds, never guessed terminal defaults. The registration detector reads already-conforming foundation lines.

`decode-glyph.mjs` exports decodeGlyph(char,column,seed,time,duration,clock=time), the one seeded scramble/land rule shared by decode and ambient-load. The glyph must be one approved cell, column nonnegative integer, seed integer, time/clock finite and duration 1–600 ms. Negative time is a blank prelude; completed time returns true text. The wrapper motion owns warning/critical protection and the declared semantic-text exception. No clocks or timers are read.
