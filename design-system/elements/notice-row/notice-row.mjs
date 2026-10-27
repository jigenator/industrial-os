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

const segments = new Intl.Segmenter('und', { granularity: 'grapheme' });

// Greedy word wrap of styled graphemes into rows of at most `room` cells. Spaces at a break are dropped; a word
// longer than a row breaks between graphemes. Undefined when a grapheme cannot fit, so the caller clips instead.
function wrapWords(line, room, measure) {
  const tokens = [];
  for (const s of line) for (const { segment } of segments.segment(s.text)) {
    const unit = { segment, style: s.style, size: measure ? measure(segment) : [...segment].length };
    if (unit.size > room) return undefined;
    const space = segment === ' ', last = tokens.at(-1);
    if (last && last.space === space) { last.units.push(unit); last.size += unit.size; }
    else tokens.push({ space, units: [unit], size: unit.size });
  }
  const rows = [];
  let row = [], used = 0, gap;
  const place = (unit) => {
    if (used + unit.size > room) { rows.push(row); row = []; used = 0; }
    row.push(span(unit.segment, { ...unit.style })); used += unit.size;
  };
  for (const token of tokens) {
    if (token.space && (row.length || rows.length)) { gap = token; continue; }
    if (row.length && used + (gap?.size ?? 0) + token.size > room) { rows.push(row); row = []; used = 0; }
    else if (gap) for (const unit of gap.units) place(unit);
    gap = undefined;
    for (const unit of token.units) place(unit);
  }
  rows.push(row);
  return rows;
}

export function noticeRow({ glyph = '·', plate = '', text = '', detail = [], tone = 'neutral', plateFirst = false, glyphInk, plateStyle, wrap = false, inset = 0 } = {}, { width, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width, 'notice width');
  if (typeof glyph !== 'string' || [...glyph].length !== 1 || !GLYPHS.includes(glyph)) throw new RangeError('notice glyph must be one curated glyph');
  if (!['neutral', 'warning', 'critical'].includes(tone)) throw new RangeError('notice tone must be neutral, warning or critical');
  if (typeof plateFirst !== 'boolean') throw new TypeError('plateFirst must be boolean');
  if (typeof wrap !== 'boolean') throw new TypeError('wrap must be boolean');
  if (!Number.isInteger(inset) || inset < 0 || inset > 1000) throw new RangeError('inset must be 0–1000');
  if (glyphInk !== undefined) resolveStyle({ fg: glyphInk });
  if (plateStyle !== undefined) resolveStyle(plateStyle);
  if (!Array.isArray(detail)) throw new TypeError('notice detail must be text rows or command rows');
  const clear = { bg: 'default' }, fg = tone === 'neutral' ? 'decorative' : tone;
  const label = fitText(plate, Infinity, { measure });
  const badge = lineWidth(label, { measure }) ? labelPlate(plate, { form: 'slab', tone, style: plateStyle, maxWidth: Math.max(0, width - 4), measure }) : [];
  const glyphPart = span(glyph + ' ', { fg: glyphInk ?? fg, ...clear, bold: true });
  const platePart = badge.length ? [...badge, span(' ', clear)] : [];
  const prefix = [span(' ', clear), ...(plateFirst ? [...platePart, glyphPart] : [glyphPart, ...platePart])];
  const hang = lineWidth(prefix, { measure }), room = Math.max(0, width - hang - inset);
  const headlineStyle = { fg: tone === 'critical' ? 'secondary' : 'decorative', ...clear };
  const rows = wrap ? wrapWords(fitText(text, Infinity, { measure, style: headlineStyle }), room, measure) : undefined;
  const lines = rows
    ? rows.map((row, i) => fitLine([...(i ? [span(' '.repeat(hang), clear)] : prefix), ...row], width, clear, { measure }))
    : [fitLine([...prefix, ...fitText(text, room, { measure, style: headlineStyle })], width, clear, { measure })];
  for (const value of detail) {
    if (value && typeof value === 'object' && Object.hasOwn(value, 'kind')) {
      if (value.kind !== 'command') throw new RangeError('notice detail kind must be command');
      lines.push(commandDetail(value, width, measure));
      continue;
    }
    const source = fitText(value, Infinity, { measure, style: { fg: 'secondary', ...clear } });
    const budget = Math.max(1, width - inset);
    let current = [], used = 0;
    for (const s of source) for (const { segment } of segments.segment(s.text)) {
      const size = measure ? measure(segment) : [...segment].length;
      if (size > width) throw new RangeError('notice detail grapheme cannot fit width');
      if (used && used + size > budget) { lines.push(fitLine(current, width, clear, { measure })); current = []; used = 0; }
      current.push(span(segment, { ...s.style })); used += size;
    }
    lines.push(fitLine(current, width, clear, { measure }));
  }
  return lines;
}
