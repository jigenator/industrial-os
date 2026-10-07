import { resolveColor } from '../foundation/cells.mjs';
import { mixOver } from '../foundation/signal-colors.mjs';
import { MIN_PERIOD_MS, assertLines, assertMs, assertTime, copyLines, inRegion, resolveOptions, resolveRegion, restyleCells } from './frame.mjs';

// status-bar's Tatsu attention beacon (pi/status-bar/src/footer.ts TATSU_BEACON_PERIOD_MS, TATSU_BEACON_STEP_MS).
export const BEACON_DEFAULTS = Object.freeze({ period: 4000, step: 50, region: undefined, stateCells: false });

const STEPS = 3;

function check(o) {
  assertMs(o.period, 'beacon period', { min: MIN_PERIOD_MS });
  assertMs(o.step, 'beacon step', { min: MIN_PERIOD_MS });
  if (STEPS * o.step > o.period) throw new RangeError(`beacon period must hold its ${STEPS} steps (${STEPS * o.step} ms), got ${o.period}`);
  if (typeof o.stateCells !== 'boolean') throw new TypeError(`beacon stateCells must be a boolean, got ${o.stateCells}`);
  return resolveRegion('beacon', o.region);
}

// A looping attention beacon on every `▲` cell in `region` (default the whole block). In the last three steps of each
// period, so a period never opens on a pulse: `▴` in the cell's own ink, `▴` in its 50% mix over the field, `▲` in
// that mix; the rest of the period is settled. Only the triangle's size and ink change. Warning and critical cells
// are exempt unless `stateCells` is true; amber's 50% mix is warning50, status-bar's warnDim.
export function beacon(lines, options = {}) {
  const o = resolveOptions('beacon', options, BEACON_DEFAULTS);
  assertLines(lines);
  const region = check(o);
  assertTime(o, 'beacon');
  if (!o.animate) return copyLines(lines);

  const at = (o.time % o.period) - (o.period - STEPS * o.step);
  if (at < 0) return copyLines(lines);
  const step = Math.floor(at / o.step);
  return restyleCells(lines, (style, col, row, ch) => {
    if (ch !== '▲' || !inRegion(region, col, row)) return undefined;
    const char = step < 2 ? '▴' : undefined;
    if (step === 0) return { char };
    const dim = mixOver(style.fg ?? 'secondary', 0.5);
    // Never give a glyph its background's color: only resize it then.
    const hidden = dim.toLowerCase() === resolveColor(style.bg ?? 'field').toLowerCase();
    return { style: hidden ? style : { ...style, fg: dim }, char };
  }, { stateCells: o.stateCells });
}
