import { GLYPHS, assertCells, fitLine, fitText, lineWidth, resolveStyle, span } from '../../foundation/cells.mjs';
import { labelPlate } from '../label-plate/label-plate.mjs';

function commandDetail({ text, label = 'SH' }, width, measure) {
  const surface = { bg: 'surface' };
  const left = Math.min(2, width);
  const labelText = fitText(label, Infinity, { measure });
  const badge = lineWidth(labelText, { measure }) ? labelPlate(label, {
    form: 'slab', maxWidth: Math.max(0, width - left - 2), measure,
    style: { fg: 'field', bg: 'structural' },
  }) : [];
  const badgeWidth = lineWidth(badge, { measure });
  const command = fitText(text, Math.max(0, width - left - 2 - badgeWidth - (badgeWidth ? 1 : 0)), {
    measure, style: { fg: 'primary', ...surface },
  }).map(s => span(s.text, { ...s.style, ...surface }));
  const gap = Math.max(0, width - left - 2 - badgeWidth - lineWidth(command, { measure }));
  return fitLine([span(' '.repeat(left), surface), ...command, span(' '.repeat(gap), surface), ...badge, span('  ', surface)], width, surface, { measure });
}

export function noticeRow({ glyph = '·', plate = '', text = '', detail = [], tone = 'neutral', plateFirst = false, glyphInk, plateStyle } = {}, { width, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width, 'notice width');
  if (typeof glyph !== 'string' || [...glyph].length !== 1 || !GLYPHS.includes(glyph)) throw new RangeError('notice glyph must be one curated glyph');
  if (!['neutral', 'warning', 'critical'].includes(tone)) throw new RangeError('notice tone must be neutral, warning or critical');
  if (typeof plateFirst !== 'boolean') throw new TypeError('plateFirst must be boolean');
  if (glyphInk !== undefined) resolveStyle({ fg: glyphInk });
  if (plateStyle !== undefined) resolveStyle(plateStyle);
  if (!Array.isArray(detail)) throw new TypeError('notice detail must be text rows or command rows');
  const clear = { bg: 'default' }, fg = tone === 'neutral' ? 'decorative' : tone;
  const label = fitText(plate, Infinity, { measure });
  const badge = lineWidth(label, { measure }) ? labelPlate(plate, { form: 'slab', tone, style: plateStyle, maxWidth: Math.max(0, width - 4), measure }) : [];
  const glyphPart = span(glyph + ' ', { fg: glyphInk ?? fg, ...clear, bold: true });
  const platePart = badge.length ? [...badge, span(' ', clear)] : [];
  const prefix = [span(' ', clear), ...(plateFirst ? [...platePart, glyphPart] : [glyphPart, ...platePart])];
  const headline = fitText(text, Math.max(0, width - lineWidth(prefix, { measure })), { measure, style: { fg: tone === 'critical' ? 'secondary' : 'decorative', ...clear } });
  const lines = [fitLine([...prefix, ...headline], width, clear, { measure })];
  const segments = new Intl.Segmenter('und', { granularity: 'grapheme' });
  for (const value of detail) {
    if (value && typeof value === 'object' && Object.hasOwn(value, 'kind')) {
      if (value.kind !== 'command') throw new RangeError('notice detail kind must be command');
      lines.push(commandDetail(value, width, measure));
      continue;
    }
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
