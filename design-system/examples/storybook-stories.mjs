// Storybook catalog: the four elements and three motions, each with named state or example variants,
// then the IndustrialOS colors as a foundation story with named views. Pure and I/O-free. Every specimen
// comes from the real renderer, motion, or foundation data; the usage text is built from the same
// arguments that drew it, so what the storybook shows is what the call returns. Element and motion
// values are labeled demonstration fixtures.
import { fitLine, lineWidth, span } from '../foundation/cells.mjs';
import { labelPlate } from '../elements/label-plate/label-plate.mjs';
import { numberedPanel, panelInnerWidth } from '../elements/numbered-panel/numbered-panel.mjs';
import { gauge, gaugeScale } from '../elements/gauge/gauge.mjs';
import { statusRow } from '../elements/status-row/status-row.mjs';
import { scan, SCAN_DEFAULTS } from '../motions/scan.mjs';
import { pulse, PULSE_DEFAULTS } from '../motions/pulse.mjs';
import { reveal, revealDuration, REVEAL_DEFAULTS } from '../motions/reveal.mjs';
import { COLOR_STORY } from './storybook-colors.mjs';

// Source text for a call, from the same values passed to it. code('body') stands for a variable.
const CODE = Symbol('code');
const code = (text) => ({ [CODE]: text });
function literal(value) {
  if (value !== null && typeof value === 'object' && CODE in value) return value[CODE];
  if (typeof value === 'string') return `'${value.replace(/[\\']/g, '\\$&')}'`;
  if (Array.isArray(value)) return `[${value.map(literal).join(', ')}]`;
  if (value !== null && typeof value === 'object') {
    // A code value named like its key uses shorthand: { time } rather than { time: time }.
    const entries = Object.entries(value).map(([k, v]) => (v?.[CODE] === k ? k : `${k}: ${literal(v)}`));
    return entries.length ? `{ ${entries.join(', ')} }` : '{}';
  }
  return String(value);
}
const call = (name, ...args) => `${name}(${args.map(literal).join(', ')})`;

// Specimens keep to a readable width, never wider than the cells they are given.
const within = (width, preferred) => Math.min(width, preferred);
const stackedOrInline = (lines) => (lines.length > 1 ? 'stacked' : 'inline');

const panelForm = (width) => (panelInnerWidth(width) === width ? 'compact' : 'full');
const PANEL_VARIANTS = [
  { name: 'FULL', note: '40 cells or more: plate in the top border, rails, and corners.', panel: { number: 3, title: 'GAUGES', meta: '1/8-CELL FILL' }, width: 48 },
  { name: 'COMPACT', note: 'Below 40 cells: only the numbered header rule; the body keeps the full width.', panel: { number: 3, title: 'GAUGES', meta: '1/8-CELL FILL' }, width: 36 },
  { name: 'HEADER PRIORITY', note: 'Short of space, the meta note goes first, then the title truncates.', panel: { number: 12, title: 'CALIBRATION SEQUENCE', meta: 'ROUTE B, 3 STAGES' }, width: 24 },
  { name: 'FIXED HEIGHT', note: 'height pads or clips the body so neighboring panels align.', panel: { number: 4, title: 'STATUS', meta: 'HEIGHT 6' }, width: 48, height: 6 },
];

const PLATE_VARIANTS = [
  { name: 'ACCENT', note: 'Identity emphasis for a section or fixture name.', text: 'SECTOR 7', options: { tone: 'accent' } },
  { name: 'NEUTRAL', note: 'Supporting identifier.', text: 'MANIFEST', options: { tone: 'neutral' } },
  { name: 'WARNING', note: 'Tone is emphasis only: the word WARN carries the state.', text: 'WARN HEAT', options: { tone: 'warning' } },
  { name: 'CRITICAL', note: 'Tone is emphasis only: the word FAULT carries the state.', text: 'FAULT E21', options: { tone: 'critical' } },
  { name: 'UNPADDED', note: 'pad: false for inline numbers and IDs.', text: '01', options: { tone: 'accent', pad: false } },
  { name: 'TRUNCATED', note: 'maxWidth truncates the text with an ellipsis before dropping padding.', text: 'CALIBRATION RUN', options: { maxWidth: 12 } },
];

