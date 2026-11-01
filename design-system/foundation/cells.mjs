// Shared cell and style seam. A line is an array of spans { text, style }; every code point in a span
// occupies one cell by default. Opt-in measured slots use host widths and whole graphemes instead.
// See foundation/README.md for the text and trust-boundary contracts.
import { ACID_BLACK } from './palette.mjs';

// Curated structural glyphs: Narrow, Ambiguous or Neutral East Asian Width; the host must render each one cell wide.
export const GLYPHS = '─│┌┐└┘╵╱▐▌█▏▎▍▋▊▉░○●▲✕…━┃┏┓┗┛┼▀▄▒▓▚▞■▪·•◆▴⌑⑂×╴╶┄├┬┤┴┸▤▣▸▾▼◇›┣┫┻▆□⏎◢◤◣◥◩▁▶↑↓–—↷◐✓®▦≡⟁' + Array.from({ length: 256 }, (_, i) => String.fromCodePoint(0x2800 + i)).join('');

const PRINTABLE_ASCII = /[^\x20-\x7e]/gu;

// Display form of caller text: anything outside printable ASCII (controls, ESC, combining marks,
// wide or emoji code points) becomes '?', one per code point. The caller's source value is untouched.
export function safeText(value) {
  if (typeof value !== 'string') throw new TypeError(`expected display text to be a string, got ${typeof value}`);
  return value.replace(PRINTABLE_ASCII, '?');
}

const graphemes = new Intl.Segmenter('und', { granularity: 'grapheme' });
const UNSAFE_TEXT = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069]/u;

function assertTextStart(text) {
  if (/^[\p{Grapheme_Extend}\p{Emoji_Modifier}\u200d]/u.test(text)) throw new RangeError('measured text cannot start with Extend or ZWJ');
}

function measured(text, measure) {
  if (typeof text !== 'string' || !text.isWellFormed() || UNSAFE_TEXT.test(text)) throw new TypeError('measured text must be control- and bidi-safe');
  if (typeof measure !== 'function') throw new TypeError('measure must be a function');
  const width = measure(text);
  if (!Number.isSafeInteger(width) || width < 0) throw new RangeError('measured width must be a non-negative safe integer');
  return width;
}

export function cells(text, { measure } = {}) {
  return measure === undefined ? [...text].length : measured(text, measure);
}

// Reject span boundaries inside a grapheme: clipping and styling must never tear a ZWJ cluster apart.
export function textSlot(spans, width, { measure } = {}) {
  if (!Array.isArray(spans)) throw new TypeError('slot spans must be an array');
  if (!Number.isSafeInteger(width) || width < 0) throw new RangeError('slot width must be a non-negative safe integer');
  const copy = Array.from(spans, (s) => {
    if (!s || typeof s.text !== 'string') throw new TypeError('slot spans need string text');
    measured(s.text, measure);
    resolveStyle(s.style);
    return span(s.text, { ...s.style });
  });
  const text = copy.map((s) => s.text).join('');
  assertTextStart(text);
  if (measured(text, measure) !== width || copy.reduce((n, s) => n + measured(s.text, measure), 0) !== width) {
    throw new RangeError('slot width does not match measure(text)');
  }
  const boundaries = new Set([...graphemes.segment(text)].map((s) => s.index));
  boundaries.add(text.length);
  let end = 0;
  for (const s of copy) {
    end += s.text.length;
    if (!boundaries.has(end)) throw new RangeError('slot span splits a grapheme');
  }
  return { spans: copy, width };
}

