import { assertCells, fitLine, fitText, lineWidth, resolveStyle, span } from '../../foundation/cells.mjs';
import { BAY_INKS, SURFACE_PALETTE as P } from '../../foundation/surface-palette.mjs';

export function actionLabel({ label = 'open', kind = 'open', state = 'ready' } = {}, { maxWidth = Infinity, style, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  if (!['open', 'keycap'].includes(kind)) throw new RangeError('action kind must be open or keycap');
  if (!['ready', 'read', 'hover'].includes(state)) throw new RangeError('unknown action state');
  if (maxWidth !== Infinity && (!Number.isInteger(maxWidth) || maxWidth < 0 || maxWidth > 1000)) throw new RangeError('action maxWidth must be 0–1000 or Infinity');
  if (style !== undefined) resolveStyle(style);
  const plain = state === 'read';
  const ink = { fg: plain ? P.wheat : 'field', bg: plain ? 'default' : state === 'hover' ? P.wheatHi : P.wheat, bold: !plain, ...style };
  const before = plain ? '[' : ' ', after = kind === 'open' ? (plain ? ' ▸]' : ' ▸ ') : (plain ? ']' : ' ');
  const content = fitText(label, Math.max(0, maxWidth - before.length - after.length), { measure, style: ink });
  // Even tiny widths keep a visible action boundary; no implied hit target is returned.
  return maxWidth === Infinity ? [span(before, ink), ...content, span(after, ink)]
    : fitLine([span(before, ink), ...content, span(after, ink)], Math.min(maxWidth, before.length + lineWidth(content, { measure }) + after.length), { bg: 'default' }, { measure });
}

export function keyHints(tokens, { width, measure } = {}) {
  if (arguments[1] !== undefined && (arguments[1] === null || typeof arguments[1] !== 'object' || Array.isArray(arguments[1]))) throw new TypeError('key hint options must be an object');
  assertCells(width, 'key hints width');
  if (!Array.isArray(tokens)) throw new TypeError('key hint tokens must be an array');
  const out = [span(' ', { bg: 'default' })];
  for (const token of tokens) {
    if (!token || typeof token !== 'object' || Array.isArray(token)) throw new TypeError('key hint token must be an object');
    const key = fitText(token.key ?? '', Infinity, { measure, style: { fg: P.bone, bg: 'surface', bold: true } });
    const label = fitText(token.label, Infinity, { measure, style: { fg: 'decorative', bg: 'default' } });
    const piece = [...key, ...(lineWidth(key, { measure }) ? [span(' ', { bg: 'default' })] : []), ...label, span('  ', { bg: 'default' })];
    if (lineWidth(out, { measure }) + lineWidth(piece, { measure }) <= width) out.push(...piece);
    else break;
  }
  return fitLine(out, width, { bg: 'default' }, { measure });
}

// The keycap bay: one-glyph bracket keys `[g]`, adjacent and centred on one ground `width` cells wide (the pane plate's
// 16-column title block: 2 + 4 × 3 + 2). The ground carries the bay's edges; the end ground cells belong to the end
// keys' hit areas, so nothing in the bay is dead. `lighting` picks BAY_INKS' level; `hover` and `pressed` (a key index,
// pressed first) fill that key's cells. Returns the line and each key's cells and hit area, from the bay's first cell.
export function keycapBay(keys, { width = 16, lighting = 'lit', hover = null, pressed = null } = {}) {
  if (!Array.isArray(keys) || keys.length === 0) throw new TypeError('keycap bay keys must be a non-empty array');
  for (const key of keys) if (!key || typeof key.glyph !== 'string' || !/^[\x21-\x7e]$/.test(key.glyph)) throw new TypeError('each bay key needs one printable ASCII glyph');
  assertCells(width, 'keycap bay width');
  if (width < 3 * keys.length) throw new RangeError('keycap bay is narrower than its keys');
  if (!['lit', 'standby', 'dark'].includes(lighting)) throw new RangeError('keycap bay lighting must be lit, standby or dark');
  for (const [name, value] of Object.entries({ hover, pressed })) {
    if (value !== null && (!Number.isInteger(value) || value < 0 || value >= keys.length)) throw new RangeError(`keycap bay ${name} must be a key index or null`);
  }
  const ink = BAY_INKS[lighting], pad = Math.floor((width - 3 * keys.length) / 2), cells = [];
  for (let x = 0; x < width; x++) cells.push(span(' ', { fg: ink.bracket, bg: ink.ground }));
  const out = keys.map((key, i) => {
    const col = pad + 3 * i, over = i === pressed ? BAY_INKS.pressed : i === hover ? BAY_INKS.hover : null;
    ['[', key.glyph, ']'].forEach((ch, c) => {
      const edge = c !== 1;
      cells[col + c] = span(ch, { fg: over ? over.glyph : edge ? ink.bracket : ink.glyph, bg: over ? over.ground : ink.ground, bold: !edge });
    });
    const hitCol = i === 0 ? 0 : col, hitEnd = i === keys.length - 1 ? width - 1 : col + 2;
    return { col, len: 3, hitCol, hitLen: hitEnd - hitCol + 1 };
  });
  const line = [];
  for (const cell of cells) {
    const last = line.at(-1);
    if (last && last.style.fg === cell.style.fg && last.style.bg === cell.style.bg && last.style.bold === cell.style.bold) last.text += cell.text;
    else line.push(span(cell.text, { ...cell.style }));
  }
  return { line, keys: out };
}
