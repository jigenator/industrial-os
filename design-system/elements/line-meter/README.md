# Line meter

The compact context-used bar modeled on herdr-sidebar's layout B. A generic inline reading, not a collector or progress animation.

## Usage

```js
import { lineMeter } from './line-meter.mjs';
lineMeter({ percent: 67 });                  // ━━━━━━━━─── 67%
lineMeter({ percent: 95, tone: 'idle' });    // same reading, decorative ink
lineMeter({ percent: null });               // ─────────── --%
lineMeter({ percent: 67 }, { maxWidth: 8 }); // ━━━─ 67%
```

## Contract

`lineMeter(input, options)` returns inline spans, without padding.

| Input/option | Contract | Default |
| --- | --- | --- |
| `percent` | finite number from 0 to 100; null/undefined means unknown | unknown |
| `tone` | `zone` or `idle` | `zone` |
| `cells` | integer 1–1000, natural bar length | `11` |
| `zones` | finite percentage thresholds, `0 <= warn < high <= 100` | `{ warn: 70, high: 90 }` |
| `maxWidth` | non-negative integer or Infinity | Infinity |

Known readout: `used = min(99, floor(percent))`, two digits followed by `%`. **99% means 99 or more**, including 100. Fill: `ceil(used * barCells / 100)` lit `━` cells followed by unlit `─` cells. This whole-cell ceil intentionally differs from the default gauge's never-overstate floor, as the segment meter's does: the readout is authoritative, and a lit cell means some of its slice is used. Because used floors first, values below 1 render `00%` with no lit cells. There is no full-value special case: at 100, lit is `ceil(99 * barCells / 100)`. This fills the default 11-cell bar, but a custom 100-cell bar has 99 lit cells and one unlit cell.

## States

| State | Text/shape | Whole-meter ink |
| --- | --- | --- |
| OK, below warn | bar and known readout | accent, not bold |
| Warning, from warn inclusive | same shape rule | warning, not bold |
| Critical, from high inclusive | same shape rule | critical, bold |
| Idle tone, any known percent | identical text and shape to zone tone | decorative, not bold |
| Zero | empty bar plus `00%` | known tone |
| Full, 100 | `99%`; fully lit at default 11 cells, formula above at custom lengths | known tone |
| Unknown, either tone | unlit bar plus `--%`, never `00%` | imported `SIGNAL_COLORS.ghost`, not bold |

State ink uses role names so motions recognise warning/critical cells. Zone classification uses the original percent, not the floored readout. The numeric thresholds/readout convey the zone without color; there is no extra state word. This is display-only, with no interaction, clock, I/O or motion.

## Width behavior

Natural width is `cells + 4` (15 by default). Under `maxWidth`, shorten the bar first and recompute ceil fill for its new length; keep the whole ` NN%` suffix. At widths 3 or 4 show only `NN%` or `--%`. Below 3 show that many `#` cells in the reading's style, never partial digits. Width 0 returns `[]`. No width changes the supplied value.

[Foundation](../../foundation/README.md#text-and-glyph-contract) owns the one-cell curated glyph prerequisite and truecolor/plain contract. Plain and color output contain identical cells.

## Invalid input

Non-object input/options and non-number known percentages throw `TypeError`; non-finite or out-of-range numbers throw `RangeError`. Invalid tones, zones, cells or maxWidth throw `RangeError`. Values are never clamped, coerced or treated as zero.

## Differences from herdr-sidebar

The reference is [row 2 of its token contract](../../../pi/herdr-sidebar/docs/token-contract.md#row-2-always-all-three-present). Default known text, inclusive 70/90 thresholds, idle shape/ink and unknown ink match that bar. This renderer rejects invalid/out-of-range percentages rather than clamping them. It accepts explicit tone, thresholds and cell budgets instead of inferring activity or reading tokens. It emits ordinary spaces, not Herdr's U+2800 transport padding. There is no token reporting, access decay or host lifecycle.

## Checks

From `design-system/`: `node --test elements/line-meter/line-meter.test.mjs`, then `node --test`. No install or dependency is needed (Node 22 standard library); checks only render in memory. [line-meter.test.mjs](line-meter.test.mjs) covers exact sidebar readings, zero/unknown, idle override, inclusive boundaries, custom zones/cells, width fallback, widths 1–160, color/plain equivalence and rejected injection. Full validation: [Contributing](../../CONTRIBUTING.md#full-validation-sequence). Automated checks only; native Herdr checks not run.
