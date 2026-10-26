// Element stories: each element with named state variants. Pure and I/O-free. Every specimen comes from
// the real renderer, and its usage text is built from the same arguments that drew it. Values are labeled
// demonstration fixtures, many modeled on the Pi extensions' own fixtures in the element READMEs.
import { fitLine, lineWidth, span } from '../foundation/cells.mjs';
import { labelPlate } from '../elements/label-plate/label-plate.mjs';
import { numberedPanel, panelInnerWidth } from '../elements/numbered-panel/numbered-panel.mjs';
import { gauge, gaugeScale } from '../elements/gauge/gauge.mjs';
import { statusRow } from '../elements/status-row/status-row.mjs';
import { COUNT_PLATES, countPlate } from '../elements/count-plate/count-plate.mjs';
import { lamp } from '../elements/lamp/lamp.mjs';
import { modePlate, pnytlPlate } from '../elements/mode-plate/mode-plate.mjs';
import { SURFACE_PALETTE } from '../foundation/surface-palette.mjs';
import { stateChip, stateChips } from '../elements/state-chip/state-chip.mjs';
import { numeralAt, numeralGrid, numeralLines, pixelNumeral } from '../elements/pixel-numeral/pixel-numeral.mjs';
import { providerColumn, segmentMeter } from '../elements/segment-meter/segment-meter.mjs';
import { threadRail, threadRailPieces } from '../elements/thread-rail/thread-rail.mjs';
import { frameGeometry, instrumentFrame } from '../elements/instrument-frame/instrument-frame.mjs';
import { transcriptMarker } from '../elements/transcript-marker/transcript-marker.mjs';
import { lineMeter } from '../elements/line-meter/line-meter.mjs';
import { columnBlock } from '../elements/column-block/column-block.mjs';
import { tabRule, leader, neatline, nameRule } from '../elements/tab-rule/tab-rule.mjs';
import { actionLabel, keyHints } from '../elements/action-label/action-label.mjs';
import { popupHeader, popupFooter } from '../elements/popup-header/popup-header.mjs';
import { noticeRow } from '../elements/notice-row/notice-row.mjs';
import { scopeMeter } from '../elements/scope-meter/scope-meter.mjs';
import { soundingMeter } from '../elements/sounding-meter/sounding-meter.mjs';
import { feedBezel, imageLabel, imageInset } from '../elements/feed-bezel/feed-bezel.mjs';
import { inputFrame } from '../elements/input-frame/input-frame.mjs';
import { call, code } from './storybook-usage.mjs';

// Specimens keep to a readable width, never wider than the cells they are given.
export const within = (width, preferred) => Math.min(width, preferred);
const stackedOrInline = (lines) => (lines.length > 1 ? 'stacked' : 'inline');

const element = (id, fields) => ({ id, kind: 'component', module: `elements/${id}/${id}.mjs`, contract: `elements/${id}/README.md`, ...fields });

// An inline piece is never cut through its middle: below its natural width, the renderer's own maxWidth
// bounds it, and the usage says so. `shown` are the call's leading arguments as source.
function piece(name, render, shown, options, width) {
  const natural = lineWidth(render(options));
  const opts = natural > width ? { ...options, maxWidth: Math.min(options.maxWidth ?? width, width) } : options;
  const spans = render(opts);
  const args = Object.keys(opts).length ? [...shown, opts] : shown;
  return { lines: [fitLine(spans, width)], calls: [call(name, ...args)], facts: [`WIDTH ${lineWidth(spans)} cells`] };
}

const panelForm = (width) => (panelInnerWidth(width) === width ? 'compact' : 'full');
export const ROW_VARIANTS = [
  { name: 'NEUTRAL', note: 'Informational state.', input: { label: 'MODE', value: 'specimen idle', status: 'neutral' } },
  { name: 'SUCCESS', note: 'Accent marker; the word OK carries the state.', input: { label: 'DOOR', value: 'closed', status: 'success' } },
  { name: 'WARNING', note: 'Warning marker and word.', input: { label: 'FEED', value: '2 specimen retries', status: 'warning' } },
  { name: 'ERROR', note: 'Critical marker and word.', input: { label: 'PARSE', value: 'specimen parse failed', status: 'error' } },
  { name: 'UNAVAILABLE', note: 'value null renders --; the row never invents a value.', input: { label: 'LINK', value: null, status: 'unavailable' } },
  { name: 'STACKED', note: 'Under 6 value cells, the value moves to an indented second line.', input: { label: 'DOOR', value: 'closed', status: 'success' }, width: 22 },
];

// status-bar's framed footer, from caller content (the instrument frame README's fixture). `real` is what the
// frame draws; `shown` is the same input as source for the usage text.
const ACTIVITY = { working: true, units: 3 };
const FRAME_TEXT = { title: '■ owner/repo · PR #42', cwd: 'cwd /launch unrelated', act: '⑂ feature/ui modified', mdl: 'provider/model · thinking high', ext: ['Other status', 'Ponytail: ready'] };
const slab = (text, tone) => labelPlate(text, { form: 'slab', tone });
const slabCode = (text, tone) => code(call('labelPlate', text, tone ? { form: 'slab', tone } : { form: 'slab' }));
const spansCode = (...args) => `[${call('span', ...args)}]`; // one line of one span
export const FRAME_FIXTURE = {
  real: {
    header: { plate: countPlate(12, COUNT_PLATES.compactions), title: [span(FRAME_TEXT.title)], aside: [threadRailPieces(ACTIVITY), threadRailPieces(ACTIVITY, { marks: false })] },
    spacer: [[span(FRAME_TEXT.cwd, { fg: 'secondary' })]],
    rows: [
      { plate: slab('01 ACT', 'accent'), lines: [[span(FRAME_TEXT.act)]] },
      { plate: slab('03 MDL', 'bright'), lines: [[span(FRAME_TEXT.mdl, { bg: 'surface' })]], bg: 'surface' },
      { plate: slab('05 EXT'), lines: FRAME_TEXT.ext.map((t) => [span(t)]) },
    ],
  },
  shown: {
    header: {
      plate: code(call('countPlate', 12, code('COUNT_PLATES.compactions'))),
      title: code(spansCode(FRAME_TEXT.title)),
      aside: code(`[${call('threadRailPieces', ACTIVITY)}, ${call('threadRailPieces', ACTIVITY, { marks: false })}]`),
    },
    spacer: code(`[${spansCode(FRAME_TEXT.cwd, { fg: 'secondary' })}]`),
    rows: [
      { plate: slabCode('01 ACT', 'accent'), lines: code(`[${spansCode(FRAME_TEXT.act)}]`) },
      { plate: slabCode('03 MDL', 'bright'), lines: code(`[${spansCode(FRAME_TEXT.mdl, { bg: 'surface' })}]`), bg: 'surface' },
      { plate: slabCode('05 EXT'), lines: code(`[${FRAME_TEXT.ext.map((t) => spansCode(t)).join(', ')}]`) },
    ],
  },
};

