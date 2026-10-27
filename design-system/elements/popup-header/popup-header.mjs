import { assertCells, fitLine, fitText, lineWidth, resolveColor, span } from '../../foundation/cells.mjs';
import { mixOver } from '../../foundation/signal-colors.mjs';
import { SURFACE_PALETTE as P } from '../../foundation/surface-palette.mjs';
import { labelPlate } from '../label-plate/label-plate.mjs';
import { actionLabel } from '../action-label/action-label.mjs';

function row(left, title, meta, width, measure, background, margin) {
  const clear = { bg: background };
  const available = Math.max(0, width - margin - lineWidth(left, { measure }));
  const middle = fitText(title, Math.max(0, available - 1), { measure, style: { fg: background === 'default' ? 'primary' : 'secondary', ...clear, bold: background === 'default' } });
  const used = lineWidth(left, { measure }) + 1 + lineWidth(middle, { measure });
  const metaBudget = Math.max(0, width - used - 2);
  const right = fitText(meta, metaBudget >= 8 ? metaBudget : 0, { measure, style: { fg: 'decorative', ...clear } });
  const rightWidth = lineWidth(right, { measure });
  return fitLine([...left, span(' ', clear), ...middle, ...(rightWidth ? [span(' '.repeat(Math.max(0, width - 1 - used - rightWidth)), clear), ...right, span(' ', clear)] : [])], width, clear, { measure });
}

export function popupHeader({ plate, title = '', meta = '', style = { fg: 'field', bg: P.wheat } }, { width, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width, 'popup header width');
  const label = labelPlate(plate, { form: 'slab', style, maxWidth: Math.max(0, width - 1), measure });
  return row([span(' ', { bg: 'default' }), ...label], title, meta, width, measure, 'default', 1);
}

export function popupFooter({ escape = 'back to the desk', meta = '' } = {}, { width, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width, 'popup footer width');
  const key = actionLabel({ label: 'Esc', kind: 'keycap' }, { maxWidth: width, style: { fg: 'field', bg: P.plateGrey }, measure });
  return row(key, escape, meta, width, measure, 'surface', 0);
}

// The board popup (the automations monitor's run modal): a frame filled with the field, a title bar, and the fade
// applied to everything behind it.
function object(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

// A heavy primary top rule, structural sides and a structural floor; `height` lines of `width` cells.
export function popupFrame(input, { width } = {}) {
  const { height } = object(input, 'popup frame input');
  assertCells(width, 'popup frame width');
  assertCells(height, 'popup frame height');
  const on = (fg) => ({ fg, bg: 'field' });
  const side = width > 1
    ? [span('│', on('structural')), ...(width > 2 ? [span(' '.repeat(width - 2), on('secondary'))] : []), span('│', on('structural'))]
    : [span('│', on('structural'))];
  return Array.from({ length: height }, (_, y) => (
    y === height - 1 ? [span('─'.repeat(width), on('structural'))] : y === 0 ? [span('━'.repeat(width), on('primary'))] : side.map((s) => ({ ...s, style: { ...s.style } }))
  ));
}

// One row: a state cell (`mark`) or a filled `band` behind the whole row, then from the third cell a bold title, a
// bold state word and a detail, two cells apart, and the close action right-aligned. The close action keeps its place;
// the title, word and detail yield to it in that order.
export function popupTitleBar(input, { width, measure, ellipsis } = {}) {
  const { mark, band, title, word = '', wordInk, detail = '', meta = '' } = object(input, 'popup title bar input');
  assertCells(width, 'popup title bar width');
  if ((mark === undefined) === (band === undefined)) throw new TypeError('popup title bar needs exactly one of mark or band');
  for (const [name, value] of [['title', title], ['word', word], ['detail', detail], ['meta', meta]]) if (typeof value !== 'string') throw new TypeError(`popup title bar ${name} must be a string`);
  if (band !== undefined) { object(band, 'popup band'); resolveColor(band.fill); resolveColor(band.ink); } else resolveColor(mark);
  if (wordInk !== undefined) resolveColor(wordInk);
  const tb = band ? { bg: band.fill } : {};
  const ink = (quiet) => (band ? band.ink : quiet);
  const cells = Array.from({ length: width }, () => [' ', band ? { fg: 'secondary', bg: band.fill } : {}]);
  if (!band) cells[0] = ['█', { fg: mark }];
  const put = (x, text, style, max = Infinity) => {
    const shown = fitText(text, Math.max(0, Math.min(1000, max)), { measure, ellipsis, style });
    let at = x;
    for (const s of shown) for (const ch of [...s.text]) { if (at >= 0 && at < width) cells[at] = [ch, s.style]; at += 1; }
    return x + lineWidth(shown, { measure });
  };
  const metaWidth = lineWidth(fitText(meta, Infinity, { measure }), { measure });
  const closeX = width - metaWidth;
  put(closeX, meta, { fg: ink('decorative'), ...tb });
  let tx = put(2, title, { fg: ink('primary'), bold: true, ...tb }, closeX - 4);
  tx = put(tx + 2, word, { fg: ink(wordInk ?? 'primary'), bold: true, ...tb }, closeX - tx - 4);
  put(tx + 2, detail, { fg: ink('decorative'), ...tb }, closeX - tx - 4);
  const line = [];
  for (const [ch, style] of cells) {
    const last = line.at(-1);
    if (last && JSON.stringify(last.style) === JSON.stringify(style)) last.text += ch;
    else line.push(span(ch, style));
  }
  return fitLine(line, width, {}, { measure });
}

// Everything behind a popup fades to a quarter over the field and loses its weight. Takes and returns a cell style;
// an omitted ink is the field's own secondary text on the field.
export const POPUP_BACKDROP = 0.25;
export function popupBackdrop(style) {
  const { fg = 'secondary', bg = 'field' } = object(style, 'backdrop style');
  return { fg: mixOver(fg, POPUP_BACKDROP), bg: mixOver(bg, POPUP_BACKDROP), bold: false };
}
