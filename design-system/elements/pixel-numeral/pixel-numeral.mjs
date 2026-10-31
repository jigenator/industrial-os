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
// Hex letters for unit codes such as a session's last four hex digits. Separate from FONT, whose keys are the
// characters a formatted reading can contain; textGrid draws from both.
export const HEX_FONT = Object.freeze(Object.fromEntries(Object.entries({
  A: ['111', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'],
  C: ['111', '100', '100', '100', '111'], D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '111', '100', '111'], F: ['111', '100', '111', '100', '100'],
}).map(([key, rows]) => [key, Object.freeze(rows)])));
// Letters a unit code needs beyond hex, drawn in the same stroke: R keeps B's notched top corner, so it never reads
// as A (the droid header's DRD- prefix). Separate from HEX_FONT, whose keys are hex digits; textGrid draws from all three.
export const LETTER_FONT = Object.freeze(Object.fromEntries(Object.entries({
  R: ['110', '101', '110', '101', '101'],
}).map(([key, rows]) => [key, Object.freeze(rows)])));
// The dashboard face: rounded strokes for digits and ?, as the dispatch-feed type units draw counts. Other
// characters keep their FONT or HEX_FONT glyph. Selected by textGrid's face option; FONT itself is unchanged.
export const DASHBOARD_FONT = Object.freeze(Object.fromEntries(Object.entries({
  2: ['110', '001', '010', '100', '111'], 3: ['110', '001', '010', '001', '110'],
  5: ['111', '100', '110', '001', '110'], 6: ['011', '100', '111', '101', '111'],
  7: ['111', '001', '010', '010', '010'], 9: ['111', '101', '111', '001', '110'],
  '?': ['110', '001', '010', '000', '010'],
}).map(([key, rows]) => [key, Object.freeze(rows)])));
// The tall face: a condensed 4×9 font with one-pixel strokes (the automations monitor's readouts), packed into five
// rows. The colon is one column and the minus three.
export const TALL_FONT = Object.freeze(Object.fromEntries(Object.entries({
  0: ['0110', '1001', '1001', '1001', '1001', '1001', '1001', '1001', '0110'],
  1: ['0010', '0110', '0010', '0010', '0010', '0010', '0010', '0010', '0010'],
  2: ['0110', '1001', '0001', '0001', '0010', '0100', '1000', '1000', '1111'],
  3: ['1110', '0001', '0001', '0001', '0110', '0001', '0001', '0001', '1110'],
  4: ['1001', '1001', '1001', '1001', '1111', '0001', '0001', '0001', '0001'],
  5: ['1111', '1000', '1000', '1000', '1110', '0001', '0001', '0001', '1110'],
  6: ['0110', '1000', '1000', '1000', '1110', '1001', '1001', '1001', '0110'],
  7: ['1111', '0001', '0001', '0010', '0010', '0010', '0100', '0100', '0100'],
  8: ['0110', '1001', '1001', '1001', '0110', '1001', '1001', '1001', '0110'],
  9: ['0110', '1001', '1001', '1001', '0111', '0001', '0001', '0001', '0110'],
  ':': ['0', '0', '1', '0', '0', '0', '1', '0', '0'],
  '-': ['000', '000', '000', '000', '111', '000', '000', '000', '000'],
  '?': ['0110', '1001', '0001', '0001', '0010', '0100', '0100', '0000', '0100'],
}).map(([key, rows]) => [key, Object.freeze(rows)])));
// Each face's glyph for a character; the instrument and dashboard faces fall back to FONT, HEX_FONT and LETTER_FONT.
const FACES = Object.freeze({
  instrument: (ch) => FONT[ch] ?? HEX_FONT[ch] ?? LETTER_FONT[ch],
  dashboard: (ch) => DASHBOARD_FONT[ch] ?? FONT[ch] ?? HEX_FONT[ch] ?? LETTER_FONT[ch],
  tall: (ch) => TALL_FONT[ch],
});
export const NUMERAL_TONES = Object.freeze({ ok: 'primary', warn: 'warning', high: 'critical', unknown: 'decorative' });
function reading(value, tone) {
  const known = value !== null && value !== undefined;
  if (known && (typeof value !== 'number' || !Number.isFinite(value))) throw new RangeError('numeral value must be finite or null');
  if (tone !== undefined && !Object.hasOwn(NUMERAL_TONES, tone)) throw new RangeError('unknown numeral tone');
  if (!known && tone !== undefined && tone !== 'unknown') throw new RangeError('unknown value requires unknown tone');
  return { text: known ? value.toFixed(1) : '?', ink: NUMERAL_TONES[tone ?? (!known ? 'unknown' : value > 90 ? 'high' : value > 70 ? 'warn' : 'ok')] };
}

