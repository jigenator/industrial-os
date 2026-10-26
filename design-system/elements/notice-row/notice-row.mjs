import { GLYPHS, assertCells, fitLine, fitText, lineWidth, span } from '../../foundation/cells.mjs';
import { labelPlate } from '../label-plate/label-plate.mjs';

export function noticeRow({ glyph = '·', plate = '', text = '', detail = [], tone = 'neutral' } = {}, { width, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width, 'notice width');
  if (typeof glyph !== 'string' || [...glyph].length !== 1 || !GLYPHS.includes(glyph)) throw new RangeError('notice glyph must be one curated glyph');
  if (!['neutral', 'warning', 'critical'].includes(tone)) throw new RangeError('notice tone must be neutral, warning or critical');
  if (!Array.isArray(detail)) throw new TypeError('notice detail must be prewrapped text rows');
  const clear = { bg: 'default' }, fg = tone === 'neutral' ? 'decorative' : tone;
  const label = fitText(plate, Infinity, { measure });
  const prefix = [span(' ' + glyph + ' ', { fg, ...clear, bold: true }), ...(lineWidth(label, { measure }) ? [...labelPlate(plate, { form: 'slab', tone, maxWidth: Math.max(0, width - 3), measure }), span(' ', clear)] : [])];
  const headline = fitText(text, Math.max(0, width - lineWidth(prefix, { measure })), { measure, style: { fg: 'secondary', ...clear } });
  const lines = [fitLine([...prefix, ...headline], width, clear, { measure })];
  const segments = new Intl.Segmenter('und', { granularity: 'grapheme' });
  for (const value of detail) {
    const source = fitText(value, Infinity, { measure, style: { fg: 'secondary', ...clear } });
    let current = [], used = 0;
    for (const s of source) for (const { segment } of segments.segment(s.text)) {
      const size = measure ? measure(segment) : [...segment].length;
      if (size > width) throw new RangeError('notice detail grapheme cannot fit width');
      if (used + size > width) { lines.push(fitLine(current, width, clear, { measure })); current = []; used = 0; }
      current.push(span(segment, { ...s.style })); used += size;
    }
    lines.push(fitLine(current, width, clear, { measure }));
  }
  return lines;
}
