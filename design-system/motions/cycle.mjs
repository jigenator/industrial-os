import { GLYPHS } from '../foundation/cells.mjs';
import { MIN_PERIOD_MS, assertLines, assertMs, assertTime, copyLines, inRegion, resolveOptions, resolveRegion, restyleCells } from './frame.mjs';

// status-bar's Tatsu checking placeholder (pi/status-bar/src/footer.ts takes its glyphs from here; TATSU_CHECK_STEP_MS).
export const CYCLE_DEFAULTS = Object.freeze({ glyphs: Object.freeze(['·', '•', '•', '•', '·']), step: 150, region: undefined });

const MAX_GLYPHS = 1000;

function check(o) {
  if (!Array.isArray(o.glyphs) || o.glyphs.length === 0 || o.glyphs.length > MAX_GLYPHS || o.glyphs.some((g) => typeof g !== 'string' || [...g].length !== 1 || !GLYPHS.includes(g))) {
    throw new RangeError(`cycle glyphs must be a non-empty array of single characters from GLYPHS, got ${JSON.stringify(o.glyphs)}`);
  }
  assertMs(o.step, 'cycle step', { min: MIN_PERIOD_MS });
  return resolveRegion('cycle', o.region);
}

// A looping placeholder: every cell in `region` (default the whole block) whose character is one of `glyphs` shows
// glyphs[floor(time / step) % glyphs.length]. Size and glyph only; style and every other character are unchanged.
// Warning and critical cells are exempt. Frame at time 0 shows the first glyph.
export function cycle(lines, options = {}) {
  const o = resolveOptions('cycle', options, CYCLE_DEFAULTS);
  assertLines(lines);
  const region = check(o);
  assertTime(o, 'cycle');
  if (!o.animate) return copyLines(lines);

  const glyph = o.glyphs[Math.floor(o.time / o.step) % o.glyphs.length];
  return restyleCells(lines, (style, col, row, ch) => (o.glyphs.includes(ch) && inRegion(region, col, row) ? { char: glyph } : undefined));
}
