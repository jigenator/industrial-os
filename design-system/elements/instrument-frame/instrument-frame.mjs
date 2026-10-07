import { assertCells, fitLine, lineWidth, resolveColor, span } from '../../foundation/cells.mjs';

// status-bar's framed footer geometry (pi/status-bar/src/footer.ts renderFooter) as a reusable frame. The frame
// owns placement only: corner and side stubs, the plate column, wrapping at the content column, the header's
// title/aside placement, and the minimal fallback. Plates, titles, asides and content are caller-rendered spans.
export const FRAME_MINIMAL_BELOW = 40;
export const FRAME_PLATE_WIDTH = 8;
const STUB = { fg: 'decorative' };

// The cells a caller renders content into: `contentWidth` cells starting at `contentColumn`. In the minimal
// fallback there is no plate column; content wraps at the full width (a first line follows its inline plate).
export function frameGeometry(width) {
  assertCells(width, 'frame width');
  if (width < FRAME_MINIMAL_BELOW) return Object.freeze({ minimal: true, gutter: 0, plateWidth: FRAME_PLATE_WIDTH, contentColumn: 0, contentWidth: width });
  const gutter = width >= 60 ? 2 : 1;
  return Object.freeze({
    minimal: false, gutter, plateWidth: FRAME_PLATE_WIDTH,
    contentColumn: gutter + FRAME_PLATE_WIDTH + 1, contentWidth: width - 2 * gutter - FRAME_PLATE_WIDTH - 1,
  });
}

const toCells = (line) => line.flatMap((s) => [...s.text].map((ch) => ({ ch, style: s.style })));
function toSpans(cells) {
  const out = [];
  for (const c of cells) {
    const last = out[out.length - 1];
    if (last && last.style === c.style) last.text += c.ch;
    else out.push(span(c.ch, c.style));
  }
  return out;
}
const isBlank = (cells) => cells.every((c) => c.ch === ' ');
const trimEnd = (cells) => {
  let n = cells.length;
  while (n > 0 && cells[n - 1].ch === ' ') n--;
  return cells.slice(0, n);
};

// Word wrap a line of spans at `width` cells, keeping each span's style: break at spaces, hard-break words longer
// than the line, trim trailing spaces of wrapped lines and drop blank ones (as renderFooter's use of Pi's
// wrapTextWithAnsi). A line that fits is returned unchanged. Always at least one line.
export function wrapLine(line, width) {
  assertCells(width, 'wrap width');
  const cells = toCells(line);
  if (cells.length <= width) return [line];
  const tokens = [];
  for (const c of cells) {
    const space = c.ch === ' ';
    const last = tokens[tokens.length - 1];
    if (last && last.space === space) last.cells.push(c);
    else tokens.push({ space, cells: [c] });
  }
  const lines = [];
  let current = [];
  for (const { space, cells: word } of tokens) {
    if (!space && word.length > width) {
      if (current.length) lines.push(current);
      for (let i = 0; i < word.length; i += width) lines.push(word.slice(i, i + width));
      current = lines.pop();
      continue;
    }
    if (current.length + word.length > width && current.length > 0) {
      lines.push(trimEnd(current));
      current = space ? [] : word.slice();
    } else current = current.concat(word);
  }
  if (current.length) lines.push(current);
  const kept = lines.map(trimEnd).filter((cells) => !isBlank(cells));
  return kept.length ? kept.map(toSpans) : [[]];
}

