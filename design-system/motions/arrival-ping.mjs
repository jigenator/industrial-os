import { resolveColor } from '../foundation/cells.mjs';
import { assertLines, assertMs, assertTime, copyLines, inRegion, resolveOptions, resolveRegion, restyleCells } from './frame.mjs';
export const ARRIVAL_PING_DEFAULTS = Object.freeze({ duration: 1600, x: 0, y: 0, radius: 16, region: undefined });
function check(options) {
  const o = resolveOptions('arrival-ping', options, ARRIVAL_PING_DEFAULTS); assertMs(o.duration, 'ping duration', { min: 1 });
  for (const key of ['x', 'y', 'radius']) if (!Number.isInteger(o[key]) || o[key] < 0 || o[key] > 1000) throw new RangeError('ping geometry must be 0–1000');
  if (!o.region) throw new TypeError('arrival-ping needs an explicit decoration-only region');
  o.region = resolveRegion('arrival-ping', o.region); return o;
}
export function arrivalPingDuration(options = {}) { return check(options).duration * 1.25; }
export function arrivalPing(lines, options = {}) {
  assertLines(lines); const o = check(options); assertTime(o, 'arrival-ping');
  if (!o.animate || o.time >= o.duration * 1.25) return copyLines(lines);
  const u = o.time / o.duration;
  return restyleCells(lines, (style, col, row, ch) => {
    if (!inRegion(o.region, col, row) || ch !== ' ') return undefined;
    const r = Math.hypot((col - o.x) / 2, row - o.y);
    if ([u, u - 0.25].some(v => v > 0 && v <= 1 && Math.abs(r - v * o.radius) < 0.45)) { const bg=resolveColor(style.bg??'field'), k=0.55*(1-0.7*r/Math.max(1,o.radius)); const fg='#'+[1,3,5].map(i=>Math.round(parseInt(bg.slice(i,i+2),16)*(1-k)+255*k).toString(16).padStart(2,'0')).join(''); return { char: '·', style: { ...style, fg } }; }
    return undefined;
  });
}
