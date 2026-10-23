import { resolveColor } from '../foundation/cells.mjs';
import { assertLines, assertMs, assertTime, copyLines, inRegion, resolveOptions, resolveRegion, restyleCells } from './frame.mjs';
export const BREATHE_DEFAULTS = Object.freeze({ period: 4000, region: undefined });
export function breathe(lines, options = {}) {
  assertLines(lines); const o = resolveOptions('breathe', options, BREATHE_DEFAULTS); assertMs(o.period, 'breathe period', { min: 1 }); assertTime(o, 'breathe');
  const region = resolveRegion('breathe', o.region);
  if (!o.animate) return copyLines(lines);
  const k = 0.6 * (1 - Math.cos(o.time / o.period * Math.PI * 2)) / 2;
  return restyleCells(lines, (style, col, row, ch) => {
    if (!inRegion(region, col, row) || ch === ' ') return undefined;
    const hex = resolveColor(style.fg ?? 'secondary');
    const fg = '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - k) + 255 * k).toString(16).padStart(2, '0')).join('');
    return { style: { ...style, fg } };
  });
}
