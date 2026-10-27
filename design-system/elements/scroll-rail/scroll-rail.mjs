// A one-column scroll rail: a faint track with a heavy primary thumb sized to the visible share, never shorter than
// two cells. One line per visible row; nothing when everything fits. Contract: README.md.
import { span } from '../../foundation/cells.mjs';
import { BOARD_INKS } from '../../foundation/signal-colors.mjs';

const count = (value, name, min) => {
  if (!Number.isInteger(value) || value < min || value > 1_000_000) throw new RangeError(`scroll ${name} must be an integer from ${min}`);
  return value;
};

export function scrollRail({ total, visible, offset } = {}) {
  count(total, 'total', 0);
  count(visible, 'visible', 1);
  count(offset, 'offset', 0);
  if (offset > Math.max(0, total - visible)) throw new RangeError('scroll offset must leave the last row in view');
  if (total <= visible) return [];
  const thumb = Math.max(2, Math.round((visible * visible) / total));
  const top = Math.round((offset / (total - visible)) * (visible - thumb));
  return Array.from({ length: visible }, (_, y) => (y >= top && y < top + thumb ? [span('┃', { fg: 'primary' })] : [span('│', { fg: BOARD_INKS.faint })]));
}
