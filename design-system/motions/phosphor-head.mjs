import { lineWidth, textSlot } from '../foundation/cells.mjs';
import { assertLines, assertTime, copyLines, resolveOptions, restyleCells } from './frame.mjs';
export const PHOSPHOR_HEAD_DEFAULTS = Object.freeze({ head: undefined, measure: undefined, color: true });
export function phosphorHead(lines,value={}) {
  assertLines(lines);const o=resolveOptions('phosphorHead',value,PHOSPHOR_HEAD_DEFAULTS);assertTime(o,'phosphorHead');
  if(typeof o.color!=='boolean') throw new TypeError('color must be boolean');
  if(o.measure!==undefined&&typeof o.measure!=='function') throw new TypeError('measure must be a function');
  if(o.head!==undefined&&(!o.head||typeof o.head!=='object'||!Number.isInteger(o.head.row)||o.head.row<0||!Number.isInteger(o.head.col)||o.head.col<0)) throw new RangeError('head must be a nonnegative cell location');
  if (o.measure !== undefined) lines.forEach(line => textSlot(line, lineWidth(line, { measure: o.measure }), { measure: o.measure }));
  if(!o.animate||!o.color||o.head===undefined) return copyLines(lines);
  // The host supplies the already-revealed grapheme head; no text or pacing is owned here.
  return restyleCells(lines,(style,col,row)=>row===o.head.row&&col===o.head.col?{style:{...style,fg:'accent'}}:undefined,{measure:o.measure});
}