// Shared text-bearing element seam. Structured slots retain their styles; string text uses the supplied style.
// `ellipsis: 'always'` marks an overflow with `…` even at one cell, where the default keeps the first grapheme.
export function fitText(value, n, { measure, style = {}, ellipsis = 'fit' } = {}) {
  if (n !== Infinity && (!Number.isInteger(n) || n < 0 || n > 1000)) throw new RangeError('text budget must be 0–1000 or Infinity');
  if (ellipsis !== 'fit' && ellipsis !== 'always') throw new RangeError('ellipsis must be fit or always');
  resolveStyle(style);
  let line;
  if (typeof value === 'string') {
    const text = measure === undefined ? safeText(value) : value;
    cells(text, { measure });
    if (measure !== undefined) assertTextStart(text);
    line = [span(text, style)];
  } else {
    if (!value || typeof value !== 'object') throw new TypeError('text must be a string or text slot');
    line = textSlot(value.spans, value.width, { measure }).spans;
  }
  const width = lineWidth(line, { measure });
  if (width <= n) return line;
  if (n === 1 && ellipsis === 'always' && cells('…', { measure }) === 1) return [span('…', typeof value === 'string' ? style : line[0]?.style ?? style)];
  if (measure === undefined) return [span(fit(line[0].text, n), style)];
  if (n === 0) return [];
  const markWidth = cells('…', { measure });
  const budget = n === 1 ? n : Math.max(0, n - markWidth);
  const clipped = clipMeasured(line, budget, measure);
  if (n > 1 || !lineWidth(clipped, { measure })) {
    if (markWidth <= n) clipped.push(span('…', clipped.at(-1)?.style ?? style));
  }
  return clipped;
}

// Truncate already-safe text to n cells, marking the cut with an ellipsis.
export function fit(text, n, { measure } = {}) {
  if (measure !== undefined) return fitText(text, n, { measure }).map((s) => s.text).join('');
  const chars = [...text];
  if (chars.length <= n) return text;
  if (n <= 0) return '';
  return n === 1 ? chars[0] : chars.slice(0, n - 1).join('') + '…';
}

export function span(text, style = {}) {
  return { text, style };
}

export function lineWidth(line, { measure } = {}) {
  return line.reduce((sum, s) => sum + cells(s.text, { measure }), 0);
}

// Clip or pad a line to exactly n cells. Every renderer ends here, so output never exceeds its budget.
function clipMeasured(line, n, measure) {
  const checked = textSlot(line, lineWidth(line, { measure }), { measure }).spans;
  const out = [];
  let left = n;
  outer: for (const s of checked) {
    let text = '';
    for (const { segment } of graphemes.segment(s.text)) {
      const width = cells(segment, { measure });
      if (width > left) { if (text) out.push(span(text, s.style)); break outer; }
      text += segment;
      left -= width;
    }
    if (text) out.push(span(text, s.style));
  }
  return out;
}

export function fitLine(line, n, padStyle = {}, { measure } = {}) {
  if (measure !== undefined) {
    if (!Number.isInteger(n) || n < 0 || n > 1000) throw new RangeError('line budget must be 0–1000');
    const out = clipMeasured(line, n, measure);
    const left = n - lineWidth(out, { measure });
    if (left) out.push(span(' '.repeat(left), padStyle));
    return out;
  }
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

// The #RRGGBB value of an Acid / Black role or literal RGB; unknown terminal colors cannot resolve.
export function resolveColor(value) {
  if (typeof value === 'string') {
    if (Object.hasOwn(ACID_BLACK, value)) return ACID_BLACK[value];
    if (value.length === 7 && /^#[0-9a-f]{6}$/i.test(value)) return value;
  }
  throw new TypeError('paint color must be an Acid / Black role or exact #RRGGBB string');
}

export const isTerminalDefault = (value) => value === 'default';

// Concrete, host-independent style. Omission retains the historical secondary/field defaults.
export function resolveStyle({ fg = 'secondary', bg = 'field', bold = false, italic, underline } = {}) {
  for (const flag of [italic, underline]) if (flag !== undefined && typeof flag !== 'boolean') throw new TypeError('style flags must be boolean');
  return { fg: isTerminalDefault(fg) ? 'default' : resolveColor(fg), bg: isTerminalDefault(bg) ? 'default' : resolveColor(bg), bold, ...(italic === undefined ? {} : { italic }), ...(underline === undefined ? {} : { underline }) };
}

function sgr(style) {
  const { fg, bg, bold, italic, underline } = resolveStyle(style);
  const foreground = fg === 'default' ? '39' : `38;2;${rgb(fg)}`;
  const background = bg === 'default' ? '49' : `48;2;${rgb(bg)}`;
  return `\x1b[0;${bold ? '1;' : ''}${italic ? '3;' : ''}${underline ? '4;' : ''}${foreground};${background}m`;
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
