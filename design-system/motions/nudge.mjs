import { assertLines, assertMs, assertTime, copyLines, inRegion, isStateCell, resolveOptions, resolveRegion, restyleCells } from './frame.mjs';
import { GLYPHS } from '../foundation/cells.mjs';

export const NUDGE_DEFAULTS = Object.freeze({ glyph: '┼', period: 6000, tick: 50, region: undefined });
const CAL = Object.freeze([1, 1, 0, -1, -1, 0]);
// footer.ts:365–366,500,1549–1550. Shifted marks brighten to bold acid; never displace a reading.
export function nudge(lines, options = {}) {
  assertLines(lines); const o = resolveOptions('nudge', options, NUDGE_DEFAULTS);
  assertMs(o.period, 'nudge period', { min: 1 }); assertMs(o.tick, 'nudge tick', { min: 1 });
  if (typeof o.glyph !== 'string' || !GLYPHS.includes(o.glyph) || [...o.glyph].length !== 1) throw new RangeError('nudge glyph must be one GLYPHS character');
  o.region = resolveRegion('nudge', o.region); assertTime(o, 'nudge');
  if (!o.animate) return copyLines(lines);
  const delta = CAL[Math.floor((o.time % o.period) / o.tick)] ?? 0;
  if (!delta) return copyLines(lines);
  const cells = lines.map((line) => line.flatMap((s) => [...s.text].map((ch) => ({ ch, style: s.style }))));
  let mark;
  for (let row = 0; row < cells.length && !mark; row++) {
    const col = cells[row].findIndex((c, col) => c.ch === o.glyph && !isStateCell(c.style) && inRegion(o.region, col, row));
    if (col >= 0) mark = { row, col };
  }
  const dest = mark && cells[mark.row][mark.col + delta];
  if (!dest || dest.ch !== ' ' || isStateCell(dest.style) || !inRegion(o.region, mark.col + delta, mark.row)) return copyLines(lines);
  return restyleCells(lines, (style, col, row) => {
    if (row !== mark.row) return undefined;
    if (col === mark.col) return { char: ' ', style: dest.style };
    if (col === mark.col + delta) return { char: o.glyph, style: { ...cells[row][mark.col].style, fg: 'accent', bold: true } };
  });
}