const PANEL = element('numbered-panel', {
  title: 'NUMBERED PANEL',
  summary: 'A bounded frame that gives a group of content a number, title, and optional meta note.',
  rules: [
    'number is an integer 0-99, shown with two digits; title and meta are strings.',
    'Render the body at panelInnerWidth(width) so nothing is clipped.',
    'Corners and rails are decorative grey; they carry no meaning.',
    'Invalid number, width, or height throws RangeError.',
  ],
  variants: [
    { name: 'FULL', note: '40 cells or more: plate in the top border, rails, and corners.', panel: { number: 3, title: 'GAUGES', meta: '1/8-CELL FILL' }, width: 48 },
    { name: 'COMPACT', note: 'Below 40 cells: only the numbered header rule; the body keeps the full width.', panel: { number: 3, title: 'GAUGES', meta: '1/8-CELL FILL' }, width: 36 },
    { name: 'HEADER PRIORITY', note: 'Short of space, the meta note goes first, then the title truncates.', panel: { number: 12, title: 'CALIBRATION SEQUENCE', meta: 'ROUTE B, 3 STAGES' }, width: 24 },
    { name: 'FIXED HEIGHT', note: 'height pads or clips the body so neighboring panels align.', panel: { number: 4, title: 'STATUS', meta: 'HEIGHT 6' }, width: 48, height: 6 },
  ],
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
});

const FRAME = element('instrument-frame', {
  title: 'INSTRUMENT FRAME',
  summary: "status-bar's framed footer as a reusable frame: corner and side stubs, a header line, an eight-cell plate column, and wrapped content. It owns geometry only.",
  rules: [
    'Plates, title, header aside, and content are caller-rendered spans; the frame wraps rather than truncating a value.',
    'From 40 cells: stubs, an eight-cell plate column, and a spacer row. Below 40: the minimal fallback with inline plates.',
    'The header aside takes the widest alternative that fits, then moves to its own row.',
    'Render fixed rows such as a gauge at frameGeometry(width).contentWidth.',
  ],
  variants: [
    { name: 'FRAMED', note: "status-bar's footer reconstructed from caller content: 60 cells and wider have two-cell stubs.", width: 80 },
    { name: 'NARROW FRAME', note: '40 to 59 cells: one-cell gutters; the thread rail yields its marks, then takes its own row.', width: 48 },
    { name: 'MINIMAL', note: 'Below 40 cells: no stubs or plate column; plates sit inline and every value wraps.', width: 30 },
  ],
  specimen(variant, width) {
    const w = within(width, variant.width);
    const g = frameGeometry(w);
    return {
      lines: instrumentFrame(FRAME_FIXTURE.real, { width: w }),
      calls: [call('instrumentFrame', FRAME_FIXTURE.shown, { width: w })],
      facts: [g.minimal ? `FORM minimal at ${w} cells` : `FORM framed at ${w} cells; gutter ${g.gutter}, content width ${g.contentWidth}`],
    };
  },
});

const PLATE = element('label-plate', {
  title: 'LABEL PLATE',
  summary: 'A compact informational identifier. It is not a button: no brackets, focus, key hint, or action.',
  rules: [
    'Returns spans for the caller to place in a line.',
    'Capped width is the text plus 2 cap cells, plus 2 when padded; a slab is the text plus 2.',
    'tone is accent, neutral, warning, critical, or bright; form is capped or slab; anything else throws RangeError.',
    'Warning and critical plates must say so in words.',
  ],
  variants: [
    { name: 'ACCENT', note: 'Identity emphasis for a section or fixture name.', text: 'SECTOR 7', options: { tone: 'accent' } },
    { name: 'NEUTRAL', note: 'Supporting identifier.', text: 'MANIFEST', options: { tone: 'neutral' } },
    { name: 'WARNING', note: 'Tone is emphasis only: the word WARN carries the state.', text: 'WARN HEAT', options: { tone: 'warning' } },
    { name: 'CRITICAL', note: 'Tone is emphasis only: the word FAULT carries the state.', text: 'FAULT E21', options: { tone: 'critical' } },
    { name: 'BRIGHT', note: 'Black on white, as status-bar draws its MDL plate.', text: 'MODEL', options: { tone: 'bright' } },
    { name: 'SLAB', note: "form slab: status-bar's padded plate, every cell filled. In plain text it is only its padded text.", text: '01 ACT', options: { tone: 'accent', form: 'slab' } },
    { name: 'BRIGHT SLAB', note: "status-bar's 03 MDL plate: a bright slab.", text: '03 MDL', options: { tone: 'bright', form: 'slab' } },
    { name: 'UNPADDED', note: 'pad: false for inline numbers and IDs.', text: '01', options: { tone: 'accent', pad: false } },
    { name: 'TRUNCATED', note: 'maxWidth truncates the text with an ellipsis before dropping padding.', text: 'CALIBRATION RUN', options: { maxWidth: 12 } },
  ],
  specimen(variant, width) {
    return piece('labelPlate', (o) => labelPlate(variant.text, o), [variant.text], variant.options, width);
  },
});

