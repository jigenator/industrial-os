// Motion stories: each motion with named examples over real renderer output, framed by a still numbered
// panel, plus one composed example (the transcript marker's timeline). Pure and I/O-free. Each example
// states how often the host redraws it: the motion's own step grid, or CONTINUOUS_FRAME_MS for motions
// whose frames change continuously with time.
import { fitLine, lineWidth, span } from '../foundation/cells.mjs';
import { SIGNAL_COLORS } from '../foundation/signal-colors.mjs';
import { labelPlate } from '../elements/label-plate/label-plate.mjs';
import { numberedPanel, panelInnerWidth } from '../elements/numbered-panel/numbered-panel.mjs';
import { gauge, gaugeScale } from '../elements/gauge/gauge.mjs';
import { statusRow } from '../elements/status-row/status-row.mjs';
import { COUNT_PLATES, countPlate } from '../elements/count-plate/count-plate.mjs';
import { pnytlPlate } from '../elements/mode-plate/mode-plate.mjs';
import { stateChips } from '../elements/state-chip/state-chip.mjs';
import { pixelNumeral } from '../elements/pixel-numeral/pixel-numeral.mjs';
import { providerColumn, segmentMeter } from '../elements/segment-meter/segment-meter.mjs';
import { threadRail } from '../elements/thread-rail/thread-rail.mjs';
import { instrumentFrame } from '../elements/instrument-frame/instrument-frame.mjs';
import { MARKER_TIMELINE, markerBars, markerPlate, transcriptMarker } from '../elements/transcript-marker/transcript-marker.mjs';
import { scan, SCAN_DEFAULTS } from '../motions/scan.mjs';
import { pulse, PULSE_DEFAULTS } from '../motions/pulse.mjs';
import { reveal, revealDuration, REVEAL_DEFAULTS } from '../motions/reveal.mjs';
import { drawIn, drawInDuration, DRAW_IN_DEFAULTS } from '../motions/draw-in.mjs';
import { warmUp, warmUpDuration, WARM_UP_DEFAULTS } from '../motions/warm-up.mjs';
import { latch, latchDuration, LATCH_DEFAULTS } from '../motions/latch.mjs';
import { beacon, BEACON_DEFAULTS } from '../motions/beacon.mjs';
import { cycle, CYCLE_DEFAULTS } from '../motions/cycle.mjs';
import { fade, FADE_DEFAULTS } from '../motions/fade.mjs';
import { blink, BLINK_DEFAULTS, BLINK_PRESETS } from '../motions/blink.mjs';
import { flash, flashDuration, FLASH_DEFAULTS, FLASH_PRESETS } from '../motions/flash.mjs';
import { ping, pingDuration, PING_DEFAULTS } from '../motions/ping.mjs';
import { wipe, wipeDuration, WIPE_DEFAULTS } from '../motions/wipe.mjs';
import { fillIn, fillInDuration, FILL_IN_DEFAULTS } from '../motions/fill-in.mjs';
import { burnOut, burnOutDuration, BURN_OUT_DEFAULTS, BURN_OUT_PRESETS } from '../motions/burn-out.mjs';
import { edgePulse, EDGE_PULSE_DEFAULTS } from '../motions/edge-pulse.mjs';
import { restrike, restrikeDuration, RESTRIKE_DEFAULTS } from '../motions/restrike.mjs';
import { ghost, ghostDuration, GHOST_DEFAULTS } from '../motions/ghost.mjs';
import { nudge, NUDGE_DEFAULTS } from '../motions/nudge.mjs';
import { FRAME_FIXTURE, ROW_VARIANTS, within } from './storybook-elements.mjs';
import { call, code, literal, spread } from './storybook-usage.mjs';

// Redraw interval for continuously changing motions (scan, pulse, reveal): setInterval truncates
// fractional delays, so round up to keep them at or under 15 frames a second.
export const CONTINUOUS_FRAME_MS = Math.ceil(1000 / 15);

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const grid = (...ms) => ms.filter((m) => m > 0).reduce(gcd);

// A body: lines from real renderers, and the statements that build them as `body`.
const body = (lines, expression) => ({ lines, calls: [`body = ${expression}`] });
const one = (spans, expression) => body([spans], `[${expression}]`);

// Fixture blocks that the motion previews decorate. They mix accent, readout, and state cells so the
// previews show which cells each motion touches and that warning and critical cells never change.
function block(width, parts, variable = 'body') {
  return {
    lines: parts.flatMap(([, render, input, opts]) => render(input, { width, ...opts })),
    calls: [`${variable} = [`, ...parts.map(([name, , input, opts]) => `  ${name === 'gaugeScale' ? '' : '...'}${call(name, input, { width, ...opts })},`), ']'],
  };
}
const FILL = { label: 'FILL', value: 42.5 };
const FLOW = { label: 'FLOW', value: null, max: 12, unit: 'L/m' };
const ALIGNED = { readoutWidth: 8 };
const scale = (input, opts) => [gaugeScale(input, opts)]; // one line, as a block of lines
const ROWS = [ROW_VARIANTS[1].input, ROW_VARIANTS[2].input, ROW_VARIANTS[3].input].map((r) => ['statusRow', statusRow, r, {}]);
const gaugeBlock = (width) => block(width, [['gauge', gauge, FILL, ALIGNED], ['gauge', gauge, FLOW, ALIGNED], ['gaugeScale', scale, {}, ALIGNED]]);
const rowBlock = (width) => block(width, ROWS);
const bayBlock = (width, variable) => block(width, [['gauge', gauge, FILL, ALIGNED], ['gauge', gauge, FLOW, ALIGNED], ...ROWS], variable);