function checkLine(line, name) {
  if (!Array.isArray(line)) throw new TypeError(`${name} must be an array of spans`);
  for (const s of line) if (s === null || typeof s !== 'object' || typeof s.text !== 'string') throw new TypeError(`${name} spans must be { text, style }`);
}
function checkPlate(plate, name) {
  if (plate === undefined) return;
  checkLine(plate, name);
  if (lineWidth(plate) > FRAME_PLATE_WIDTH) throw new RangeError(`${name} must be at most ${FRAME_PLATE_WIDTH} cells, got ${lineWidth(plate)}`);
}
function checkInput({ header = {}, spacer = [], rows = [] }) {
  if (header === null || typeof header !== 'object') throw new TypeError('header must be an object');
  checkPlate(header.plate, 'header plate');
  if (header.title !== undefined) checkLine(header.title, 'header title');
  const aside = header.aside ?? [];
  if (!Array.isArray(aside)) throw new TypeError('header aside must be an array of alternatives');
  for (const alternative of aside) {
    if (!Array.isArray(alternative) || alternative.length === 0) throw new TypeError('each aside alternative must be a non-empty array of pieces');
    alternative.forEach((piece) => checkLine(piece, 'aside piece'));
  }
  if (!Array.isArray(spacer)) throw new TypeError('spacer must be an array of lines');
  spacer.forEach((line) => checkLine(line, 'spacer line'));
  if (!Array.isArray(rows)) throw new TypeError('rows must be an array');
  for (const row of rows) {
    if (row === null || typeof row !== 'object') throw new TypeError('each row must be { plate, lines, bg }');
    checkPlate(row.plate, 'row plate');
    if (!Array.isArray(row.lines ?? [])) throw new TypeError('row lines must be an array of lines');
    (row.lines ?? []).forEach((line) => checkLine(line, 'row line'));
    if (row.bg !== undefined) resolveColor(row.bg);
  }
  return { plate: header.plate, title: header.title, aside, spacer, rows };
}

const join = (pieces) => pieces.flatMap((piece, i) => (i ? [span(' '), ...piece] : piece));
const fill = (n, bg) => (n > 0 ? [span(' '.repeat(n), bg === undefined ? {} : { bg })] : []);

// Pack pieces onto lines one field cell apart; a piece wider than the line wraps on its own lines.
function packPieces(pieces, width) {
  const lines = [];
  let line = [];
  for (const piece of pieces) {
    if (lineWidth(piece) > width) {
      if (line.length) lines.push(line);
      lines.push(...wrapLine(piece, width));
      line = [];
      continue;
    }
    if (line.length && lineWidth(line) + 1 + lineWidth(piece) > width) {
      lines.push(line);
      line = [];
    }
    line = line.length ? [...line, span(' '), ...piece] : piece;
  }
  if (line.length) lines.push(line);
  return lines;
}

// Below 40 columns: no frame; inline plates followed by their content, every value wrapped, nothing clipped.
function minimal({ plate, title, aside, spacer, rows }, width) {
  const out = [];
  if (plate || title) out.push(...wrapLine([...(plate ?? []), ...(plate && title ? [span(' ')] : []), ...(title ?? [])], width));
  if (aside.length) out.push(...packPieces(aside[aside.length - 1], width));
  for (const line of spacer) out.push(...wrapLine(line, width));
  for (const row of rows) {
    const lines = row.lines ?? [];
    const first = [...(row.plate ?? []), ...(row.plate && lines.length ? [span(' ')] : []), ...(lines[0] ?? [])];
    if (row.plate || lines.length) out.push(...wrapLine(first, width));
    for (const line of lines.slice(1)) out.push(...wrapLine(line, width));
  }
  return out.map((line) => fitLine(line, width));
}