const COUNT = element('count-plate', {
  title: 'COUNT PLATE',
  summary: "A fixed-width plate showing one exact count: status-bar's CMP compaction plate and its AU (Active Units) badge. The count is the reading; tier color is emphasis.",
  rules: [
    'count is a non-negative safe integer, or null or undefined for unknown; unknown is never zero-shaped.',
    'Every tier carries the count in digits, so meaning never depends on color.',
    'Below its natural width the pads go first, then # cells; never partial digits.',
    'Invalid counts throw (RangeError or TypeError); nothing is clamped.',
  ],
  variants: [
    { name: 'UNKNOWN', note: 'null: ?? on grey, distinct from a confirmed zero.', count: null, spec: 'compactions' },
    { name: 'ZERO', note: 'A known zero on grey.', count: 0, spec: 'compactions' },
    { name: 'TIER 1-2', note: 'White on violet, as status-bar shows it.', count: 1, spec: 'compactions' },
    { name: 'TIER 3-4', note: 'Black on pink, as status-bar shows it.', count: 4, spec: 'compactions' },
    { name: 'TIER 5+', note: 'Black on the critical role, so motions see a state cell.', count: 12, spec: 'compactions' },
    { name: 'CAPPED', note: 'Above the cap the digits read 99+; the + takes the trailing pad, so the width holds.', count: 100, spec: 'compactions' },
    { name: 'AU BADGE', note: 'The units preset: label after the digits, black on white.', count: 3, spec: 'units' },
    { name: 'AU UNKNOWN', note: 'Unknown units: a single ? right-aligned.', count: null, spec: 'units' },
    { name: 'AU WIDE', note: 'No cap: the badge widens with the exact value.', count: 120, spec: 'units' },
    { name: 'NARROW', note: 'maxWidth 6 drops the pads; 3 cells shows #, never partial digits.', count: 7, spec: 'compactions', options: { maxWidth: 6 }, alt: { maxWidth: 3 } },
  ],
  specimen(variant, width) {
    const spec = COUNT_PLATES[variant.spec];
    const shown = [variant.count, code(`COUNT_PLATES.${variant.spec}`)];
    const one = piece('countPlate', (o) => countPlate(variant.count, spec, o), shown, variant.options ?? {}, width);
    if (!variant.alt) return one;
    const two = piece('countPlate', (o) => countPlate(variant.count, spec, o), shown, variant.alt, width);
    return { lines: [...one.lines, ...two.lines], calls: [...one.calls, ...two.calls], facts: [...one.facts, ...two.facts] };
  },
});

const PNYTL_STATES = ['lite', 'full', 'ultra', 'review', 'off', 'checking', 'unknown'];
const MODE = element('mode-plate', {
  title: 'MODE PLATE',
  summary: 'A white inline mode body with a black icon and title and a saturated mode code. Informational only, not a button.',
  rules: [
    'pnytlPlate(state) covers PNYTL: lite, full, ultra, review, off, checking, unknown. No mode is inferred; unknown is not OFF.',
    'active: true lights the icon pink only for a confirmed enabled mode; the element never blinks.',
    'maxWidth clips without padding; reserve the natural width to keep the full meaning.',
    'Invalid text, icons, or inks throw TypeError; unknown presets RangeError.',
  ],
  variants: [
    ...PNYTL_STATES.map((state) => ({ name: state.toUpperCase(), note: `PNYTL ${state}: the mode code and its ink carry the mode.`, state })),
    { name: 'ACTIVE', note: 'active: true on an enabled mode: a pink lit icon. Blinking it is a host motion.', state: 'lite', options: { active: true } },
    { name: 'GENERIC', note: 'modePlate with a caller icon, title, code, and ink.', generic: { icon: '◆', title: 'LINK', code: 'ON', ink: 'accent' } },
  ],
  specimen(variant, width) {
    if (variant.generic) return piece('modePlate', (o) => modePlate(variant.generic, o), [variant.generic], {}, width);
    return piece('pnytlPlate', (o) => pnytlPlate(variant.state, o), [variant.state], variant.options ?? {}, width);
  },
});

const CHIPS = {
  settled: [{ label: 'TCLI', state: 'behind', commitsBehind: 1 }, { label: 'AWKS', state: 'current' }],
  attention: [{ label: 'TCLI', state: 'behind', commitsBehind: 3, localChanges: true }, { label: 'AWKS', state: 'repair', localChanges: true }, { label: 'DOCS', state: 'local_changes' }],
  faults: [{ label: 'CDX', state: 'missing' }, { label: 'GH', state: 'not_runnable' }, { label: 'NET', state: 'unavailable' }],
  quiet: [{ label: 'TCLI', state: 'checking' }, { label: 'AWKS', state: 'inactive' }],
};
const CHIP = element('state-chip', {
  title: 'STATE CHIP',
  summary: "status-bar's Tatsu entry part: a dim label, then a bold shape and code in its state ink. It shows the state the caller supplies.",
  rules: [
    'Shape and code carry the state without color; unknown or unavailable is never shown as current.',
    'Only Tatsu behind appends a count (UP x N); behind and repair append EDIT for local changes.',
    'stateChips separates parts by three cells and breaks only between whole parts when it can.',
    'Invalid state, count, or width throws RangeError.',
  ],
  variants: [
    { name: 'SETTLED', note: 'Behind by one, and current.', inputs: CHIPS.settled },
    { name: 'ATTENTION', note: 'Warning states, with the local-edit suffix.', inputs: CHIPS.attention },
    { name: 'FAULTS', note: 'Critical states: missing, not runnable, unavailable.', inputs: CHIPS.faults },
    { name: 'QUIET', note: 'Checking and inactive in decorative grey.', inputs: CHIPS.quiet },
    ...Object.entries({ unread: ['unread', '◆', SURFACE_PALETTE.wheat], read: ['read', '', 'decorative'], waiting: ['waiting on you', '●', 'critical'], answered: ['answered', '', 'accent'], declined: ['declined', '', 'decorative'], delivery: ['delivery waiting', '', 'warning'] }).map(([state, [code, shape, tone]]) => ({ name: state.toUpperCase(), note: 'Supplied word form; marker trails the word and an absent label adds no gap.', word: { state, look: { code, shape, tone } } })),
    { name: 'WRAPPED', note: 'At 16 cells whole parts move to new lines; an oversized part splits at its spaces.', inputs: CHIPS.attention, width: 16 },
  ],
  specimen(variant, width) {
    if (variant.word) {
      const { state, look } = variant.word;
      return piece('stateChip', (o) => stateChip({ state }, o), [{ state }], { form: 'word', preset: { [state]: look } }, width);
    }
    const opts = { width: within(width, variant.width ?? 56) };
    const lines = stateChips(variant.inputs, opts);
    return { lines, calls: [call('stateChips', variant.inputs, opts)], facts: [`${lines.length} ${lines.length === 1 ? 'LINE' : 'LINES'} at ${opts.width} cells`] };
  },
});

