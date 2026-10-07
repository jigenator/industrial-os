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
