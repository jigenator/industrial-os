import { assertCells, fitLine, resolveColor, span } from '../../foundation/cells.mjs';
import { hash } from '../../foundation/seeded.mjs';

// footer.ts:325-331: 3×5 FONT, with a one-pixel-column decimal point.
export const FONT = Object.freeze(Object.fromEntries(Object.entries({
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'], 3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '001', '001', '001'],
  8: ['111', '101', '111', '101', '111'], 9: ['111', '101', '111', '001', '111'],
  '.': ['0', '0', '0', '0', '1'], '-': ['000', '000', '111', '000', '000'],
  '?': ['111', '001', '011', '000', '010'],
}).map(([key, rows]) => [key, Object.freeze(rows)])));
export const NUMERAL_TONES = Object.freeze({ ok: 'primary', warn: 'warning', high: 'critical', unknown: 'decorative' });
function reading(value, tone) {
  const known = value !== null && value !== undefined;
  if (known && (typeof value !== 'number' || !Number.isFinite(value))) throw new RangeError('numeral value must be finite or null');
  if (tone !== undefined && !Object.hasOwn(NUMERAL_TONES, tone)) throw new RangeError('unknown numeral tone');
  if (!known && tone !== undefined && tone !== 'unknown') throw new RangeError('unknown value requires unknown tone');
  return { text: known ? value.toFixed(1) : '?', ink: NUMERAL_TONES[tone ?? (!known ? 'unknown' : value > 90 ? 'high' : value > 70 ? 'warn' : 'ok')] };
}

// footer.ts:332-346: six pixel rows (last empty), minimum width 13, one empty column between glyphs.
export function numeralGrid(value, { tone } = {}) {
  const { text, ink } = reading(value, tone);
  if (![...text].every((ch) => Object.hasOwn(FONT, ch))) return undefined;
  const cols = [];
  [...text].forEach((ch, i) => {
    if (i) cols.push(Array(5).fill(false));
    for (let x = 0; x < FONT[ch][0].length; x++) cols.push(FONT[ch].map((row) => row[x] === '1'));
  });
  const w = Math.max(13, cols.length);
  return { w, g: Array.from({ length: 6 }, (_, y) => Array.from({ length: w }, (_, x) => cols[x]?.[y] ? ink : null)) };
}
function validateGrid(grid) {
  if (!grid || !Number.isInteger(grid.w) || grid.w < 1 || grid.w > 1000 ||
      !Array.isArray(grid.g) || grid.g.length !== 6 || grid.g.some((row) => !Array.isArray(row) || row.length !== grid.w)) {
    throw new TypeError('numeral grid must have w (1–1000) and six rows of w colors or null');
  }
  for (const row of grid.g) for (const color of row) if (color !== null) resolveColor(color);
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
// footer.ts:351-359: old-only pixels vanish immediately; current shape acquires current ink from grey.
export function numeralAt(target, from, progress, seed) {
  validateGrid(target);
  validateGrid(from);
  if (typeof progress !== 'number' || !Number.isFinite(progress) || progress < 0 || progress > 1) throw new RangeError('progress must be 0–1');
  if (!Number.isInteger(seed)) throw new RangeError('seed must be an integer');
  return { w: target.w, g: target.g.map((row, y) => row.map((now, x) => {
    if (now === null || now === from.g[y][x]) return now;
    const threshold = 0.25 + ((BAYER[(y % 4) * 4 + x % 4] + hash(x + 1, y + 1, seed)) / 16) * 0.75;
    return progress >= threshold ? now : now === 'decorative' ? 'secondary' : 'decorative';
  })) };
}
// footer.ts:1483-1487: square half-block pixels, including differing upper/lower colors.
export function numeralLines(grid, { width } = {}) {
  assertCells(width, 'numeral width');
  validateGrid(grid);
  if (width < grid.w) throw new RangeError('numeralLines width must fit the entire grid; use pixelNumeral for narrow fallback');
  return Array.from({ length: 3 }, (_, y) => fitLine(Array.from({ length: grid.w }, (_, x) => {
    const top = grid.g[2 * y][x], bottom = grid.g[2 * y + 1][x];
    return !top && !bottom ? span(' ') : !top ? span('▄', { fg: bottom }) : !bottom ? span('▀', { fg: top }) :
      top === bottom ? span('█', { fg: top }) : span('▀', { fg: top, bg: bottom });
  }), width));
}
export function pixelNumeral({ value, tone }, { width } = {}) {
  assertCells(width, 'numeral width');
  const r = reading(value, tone), grid = numeralGrid(value, { tone });
  if (grid && grid.w <= width) return numeralLines(grid, { width });
  // No cropped digits or exponent-shaped pixel guess: small exact text, or # if it cannot fit.
  return [fitLine([span(r.text.length <= width ? r.text : '#'.repeat(width), { fg: r.ink, bold: true })], width), fitLine([], width), fitLine([], width)];
}
