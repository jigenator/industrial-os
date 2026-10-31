// A plate's decorative barcode: guard bars `▌` and `▐` around n − 2 bars, each picked by the caller's seeded index
// source, so a plate keeps the generator its approved mockup used. Pure; no clock or Math.random.
import { assertCells } from './cells.mjs';

// Bar glyphs by index; spaces make gaps and the thin bars recur so the code reads as a code, not a fill.
export const BARCODE_BARS = Object.freeze(['▏', '▎', '▍', '▌', '▐', '█', ' ', '▏', '▍', ' ']);

// `pick(count)` returns the next index, an integer in [0, count). One cell is a guard bar; two are both guards.
export function barcode(n, pick) {
  assertCells(n, 'barcode width');
  if (typeof pick !== 'function') throw new TypeError('barcode pick must be a function');
  if (n === 1) return '▌';
  const bars = Array.from({ length: n - 2 }, () => {
    const i = pick(BARCODE_BARS.length);
    if (!Number.isInteger(i) || i < 0 || i >= BARCODE_BARS.length) throw new RangeError('barcode pick must return an index in [0, count)');
    return BARCODE_BARS[i];
  });
  return `▌${bars.join('')}▐`;
}
