import { GLYPHS } from '@industrial-os/design-system/foundation/cells';
// Source is retained; only display/input boundaries remove terminal controls.
const CURATED = new Set(GLYPHS);
const segments = new Intl.Segmenter('und', { granularity: 'grapheme' });
export const graphemes = (value) => [...segments.segment(String(value))].map((s) => s.segment);
export const clean = (value) =>
  String(value).replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069]/gu, '');
export const display = (value) =>
  graphemes(clean(value))
    .map((g) => (/^[\x20-\x7e\n\t]+$/.test(g) ? g.replace(/\t/g, ' ') : CURATED.has(g) ? g : '?'))
    .join('');
// Typed and pasted text keeps printable ASCII and the curated one-cell glyphs (such as · and —), which the caret
// and wrapping can measure; anything else is dropped.
const typeable = (g) => /^[\x20-\x7e\n]$/.test(g) || CURATED.has(g);
export const inputText = (value) => graphemes(clean(value)).filter(typeable).join('');
export const untypeable = (value) => graphemes(clean(value)).some((g) => !typeable(g));
// Wrapped rows with the index each starts at, so a caret index and a drawn row and column map both ways.
// shortcut: indices assume one display character per grapheme with no control characters, true for typed text.
export function wrapRows(value, width) {
  width = Math.max(1, width);
  const rows = [];
  let start = 0;
  for (let line of display(value).split('\n')) {
    let at = start;
    while (line.length > width) {
      let n = line.lastIndexOf(' ', width);
      if (n < width / 3) n = width;
      rows.push({ start: at, text: line.slice(0, n) });
      const skip = line[n] === ' ' ? 1 : 0;
      line = line.slice(n + skip);
      at += n + skip;
    }
    rows.push({ start: at, text: line });
    start = at + line.length + 1;
  }
  return rows;
}
export const wrap = (value, width) => wrapRows(value, width).map((row) => row.text);
// Where the caret at an index is drawn: the last row starting at or before it.
export function caretPos(value, width, index) {
  const rows = wrapRows(value, width);
  let row = 0;
  while (row + 1 < rows.length && rows[row + 1].start <= index) row++;
  return { row, col: Math.min(index - rows[row].start, rows[row].text.length) };
}
// The caret index drawn at a clicked row and column: that column, or the row's end; below the last row, the end.
export function caretAt(value, width, row, col) {
  const rows = wrapRows(value, width);
  if (row >= rows.length) return graphemes(value).length;
  return rows[row].start + Math.min(Math.max(0, col), rows[row].text.length);
}
// Cursor is a grapheme index, never a UTF-16 offset. Given the box's text width, Up/Down move by the rows drawn,
// so they also move within a wrapped paragraph; without it, by the lines Enter made.
export function editText(text, cursor, key, insert = '', width = 0) {
  const g = graphemes(text);
  cursor = Math.min(cursor, g.length);
  // Word edges: skip spaces, then the word, the way readline and macOS Option-arrows do.
  const space = (c) => c === undefined || /\s/.test(c);
  const wordLeft = () => {
    let i = cursor;
    while (i > 0 && space(g[i - 1])) i--;
    while (i > 0 && !space(g[i - 1])) i--;
    return i;
  };
  const wordRight = () => {
    let i = cursor;
    while (i < g.length && space(g[i])) i++;
    while (i < g.length && !space(g[i])) i++;
    return i;
  };
  const lineStart = () => {
    let i = cursor;
    while (i > 0 && g[i - 1] !== '\n') i--;
    return i;
  };
  const lineEnd = () => {
    let i = cursor;
    while (i < g.length && g[i] !== '\n') i++;
    return i;
  };
  if (key === 'word-left') cursor = wordLeft();
  else if (key === 'word-right') cursor = wordRight();
  else if (key === 'word-backspace') {
    const i = wordLeft();
    g.splice(i, cursor - i);
    cursor = i;
  } else if (key === 'word-delete') g.splice(cursor, wordRight() - cursor);
  // Ctrl-K at a line's end joins the next line, as in readline.
  else if (key === 'kill-end') g.splice(cursor, Math.max(1, lineEnd() - cursor));
  else if (key === 'kill-start') {
    const i = lineStart();
    g.splice(i, cursor - i);
    cursor = i;
  } else if (key === 'left') cursor = Math.max(0, cursor - 1);
  else if (key === 'right') cursor = Math.min(g.length, cursor + 1);
  else if (key === 'home') cursor = lineStart();
  else if (key === 'end') cursor = lineEnd();
  else if ((key === 'up' || key === 'down') && width > 0) {
    const { row, col } = caretPos(text, width, cursor),
      last = wrapRows(text, width).length - 1;
    // Past the first or last row, the caret goes to the text's start or end, as in a native text field.
    if (key === 'up') cursor = row > 0 ? caretAt(text, width, row - 1, col) : 0;
    else cursor = row < last ? caretAt(text, width, row + 1, col) : g.length;
  } else if (key === 'up' || key === 'down') {
    let start = cursor;
    while (start > 0 && g[start - 1] !== '\n') start--;
    const col = cursor - start;
    if (key === 'up' && start > 0) {
      let prev = start - 1;
      while (prev > 0 && g[prev - 1] !== '\n') prev--;
      cursor = Math.min(prev + col, start - 1);
    }
    if (key === 'down') {
      let end = cursor;
      while (end < g.length && g[end] !== '\n') end++;
      if (end < g.length) {
        let next = end + 1;
        while (next < g.length && g[next] !== '\n') next++;
        cursor = Math.min(end + 1 + col, next);
      }
    }
  } else if (key === 'backspace' && cursor > 0) g.splice(--cursor, 1);
  else if (key === 'delete') g.splice(cursor, 1);
  else if (key === 'text' || key === 'enter' || key === 'newline') {
    const add = graphemes(key === 'text' ? inputText(insert) : '\n');
    g.splice(cursor, 0, ...add);
    cursor += add.length;
  }
  return { text: g.join(''), cursor };
}