const LAMP_PLAIN = { working: 'a full block', idle: 'a space', unknown: 'a hatch' };
const LAMP = element('lamp', {
  title: 'LAMP',
  summary: "The Thread Rail's root lamp: one cell saying whether the root session is working, idle, or has not reported. Its working blink is a host motion.",
  rules: [
    'Always exactly one cell; state is working, idle, or unknown, anything else throws RangeError.',
    'Working and idle differ by luminance in color and by shape in plain text; unknown is a static hatch.',
    'It has no word: place it next to the bright ROOT plate, as the thread rail does.',
  ],
  variants: [
    { name: 'WORKING', note: 'A bright acid cell: a full block in acid on acid.', state: 'working' },
    { name: 'IDLE', note: 'A dark surface cell: a space.', state: 'idle' },
    { name: 'UNKNOWN', note: 'Not reported: a decorative hatch, never drawn as idle or working.', state: 'unknown' },
    ...[['RX', 'idle', 'decorative'], ['TX', 'working', 'accent'], ['NO LINK', 'unknown', 'critical'], ['WAITING', 'idle', 'critical']].map(([name, state, fg]) => ({ name, state, note: 'Round, explicitly styled and static; the adjacent word carries its meaning.', options: { appearance: 'round', style: { fg, bold: true } } })),
  ],
  specimen(variant, width) {
    if (variant.options) {
      const tail = ' ' + variant.name;
      return { lines: [fitLine([...lamp(variant.state, variant.options), span(tail)], width)], calls: [call('fitLine', code(`[...${call('lamp', variant.state, variant.options)}, ${call('span', tail)}]`), width)], facts: ['ROUND: STATIC; HOST SUPPLIES MEANING'] };
    }
    return { lines: [fitLine(lamp(variant.state), width)], calls: [call('lamp', variant.state)], facts: [`PLAIN: ${LAMP_PLAIN[variant.state]}`] };
  },
});

const ROW = element('status-row', {
  title: 'STATUS ROW',
  summary: 'One aligned line of label, value, and state. It shows the state the caller supplies and checks nothing itself.',
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
});

const ZONES = { warn: 70, high: 90 };
const GAUGE = element('gauge', {
  title: 'GAUGE',
  summary: 'A horizontal, calibrated reading of one value from 0 to max, with a strong numeric readout.',
  rules: [
    'value null or undefined is unknown and never becomes zero.',
    'Out-of-range, NaN, infinite, or non-number values throw RangeError; nothing is clamped.',
    'Fill floors to 1/8 cell and the readout never rounds up.',
    'zones opt in to warning and high tones; pass the same input and options to the scale.',
    'A readout that cannot fit shows # rather than a partial number.',
  ],
  variants: [
    { name: 'KNOWN', note: 'Accent fill on a dark track; white readout.', input: { label: 'KNOWN', value: 64 } },
    { name: 'ZERO', note: 'A known zero: empty track and 0.0 %.', input: { label: 'ZERO', value: 0 } },
    { name: 'FULL', note: 'Fills every cell only when value equals max.', input: { label: 'FULL', value: 100 } },
    { name: 'UNKNOWN', note: 'null is unknown: hatched track and UNKNOWN, never an empty bar.', input: { label: 'UNKNOWN', value: null } },
    { name: 'RANGE', note: 'Custom max, unit, and decimals; the readout truncates, never rounds up.', input: { label: 'FLOW', value: 7.25, max: 12, unit: 'L/m', decimals: 2 } },
    { name: 'STACKED', note: 'When the bar would get under 8 cells, label and readout sit above it.', input: { label: 'FILL', value: 42.5 }, width: 20 },
    { name: 'ZONE OK', note: 'zones: exactly 70 stays OK; a black-on-white chip and a tick-free scale.', input: { label: 'CONTEXT', value: 70 }, zones: ZONES },
    { name: 'ZONE WARN', note: 'Above 70: warning fill, tinted track, and the words WARN in the tag.', input: { label: 'CONTEXT', value: 80 }, zones: ZONES },
    { name: 'ZONE HIGH', note: 'Above 90: critical fill and the word HIGH.', input: { label: 'CONTEXT', value: 95 }, zones: ZONES },
    { name: 'ZONE UNKNOWN', note: 'Unknown with zones: a hatched track and ? UNKNOWN, never zero.', input: { label: 'CONTEXT', value: null }, zones: ZONES },
  ],
  specimen(variant, width) {
    const opts = variant.zones ? { width: within(width, variant.width ?? 64), zones: variant.zones } : { width: within(width, variant.width ?? 56) };
    const { label, value, ...range } = variant.input;
    const lines = gauge(variant.input, opts);
    // With zones the scale needs the same input, because the tag reserves width; without, only the range.
    const [scaleInput, scaleOpts] = variant.zones ? [variant.input, { ...opts, tickFree: true }] : [range, opts];
    return {
      lines: [...lines, gaugeScale(scaleInput, scaleOpts)],
      calls: [call('gauge', variant.input, opts), call('gaugeScale', scaleInput, scaleOpts)],
      facts: [`FORM ${stackedOrInline(lines)} at ${opts.width} cells`],
    };
  },
});

