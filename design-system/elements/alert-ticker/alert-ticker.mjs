import { CellGrid } from '../../foundation/cell-grid.mjs';
import { PI_CHROME } from '../../foundation/signal-colors.mjs';
// v1 intentionally supports only the contract's calm empty alerts row.
export function alertTicker(alerts, { width } = {}) {
  if (!Array.isArray(alerts) || alerts.length !== 0) throw new RangeError('v1 alerts must be empty');
  const g = new CellGrid(width, 1);
  for (const x of [0, Math.max(0, width - 4)]) for (let i = 0; i < 4; i++) g.put(x + i, 0, (x + i) % 4 < 2 ? '╱' : ' ', { fg: 'decorative' });
  g.text(5, 0, 'NO ALERTS', { fg: PI_CHROME.bone, bold: true });
  g.put(15, 0, '│', { fg: 'surface' }); g.text(17, 0, 'no alerts', { fg: 'decorative' });
  return g.lines();
}
