# Count plate

A fixed-width plate that shows one exact count: status-bar's **CMP** compaction plate and its **AU** (Active Units) badge, from one small API. The count is the reading; the plate's tier color is emphasis. It is not a button and not a gauge.

## Usage

```js
import { COUNT_PLATES, countPlate } from './count-plate.mjs';
countPlate(4, COUNT_PLATES.compactions);              //  CMP×04   (black on pink)
countPlate(100, COUNT_PLATES.compactions);            //  CMP×99+
countPlate(null, COUNT_PLATES.compactions);           //  CMP×??   (white on grey)
countPlate(3, COUNT_PLATES.units);                    //  03 AU    (black on white)
countPlate(null, COUNT_PLATES.units);                 //   ? AU
countPlate(120, COUNT_PLATES.units);                  //  120 AU
countPlate(7, COUNT_PLATES.compactions, { maxWidth: 6 }); // CMP×07
```

`countPlate(count, spec = COUNT_PLATES.compactions, { maxWidth })` returns one filled span (or none at `maxWidth: 0`) for the caller to place inside a line.

| Input | Contract | Default |
| --- | --- | --- |
| `count` | non-negative safe integer, or `null`/`undefined` for unknown | required |
| `spec` | a preset from `COUNT_PLATES` or an object with the fields below | `COUNT_PLATES.compactions` |
| `maxWidth` | non-negative integer cells | unbounded |

### Spec

| Field | Contract | `compactions` | `units` |
| --- | --- | --- | --- |
| `label` | caller text (shown through `safeText`) | `CMP` | `AU` |
| `side` | `'before'` or `'after'` the digits | `before` | `after` |
| `joiner` | a space or one curated glyph | `×` | space |
| `cap` | positive integer, or `null` for exact values | `99` | `null` |
| `unknown` | `'?'` or `'??'`, right-aligned in the two-digit field | `??` | `?` |
| `unknownStyle` | style for unknown | white on structural | white on structural |
| `tiers` | ascending `{ upTo, style }`; the last has `upTo: Infinity` | see below | see below |

## States

| Count | `compactions` | Style | `units` | Style |
| --- | --- | --- | --- | --- |
| Unknown | ` CMP×?? ` | primary on structural, bold | `  ? AU ` | primary on structural, bold |
| 0 | ` CMP×00 ` | primary on structural, bold | ` 00 AU ` | secondary on surface, not bold |
| 1–2 | ` CMP×01 ` | primary on violet `#5200ff`, bold | ` 01 AU ` | field on primary, bold |
| 3–4 | ` CMP×03 ` | field on pink `#ff15bd`, bold | ` 03 AU ` | field on primary, bold |
| 5–99 | ` CMP×05 ` | field on `critical`, bold | ` 12 AU ` | field on primary, bold |
| 100+ | ` CMP×99+` | field on `critical`, bold | ` 100 AU ` | field on primary, bold |

Known counts are zero-padded to two digits. Unknown keeps its `?` mark and is never zero-shaped. Violet and pink are status-bar's count colors from [`SIGNAL_COLORS`](../../foundation/README.md#signal-colors); the 5+ tier uses the `critical` role name so motions recognise it as a state cell. Every tier carries the count in digits, so meaning never depends on color.

## Width behavior

- Natural width: the label, joiner and digits plus one pad cell on each side. `compactions` is always 8 cells. `units` is 7 cells for 0–99 and unknown, and widens with the exact value from 100 (` 123456 AU `).
- Above `cap`, the digits read `${cap}+`. With the label before the digits, the `+` takes the trailing pad cell, so the plate keeps its width (` CMP×99+`); with the label after, the plate widens by one.
- Below the natural width, the pads go first (`CMP×07`, `03 AU`). Below that the plate shows `#` cells in its style, never partial digits or a truncated label. One cell shows `#`.

## Invalid input

Negative, fractional, non-finite or unsafe numbers throw `RangeError`; non-number counts throw `TypeError`. An invalid spec field throws `RangeError` (or `TypeError` for a non-object or non-string label). An invalid `maxWidth` throws `RangeError`. Nothing is clamped to zero or turned into unknown.

## Differences from status-bar

- status-bar's `knownCount` treats invalid counts (negative, fractional, `NaN`, strings) as unknown (` CMP×?? `). Here they throw: the element's caller validates data, and silent coercion would hide a caller bug.
- status-bar never narrows these plates: its minimal layout wraps them. The `maxWidth` pad-dropping and `#` fallback are this element's own narrow behavior.
- The CMP boot polarity swap and AU re-strikes are status-bar motion, not part of the element.

## Checks

[count-plate.test.mjs](count-plate.test.mjs): exact CMP and AU text and styles against status-bar's `cmpPlate`, `cmpStyle`, `unitBadge` and badge style, unknown distinct from zero, narrow budgets 0–12 for every state, a custom spec, plain/color equivalence, and invalid counts and specs.
