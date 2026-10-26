import { span } from '../../foundation/cells.mjs';

export function scopeMeter({ state = 'connected' } = {}, { maxWidth = 4 } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  if (!['connected', 'reconnecting', 'lost'].includes(state)) throw new RangeError('unknown scope state');
  if (maxWidth !== Infinity && (!Number.isInteger(maxWidth) || maxWidth < 0 || maxWidth > 1000)) throw new RangeError('scope maxWidth must be 0–1000 or Infinity');
  const text = { connected: '────', reconnecting: '⠊⠑⠊⠒', lost: '✕⣀⣀⣀' }[state];
  return [span(text.slice(0, maxWidth), { fg: { connected: 'accent', reconnecting: 'warning', lost: 'critical' }[state], bg: 'default' })];
}
