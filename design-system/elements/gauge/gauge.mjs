import { assertCells, fit, fitLine, safeText, span } from '../../foundation/cells.mjs';
import { SIGNAL_COLORS } from '../../foundation/signal-colors.mjs';

const EIGHTHS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'];
const MAX_BAR = 48;
const MIN_INLINE_BAR = 8;
const UNKNOWN = 'UNKNOWN';
const TRACK = { fg: 'structural', bg: 'surface' };
const FILL = { fg: 'accent', bg: 'surface' };
export const READOUT_CHIP = Object.freeze({
  ok: Object.freeze({ fg: 'field', bg: 'primary', bold: true }),
  warn: Object.freeze({ fg: 'field', bg: 'warning', bold: true }),
  high: Object.freeze({ fg: 'field', bg: 'critical', bold: true }),
  unknown: Object.freeze({ fg: 'primary', bg: 'structural', bold: true }),
});
const INK = { ok: 'accent', warn: 'warning', high: 'critical', unknown: 'decorative' };
const TAG = { ok: '', warn: '▲ WARN', high: '▲ HIGH', unknown: '? UNKNOWN' };
function validateLayout(labelWidth, readoutWidth, zones) {
  for (const n of [labelWidth, readoutWidth]) {
    if (!Number.isInteger(n) || n < 0 || n > 1000) throw new RangeError('gauge columns must be integers from 0 to 1000');
  }
  if (zones !== undefined && (!zones || typeof zones !== 'object' ||
      !Number.isFinite(zones.warn) || !Number.isFinite(zones.high) ||
      zones.warn < 0 || zones.high <= zones.warn || zones.high > 100)) {
    throw new RangeError('zones must have 0 <= warn < high <= 100 percentage thresholds');
  }
}
const toneOf = (r, zones) => !r.known ? 'unknown' : r.value / r.max * 100 > zones.high ? 'high' : r.value / r.max * 100 > zones.warn ? 'warn' : 'ok';
const tickAt = (percent, n) => Math.min(n - 1, Math.floor(percent * n / 100 + 1e-9));
function contextReadout(r, width, tone) {
  const reading = r.known ? `${format(r.value, r.decimals)} ${r.unit}` : '?';
  const shown = reading.length <= width ? reading.padStart(width) : '#'.repeat(width);
  return [span(' ' + shown + ' ', READOUT_CHIP[tone]), ...(TAG[tone] ? [span(' '), span(TAG[tone], { fg: INK[tone], bold: true })] : [])];
}

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
function bar(r, n, zones) {
  if (!r.known) return [span('╱'.repeat(n), { fg: 'decorative', bg: 'surface' })];
  const eighths = r.value === r.max ? n * 8 : Math.floor((r.value / r.max) * n * 8);
  const full = Math.floor(eighths / 8);
  const part = EIGHTHS[eighths % 8];
  if (!zones) return [span('█'.repeat(full), FILL), span(part, FILL), span('░'.repeat(n - full - (part ? 1 : 0)), TRACK)];
  const tone = toneOf(r, zones);
  return Array.from({ length: n }, (_, i) => {
    const bg = i >= tickAt(zones.high, n) ? SIGNAL_COLORS.criticalZone : i >= tickAt(zones.warn, n) ? SIGNAL_COLORS.warningZone : 'surface';
    const filled = i < full || (i === full && part);
    return span(i < full ? '█' : i === full && part ? part : '░', { fg: filled ? INK[tone] : 'structural', bg });
  });
}

function geometry(r, width, labelWidth, minReadout, suffix = 0) {
  const rw = readoutWidth(r, minReadout) + suffix;
  const avail = width - labelWidth - 2 - rw;
  return avail >= MIN_INLINE_BAR
    ? { inline: true, rw, barStart: labelWidth + 1, barWidth: Math.min(avail, MAX_BAR) }
    : { inline: false, rw, barStart: 0, barWidth: Math.min(width, MAX_BAR) };
}

