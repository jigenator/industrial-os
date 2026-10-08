# Gauge

A horizontal, calibrated reading of one value from 0 to `max`, with a strong numeric readout.

## Usage

```js
import { gauge, gaugeScale } from './gauge.mjs';
gauge({ label: 'KNOWN', value: 64 }, { width: 50 });
gauge({ label: 'FLOW', value: null }, { width: 50 });
gaugeScale({}, { width: 50 });
```

```text
KNOWN    █████████████████████░░░░░░░░░░░░  64.0 %
FLOW     ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱ UNKNOWN
         0       ╵       50      ╵     100
```

| Input | Contract | Default |
| --- | --- | --- |
| `value` | `null` or `undefined` for unknown; otherwise a finite number in `[0, max]` | required |
| `max` | finite number greater than 0 | `100` |
| `unit` | string, up to 4 cells shown | `%` |
| `decimals` | readout decimals, 0–3 | `1` |
| `label` | string | `''` |

Layout options: `width` (1–1000), `labelWidth` (default 8), and `readoutWidth`. Use `readoutWidth` to give gauges with different ranges a shared readout column. Returns one or two lines, each exactly `width` cells.

## States

| State | Bar | Readout |
| --- | --- | --- |
| Known | Accent fill on a dark `░` track | value and unit, white bold |
| Zero | Empty track only | `0.0 %` |
| Full | Fill across every cell; only when `value === max` | `100.0 %` |
| Unknown | Hatched `╱` track, never an empty one | `UNKNOWN` |

## Truthfulness rules

- Fill is floored to 1/8 of a cell. The readout is truncated, never rounded up: 99.96 shows `99.9`, and the bar is not full.
- Values outside the range, `NaN`, infinities, and non-numbers throw `RangeError`. They are not clamped, and they never become zero.
- If the readout cannot fit, it is shown as `#` rather than a partial number.
- Scale marks sit at the nearest cell center, within half a cell. They are calibration aids; the readout is authoritative.
- If the bar would get fewer than 8 cells, the gauge stacks: label and readout above a full-width bar. The bar is capped at 48 cells.

## Checks

[gauge.test.mjs](gauge.test.mjs): exact fills, state distinction, no overstatement, invalid readings, stacking, `#` overflow, scale alignment, every width from 1 to 160, and injection.

## Opt-in context semantics

```js
const input = { label: 'CONTEXT', value: 80 };
const options = { width: 80, zones: { warn: 70, high: 90 } };
gauge(input, options);
gaugeScale(input, { ...options, tickFree: true });
```

| Option/export | Contract | Default |
| --- | --- | --- |
| `zones` | `{ warn, high }`, finite percentage thresholds `0 <= warn < high <= 100` | absent, original rendering |
| `gaugeScale`'s `tickFree` | boolean; label-only scale with endpoint, zone and midpoint collision priority, then deciles | `false`, original comb |
| `READOUT_CHIP` | frozen `ok`, `warn`, `high`, `unknown` style table | exported reference |

With `zones`, percentage is `value / max * 100`. Exactly `warn` remains OK and exactly `high` remains warning. Fill ink is accent / warning / critical; unknown remains a decorative hatched track. The unused track cells in the warning/high regions have the `SIGNAL_COLORS.warningZone` / `criticalZone` background, starting at the floored threshold cell as in the footer. Known fill still floors to an eighth cell. A readout chip is bold black on primary white (OK), warning (WARN), critical (HIGH), or bold primary on structural (unknown). WARN/HIGH append `▲ WARN` / `▲ HIGH`; unknown reads `?` with `? UNKNOWN`. These cues survive plain output.

`tickFree` places as many of `0 10 … 70 … 90 100` as fit, with `0`, `100`, warning threshold, high threshold, then midpoint taking priority. Labels reflect `max`; 70/90 (or custom thresholds) use warning/critical roles, bold. There are no tick glyphs. As in the footer, endpoint text may use up to three cells after the bar. **Supply the same input value and options to gauge and scale when using zones**, because the tag reserves width. `gaugeScale({}, options)` describes an unknown gauge, not a known gauge's geometry.