// The framed layout or, below 40 columns, the minimal fallback. Lines are exactly `width` cells.
// input: { header: { plate, title, aside }, spacer, rows: [{ plate, lines, bg }] }; see README.md.
export function instrumentFrame(input = {}, { width, centerMark = true } = {}) {
  const geometry = frameGeometry(width);
  if (input === null || typeof input !== 'object') throw new TypeError('frame input must be an object');
  if (typeof centerMark !== 'boolean') throw new TypeError('centerMark must be a boolean');
  const parts = checkInput(input);
  if (geometry.minimal) return minimal(parts, width);

  const { gutter: G, plateWidth: P, contentColumn, contentWidth: FW } = geometry;
  const W = width, M = W - 2 * G, MID = Math.floor(W / 2);
  const plateCell = (plate) => fitLine(plate ?? [], P);

  // Header row: the aside right-aligns with one field cell of clearance before the corner; the widest alternative
  // that fits beside the whole title is used, otherwise the aside moves to its own row.
  const titleNatural = parts.title ? lineWidth(parts.title) : 0;
  const placements = parts.aside.map((alternative) => {
    const cells = join(alternative);
    return { x: W - G - 1 - lineWidth(cells), cells };
  });
  const fits = (p) => p.x >= G + 1 && p.x - 1 >= (parts.title ? contentColumn + titleNatural : G + P);
  let place = placements.find(fits);
  const ownRow = placements.length > 0 && !place;
  if (ownRow) {
    place = placements.find((p) => p.x >= G + 1) ?? placements[placements.length - 1];
    if (place.x < G + 1) place = { x: G + 1, cells: fitLine(place.cells, W - 2 * G - 2) };
  }
  const groupStart = place && !ownRow ? place.x - 1 : W - G - 1;
  const titleWidth = Math.max(1, groupStart - contentColumn);
  const titleLines = parts.title ? wrapLine(parts.title, titleWidth) : [];

  const items = [];
  const put = (x, line) => items.push({ x, line });
  put(0, [span(G === 2 ? '┏━' : '┏', STUB)]);
  put(W - G, [span(G === 2 ? '━┓' : '┓', STUB)]);
  if (parts.plate) put(G, parts.plate);
  const titleFirst = titleLines.length ? fitLine(titleLines[0], Math.min(titleWidth, lineWidth(titleLines[0]))) : [];
  const titleEnd = titleLines.length ? contentColumn + lineWidth(titleFirst) : G + P;
  if (titleLines.length) put(contentColumn, titleFirst);
  if (centerMark && MID - 2 > titleEnd && MID + 2 < groupStart) put(MID, [span('┼', STUB)]);
  if (place && !ownRow) put(place.x, place.cells);
  const placeRow = (list, n) => {
    const row = [];
    let col = 0;
    for (const item of list.sort((a, b) => a.x - b.x)) {
      if (item.x < col) continue;
      row.push(...fill(item.x - col), ...item.line);
      col = item.x + lineWidth(item.line);
    }
    return fitLine(row, n);
  };

  // Inner rows: plate column, one gap cell, then content at the content column; continuations leave the plate
  // column plain field. A row's `bg` fills its gap cell and the padding after its content (status-bar's model band).
  const inner = [];
  const contentRow = (plate, line, bg) => [...plateCell(plate), ...fill(1, bg), ...fitLine(line, FW, bg === undefined ? {} : { bg })];
  for (const line of titleLines.slice(1)) inner.push(contentRow(undefined, line));
  if (ownRow) inner.push(placeRow([{ x: place.x - G, line: place.cells }], M));
  const spacer = parts.spacer.length ? parts.spacer.flatMap((line) => wrapLine(line, FW)) : [[]];
  for (const line of spacer) inner.push(contentRow(undefined, line));
  for (const row of parts.rows) {
    const lines = row.lines?.length ? row.lines : [[]];
    lines.forEach((line, i) => wrapLine(line, FW).forEach((piece, j) => inner.push(contentRow(i === 0 && j === 0 ? row.plate : undefined, piece, row.bg))));
  }

  // Corner stubs on the header row and the last row; side stubs only on the first and next-to-last inner rows.
  const last = inner.length;
  const framed = inner.map((row, j) => {
    const i = j + 1, edge = i === 1 || i === last - 1;
    const left = i === last ? (G === 2 ? '┗━' : '┗') : edge ? '┃'.padEnd(G) : ' '.repeat(G);
    const right = i === last ? (G === 2 ? '━┛' : '┛') : edge ? '┃'.padStart(G) : ' '.repeat(G);
    return fitLine([span(left, STUB), ...row, span(right, STUB)], W);
  });
  return [placeRow(items, W), ...framed];
}
