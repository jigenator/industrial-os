import { CellGrid } from '../../foundation/cell-grid.mjs';
const BIT = [[1, 8], [2, 16], [4, 32], [64, 128]];
// Samples are observed counts in successive host-owned time slices, oldest first.
export function activityTrace(samples, { width, connected = true } = {}) {
  if (!Array.isArray(samples) || samples.length > 1000 || samples.some(n => !Number.isSafeInteger(n) || n < 0)) throw new RangeError('trace samples must be bounded nonnegative integers');
  if (typeof connected !== 'boolean') throw new TypeError('connected must be boolean');
  const g = new CellGrid(width, 1), cells = Math.max(0, width - 14), values = samples.slice(-cells * 2);
  g.text(0, 0, 'LIVE', { fg: 'decorative' });
  for (let k = 0; k < cells; k++) {
    let bits = 0;
    for (let side = 0; side < 2; side++) { const i = k * 2 + side - (cells * 2 - values.length), n = values[i] ?? 0; bits |= BIT[3 - Math.min(3, n)][side]; }
    g.put(6 + k, 0, String.fromCodePoint(0x2800 + bits), { fg: 'secondary' });
  }
  g.text(Math.max(5, width - 7), 0, !connected ? 'OFFLINE' : (samples.at(-1) ?? 0) > 0 ? 'CHANGED' : 'IDLE', { fg: 'decorative' });
  return g.lines();
}
