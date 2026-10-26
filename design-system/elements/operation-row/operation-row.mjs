import { assertCells, fitLine, fitText, lineWidth, resolveStyle, span } from '../../foundation/cells.mjs';
import { SURFACE_PALETTE as P } from '../../foundation/surface-palette.mjs';
import { labelPlate } from '../label-plate/label-plate.mjs';
import { leader } from '../tab-rule/tab-rule.mjs';
const clear = { bg: 'default' };
const STATES = Object.freeze({ running: ['▒','accent'], done: ['█','primary'], failed: ['✕','critical'], neutral: ['·','decorative'], waiting: ['▲','warning'] });
const size = (l,m) => lineWidth(l,{measure:m});
export function operationHeading({ label = 'OPERATIONS LOG', code = '', focused = false, count = '' } = {}, { width, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width,'operation heading width');
  if(typeof focused !== 'boolean') throw new TypeError('focused must be boolean');
  const head = focused ? labelPlate(label,{form:'slab',maxWidth:width,measure,style:{fg:'field',bg:P.yellow}}) : [span(' ',clear),...fitText(label,width-1,{measure,style:{fg:P.yellow,bold:true,...clear}})];
  const tail = fitText(code,width,{measure,style:{fg:'decorative',...clear}});
  const rest = [...head,...(focused?[span(' · focused',{fg:'decorative',...clear})]:[]),span(' ',clear),...fitText(count,width,{measure,style:{fg:'decorative',...clear}})];
  const room = Math.max(0,width-size(tail,measure)-1);
  return fitLine([...fitLine(rest,room,clear,{measure}),span(' ',clear),...tail],width,clear,{measure});
}
export function operationRow({ state = 'neutral', time = '', category = '', detail = '', duration = '', selected = false, hover = false } = {}, { width, columns = {}, styles = {}, measure, color = true } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width,'operation row width');
  if(!Object.hasOwn(STATES,state)) throw new RangeError('unknown operation state');
  if([selected,hover,color].some(v=>typeof v!=='boolean')) throw new TypeError('operation flags must be boolean');
  if(!columns || typeof columns!=='object' || Array.isArray(columns) || !styles || typeof styles!=='object' || Array.isArray(styles)) throw new TypeError('columns/styles must be objects');
  const cols = {time:5,category:4,duration:width>=40?15:5,...columns};
  for(const [key,n] of Object.entries(cols)) if(!['time','category','duration'].includes(key) || !Number.isInteger(n) || n<0 || n>1000) throw new RangeError('invalid operation column');
  for(const [key,style] of Object.entries(styles)) {if(!['time','category','detail','duration'].includes(key)) throw new RangeError('unknown operation style');resolveStyle(style);}
  const bg=selected?P.selection:hover?P.hover:'default', base={bg};
  const cell=(value,n,key,fg)=>fitLine(fitText(value,n,{measure,style:{fg,...base,...styles[key]}}),n,base,{measure});
  // Reserve the right duration before optional fixed columns and long detail.
  const dw=Math.min(cols.duration,Math.max(0,width-2));
  const stamp=fitText(duration,dw,{measure,style:{fg:state==='running'?'accent':'decorative',...base,...styles.duration}});
  const prefix=[span(color?'█':STATES[state][0],{fg:STATES[state][1],bg}),span(selected?'▸':' ',{fg:'accent',bg,bold:selected})];
  const available=Math.max(0,width-2-dw-1), tw=Math.min(cols.time,available), cw=Math.min(cols.category,Math.max(0,available-tw-2));
  prefix.push(...cell(time,tw,'time','decorative'),span(' ',base),...cell(category,cw,'category','primary'),span(' ',base));
  const room=Math.max(0,width-dw-1-size(prefix,measure));
  const content=fitText(detail,room,{measure,style:{fg:state==='failed'?'critical':'secondary',...base,...styles.detail}});
  const gap = room > size(content,measure) ? [span(' ',base)] : [];
  const rail=leader({glyph:'·'},{maxWidth:Math.max(0,width-size(prefix,measure)-size(content,measure)-gap.length-size(stamp,measure)-1)}).map(s=>span(s.text,{...s.style,fg:P.floor,bg}));
  return fitLine([...fitLine([...prefix,...content,...gap,...rail],Math.max(Math.min(width,2),width-size(stamp,measure)-1),base,{measure}),span(' ',base),...stamp],width,base,{measure});
}
export function operationDetail({ label = '', value = '' } = {}, { width, labelWidth = 14, measure, style = {} } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width,'operation detail width'); resolveStyle(style);
  if(!Number.isInteger(labelWidth)||labelWidth<0||labelWidth>1000) throw new RangeError('labelWidth must be 0–1000');
  const left=Math.min(labelWidth,Math.max(0,width-2));
  const title=fitText(label,Math.max(0,left-1),{measure,style:{fg:'decorative',...clear}});
  return fitLine([...title,span(left > size(title,measure) ? ' ' : '',clear),...leader({glyph:'·'},{maxWidth:Math.max(0,left-size(title,measure)-1)}),span(' ',clear),...fitText(value,Math.max(0,width-left-1),{measure,style:{fg:'secondary',...clear,...style}})],width,clear,{measure});
}