The original 48-cell bar cap, exact widths and stacking remain. When the combined chip/tag cannot fit, the chip takes its own head row, the bar follows, then the tag on its own row. A too-wide number remains `#`; a 1-cell unknown head is `?`, with a `╱` track. State words may be clipped at extremely narrow widths, but the first shape persists. `labelWidth` / `readoutWidth` must now be integers 0–1000. Invalid thresholds throw `RangeError`; nonboolean `tickFree` throws `TypeError`.

## Glyph/color assumptions

[Foundation](../../foundation/README.md) owns the curated one-cell glyph and truecolor contracts. State ink uses role names so motions can recognise it. This element has no clock or motion; a host owns any decoration.

## Host-composed gauge pieces

These additive functions do not change `gauge`, `gaugeReading` or `gaugeScale`:

- `gaugeTick(percent, cells)` floors the threshold position with `1e-9` tolerance, bounded to the track; `gaugeExtent(percent, cells)` clamps only the ceil whole-cell graphical extent with the same tolerance. Percentages must be finite; cells are 1–1000.
- `gaugeZone(column, cells, zones = { warn: 70, high: 90 })` returns the position's `ok/warn/high` region. Columns must be inside the track.
- `gaugeTrack({ percent, readout? }, { cells, fill = 'eighth-floor', fillInk = 'reading', trackGlyph = '░', marks = false, filledBackground = 'track', zones = { warn: 70, high: 90 } })` returns one span per cell. Unknown is null/undefined. Finite out-of-range percentages retain their reading tone; only extent clamps. Optional ASCII-safe readout overlays from column 0 with one pad each side, black on fill/white on track, bold; it must fit. `fill: 'cell-ceil'`, `fillInk: 'zone'`, `trackGlyph: ' '`, `marks: true` (unfilled `┃` threshold marks) and `filledBackground: 'ink'` express the exact footer track. These whole-cell semantics intentionally differ from the default gauge's no-overstatement rule.
- `gaugeParts(readout, tone, { pad = true })` returns `{ readout, tag }` spans with chip/state styles and optional pads; unknown tag is secondary, not decorative. Invalid tones throw `RangeError` and flags throw `TypeError`.
- `gaugeScaleParts({ cells, max = 100, zones = { warn: 70, high: 90 } }, { width, decilesMinCells = 0 })` returns unpadded `{ percent, start, spans }` labels. Endpoints, warning/high and midpoint have collision priority with one-cell clearance; remaining deciles appear only at the supplied minimum cell count. Labels may use three cells beyond the track. Dimensions/ranges/thresholds are validated.

status-bar consumes these pieces with whole-cell/position-ink options and decile minimum 50. Context budget math, Unicode/ANSI emission, boot underline/texture, glitches, admission and numeral anchors remain in the host. Defaults of the established renderers stay byte-identical.
## Differences from status-bar

- The reference gauge **floors to 1/8 cell and never overstates**. status-bar lights a whole cell whenever any of its slice is used. The established `gauge` opt-in does not adopt that rounding; `gaugeTrack` explicitly can.
- The established DS gauge retains an external value/unit chip, its range validation (no clamping) and 48-cell cap. The footer uses tokens/budget inside the track and clamps only graphical extent. This is an extension of the existing gauge, not a replacement footer layout.
- Fill takes the reading's tone; track backgrounds are zoned. No boot, glitches, flashes, I/O, host settings or timers are included.
- The established tick-free scale retains all deciles that fit; host-composed `gaugeScaleParts` can suppress them below a supplied cell count. Defaults, including the original scale, remain byte-identical.

Additional checks in [gauge.test.mjs](gauge.test.mjs): exact thresholds/chip styles/tick-free snapshot, zone track tints, no ceil fill, opt-in widths 1–160, all states, invalid options and color/plain equivalence. Run `node --test elements/gauge/gauge.test.mjs` from `design-system/`; full suite: `node --test`. Automated renderer evidence only, not native Herdr visual acceptance.