// footer.ts:332-346: six pixel rows (last empty), one empty column between glyphs, at least minWidth columns.
// The tall face's nine pixel rows round up to ten, five text rows.
function gridOf(chars, ink, minWidth, glyphOf = FACES.instrument, rows = 6) {
  const cols = [];
  chars.forEach((ch, i) => {
    const glyph = glyphOf(ch);
    if (i) cols.push(Array(glyph.length).fill(false));
    for (let x = 0; x < glyph[0].length; x++) cols.push(glyph.map((row) => row[x] === '1'));
  });
  const w = Math.max(minWidth, cols.length);
  return { w, g: Array.from({ length: rows }, (_, y) => Array.from({ length: w }, (_, x) => cols[x]?.[y] ? ink : null)) };
}
export function numeralGrid(value, { tone } = {}) {
  const { text, ink } = reading(value, tone);
  if (![...text].every((ch) => Object.hasOwn(FONT, ch))) return undefined;
  return gridOf([...text], ink, 13);
}
// Any FONT, HEX_FONT or LETTER_FONT characters (faces `instrument` and `dashboard`, six pixel rows), or TALL_FONT characters
// (face `tall`, ten pixel rows), exactly as wide as their glyphs: no minimum width and no number formatting.
// face 'dashboard' swaps in DASHBOARD_FONT's digits; the default 'instrument' face is FONT.
export function textGrid(text, { ink = 'primary', face = 'instrument' } = {}) {
  if (typeof text !== 'string') throw new TypeError('pixel text must be a string');
  const chars = [...text];
  const known = face === 'tall' ? (ch) => Object.hasOwn(TALL_FONT, ch) : (ch) => Object.hasOwn(FONT, ch) || Object.hasOwn(HEX_FONT, ch) || Object.hasOwn(LETTER_FONT, ch);
  if (chars.length === 0 || chars.length > 250 || !chars.every(known)) {
    throw new RangeError(face === 'tall' ? 'tall pixel text must be 1–250 characters from TALL_FONT' : 'pixel text must be 1–250 characters from FONT, HEX_FONT or LETTER_FONT');
  }
  resolveColor(ink);
  if (typeof face !== 'string' || !Object.hasOwn(FACES, face)) throw new RangeError('pixel face must be instrument, dashboard or tall');
  return gridOf(chars, ink, 1, FACES[face], face === 'tall' ? 10 : 6);
}
function validateGrid(grid) {
  if (!grid || !Number.isInteger(grid.w) || grid.w < 1 || grid.w > 1000 ||
      !Array.isArray(grid.g) || (grid.g.length !== 6 && grid.g.length !== 10) || grid.g.some((row) => !Array.isArray(row) || row.length !== grid.w)) {
    throw new TypeError('numeral grid must have w (1–1000) and six (instrument, dashboard) or ten (tall) rows of w colors or null');
  }
  for (const row of grid.g) for (const color of row) if (color !== null) resolveColor(color);
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
// footer.ts:351-359: old-only pixels vanish immediately; current shape acquires current ink from grey.
export function numeralAt(target, from, progress, seed) {
  validateGrid(target);
  validateGrid(from);
  if (target.g.length !== from.g.length) throw new RangeError('numeralAt grids must share a face');
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
  return Array.from({ length: grid.g.length / 2 }, (_, y) => fitLine(Array.from({ length: grid.w }, (_, x) => {
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
