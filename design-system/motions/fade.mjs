import { isTerminalDefault, resolveColor } from '../foundation/cells.mjs';
import { ACID_BLACK } from '../foundation/palette.mjs';
import { SIGNAL_COLORS } from '../foundation/signal-colors.mjs';
import { MIN_PERIOD_MS, assertLines, assertMs, assertTime, copyLines, inRegion, resolveOptions, resolveRegion, restyleCells } from './frame.mjs';

// status-bar's Tatsu checking fade (pi/status-bar/src/footer.ts TATSU_CHECK_FADE_INKS): eight 150 ms steps.
const { checkLow, checkMid, checkHigh, checkPeak } = SIGNAL_COLORS;
export const FADE_DEFAULTS = Object.freeze({
  levels: Object.freeze(['decorative', checkLow, checkMid, checkHigh, checkPeak, checkHigh, checkMid, checkLow]),
  period: 1200,
  roles: Object.freeze(['decorative']),
  region: undefined,
});

const MAX_LEVELS = 1000;
// Warning and critical are excluded so a fault never fades.
const FADE_ROLES = Object.keys(ACID_BLACK).filter((r) => r !== 'warning' && r !== 'critical');
const isColor = (c) => {
  if (isTerminalDefault(c)) throw new TypeError('fade requires a concrete color, not terminal default');
  try { resolveColor(c); return true; } catch { return false; }
};

function check(o) {
  if (!Array.isArray(o.levels) || o.levels.length === 0 || o.levels.length > MAX_LEVELS || !o.levels.every(isColor)) {
    throw new RangeError(`fade levels must be a non-empty array of Acid / Black roles or #rrggbb colors, got ${JSON.stringify(o.levels)}`);
  }
  assertMs(o.period, 'fade period', { min: MIN_PERIOD_MS });
  if (!Array.isArray(o.roles) || o.roles.length === 0 || o.roles.some((r) => !FADE_ROLES.includes(r))) {
    throw new RangeError(`fade roles must be a non-empty array of ${FADE_ROLES.join(', ')}, got ${JSON.stringify(o.roles)}`);
  }
  return resolveRegion('fade', o.region);
}

// A looping ink wave: every non-space cell in `region` (default the whole block) whose foreground is one of `roles`
// takes levels[i], the period split into equal steps. The default levels are a gentle triangle wave up from
// decorative grey and back. Foreground only; characters, background and bold are unchanged. Warning and critical
// cells are exempt. With the defaults, frame at time 0 equals the input.
export function fade(lines, options = {}) {
  const o = resolveOptions('fade', options, FADE_DEFAULTS);
  assertLines(lines);
  const region = check(o);
  assertTime(o, 'fade');
  if (!o.animate) return copyLines(lines);

  const n = o.levels.length;
  const ink = o.levels[Math.min(n - 1, Math.floor(((o.time % o.period) * n) / o.period))];
  return restyleCells(lines, (style, col, row, ch) => (ch !== ' ' && o.roles.includes(style.fg ?? 'secondary') && inRegion(region, col, row) ? { style: { ...style, fg: ink } } : undefined));
}
