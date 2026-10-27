import { assertCells, fitLine, fitText, lineWidth, span } from '../../foundation/cells.mjs';
import { SURFACE_PALETTE as P } from '../../foundation/surface-palette.mjs';

export function inputFrame({state='idle',label='INPUT',scroll='',spread=false}={}, {width,bodyRows=1,measure}={}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width,'input width');
  if(!Number.isInteger(bodyRows)||bodyRows<1||bodyRows>996) throw new RangeError('input bodyRows must be 1–996');
  if(!['idle','hover','focused','form'].includes(state)) throw new RangeError('unknown input state');
  if(typeof spread!=='boolean') throw new TypeError('input spread must be boolean');
  const clear={bg:'default'},fg=state==='form'?'critical':state==='focused'?P.bone:state==='hover'?'primary':'structural';
  const rows=Array.from({length:bodyRows+4},()=>[]), ink={fg,...clear};
  // One plain label cell-for-cell in every state, so focus never moves it.
  const labelLine=fitText(label,Math.max(0,width-7),{measure,style:{fg:state==='form'?'critical':state==='idle'?'decorative':'primary',...clear,bold:true}});
  const scrollLine=fitText(scroll,Math.max(0,width-8-lineWidth(labelLine,{measure})),{measure,style:{fg:'decorative',...clear}});
  // Two outer rows are reserved for diagonal spread; body rows contain no input-owned fill.
  const d=spread?1:0,top=1-d,bottom=bodyRows+2+d;
  if(width>=8) {
    rows[top]=[span(' '.repeat(1-d),clear),span('┌╴',ink),span(' '.repeat(width-7+2*d),clear),span('╶┐',ink)];
    rows[bottom]=[span(' '.repeat(1-d),clear),span('└╴',ink),span(' '.repeat(width-7+2*d),clear),span('╶┘',ink)];
    const head=[span('   ',clear),...labelLine];
    const scrollWidth=lineWidth(scrollLine,{measure});
    const gap=Math.max(0,width-4-(scrollWidth?1:0)-lineWidth(head,{measure})-lineWidth(scrollLine,{measure}));
    if(spread) rows[1]=[...head,span(' '.repeat(gap),clear),...scrollLine];
    else rows[1]=[...rows[1].slice(0,2),...labelLine,span(' '.repeat(gap),clear),...scrollLine,...(scrollWidth?[span(' ',clear)]:[]),span('╶┐',ink)];
  } else rows[1]=labelLine;
  return rows.map(line=>fitLine(line,width,clear,{measure}));
}
