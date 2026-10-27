# Time lane

The board's time axis, modeled on the automations monitor: a scale from time to columns, the axis ruler and its hour labels, a lane's track, runs on it and the NOW line. Columns are relative to the lane's first cell; the host places the pieces. History is grey, and a fill color appears only on a live run, so color always marks work happening now.

## Usage

```js
import { crossNow, laneAxis, laneRun, laneScale, laneTrack } from './time-lane.mjs';
const span = { past: 3 * 3_600_000, future: 3_600_000 };
const { col, now } = laneScale(span, { width: 60 });
const { ruler, labels } = laneAxis(span, { width: 60 });
const track = laneTrack({ now }, { width: 60, origin: 54 });
const run = laneRun({ from: col(-3_600_000), to: now, live: true, label: '1234', fill: '#95b8d1', ink: 'field', head: true }, { width: 60 });
// The host lays the track, then each piece at its column: a canvas, or a CellGrid as the storybook does.
```

## Contract

- `laneScale({ past, future }, { width })` returns `col(dt)`, the column of a time `dt` milliseconds from now (rounded to the nearest of `width` columns, so the first column is `−past` and the last `+future`), and `now`, the NOW column.
- `laneAxis({ past, future }, { width })` returns `ruler`, a structural `─` line with a faint `┴` at each quarter hour, a structural `┬` at each hour and an acid `┼` at NOW, and `labels`, one placed piece per hour: `-3H`, `-2H`, `-1H` and `+1H` decorative and `NOW` bold primary, centred on its tick and kept inside the lane on the right. The first label may start a cell or two left of the lane; a host draws it over its heading row and clips it to the lane.
- `laneTrack({ now, since = null, after = 'dashed' }, { width, origin = 0 })` is a lane's base: faint and solid up to NOW, then `·` on even absolute columns (`origin` is the lane's first absolute column, so stacked lanes align). From after `since` up to NOW the track is dashed `┄` (the source stopped) or hatched `╱` in `BOARD_INKS.hatch` (the source is not heard from).
- `laneRun(run, { width, measure })` returns `{ pieces, span }`, or `null` when the run ends before the lane. A finished run (`live: false`) is a `BOARD_INKS.base` bar ending in its [end mark](../board-marks/README.md); the bar leaves the foreground unset so the track's ink stays. A live run is hatched `▒` in `fill` up to `verified` (all of it while `verifying`), then solid `fill`. Its `label` sits bold in `ink` on the fill, or bold secondary one cell to the left when the bar is too short for it. With `head`, one more cell at NOW shows acid while `lit`, otherwise the fill. `span` is the live run's drawn extent, for the host's hit regions; `null` for a finished run.
- `crossNow(cell, { quiet = false })` says what NOW draws over a cell: an acid `│` over track, gap and blank cells on the field (`─`, `·`, `┄`, space), and nothing over a bar, a mark, text or a selection. `quiet` draws a faint `│` over blank cells only, for strips beside text. It returns a span or `null`.

Run columns may lie outside the lane; a host may clamp far-past columns just left of it, since only their sign matters there. Every column is an integer within ±100000.

## Errors and checks

Non-object inputs and non-boolean flags throw `TypeError`; non-positive spans, non-integer columns, invalid widths and unknown `after` values throw `RangeError`. Run [time-lane.test.mjs](time-lane.test.mjs) with `node --test`, then the [full validation sequence](../../CONTRIBUTING.md#full-validation-sequence). The storybook's TIME LANE story places the pieces on a one-row [`CellGrid`](../../foundation/README.md), which replaces a cell's style where the monitor's canvas keeps colors a piece leaves unset; a lane is meant to be drawn by a host that keeps them.
