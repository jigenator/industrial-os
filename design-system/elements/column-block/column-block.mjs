import { GLYPHS, assertCells, cells, fitLine, lineWidth, resolveStyle, safeText, span } from '../../foundation/cells.mjs';

const field = (n) => [span(' '.repeat(n), { bg: 'field' })];
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const conforming = (text) => [...text].every((ch) => /[\x20-\x7e]/.test(ch) || GLYPHS.includes(ch));

// Strings are external display text. Spans are already-rendered pieces: validate the foundation contract
// rather than sanitizing their structural glyphs away. Never mutate the caller's spans or styles.
function part(value, fg) {
  if (value === undefined) return [];
  if (typeof value === 'string') return [span(safeText(value), { fg })];
  if (!Array.isArray(value)) throw new TypeError('column parts must be strings or arrays of spans');
  for (const s of value) {
    if (!record(s) || typeof s.text !== 'string' || !conforming(s.text)) throw new TypeError('spans must contain safe text or curated glyphs');
    if (s.style !== undefined && !record(s.style)) throw new TypeError('span style must be an object');
    if (s.style?.bold !== undefined && typeof s.style.bold !== 'boolean') throw new TypeError('bold must be boolean');
    resolveStyle(s.style);
  }
  return value;
}

// Span-preserving cut with the ellipsis in the last cell, even when only one cell fits.
function cut(line, n) {
  if (lineWidth(line) <= n) return line;
  if (n === 0) return [];
  const clipped = fitLine(line, n);
  const last = clipped.pop();
  return [...clipped, span([...last.text].slice(0, -1).join('') + '…', last.style)];
}

// Gutter · value · marks · right. This element owns geometry only; its caller supplies state and pieces.
export function columnBlock(rows, options = {}) {
  if (!record(options)) throw new TypeError('column block options must be an object');
  const { width, gutterEnd = 7, headIndent = 1, indent = 3, separator = ' · ', textCells = 24, rightCells = 6 } = options;
  assertCells(width, 'column block width');
  assertCells(textCells, 'textCells');
  assertCells(rightCells, 'rightCells');
  for (const [name, n] of Object.entries({ gutterEnd, headIndent, indent })) {
    if (!Number.isInteger(n) || n < 0 || n > 1000) throw new RangeError(`${name} must be an integer from 0 to 1000`);
  }
  if (headIndent >= gutterEnd || indent >= gutterEnd) throw new RangeError('indents must be below gutterEnd');
  if (typeof separator !== 'string' || !conforming(separator)) throw new TypeError('separator must contain safe text or curated glyphs');
  const gap = cells(separator);
  if (!gap || gap + rightCells >= textCells) throw new RangeError('separator and right slot must leave at least one value cell');
  if (!Array.isArray(rows)) throw new TypeError('rows must be an array');
  const sep = [span(separator, { fg: 'decorative' })];
  const column = gutterEnd + gap;
  const area = Math.min(textCells, Math.max(0, width - column));
  const lines = [];
  const emit = (line) => lines.push(fitLine(line, width, { bg: 'field' }));
  const join = (parts) => parts.flatMap((p, i) => i ? [...sep, ...p] : p);

  // An oversized fixed part moves out of the text column before it wraps at full width. Every cell is
  // retained across the resulting lines; no partial badge/mark is silently presented as a complete one.
  const continuation = (piece) => {
    if (lineWidth(piece) <= area) emit([...field(column), ...piece]);
    else {
      let rest = piece;
      while (lineWidth(rest) > width) {
        emit(fitLine(rest, width));
        let skip = width;
        rest = rest.flatMap((s) => {
          const chars = [...s.text];
          const dropped = Math.min(skip, chars.length);
          skip -= dropped;
          return dropped === chars.length ? [] : [span(chars.slice(dropped).join(''), s.style)];
        });
      }
      if (lineWidth(rest)) emit(rest);
    }
  };

  for (const row of rows) {
    if (!record(row)) throw new TypeError('each row must be an object');
    if (row.head !== undefined && typeof row.head !== 'boolean') throw new TypeError('head must be boolean');
    if (row.marks !== undefined && !Array.isArray(row.marks)) throw new TypeError('marks must be an array of parts');
    const start = row.head ? headIndent : indent;
    const gutter = cut(part(row.gutter, 'decorative'), gutterEnd - start);
    // A function value is rendered at its cell budget, so a reading such as a line meter keeps its own
    // narrow fallback instead of being cut mid-reading.
    const renderValue = (n) => {
      if (typeof row.value !== 'function') return cut(part(row.value, 'secondary'), n);
      const spans = part(row.value(n), 'secondary');
      if (lineWidth(spans) > n) throw new RangeError('a value function must render within its cell budget');
      return spans;
    };
    const marks = (row.marks ?? []).map((p) => {
      if (p === undefined) throw new TypeError('each mark must be a string or span array');
      return part(p, 'secondary');
    }).filter((p) => lineWidth(p));
    const right = cut(part(row.right, 'secondary'), rightCells);
    const hasGutter = lineWidth(gutter) > 0;
    const hasValue = lineWidth(renderValue(textCells)) > 0;
    const hasRight = lineWidth(right) > 0;
    if (!hasGutter && !hasValue && !marks.length && !hasRight) continue;
    const rightSlot = hasRight ? [...field(rightCells - lineWidth(right)), ...right] : [];
    const prefix = (content) => hasGutter
      ? [...field(start), ...fitLine(gutter, gutterEnd - start), ...(content ? sep : [])]
      : field(column);
    const fixed = marks.reduce((n, p) => n + lineWidth(p), 0) + (hasRight ? rightCells : 0);
    const pieces = Number(hasValue) + marks.length + Number(hasRight);
    const reserved = fixed + Math.max(0, pieces - 1) * gap;

    if (area > 0 && reserved + Number(hasValue) <= area) {
      const lhs = join([...(hasValue ? [renderValue(area - reserved)] : []), ...marks]);
      const body = hasRight
        ? [...fitLine(lhs, area - rightCells - (lhs.length ? gap : 0)), ...(lhs.length ? sep : []), ...rightSlot]
        : lhs;
      emit([...prefix(lineWidth(body) > 0), ...body]);
    } else {
      if (area > 0) {
        if (hasValue || hasGutter) emit([...prefix(hasValue), ...renderValue(area)]);
      } else {
        if (hasGutter) continuation(gutter);
        if (hasValue) emit(renderValue(Math.min(textCells, width)));
      }
      for (const mark of marks) continuation(mark);
      // A stacked right value keeps its right edge: the text area's when it fits there, else the line's.
      const edge = area >= lineWidth(right) ? area : width;
      if (hasRight) continuation([...field(Math.max(0, edge - lineWidth(right))), ...right]);
    }
  }
  return lines;
}