const NUMERAL = element('pixel-numeral', {
  title: 'PIXEL NUMERAL',
  summary: "status-bar's context numeral: a 3x5 pixel font packed into three rows of square half-block pixels. A renderer, not a calculation.",
  rules: [
    'Three lines of exactly width cells; tone follows the value (above 70 warn, above 90 high) unless given.',
    'Unknown is a decorative ?, never a zero numeral.',
    'A grid that cannot fit is never cropped: row one shows the exact small text, or # cells.',
    'numeralAt(target, from, progress, seed) rebuilds the new shape only; the host supplies progress and seed.',
  ],
  variants: [
    { name: 'OK', note: 'White pixels at 64.', value: 64 },
    { name: 'WARN', note: 'Above 70: the warning role.', value: 80 },
    { name: 'HIGH', note: 'Above 90: the critical role.', value: 95 },
    { name: 'UNKNOWN', note: 'null: a decorative ?.', value: null },
    { name: 'HUNDRED', note: '100.0 widens the grid to 17 cells.', value: 100 },
    { name: 'REBUILD', note: 'numeralAt at progress 0.6, seed 42: 95 appearing from 64; no old digit is shown.', rebuild: { target: 95, from: 64, progress: 0.6, seed: 42 } },
    { name: 'NARROW', note: 'Under the grid width: the exact one-decimal text on row one.', value: 64, width: 10 },
  ],
  specimen(variant, width) {
    const w = within(width, variant.width ?? 30);
    const r = variant.rebuild;
    if (r && numeralGrid(r.target).w <= w) {
      const grid = numeralAt(numeralGrid(r.target), numeralGrid(r.from), r.progress, r.seed);
      return {
        lines: numeralLines(grid, { width: w }),
        calls: [`grid = ${call('numeralAt', code(call('numeralGrid', r.target)), code(call('numeralGrid', r.from)), r.progress, r.seed)}`, call('numeralLines', code('grid'), { width: w })],
        facts: [`GRID ${grid.w} cells wide`],
      };
    }
    const input = { value: r ? r.target : variant.value };
    const grid = numeralGrid(input.value);
    const fits = grid !== undefined && grid.w <= w;
    return { lines: pixelNumeral(input, { width: w }), calls: [call('pixelNumeral', input, { width: w })], facts: [fits ? `GRID ${grid.w} cells wide` : `FALLBACK: the grid does not fit ${w} cells`] };
  },
});

const MIN = 60_000;
const METER = element('segment-meter', {
  title: 'SEGMENT METER',
  summary: "status-bar's USG quota column: lit squares for remaining quota per declared window, with countdowns, stale data, and unavailable states. Supplied values only.",
  rules: [
    'A lit square means some quota remains in its slice; any remainder lights the square (unlike the gauge).',
    'Lit and lost squares differ only by color; compose an exact reading beside it where quota matters.',
    'Pending, failed, unknown, absent, and none are distinct states; unknown is never zero.',
    'Time is supplied as now; the element reads no clock. Invalid values throw rather than clamp.',
  ],
  variants: [
    { name: 'KNOWN', note: 'GPT, weekly window 25% used: six lit squares, two lost, 41m to reset.', input: { provider: 'codex', data: { windows: { wk: { usedPercent: 25, resetsAt: 41 * MIN } }, updatedAt: 0 } } },
    { name: 'PARTIAL', note: 'CLD: the 5h window known, the weekly window unknown (?).', input: { provider: 'claude', data: { windows: { '5h': { usedPercent: 60, resetsAt: 243 * MIN }, wk: { usedPercent: null } }, updatedAt: 0 } } },
    { name: 'ZERO QUOTA', note: 'All quota used: every square lost, not unknown.', input: { provider: 'codex', data: { windows: { wk: { usedPercent: 100, resetsAt: 2 * 24 * 60 * MIN } }, updatedAt: 0 } } },
    { name: 'PENDING', note: 'No sample yet: dotted slots and the word pending.', input: { provider: 'claude' } },
    { name: 'FAILED', note: 'Failure without data: ? slots and the word timeout in warning.', input: { provider: 'kimi', failure: 'timeout' } },
    { name: 'STALE', note: 'Failure after a good sample: last windows kept, a dim tag, and its age (16m) in warning.', input: { provider: 'claude', failure: 'failed', data: { windows: { '5h': { usedPercent: 30, resetsAt: 120 * MIN }, wk: { usedPercent: 55, resetsAt: 3 * 24 * 60 * MIN } }, updatedAt: 0 } }, now: 16 * MIN },
    { name: 'NONE', note: 'A successful sample with no windows: none.', input: { provider: 'codex', data: { windows: {}, updatedAt: 0 } } },
    { name: 'METER', note: 'segmentMeter alone: eight inline squares, 87.5% remaining.', meter: { remaining: 87.5, ink: 'primary' } },
  ],
  specimen(variant, width) {
    if (variant.meter) return piece('segmentMeter', (o) => segmentMeter(variant.meter, o), [variant.meter], {}, width);
    const opts = { width: within(width, 30), now: variant.now ?? 0 };
    const lines = providerColumn(variant.input, opts);
    return { lines, calls: [call('providerColumn', variant.input, opts)], facts: [`${lines.length / 2} ${lines.length === 2 ? 'PAIR' : 'PAIRS'} of lines at ${opts.width} cells; now is a fixture time`] };
  },
});

