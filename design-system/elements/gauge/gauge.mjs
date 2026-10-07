import { assertCells, fit, fitLine, safeText, span } from '../../foundation/cells.mjs';

const EIGHTHS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'];
const MAX_BAR = 48;
const MIN_INLINE_BAR = 8;
const UNKNOWN = 'UNKNOWN';
const TRACK = { fg: 'structural', bg: 'surface' };
const FILL = { fg: 'accent', bg: 'surface' };

// Validated reading. null/undefined value means unknown; anything else must be a finite number in [0, max].
export function gaugeReading({ value, max = 100, unit = '%', decimals = 1 }) {
  if (typeof max !== 'number' || !Number.isFinite(max) || max <= 0) throw new RangeError(`gauge max must be a finite number > 0, got ${max}`);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 3) throw new RangeError(`gauge decimals must be 0-3, got ${decimals}`);
  const known = value !== null && value !== undefined;
  if (known && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max)) {
    throw new RangeError(`gauge value must be null (unknown) or a finite number from 0 to ${max}, got ${value}`);
  }
  return { known, value: known ? value : null, max, unit: fit(safeText(unit), 4), decimals };
}

// Never rounds up: a readout must not claim more than the value (99.96 shows 99.9, not 100.0).
function format(value, decimals) {
  const s = value.toFixed(decimals);
  return Number(s) > value ? (Number(s) - 10 ** -decimals).toFixed(decimals) : s;
}

function readoutWidth(r, min = 0) {
  return Math.max(min, UNKNOWN.length, format(r.max, r.decimals).length + 1 + r.unit.length);
}

function readout(r, width) {
  const text = r.known ? `${format(r.value, r.decimals)} ${r.unit}` : UNKNOWN;
  // Partial numbers would misstate the value; overflow shows '#' instead.
  const shown = text.length <= width ? text.padStart(width) : '#'.repeat(width);
  return span(shown, r.known ? { fg: 'primary', bold: true } : { fg: 'secondary', bold: true });
}

// Fill floors to 1/8 cell, so the bar never overstates. Unknown is a hatched track, never an empty one.
function bar(r, n) {
  if (!r.known) return [span('╱'.repeat(n), { fg: 'decorative', bg: 'surface' })];
  const eighths = r.value === r.max ? n * 8 : Math.floor((r.value / r.max) * n * 8);
  const full = Math.floor(eighths / 8);
  const part = EIGHTHS[eighths % 8];
  return [span('█'.repeat(full), FILL), span(part, FILL), span('░'.repeat(n - full - (part ? 1 : 0)), TRACK)];
}

function geometry(r, width, labelWidth, minReadout) {
  const rw = readoutWidth(r, minReadout);
  const avail = width - labelWidth - 2 - rw;
  return avail >= MIN_INLINE_BAR
    ? { inline: true, rw, barStart: labelWidth + 1, barWidth: Math.min(avail, MAX_BAR) }
    : { inline: false, rw, barStart: 0, barWidth: Math.min(width, MAX_BAR) };
}

// One line (label, bar, readout) when the bar can keep at least 8 cells; otherwise label+readout above the bar.
// readoutWidth widens the readout column so gauges with different ranges align as a group.
export function gauge(input, { width, labelWidth = 8, readoutWidth = 0 } = {}) {
  assertCells(width, 'gauge width');
  const r = gaugeReading(input);
  const label = safeText(input.label ?? '');
  const g = geometry(r, width, labelWidth, readoutWidth);
  const name = { fg: 'secondary' };
  if (g.inline) {
    return [fitLine([span(fit(label, labelWidth).padEnd(g.barStart), name), ...bar(r, g.barWidth), span(' '), readout(r, g.rw)], width)];
  }
  const rw = Math.min(g.rw, width);
  const head = [span(fit(label, Math.max(0, width - rw - 1)).padEnd(width - rw), name), readout(r, rw)];
  return [fitLine(head, width), fitLine(bar(r, g.barWidth), width)];
}

// Calibration comb aligned under gauge() bars of the same reading geometry: 0, midpoint, max, and
// quarter ticks. Marks sit at the nearest cell centre (within half a cell); the readout is authoritative.
export function gaugeScale(input, { width, labelWidth = 8, readoutWidth = 0 } = {}) {
  assertCells(width, 'gauge width');
  const r = gaugeReading({ ...input, value: null });
  const { barStart, barWidth: n } = geometry(r, width, labelWidth, readoutWidth);
  const cells = Array(n).fill(' ');
  const at = (f) => Math.min(n - 1, Math.max(0, Math.round(f * n - 0.5)));
  const free = (from, len) => from >= 0 && from + len <= n && cells.slice(Math.max(0, from - 1), from + len + 1).every((c) => c === ' ');
  const put = (text, from) => {
    if (!free(from, text.length)) return;
    [...text].forEach((c, i) => (cells[from + i] = c));
  };
  const mark = (v) => String(Number(v.toFixed(r.decimals)));
  put('0', 0);
  put(mark(r.max), n - mark(r.max).length);
  put(mark(r.max / 2), at(0.5) - Math.floor((mark(r.max / 2).length - 1) / 2));
  for (const f of [0.25, 0.75]) put('╵', at(f));
  const comb = cells.join('');
  return fitLine([span(' '.repeat(barStart)), ...[...comb].map((c) => span(c, { fg: c === '╵' ? 'decorative' : 'secondary' }))], width);
}
