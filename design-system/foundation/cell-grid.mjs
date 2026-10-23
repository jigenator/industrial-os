import { assertCells, GLYPHS, resolveStyle, safeText, span } from './cells.mjs';

// A bounded, I/O-free composition surface; lines are the existing public seam.
export class CellGrid {
  constructor(width, height) {
    assertCells(width, 'grid width'); assertCells(height, 'grid height');
    this.width = width; this.height = height;
    this.rows = Array.from({ length: height }, () => Array.from({ length: width }, () => span(' ')));
  }
  put(x, y, glyph, style = {}) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) throw new RangeError('grid coordinates must be integers');
    if (typeof glyph !== 'string' || [...glyph].length !== 1 || !(/^[\x20-\x7e]$/.test(glyph) || GLYPHS.includes(glyph))) throw new TypeError('grid glyph must be one approved cell');
    resolveStyle(style);
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) this.rows[y][x] = span(glyph, { ...style });
  }
  text(x, y, text, style = {}, max = this.width) {
    [...safeText(text)].slice(0, Math.max(0, max)).forEach((ch, i) => this.put(x + i, y, ch, style));
  }
  place(x, y, lines) {
    lines.forEach((line, j) => { let i = 0; for (const s of line) for (const ch of s.text) this.put(x + i++, y + j, ch, s.style); });
  }
  lines() { return this.rows.map(row => row.map(s => span(s.text, { ...s.style }))); }
}
