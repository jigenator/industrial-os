# Motions

Three small, reusable motion primitives for instrument-like terminal details: **scan**, **pulse**, and **reveal**. Each is a pure function: rendered lines and an explicit time in, new lines out. Nothing here reads a clock, starts a timer, writes to the terminal, or keeps state. The host owns time, redraws, and cleanup. See [foundation](../foundation/README.md) for the line model.

A motion decorates rendered lines; it does not supply data. Scan and pulse preserve characters. Reveal can obscure text, including numeric values and error explanations: apply it only to nonessential decoration and compose complete readings, labels, and status rows outside the transform.

## Usage

```js
import { span } from '../foundation/cells.mjs';
import { gauge } from '../elements/gauge/gauge.mjs';
import { statusRow } from '../elements/status-row/status-row.mjs';
import { scan } from './scan.mjs';
import { pulse } from './pulse.mjs';
import { reveal, revealDuration } from './reveal.mjs';

const lines = [
  ...gauge({ label: 'FILL', value: 64 }, { width: 48 }),
  ...statusRow({ label: 'DOOR', value: 'closed', status: 'success' }, { width: 48 }),
];

scan(lines, { time: 1200 });                       // highlight band mid-sweep
pulse(lines, { time: 1200, period: 2000 });         // accent cells in their dim half-cycle
const decoration = [[span('---+---+---', { fg: 'accent' })]];
const revealedFrame = [...reveal(decoration, { time: 300, veil: 'blank' }), ...lines];
revealDuration(decoration.length);                // 600 ms; readings in lines are never veiled
scan(lines, { animate: false });                    // motion-off: the input, unchanged
```

Compose by nesting, with the same time. Keep each motion's options in one place so a specimen can show them:

```js
const frame = (time) => pulse(scan(lines, { time }), { time });
```

Animate only the content you mean to. To leave a panel's frame still, animate the body before `numberedPanel(...)`, as in the checks.

## Contract shared by all three

`motion(lines, options) -> lines`

| Item | Behavior |
| --- | --- |
| `lines` | Array of lines, each an array of `{ text, style }` spans, as every renderer returns. Anything else throws `TypeError`. `[]` and empty lines are valid. |
| `time` | Milliseconds since the motion started, a finite number `>= 0`. Required while animating. Missing, `NaN`, infinite, negative, or non-number throws `RangeError`. |
| `animate` | Default `true`. `false` is **motion-off**: `time` is ignored and the result equals `lines` (new arrays, same painted output). Other options are still validated. |
| Output | New arrays with exactly as many lines and cells as the input, so every line keeps its exact width, including 1 cell. Unchanged spans may be shared with the input; treat spans as read-only. Input is never mutated. |
| Determinism | The same lines and options always give the same lines. |
| Unknown options | Throw `TypeError` (a typo must not silently do nothing). `undefined` means the default. |
| Color | Motions change only palette roles (`fg`, `bold`) and, for reveal's `blank` veil, characters. Painted in color or plain, frames show the same cells. |

Guarantees that hold for every motion:

