import { SIGNAL_COLORS } from '../foundation/signal-colors.mjs';
import { assertLines, assertTime, copyLines, inRegion, resolveOptions, resolveRegion, restyleCells } from './frame.mjs';

export const SOUNDING_SWEEP_DEFAULTS = Object.freeze({ region: undefined });
const columnAt = (time) => { const step = Math.floor(time / 40) % 22; return step < 12 ? step : 22 - step; };

export function soundingSweep(lines, options = {}) {
  const o = resolveOptions('soundingSweep', options, SOUNDING_SWEEP_DEFAULTS);
  assertLines(lines); assertTime(o, 'soundingSweep');
  const region = resolveRegion('soundingSweep', o.region);
  if (!o.animate) return copyLines(lines);
  const head = columnAt(o.time), previous = columnAt(Math.max(0, o.time - 40));
  return restyleCells(lines, (style, col, row, ch) => {
    if (!inRegion(region, col, row) || col - region.left >= 6 || !/[\u2800-\u28ff]/u.test(ch)) return undefined;
    let bits = 0x24, fg = SIGNAL_COLORS.ghost;
    for (const [dot, ink] of [[previous, SIGNAL_COLORS.accent50], [head, 'accent']]) if (Math.floor(dot / 2) === col - region.left) { bits |= dot % 2 ? 0xb8 : 0x47; fg = ink; }
    return { char: String.fromCodePoint(0x2800 + bits), style: { ...style, fg } };
  });
}
