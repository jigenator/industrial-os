// Deterministic, I/O-free composition of the four selected elements. Every value below is a labelled
// demonstration fixture; nothing is read from the machine or any service.
import { assertCells, blank, fit, fitLine, lineWidth, safeText, span } from '../foundation/cells.mjs';
import { labelPlate } from '../elements/label-plate/label-plate.mjs';
import { numberedPanel, panelInnerWidth } from '../elements/numbered-panel/numbered-panel.mjs';
import { gauge, gaugeScale } from '../elements/gauge/gauge.mjs';
import { statusRow } from '../elements/status-row/status-row.mjs';

const TWO_COLUMNS_FROM = 100;
const COMPACT_BELOW = 48;
const FALLBACK_BELOW = 24;
const GAP = 1;

const PLATES = [
  ['ACCENT', 'SECTOR 7', 'accent', 'identity'],
  ['NEUTRAL', 'MANIFEST', 'neutral', 'supporting'],
  ['WARNING', 'WARN HEAT', 'warning', 'word carries state'],
  ['CRITICAL', 'FAULT E21', 'critical', 'word carries state'],
];
const GAUGES = [
  { label: 'KNOWN', value: 64 },
  { label: 'ZERO', value: 0 },
  { label: 'FULL', value: 100 },
  { label: 'UNKNOWN', value: null },
];
const ROWS = [
  { label: 'NEUTRAL', value: 'specimen idle', status: 'neutral' },
  { label: 'SUCCESS', value: '12 of 12 specimen checks', status: 'success' },
  { label: 'WARNING', value: '3 specimens over limit', status: 'warning' },
  { label: 'ERROR', value: 'specimen parse failed', status: 'error' },
  { label: 'UNAVAIL', value: null, status: 'unavailable' },
];

const muted = { fg: 'secondary' };

function bay(w) {
  const plates = [...labelPlate('BAY 04', { tone: 'accent', maxWidth: w }), span(' ')];
  plates.push(...labelPlate('FIXTURE', { maxWidth: Math.max(0, w - lineWidth(plates)) }));
  const tag = 'SPECIMEN DATA';
  const rest = w - lineWidth(plates);
  if (rest >= tag.length + 2) plates.push(span(tag.padStart(rest), muted));
  return [
    fitLine(plates, w),
    blank(w),
    ...gauge({ label: 'FILL', value: 42.5 }, { width: w, readoutWidth: 8 }),
    ...gauge({ label: 'FLOW', value: null, max: 12, unit: 'L/m' }, { width: w, readoutWidth: 8 }),
    blank(w),
    ...statusRow({ label: 'DOOR', value: 'closed', status: 'success' }, { width: w }),
    ...statusRow({ label: 'FEED', value: '2 specimen retries', status: 'warning' }, { width: w }),
    ...statusRow({ label: 'LINK', value: null, status: 'unavailable' }, { width: w }),
  ];
}

function plates(w) {
  const noteAt = 10 + Math.max(...PLATES.map(([, text]) => text.length + 4)) + 2;
  const lines = PLATES.map(([name, text, tone, note]) => {
    const line = [span(fit(name, 9).padEnd(10), muted), ...labelPlate(text, { tone, maxWidth: Math.max(0, w - 10) })];
    if (w - noteAt >= note.length) line.push(span(' '.repeat(noteAt - lineWidth(line)) + note, muted));
    return fitLine(line, w);
  });
  // Add whole groups only, so a plate is never cut through its middle.
  const inline = [span('INLINE    ', muted)];
  for (const [name, id] of [['CELL ', 'A-04'], ['  LOT ', '7731']]) {
    const group = [span(name, muted), ...labelPlate(id, { pad: false })];
    if (lineWidth(inline) + lineWidth(group) <= w) inline.push(...group);
  }
  const narrow = [span('FIT 12    ', muted), ...labelPlate('CALIBRATION RUN', { maxWidth: Math.min(12, Math.max(0, w - 10)) })];
  return [...lines, fitLine(inline, w), fitLine(narrow, w)];
}

function gauges(w) {
  return [...GAUGES.flatMap((g) => gauge(g, { width: w })), gaugeScale({}, { width: w })];
}

function rows(w) {
  return ROWS.flatMap((r) => statusRow(r, { width: w }));
}

