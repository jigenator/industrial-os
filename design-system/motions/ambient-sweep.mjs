import { AMBIENT_GRID as A, ambientInk, ambientSweepLift, ambientRegistrations } from '../foundation/ambient.mjs';
import { resolveColor } from '../foundation/cells.mjs';
import { assertLines, assertMs, assertTime, copyLines, inRegion, resolveOptions, resolveRegion, restyleCells } from './frame.mjs';
export const AMBIENT_SWEEP_DEFAULTS = Object.freeze({ period: A.sweepPeriod, run: A.sweepRun, region: undefined });
export function ambientSweep(lines, options = {}) {
  assertLines(lines); const o = resolveOptions('ambient-sweep', options, AMBIENT_SWEEP_DEFAULTS); assertMs(o.period, 'sweep period', { min: 1 }); assertMs(o.run, 'sweep run', { min: 1 }); assertTime(o, 'ambient-sweep');
  if (o.run > o.period) throw new RangeError('sweep run exceeds period');
  const r = resolveRegion('ambient-sweep', o.region);
  const marks = ambientRegistrations(lines);
  if (!o.animate) return copyLines(lines);
  const h = Math.min(lines.length - r.top, r.rows);
  return restyleCells(lines, (style, col, row, ch) => {
    if (!inRegion(r, col, row) || !'┼│─·'.includes(ch)) return undefined;
    if(marks.some(mark => (row===mark.y&&Math.abs(col-mark.x)<=2)||(col===mark.x&&Math.abs(row-mark.y)===1)))return undefined;
    const lift = ambientSweepLift(row-r.top,h,o.time,o.period,o.run);
    if (!lift) return undefined;
    const hex = resolveColor(style.fg ?? 'secondary'), base=charBase(ch), bg=style.bg??'field', from=ambientInk(bg,base), to=ambientInk(bg,base+lift), fg = '#' + [1, 3, 5].map(i => Math.min(255, Math.max(0,parseInt(hex.slice(i,i+2),16)+parseInt(to.slice(i,i+2),16)-parseInt(from.slice(i,i+2),16))).toString(16).padStart(2,'0')).join('');
    return { style: { ...style, fg } };
  });
}

const charBase = ch => ch === '·' ? A.dotLift : A.gridLift;
