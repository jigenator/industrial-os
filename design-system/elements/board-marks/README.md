# Board marks

The one-cell marks of the automations monitor's board: run outcomes, schedule times, state cells, the selection pointer and the plate spine. Every mark is a shape as well as a color, so plain output keeps its meaning.

## Usage

```js
import { endMark, pointer, runMark, runTrail, scheduleMark, spine, stateCell } from './board-marks.mjs';
runTrail(['succeeded', 'failed', 'interrupted']);    // ■ ✕ ◩, newest first
endMark('failed');                                    // ✕ on the bar grey, bold
scheduleMark('next');                                 // ◇
stateCell('warn');                                    // █ in warning
```

## Contract

| Function | Returns |
| --- | --- |
| `runMark(outcome, { bold = false })` | one span: the outcome's glyph in its ink |
| `runTrail(outcomes, { gap = 1 })` | the marks in the order given, `gap` blank unstyled cells apart |
| `endMark(outcome)` | the end of a finished bar: `✕` for a failure, `▪` for any other miss, both bold on `BOARD_INKS.base`; `[]` for a success |
| `scheduleMark('result', { outcome })` | a schedule's last result in a column: `✕` critical, `■` secondary for a success, `◩` warning otherwise; bold |
| `scheduleMark('last', { outcome })` | a last run on a time strip: `✕` critical for a failure, otherwise `◆` secondary; bold |
| `scheduleMark('next')` | the next run on a time strip: `◇` decorative |
| `scheduleMark('firing', { lit = true })` | a firing run: `◆` bold, acid while `lit`, otherwise decorative |
| `stateCell(tone)` | `█` in the [board tone's](../../foundation/README.md) cell color |
| `pointer({ bold = false })` | the selection pointer `▶` in primary |
| `spine(ink)` | the plate spine `▌` in a supplied color |

`RUN_MARKS` holds each outcome's glyph and ink: succeeded `■` primary, failed `✕` critical, cancelled `□` decorative, interrupted and dropped `◩` warning. `BOARD_GLYPHS` names every glyph. Marks never carry a background except `endMark`; the host adds one, such as a selection band.

## Errors and checks

An unknown outcome, schedule kind or tone throws `RangeError`; a non-boolean flag throws `TypeError`; an unknown color throws `TypeError`. Run [board-marks.test.mjs](board-marks.test.mjs) with `node --test`, then the [full validation sequence](../../CONTRIBUTING.md#full-validation-sequence). The storybook's BOARD MARKS story shows every mark.
