import { assertCells, fitText, GLYPHS, lineWidth, resolveStyle, safeText, span, textSlot } from './cells.mjs';

const graphemes = new Intl.Segmenter('und', { granularity: 'grapheme' });

// A bounded, I/O-free composition surface; lines are the existing public seam. With a measurer, text() admits
// measured graphemes: a wide one fills its cell and leaves `{ text: '' }` continuation cells after it, as in surface.
export class CellGrid {
  #measure;
  #widths;
  constructor(width, height, { measure } = {}) {
    assertCells(width, 'grid width'); assertCells(height, 'grid height');
    if (measure !== undefined && typeof measure !== 'function') throw new TypeError('grid measure must be a function');
    this.width = width; this.height = height; this.#measure = measure;
    this.rows = Array.from({ length: height }, () => Array.from({ length: width }, () => span(' ')));
    // 1 for a narrow cell, n for an n-cell leader, 0 for its continuation cells.
    this.#widths = Array.from({ length: height }, () => Array(width).fill(1));
  }
  // Overwriting either half of a wide grapheme blanks the whole grapheme first, so geometry never tears.
  #clear(x, y) {
    const row = this.rows[y], widths = this.#widths[y];
    let lead = x;
    while (lead > 0 && widths[lead] === 0) lead--;
    if (widths[lead] === 1 && lead === x) return;
    const end = lead + widths[lead];
    for (let i = lead; i < end; i++) { row[i] = span(' ', { ...row[i].style }); widths[i] = 1; }
  }
  #set(x, y, text, style, size) {
    for (let i = 0; i < size; i++) this.#clear(x + i, y);
    this.rows[y][x] = span(text, { ...style }); this.#widths[y][x] = size;
    for (let i = 1; i < size; i++) { this.rows[y][x + i] = span('', { ...style }); this.#widths[y][x + i] = 0; }
  }
  put(x, y, glyph, style = {}) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) throw new RangeError('grid coordinates must be integers');
    if (typeof glyph !== 'string' || [...glyph].length !== 1 || !(/^[\x20-\x7e]$/.test(glyph) || GLYPHS.includes(glyph))) throw new TypeError('grid glyph must be one approved cell');
    resolveStyle(style);
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) this.#set(x, y, glyph, style, 1);
  }
  // Returns the cells written. Measured text clips whole graphemes with an ellipsis; plain text keeps ASCII sanitizing.
  text(x, y, text, style = {}, max = this.width) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) throw new RangeError('grid coordinates must be integers');
    if (this.#measure === undefined) {
      const chars = [...safeText(text)].slice(0, Math.max(0, max));
      chars.forEach((ch, i) => this.put(x + i, y, ch, style));
      return chars.length;
    }
    const budget = Math.max(0, Math.min(max, 1000, this.width - Math.max(0, x)));
    let col = x;
    for (const s of fitText(text, budget, { measure: this.#measure, style })) col = this.#graphemes(col, y, s.text, s.style);
    return col - x;
  }
  #graphemes(x, y, text, style) {
    for (const { segment } of graphemes.segment(text)) {
      const size = this.#measure(segment);
      if (y >= 0 && y < this.height) {
        if (x >= 0 && x + size <= this.width) { if (size) this.#set(x, y, segment, style, size); }
        else for (let i = Math.max(0, x); i < Math.min(this.width, x + size); i++) this.#set(i, y, ' ', style, 1);
      }
      x += size;
    }
    return x;
  }
  // Measured lines place whole graphemes; empty continuation spans are skipped, since their leader fills them.
  place(x, y, lines) {
    const measure = this.#measure;
    lines.forEach((line, j) => {
      let i = x;
      if (measure === undefined) { for (const s of line) for (const ch of s.text) this.put(i++, y + j, ch, s.style); return; }
      const spans = line.filter(s => s.text !== '');
      for (const s of textSlot(spans, lineWidth(spans, { measure }), { measure }).spans) i = this.#graphemes(i, y + j, s.text, s.style);
    });
  }
  lines() { return this.rows.map(row => row.map(s => span(s.text, { ...s.style }))); }
}
