import { resolveColor } from '../foundation/cells.mjs';
import { MIN_PERIOD_MS, assertLines, assertMs, assertTime, copyLines, inRegion, invertCell, resolveOptions, resolveRegion, restyleCells } from './frame.mjs';

// The defaults are claude-interrupt's plate flash (pi/claude-interrupt/src/index.ts FLASH_OFF, FLASH_ON): 0-79 ms
// filled, 80-159 ms outline, then filled.
export const FLASH_DEFAULTS = Object.freeze({ step: 80, pattern: Object.freeze(['fill', 'outline']), region: undefined, stateCells: false });

// Extension flashes as ready-made option sets; target the plate or cell with `region`.
export const FLASH_PRESETS = Object.freeze({
  // claude-interrupt's two whole-plate flashes: on, off, on.
  interrupt: Object.freeze({ step: 80, pattern: Object.freeze(['fill', 'outline']) }),
  // status-bar's 70/90 threshold crossing (FLASH_TICKS, flash70/flash90): the mark turns white on ticks 1, 3 and 5.
  threshold: Object.freeze({ step: 50, pattern: Object.freeze(['fill', 'white', 'fill', 'white', 'fill', 'white']) }),
  // status-bar's CMP plate at boot: its approved pair swapped for two ticks.
  polarity: Object.freeze({ step: 50, pattern: Object.freeze(['invert', 'invert']) }),
  // status-bar's readout tag during a context-tone wipe (TAG_TICKS, tagFlash): inverted on ticks 1-2 and 5-6.
  tag: Object.freeze({ step: 50, pattern: Object.freeze(['fill', 'invert', 'invert', 'fill', 'fill', 'invert', 'invert']) }),
});

const KINDS = ['fill', 'outline', 'invert', 'white'];
const MAX_PATTERN = 1000;
const same = (a, b) => resolveColor(a).toLowerCase() === resolveColor(b).toLowerCase();

function check(o) {
  assertMs(o.step, 'flash step', { min: MIN_PERIOD_MS });
  if (!Array.isArray(o.pattern) || o.pattern.length === 0 || o.pattern.length > MAX_PATTERN || o.pattern.some((k) => !KINDS.includes(k))) {
    throw new RangeError(`flash pattern must be a non-empty array of ${KINDS.join(', ')}, got ${JSON.stringify(o.pattern)}`);
  }
  if (typeof o.stateCells !== 'boolean') throw new TypeError(`flash stateCells must be a boolean, got ${o.stateCells}`);
  return resolveRegion('flash', o.region);
}

// Total ms until the flash has settled: one step per pattern entry.
export function flashDuration(options = {}) {
  const o = resolveOptions('flash', options, FLASH_DEFAULTS);
  check(o);
  return o.pattern.length * o.step;
}

// How one cell looks in one pattern step; undefined keeps it.
function frameOf(kind, style, ch) {
  const bg = style.bg ?? 'field';
  if (kind === 'outline') return same(bg, 'field') ? undefined : { ...style, fg: bg, bg: 'field' };
  if (kind === 'invert') return invertCell(style, ch);
  if (kind === 'white') return ch === '█' ? { ...style, fg: 'primary' } : { fg: 'field', bg: 'primary', bold: true };
  return undefined;
}

// One-shot flash on the cells of `region` (default the whole block): pattern[floor(time / step)], then settled.
// 'fill' is the input; 'outline' removes a filled background and letters the cell in its fill color; 'invert' swaps
// foreground and background; 'white' turns the cell white with black marks (a full block stays solid white).
// Characters never change. Warning and critical cells are exempt unless `stateCells` is true; every frame then keeps
// their shape and word readable. At flashDuration() and beyond, or with animate: false, the output equals the input.
export function flash(lines, options = {}) {
  const o = resolveOptions('flash', options, FLASH_DEFAULTS);
  assertLines(lines);
  const region = check(o);
  assertTime(o, 'flash');
  const kind = o.animate ? o.pattern[Math.floor(o.time / o.step)] : undefined;
  if (kind === undefined || kind === 'fill') return copyLines(lines);

  return restyleCells(lines, (style, col, row, ch) => {
    if (!inRegion(region, col, row)) return undefined;
    const next = frameOf(kind, style, ch);
    return next && { style: next };
  }, { stateCells: o.stateCells });
}
