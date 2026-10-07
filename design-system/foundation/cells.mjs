// Shared cell and style seam. A line is an array of spans { text, style }; every code point in a span
// occupies exactly one terminal cell. That holds only because span text is either sanitized caller text
// (printable ASCII) or one of the curated GLYPHS below. See foundation/README.md for the full contract.
import { ACID_BLACK } from './palette.mjs';

// Curated structural glyphs. All are East Asian Width Narrow or Ambiguous and must render one cell wide.
export const GLYPHS = '─│┌┐└┘╵╱▐▌█▏▎▍▋▊▉░○●▲✕…';

const PRINTABLE_ASCII = /[^\x20-\x7e]/gu;

// Display form of caller text: anything outside printable ASCII (controls, ESC, combining marks,
// wide or emoji code points) becomes '?', one per code point. The caller's source value is untouched.
export function safeText(value) {
  if (typeof value !== 'string') throw new TypeError(`expected display text to be a string, got ${typeof value}`);
  return value.replace(PRINTABLE_ASCII, '?');
}

export function cells(text) {
  return [...text].length;
}

// Truncate already-safe text to n cells, marking the cut with an ellipsis.
export function fit(text, n) {
  const chars = [...text];
  if (chars.length <= n) return text;
  if (n <= 0) return '';
  return n === 1 ? chars[0] : chars.slice(0, n - 1).join('') + '…';
}

export function span(text, style = {}) {
  return { text, style };
}

export function lineWidth(line) {
  return line.reduce((sum, s) => sum + cells(s.text), 0);
}

// Clip or pad a line to exactly n cells. Every renderer ends here, so output never exceeds its budget.
export function fitLine(line, n, padStyle = {}) {
  const out = [];
  let left = n;
  for (const s of line) {
    if (left <= 0) break;
    const chars = [...s.text];
    out.push(chars.length <= left ? s : span(chars.slice(0, left).join(''), s.style));
    left -= Math.min(chars.length, left);
  }
  if (left > 0) out.push(span(' '.repeat(left), padStyle));
  return out;
}

export function blank(n) {
  return fitLine([], n);
}

export function assertCells(n, name) {
  if (!Number.isInteger(n) || n < 1 || n > 1000) throw new RangeError(`${name} must be an integer from 1 to 1000, got ${n}`);
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(';');

function colorHex(value) {
  if (typeof value === 'string') {
    if (Object.hasOwn(ACID_BLACK, value)) return ACID_BLACK[value];
    if (value.length === 7 && /^#[0-9a-f]{6}$/i.test(value)) return value;
  }
  throw new TypeError('paint color must be an Acid / Black role or exact #RRGGBB string');
}

function sgr({ fg = 'secondary', bg = 'field', bold = false }) {
  return `\x1b[0;${bold ? '1;' : ''}38;2;${rgb(colorHex(fg))};48;2;${rgb(colorHex(bg))}m`;
}

// Truecolor validates named roles or literal RGB; 'none' emits text without inspecting styles.
export function paint(line, color) {
  if (color === 'none') return line.map((s) => s.text).join('');
  let out = '';
  let last;
  for (const s of line) {
    const code = sgr(s.style);
    if (code !== last) out += code;
    out += s.text;
    last = code;
  }
  return out + '\x1b[0m';
}
