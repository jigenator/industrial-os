# Label plate

A compact, informational identifier: a section, fixture, lot, or state word. **It is not a button.** It has no brackets, focus state, key hint, or action. Interactive controls need their own contract.

## Usage

```js
import { labelPlate } from './label-plate.mjs';
labelPlate('SECTOR 7', { tone: 'accent' });             // ▐ SECTOR 7 ▌
labelPlate('01', { tone: 'accent', pad: false });       // ▐01▌
labelPlate('CALIBRATION RUN', { maxWidth: 12 });        // ▐ CALIBRA… ▌
```

Returns spans that the caller places inside a line (see [foundation](../../foundation/README.md)).

| Option | Values | Default |
| --- | --- | --- |
| `tone` | `accent`, `neutral`, `warning`, `critical` | `neutral` |
| `pad` | one space each side of the text | `true` |
| `maxWidth` | non-negative integer cells | unbounded |

## Behavior

- Width is the text length plus 2 cap cells, plus 2 when padded.
- The half-block caps `▐` `▌` take the plate color, so the slab looks padded on the black field. In plain text they still bound the label.
- When `maxWidth` is too small, text is truncated with `…` first. Padding is dropped only below 5 cells. Below 3 cells, only truncated text remains.
- Tone is emphasis, not meaning. Warning and critical plates must also say so in words, for example `WARN HEAT`.
- An unknown tone or invalid `maxWidth` throws `RangeError`. Controls in text become `?`.

## Checks

[label-plate.test.mjs](label-plate.test.mjs): plain shape, no button affordance, bounded widths, truncation, injection, and invalid input.
