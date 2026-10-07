import { assertLines, assertMs, assertTime, copyLines, inRegion, resolveOptions, resolveRegion, restyleCells } from './frame.mjs';
import { resolveColor } from '../foundation/cells.mjs';
import { SIGNAL_COLORS } from '../foundation/signal-colors.mjs';

export const BURN_OUT_PRESETS = Object.freeze(Object.fromEntries(['gpt', 'cld', 'kmi'].map((p) => [p, Object.freeze({ lit: SIGNAL_COLORS[p], mid: SIGNAL_COLORS[p + 'Mid'], used: SIGNAL_COLORS[p + 'Used'] })])));
export const BURN_OUT_DEFAULTS = Object.freeze({ ...BURN_OUT_PRESETS.gpt, times: Object.freeze([100, 250, 400, 600]), region: undefined });
function check(options) {
  const o = resolveOptions('burn-out', options, BURN_OUT_DEFAULTS);
  for (const key of ['lit', 'mid', 'used']) resolveColor(o[key]);
  if (!Array.isArray(o.times) || o.times.length !== 4) throw new RangeError('burn-out times must have four entries');
  o.times.forEach((t, i) => { assertMs(t, 'burn-out time', { min: 1 }); if (i && t <= o.times[i - 1]) throw new RangeError('burn-out times must increase'); });
  o.region = resolveRegion('burn-out', o.region); return o;
}
export function burnOutDuration(options = {}) { return check(options).times[3]; }
// footer.ts:216,1260–1264. Input is already the settled ghost; apply only to lost squares.
export function burnOut(lines, options = {}) {
  assertLines(lines); const o = check(options); assertTime(o, 'burn-out');
  if (!o.animate || o.time >= o.times[3]) return copyLines(lines);
  const fg = o.time < o.times[0] ? 'primary' : o.time < o.times[1] ? o.lit : o.time < o.times[2] ? o.mid : o.used;
  return restyleCells(lines, (style, col, row, ch) => inRegion(o.region, col, row) && ch === '■' ? { style: { ...style, fg } } : undefined);
}
