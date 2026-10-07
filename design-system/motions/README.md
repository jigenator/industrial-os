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

## State and attention motions

Eight primitives modeled exactly on the Pi extensions' own motions, with the extensions' timings and colors as defaults: **drawIn**, **warmUp**, **latch**, **beacon**, **cycle**, **fade**, **blink**, and **flash**. Each follows the shared contract above: pure `motion(lines, options) -> lines`, `time` in ms required while animating, `animate: false` returning the settled input, unknown options throwing `TypeError` and invalid values `RangeError`, and frozen `<NAME>_DEFAULTS`. Unlike scan and pulse, some change backgrounds or swap a glyph from `GLYPHS`, and some paint literal `#rrggbb` values from `mixOver` or `SIGNAL_COLORS`; each section says which. One-shot motions export a duration helper; at that time and later the output equals the input. Status-bar draws on a 50 ms tick, so its timings are multiples of 50 ms. The extensions stay the authority and are not changed by these copies.

Latch, beacon, warm-up and flash are built for state cues, so they take `stateCells` (default `false`). With `stateCells: true` they also restyle `warning` and `critical` cells, through `restyleCells(lines, fn, { stateCells: true })`, and every frame keeps the state's shape and word readable. The other four never touch state cells.

## `drawIn(lines, options)` and `drawInDuration(lines, options)`

A one-shot draw-in, like a terminal writing the block: status-bar's USG row boot. Each line's front starts at its left edge and advances `cells` cells per `tick`, each line starting `lag` ms after the one above. On tick k of a line's own start the front has reached `(k + 1) * cells` cells. Cells at or past the front are blank field. The `cells` cells just behind the front latch to bold black on acid with their current character, blank cells included, so the front reads as one moving band. Cells behind it are settled.

| Option | Contract | Default |
| --- | --- | --- |
| `tick` | ms per front step, `1`–`60000` | `50` |
| `cells` | cells the front advances per tick, integer `1`–`1000` | `3` |
| `lag` | ms each line starts after the line above, `0`–`60000` | `50` |

`drawInDuration(lines, options)` returns when every line is settled: the largest `row * lag + ceil(width / cells) * tick` over lines with cells, or `0`. Two 78-cell lines give 1350 ms, status-bar's 27-tick `USAGE_BOOT_TICKS`. `DRAW_IN_DEFAULTS` is exported.

- **Rate:** one-shot; the front moves 60 cells a second with the defaults.
- **Text:** like reveal's blank veil, it hides cells it has not reached. Use it only while a block appears, and compose essential readings outside it.
- **State cells:** always exempt, with no opt-in, because draw-in blanks cells. They show settled while the rest of the line is undrawn.
- **Motion-off:** the settled block at once.
- **Source:** [footer.ts](../../pi/status-bar/src/footer.ts) `USAGE_SWEEP_CELLS_PER_TICK`, `USAGE_BOOT_TICKS` and the row-boot `drawIn` cell rule; [status-bar design](../../pi/status-bar/docs/design.md) "Row boot".
- **Differences from status-bar:** status-bar sweeps every wrapped USG line together and delays only each line's text row by one tick. Here each line trails the line above by `lag`; pass `lag: 0` to start lines together, or draw each top-and-text pair as its own block. Status-bar ends its boot at a fixed tick count sized for its widest row; `drawInDuration` measures the block.

## `warmUp(lines, options)` and `warmUpDuration(options)`

A one-shot phosphor warm-up. Each cell's foreground starts at the field (invisible), steps through 25%, 50% and 75% of its settled color over the field (`mixOver`), one step every `step` ms, then takes its settled color. A cell waits for its delay first. Only the foreground changes: background, bold and every character are current from the first frame.