// Reveal only decorative rails. Readings and complete status rows (including stacked continuations)
// are composed afterward, outside the transform; a foreground color cannot identify all essential text.
function revealBlock(width) {
  const patterns = ['-', '+---', '='];
  return {
    lines: patterns.map((pattern) => [span(pattern.repeat(Math.ceil(width / pattern.length)).slice(0, width), { fg: 'accent' })]),
    calls: ['body = [', ...patterns.map((pattern) => `  [span(${literal(pattern)}.repeat(${Math.ceil(width / pattern.length)}).slice(0, ${width}), { fg: 'accent' })],`), ']'],
  };
}

// "TCLI ▲ UP×3   AWKS • OK": label 0-3, shape 5, code 7-10; label 14-17, shape 19, code 21-22.
const TATSU = [{ label: 'TCLI', state: 'behind', commitsBehind: 3 }, { label: 'AWKS', state: 'current' }];
const ATTENTION = [{ label: 'TCLI', state: 'behind', commitsBehind: 3 }, { label: 'AWKS', state: 'repair' }];
const CHECKING = [{ label: 'TCLI', state: 'checking' }, { label: 'AWKS', state: 'checking' }];
const chips = (inputs) => (width) => body(stateChips(inputs, { width }), call('stateChips', inputs, { width }));
const TATSU_DELAYS = [
  { region: { left: 5, cols: 1 }, delay: 0 }, { region: { left: 7, cols: 4 }, delay: 100 }, { region: { left: 0, cols: 4 }, delay: 200 },
  { region: { left: 19, cols: 1 }, delay: 150 }, { region: { left: 21, cols: 2 }, delay: 250 }, { region: { left: 14, cols: 4 }, delay: 350 },
];

const ACTIVITY = { working: true, units: 3 };
const rail = (width) => body(threadRail(ACTIVITY, { width }), call('threadRail', ACTIVITY, { width }));

// A USG provider column with both windows known; its fixture time is 0.
const MIN = 60_000;
const CLD = { provider: 'claude', data: { windows: { '5h': { usedPercent: 30, resetsAt: 120 * MIN }, wk: { usedPercent: 55, resetsAt: 3 * 24 * 60 * MIN } }, updatedAt: 0 } };
const usage = (width) => body(providerColumn(CLD, { width, now: 0 }), call('providerColumn', CLD, { width, now: 0 }));

// Eight inline squares in a provider's ink; `shown` names the ink as source.
const meter = (remaining, provider) => () =>
  one(segmentMeter({ remaining, ink: SIGNAL_COLORS[provider] }), call('segmentMeter', { remaining, ink: code(`SIGNAL_COLORS.${provider}`) }));
const SQUARES = { top: 0, left: 0, rows: 1, cols: 8 };

// The gauge's filled cells, found in the rendered line, so a glitch never reaches the track or readout.
const FILL_GLYPHS = '█▏▎▍▋▊▉';
function fillRegion(lines) {
  for (const [top, line] of lines.entries()) {
    const chars = [...line.map((s) => s.text).join('')];
    const first = chars.findIndex((c) => FILL_GLYPHS.includes(c));
    if (first >= 0) return { top, left: first, rows: 1, cols: chars.findLastIndex((c) => FILL_GLYPHS.includes(c)) - first + 1 };
  }
  return { top: 0, left: 0, rows: 0, cols: 0 };
}
const KNOWN = { label: 'FILL', value: 64 };
const NUDGE_FRAME = { header: { title: [span('CALIBRATION')] } };

const MOTION_FRAME = { number: 1, title: 'BAY 04', meta: 'DEMONSTRATION' };