const RAIL = element('thread-rail', {
  title: 'THREAD RAIL',
  summary: "status-bar's Thread Rail: the root lamp, a bright ROOT plate, up to six unit marks, and the exact AU (Active Units) badge. It shows what the caller reports.",
  rules: [
    'activity is { working, units }; undefined means not reported. Unknown units read ? AU, never 00.',
    'The marks are decoration capped at six; the badge is the exact count.',
    'Narrowing: the marks yield first, then whole pieces wrap; a piece wider than the line truncates or shows #.',
    'It imports the lamp, label plate, and count plate public functions.',
  ],
  variants: [
    { name: 'WORKING', note: 'Working with three units: a lit lamp, three lit marks, 03 AU.', activity: { working: true, units: 3 }, width: 40 },
    { name: 'IDLE', note: 'Idle with a confirmed zero: a dark lamp and 00 AU.', activity: { working: false, units: 0 }, width: 40 },
    { name: 'UNKNOWN', note: 'Not reported: a hatched lamp and ? AU, right-aligned.', activity: undefined, width: 40, align: 'right' },
    { name: 'MARKS YIELD', note: 'At 20 cells the marks yield; lamp, ROOT, and badge stay.', activity: { working: true, units: 3 }, width: 20 },
    { name: 'WIDE COUNT', note: 'The badge widens for an exact 120; the marks stay capped at six.', activity: { working: true, units: 120 }, width: 40 },
    { name: 'WRAPPED', note: 'At 8 cells whole pieces wrap onto further lines.', activity: { working: true, units: 3 }, width: 8 },
  ],
  specimen(variant, width) {
    const opts = { width: within(width, variant.width), ...(variant.align ? { align: variant.align } : {}) };
    const lines = threadRail(variant.activity, opts);
    return { lines, calls: [call('threadRail', variant.activity, opts)], facts: [`${lines.length} ${lines.length === 1 ? 'LINE' : 'LINES'} at ${opts.width} cells`] };
  },
});

const MARKER = element('transcript-marker', {
  title: 'TRANSCRIPT MARKER',
  summary: "claude-interrupt's DIRECTIVE UPDATED marker as static pieces: a plate, a gap, and seven stationary bars. A record, not progress or a button.",
  rules: [
    'The settled row, the default, is the record plate with no bars.',
    'Plate states: live, outline, record. Bar states: lit, ghost, off. The label is readable in every state.',
    'The row is exactly width cells; it clips, never wraps, and the last outputPad cells are blank.',
    'The flashes, ping, and wipe are motions; see the MARKER TIMELINE story.',
  ],
  variants: [
    { name: 'RECORD', note: 'Settled: white on grey, no bars.', input: {} },
    { name: 'LIVE', note: 'Black on acid with every bar lit, outputPad 0.', input: { plate: 'live', bars: 'lit', outputPad: 0 } },
    { name: 'OUTLINE', note: 'The unfilled flash frame: acid lettering on the field.', input: { plate: 'outline', bars: 'lit' } },
    { name: 'PING', note: 'Mid-ping: the first bar grey, three lit, three not launched.', input: { plate: 'live', bars: ['ghost', 'lit', 'lit', 'lit', 'off', 'off', 'off'] } },
  ],
  specimen(variant, width) {
    const opts = { width: within(width, 40) };
    return { lines: transcriptMarker(variant.input, opts), calls: [call('transcriptMarker', variant.input, opts)], facts: [] };
  },
});

const LINE_METER = element('line-meter', {
  title: 'LINE METER',
  summary: "herdr-sidebar's compact context-used bar, with a two-digit reading and a single ink.",
  rules: [
    'percent is finite 0-100 or null/undefined for unknown; invalid readings throw, never clamp.',
    'Readout floors and caps at 99%; bar cells use ceil, unlike the default gauge.',
    'Warning starts at 70, critical at 90; idle overrides known ink, not shape.',
    'Narrow: shorten the bar first, then show the readout alone, then # cells.',
  ],
  variants: [
    { name: 'OK', note: 'Fixture: 67% used, eight of eleven cells lit.', input: { percent: 67 } },
    { name: 'WARN', note: 'Exactly 70: warning ink.', input: { percent: 70 } },
    { name: 'CRITICAL', note: 'Exactly 90: bold critical ink.', input: { percent: 90 } },
    { name: 'IDLE', note: 'Idle retains the 95% shape in nonbold decorative ink.', input: { percent: 95, tone: 'idle' } },
    { name: 'UNKNOWN', note: 'Unknown is --%, never 00%.', input: { percent: null } },
    { name: 'ZERO', note: 'Confirmed zero, not unknown.', input: { percent: 0 } },
    { name: 'FULL', note: '100% fills the bar and reads 99% (99 or more).', input: { percent: 100 } },
    { name: 'NARROW', note: 'Eight cells: the shorter bar recomputes its ceil fill.', input: { percent: 67 }, options: { maxWidth: 8 } },
  ],
  specimen(variant, width) {
    return piece('lineMeter', (o) => lineMeter(variant.input, o), [variant.input], variant.options ?? {}, width);
  },
});