const GAUGE_VARIANTS = [
  { name: 'KNOWN', note: 'Accent fill on a dark track; white readout.', input: { label: 'KNOWN', value: 64 } },
  { name: 'ZERO', note: 'A known zero: empty track and 0.0 %.', input: { label: 'ZERO', value: 0 } },
  { name: 'FULL', note: 'Fills every cell only when value equals max.', input: { label: 'FULL', value: 100 } },
  { name: 'UNKNOWN', note: 'null is unknown: hatched track and UNKNOWN, never an empty bar.', input: { label: 'UNKNOWN', value: null } },
  { name: 'RANGE', note: 'Custom max, unit, and decimals; the readout truncates, never rounds up.', input: { label: 'FLOW', value: 7.25, max: 12, unit: 'L/m', decimals: 2 } },
  { name: 'STACKED', note: 'When the bar would get under 8 cells, label and readout sit above it.', input: { label: 'FILL', value: 42.5 }, width: 20 },
];

const ROW_VARIANTS = [
  { name: 'NEUTRAL', note: 'Informational state.', input: { label: 'MODE', value: 'specimen idle', status: 'neutral' } },
  { name: 'SUCCESS', note: 'Accent marker; the word OK carries the state.', input: { label: 'DOOR', value: 'closed', status: 'success' } },
  { name: 'WARNING', note: 'Warning marker and word.', input: { label: 'FEED', value: '2 specimen retries', status: 'warning' } },
  { name: 'ERROR', note: 'Critical marker and word.', input: { label: 'PARSE', value: 'specimen parse failed', status: 'error' } },
  { name: 'UNAVAILABLE', note: 'value null renders --; the row never invents a value.', input: { label: 'LINK', value: null, status: 'unavailable' } },
  { name: 'STACKED', note: 'Under 6 value cells, the value moves to an indented second line.', input: { label: 'DOOR', value: 'closed', status: 'success' }, width: 22 },
];

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

const MOTION_FRAME = { number: 1, title: 'BAY 04', meta: 'DEMONSTRATION' };

// A motion preview: fixture lines from real renderers, decorated by the real motion, framed by a still
// numbered panel (the motion runs on the body only).
function motionStory({ id, title, summary, motion, defaults, units, rules, variants, duration }) {
  return {
    id,
    kind: 'motion',
    title,
    summary,
    module: `motions/${id}.mjs`,
    contract: 'motions/README.md',
    rules,
    variants,
    motion: { name: id, defaults, units, defaultsName: `${id.toUpperCase()}_DEFAULTS` },
    specimen(variant, width, { animate = false, time = 0 } = {}) {
      const w = within(width, 60);
      const body = variant.body(panelInnerWidth(w));
      const options = animate ? { ...variant.options, time: code('time') } : { ...variant.options, animate: false };
      const frame = motion(body.lines, { ...variant.options, animate, time });
      const fixed = variant.fixed?.(panelInnerWidth(w), 'readings');
      return {
        lines: numberedPanel(MOTION_FRAME, [...frame, ...(fixed?.lines ?? [])], { width: w }),
        calls: [...body.calls, `frame = ${call(id, code('body'), options)}`, ...(fixed?.calls ?? []), call('numberedPanel', MOTION_FRAME, code(fixed ? '[...frame, ...readings]' : 'frame'), { width: w })],
        facts: [],
      };
    },
    // Total ms of a finite motion at this width, or null for one that loops until paused.
    duration(variant, width) {
      if (!duration) return null;
      return duration(variant.body(panelInnerWidth(within(width, 60))).lines.length, variant.options);
    },
  };
}

