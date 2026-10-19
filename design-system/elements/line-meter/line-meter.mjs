import { assertCells, span } from '../../foundation/cells.mjs';
import { SIGNAL_COLORS } from '../../foundation/signal-colors.mjs';

// Sidebar context-used semantics: the two-digit readout is authoritative; each whole bar cell is lit
// when any of its slice is used. Unlike the default gauge, this deliberately uses ceil, not floor.
export function lineMeter(input, options = {}) {
  for (const value of [input, options]) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('line meter input and options must be objects');
  }
  const { percent, tone = 'zone' } = input;
  const { cells = 11, zones = { warn: 70, high: 90 }, maxWidth = Infinity } = options;
  assertCells(cells, 'line meter cells');
  if (maxWidth !== Infinity && (!Number.isInteger(maxWidth) || maxWidth < 0)) throw new RangeError('maxWidth must be a non-negative integer or Infinity');
  if (!zones || typeof zones !== 'object' || !Number.isFinite(zones.warn) || !Number.isFinite(zones.high) || zones.warn < 0 || zones.warn >= zones.high || zones.high > 100) {
    throw new RangeError('zones must have finite 0 <= warn < high <= 100');
  }
  if (tone !== 'zone' && tone !== 'idle') throw new RangeError('tone must be zone or idle');
  const unknown = percent === null || percent === undefined;
  if (!unknown && typeof percent !== 'number') throw new TypeError('percent must be a number, null or undefined');
  if (!unknown && (!Number.isFinite(percent) || percent < 0 || percent > 100)) throw new RangeError('percent must be finite and from 0 to 100');
  const used = unknown ? undefined : Math.min(99, Math.floor(percent));
  const readout = unknown ? '--%' : `${String(used).padStart(2, '0')}%`;
  const fg = unknown ? SIGNAL_COLORS.ghost : tone === 'idle' ? 'decorative' : percent >= zones.high ? 'critical' : percent >= zones.warn ? 'warning' : 'accent';
  const style = { fg, bold: fg === 'critical' };
  if (maxWidth === 0) return [];
  if (maxWidth < 3) return [span('#'.repeat(maxWidth), style)];
  if (maxWidth < 5) return [span(readout, style)];
  const length = Math.min(cells, maxWidth - 4);
  const lit = unknown ? 0 : Math.ceil(used * length / 100);
  return [span('━'.repeat(lit) + '─'.repeat(length - lit) + ' ' + readout, style)];
}
