import { assertCells, fitLine, fitText, lineWidth, span } from '../../foundation/cells.mjs';
import { SURFACE_PALETTE as P } from '../../foundation/surface-palette.mjs';
import { SIGNAL_COLORS } from '../../foundation/signal-colors.mjs';
import { leader } from '../tab-rule/tab-rule.mjs';
import { stateChip } from '../state-chip/state-chip.mjs';
import { actionLabel } from '../action-label/action-label.mjs';
const clear = { bg: 'default' };
export const SHEET_STATES = Object.freeze(Object.fromEntries(Object.entries({
  unread: { code: 'unread', shape: '◆', tone: P.wheat }, read: { code: 'read', shape: '', tone: 'decorative' },
  waiting: { code: 'waiting on you', shape: '●', tone: 'critical' }, answered: { code: 'answered', shape: '', tone: 'accent' },
  declined: { code: 'declined', shape: '', tone: 'decorative' }, 'delivery-waiting': { code: 'delivery waiting', shape: '●', tone: 'warning' },
}).map(([key,value]) => [key,Object.freeze(value)])));
const size = (l, measure) => lineWidth(l, { measure });
function tone(state) { if (!Object.hasOwn(SHEET_STATES, state)) throw new RangeError('unknown sheet state'); return SHEET_STATES[state].tone; }
function flags(...values) { if (values.some(v => typeof v !== 'boolean')) throw new TypeError('card flags must be boolean'); }
export function cardState({ state = 'unread', answer = '' } = {}, { maxWidth = Infinity, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  tone(state);
  const word = stateChip({ state }, { form: 'word', preset: SHEET_STATES, maxWidth, measure }).map(s => span(s.text, { ...s.style, bold: state === 'unread' }));
  const detail = fitText(answer, Infinity, { measure, style: { fg: tone(state), ...clear } });
  const result = [...word, ...(state === 'answered' && size(detail, measure) ? [span(' · ', { fg: 'accent', ...clear }), ...detail] : [])];
  return maxWidth === Infinity ? result : fitLine(result, Math.min(maxWidth, size(result, measure)), clear, { measure });
}
export function cardHeading({ number = '', time = '', state = 'unread', answer = '' } = {}, { width, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width, 'card heading width');
  const ink = ['read', 'answered', 'declined'].includes(state) ? 'decorative' : tone(state), right = cardState({ state, answer }, { maxWidth: Math.max(0, width - 2), measure });
  const left = [span('▤ SHEET ', { fg: ink, bold: true, ...clear }), ...fitText(number, Infinity, { measure, style: { fg: ink, bold: true, ...clear } }), span('  ', clear), ...fitText(time, Infinity, { measure, style: { fg: 'decorative', ...clear } })];
  const room = Math.max(0, width - 2 - size(right, measure) - 1);
  return fitLine([span(' ', clear), ...fitLine(left, room, clear, { measure }), span(' ', clear), ...right, span(' ', clear)], width, clear, { measure });
}
export function sheetCard({ heading = {}, kind = 'info', title = '', gist = [], footer = '', read = false, hover = false, button = 'open' } = {}, { width, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width, 'sheet card width'); flags(read, hover);
  if (!heading || typeof heading !== 'object' || Array.isArray(heading)) throw new TypeError('heading must be an object');
  if (!['info','question'].includes(kind)) throw new RangeError('card kind must be info or question');
  if (!Array.isArray(gist) || gist.length > 2) throw new TypeError('gist must contain at most two prewrapped rows');
  const state = heading.state ?? (read ? 'read' : 'unread');
  const normalInk = tone(state);
  const hoverInk = { unread: P.wheatHi, waiting: P.criticalHover, answered: P.answered, declined: P.declined };
  const ink = hover ? hoverInk[state] ?? normalInk : normalInk, bg = read ? 'default' : hover ? P.tintHi : P.tint;
  const style = { bg }, room = Math.max(0, width - 4);
  const band = (value, strong = false, action, footer = false) => {
    const textRoom = Math.max(0, room - (action ? size(action, measure) + 1 : 0));
    const content = fitText(value, textRoom, { measure, style: { fg: footer ? 'decorative' : strong ? (read && !hover ? 'secondary' : 'primary') : read ? 'decorative' : 'secondary', bold: strong && !read, bg } }).map(s => span(s.text, { ...s.style, bg }));
    return fitLine([span(' ', clear), span('█ ', { fg: read ? SIGNAL_COLORS.ghost : ink, bg }), ...fitLine(content, textRoom, style, { measure }), ...(action ? [span(' ', style), ...action] : []), span(' ', clear)], width, clear, { measure });
  };
  const action = actionLabel({ label: button, state: read ? 'read' : hover ? 'hover' : 'ready' }, { maxWidth: room, measure, style: read ? { bg: 'default', ...(hover ? { fg: P.wheatHi } : {}) } : { bg: ink, fg: 'field' } });
  return [cardHeading({ ...heading, state }, { width, measure }), band(title, true, action), band(gist[0] ?? ''), ...(kind === 'info' ? [band(gist[1] ?? ''), band(footer, false, undefined, true)] : [])];
}
function itemRow({ label = '', title = '', state = 'unread', answer = '', selected = false, hover = false, last = false, updated }, { width, measure }, tree) {
  assertCells(width, 'sheet row width'); flags(selected, hover, last);
  const ink = tone(state), bg = selected ? ink : hover ? P.tintHi : P.tint;
  const right = [...cardState({ state, answer }, { maxWidth: Math.max(0,width - 6), measure }), ...(updated === undefined ? [] : [span('  ', clear), ...fitText(updated, Math.min(7, Math.max(0,width - 6)), { measure, style: { fg: 'decorative', ...clear } })])];
  const start = tree ? 3 : 2, room = Math.max(0, width - start - 3 - size(right, measure));
  const prefix = fitText(label, room, { measure, style: { fg: 'decorative', ...clear } });
  const content = [...prefix, span('  ', clear), ...fitText(title, Math.max(0,room - size(prefix,measure) - 2), { measure, style: { fg: state === 'read' ? 'decorative' : 'primary', bold: state !== 'read', ...clear } })];
  const fill = l => l.map(s => span(s.text, { ...s.style, bg, ...(selected ? { fg: 'field', bold: true } : {}) }));
  return fitLine([span(tree ? ' ' + (last ? '└─' : '├─') : '  ', { fg: selected ? 'accent' : P.rule, ...clear }), span('█', { fg: ink, bg }), span(selected ? '▸' : ' ', { fg: selected ? 'field' : 'decorative', bg }), ...fill(fitLine(content, room, { bg }, { measure })), ...fill(right), span(' ', clear)], width, clear, { measure });
}
export function stackRow(input = {}, options = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  return itemRow(input, options, true);
}
export function sheetListRow({ label = '', title = '', state = 'unread', answer = '', selected = false, hover = false, updated = '' } = {}, { width, measure, columns = {} } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width, 'sheet list width'); flags(selected, hover);
  if (!columns || typeof columns !== 'object' || Array.isArray(columns)) throw new TypeError('list columns must be an object');
  const positions = { state: Math.max(4, width - 30), updated: Math.max(4, width - 8), ...columns };
  for (const [key, value] of Object.entries(positions)) if (!['state', 'updated'].includes(key) || !Number.isInteger(value) || value < 0 || value > 1000) throw new RangeError('list columns must be cell positions 0–1000');
  if (positions.updated < positions.state) throw new RangeError('updated column must follow state column');
  const stateColumn = Math.min(width, Math.max(4, positions.state)), updatedColumn = Math.min(width, Math.max(stateColumn, positions.updated));
  const ink = state === 'read' ? P.wheat : tone(state), bg = selected ? ink : 'default';
  const style = { bg, ...(selected ? { fg: 'field', bold: true } : {}) };
  const fill = line => line.map(s => span(s.text, { ...s.style, ...style }));
  const room = Math.max(0, stateColumn - 4);
  const number = fitText(label, Math.min(6, Math.max(0,room-2)), { measure, style: { fg: 'decorative', ...style } });
  const content = [span('  ',style), ...number, span('  ', style), ...fitText(title, Math.max(0, room - size(number, measure) - 4), { measure, style: { fg: state === 'read' ? 'secondary' : 'primary', bold: state !== 'read', ...style } })];
  const gap = Math.max(0, room - size(content, measure));
  const dots = selected ? [] : leader({ glyph: '·' }, { maxWidth: Math.max(0, gap - 2) }).map(s => span(s.text, { fg: P.floor, bg }));
  const body = fitLine([...content, ...(gap ? [span(' ', style)] : []), ...dots], room, style, { measure });
  const word = fill(cardState({ state, answer }, { maxWidth: Math.max(0, updatedColumn - stateColumn - 1), measure }));
  const stamp = fitText(updated, Math.max(0, width - updatedColumn - 1), { measure, style: { fg: 'decorative', ...style } });
  return fitLine([span('  ', clear), span('█', { fg: state === 'read' ? SIGNAL_COLORS.ghost : ink, ...clear }), span(selected ? '▸' : ' ', { fg: 'field', bold: selected, bg }), ...body, ...fitLine(word, Math.max(0, updatedColumn - stateColumn), style, { measure }), ...fitLine(stamp, Math.max(0, width - updatedColumn - 1), style, { measure }), span(' ', clear)], width, clear, { measure });
}
export function stackCard({ heading = '', rows = [] } = {}, { width, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width, 'stack width');
  if (!Array.isArray(rows) || rows.length > 1000) throw new TypeError('stack rows must be at most 1000 items');
  return [fitLine([span(' ▤ STACK ', { fg: P.wheat, bold: true, ...clear }), ...fitText(heading, Math.max(0,width - 9), { measure, style: { fg: 'decorative', ...clear } })], width, clear, { measure }), ...rows.map((r,i) => {
    if (!r || typeof r !== 'object' || Array.isArray(r)) throw new TypeError('stack item must be an object');
    return stackRow({ ...r,last: i === rows.length - 1 }, { width,measure });
  })];
}
