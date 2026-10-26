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

function renderCallout({ side = 'left', name = '', first = true, body = [], readout = '', reference } = {}, { width, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width, 'callout width');
  if (!['left', 'right'].includes(side)) throw new RangeError('side must be left or right');
  if (typeof first !== 'boolean') throw new TypeError('first must be boolean');
  if (!Array.isArray(body) || body.length > 1000) throw new TypeError('body must be at most 1000 prewrapped text rows');
  const room = Math.max(0, width - 6), ink = side === 'left' ? 'accent' : P.bone;
  const text = (body.length ? body : ['']).map(value => fitText(value, room, { measure, style: { fg: 'secondary', ...clear } }));
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
  const lines = [row(title), ...text.map(l => row([gap(side === 'left' ? 3 : width - 3 - size(l, measure)), ...l])), row(tail)];
  const readLeft = side === 'left' ? 3 : Math.max(0, width - 3 - size(read, measure));
  const boxLeft = Math.min(width - 1, side === 'left' ? 1 : Math.max(0, readLeft - 1));
  const boxRight = side === 'left' ? Math.min(width - 1, 3 + widest) : Math.max(0, width - 2);
  const region = (top, left, rows, cols) => ({ top, left: Math.min(width, Math.max(0, left)), rows, cols: Math.max(0, Math.min(cols, width - Math.max(0, left))) });
  const stampWidth = size(fitText(readout, Math.max(0, Math.max(1, widest) - 3), { measure }), measure);
  const railWidth = Math.min(dashes, Math.max(0, Math.max(1, widest) - stampWidth - 1));
  return { lines, geometry: {
    left: boxLeft, right: boxRight, rows: lines.length,
    textRegion: region(1, side === 'left' ? 3 : width - 3 - widest, text.length, widest),
    readoutRegion: region(lines.length - 1, side === 'left' ? readLeft : readLeft + stampWidth + 1, 1, railWidth),
    timestampRegion: region(lines.length - 1, side === 'left' ? readLeft + railWidth + 1 : readLeft, 1, stampWidth),
    plotGutter: region(1, 1, 1, 1),
    registerGutter: { top: 0, left: Math.max(0, boxLeft - 1), rows: lines.length + 2, cols: Math.max(0, boxRight - Math.max(0, boxLeft - 1) + 2) },
  } };
}

export function callout(input = {}, options = {}) {
  return renderCallout(input, options).lines;
}

export function calloutGeometry(input = {}, options = {}) {
  return renderCallout(input, options).geometry;
}

function subtitleLayout({ body = [], marker = '', ambient = false, aside = false, revealed = Infinity } = {}, { width, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width, 'subtitle width');
  if (!Array.isArray(body) || body.length > 1000) throw new TypeError('subtitle body must be prewrapped rows');
  if (typeof ambient !== 'boolean' || typeof aside !== 'boolean') throw new TypeError('subtitle flags must be boolean');
  if (revealed !== Infinity && (!Number.isSafeInteger(revealed) || revealed < 0)) throw new RangeError('revealed must be a nonnegative grapheme count or Infinity');
  let remaining = revealed, head;
  const lines = body.map((value, row) => {
    const full = fitText(value, width, { measure, style: { fg: ambient ? 'decorative' : 'primary', italic: aside, ...clear } });
    const left = Math.floor((width - size(full, measure)) / 2);
    let col = left;
    const visible = [];
    for (const s of full) for (const { segment } of new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(s.text)) {
      const cells = measure ? measure(segment) : [...segment].length;
      if (remaining > 0) {
        visible.push(span(segment, { ...s.style }));
        if (remaining === 1) head = { row, col };
        remaining--;
      } else visible.push(span(' '.repeat(cells), { ...s.style }));
      col += cells;
    }
    return fitLine([span(' '.repeat(left), clear), ...visible], width, clear, { measure });
  });
  if (marker !== '') lines.push(fitLine([span(' '.repeat(Math.floor(width / 2)), clear), ...fitText(marker, Math.ceil(width / 2), { measure, style: { fg: 'accent', ...clear } })], width, clear, { measure }));
  return { lines, head };
}

export function subtitle(input = {}, options = {}) {
  return subtitleLayout(input, options).lines;
}

export function subtitleGeometry(input = {}, options = {}) {
  return { head: subtitleLayout(input, options).head };
}
