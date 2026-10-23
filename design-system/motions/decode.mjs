import { decodeGlyph } from '../foundation/decode-glyph.mjs';
import { assertLines, assertMs, assertTime, copyLines, inRegion, resolveOptions, resolveRegion, restyleCells } from './frame.mjs';
export const DECODE_DEFAULTS = Object.freeze({ duration: 450, seed: 0, scramble: true, region: undefined });
function check(options) {
  const o = resolveOptions('decode', options, DECODE_DEFAULTS);
  assertMs(o.duration, 'decode duration', { min: 1, max: 600 });
  if (!Number.isInteger(o.seed)) throw new RangeError('decode seed must be integer');
  if (typeof o.scramble !== 'boolean') throw new TypeError('decode scramble must be boolean');
  o.region = resolveRegion('decode', o.region); return o;
}
export function decodeDuration(options = {}) { return check(options).duration; }
export function decode(lines, options = {}) {
  assertLines(lines); const o = check(options); assertTime(o, 'decode');
  if (!o.animate || o.time >= o.duration) return copyLines(lines);
  return restyleCells(lines, (style, col, row, ch) => {
    if (!inRegion(o.region, col, row) || ch === ' ') return undefined;
    if (!o.scramble) return { style: { ...style, bold: true } };
    return { char: decodeGlyph(ch, col-o.region.left, o.seed+row, o.time, o.duration) };
  });
}