// A motion preview: fixture lines from real renderers, decorated by the real motion, framed by a still
// numbered panel (the motion runs on the body only). `duration(lines, options)` is given only for a finite
// motion; `loop(options)` gives a looping motion's cycle; `frame(options)` the redraw interval in ms.
function motionStory({ id, fn, motion, defaults, units, duration, loop, frame = () => CONTINUOUS_FRAME_MS, ...fields }) {
  const bodyAt = (variant, width) => variant.body(panelInnerWidth(within(width, 60)));
  // A variant's `region(lines)`, when given, targets cells found in the rendered body at this width.
  const optionsFor = (variant, lines, options = variant.options) => (variant.region ? { ...options, region: variant.region(lines) } : options);
  return {
    id,
    kind: 'motion',
    module: `motions/${id}.mjs`,
    contract: 'motions/README.md',
    ...fields,
    motion: { name: fn, defaults, units, defaultsName: `${id.replace(/-/g, '_').toUpperCase()}_DEFAULTS` },
    specimen(variant, width, { animate = false, time = 0 } = {}) {
      const w = within(width, 60);
      const b = bodyAt(variant, width);
      const shown = optionsFor(variant, b.lines, variant.shown);
      const options = animate ? { ...shown, time: code('time') } : { ...shown, animate: false };
      const lines = motion(b.lines, { ...optionsFor(variant, b.lines), animate, time });
      const fixed = variant.fixed?.(panelInnerWidth(w), 'readings');
      return {
        lines: numberedPanel(MOTION_FRAME, [...lines, ...(fixed?.lines ?? [])], { width: w }),
        calls: [...b.calls, `frame = ${call(fn, code('body'), options)}`, ...(fixed?.calls ?? []), call('numberedPanel', MOTION_FRAME, code(fixed ? '[...frame, ...readings]' : 'frame'), { width: w })],
        facts: [],
      };
    },
    // Total ms of a finite motion at this width, or null for one that loops until paused.
    duration(variant, width) {
      if (!duration) return null;
      const { lines } = bodyAt(variant, width);
      return duration(lines, optionsFor(variant, lines));
    },
    loop: (variant) => (loop ? loop({ ...defaults, ...variant.options }) : null),
    frameMs: (variant) => frame({ ...defaults, ...variant.options }),
  };
}

const SCAN = motionStory({
  id: 'scan',
  fn: 'scan',
  title: 'SCAN',
  summary: 'A highlight band sweeping across rendered lines. It changes only foreground styling, never a character.',
  motion: scan,
  defaults: SCAN_DEFAULTS,
  units: { period: 'ms', band: 'cells' },
  loop: (o) => o.period,
  rules: [
    'Time 0 equals the input; the frame at time + period equals the frame at time.',
    'Warning and critical cells are never restyled.',
    'Any positive period is allowed; there is no frequency cap, so motion-off is the settled view.',
    'animate: false is the stable motion-off view; time may be omitted.',
  ],
  variants: [
    { name: 'GAUGE SWEEP', note: 'Default options across a gauge block: a band moving left to right.', options: {}, body: gaugeBlock },
    { name: 'ROW SCAN', note: 'axis y, one row at a time; the WARN and ERROR rows keep their color.', options: { axis: 'y', band: 1, period: 3000 }, body: rowBlock },
  ],
});

const PULSE = motionStory({
  id: 'pulse',
  fn: 'pulse',
  title: 'PULSE',
  summary: 'Matching cells alternate between their own style and dim grey. Use it only where a signal really is active.',
  motion: pulse,
  defaults: PULSE_DEFAULTS,
  units: { period: 'ms' },
  loop: (o) => o.period,
  rules: [
    'First half of each period is the original style; second half is decorative grey.',
    'roles takes accent, primary, or secondary; warning and critical throw, so a fault never fades.',
    'Any positive period is allowed; there is no frequency cap.',
    'animate: false is the stable motion-off view.',
  ],
  variants: [
    { name: 'ACTIVE MARKER', note: 'Default: accent cells pulse; the WARN and ERROR rows do not.', options: {}, body: rowBlock },
    { name: 'READOUTS', note: 'roles accent and primary over a gauge block, on a slower period.', options: { roles: ['accent', 'primary'], period: 3000 }, body: gaugeBlock },
  ],
});

const REVEAL = motionStory({
  id: 'reveal',
  fn: 'reveal',
  title: 'REVEAL',
  summary: 'A one-shot left-to-right wipe for decorative content. Essential readings and complete status rows stay outside it.',
  motion: reveal,
  defaults: REVEAL_DEFAULTS,
  units: { duration: 'ms', stagger: 'ms' },
  duration: (lines, o) => revealDuration(lines.length, o),
  rules: [
    'Time 0 is the fully veiled start; at revealDuration() and later the output equals the input.',
    'revealDuration(lineCount, options) = duration + (lineCount - 1) * stagger.',
    'Dim preserves characters in structural grey; blank replaces unrevealed cells with spaces.',
    'State-colored cells are exempt, not whole messages. Keep essential content outside either veil.',
  ],
  variants: [
    { name: 'DIM VEIL', note: 'Decorative rails emerge from structural grey; readings and full status messages stay unchanged.', options: {}, body: revealBlock, fixed: bayBlock },
    { name: 'BLANK VEIL', note: 'Only decorative rails are hidden. Readings, labels, and complete WARN/ERROR messages remain visible.', options: { veil: 'blank', stagger: 120 }, body: revealBlock, fixed: bayBlock, plainVisible: true },
  ],
});