// One line (label, bar, readout) when the bar can keep at least 8 cells; otherwise label+readout above the bar.
// readoutWidth widens the readout column so gauges with different ranges align as a group.
export function gauge(input, { width, labelWidth = 8, readoutWidth = 0, zones } = {}) {
  assertCells(width, 'gauge width');
  validateLayout(labelWidth, readoutWidth, zones);
  const r = gaugeReading(input);
  const label = safeText(input.label ?? '');
  const tone = zones ? toneOf(r, zones) : undefined;
  const suffix = zones ? 2 + (TAG[tone] ? TAG[tone].length + 1 : 0) : 0;
  const g = geometry(r, width, labelWidth, readoutWidth, suffix);
  const reading = (rw) => zones ? contextReadout(r, Math.max(0, rw - suffix), tone) : [readout(r, rw)];
  const name = { fg: 'secondary' };
  if (g.inline) {
    return [fitLine([span(fit(label, labelWidth).padEnd(g.barStart), name), ...bar(r, g.barWidth, zones), span(' '), ...reading(g.rw)], width)];
  }
  if (zones && width < g.rw) {
    const text = r.known ? `${format(r.value, r.decimals)} ${r.unit}` : '?';
    const head = span(text.length <= width ? text.padStart(width) : '#'.repeat(width), READOUT_CHIP[tone]);
    return [fitLine([head], width), fitLine(bar(r, g.barWidth, zones), width),
      ...(TAG[tone] ? [fitLine([span(TAG[tone], { fg: INK[tone], bold: true })], width)] : [])];
  }
  const rw = Math.min(g.rw, width);
  const head = [span(fit(label, Math.max(0, width - rw - 1)).padEnd(width - rw), name), ...reading(rw)];
  return [fitLine(head, width), fitLine(bar(r, g.barWidth, zones), width)];
}

// Calibration comb aligned under gauge() bars of the same reading geometry: 0, midpoint, max, and
// quarter ticks. Marks sit at the nearest cell centre (within half a cell); the readout is authoritative.
export function gaugeScale(input, { width, labelWidth = 8, readoutWidth = 0, zones, tickFree = false } = {}) {
  assertCells(width, 'gauge width');
  validateLayout(labelWidth, readoutWidth, zones);
  if (typeof tickFree !== 'boolean') throw new TypeError('tickFree must be a boolean');
  const r = gaugeReading({ ...input, value: null });
  const actual = gaugeReading(input);
  const tone = zones ? toneOf(actual, zones) : undefined;
  const suffix = zones ? 2 + (TAG[tone] ? TAG[tone].length + 1 : 0) : 0;
  const { barStart, barWidth: n } = geometry(r, width, labelWidth, readoutWidth, suffix);
  if (tickFree) {
    const limit = Math.min(n + 3, width - barStart), cells = Array(limit).fill(' '), inks = Array(limit).fill('secondary');
    // footer.ts:1463-1474: endpoint/state/midpoint labels take collision priority; no tick glyphs.
    for (const percent of [0, 100, zones?.warn ?? 70, zones?.high ?? 90, 50, 10, 20, 30, 40, 60, 80]) {
      const text = String(Number((r.max * (percent / 100)).toFixed(r.decimals))), start = tickAt(percent, n);
      if (start + text.length > limit || cells.slice(Math.max(0, start - 1), start + text.length + 1).some((c) => c !== ' ')) continue;
      [...text].forEach((c, j) => { cells[start + j] = c; inks[start + j] = percent === (zones?.warn ?? 70) ? 'warning' : percent === (zones?.high ?? 90) ? 'critical' : 'secondary'; });
    }
    return fitLine([span(' '.repeat(barStart)), ...cells.map((c, i) => span(c, { fg: inks[i], bold: inks[i] !== 'secondary' }))], width);
  }
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
