# Readout

The board's readings, modeled on the automations monitor: a numbered block with a tall numeral, the same readings as one line for small panes, and the strips that sit under a numeral. Supplied values only; nothing is computed or inferred.

## Usage

```js
import { phaseSteps, readoutBlock, readoutLine, slotStrip, splitBar } from './readout.mjs';
readoutBlock({ number: 1, label: 'ACTIVE RUNS', value: '02', ink: 'primary',
  unit: [{ text: '/', ink: 'decorative' }, { text: '5', ink: 'secondary' }, { text: 'SLOTS', ink: 'decorative' }],
  strip: slotStrip({ busy: ['#95b8d1', '#ff15bd'], slots: 5 }) }, { width: 27 });
readoutLine([[{ text: 'ACTIVE', ink: 'decorative' }, { text: '02/5', ink: 'primary' }]], { width: 40 });
```

## Contract

`readoutBlock({ number, label, value, ink, unit = [], sub = null, strip = null }, { width, measure, ellipsis })` returns eight lines of exactly `width` cells:

1. the two-digit decorative `number`, a space and the bold primary `label`, cut to `width − 3`;
2. a rule: three heavy primary cells, then a `BOARD_INKS.faint` hairline;
3. to 7. `value` in the [pixel numeral](../pixel-numeral/README.md)'s tall face, in `ink`. On the last numeral row the `unit` parts follow two cells after the numeral, a cell apart, each cut to the space left; a part is bold unless its ink is decorative. A value wider than the block falls back to its exact text on the first numeral row;
8. the caller's `strip` line, otherwise the `sub` part in its ink, otherwise blank.

An unknown value is a structural `?`, never zero; the caller supplies it.

`readoutLine(readouts, { width, measure, ellipsis })` returns one exact-width line: each readout's parts a cell apart, readouts separated by a structural `·` with two cells either side, each part cut to the space left.

`slotStrip({ busy, slots = null, reporting = true }, { maxWidth })` is inline: one `█` per busy slot in its supplied color (a decorative `▒` while the source is not reporting), then the free slots as a structural `▁` floor, no wider than `maxWidth`.

`splitBar({ ok, warn, fail }, { width })` divides `width` upper half blocks by rounded share: ok in primary, warnings in warning, failures in critical. With nothing counted, the bar is faint.

`phaseSteps({ steps, current, ink, lit = true }, { width, measure })` returns three lines of equal steps a cell apart, each `floor((width − (n − 1)) / n)` wide: a lower-half bar (done steps in `ink`, the current one in `ink` only while `lit`, later ones faint), the label (bold primary when current, primary when done, decorative after) and the detail in decorative, cut to the step.

`ellipsis: 'always'` marks a one-cell cut with `…` (see [fitText](../../foundation/README.md)). Blank cells carry no style, so a host keeps its own background.

## Errors and checks

Non-object inputs, non-string text and non-boolean flags throw `TypeError`; out-of-range numbers, counts and indexes throw `RangeError`; unknown colors throw `TypeError`. Every width from 1 to 160 is exact. Run [readout.test.mjs](readout.test.mjs) with `node --test`, then the [full validation sequence](../../CONTRIBUTING.md#full-validation-sequence). The storybook's READOUT story shows each part.