const DRAW_IN = motionStory({
  id: 'draw-in',
  fn: 'drawIn',
  title: 'DRAW-IN',
  summary: "A one-shot front writing the block left to right, as status-bar's USG row boots. Use it only while a block appears.",
  motion: drawIn,
  defaults: DRAW_IN_DEFAULTS,
  units: { tick: 'ms', cells: 'cells', lag: 'ms' },
  duration: drawInDuration,
  frame: (o) => o.tick,
  rules: [
    'Cells past the front are blank; the cells just behind it latch black on acid; the rest are settled.',
    'drawInDuration(lines, options) gives when every line is settled; then the output equals the input.',
    'State cells are always exempt and show settled. Keep essential readings outside it.',
    'Motion-off is the settled block at once.',
  ],
  variants: [
    { name: 'ROW BOOT', note: 'A USG provider column: each line trails the one above by 50 ms; 60 cells a second.', options: {}, body: usage, plainVisible: true },
    { name: 'TOGETHER', note: 'lag 0 starts both lines together.', options: { lag: 0 }, body: usage, plainVisible: true },
  ],
});

const WARM_UP = motionStory({
  id: 'warm-up',
  fn: 'warmUp',
  title: 'WARM-UP',
  summary: 'A one-shot phosphor warm-up: each cell steps from the field to its settled ink. Characters and backgrounds are current from the first frame.',
  motion: warmUp,
  defaults: WARM_UP_DEFAULTS,
  units: { step: 'ms' },
  duration: (lines, o) => warmUpDuration(o),
  frame: (o) => grid(o.step, ...o.delays.map((d) => d.delay)),
  rules: [
    'Four steps of `step` ms: 25, 50, and 75% of the settled ink over the field, then settled.',
    'delays stagger regions; warmUpDuration(options) is the longest delay plus three steps.',
    'With stateCells: true, state cells start at their first visible step, never hidden.',
    'Motion-off is the settled block.',
  ],
  variants: [
    { name: 'TATSU STAGGER', note: "status-bar's stagger: each part 150 ms after the last; shape, then code, then label. State cells opted in.", options: { delays: TATSU_DELAYS, stateCells: true }, body: chips(TATSU) },
    { name: 'STATE EXEMPT', note: 'Defaults: everything warms at once, and the warning cells stay settled.', options: {}, body: chips(TATSU) },
  ],
});

const LATCH = motionStory({
  id: 'latch',
  fn: 'latch',
  title: 'LATCH',
  summary: 'A one-shot state-change latch: locked black on acid, then inverted, then settled. Characters never change.',
  motion: latch,
  defaults: LATCH_DEFAULTS,
  units: { lock: 'ms', invert: 'ms' },
  duration: (lines, o) => latchDuration(o),
  frame: (o) => grid(o.lock, o.invert),
  rules: [
    'lock ms locked, then invert ms with foreground and background swapped; latchDuration = lock + invert.',
    'With stateCells: true, the lock briefly replaces a state color with acid; shape and word stay readable.',
    'Deciding when a change latches belongs to the host.',
    'Motion-off is the settled block.',
  ],
  variants: [
    { name: 'STATE CHANGE', note: "The shape, gap, and code of a behind chip, as status-bar latches them: 150 ms.", options: { region: { top: 0, left: 5, rows: 1, cols: 6 }, stateCells: true }, body: chips(TATSU) },
    { name: 'SLOW', note: 'A longer lock and inversion on the OK chip, to see each phase.', options: { lock: 400, invert: 600, region: { top: 0, left: 19, rows: 1, cols: 4 } }, body: chips(TATSU) },
  ],
});

const BEACON = motionStory({
  id: 'beacon',
  fn: 'beacon',
  title: 'BEACON',
  summary: 'A looping attention beacon on warning triangles: a short three-step pulse at the end of each period.',
  motion: beacon,
  defaults: BEACON_DEFAULTS,
  units: { period: 'ms', step: 'ms' },
  loop: (o) => o.period,
  frame: (o) => o.step,
  rules: [
    'Only the triangle size and ink change; a period never opens on a pulse, so time 0 is settled.',
    'Tatsu triangles are warning cells, so pass stateCells: true.',
    'It targets every triangle in the region: pass only cells that need attention.',
    'Motion-off is the settled triangle.',
  ],
  variants: [
    { name: 'ATTENTION', note: 'Behind and repair chips: one 150 ms pulse every 4 s.', options: { stateCells: true }, body: chips(ATTENTION), plainVisible: true },
    { name: 'FAST', note: 'period 600: a pulse every 0.6 s, to see the steps.', options: { period: 600, stateCells: true }, body: chips(ATTENTION), plainVisible: true },
  ],
});

const CYCLE = motionStory({
  id: 'cycle',
  fn: 'cycle',
  title: 'CYCLE',
  summary: 'A looping glyph placeholder: matching cells step through a glyph sequence. Only the glyph changes.',
  motion: cycle,
  defaults: CYCLE_DEFAULTS,
  units: { step: 'ms' },
  loop: (o) => o.step * o.glyphs.length,
  frame: (o) => o.step,
  rules: [
    'Cells whose character is in glyphs show glyphs[floor(time / step) % length]; others never change.',
    'Letters and digits are never in the sequence, so codes stay readable.',
    'State cells are always exempt.',
    'Motion-off is the input glyph.',
  ],
  variants: [
    { name: 'CHECKING', note: "Checking chips' dots: a step every 150 ms, 750 ms per cycle.", options: {}, body: chips(CHECKING), plainVisible: true },
    { name: 'SLOW', note: 'step 400.', options: { step: 400 }, body: chips(CHECKING), plainVisible: true },
  ],
});

