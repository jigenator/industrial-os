import { assertCells, fitLine, fitText, lineWidth, span } from '../../foundation/cells.mjs';
import { SURFACE_PALETTE as P } from '../../foundation/surface-palette.mjs';
import { labelPlate } from '../label-plate/label-plate.mjs';
import { lamp } from '../lamp/lamp.mjs';
import { mixOver } from '../../foundation/signal-colors.mjs';
const clear = { bg: 'default' };
export const DESK_COLUMNS = Object.freeze({ stripe: 1, content: 3, body: 5 });
const size = (l, measure) => lineWidth(l, { measure });
function line(left, right, { width, measure }, start, bg = 'default', prefix = [], rightInk = 'decorative') {
  assertCells(width, 'desk width');
  const end = Math.max(0,width - 1), rightRoom = Math.max(0,end - start);
  const tail = Array.isArray(right) ? fitLine(right, Math.min(rightRoom,size(right,measure)), { bg }, { measure }) : fitText(right, rightRoom, { measure, style: { fg: rightInk, bg } });
  const room = Math.max(0,end - start - size(tail,measure) - (size(tail,measure) ? 1 : 0));
  return fitLine([...prefix, span(' '.repeat(Math.max(0,start - size(prefix,measure))), { bg }), ...fitLine(left, room, { bg }, { measure }), ...(size(tail,measure) ? [span(' ', { bg }), ...tail] : []), span(' ', { bg: bg === 'surface' ? bg : 'default' })], width, { bg }, { measure });
}
export function deskStrip({ state = 'clear', count = '', hint = '' } = {}, options = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  if (!['clear','waiting','open'].includes(state)) throw new RangeError('unknown desk strip state');
  const waiting = state !== 'clear', bg = 'surface';
  const notch = waiting ? lamp('working', { appearance: 'round', style: { fg: 'critical', bg } }) : [span(' ', { bg })];
  const label = labelPlate('DESK', { form: 'slab', style: { fg: 'field', bg: waiting ? 'critical' : P.plateGrey } });
  const words = state === 'clear' ? 'clear' : state === 'open' ? 'open above' : count;
  const content = [...label, span(' ', { bg }), ...fitText(words, Infinity, { measure: options.measure, style: { fg: waiting && state !== 'open' ? 'primary' : 'secondary', bold: state === 'waiting', bg } })];
  return line(content, hint, options, 3, bg, [span(' ', { bg }), ...notch]);
}
export function deskHeading({ count = '', hint = '' } = {}, options = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  const label = labelPlate('DESK', { form: 'slab', style: { fg: 'field', bg: 'critical' } });
  return line([...label, span(' ', clear), ...fitText(count, Infinity, { measure: options.measure, style: { fg: 'critical', bold: true, ...clear } })], hint, options, 3);
}
export function questionTitle({ label = '', title = '', open = false, selected = false, meta = '' } = {}, options = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  if (typeof open !== 'boolean') throw new TypeError('open must be boolean');
  if (typeof selected !== 'boolean') throw new TypeError('selected must be boolean');
  const bg = open ? 'critical' : P.tint, fg = open ? 'field' : 'primary';
  const content = [...fitText(label, Infinity, { measure: options.measure, style: { fg: open ? 'field' : 'decorative', bg } }), span('  ', { bg }), ...fitText(title, Infinity, { measure: options.measure, style: { fg, bg, bold: true } })];
  return line(content, meta, options, 3, bg, [span(' ', clear), span('█', { fg: 'critical', ...clear }), span(open || selected ? '▸' : ' ', { fg: open ? 'field' : 'accent', bg })], open ? 'field' : 'decorative');
}
export function questionBody({ prompt = [], options: choices = [] } = {}, { width, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width, 'question body width');
  if (!Array.isArray(prompt) || !Array.isArray(choices) || prompt.length + choices.length > 1000) throw new TypeError('question body needs bounded prewrapped prompt/options');
  const prefix = [span(' ', clear), span('│', { fg: mixOver('critical',0.5), ...clear })];
  const row = (content,right='') => line(content,right,{width,measure},5,'default',prefix);
  return [...prompt.map(p => row(fitText(p,Infinity,{measure,style:{fg:'primary',bold:true,...clear}}))), ...choices.map(choice => {
    if (!choice || typeof choice !== 'object' || typeof (choice.selected ?? false) !== 'boolean' || typeof (choice.pick ?? false) !== 'boolean') throw new TypeError('question option must be an object with boolean selection');
    return row([span(choice.selected ? '● ' : '○ ',{fg:choice.selected?'accent':'decorative',bold:true,...clear}),...fitText(choice.label ?? '',Infinity,{measure,style:{fg:'decorative',...clear}}),span('  ',clear),...fitText(choice.body,Infinity,{measure,style:{fg:choice.selected?'primary':'secondary',bold:!!choice.selected,...clear}})],choice.pick ? [span('◆ her pick',{fg:P.orange,...clear})] : choice.hint??'');
  })];
}
export function deskFooter({ state = 'hint', text = '', detail = '' } = {}, options = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  if (!['hint','saving','error','decline','readonly'].includes(state)) throw new RangeError('unknown desk footer state');
  const prefix = [span(' ',clear),span('│',{fg:mixOver('critical',0.5),...clear})];
  const glyph = state === 'saving' ? '· ' : state === 'error' ? '✕ ' : '';
  const body = state === 'decline' ? [...labelPlate('▲ DECLINE?', { form:'slab', tone:'warning', measure: text => [...text].length }),span(' ',clear)] : [span(glyph,{fg:state==='error'?'critical':'accent',bold:state==='error',...clear})];
  body.push(...fitText(text,Infinity,{measure:options.measure,style:{fg:state==='hint'?'decorative':'secondary',...clear}}));
  return line(body,detail,options,5,'default',prefix);
}
