// Frozen pre-extension card renderers from 82d8534310c2a0d76493ed7a2841d14672b04c20.
// Test oracle only: extracted before itemRow; import paths adjusted, unused leader import removed.
import { assertCells, fitLine, fitText, lineWidth, span } from '../../../foundation/cells.mjs';
import { SURFACE_PALETTE as P } from '../../../foundation/surface-palette.mjs';
import { SIGNAL_COLORS } from '../../../foundation/signal-colors.mjs';
import { stateChip } from '../../state-chip/state-chip.mjs';
import { actionLabel } from '../../action-label/action-label.mjs';
const clear = { bg: 'default' };
export const SHEET_STATES = Object.freeze(Object.fromEntries(Object.entries({
  unread: { code: 'unread', shape: '◆', tone: P.wheat }, read: { code: 'read', shape: '', tone: 'decorative' },
  waiting: { code: 'waiting on you', shape: '●', tone: 'critical' }, answered: { code: 'answered', shape: '', tone: 'accent' },
  withdrawn: { code: 'withdrawn', shape: '↷', tone: 'decorative' },
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
  const ink = ['read', 'answered', 'declined', 'withdrawn'].includes(state) ? 'decorative' : tone(state), right = cardState({ state, answer }, { maxWidth: Math.max(0, width - 2), measure });
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
