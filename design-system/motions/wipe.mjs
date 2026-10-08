import { assertLines, assertMs, assertTime, copyLines, inRegion, resolveOptions, resolveRegion, restyleCells } from './frame.mjs';
import { isTerminalDefault, lineWidth, resolveColor } from '../foundation/cells.mjs';

export const WIPE_DEFAULTS = Object.freeze({ direction: 'rtl', times: Object.freeze([2800, 2880, 2960]), fractions: Object.freeze([0.4, 0.8, 1]), fromStyle: Object.freeze({ fg: 'field', bg: 'accent', bold: true }), region: undefined });
function check(options) {
  const o = resolveOptions('wipe', options, WIPE_DEFAULTS);
  if (!['ltr', 'rtl'].includes(o.direction)) throw new RangeError('wipe direction must be ltr or rtl');
  if (!Array.isArray(o.times) || !o.times.length || !Array.isArray(o.fractions) || o.fractions.length !== o.times.length) throw new RangeError('wipe needs equal nonempty times and fractions');
  o.times.forEach((t, i) => { assertMs(t, 'wipe time'); if (i && t <= o.times[i - 1]) throw new RangeError('wipe times must increase'); });
  o.fractions.forEach((f, i) => { if (!Number.isFinite(f) || f <= 0 || f > 1 || (i && f <= o.fractions[i - 1])) throw new RangeError('wipe fractions must increase in (0,1]'); });
  if (o.fractions.at(-1) !== 1) throw new RangeError('wipe final fraction must be 1');
  if (!o.fromStyle || typeof o.fromStyle !== 'object' || Array.isArray(o.fromStyle)) throw new TypeError('wipe fromStyle must be a style');
  for (const key of Object.keys(o.fromStyle)) if (!['fg', 'bg', 'bold'].includes(key)) throw new TypeError('wipe unknown style field');
  for (const key of ['fg', 'bg']) if (o.fromStyle[key] !== undefined && !isTerminalDefault(o.fromStyle[key])) resolveColor(o.fromStyle[key]);
  if (o.fromStyle.bold !== undefined && typeof o.fromStyle.bold !== 'boolean') throw new TypeError('wipe bold must be boolean');
  o.region = resolveRegion('wipe', o.region); return o;
}
export function wipeDuration(options = {}) { return check(options).times.at(-1); }
// Input is the settled record; the host supplies the starting style and settle proportions.
export function wipe(lines, options = {}) {
  assertLines(lines); const o = check(options); assertTime(o, 'wipe');
  if (!o.animate || o.time >= o.times.at(-1)) return copyLines(lines);
  let fraction = 0;
  o.times.forEach((t, i) => { if (o.time >= t) fraction = o.fractions[i]; });
  const widths = lines.map((line) => Math.max(0, Math.min(lineWidth(line) - o.region.left, o.region.cols)));
  return restyleCells(lines, (style, col, row) => {
    if (!inRegion(o.region, col, row)) return undefined;
    const width = widths[row];
    const count = Math.ceil(width * fraction), x = col - o.region.left;
    const reached = o.direction === 'rtl' ? x >= width - count : x < count;
    return reached ? undefined : { style: { ...style, ...o.fromStyle } };
  });
}
