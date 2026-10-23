import { resolveColor } from '../foundation/cells.mjs';
import { assertLines, assertMs, assertTime, copyLines, inRegion, resolveOptions, resolveRegion, restyleCells } from './frame.mjs';
export const AMBIENT_SWEEP_DEFAULTS = Object.freeze({ period: 16000, run: 4000, region: undefined });
export function ambientSweep(lines, options = {}) {
  assertLines(lines); const o = resolveOptions('ambient-sweep', options, AMBIENT_SWEEP_DEFAULTS); assertMs(o.period, 'sweep period', { min: 1 }); assertMs(o.run, 'sweep run', { min: 1 }); assertTime(o, 'ambient-sweep');
  if (o.run > o.period) throw new RangeError('sweep run exceeds period');
  const r = resolveRegion('ambient-sweep', o.region);
  if (!o.animate) return copyLines(lines);
  const phase = o.time % o.period / o.run, h = Math.min(lines.length - r.top, r.rows), band = phase < 1 ? Math.round(phase * (h + 6)) - 3 + r.top : -99;
  return restyleCells(lines, (style, col, row, ch) => {
    if (!inRegion(r, col, row) || !'┼│─·'.includes(ch)) return undefined;
    const lift = Math.max(0, 1 - Math.abs(row - band) / 3) * 0.05;
    if (!lift) return undefined;
    const hex = resolveColor(style.fg ?? 'secondary'), fg = '#' + [1, 3, 5].map(i => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) + 255 * lift)).toString(16).padStart(2, '0')).join('');
    return { style: { ...style, fg } };
  });
}
