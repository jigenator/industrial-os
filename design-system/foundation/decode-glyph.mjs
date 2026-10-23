import { hash } from './seeded.mjs';
import { GLYPHS } from './cells.mjs';
const SCRAMBLE = '▓▒░#%&*+=<>/\\|ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
// Low-level bounded glyph projection shared by semantic decode and decorative mark decode.
// The wrapping motion owns state-cell protection. Negative time is the blank prelude.
export function decodeGlyph(char, column, seed, time, duration, clock = time) {
  if(typeof char!=='string'||Array.from(char).length!==1||!(/^[\x20-\x7e]$/.test(char)||GLYPHS.includes(char)))throw new TypeError('decode needs one glyph');
  if(!Number.isInteger(column)||column<0||!Number.isInteger(seed)||!Number.isFinite(time)||!Number.isFinite(clock)||!Number.isFinite(duration)||duration<=0||duration>600)throw new RangeError('invalid decode frame');
  if(time>=duration||char===' ')return char;
  if(time<0)return ' ';
  const r=hash(column,seed,17);
  if(time>=r*duration)return char;
  return time>=r*duration*0.35?SCRAMBLE[Math.floor(hash(Math.floor(clock/70),column,seed+1)*SCRAMBLE.length)]:' ';
}
