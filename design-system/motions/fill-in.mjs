import { assertLines, assertMs, assertTime, copyLines, inRegion, resolveOptions, resolveRegion, restyleCells } from './frame.mjs';
import { lineWidth } from '../foundation/cells.mjs';

export const FILL_IN_DEFAULTS = Object.freeze({ tick: 50, window: 8, region: undefined });
function check(options) {
  const o = resolveOptions('fill-in', options, FILL_IN_DEFAULTS); assertMs(o.tick, 'fill-in tick', { min: 1 });
  if (!Number.isInteger(o.window) || o.window < 1 || o.window > 1000) throw new RangeError('fill-in window must be 1–1000 cells');
  o.region = resolveRegion('fill-in', o.region); return o;
}
export function fillInDuration(lines, options = {}) {
  assertLines(lines); const o = check(options);
  const widths = lines.map((line, row) => inRegion(o.region, o.region.left, row) ? Math.max(0, Math.min(o.window, o.region.cols, lineWidth(line) - o.region.left)) : 0);
  return Math.max(0, ...widths) * o.tick;
}
// footer.ts:379,1228 and USG fill-in: one white latch tick per cell, windows in parallel.
export function fillIn(lines, options = {}) {
  assertLines(lines); const o = check(options); assertTime(o, 'fill-in');
  if (!o.animate) return copyLines(lines);
  const k = Math.floor(o.time / o.tick);
  return restyleCells(lines, (style, col, row) => {
    if (!inRegion(o.region, col, row)) return undefined;
    const at = (col - o.region.left) % o.window;
    return k > at ? undefined : { style: { ...style, fg: k === at ? 'primary' : 'decorative' } };
  });
}
