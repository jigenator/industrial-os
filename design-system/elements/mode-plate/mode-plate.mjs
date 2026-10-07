import { GLYPHS, fitLine, lineWidth, resolveColor, safeText, span } from '../../foundation/cells.mjs';
import { SIGNAL_COLORS } from '../../foundation/signal-colors.mjs';

// footer.ts:143-147: explicit modes, never an inferred default.
export const PNYTL_MODES = Object.freeze(Object.fromEntries(Object.entries({
  lite: { code: 'LTE', ink: SIGNAL_COLORS.cobalt }, full: { code: 'FUL', ink: SIGNAL_COLORS.violet },
  ultra: { code: 'ULT', ink: SIGNAL_COLORS.magenta }, review: { code: 'REV', ink: SIGNAL_COLORS.teal },
  off: { code: 'OFF', ink: 'structural' }, checking: { code: 'CHK', ink: 'structural' }, unknown: { code: 'UNK', ink: 'structural' },
}).map(([key, value]) => [key, Object.freeze(value)])));

// footer.ts:1153-1159: 16-cell white PNYTL body with one field gap at either end.
export function modePlate({ icon = '⌑', title, code, ink, active = false }, { maxWidth = Infinity } = {}) {
  if (typeof icon !== 'string' || [...icon].length !== 1 || !(GLYPHS.includes(icon) || /^[\x20-\x7e]$/.test(icon))) throw new TypeError('icon must be one curated glyph or printable ASCII cell');
  if (typeof active !== 'boolean') throw new TypeError('active must be boolean');
  if (maxWidth !== Infinity && (!Number.isInteger(maxWidth) || maxWidth < 0 || maxWidth > 1000)) throw new RangeError('maxWidth must be 0–1000 or Infinity');
  resolveColor(ink);
  const black = { fg: 'field', bg: 'primary', bold: true };
  const line = [span(' '), span(' ', black), span(active ? '•' : icon, { ...black, fg: active ? SIGNAL_COLORS.pink : 'field' }),
    span(' ' + safeText(title) + ' // ', black), span(safeText(code), { fg: ink, bg: 'primary', bold: true }), span(' ', black), span(' ')];
  return fitLine(line, Math.min(maxWidth, lineWidth(line)));
}
export function pnytlPlate(state, { active = false, maxWidth = Infinity } = {}) {
  if (!Object.hasOwn(PNYTL_MODES, state)) throw new RangeError('unknown PNYTL state');
  if (typeof active !== 'boolean') throw new TypeError('active must be boolean');
  return modePlate({ title: 'PNYTL', ...PNYTL_MODES[state], active: active && !['off', 'checking', 'unknown'].includes(state) }, { maxWidth });
}
