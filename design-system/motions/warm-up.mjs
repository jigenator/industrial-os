import { isTerminalDefault, resolveColor } from '../foundation/cells.mjs';
import { mixOver } from '../foundation/signal-colors.mjs';
import { MIN_PERIOD_MS, assertLines, assertMs, assertTime, copyLines, inRegion, resolveOptions, resolveRegion, restyleCells } from './frame.mjs';

// status-bar's Tatsu warm-up (pi/status-bar/src/footer.ts TATSU_WARM_STEP_TICKS): each step is two 50 ms ticks.
export const WARM_UP_DEFAULTS = Object.freeze({ step: 100, delays: Object.freeze([]), stateCells: false });

const STEPS = [0.25, 0.5, 0.75];
const MAX_DELAYS = 1000;

function check(o) {
  assertMs(o.step, 'warmUp step', { min: MIN_PERIOD_MS });
  if (!Array.isArray(o.delays) || o.delays.length > MAX_DELAYS) throw new RangeError(`warmUp delays must be an array of at most ${MAX_DELAYS} { region, delay } entries`);
  const delays = o.delays.map((entry) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) throw new RangeError('each warmUp delays entry must be { region, delay }');
    for (const key of Object.keys(entry)) if (key !== 'region' && key !== 'delay') throw new TypeError(`warmUp delays entry has no field '${key}'`);
    assertMs(entry.delay, 'warmUp delay');
    return { region: resolveRegion('warmUp delays', entry.region), delay: entry.delay };
  });
  if (typeof o.stateCells !== 'boolean') throw new TypeError(`warmUp stateCells must be a boolean, got ${o.stateCells}`);
  return delays;
}

// Total ms until every cell has its settled color: the longest delay plus three steps.
export function warmUpDuration(options = {}) {
  const o = resolveOptions('warmUp', options, WARM_UP_DEFAULTS);
  const delays = check(o);
  return delays.reduce((max, d) => Math.max(max, d.delay), 0) + STEPS.length * o.step;
}

// One-shot phosphor warm-up: each cell's foreground starts at the field (invisible), then steps through 25%, 50% and
// 75% of its settled color over the field (mixOver), one step each `step` ms, then takes its settled color. A cell
// starts after the delay of the first `delays` entry whose region holds it, or at once. Color only: every character
// is the current one from the first frame. Warning and critical cells are exempt unless `stateCells` is true; then
// they start at the 25% step instead of the field, so their cue is never hidden.
export function warmUp(lines, options = {}) {
  const o = resolveOptions('warmUp', options, WARM_UP_DEFAULTS);
  assertLines(lines);
  const delays = check(o);
  assertTime(o, 'warmUp');
  if (!o.animate) return copyLines(lines);

  return restyleCells(lines, (style, col, row, ch, state) => {
    const delay = delays.find((d) => inRegion(d.region, col, row))?.delay ?? 0;
    const step = Math.floor((o.time - delay) / o.step);
    if (step >= STEPS.length) return undefined;
    const fg = style.fg ?? 'secondary';
    const ink = step >= 0 ? mixOver(fg, STEPS[step]) : state ? mixOver(fg, STEPS[0]) : 'field';
    // A state cell must never take its background's color; keep it settled instead.
    if (state && !isTerminalDefault(style.bg) && resolveColor(ink).toLowerCase() === resolveColor(style.bg ?? 'field').toLowerCase()) return undefined;
    return { style: { ...style, fg: ink } };
  }, { stateCells: o.stateCells });
}