- **State-colored cells are exempt unless the motion opts in.** Cells whose `fg` or `bg` is the `warning` or `critical` role are left unchanged by default. This protects individual cells, not the rest of a message or its stacked continuation lines. A motion built for state cues (an attention beacon, a state latch, a warm-up) may opt in per call with a documented option; `restyleCells(lines, fn, { stateCells: true })` then passes those cells to `fn` and throws if a change would blank one, give it its background's color, or change a letter or digit of its word. Tinting, inverting and resizing a glyph (`▲` to `▴`) are allowed. Use role names for state colors so the exemption can see them. Scan, pulse and reveal never opt in.
- **Essential content stays outside a reveal.** Scan and pulse never change a character. Reveal's `dim` veil preserves characters but reduces contrast; `blank` replaces them with spaces. Neither is appropriate for essential readings or error details. Compose the entire essential block unchanged after transforming only decoration.
- **Time 0 is stable.** Scan and pulse at time 0 equal the input, so they can rest anywhere. Reveal at time 0 is its fully veiled start and equals the input only at or after `revealDuration()`.
- **No frequency cap.** Any positive `period` is allowed (`MIN_PERIOD_MS` is 1, exported by `frame.mjs`), so a motion may cycle or flash faster than three times a second, as the [shared motion rule](../../docs/design.md#motion) permits. `animate: false` settles every motion; state the rate of a fast motion where it is used. No photosensitivity or WCAG flash compliance is claimed.

## `scan(lines, options)`

A bright band sweeping across the block, entering before the first cell and leaving past the last. It loops: frame at `time + period` equals frame at `time`.

| Option | Contract | Default |
| --- | --- | --- |
| `period` | ms for one full sweep, `1`–`60000` | `2400` |
| `band` | band size in cells (columns for `x`, rows for `y`), integer `1`–`1000` | `3` |
| `axis` | `'x'` sweeps left to right across columns; `'y'` sweeps top to bottom across lines | `'x'` |

Cells in the band become `accent`, or `primary` where they were already `accent`; the leading cell is bold. Spaces are untouched. `SCAN_DEFAULTS` is exported.

## `pulse(lines, options)`

Alternates matching cells between their own style (first half of each period) and dim `decorative` grey, not bold (second half). It loops.

| Option | Contract | Default |
| --- | --- | --- |
| `period` | ms per bright-and-dim cycle, `1`–`60000` | `2000` |
| `roles` | non-empty array from `'accent'`, `'primary'`, `'secondary'`; cells whose `fg` matches pulse | `['accent']` |

`warning` and `critical` throw: a fault must not fade. Pulse suggests "active", so pass only lines whose accent cells really are active. A gauge fill and a success marker are both accent. `PULSE_DEFAULTS` is exported.

## `reveal(lines, options)` and `revealDuration(lineCount, options)`

A one-shot wipe left to right. Each line starts `stagger` ms after the one above, and a line's wipe takes `duration` ms. Cells not yet reached are veiled in structural grey.

| Option | Contract | Default |
| --- | --- | --- |
| `duration` | ms for one line to wipe fully, `1`–`60000` | `600` |
| `stagger` | ms between line starts, `0`–`1000` | `60` |
| `veil` | `'dim'`: characters remain in structural grey (contrast is not guaranteed). `'blank'`: veiled cells become spaces | `'dim'` |

`revealDuration(lineCount, options)` returns `duration + (lineCount - 1) * stagger` (just `duration` for 0 or 1 lines) and validates the same options. Hosts use it to know when to stop redrawing. At that time and later, `reveal` equals the input. `REVEAL_DEFAULTS` is exported.

## Motion-off and no-color

Motion-off means `animate: false`: the stable, final, fully truthful view. A host with a reduced-motion or no-motion setting passes it and starts no timer. Real data changes are never delayed by this. Re-render the new data and show it at once.

Scan and pulse only change color, so a plain (no-color) frame has the same text as the input; there is nothing to animate, and a host should treat plain output as motion-off. Reveal with `veil: 'blank'` is the one motion whose frames differ in plain text.

## Host integration

The host supplies `time`. This clock sketch assumes `lines` contains only decoration; `write` and `paintFrame` belong to the host. For actual terminal modes and guarded error cleanup, use the shared host in [examples](../examples/README.md), not this sketch alone:

```js
// Host state: elapsed ms while paused, plus when the current run started.
let elapsed = 0, startedAt = null, timer = null, complete = false;
const time = () => (startedAt === null ? elapsed : elapsed + (performance.now() - startedAt));
const stop = () => {
  elapsed = time();
  startedAt = null;
  if (timer !== null) clearInterval(timer);
  timer = null;
};
const draw = () => {
  const t = time();
  complete ||= t >= revealDuration(lines.length);
  if (complete) stop();                                  // stop without recursively drawing
  write(paintFrame(reveal(lines, { time: t, animate: !complete })));
};
const play = () => {
  if (timer !== null || complete) return;
  startedAt = performance.now();
  timer = setInterval(draw, Math.ceil(1000 / 15));         // one timer, at most 15 fps
  draw();
};
const pause = () => { stop(); draw(); };
const replay = () => { stop(); elapsed = 0; complete = false; play(); };
```

- Looping motions (scan, pulse) run until paused. Finite motions (reveal) stop themselves.
- Clear the timer on pause, motion-off, selection change, quit, signal, and drawing error.
- At 15 fps a scan moves at most one cell per frame when `period >= (width + band) / 15` seconds. A faster period skips cells but remains correct.
- Label demonstration playback as a demonstration. Do not run motion on live data that is not changing.

## Extending

A new motion is a pure function `(lines, options) -> lines` in its own file here, built on `frame.mjs` (`resolveOptions`, `assertTime`, `restyleCells`). It needs a stated period or duration (any positive value; state a fast rate where the motion is used), `animate: false` returning the stable view, and exemption for `warning` and `critical` cells unless it opts in as described above. Seeded variation comes from [foundation/seeded.mjs](../foundation/seeded.mjs), never `Math.random`. Add its checks to `motions.test.mjs`, and map its section here. Do not add timers or hidden state.

## Checks

[motions.test.mjs](motions.test.mjs): motion-off, time and option validation, exact scan/pulse/reveal frames, state-color exemption, text preservation, exact widths from 1 to 160 with real renderers, determinism and input immutability, plain/color equivalence, the absence of a frequency cap (a 50 ms period cycles 20 times a second), composition with a numbered panel, and a source check that the primitives import only `foundation/` and use no clock, timer, process, or randomness. These are deterministic unit checks. [Storybook regressions](../examples/storybook-regressions.test.mjs) also execute the host sketch with a manual clock and exercise complete-message preservation in reveal examples. No native-terminal claim follows from these checks.
