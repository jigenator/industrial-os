import { assertCells, fitLine, fitText, lineWidth, resolveStyle, span } from '../../foundation/cells.mjs';
import { SURFACE_PALETTE as P } from '../../foundation/surface-palette.mjs';

export function actionLabel({ label = 'open', kind = 'open', state = 'ready' } = {}, { maxWidth = Infinity, style, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  if (!['open', 'keycap'].includes(kind)) throw new RangeError('action kind must be open or keycap');
  if (!['ready', 'read', 'hover', 'focused'].includes(state)) throw new RangeError('unknown action state');
  if (maxWidth !== Infinity && (!Number.isInteger(maxWidth) || maxWidth < 0 || maxWidth > 1000)) throw new RangeError('action maxWidth must be 0–1000 or Infinity');
  if (style !== undefined) resolveStyle(style);
  const plain = state === 'read';
  const ink = { fg: plain ? P.wheat : 'field', bg: plain ? 'default' : P.wheat, bold: true, ...style };
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
