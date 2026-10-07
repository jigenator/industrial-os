import { safeText, fit, span } from '../../foundation/cells.mjs';

export const PLATE_TONES = Object.freeze({
  accent: { fg: 'field', bg: 'accent' },
  neutral: { fg: 'primary', bg: 'structural' },
  warning: { fg: 'field', bg: 'warning' },
  critical: { fg: 'field', bg: 'critical' },
});

// Informational plate `▐ TEXT ▌`. The half-block caps take the plate colour, so the slab reads padded in
// color and stays visibly bounded in plain text. Deliberately not a button: no brackets, focus, or key hint.
// Returns spans no wider than maxWidth: text is truncated first, padding dropped only below 5 cells.
export function labelPlate(text, { tone = 'neutral', pad = true, maxWidth = Infinity } = {}) {
  if (!Object.hasOwn(PLATE_TONES, tone)) throw new RangeError(`unknown plate tone: ${tone}`);
  const t = PLATE_TONES[tone];
  if (maxWidth !== Infinity && (!Number.isInteger(maxWidth) || maxWidth < 0)) {
    throw new RangeError(`maxWidth must be a non-negative integer, got ${maxWidth}`);
  }
  let label = safeText(text);
  const padding = pad && maxWidth >= 5 ? ' ' : '';
  if (maxWidth < 3) return [span(fit(label, maxWidth), { fg: t.bg, bold: true })];
  label = fit(label, maxWidth - 2 - padding.length * 2);
  const cap = { fg: t.bg, bg: 'field' };
  return [span('▐', cap), span(padding + label + padding, { ...t, bold: true }), span('▌', cap)];
}
