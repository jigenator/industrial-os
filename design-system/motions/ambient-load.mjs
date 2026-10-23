import { AMBIENT_GRID as A, ambientPosition, ambientInk, ambientSweepLift, ambientRegistrations } from '../foundation/ambient.mjs';
import { decodeGlyph } from '../foundation/decode-glyph.mjs';
import { hash } from '../foundation/seeded.mjs';
import { assertLines, assertTime, blockWidth, copyLines, inRegion, resolveOptions, resolveRegion, restyleCells } from './frame.mjs';

export const AMBIENT_LOAD_DEFAULTS = Object.freeze({ region: undefined });
const progress = (time,start,duration) => Math.max(0,Math.min(1,(time-start)/duration));
function options(input) { const o=resolveOptions('ambient-load',input,AMBIENT_LOAD_DEFAULTS);o.region=resolveRegion('ambient-load',o.region);return o; }
export function ambientLoadDuration(lines, input={}) {
  assertLines(lines);options(input);if(!lines.length)return 0;
  const width=blockWidth(lines),height=lines.length;
  if(!width)return 0;
  const marks=ambientRegistrations(lines);
  return Math.max(A.sweepRun,A.dotStart+A.dotSpread+A.dotRun,
    Math.max(0,Math.floor((width-1-A.offsetX)/A.pitchX))*A.columnLag+A.gridRun,
    Math.max(0,Math.floor((height-1-A.offsetY)/A.pitchY))*A.rowLag+A.gridRun,
    ...marks.map(mark=>mark.start+A.labelLag+A.labelRun));
}
// Exact v20 load clocks over an already-admitted decoration layer. Never admit new cells here.
export function ambientLoad(lines,input={}) {
  assertLines(lines);const o=options(input);assertTime(o,'ambient-load');
  if(!o.animate||o.time>=ambientLoadDuration(lines,input))return copyLines(lines);
  const width=blockWidth(lines),height=lines.length,marks=ambientRegistrations(lines),positions=new Map();
  for(const mark of marks) {
    positions.set(`${mark.x}:${mark.y}`,{mark,kind:'center'});
    for(const dx of [-2,-1,1,2])positions.set(`${mark.x+dx}:${mark.y}`,{mark,kind:'arm',distance:Math.abs(dx)});
    for(const dy of [-1,1])positions.set(`${mark.x}:${mark.y+dy}`,{mark,kind:'arm',distance:1});
    Array.from(mark.label).forEach((char,i)=>positions.set(`${mark.x+2+i}:${mark.y+1}`,{mark,kind:'label',char,index:i}));
  }
  const baseAt=(x,y,bg)=>{
    const p=ambientPosition(x,y);
    const vertical=p.gx&&progress(o.time,A.columnLag*p.column,A.gridRun)*height>y;
    const horizontal=p.gy&&progress(o.time,A.rowLag*p.row,A.gridRun)*width>x;
    const lift=ambientSweepLift(y,height,o.time);
    if(vertical||horizontal)return {char:vertical&&horizontal?'┼':vertical?'│':'─',fg:ambientInk(bg,A.gridLift+lift)};
    if(p.dot){const k=progress(o.time,A.dotStart+hash(x,y,5)*A.dotSpread,A.dotRun);return {char:k>0?'·':' ',fg:ambientInk(bg,(A.dotLift+lift)*k)};}
    return {char:' ',fg:ambientInk(bg,0)};
  };
  return restyleCells(lines,(style,col,row,char)=>{
    if(!inRegion(o.region,col,row))return undefined;
    const position=positions.get(`${col}:${row}`),bg=style.bg??'field';
    if(!position&&!['┼','│','─','·'].includes(char))return undefined;
    if(position){
      const {mark,kind}=position,elapsed=o.time-mark.start;
      if(elapsed>=0){
        if(kind==='label')return {char:decodeGlyph(position.char,position.index,mark.seed,elapsed-A.labelLag,A.labelRun,o.time),style:{...style,fg:ambientInk(bg,A.markLift)}};
        if(kind==='center'||Math.min(2,Math.floor(elapsed/A.armStep))>=position.distance)return {char,style:{...style,fg:ambientInk(bg,A.markLift)}};
      }
    }
    const frame=baseAt(col,row,bg);return {char:frame.char,style:{...style,fg:frame.fg}};
  });
}
