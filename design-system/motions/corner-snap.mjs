import { lineWidth, span, textSlot } from '../foundation/cells.mjs';
import { assertLines, assertTime, copyLines, resolveOptions } from './frame.mjs';
export const CORNER_SNAP_DEFAULTS=Object.freeze({measure:undefined});
export const cornerSnapSettling = () => 40;

// Home chrome in; reserved outer gutters only. Host ends the held pose on leave/blur.
export function cornerSnap(lines,options={}) {
  const o=resolveOptions('cornerSnap',options,CORNER_SNAP_DEFAULTS);
  assertLines(lines);assertTime(o,'cornerSnap');
  if(o.measure!==undefined&&typeof o.measure!=='function') throw new TypeError('corner snap measure must be a function');
  const measure=o.measure??(text=>[...text].length);
  const width=lines[0]?lineWidth(lines[0],{measure}):0;
  const checked=lines.map(line=>textSlot(line,lineWidth(line,{measure}),{measure}).spans);
  if(!o.animate||width<8||lines.length<5) return copyLines(checked);
  if(lines.some(line=>lineWidth(line,{measure})!==width)) throw new RangeError('corner snap needs an exact-width frame');
  const cells=checked.map(line=>{
    const out=[];let x=0;
    for(const s of line) for(const {segment} of new Intl.Segmenter('und',{granularity:'grapheme'}).segment(s.text)) {
      out.push({x,text:segment,style:s.style});x+=measure(segment);
    }
    return out;
  });
  const moves=[];
  for(const [y,dy,left,right] of [[1,-1,'┌╴','╶┐'],[lines.length-2,1,'└╴','╶┘']]) {
    for(const [x,dx,glyphs] of [[1,-1,left],[width-4,1,right]]) for(let i=0;i<2;i++) {
      const source=cells[y].find(c=>c.x===x+i),target=cells[y+dy].find(c=>c.x===x+i+dx);
      if(!source||source.text!==glyphs[i]||!target||target.text!==' ') return copyLines(checked);
      moves.push({source,target});
    }
  }
  for(const {source,target} of moves) {
    if(o.time<40) { if(source.style.fg==='primary') source.style={...source.style,fg:'accent'}; }
    else {target.text=source.text;target.style={...source.style};source.text=' ';source.style={bg:'default'};}
  }
  return cells.map(row=>row.map(c=>span(c.text,c.style)));
}
