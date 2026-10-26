import { lineWidth, textSlot } from '../foundation/cells.mjs';
import { SURFACE_PALETTE } from '../foundation/surface-palette.mjs';
import { mixOver } from '../foundation/signal-colors.mjs';
import { assertLines, assertTime, copyLines, inRegion, resolveOptions, resolveRegion, restyleCells } from './frame.mjs';
export const CALLOUT_ENTRANCE_DEFAULTS = Object.freeze({ mode: 'plot-in', gutter: Object.freeze({ top: 0, left: 0, rows: 1, cols: 1 }), textRegion: undefined, readoutRegion: undefined, timestampRegion: undefined, measure: undefined, color: true });
function options(value) {
  const o = resolveOptions('calloutEntrance',value,CALLOUT_ENTRANCE_DEFAULTS);
  if(!['plot-in','register'].includes(o.mode)) throw new RangeError('unknown entrance mode');
  if(typeof o.color!=='boolean') throw new TypeError('color must be boolean');
  if(o.measure!==undefined&&typeof o.measure!=='function') throw new TypeError('measure must be a function');
  const geometry = region => {
    if (region && typeof region === 'object' && !Array.isArray(region)) region = Object.fromEntries(Object.entries(region).map(([key, value]) => [key, Number.isInteger(value) ? Math.max(0, value) : value]));
    return resolveRegion('calloutEntrance',region);
  };
  o.gutter=geometry(o.gutter);
  if(!Number.isFinite(o.gutter.rows)||!Number.isFinite(o.gutter.cols)) throw new RangeError('gutter must be finite');
  if(o.textRegion!==undefined) o.textRegion=geometry(o.textRegion);
  if(o.readoutRegion!==undefined) o.readoutRegion=geometry(o.readoutRegion);
  if(o.timestampRegion!==undefined) o.timestampRegion=geometry(o.timestampRegion);
  return o;
}
export function calloutEntranceDuration(lines, value={}) { assertLines(lines);const o=options(value);return o.mode==='plot-in'?900:700; }
export function calloutEntrance(lines,value={}) {
  assertLines(lines);const o=options(value);assertTime(o,'calloutEntrance');
  if (o.measure !== undefined) lines.forEach(line => textSlot(line, lineWidth(line, { measure: o.measure }), { measure: o.measure }));
  const duration=o.mode==='plot-in'?900:700;
  if(!o.animate||o.time>=duration||!o.gutter.rows||!o.gutter.cols||(o.mode==='register'&&(o.gutter.rows<3||o.gutter.cols<3))) return copyLines(lines);
  const t=o.time, g=o.gutter;
  return restyleCells(lines,(style,col,row,ch)=>{
    if(o.mode==='plot-in') {
      if(col===g.left&&row===g.top) {
        if(ch!==' ') return undefined;
        return {char:t<80?'+':t<200?'◇':t<700?'◆':t<800?'◇':'·',style:{...style,fg:o.color?(t<700?'accent':mixOver('accent',t<800?0.5:0.25)):style.fg,bold:true}};
      }
      if(o.timestampRegion&&inRegion(o.timestampRegion,col,row)&&t<120) return {char:' '.repeat(o.measure ? o.measure(ch) : 1)};
      if(o.textRegion&&inRegion(o.textRegion,col,row)&&o.color&&t<80) return {style:{...style,fg:'decorative'}};
      if(o.readoutRegion&&inRegion(o.readoutRegion,col,row)&&t<160&&ch==='┄'&&col>=o.readoutRegion.left+Math.ceil(o.readoutRegion.cols*(Math.floor(t/40)+1)/4)) return {char:' '};
    } else {
      const homeRight = g.left + g.cols - 2;
      if (t < 80 && row === g.top + 1 && ((col === homeRight && ch === '┐') || (col === homeRight - 1 && ch === '╶'))) return { char: ' ' };
      const top=t<80?g.top:g.top+1,bottom=t<80?g.top+g.rows-1:g.top+g.rows-2;
      const left=t<80?g.left:g.left+1,right=t<80?g.left+g.cols-1:g.left+g.cols-2;
      const corner=(row===top||row===bottom)&&(col===left||col===right);
      if(corner) {
        if(![' ','┌','┐','└','┘'].includes(ch)) return undefined;
        return {char:row===top?(col===left?'┌':'┐'):(col===left?'└':'┘'),style:{...style,fg:o.color?(t<160?'primary':t<600?SURFACE_PALETTE.bone:'decorative'):style.fg}};
      }
    }
  },{measure:o.measure});
}
