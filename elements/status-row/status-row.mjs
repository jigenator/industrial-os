import { assertCells, fit, fitLine, safeText, span } from '../../foundation/cells.mjs';

// Each state carries a shape and a word, so meaning survives without color.
export const STATUS_STATES = Object.freeze({
  neutral: { marker: '○', word: 'INFO', fg: 'secondary' },
  success: { marker: '●', word: 'OK', fg: 'accent' },
  warning: { marker: '▲', word: 'WARN', fg: 'warning' },
  error: { marker: '✕', word: 'ERROR', fg: 'critical' },
  unavailable: { marker: '?', word: 'N/A', fg: 'secondary' },
});
export const STATUS_WIDTH = 7; // '✕ ERROR'
const MIN_VALUE = 6;

function state(status) {
  if (!Object.hasOwn(STATUS_STATES, status)) throw new RangeError(`unknown status: ${status}`);
  const s = STATUS_STATES[status];
  return span(`${s.marker} ${s.word}`.padEnd(STATUS_WIDTH), { fg: s.fg, bold: true });
}

// Label | value | state on one line; label+state above an indented value when the value would get under
// 6 cells. A null value renders '--' (no value supplied); the row never invents one.
export function statusRow({ label, value, status }, { width, labelWidth = 10 } = {}) {
  assertCells(width, 'status row width');
  const mark = state(status);
  const name = safeText(label ?? '');
  const shown = value === null || value === undefined ? span('--', { fg: 'secondary' }) : span(safeText(value), { fg: 'primary' });
  const valueWidth = width - labelWidth - STATUS_WIDTH - 2;
  if (valueWidth >= MIN_VALUE) {
    const v = span(fit(shown.text, valueWidth).padEnd(valueWidth), shown.style);
    return [fitLine([span(fit(name, labelWidth).padEnd(labelWidth + 1), { fg: 'secondary' }), v, span(' '), mark], width)];
  }
  const head = [span(fit(name, Math.max(0, width - STATUS_WIDTH - 1)).padEnd(Math.max(0, width - STATUS_WIDTH)), { fg: 'secondary' }), mark];
  return [fitLine(head, width), fitLine([span('  '), span(fit(shown.text, width - 2), shown.style)], width)];
}
