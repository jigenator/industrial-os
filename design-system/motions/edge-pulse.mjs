import { assertLines, assertMs, assertTime, copyLines, inRegion, resolveOptions, resolveRegion, restyleCells } from './frame.mjs';
import { resolveColor } from '../foundation/cells.mjs';
import { SIGNAL_COLORS } from '../foundation/signal-colors.mjs';

export const EDGE_PULSE_DEFAULTS = Object.freeze({ fraction: 1, period: undefined, step: 50, lit: SIGNAL_COLORS.gpt, used: SIGNAL_COLORS.gptUsed, region: undefined });
function check(options) {
  const o = resolveOptions('edge-pulse', options, EDGE_PULSE_DEFAULTS);
  if (!Number.isFinite(o.fraction) || o.fraction < 0 || o.fraction > 1) throw new RangeError('edge-pulse fraction must be 0–1');
  o.period ??= 600 + 3400 * o.fraction; assertMs(o.period, 'edge-pulse period', { min: 1 }); assertMs(o.step, 'edge-pulse step', { min: 1 });
  resolveColor(o.lit); resolveColor(o.used); o.region = resolveRegion('edge-pulse', o.region); return o;
}
// footer.ts:219,238–242,781–786. Only the highest lit square per targeted line can resize.
export function edgePulse(lines, options = {}) {
  assertLines(lines); const o = check(options); assertTime(o, 'edge-pulse');
  if (!o.animate) return copyLines(lines);
  // At custom periods shorter than the source pulse, scale steps to leave a quiet opening quarter.
  const step = Math.min(o.step, o.period / 4), at = o.time % o.period - (o.period - 3 * step);
  if (at < 0) return copyLines(lines);
  const edges = [];
  restyleCells(lines, (style, col, row, ch) => {
    if (inRegion(o.region, col, row) && ch === '■' && resolveColor(style.fg ?? 'secondary').toLowerCase() === resolveColor(o.lit).toLowerCase()) edges[row] = col;
  });
  const k = Math.min(2, Math.floor(at / step));
  return restyleCells(lines, (style, col, row) => col === edges[row] ? { char: k < 2 ? '▪' : '■', style: { ...style, fg: k ? o.used : o.lit } } : undefined);
}
