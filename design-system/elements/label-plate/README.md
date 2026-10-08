# Label plate

A compact, informational identifier: a section, fixture, lot, or state word. **It is not a button.** It has no brackets, focus state, key hint, or action. Interactive controls need their own contract.

## Usage

```js
import { labelPlate } from './label-plate.mjs';
labelPlate('SECTOR 7', { tone: 'accent' });             // ▐ SECTOR 7 ▌
labelPlate('01', { tone: 'accent', pad: false });       // ▐01▌
labelPlate('CALIBRATION RUN', { maxWidth: 12 });        // ▐ CALIBRA… ▌
labelPlate('01 ACT', { tone: 'accent', form: 'slab' }); //  01 ACT   (every cell acid)
labelPlate('03 MDL', { tone: 'bright', form: 'slab' }); //  03 MDL   (black on white)
```

Returns spans that the caller places inside a line (see [foundation](../../foundation/README.md)).

| Option | Values | Default |
| --- | --- | --- |
| `tone` | `accent`, `neutral`, `warning`, `critical`, `bright` | `neutral` |
| `form` | `capped` (half-block caps) or `slab` (status-bar's padded plate) | `capped` |
| `pad` | one space each side of the text | `true` |
| `maxWidth` | non-negative integer cells | unbounded |

## Tones

Each tone is bold lettering on a filled plate, the same in both forms.

| `tone` | Lettering on plate | status-bar source (`pi/status-bar/src/footer.ts`) |
| --- | --- | --- |
| `accent` | field on accent (black on acid) | `PLATE.ok`, ROOT |
| `neutral` | primary on structural (white on `#555555`) | `GREY_PLATE`, `PLATE.unknown` |
| `warning` | field on warning | `PLATE.warn` |
| `critical` | field on critical | `PLATE.high` |
| `bright` | field on primary (black on white) | the MDL plate, `READOUT_CHIP.ok` |

## Forms

- **`capped`** (default): `▐ TEXT ▌`. Width is the text length plus 2 cap cells, plus 2 when padded. The half-block caps `▐` `▌` take the plate color, so the slab looks padded on the black field. In plain text they still bound the label. Below 5 cells padding is dropped; below 3 cells only truncated text remains, in the plate color on the field.
- **`slab`**: ` TEXT `, one span with every cell filled, as status-bar draws ` 01 ACT `, ` 02 CTX ` and ` 05 EXT `. Width is the text length, plus 2 when padded. Below 3 cells padding is dropped and the truncated text stays filled. In plain text a slab is only its padded text, so place it where position, not a border, identifies it (status-bar's plate column).

## Behavior

- When `maxWidth` is too small, text is truncated with `…` first, then padding is dropped as above. `maxWidth: 0` gives an empty span.
- Tone is emphasis, not meaning. Warning and critical plates must also say so in words, for example `WARN HEAT`.
- An unknown tone or form, or an invalid `maxWidth`, throws `RangeError`. Non-string text throws `TypeError`. Controls in text become `?`.

## Glyphs and colors

Only the capped form draws glyphs: `▐` `▌` from the curated set, plus `…` when truncating. Tones are role names, so motions recognise warning and critical plates as state cells.

## Host styles

`labelPlate(text, { style })` optionally overrides the tone's foreground/background with a validated foundation style. Lettering remains bold. Omission retains every existing tone/form/width byte. A slab with `style: { fg: 'field', bg: SIGNAL_COLORS.pink }` expresses USG without introducing a new palette role. The footer now consumes slab plates, leaving its boot wipe, zone metadata and wrapping host-owned.
## Differences from status-bar

- status-bar pads every plate to its eight-cell plate column (`padEnd(8)` in the plate's style). A slab is as wide as its padded text; the [instrument frame](../instrument-frame/README.md) gives plates their column. Six-character labels such as `01 ACT` are exactly eight cells, the same as the footer.
- status-bar's boot wipe and re-strikes restyle plate cells; that is motion, not part of the element.

## Checks

[label-plate.test.mjs](label-plate.test.mjs): plain shape, no button affordance, bounded widths and truncation in both forms, the capped form unchanged by `form`, status-bar's slab plates and their styles, plain/color equivalence, injection, and invalid input.
