import { assertCells, fitLine, fitText, lineWidth, span } from '../../foundation/cells.mjs';
import { SURFACE_PALETTE as P } from '../../foundation/surface-palette.mjs';
import { INDUSTRIALOS_COLORS } from '../../foundation/industrialos-colors.mjs';
import { labelPlate } from '../label-plate/label-plate.mjs';
import { leader } from '../tab-rule/tab-rule.mjs';
const clear = { bg: 'default' };
const ink = id => INDUSTRIALOS_COLORS.find(c => c.id === id).hex;
const size = (l, measure) => lineWidth(l, { measure });
const text = (value, measure, style = {}) => fitText(value, Infinity, { measure, style: { fg: 'secondary', ...clear, ...style } });

// Presentation wrapping preserves all values; a grapheme wider than the entire budget cannot be represented.
function wrap(value, width, measure, style) {
  const source = text(value, measure, style), lines = []; let row = [], used = 0;
  for (const s of source) for (const { segment } of new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(s.text)) {
    const n = measure ? measure(segment) : [...segment].length;
    if (n > width) throw new RangeError('document grapheme cannot fit width');
    if (used + n > width) { lines.push(fitLine(row, width, clear, { measure })); row = []; used = 0; }
    row.push(span(segment, { ...s.style })); used += n;
  }
  lines.push(fitLine(row, width, clear, { measure })); return lines;
}
export function documentHeading({ text: value = '', level = 1 } = {}, { width, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width, 'document heading width');
  if (!Number.isInteger(level) || level < 1 || level > 6) throw new RangeError('heading level must be 1–6');
  const fg = level === 1 ? 'accent' : level === 2 ? P.yellow : level === 3 ? ink('pale-blue') : 'primary';
  const content = fitText(value, Math.max(0, width - (level === 2 ? 1 : 0)), { measure, style: { fg, bold: true, ...clear } });
  const lines = [fitLine([...(level === 2 ? [span('▍', { fg, ...clear })] : []), ...content], width, clear, { measure })];
  if (level === 1) lines.push(fitLine([span('━'.repeat(Math.min(width, size(content, measure) + 8)), { fg: 'structural', ...clear })], width, clear));
  return lines;
}
export function listRow({ body = '', marker = '▪', checked, indent = 0 } = {}, { width, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width, 'list width');
  if (!Number.isInteger(indent) || indent < 0 || indent > 1000) throw new RangeError('indent must be 0–1000');
  if (checked !== undefined && typeof checked !== 'boolean') throw new TypeError('checked must be boolean');
  const mark = checked === undefined ? (marker === '▪' ? [span(marker, { fg: 'accent', ...clear })] : text(marker, measure, { fg: 'accent' })) : [span(checked ? '[x]' : '[ ]', { fg: 'accent', ...clear })];
  const prefix = [span(' '.repeat(Math.min(indent, width)), clear), ...mark, span(' ', clear)];
  return fitLine([...prefix, ...fitText(body, Math.max(0, width - size(prefix, measure)), { measure, style: { fg: 'secondary', ...clear } })], width, clear, { measure });
}
export function quoteRows({ body = [] } = {}, { width, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width, 'quote width');
  if (!Array.isArray(body) || body.length > 1000) throw new TypeError('quote body must be prewrapped rows');
  return body.map(value => fitLine([span('▌ ', { fg: ink('lavender'), ...clear }), ...fitText(value, Math.max(0, width - 2), { measure, style: { fg: 'secondary', italic: true, ...clear } })], width, clear, { measure }));
}
export function linkLines({ label = '', url = '' } = {}, { width, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width, 'link width');
  return [...wrap(label, width, measure, { fg: ink('acid-lime-link'), underline: true }), ...wrap(url, width, measure, { fg: 'decorative' })];
}
export function codeBand({ language = '', body = [] } = {}, { width, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width, 'code width');
  if (!Array.isArray(body) || body.length > 1000) throw new TypeError('code body must be text rows');
  const plate = labelPlate(language, { form: 'slab', tone: 'neutral', maxWidth: width, measure, style: { fg: 'primary', bg: 'structural' } });
  const head = fitLine([...plate, ...leader({}, { maxWidth: width - size(plate, measure) })], width, clear, { measure });
  return [head, ...body.flatMap(value => wrap(value, Math.max(1, width - 1), measure, { fg: P.code, bg: 'surface' }).map(l => fitLine([...(width > 1 ? [span(' ', { bg: 'surface' })] : []), ...l], width, { bg: 'surface' }, { measure })))];
}
export function inlineCode(value, { maxWidth = Infinity, measure } = {}) {
  const options = arguments[1];
  if (options !== undefined && (options === null || typeof options !== 'object' || Array.isArray(options))) throw new TypeError('inline code options must be an object');
  return fitText(value, maxWidth, { measure, style: { fg: P.code, bg: 'surface' } });
}
export function specTable({ headings = [], rows = [], align = [] } = {}, { width, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width, 'table width');
  if (!Array.isArray(headings) || !headings.length || headings.length > 100 || !Array.isArray(rows) || rows.length > 1000 || rows.some(r => !Array.isArray(r) || r.length !== headings.length)) throw new TypeError('table needs headings and rectangular rows');
  if (!Array.isArray(align) || align.length > headings.length || align.some(a => !['left', 'right', 'center'].includes(a))) throw new RangeError('invalid table alignment');
  const data = [headings, ...rows].map((r, ri) => r.map(v => text(v, measure, { fg: ri === 0 ? P.yellow : 'secondary', bold: ri === 0 })));
  const widths = headings.map((_, i) => Math.max(1, ...data.map(r => size(r[i], measure))));
  if (widths.reduce((a,b) => a+b, 0) + (headings.length - 1) * 2 > width) {
    // Stacked records keep every heading and value, including at one column.
    return rows.length ? data.slice(1).flatMap(r => r.flatMap((v,i) => [...wrap({ spans: data[0][i], width: size(data[0][i], measure) }, width, measure ?? (s => [...s].length)), ...wrap({ spans: v, width: size(v, measure) }, width, measure ?? (s => [...s].length))])) : data[0].flatMap(v => wrap({ spans: v, width: size(v, measure) }, width, measure ?? (s => [...s].length)));
  }
  const render = r => fitLine(r.flatMap((v,i) => {
    const gap = widths[i] - size(v, measure), left = align[i] === 'right' ? gap : align[i] === 'center' ? Math.floor(gap / 2) : 0;
    return [span(' '.repeat(left), clear), ...v, span(' '.repeat(gap - left + (i === r.length - 1 ? 0 : 2)), clear)];
  }), width, clear, { measure });
  return [render(data[0]), fitLine([span(widths.map(n => '━'.repeat(n)).join('  '), { fg: 'structural', ...clear })], width, clear), ...data.slice(1).map(render)];
}