const FADE = motionStory({
  id: 'fade',
  fn: 'fade',
  title: 'FADE',
  summary: "A looping ink wave: matching cells step through a gentle triangle of greys, status-bar's check fade.",
  motion: fade,
  defaults: FADE_DEFAULTS,
  units: { period: 'ms' },
  loop: (o) => o.period,
  frame: (o) => o.period / o.levels.length,
  rules: [
    'Cells match by foreground role and region; the period splits evenly over the levels.',
    'Adjacent levels differ only slightly; there is no polarity change.',
    'warning and critical in roles throw; state cells are always exempt.',
    'Motion-off is the input ink.',
  ],
  variants: [
    { name: 'CHECK FADE', note: 'Defaults over checking chips: every decorative cell, a step every 150 ms.', options: {}, body: chips(CHECKING) },
    { name: 'CODES ONLY', note: 'region limits the wave to the first CHK code.', options: { region: { top: 0, left: 7, rows: 1, cols: 3 } }, body: chips(CHECKING) },
  ],
});

const LAMP_CELL = { top: 0, left: 0, rows: 1, cols: 1 };
const ICON_CELL = { top: 0, left: 2, rows: 1, cols: 1 };
const BLINK = motionStory({
  id: 'blink',
  fn: 'blink',
  title: 'BLINK',
  summary: 'A looping blink: on in the input style, then off in a merged style and optional glyph. The input is the settled, lit frame.',
  motion: blink,
  defaults: BLINK_DEFAULTS,
  units: { on: 'ms', off: 'ms' },
  loop: (o) => o.on + o.off,
  frame: (o) => grid(o.on, o.off),
  rules: [
    'offGlyph replaces any character that is not a letter or digit; state cells are always exempt.',
    'The activity light toggles every 50 ms: 10 lit onsets a second on one cell, faster than three flashes a second. No photosensitivity claim is made.',
    'Motion-off is the input, the lit frame.',
    'The host decides whether to run it: only a working lamp or an active mode blinks.',
  ],
  variants: [
    {
      name: 'ROOT LAMP',
      note: "The working lamp in a thread rail: 500 ms lit, 300 ms dim, 1.25 cycles a second. The lamp's own dim style replaces the preset's, which assumes a blank cell.",
      options: { ...BLINK_PRESETS.lamp, region: LAMP_CELL },
      shown: { ...spread('BLINK_PRESETS.lamp'), region: LAMP_CELL },
      body: rail,
    },
    {
      name: 'ACTIVITY LIGHT',
      note: 'The PNYTL activity light: pink dot and icon alternate every 50 ms, 10 lit onsets a second.',
      options: { ...BLINK_PRESETS.activityLight, region: ICON_CELL },
      shown: { ...spread('BLINK_PRESETS.activityLight'), region: ICON_CELL },
      body: () => one(pnytlPlate('lite', { active: true }), call('pnytlPlate', 'lite', { active: true })),
      plainVisible: true,
    },
  ],
});

const flashVariant = (preset, name, note, plate, stateCells) => ({
  name,
  note,
  options: { ...FLASH_PRESETS[preset], ...(stateCells ? { stateCells } : {}) },
  shown: { ...spread(`FLASH_PRESETS.${preset}`), ...(stateCells ? { stateCells } : {}) },
  body: plate,
});
const FLASH = motionStory({
  id: 'flash',
  fn: 'flash',
  title: 'FLASH',
  summary: 'A one-shot flash through a pattern of fill, outline, invert, and white steps, then settled. Characters never change.',
  motion: flash,
  defaults: FLASH_DEFAULTS,
  units: { step: 'ms' },
  duration: (lines, o) => flashDuration(o),
  frame: (o) => o.step,
  rules: [
    'pattern[floor(time / step)] picks the look; flashDuration = pattern length x step.',
    'THRESHOLD flashes white three times in 300 ms, 10 a second; INTERRUPT changes the whole plate twice in 160 ms. No photosensitivity claim is made.',
    'State cells are exempt by default; an alarm on them passes stateCells: true and stays readable.',
    'Motion-off is the settled block.',
  ],
  variants: [
    flashVariant('interrupt', 'INTERRUPT', 'The claude-interrupt plate: filled, unfilled for 80 ms, filled: 160 ms.', () => one(markerPlate('live'), call('markerPlate', 'live'))),
    flashVariant('threshold', 'THRESHOLD', "status-bar's 70/90 mark: three 50 ms white flashes, one every 100 ms, on a warning plate.", () => one(labelPlate('WARN 70', { tone: 'warning' }), call('labelPlate', 'WARN 70', { tone: 'warning' })), true),
    flashVariant('polarity', 'POLARITY', "The CMP plate at boot: one swap of its colors for 100 ms.", () => one(countPlate(4, COUNT_PLATES.compactions), call('countPlate', 4, code('COUNT_PLATES.compactions')))),
    flashVariant('tag', 'TAG', 'The readout tag during a tone wipe: two 100 ms inversions in 350 ms.', () => one(labelPlate('72.0 %', { tone: 'bright', form: 'slab' }), call('labelPlate', '72.0 %', { tone: 'bright', form: 'slab' }))),
  ],
});

