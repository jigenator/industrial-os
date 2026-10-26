import { GLYPHS, assertCells, fitLine, fitText, lineWidth, span, textSlot } from '../../foundation/cells.mjs';
import { SURFACE_PALETTE as P } from '../../foundation/surface-palette.mjs';
import { actionLabel } from '../action-label/action-label.mjs';

const clear = { bg: 'default' }, rail = { fg: P.rule, ...clear };
function geometry(rect, width, height) {
  assertCells(width, 'feed width'); assertCells(height, 'feed height');
  if (!rect || typeof rect !== 'object') throw new TypeError('imageRect must be a rectangle');
  for (const key of ['x','y','width','height']) if (!Number.isInteger(rect[key]) || rect[key] < (key === 'x' || key === 'y' ? 0 : 1)) throw new RangeError('invalid image rectangle');
  if (rect.x + rect.width > width || rect.y + rect.height > height) throw new RangeError('image rectangle must fit; chrome never clips or resizes it');
  return { left: rect.x - 1, right: rect.x + rect.width, top: rect.y - 1, bottom: rect.y + rect.height };
}
function canvas(width, height, measure) {
  const rows = Array.from({length:height},()=>[]);
  const put = (x,y,line) => {
    if (x < 0 || y < 0 || y >= height || x + lineWidth(line,{measure}) > width) return;
    rows[y] = rows[y].filter(part => part.x !== x);
    rows[y].push({x,line});
  };
  const finish = () => rows.map(parts => {
    const out=[]; let end=0;
    for(const {x,line} of parts.sort((a,b)=>a.x-b.x)) {
      if(x<end) throw new RangeError('overlapping feed chrome');
      out.push(span(' '.repeat(x-end),clear),...line);end=x+lineWidth(line,{measure});
    }
    return fitLine(out,width,clear,{measure});
  });
  return {put,finish};
}
function structural(line, measure) {
  if (measure === undefined && line.some(s => [...s.text].some(ch => !/[\x20-\x7e]/u.test(ch) && !GLYPHS.includes(ch)))) throw new TypeError('structural spans require curated glyphs or a measurer');
  const m = measure ?? (text => [...text].length);
  return textSlot(line,lineWidth(line,{measure:m}),{measure:m}).spans;
}
export function feedBezel({ imageRect, callsign = '', channel = '', pose = '', meter = [], lamp = [] }, {width,height,measure} = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  const {left:l,right:r,top,bottom} = geometry(imageRect,width,height);
  const c=canvas(width,height,measure), put=(x,y,text,style=rail)=>c.put(x,y,[span(text,style)]);
  if (imageRect.width >= 3) { put(l,top,'┌─');put(r-1,top,'─┐'); }
  else { put(l,top,'┌');put(r,top,'┐'); }
  for(const y of new Set([top+1,top+2,bottom-2,bottom-1])) { put(l,y,'│');put(r,y,'│'); }
  put(l,top+Math.ceil(imageRect.height/2),'╶');put(r,top+Math.ceil(imageRect.height/2),'╴');
  const trace=structural(meter,measure), lampLine=structural(lamp,measure);
  const traceWidth=lineWidth(trace,{measure});
  const room=Math.max(0,r-l-6-traceWidth);
  const name=fitText(callsign,Infinity,{measure,style:{fg:'decorative',...clear,bold:true}});
  const chan=fitText(channel,Infinity,{measure,style:{fg:'decorative',...clear}});
  const readout=[...name,...(lineWidth(chan,{measure})?[span(' · ',clear),...chan]:[])];
  if(lineWidth(readout,{measure})<=room) c.put(l+3,top,readout);
  if(traceWidth&&traceWidth<=r-l-6) c.put(r-3-traceWidth,top,trace);
  c.put(r+2,bottom-1,lampLine);
  const poseLine=fitText(pose,Infinity,{measure,style:{fg:'decorative',...clear}});
  c.put(l-1-lineWidth(poseLine,{measure}),bottom-1,poseLine);
  return c.finish();
}
export function imageLabel({label,missing=false,unsupported=false,hover=false}, {maxWidth=Infinity,measure}={}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  for(const flag of [missing,unsupported,hover]) if(typeof flag!=='boolean') throw new TypeError('image flags must be boolean');
  if(maxWidth!==Infinity&&(!Number.isInteger(maxWidth)||maxWidth<0||maxWidth>1000)) throw new RangeError('image maxWidth must be 0–1000 or Infinity');
  const action=hover&&!missing&&!unsupported?actionLabel({}, {measure}):[];
  const suffix=missing?' (missing)':unsupported?' (unsupported)':'';
  const room=Math.max(0,maxWidth-2-lineWidth(action,{measure})-(action.length?2:0)-suffix.length);
  const text=fitText(label,room,{measure,style:{fg:hover?'primary':'secondary',...clear}});
  const line=[span('▣ ',{fg:missing||unsupported?'warning':P.wheat,...clear}),...text,span(suffix,clear),...(action.length?[span('  ',clear),...action]:[])];
  return maxWidth===Infinity?line:fitLine(line,Math.min(maxWidth,lineWidth(line,{measure})),clear,{measure});
}
export function imageInset(rect,{width,height}={}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  const {left:l,right:r,top,bottom}=geometry(rect,width,height),c=canvas(width,height);
  const put=(x,y,text)=>c.put(x,y,[span(text,rail)]);
  put(l,top,'┌');put(r,top,'┐');put(l,bottom,'└');put(r,bottom,'┘');
  for(let x=rect.x;x<r;x++) {put(x,top,(x-rect.x)%10===0?'┬':'─');put(x,bottom,(x-rect.x)%10===0?'┴':'─');}
  for(let y=rect.y;y<bottom;y++) {put(l,y,(y-rect.y)%5===0?'├':'│');put(r,y,(y-rect.y)%5===0?'┤':'│');}
  return c.finish();
}