// The layout B fixture uses a supported QNS state glyph; the caller, not columnBlock, supplies every ink.
// countPlate's six-cell bare form keeps the compaction count intact in the sidebar-sized right slot.
const COLUMN_FIXTURE = {
  real: [
    { head: true, gutter: [span('× QNS', { fg: 'critical', bold: true })], value: [span('release', { fg: 'primary', bold: true })], right: '2h33m' },
    { gutter: [span('02AU', { fg: 'accent', bold: true })], value: (cells) => lineMeter({ percent: 67 }, { maxWidth: cells }), right: countPlate(18, COUNT_PLATES.compactions, { maxWidth: 6 }) },
    { gutter: 'ACT', value: [span('feat/sidebar*', { fg: 'warning' })], right: '#42' },
    { gutter: 'MDL', value: 'opus-5.5/hi' },
    { gutter: 'PNE', value: 'Updating sidebar', right: '12s' },
  ],
  shown: [
    { head: true, gutter: code(spansCode('× QNS', { fg: 'critical', bold: true })), value: code(spansCode('release', { fg: 'primary', bold: true })), right: '2h33m' },
    { gutter: code(spansCode('02AU', { fg: 'accent', bold: true })), value: code(`(cells) => ${call('lineMeter', { percent: 67 }, { maxWidth: code('cells') })}`), right: code(call('countPlate', 18, code('COUNT_PLATES.compactions'), { maxWidth: 6 })) },
    { gutter: 'ACT', value: code(spansCode('feat/sidebar*', { fg: 'warning' })), right: '#42' },
    { gutter: 'MDL', value: 'opus-5.5/hi' },
    { gutter: 'PNE', value: 'Updating sidebar', right: '12s' },
  ],
};
const COLUMN_BLOCK = element('column-block', {
  title: 'COLUMN BLOCK',
  summary: "herdr-sidebar's layout B: a gutter, a value with optional fixed marks, and a right-aligned slot. Geometry only; callers compose elements.",
  rules: [
    'Default text column 10, text area 24, right slot 6; natural width 34.',
    'Strings use safeText; caller spans keep their styles and curated glyphs.',
    'Marks take value cells, never right-slot cells. Missing parts have no separator.',
    'Narrow: value shrinks first, then fixed parts stack; an oversized part wraps without clipping.',
  ],
  variants: [
    { name: 'LAYOUT B', note: 'Fixture modeled on layout B, composed with lineMeter and a bare countPlate.', fixture: true },
    { name: 'FLAGGED', note: 'The flag takes four value cells; goal time stays in its column.',
      real: [{ ...COLUMN_FIXTURE.real[0], value: 'long-project-name', marks: [[span('●', { fg: 'critical' })]] }],
      shown: [{ ...COLUMN_FIXTURE.shown[0], value: 'long-project-name', marks: code(`[${spansCode('●', { fg: 'critical' })}]`) }] },
    { name: 'CONTINUATION', note: 'A value without a gutter starts under the preceding value.',
      real: [{ gutter: 'ASK', value: [span('Choose a target', { fg: 'critical', bold: true })] }, { value: 'then confirm' }],
      shown: [{ gutter: 'ASK', value: code(spansCode('Choose a target', { fg: 'critical', bold: true })) }, { value: 'then confirm' }] },
    { name: 'NARROW', note: 'At 18 cells, right slots stack at the right edge; the meter re-renders at its budget.', fixture: true, width: 18 },
  ],
  specimen(variant, width) {
    const opts = { width: within(width, variant.width ?? 34) };
    const real = variant.fixture ? COLUMN_FIXTURE.real : variant.real;
    const shown = variant.fixture ? COLUMN_FIXTURE.shown : variant.shown;
    const lines = columnBlock(real, opts);
    return { lines, calls: [call('columnBlock', shown, opts)], facts: [`${lines.length} LINES at ${opts.width} cells`] };
  },
});


const TAB_RULE = element('tab-rule', {
  title:'TAB RULE', summary:'Heavy operations tab plus hairline, registration neatlines and name-rule composition.',
  rules:['Column 1 starts the fourteen-cell tab; focus is also named by the host.', 'Name survives before working label; readouts never invent a timestamp.', 'All chrome is transparent except the solid accent plate.'],
  variants:[
    {name:'IDLE',fn:'tabRule',input:{}}, {name:'FOCUSED',fn:'tabRule',input:{focused:true}},
    {name:'NEATLINE',fn:'neatline',input:{label:'START OF CONVERSATION'}},
    {name:'TIME',fn:'nameRule',input:{time:'09:41'}}, {name:'NO TIME',fn:'nameRule',input:{}},
    {name:'WORKING',fn:'nameRule',input:{label:'thinking',meter:soundingMeter()}},
    {name:'LEADER',fn:'leader',input:{glyph:'┄'}},
  ],
  specimen(v,width) {
    const opts=v.fn==='leader'?{maxWidth:width}:{width};
    const functions={tabRule,neatline,nameRule,leader};
    return {lines:[functions[v.fn](v.input,opts)],calls:[call(v.fn,v.input,opts)],facts:[]};
  },
});
const ACTION_LABEL = element('action-label', {
  title:'ACTION LABEL', summary:'Open affordances and whole-token keyboard hints. Host owns activation.',
  rules:['Read open actions have brackets, not just different ink.', 'Hints drop whole tokens, never part of a chord.'],
  variants:['ready','read','hover'].map(state=>({name:state.toUpperCase(),input:{state}})).concat([{name:'HINTS',hints:true}]),
  specimen(v,width) {
    if(!v.hints) return piece('actionLabel',o=>actionLabel(v.input,o),[v.input],{},width);
    const tokens=[{key:'^O',label:'open'},{key:'Esc',label:'back'},{key:'^P',label:'sheets'}];
    return {lines:[keyHints(tokens,{width})],calls:[call('keyHints',tokens,{width})],facts:[]};
  },
});
const POPUP_HEADER = element('popup-header', {
  title:'POPUP HEADER', summary:'Five popup headers share spacing-only chrome and an Esc footer.',
  rules:['No ruler, no leader and no outer frame.', 'Title stays whole before meta; meta clips only with eight spare cells.'],
  variants:[
    {name:'SHEET',input:{plate:'SHEET 05',title:'SYNTHETIC SHORTLIST',meta:'handed over 09:41'}},
    {name:'SHEETS',input:{plate:'SHEETS',title:'4 - NEWEST FIRST',meta:'^P'}},
    {name:'LOG',input:{plate:'O-01',title:'OPERATIONS LOG',meta:'#004'}},
    {name:'IMAGE',input:{plate:'IMAGE',title:'synthetic sample',meta:'1280 x 704'}},
    {name:'WAITING',input:{plate:'DESK',title:'WAITING ON YOU',meta:'2 waiting',style:{fg:'field',bg:'critical'}}},
  ],
  specimen(v,width) {
    const footer={escape:'back to the desk',meta:'synthetic fixture'};
    return {lines:[popupHeader(v.input,{width}),popupFooter(footer,{width})],calls:[call('popupHeader',v.input,{width}),call('popupFooter',footer,{width})],facts:[]};
  },
});
const NOTICE_ROW = element('notice-row', {
  title:'NOTICE ROW', summary:'Supplied notice words and glyphs; recovery detail remains copyable.',
  rules:['No inferred state or right-hand status column.', 'Detail wraps without discarding characters; no timer or command execution.'],
  variants:[
    {name:'SENDING',input:{glyph:'›',text:'sending'}}, {name:'STOPPED',input:{glyph:'■',text:'stopped'}},
    {name:'WARNING',input:{glyph:'▲',tone:'warning',text:'synthetic warning'}},
    {name:'ERROR',input:{glyph:'✕',tone:'critical',text:'not delivered'}},
    {name:'LINK',input:{glyph:'■',plate:'LINK',plateFirst:true,tone:'critical',text:'not running',detail:[{kind:'command',text:'$ cd synthetic-project',label:'SH'},{kind:'command',text:'  service && bun run src/main.ts',label:''}]}},
    {name:'CONNECTING',input:{glyph:'⠋',plate:'LINK',plateFirst:true,glyphInk:'accent',plateStyle:{fg:'field',bg:SURFACE_PALETTE.plateGrey},text:'connecting'}},
    {name:'EMPTY',input:{text:'No conversation yet'}}, {name:'OLDER',input:{glyph:'·',text:'loading older'}},
  ],
  specimen(v,width) { return {lines:noticeRow(v.input,{width}),calls:[call('noticeRow',v.input,{width})],facts:[]}; },
});
const SCOPE_METER = element('scope-meter', {
  title:'SCOPE METER', summary:'Four-cell connection trace, never numeric signal strength.',
  rules:['Connected is a joined carrier; reconnecting is jagged; lost retains a cross.', 'Still states are the reduced-motion poses; scheduling belongs to the host.'],
  variants:['connected','reconnecting','lost'].map(state=>({name:state.toUpperCase(),input:{state}})),
  specimen(v,width) { return piece('scopeMeter',o=>scopeMeter(v.input,o),[v.input],{},width); },
});
const SOUNDING_METER = element('sounding-meter', {
  title:'SOUNDING METER', summary:'Six braille cells for supplied working state, not a percentage.',
  rules:['Reduced motion rests the head left.', 'Small budgets clip decoration, not data.'],
  variants:[{name:'REST'},{name:'NARROW',options:{maxWidth:3}}],
  specimen(v,width) { return piece('soundingMeter',o=>soundingMeter({},o),[{}],v.options??{},width); },
});

