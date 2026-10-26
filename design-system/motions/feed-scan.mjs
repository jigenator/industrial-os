import { SIGNAL_COLORS } from '../foundation/signal-colors.mjs';
import { assertLines, assertTime, copyLines, resolveOptions, restyleCells } from './frame.mjs';
export const FEED_SCAN_DEFAULTS=Object.freeze({top:0,rows:16,rails:Object.freeze([]),measure:undefined});
function check(options) {
  const o=resolveOptions('feedScan',options,FEED_SCAN_DEFAULTS);
  if(!Number.isInteger(o.top)||o.top<0||!Number.isInteger(o.rows)||o.rows<1||o.rows>1000) throw new RangeError('invalid feed scan rows');
  if(!Array.isArray(o.rails)||o.rails.some(x=>!Number.isInteger(x)||x<0||x>999)) throw new RangeError('feed scan rails must be cell columns');
  if(o.measure!==undefined&&typeof o.measure!=='function') throw new TypeError('feed scan measure must be a function');
  return o;
}
export function feedScanDuration(options={}) { return (check(options).rows+2)*40; }
export function feedScan(lines,options={}) {
  const o=check(options);assertLines(lines);assertTime(o,'feedScan');
  if(!o.animate||o.time>=(o.rows+2)*40) return copyLines(lines);
  const head=Math.floor(o.time/40);
  return restyleCells(lines,(style,col,row,ch)=>{
    const offset=head-(row-o.top);
    if(!o.rails.includes(col)||row<o.top||row>=o.top+o.rows||offset<0||offset>2||![' ','│','╶','╴','┃'].includes(ch)) return undefined;
    return {char:'┃',style:{...style,fg:['accent',SIGNAL_COLORS.accent50,SIGNAL_COLORS.accent25][offset]}};
  },{measure:o.measure});
}
