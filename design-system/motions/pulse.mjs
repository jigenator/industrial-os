import { MIN_PERIOD_MS, assertLines, assertMs, assertTime, copyLines, phase, resolveOptions, restyleCells } from './frame.mjs';

export const PULSE_DEFAULTS = Object.freeze({ period: 2000, roles: Object.freeze(['accent']) });

// Only roles that carry emphasis can pulse. Warning and critical are excluded so a fault never fades.
const PULSE_ROLES = ['accent', 'primary', 'secondary'];

// Alternates matching cells between their own style (first half of the period) and dim grey (second half).
// Text never changes. Frame at time 0 equals the input. Meant for an active-signal marker, so pass
// only lines whose accent cells really are active.
export function pulse(lines, options = {}) {
  const o = resolveOptions('pulse', options, PULSE_DEFAULTS);
  assertLines(lines);
  assertMs(o.period, 'pulse period', { min: MIN_PERIOD_MS });
  if (!Array.isArray(o.roles) || o.roles.length === 0 || o.roles.some((r) => !PULSE_ROLES.includes(r))) {
    throw new RangeError(`pulse roles must be a non-empty array of ${PULSE_ROLES.join(', ')}, got ${JSON.stringify(o.roles)}`);
  }
  assertTime(o, 'pulse');
  if (!o.animate) return copyLines(lines);

  if (phase(o.time, o.period) < 0.5) return copyLines(lines);
  return restyleCells(lines, (style) => (o.roles.includes(style.fg ?? 'secondary') ? { style: { ...style, fg: 'decorative', bold: false } } : undefined));
}
