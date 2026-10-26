import { span } from '../../foundation/cells.mjs';
import { SIGNAL_COLORS } from '../../foundation/signal-colors.mjs';

export function soundingMeter(_input = {}, { maxWidth = 6 } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  if (!_input || typeof _input !== 'object' || Array.isArray(_input)) throw new TypeError('sounding input must be an object');
  if (maxWidth !== Infinity && (!Number.isInteger(maxWidth) || maxWidth < 0 || maxWidth > 1000)) throw new RangeError('sounding maxWidth must be 0–1000 or Infinity');
  return Array.from({ length: Math.min(6, maxWidth) }, (_, i) => span(String.fromCodePoint(0x2800 + (i === 0 ? 0x67 : 0x24)), { fg: i === 0 ? 'accent' : SIGNAL_COLORS.ghost, bg: 'default' }));
}