const bars = () => one(markerBars('lit'), call('markerBars', 'lit'));
const PING = motionStory({
  id: 'ping',
  fn: 'ping',
  title: 'PING',
  summary: 'Stationary bars launch left to right in acid, turn grey, and disappear, then repeat once. Nothing moves; the bars are not progress.',
  motion: ping,
  defaults: PING_DEFAULTS,
  units: { launch: 'ms', stagger: 'ms', ghostAt: 'ms', ghostFor: 'ms', repeatAfter: 'ms', frame: 'ms' },
  duration: pingDuration,
  frame: (o) => o.frame,
  rules: [
    'Supply only a bar decoration; labels and readings must never be passed as bars.',
    'Frames are quantized to a 40 ms grid: 25 steps a second.',
    'Motion-off returns the input unchanged; the settled marker has no bar row, so a host drops the line instead.',
    'pingDuration(lines) is the last disappearance: 1520 ms for the seven marker bars.',
  ],
  variants: [
    { name: 'MARKER PING', note: 'The seven DIRECTIVE UPDATED bars: two launches 720 ms apart.', options: {}, body: bars, plainVisible: true },
    { name: 'SINGLE', note: 'repeats 0: one launch, done at 800 ms.', options: { repeats: 0 }, body: bars, plainVisible: true },
  ],
});

const WIPE = motionStory({
  id: 'wipe',
  fn: 'wipe',
  title: 'WIPE',
  summary: 'A stepped style settle: cells not yet reached show fromStyle; the input carries the settled style. Every character is kept.',
  motion: wipe,
  defaults: WIPE_DEFAULTS,
  units: {},
  duration: (lines, o) => wipeDuration(o),
  frame: (o) => grid(...o.times),
  rules: [
    'Each step settles ceil(width x fraction) cells: 8, 16, then all 19 of the record plate at 2800, 2880, and 2960 ms.',
    'Before the first step every cell shows fromStyle, the live plate.',
    'State cells are exempt, with no opt-in.',
    'At completion and with motion off the output equals the input.',
  ],
  variants: [
    { name: 'SETTLE', note: 'The record plate settling right to left from the live style, as claude-interrupt does.', options: {}, body: () => one(markerPlate('record'), call('markerPlate', 'record')) },
    { name: 'LEFT TO RIGHT', note: "direction ltr, on a faster schedule.", options: { direction: 'ltr', times: [400, 480, 560] }, body: () => one(markerPlate('record'), call('markerPlate', 'record')) },
  ],
});

const FILL_IN = motionStory({
  id: 'fill-in',
  fn: 'fillIn',
  title: 'FILL-IN',
  summary: "USG's cell latch: squares are grey before their tick, white on it, then their settled ink. Characters never change.",
  motion: fillIn,
  defaults: FILL_IN_DEFAULTS,
  units: { tick: 'ms', window: 'cells' },
  duration: fillInDuration,
  frame: (o) => o.tick,
  rules: [
    'Windows of equal width latch in parallel, one cell per tick: 400 ms for eight squares.',
    'Supply only squares; split unequal windows into separate calls so gaps and tags do not latch.',
    'State cells are exempt. Keep essential readings and countdowns outside it.',
    'Motion-off equals the input.',
  ],
  variants: [
    { name: 'EIGHT SQUARES', note: 'A CLD meter, 62.5% remaining: 20 latch steps a second.', options: { region: SQUARES }, body: meter(62.5, 'cld') },
    { name: 'SLOW TICK', note: 'tick 150 on a GPT meter.', options: { tick: 150, region: SQUARES }, body: meter(62.5, 'gpt') },
  ],
});

const LOST = { top: 0, left: 4, rows: 1, cols: 2 }; // the two squares just lost, of eight at 50% remaining
const burnVariant = (provider, name) => ({
  name,
  note: `${name} squares 5 and 6 just lost: white, lit, 50%, 20%, then the ghost grey. A reference decoration that briefly overstates quota.`,
  options: { ...BURN_OUT_PRESETS[provider], region: LOST },
  shown: { ...spread(`BURN_OUT_PRESETS.${provider}`), region: LOST },
  body: meter(50, provider),
});
const BURN_OUT = motionStory({
  id: 'burn-out',
  fn: 'burnOut',
  title: 'BURN-OUT',
  summary: 'A one-shot burn of lost squares only, through white, lit, mid, and used inks to their settled ghost grey. Only color changes.',
  motion: burnOut,
  defaults: BURN_OUT_DEFAULTS,
  units: {},
  duration: (lines, o) => burnOutDuration(o),
  frame: (o) => grid(...o.times),
  rules: [
    'The input is the settled ghost ink; region selects only the newly lost squares.',
    'Four phases in 600 ms by default; then the output equals the input.',
    'It does not detect quota loss: the host passes lost cells and settles interrupted effects.',
    'It briefly shows lost quota as lit: label it a demonstration until live acceptance.',
  ],
  variants: [burnVariant('gpt', 'GPT'), burnVariant('cld', 'CLD'), burnVariant('kmi', 'KMI')],
});

