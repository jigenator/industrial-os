import { assertCells, fitLine, fitText, lineWidth, span } from '../../foundation/cells.mjs';
import { SURFACE_PALETTE as P } from '../../foundation/surface-palette.mjs';
import { leader } from '../tab-rule/tab-rule.mjs';
const clear = { bg: 'default' };
const size = (line, measure) => lineWidth(line, { measure });

export function timestampLeader({ readout = '', side = 'left', cells = 2 } = {}, { width, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width, 'timestamp width');
  if (!['left', 'right'].includes(side)) throw new RangeError('side must be left or right');
  if (!Number.isInteger(cells) || cells < 0 || cells > 1000) throw new RangeError('leader cells must be 0–1000');
  const stamp = fitText(readout, Math.max(0, width - 3), { measure, style: { fg: 'decorative', ...clear } });
  const rail = leader({}, { maxWidth: Math.min(cells, Math.max(0, width - size(stamp, measure) - 1)) });
  return fitLine(side === 'left' ? [...rail, span(' ', clear), ...stamp] : [...stamp, span(' ', clear), ...rail], width, clear, { measure });
}

export function callout({ side = 'left', name = '', first = true, body = [], readout = '', reference } = {}, { width, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width, 'callout width');
  if (!['left', 'right'].includes(side)) throw new RangeError('side must be left or right');
  if (typeof first !== 'boolean') throw new TypeError('first must be boolean');
  if (!Array.isArray(body) || body.length > 1000) throw new TypeError('body must be at most 1000 prewrapped text rows');
  const room = Math.max(0, width - 6), ink = side === 'left' ? 'accent' : P.bone;
  const text = body.map(value => fitText(value, room, { measure, style: { fg: 'secondary', ...clear } }));
  if (reference !== undefined) text.push(fitText(reference, room, { measure, style: { fg: 'decorative', ...clear } }));
  const label = fitText(name, Math.max(0, width - 4), { measure, style: { fg: ink, bold: true, ...clear } });
  const stamp = fitText(readout, room, { measure, style: { fg: 'decorative', ...clear } });
  const widest = Math.min(room, Math.max(0, ...text.map(l => size(l, measure)), size(stamp, measure) + 6, first ? size(label, measure) : 0));
  const row = content => fitLine(content, width, clear, { measure });
  const gap = n => span(' '.repeat(Math.max(0, n)), clear);
  const corner = value => span(value, { fg: ink, ...clear });
  const title = side === 'left' ? [gap(1), corner('┌╴'), ...(first ? label : [])]
    : [gap(width - 3 - (first ? size(label, measure) : 0)), ...(first ? label : []), corner('╶┐')];
  const dashes = Math.max(0, widest - size(stamp, measure) - 1);
  const read = timestampLeader({ readout, side, cells: dashes }, { width: Math.max(1, widest), measure });
  const tail = side === 'left' ? [gap(1), corner('└╴'), ...read]
    : [gap(width - 3 - size(read, measure)), ...read, corner('╶┘')];
  return [row(title), ...text.map(l => row([gap(side === 'left' ? 3 : width - 3 - size(l, measure)), ...l])), row(tail)];
}

export function subtitle({ body = [], marker = '', ambient = false, aside = false } = {}, { width, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width, 'subtitle width');
  if (!Array.isArray(body) || body.length > 1000) throw new TypeError('subtitle body must be prewrapped rows');
  if (typeof ambient !== 'boolean' || typeof aside !== 'boolean') throw new TypeError('subtitle flags must be boolean');
  const values = [...body, ...(marker === '' ? [] : [marker])];
  return values.map(value => {
    const text = fitText(value, width, { measure, style: { fg: ambient ? 'decorative' : 'primary', italic: aside, ...clear } });
    return fitLine([span(' '.repeat(Math.floor((width - size(text, measure)) / 2)), clear), ...text], width, clear, { measure });
  });
}
