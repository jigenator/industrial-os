# Pixel numeral

The status-bar context numeral: a 3×5 pixel font packed into three terminal rows with square half-block pixels. A reference renderer, not a percentage calculation or a clock. The same font with hex letters also draws short unit codes, such as the droid header's unit number.

## Usage

```js
import { pixelNumeral, numeralGrid, numeralAt, numeralLines } from './pixel-numeral.mjs';
pixelNumeral({ value: 64 }, { width: 30 });
const target = numeralGrid(95), from = numeralGrid(64);
numeralLines(numeralAt(target, from, 0.6, 42), { width: 30 });
numeralLines(textGrid('C0DE'), { width: 15 });
```

```text
█▀▀ █ █   █▀█      █▀▀ █▀█ █▀▄ █▀▀
█▀█ ▀▀█   █ █      █   █ █ █ █ █▀▀
▀▀▀   ▀ ▀ ▀▀▀      ▀▀▀ ▀▀▀ ▀▀  ▀▀▀
```

| Input/API | Contract | Default |
| --- | --- | --- |
| `pixelNumeral({ value, tone }, { width })` | three lines of exactly `width`, integer 1–1000 | width required |
| `value` | finite number; null/undefined means unknown; negatives and values above 100 preserved | unknown |
| `tone` | `ok`, `warn`, `high`, `unknown`; unknown value only accepts unknown tone | above 70 warn, above 90 high, otherwise ok |
| `numeralGrid(value, { tone })` | `{ w, g }`: six pixel rows of colors/null, min 13 columns, one blank column between glyphs; exponent form returns `undefined` | one decimal |
| `numeralLines(grid, { width })` | packs upper/lower pixels to spans; width must fit entire grid | width required |
| `numeralAt(target, from, progress, seed)` | new grid with target shape/width; progress finite 0–1, seed integer; input grids never mutated | all explicit |
| `textGrid(text, { ink })` | `{ w, g }` for 1–250 `FONT` or `HEX_FONT` characters, exactly as wide as the glyphs (no 13-column minimum, no number formatting); for `numeralLines` and `numeralAt`. Other characters, including lowercase hex, throw `RangeError`; a non-string `TypeError`; an invalid ink `TypeError` | ink `primary` |
| `FONT`, `HEX_FONT`, `NUMERAL_TONES` | frozen digit/`.`/`-`/`?` font, frozen `A`–`F` hex letters, and tone ink table | exported references |

Grid validation requires `w` 1–1000, six rows each with exactly `w` entries, each a palette role/literal RGB or null. Invalid grids/text colors throw `TypeError`; invalid numbers, widths, tones, progress or seed throw `RangeError`.

## States and reconstruction

OK ink is primary white, WARN is the `warning` role, HIGH is `critical`, and unknown `?` is decorative. Exactly 70 remains OK and exactly 90 remains WARN. Unknown is never a zero numeral. The fifth pixel row occupies the upper half of the third text row; the sixth row is empty.

`numeralAt` uses the footer's 4×4 Bayer matrix plus foundation `hash` dither. Old-only pixels disappear immediately: **new shape only**. Current pixels shared in the same ink with `from` are already settled; other target pixels acquire the target ink from decorative grey (secondary grey when the target itself is decorative). Progress 1 is exactly the target, progress 0 retains all current pixel occupancy. No old digit is displayed. The host supplies progress, seed and grid memory; the helper contains no I/O, timer, clock or hidden state.

Hex letters are separate from `FONT`, whose keys stay the characters a formatted reading can contain, so `numeralGrid` and `pixelNumeral` are unchanged. `B` and `D` keep notched corners so they never read as `8` and `0`; every glyph shape in both fonts is distinct. `textGrid` has no fallback of its own: `numeralLines` rejects a grid wider than its width, and the host chooses what to show instead.

## Width behavior

Pixel width is at least 13; `100.0` widens to 17. `pixelNumeral` never crops pixel digits. If the complete grid does not fit, or a number formats to an exponent (for example `1e+21`), row one shows the exact small one-decimal formatted text instead. If that text cannot fit, it shows `#` across the row, with two blank rows below. Unknown at width 1 is `?`, never `#` or zero. `numeralLines` rejects an unfittable grid so hosts can explicitly choose the fallback before animating.

## Glyph/color assumptions

[Foundation](../../foundation/README.md) owns one-cell glyphs and truecolor/plain painting. Pixels use only `▀`, `▄`, `█` and spaces. Upper/lower differing inks use foreground/background on `▀`. State colors stay role names for motion protection. Font legibility and half-block proportions require native-terminal review; no universal terminal or accessibility claim is made.

## Differences from status-bar

status-bar now consumes `numeralGrid`, `numeralAt` and `numeralLines` through exported subpaths, translating roles to its Hue-valued motion memory and keeping Pi emission/ownership metadata. The FONT, half-block packing, default tones and reconstruction thresholds have one implementation here. The footer omits the numeral when an exponent or narrow layout prevents it; this standalone element returns a documented small-text fallback so its three-row contract stays useful. It does not include the footer spine, unit/USED/window captions, percentage calculation, boot scheduling, or motion lifecycle. Non-finite values throw rather than becoming unknown; callers explicitly supply unknown.

## Checks

[pixel-numeral.test.mjs](pixel-numeral.test.mjs): exact extension snapshots, hex text grids and their distinct shapes, tone thresholds, unknown/zero distinction, exponent/narrow fallback, grid validation, seeded reconstruction/new-shape-only/immutability, two-ink pixels, every width 1–160, glyph allowlist, plain/color equivalence and E2 source purity. From `design-system/`: `node --test elements/pixel-numeral/pixel-numeral.test.mjs`, then `node --test`. Automated evidence only; native Herdr checks not run.

## Compact integer

`integerNumeral(value, { ink = secondary })` uses the same FONT/packing without decimals or a minimum width. Nonnegative safe integers or null (a pixel ?) only. Returns three natural-width lines, four cells per digit minus the final gap. No cropped digits.

`INTEGER_FACES` exports instrument (FONT) and dashboard (v20's rounded 3×5 integer strokes). `integerNumeral` accepts face, default instrument; the type unit selects dashboard. The same pixel packing and validation serve both; context numerals are unchanged.