export const STORIES = Object.freeze([
  {
    id: 'numbered-panel',
    kind: 'component',
    title: 'NUMBERED PANEL',
    summary: 'A bounded frame that gives a group of content a number, title, and optional meta note.',
    module: 'elements/numbered-panel/numbered-panel.mjs',
    contract: 'elements/numbered-panel/README.md',
    rules: [
      'number is an integer 0-99, shown with two digits; title and meta are strings.',
      'Render the body at panelInnerWidth(width) so nothing is clipped.',
      'Corners and rails are decorative grey; they carry no meaning.',
      'Invalid number, width, or height throws RangeError.',
    ],
    variants: PANEL_VARIANTS,
    specimen(variant, width) {
      const w = within(width, variant.width);
      const inner = panelInnerWidth(w);
      const row = ROW_VARIANTS[1].input;
      const body = statusRow(row, { width: inner });
      const layout = variant.height === undefined ? { width: w } : { width: w, height: variant.height };
      return {
        lines: numberedPanel(variant.panel, body, layout),
        calls: [`body = ${call('statusRow', row, { width: code(`panelInnerWidth(${w})`) })}`, call('numberedPanel', variant.panel, code('body'), layout)],
        facts: [`FORM ${panelForm(w)} at ${w} cells; body width ${inner}`],
      };
    },
  },
  {
    id: 'label-plate',
    kind: 'component',
    title: 'LABEL PLATE',
    summary: 'A compact informational identifier. It is not a button: no brackets, focus, key hint, or action.',
    module: 'elements/label-plate/label-plate.mjs',
    contract: 'elements/label-plate/README.md',
    rules: [
      'Returns spans for the caller to place in a line.',
      'Width is the text plus 2 cap cells, plus 2 when padded.',
      'tone is accent, neutral, warning, or critical; anything else throws RangeError.',
      'Warning and critical plates must say so in words.',
    ],
    variants: PLATE_VARIANTS,
    specimen(variant, width) {
      // Never cut a plate through its middle: below its natural width, let the renderer truncate it.
      const natural = lineWidth(labelPlate(variant.text, variant.options));
      const options = natural > width ? { ...variant.options, maxWidth: Math.min(variant.options.maxWidth ?? width, width) } : variant.options;
      const plate = labelPlate(variant.text, options);
      return { lines: [fitLine(plate, width)], calls: [call('labelPlate', variant.text, options)], facts: [`WIDTH ${lineWidth(plate)} cells`] };
    },
  },
  {
    id: 'gauge',
    kind: 'component',
    title: 'GAUGE',
    summary: 'A horizontal, calibrated reading of one value from 0 to max, with a strong numeric readout.',
    module: 'elements/gauge/gauge.mjs',
    contract: 'elements/gauge/README.md',
    rules: [
      'value null or undefined is unknown and never becomes zero.',
      'Out-of-range, NaN, infinite, or non-number values throw RangeError; nothing is clamped.',
      'Fill floors to 1/8 cell and the readout never rounds up.',
      'A readout that cannot fit shows # rather than a partial number.',
    ],
    variants: GAUGE_VARIANTS,
    specimen(variant, width) {
      const opts = { width: within(width, variant.width ?? 56) };
      const { label, value, ...range } = variant.input;
      const lines = gauge(variant.input, opts);
      return {
        lines: [...lines, gaugeScale(range, opts)],
        calls: [call('gauge', variant.input, opts), call('gaugeScale', range, opts)],
        facts: [`FORM ${stackedOrInline(lines)} at ${opts.width} cells`],
      };
    },
  },
  {
    id: 'status-row',
    kind: 'component',
    title: 'STATUS ROW',
    summary: 'One aligned line of label, value, and state. It shows the state the caller supplies and checks nothing itself.',
    module: 'elements/status-row/status-row.mjs',
    contract: 'elements/status-row/README.md',
    rules: [
      'status is neutral, success, warning, error, or unavailable; anything else throws RangeError.',
      'Every state has its own marker and word, so it reads the same without color.',
      'The value column takes the remaining width and truncates with an ellipsis.',
    ],
    variants: ROW_VARIANTS,
    specimen(variant, width) {
      const opts = { width: within(width, variant.width ?? 56) };
      const lines = statusRow(variant.input, opts);
      return { lines, calls: [call('statusRow', variant.input, opts)], facts: [`FORM ${stackedOrInline(lines)} at ${opts.width} cells`] };
    },
  },
  motionStory({
    id: 'scan',
    title: 'SCAN',
    summary: 'A highlight band sweeping across rendered lines. It changes only foreground styling, never a character.',
    motion: scan,
    defaults: SCAN_DEFAULTS,
    units: { period: 'ms', band: 'cells' },
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
  }),
  motionStory({
    id: 'pulse',
    title: 'PULSE',
    summary: 'Matching cells alternate between their own style and dim grey. Use it only where a signal really is active.',
    motion: pulse,
    defaults: PULSE_DEFAULTS,
    units: { period: 'ms' },
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
  }),
  motionStory({
    id: 'reveal',
    title: 'REVEAL',
    summary: 'A one-shot left-to-right wipe for decorative content. Essential readings and complete status rows stay outside it.',
    motion: reveal,
    defaults: REVEAL_DEFAULTS,
    units: { duration: 'ms', stagger: 'ms' },
    duration: revealDuration,
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
  }),
  COLOR_STORY,
]);

// A motion preview is only worth running when its frames differ in the current color mode. Scan, pulse,
// and the dim reveal change color only; a plain view would redraw identical text.
export function canPlay(story, variant, mode) {
  return story.kind === 'motion' && (mode === 'TRUECOLOR' || variant.plainVisible === true);
}

// Parameter rows for a motion example: each option's value here and its exported default.
export function motionParameters(story, variant) {
  const { defaults, units } = story.motion;
  return Object.keys(defaults).map((name) => {
    const value = variant.options[name] ?? defaults[name];
    const unit = units[name] ? ` ${units[name]}` : '';
    return { name, value: `${literal(value)}${unit}`, defaultValue: `${literal(defaults[name])}${unit}`, set: Object.hasOwn(variant.options, name) };
  });
}
