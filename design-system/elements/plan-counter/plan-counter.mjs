import { CellGrid } from '../../foundation/cell-grid.mjs';
import { PI_CHROME } from '../../foundation/signal-colors.mjs';
export function planCounter(counts, { width } = {}) {
  const g = new CellGrid(width, 2), step = Math.max(1, Math.floor(width / 3));
  ['today', 'inbox', 'later'].forEach((key, i) => {
    const n = counts[key];
    if (n !== null && (!Number.isSafeInteger(n) || n < 0)) throw new RangeError('plan count must be nonnegative or null');
    g.text(i * step, 0, key.toUpperCase(), { fg: 'decorative' }, step);
    const text = n === null ? '?' : String(n);
    g.text(i * step, 1, text.length > step ? '#'.repeat(step) : text, { fg: PI_CHROME.bone, bold: true }, step);
  }); return g.lines();
}
