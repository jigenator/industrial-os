import { hash } from '../foundation/seeded.mjs';
import { assertLines, assertTime, copyLines, inRegion, resolveOptions, resolveRegion, restyleCells } from './frame.mjs';

export const SCOPE_TRACE_DEFAULTS = Object.freeze({ mode: 'carrier', index: 0, previousKey: undefined, region: undefined, stateCells: false });

export function blipPass(index, previousKey) {
  if (!Number.isSafeInteger(index) || index < 0) throw new RangeError('blip index must be a nonnegative safe integer');
  if (previousKey !== undefined && typeof previousKey !== 'string') throw new TypeError('previousKey must be a string');
  // Fixed draw order; a distinct fallback guarantees no adjacent pattern even after collisions.
  let candidate;
  for (let salt = 0; salt < 32; salt++) {
    const h = Math.floor(hash(index, 911, salt) * 2 ** 32);
    const kind = ['walk', 'hop', 'flicker'][h % 3], dir = (h >>> 3) & 1 ? 1 : -1;
    const length = kind === 'walk' ? 3 + ((h >>> 5) & 1) : kind === 'hop' ? 2 : 1;
    const start = dir > 0 ? (h >>> 7) % (5 - length) : 3 - (h >>> 7) % (5 - length);
    const key = `${kind}:${start}:${dir}:${length}`;
    const cells = kind === 'flicker' ? [start, -1, start] : Array.from({ length }, (_, i) => start + dir * i);
    candidate = { index, kind, dir, start, cells: Object.freeze(cells), key, jitter: 0.6 + 0.8 * hash(index, 1777, 0) };
    if (key !== previousKey) return Object.freeze(candidate);
  }
  const start = candidate.start === 0 ? 3 : 0;
  return Object.freeze({ ...candidate, kind: 'flicker', start, dir: 1, cells: Object.freeze([start, -1, start]), key: `flicker:${start}:1:1` });
}

function check(options) {
  const o = resolveOptions('scopeTrace', options, SCOPE_TRACE_DEFAULTS);
  if (!['carrier', 'noise', 'reacquire'].includes(o.mode)) throw new RangeError('unknown scope trace mode');
  if (typeof o.stateCells !== 'boolean') throw new TypeError('scope stateCells must be boolean');
  o.region = resolveRegion('scopeTrace', o.region);
  o.pass = blipPass(o.index, o.previousKey);
  return o;
}
export function scopeTraceDuration(options = {}) {
  const o = check(options);
  return o.mode === 'noise' ? null : o.mode === 'reacquire' ? 520 : o.pass.cells.length * 80;
}

export function scopeTrace(lines, options = {}) {
  const o = check(options); assertLines(lines); assertTime(o, 'scopeTrace');
  if (!o.animate || o.mode === 'reacquire' && o.time >= 520 || o.mode === 'carrier' && o.time >= o.pass.cells.length * 80) return copyLines(lines);
  const step = Math.floor(o.time / 80);
  return restyleCells(lines, (style, col, row, ch) => {
    const x = col - o.region.left;
    if (!inRegion(o.region, col, row) || x >= 4 || !/[─┸┴\u2800-\u28ff]/u.test(ch)) return undefined;
    if (o.mode === 'carrier') {
      const head = o.pass.cells[step], trail = step ? o.pass.cells[step - 1] : -1;
      return { char: x === head ? '┸' : x === trail ? '┴' : '─', style: { ...style, fg: x === head ? 'primary' : 'accent', bold: x === head } };
    }
    if (o.mode === 'reacquire' && o.time >= 480) return { char: '─', style: { ...style, fg: 'primary' } };
    const amplitude = o.mode === 'noise' ? 2 : Math.ceil(2 * (480 - Math.floor(o.time / 40) * 40) / 480);
    const bits = [[0, 3], [1, 4], [2, 5], [6, 7]];
    let dots = 0;
    for (let dx = 0; dx < 2; dx++) {
      const n = Math.floor(hash(x * 2 + dx, step + 7, 0) * (2 * amplitude + 1)) - amplitude;
      dots |= 1 << bits[Math.max(0, Math.min(3, 1 + n))][dx];
    }
    return { char: String.fromCodePoint(0x2800 + dots), style: { ...style, fg: 'warning' } };
  }, { stateCells: o.stateCells });
}