| Option | Contract | Default |
| --- | --- | --- |
| `step` | ms per step, `1`–`60000` | `100` (two ticks) |
| `delays` | array of up to 1000 `{ region, delay }`: `delay` in ms, `0`–`60000`; `region` as in [shared targeting](#shared-targeting). The first entry whose region holds a cell sets its delay; other cells start at once | `[]` |
| `stateCells` | `true` to warm up warning and critical cells too | `false` |

`warmUpDuration(options)` returns the longest delay plus three steps. `WARM_UP_DEFAULTS` is exported. Tatsu's stagger is plain data. Each component starts 150 ms after the one before; within one, the shape starts first, the code 100 ms later and the label 200 ms later:

```js
// "TCLI ▲ UP×3   AWKS • OK": label 0-3, shape 5, code 7-10; label 14-17, shape 19, code 21-22.
const delays = [
  { region: { left: 5, cols: 1 }, delay: 0 }, { region: { left: 7, cols: 4 }, delay: 100 }, { region: { left: 0, cols: 4 }, delay: 200 },
  { region: { left: 19, cols: 1 }, delay: 150 }, { region: { left: 21, cols: 2 }, delay: 250 }, { region: { left: 14, cols: 4 }, delay: 350 },
];
warmUp(lines, { time, delays, stateCells: true });   // settled at warmUpDuration({ delays }) = 650 ms
```

- **Rate:** one-shot, four steps of 100 ms per cell.
- **State cells:** exempt by default. With `stateCells: true` they warm up too, but start at their 25% step instead of the field, and a step that would match the cell's background keeps its settled color.
- **Motion-off:** the settled block.
- **Source:** [footer.ts](../../pi/status-bar/src/footer.ts) `TATSU_WARM_STEP_TICKS`, `TATSU_WARM_STAGGER`, `TATSU_WARM_ROLE`, `TATSU_WARM_INKS` and `tatsuWarmInk`; [status-bar design](../../pi/status-bar/docs/design.md) "Warm-up on appearance".
- **Differences from status-bar:** status-bar starts every part at the field, so its amber and red parts are invisible for a moment. Here an opted-in state cell starts at its first visible step, because a state cell must never be hidden. Any color steps through `mixOver`; status-bar ramps only its acid, amber, red and graphic inks and shows other inks settled at once. For those four inks every value is identical (graphic's 25% and 75% steps are surface `#1c1c1c` and structural `#555555`). The host passes the delays that status-bar derives from its layout. Status-bar holds the warm-up for 14 ticks (700 ms); its last tick is already settled, so the frames match the 650 ms here.

## `latch(lines, options)` and `latchDuration(options)`

A one-shot state-change latch on the cells of `region`. For `lock` ms they are locked: bold black on acid. For the next `invert` ms they are inverted: bold, with foreground and background swapped, so a state glyph on the field becomes black on its state color. Then they settle. Characters never change.

| Option | Contract | Default |
| --- | --- | --- |
| `lock` | ms locked, `0`–`60000` | `50` (one tick) |
| `invert` | ms inverted, `0`–`60000` | `100` (two ticks) |
| `region` | the cells that latch | whole block |
| `stateCells` | `true` to latch warning and critical cells too | `false` |

`latchDuration(options)` returns `lock + invert`. `LATCH_DEFAULTS` is exported.

- **Rate:** one-shot, 150 ms.
- **State cells:** Tatsu latches state-colored cells, so pass `stateCells: true`. The lock replaces the state color with acid for 50 ms; shape and word stay readable. A cell whose foreground and background are the same color keeps its look while inverted, because swapping would hide it.
- **Motion-off:** the settled block.
- **Source:** [footer.ts](../../pi/status-bar/src/footer.ts) `TATSU_LATCH_TICKS` and the latch ink in `renderFooter`; [status-bar design](../../pi/status-bar/docs/design.md) "State-change latch".
- **Differences from status-bar:** inversion swaps foreground and background; status-bar sets black on the state ink, which is the same for its cells on the field. Status-bar latches only the shape, the space after it and the code; pass those cells as `region`. Deciding when a change latches belongs to the host.

## `beacon(lines, options)`

A looping attention beacon on every `▲` cell in `region`. In the last three steps of each period: `▴` in the cell's own ink, `▴` in its 50% mix over the field, then `▲` in that mix. The rest of the period is settled, so a period never opens on a pulse and time 0 is settled. Only the triangle's size and ink change. Amber's 50% mix is `warning50` (`#6c4f29`, status-bar's `warnDim`).

| Option | Contract | Default |
| --- | --- | --- |
| `period` | ms per cycle, `1`–`60000`, at least three steps | `4000` |
| `step` | ms per beacon step, `1`–`60000` | `50` |
| `region` | where to look for `▲` cells | whole block |
| `stateCells` | `true` to beacon warning and critical cells too | `false` |

`BEACON_DEFAULTS` is exported.

- **Rate:** one 150 ms pulse every 4 s.
- **State cells:** Tatsu's `▲` is amber, so pass `stateCells: true`. If the 50% mix would match the cell's background, only the glyph changes.
- **Motion-off:** the settled `▲`.
- **Source:** [footer.ts](../../pi/status-bar/src/footer.ts) `TATSU_BEACON_PERIOD_MS`, `TATSU_BEACON_STEP_MS`, `beaconAt` in `motionFrame` and the shape ink in `renderFooter`; [status-bar design](../../pi/status-bar/docs/design.md) "Attention beacon".
- **Differences from status-bar:** it targets every `▲` in the region instead of the shape of a behind or repair component; pass only lines or a region that need attention. The period counts from the host's time origin, as status-bar's counts from its motion epoch.

## `cycle(lines, options)`

A looping placeholder. Every cell in `region` whose character is one of `glyphs` shows `glyphs[floor(time / step) % glyphs.length]`. Only the glyph changes, so its size changes but its style does not.

| Option | Contract | Default |
| --- | --- | --- |
| `glyphs` | non-empty array of up to 1000 single characters from `GLYPHS` | `['·', '•', '•', '•', '·']` |
| `step` | ms per glyph, `1`–`60000` | `150` |
| `region` | the cells that may cycle | whole block |

`CYCLE_DEFAULTS` is exported. Time 0 shows the first glyph, so a `•` in the input shows `·` at time 0.

- **Rate:** a step every 150 ms, 750 ms per cycle.
- **State cells:** always exempt.
- **Motion-off:** the input glyph, a steady `·` for a checking placeholder.
- **Source:** [footer.ts](../../pi/status-bar/src/footer.ts) `TATSU_CHECK_GLYPHS`, `TATSU_CHECK_STEP_MS` and `tatsuCheck`; [status-bar design](../../pi/status-bar/docs/design.md) "Checking scan and fade".
- **Differences from status-bar:** it targets cells by glyph and region instead of a checking component's shape cell. A cell whose character is not in the sequence never changes, so letters and digits never do.

## `fade(lines, options)`

A looping ink wave. Every non-space cell in `region` whose foreground role is one of `roles` takes `levels[i]`, with the period split into equal steps. The default levels are status-bar's check fade, a gentle triangle wave up from decorative grey and back: `#717171`, `#7b7b7b`, `#868686`, `#919191`, `#9c9c9c`, `#919191`, `#868686`, `#7b7b7b`. Only the foreground changes.

| Option | Contract | Default |
| --- | --- | --- |
| `levels` | non-empty array of up to 1000 Acid / Black roles or `#rrggbb` colors | the check fade, from `decorative` and `SIGNAL_COLORS.check*` |
| `period` | ms per wave, `1`–`60000` | `1200` |
| `roles` | non-empty array of role names other than `warning` and `critical`; a cell matches by its `fg` role | `['decorative']` |
| `region` | the cells that may fade | whole block |

`FADE_DEFAULTS` is exported. With the defaults, time 0 equals the input.

- **Rate:** a step every 150 ms, 1200 ms per wave. Adjacent steps differ only slightly and there is no polarity change.
- **State cells:** always exempt; `warning` and `critical` in `roles` throw, as in pulse.
- **Motion-off:** the input, a steady `#717171`.
- **Source:** [footer.ts](../../pi/status-bar/src/footer.ts) `TATSU_CHECK_FADE_LEVELS` and `TATSU_CHECK_FADE_INKS`; [status-bar design](../../pi/status-bar/docs/design.md) "Checking scan and fade".
- **Differences from status-bar:** it targets cells by role and region instead of the `CHK` code. Cells painted with a literal color never match.

## `blink(lines, options)`

A looping blink on the cells of `region`. For `on` ms they keep their own style; for `off` ms `offStyle` is merged over it, and `offGlyph`, when set, replaces every character that is not a letter or digit. The input is the "on" frame and is also the settled one.

| Option | Contract | Default |
| --- | --- | --- |
| `on` | ms in the input style, `1`–`60000` | `500` |
| `off` | ms in the off style, `1`–`60000` | `300` |
| `offStyle` | `{ fg?, bg?, bold? }`: roles or `#rrggbb`, and a boolean | `{ bg: 'surface' }` |
| `offGlyph` | `null`, or one character from `GLYPHS` | `null` |
| `region` | the cells that blink | whole block |

`BLINK_DEFAULTS` and `BLINK_PRESETS` are exported. The defaults are the lamp preset.

| Preset | Options | Input | Rate |
| --- | --- | --- | --- |
| `lamp`, the Thread Rail root lamp while working | `on: 500, off: 300, offStyle: { bg: 'surface' }` | a blank cell on acid, `{ fg: 'primary', bg: 'accent' }` | 1.25 cycles a second |
| `activityLight`, PNYTL's activity light | `on: 50, off: 50, offStyle: { fg: 'field' }, offGlyph: '⌑'` | a bold `•` in `SIGNAL_COLORS.pink` on `primary`; `region` the icon cell | toggles every 50 ms, 10 lit onsets a second |

- **Rate:** as the presets show. The activity light exceeds three flashes a second on one cell, as the [shared motion rule](../../docs/design.md#motion) permits; state that rate wherever it is used. No photosensitivity or WCAG flash compliance is claimed.
- **State cells:** always exempt.
- **Motion-off:** the input, the lit frame, as status-bar holds the lamp and the light lit with motion off.
- **Source:** [footer.ts](../../pi/status-bar/src/footer.ts) `lampOn`, `lightOn`, the lamp cell and `ponytailPlate`; [status-bar design](../../pi/status-bar/docs/design.md) Thread Rail and PNYTL.
- **Differences from status-bar:** status-bar blinks only while the root is working or Ponytail is active, and an idle lamp is static surface; the host decides whether to run the blink.

## `flash(lines, options)` and `flashDuration(options)`

A one-shot flash on the cells of `region`: the step `pattern[floor(time / step)]`, then settled. Characters never change.

| Option | Contract | Default |
| --- | --- | --- |
| `step` | ms per pattern entry, `1`–`60000` | `80` |
| `pattern` | non-empty array of up to 1000 kinds | `['fill', 'outline']` |
| `region` | the cells that flash, typically a plate | whole block |
| `stateCells` | `true` to flash warning and critical cells too | `false` |

| Kind | A cell looks like |
| --- | --- |
| `'fill'` | the input |
| `'outline'` | a filled background removed, lettering in the fill color; cells already on the field are unchanged |
| `'invert'` | foreground and background swapped; cells whose two colors match are unchanged |
| `'white'` | bold black on white (`primary`); a full block `█` keeps its background and turns white |

`flashDuration(options)` returns `pattern.length * step`. `FLASH_DEFAULTS` and `FLASH_PRESETS` are exported. The defaults are the interrupt preset.

| Preset | Options | Duration and rate | Source |
| --- | --- | --- | --- |
| `interrupt` | `step: 80, pattern: ['fill', 'outline']` | 160 ms: filled, unfilled for 80 ms, filled | claude-interrupt plate, [index.ts](../../pi/claude-interrupt/src/index.ts) `FLASH_OFF`, `FLASH_ON`; [design](../../pi/claude-interrupt/docs/design.md) |
| `threshold` | `step: 50, pattern: ['fill', 'white', 'fill', 'white', 'fill', 'white']` | 300 ms: three 50 ms white flashes, one every 100 ms (10 a second) | status-bar's 70/90 mark, [footer.ts](../../pi/status-bar/src/footer.ts) `FLASH_TICKS`, `flash70`, `flash90` |
| `polarity` | `step: 50, pattern: ['invert', 'invert']` | 100 ms: one swap of the plate's pair | status-bar's CMP plate at boot |
| `tag` | `step: 50, pattern: ['fill', 'invert', 'invert', 'fill', 'fill', 'invert', 'invert']` | 350 ms: two 100 ms inversions | status-bar's readout tag during a tone wipe, `TAG_TICKS`, `tagFlash` |

- **Rate:** as the presets show. The threshold preset exceeds three flashes a second; state that rate wherever it is used. No photosensitivity or WCAG flash compliance is claimed.
- **State cells:** exempt by default. A threshold or alarm flash on state cells passes `stateCells: true`; every kind keeps the glyph readable.
- **Motion-off:** the settled block.
- **Differences from the extensions:** claude-interrupt follows its flash with a ping and a settling wipe; only the flash is here. Status-bar lights a lit cell white on white; here a full block keeps its background and turns its ink white, which looks the same, because an opted-in state cell may not take its background's color. Status-bar picks the lit cells and the mark cell itself; pass them as `region`. Status-bar's tag window lasts eight ticks, the last one settled, so its frames match the 350 ms here.

## Shared targeting

Motions that act on part of a block take an optional `region`: `{ top, left, rows, cols }` in cells, each a non-negative integer, with `rows` and `cols` allowed to be `Infinity`. Omitted fields cover the whole block. `resolveRegion(name, region)` in `frame.mjs` validates it and `inRegion(region, col, row)` tests a cell. Unknown fields throw `TypeError`; invalid values throw `RangeError`.

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