const EDGE_PULSE = motionStory({
  id: 'edge-pulse',
  fn: 'edgePulse',
  title: 'EDGE PULSE',
  summary: 'A size-only pulse on the highest lit square, on a period set by the remaining fraction. Every other glyph stays.',
  motion: edgePulse,
  defaults: EDGE_PULSE_DEFAULTS,
  units: { period: 'ms', step: 'ms' },
  loop: (o) => o.period ?? 600 + 3400 * o.fraction,
  frame: (o) => o.step,
  rules: [
    'Period is 600 + 3400 x fraction ms unless given; three 50 ms steps end each period, so time 0 is settled.',
    'The caller supplies the true fraction and the provider inks; lit must match the settled squares.',
    'State cells are exempt and never become the edge.',
    'Motion-off equals the input.',
  ],
  variants: [
    { name: 'MOST LEFT', note: 'fraction 0.625: a pulse every 2.725 s.', options: { fraction: 0.625, region: SQUARES }, body: meter(62.5, 'gpt'), plainVisible: true },
    { name: 'NEARLY GONE', note: 'fraction 0.125: a pulse every 1.025 s.', options: { fraction: 0.125, region: SQUARES }, body: meter(12.5, 'gpt'), plainVisible: true },
  ],
});

const RESTRIKE = motionStory({
  id: 'restrike',
  fn: 'restrike',
  title: 'RESTRIKE',
  summary: 'A finite, seeded surface re-stamp of one plate or panel patch. Characters never change, including padding.',
  motion: restrike,
  defaults: RESTRIKE_DEFAULTS,
  units: { tick: 'ms' },
  duration: restrikeDuration,
  frame: (o) => o.tick,
  rules: [
    'The same seed always gives the same programme; the seed is shown in the call.',
    'restrikeDuration(lines, options) depends on the seeded plan; then the output equals the input.',
    'The host chooses patches and schedules events (RESTRIKE_WAIT, start to start); state cells are exempt.',
    'Motion-off returns the input.',
  ],
  variants: [
    { name: 'ROOT PLATE', note: 'treatment plate on the thread rail ROOT plate, seed 7.', options: { seed: 7, region: { top: 0, left: 2, rows: 1, cols: 6 } }, body: rail },
    { name: 'NUMERAL PANEL', note: 'treatment panel on a pixel numeral: block ink changes, occupancy stays. Seed 3.', options: { seed: 3, treatment: 'panel', region: { top: 0, left: 0, rows: 3, cols: 13 } }, body: (w) => body(pixelNumeral({ value: 64 }, { width: w }), call('pixelNumeral', { value: 64 }, { width: w })) },
  ],
});

const GHOST = motionStory({
  id: 'ghost',
  fn: 'ghost',
  title: 'GHOST',
  summary: 'Finite, seeded fill glitches or registration ghosts in an explicit decoration-only region.',
  motion: ghost,
  defaults: GHOST_DEFAULTS,
  units: { tick: 'ms' },
  duration: ghostDuration,
  frame: (o) => o.tick,
  rules: [
    'region is required, even with motion off; keep labels, readouts, and unfilled tracks outside it.',
    'Fill glitches touch only filled-track glyphs; letters, numbers, and spaces never change.',
    'Registration echoes land only in blank cells next to the frame geometry; the seed is shown in the call.',
    'Fill events last 100-300 ms, registration about 150 ms per echo; then the output equals the input.',
  ],
  variants: [
    {
      name: 'FILL GLITCH',
      note: "Level 3 on a gauge's filled cells only, seed 11.",
      options: { seed: 11, level: 3 },
      region: fillRegion,
      body: (w) => body(gauge(KNOWN, { width: w }), call('gauge', KNOWN, { width: w })),
      plainVisible: true,
    },
    {
      name: 'REGISTRATION',
      note: 'Corner, side, bracket, or center echoes around an instrument frame, seed 5.',
      options: { seed: 5, mode: 'registration' },
      region: (lines) => ({ top: 0, left: 0, rows: lines.length, cols: Math.max(0, ...lines.map(lineWidth)) }),
      body: (w) => body(instrumentFrame(FRAME_FIXTURE.real, { width: w }), call('instrumentFrame', FRAME_FIXTURE.shown, { width: w })),
      plainVisible: true,
    },
  ],
});

