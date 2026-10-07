import { GLYPHS, resolveColor } from '../foundation/cells.mjs';
import { MIN_PERIOD_MS, assertLines, assertMs, assertTime, copyLines, inRegion, resolveOptions, resolveRegion, restyleCells } from './frame.mjs';

// The defaults are status-bar's Thread Rail lamp (pi/status-bar/src/footer.ts lampOn): 500 ms on, 300 ms dim.
export const BLINK_DEFAULTS = Object.freeze({ on: 500, off: 300, offStyle: Object.freeze({ bg: 'surface' }), offGlyph: null, region: undefined });

// Extension blinks as ready-made option sets; target the cell with `region`.
export const BLINK_PRESETS = Object.freeze({
  // Thread Rail lamp: a blank cell on acid, dimmed to surface. 1.25 cycles a second.
  lamp: Object.freeze({ on: 500, off: 300, offStyle: Object.freeze({ bg: 'surface' }) }),
  // PNYTL activity light (lightOn): the lit pink `•` alternates with the black `⌑` icon every 50 ms, 10 cycles a second.
  activityLight: Object.freeze({ on: 50, off: 50, offStyle: Object.freeze({ fg: 'field' }), offGlyph: '⌑' }),
});

const LETTER_OR_DIGIT = /[A-Za-z0-9]/;
const isColor = (c) => {
  try { resolveColor(c); return true; } catch { return false; }
};

function check(o) {
  assertMs(o.on, 'blink on', { min: MIN_PERIOD_MS });
  assertMs(o.off, 'blink off', { min: MIN_PERIOD_MS });
  const s = o.offStyle;
  if (s === null || typeof s !== 'object' || Array.isArray(s)) throw new RangeError('blink offStyle must be an object of fg, bg and bold');
  for (const key of Object.keys(s)) {
    if (key === 'fg' || key === 'bg') { if (!isColor(s[key])) throw new RangeError(`blink offStyle ${key} must be an Acid / Black role or #rrggbb, got ${s[key]}`); }
    else if (key === 'bold') { if (typeof s.bold !== 'boolean') throw new RangeError(`blink offStyle bold must be a boolean, got ${s.bold}`); }
    else throw new TypeError(`blink offStyle has no field '${key}'`);
  }
  if (o.offGlyph !== null && (typeof o.offGlyph !== 'string' || [...o.offGlyph].length !== 1 || !GLYPHS.includes(o.offGlyph))) {
    throw new RangeError(`blink offGlyph must be null or one character from GLYPHS, got ${JSON.stringify(o.offGlyph)}`);
  }
  return resolveRegion('blink', o.region);
}

// A looping blink on the cells of `region` (default the whole block): their own style for `on` ms, then `offStyle`
// merged over it, and `offGlyph` in place of any character that is not a letter or digit, for `off` ms. The input is
// the "on" frame, which is also the settled one. Warning and critical cells are exempt. Frame at time 0 equals the input.
export function blink(lines, options = {}) {
  const o = resolveOptions('blink', options, BLINK_DEFAULTS);
  assertLines(lines);
  const region = check(o);
  assertTime(o, 'blink');
  if (!o.animate || o.time % (o.on + o.off) < o.on) return copyLines(lines);

  return restyleCells(lines, (style, col, row, ch) => {
    if (!inRegion(region, col, row)) return undefined;
    const char = o.offGlyph !== null && !LETTER_OR_DIGIT.test(ch) ? o.offGlyph : undefined;
    return { style: { ...style, ...o.offStyle }, char };
  });
}
