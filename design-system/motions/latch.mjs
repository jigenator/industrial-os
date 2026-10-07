import { assertLines, assertMs, assertTime, copyLines, inRegion, invertCell, resolveOptions, resolveRegion, restyleCells } from './frame.mjs';

// status-bar's Tatsu state latch (pi/status-bar/src/footer.ts TATSU_LATCH_TICKS): tick 0 locked, ticks 1-2 inverted.
export const LATCH_DEFAULTS = Object.freeze({ lock: 50, invert: 100, region: undefined, stateCells: false });

// The path lock: bold black on acid. A full block shows only its foreground, so it locks as a solid acid block.
const LOCKED = Object.freeze({ fg: 'field', bg: 'accent', bold: true });
const LOCKED_BLOCK = Object.freeze({ fg: 'accent', bg: 'accent', bold: true });

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
// black on acid; a full block locks solid acid), for the next `invert` ms inverted (bold, foreground and background
// swapped, so a state-colored glyph on the field becomes black on its state color; a full block takes its background
// color, or keeps its look on the field), then settled. Characters never change. Warning and critical
// cells are exempt unless `stateCells` is true; every frame then keeps their shape and word readable.
export function latch(lines, options = {}) {
  const o = resolveOptions('latch', options, LATCH_DEFAULTS);
  assertLines(lines);
  const region = check(o);
  assertTime(o, 'latch');
  if (!o.animate || o.time >= o.lock + o.invert) return copyLines(lines);

  const locked = o.time < o.lock;
  return restyleCells(lines, (style, col, row, ch) => {
    if (!inRegion(region, col, row)) return undefined;
    if (locked) return { style: ch === '█' ? LOCKED_BLOCK : LOCKED };
    // A swap that would hide the glyph (equal colors, or a full block on the field) keeps the cell.
    const next = invertCell({ fg: style.fg, bg: style.bg }, ch, { bold: true });
    return next && { style: next };
  }, { stateCells: o.stateCells });
}