const NUDGE = motionStory({
  id: 'nudge',
  fn: 'nudge',
  title: 'NUDGE',
  summary: "A calibration slip: one marked glyph swaps one cell with a blank neighbour and returns home. Widths and readings stay intact.",
  motion: nudge,
  defaults: NUDGE_DEFAULTS,
  units: { period: 'ms', tick: 'ms' },
  loop: (o) => o.period,
  frame: (o) => o.tick,
  rules: [
    'The first matching mark is the anchor; it moves +1, +1, 0, -1, -1, 0 cells on 50 ms ticks, then rests.',
    'No move when the destination is occupied, outside the region, or state-colored.',
    'The shifted mark is bold acid; home and rest frames keep the input ink.',
    'Motion-off equals the input.',
  ],
  variants: [
    { name: 'HEADER MARK', note: "The instrument frame's center mark: a 300 ms programme every 6 s.", options: {}, body: (w) => body(instrumentFrame(NUDGE_FRAME, { width: w }), call('instrumentFrame', { header: { title: code(`[${call('span', 'CALIBRATION')}]`) } }, { width: w })), plainVisible: true },
    { name: 'FAST', note: 'period 1000, to see the programme repeat.', options: { period: 1000 }, body: (w) => body(instrumentFrame(NUDGE_FRAME, { width: w }), call('instrumentFrame', { header: { title: code(`[${call('span', 'CALIBRATION')}]`) } }, { width: w })), plainVisible: true },
  ],
});

// The DIRECTIVE UPDATED marker's whole claude-interrupt timeline, composed from three motions over the
// marker's pieces: flash on the live plate, ping on the bars (the bar row dropped once it completes), and
// wipe settling the record plate. Motion-off is the settled record row, with no bars.
const T = MARKER_TIMELINE;
const INTERRUPT_END = flashDuration(FLASH_PRESETS.interrupt);
const PING_END = pingDuration([markerBars('lit')]);
const MARKER_TIMELINE_STORY = {
  id: 'marker-timeline',
  kind: 'motion',
  title: 'MARKER TIMELINE',
  summary: "claude-interrupt's whole DIRECTIVE UPDATED timeline, composed from flash, ping, and wipe over the transcript marker's pieces.",
  module: 'examples/storybook-motions.mjs',
  contract: 'elements/transcript-marker/README.md',
  rules: [
    `Flash (interrupt) on the live plate to ${INTERRUPT_END} ms; ping on the bars, dropping the bar row at ${PING_END} ms; wipe settles the record plate from ${T.settleWipe} ms.`,
    `Settled from ${T.window} ms: the record plate with no bars. Motion-off shows it at once.`,
    'Two whole-plate flashes in the first 160 ms are a fast flash; no photosensitivity claim is made.',
    'Redrawn on the 40 ms bar grid, as the extension redraws.',
  ],
  variants: [
    { name: 'PAD 1', note: 'outputPad 1: a 19-cell plate and one blank cell at the right edge.', outputPad: 1, plainVisible: true },
    { name: 'PAD 0', note: 'outputPad 0: an 18-cell plate.', outputPad: 0, plainVisible: true },
  ],
  specimen(variant, width, { animate = false, time = 0 } = {}) {
    const w = within(width, 60);
    const inner = panelInnerWidth(w);
    const pad = { outputPad: variant.outputPad };
    const panel = (lines, expression) => ({
      lines: numberedPanel(MOTION_FRAME, lines, { width: w }),
      calls: [`frame = ${expression}`, call('numberedPanel', MOTION_FRAME, code('frame'), { width: w })],
      facts: [],
    });
    if (!animate) return panel(transcriptMarker(pad, { width: inner }), call('transcriptMarker', pad, { width: inner }));
    const plate = time < INTERRUPT_END ? flash([markerPlate('live', pad)], { ...FLASH_PRESETS.interrupt, time }) : wipe([markerPlate('record', pad)], { time });
    const marks = time < PING_END ? ping([markerBars('lit')], { time })[0] : [];
    const content = Math.max(0, inner - variant.outputPad);
    const result = panel([fitLine(fitLine([...plate[0], span(' '), ...marks], content), inner)], `[fitLine(fitLine([...plate[0], span(' '), ...bars], ${content}), ${inner})]`);
    result.calls.unshift(
      `plate = time < ${INTERRUPT_END} ? ${call('flash', code(`[${call('markerPlate', 'live', pad)}]`), { ...spread('FLASH_PRESETS.interrupt'), time: code('time') })} : ${call('wipe', code(`[${call('markerPlate', 'record', pad)}]`), { time: code('time') })}`,
      `bars = time < ${PING_END} ? ${call('ping', code(`[${call('markerBars', 'lit')}]`), { time: code('time') })}[0] : []`,
    );
    return result;
  },
  duration: () => T.window,
  loop: () => null,
  frameMs: () => T.barFrame,
};

export const MOTION_STORIES = [SCAN, PULSE, REVEAL, DRAW_IN, WARM_UP, LATCH, BEACON, CYCLE, FADE, BLINK, FLASH, PING, WIPE, FILL_IN, BURN_OUT, EDGE_PULSE, RESTRIKE, GHOST, NUDGE, MARKER_TIMELINE_STORY];