for (const story of [TAB_RULE, ACTION_LABEL, POPUP_HEADER, NOTICE_ROW, SCOPE_METER, SOUNDING_METER]) {
  for (const variant of story.variants) variant.note = `${variant.name}: synthetic presentation fixture, not live data.`;
}


const FEED_BEZEL = element('feed-bezel', {
  title:'FEED BEZEL',summary:'Comms reticle and image chrome around an immutable empty image rectangle.',
  rules:['No image reads, assets, allocation or scaling.', 'Readouts yield first; brackets never enter the image hole.'],
  variants:[{name:'RX'},{name:'TX'},{name:'LOST'},{name:'IMAGE REST',image:{}},{name:'IMAGE HOVER',image:{hover:true}},{name:'MISSING',image:{missing:true}},{name:'UNSUPPORTED',image:{unsupported:true}},{name:'INSET',inset:true}],
  specimen(v,width) {
    if(v.image) return piece('imageLabel',o=>imageLabel({label:'synthetic.png',...v.image},o),[{label:'synthetic.png',...v.image}],{},width);
    const rect={x:width>6?3:0,y:1,width:Math.max(1,Math.min(32,width-6)),height:8};
    const opts={width,height:11};
    if(v.inset) return {lines:imageInset(rect,opts),calls:[call('imageInset',rect,opts)],facts:[]};
    const input={imageRect:rect,callsign:'M-02',channel:'CH 02',pose:'FRONT',meter:scopeMeter({state:v.name==='LOST'?'lost':'connected'}),lamp:[span(v.name==='LOST'?'○ NO LINK':v.name==='TX'?'● TX':'● RX',{fg:v.name==='LOST'?'critical':v.name==='TX'?'accent':'decorative',bg:'default'})]};
    return {lines:feedBezel(input,opts),calls:[call('feedBezel',input,opts)],facts:[]};
  },
});
const INPUT_FRAME = element('input-frame', {
  title:'INPUT FRAME',summary:'Editor chrome only, with reserved diagonal gutters and no input body background.',
  rules:['Body is an empty native-editor reservation, not a replacement editor.', 'Motion off uses home corners; the focused/form label stays meaningful.'],
  variants:[{name:'EMPTY',input:{}},{name:'HOVER',input:{state:'hover',spread:true}},{name:'FOCUSED',input:{state:'focused'}},{name:'MULTILINE',input:{state:'focused',scroll:'2-4 OF 5'},rows:3},{name:'TAKEN BACK',input:{state:'focused',label:'TAKEN BACK'}},{name:'FORM',input:{state:'form',label:'QUESTION 07 - 1/2'}}],
  specimen(v,width) {const opts={width,bodyRows:v.rows??1};return {lines:inputFrame(v.input,opts),calls:[call('inputFrame',v.input,opts)],facts:[]};},
});
for(const story of [FEED_BEZEL,INPUT_FRAME]) for(const v of story.variants) v.note=`${v.name}: synthetic chrome; image/editor content belongs to the host.`;

export const ELEMENT_STORIES = [PANEL, FRAME, PLATE, COUNT, MODE, CHIP, LAMP, ROW, GAUGE, NUMERAL, METER, RAIL, MARKER, LINE_METER, COLUMN_BLOCK, TAB_RULE, ACTION_LABEL, POPUP_HEADER, NOTICE_ROW, SCOPE_METER, SOUNDING_METER, FEED_BEZEL, INPUT_FRAME];
