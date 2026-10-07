import { resolveColor } from '../foundation/cells.mjs';
import { assertLines, assertMs, assertTime, copyLines, inRegion, resolveOptions, resolveRegion, restyleCells } from './frame.mjs';

// status-bar's Tatsu state latch (pi/status-bar/src/footer.ts TATSU_LATCH_TICKS): tick 0 locked, ticks 1-2 inverted.
export const LATCH_DEFAULTS = Object.freeze({ lock: 50, invert: 100, region: undefined, stateCells: false });

// The path lock: bold black on acid.
const LOCKED = Object.freeze({ fg: 'field', bg: 'accent', bold: true });
const same = (a, b) => resolveColor(a).toLowerCase() === resolveColor(b).toLowerCase();

function check(o) {
  assertMs(o.lock, 'latch lock');
  assertMs(o.invert, 'latch invert');
  if (typeof o.stateCells !== 'boolean') throw new TypeError(`latch stateCells must be a boolean, got ${o.stateCells}`);
  return resolveRegion('latch', o.region);
}

// Total ms until the latch has settled.
export function latchDuration(options = {}) {
  const o = resolveOptions('latch', options, LATCH_DEFAULTS);
  check(o);
  return o.lock + o.invert;
}

// One-shot state-change latch on the cells of `region` (default the whole block): for `lock` ms they are LOCKED (bold
// black on acid), for the next `invert` ms inverted (bold, foreground and background swapped, so a state-colored
// glyph on the field becomes black on its state color), then settled. Characters never change. Warning and critical
// cells are exempt unless `stateCells` is true; every frame then keeps their shape and word readable.
export function latch(lines, options = {}) {
  const o = resolveOptions('latch', options, LATCH_DEFAULTS);
  assertLines(lines);
  const region = check(o);
  assertTime(o, 'latch');
  if (!o.animate || o.time >= o.lock + o.invert) return copyLines(lines);

  const locked = o.time < o.lock;
  return restyleCells(lines, (style, col, row) => {
    if (!inRegion(region, col, row)) return undefined;
    if (locked) return { style: LOCKED };
    const fg = style.fg ?? 'secondary', bg = style.bg ?? 'field';
    // Swapping equal colors changes nothing, and on a state cell would hide its glyph.
    return same(fg, bg) ? undefined : { style: { fg: bg, bg: fg, bold: true } };
  }, { stateCells: o.stateCells });
}