const PANELS = [
  { number: 1, title: 'SPECIMEN BAY', meta: 'COMPOSED', body: bay },
  { number: 2, title: 'LABEL PLATES', meta: 'INFORMATIONAL, NOT BUTTONS', body: plates },
  { number: 3, title: 'GAUGES', meta: '1/8-CELL FILL', body: gauges },
  { number: 4, title: 'STATUS ROWS', meta: 'LABEL VALUE STATE', body: rows },
];

function header(columns, rows, mode) {
  const compact = columns < COMPACT_BELOW;
  const left = [...labelPlate('INDUSTRIAL OS', { tone: 'accent', maxWidth: columns }), span(' ')];
  const title = compact ? 'SHOWCASE' : 'NATIVE SHOWCASE';
  if (lineWidth(left) + title.length <= columns) left.push(span(title, { fg: 'primary', bold: true }));
  const size = `${rows ? `${columns}x${rows}` : `${columns} COLS`} ${mode}`;
  // The palette name gives way before the truthful size/mode readout does.
  if (!compact && columns - lineWidth(left) >= 16 + size.length) left.push(span('  ACID / BLACK', muted));
  const rest = columns - lineWidth(left);
  if (rest >= size.length + 2) left.push(span(size.padStart(rest), { fg: 'decorative' }));
  const notes = ['SPECIMEN VALUES ARE DEMONSTRATIONS, NOT LIVE MACHINE TELEMETRY', 'SPECIMEN VALUES, NOT LIVE', 'SPECIMEN VALUES'];
  const note = notes.find((n) => n.length <= columns) ?? notes.at(-1);
  return [fitLine(left, columns), fitLine([span(fit(note, columns), muted)], columns), blank(columns)];
}

function panel(p, width, height) {
  return numberedPanel(p, p.body(panelInnerWidth(width)), { width, height });
}

// Full-height composition for `columns` cells. Every line is exactly `columns` cells wide.
// rows is only displayed in the header; use viewport() to fit a height. mode labels the color output.
export function composeShowcase({ columns, rows, mode = 'PLAIN' }) {
  if (mode !== 'PLAIN' && mode !== 'TRUECOLOR') throw new RangeError('mode must be PLAIN or TRUECOLOR');
  assertCells(columns, 'columns');
  if (rows !== undefined) assertCells(rows, 'rows');
  if (columns < FALLBACK_BELOW) {
    return ['INDUSTRIAL OS', `NEEDS ${FALLBACK_BELOW}+ COLUMNS`, `HAS ${columns}`].map((t, i) =>
      fitLine([span(fit(t, columns), i ? muted : { fg: 'accent', bold: true })], columns),
    );
  }
  const out = header(columns, rows, mode);
  if (columns < TWO_COLUMNS_FROM) {
    for (const p of PANELS) out.push(...panel(p, columns), blank(columns));
    return out;
  }
  const left = Math.floor((columns - GAP) / 2);
  const right = columns - GAP - left;
  for (let i = 0; i < PANELS.length; i += 2) {
    const [a, b] = [PANELS[i], PANELS[i + 1]];
    const height = Math.max(panel(a, left).length, panel(b, right).length);
    const pa = panel(a, left, height);
    const pb = panel(b, right, height);
    pa.forEach((line, j) => out.push([...line, span(' '.repeat(GAP)), ...pb[j]]));
    out.push(blank(columns));
  }
  return out;
}

// Fit a composition into `rows`, scrolled to `offset`. When it overflows, the last row reports the
// visible range; `hint` names the controls that host actually offers. Returns the clamped offset.
export function viewport(lines, { columns, rows, offset = 0, hint = '' }) {
  assertCells(columns, 'columns');
  assertCells(rows, 'rows');
  hint = safeText(hint);
  if (lines.length <= rows) return { lines, offset: 0, maxOffset: 0 };
  const visible = rows - 1;
  const maxOffset = lines.length - visible;
  const at = Math.min(Math.max(0, Number.isInteger(offset) ? offset : 0), maxOffset);
  const range = visible ? `LINES ${at + 1}-${at + visible} OF ${lines.length}` : `${lines.length} LINES`;
  const status = fitLine([span(fit(hint ? `${range}  ${hint}` : range, columns), { fg: 'primary', bg: 'surface' })], columns, { bg: 'surface' });
  return { lines: [...lines.slice(at, at + visible), status], offset: at, maxOffset };
}
