import { safeText, fit, span, resolveStyle, fitText } from '../../foundation/cells.mjs';

export const PLATE_TONES = Object.freeze({
  accent: { fg: 'field', bg: 'accent' },
  neutral: { fg: 'primary', bg: 'structural' },
  warning: { fg: 'field', bg: 'warning' },
  critical: { fg: 'field', bg: 'critical' },
  bright: { fg: 'field', bg: 'primary' },
});
export const PLATE_FORMS = Object.freeze(['capped', 'slab']);

// Informational plate. `capped` is `▐ TEXT ▌`: the half-block caps take the plate colour, so the slab reads padded
// in color and stays visibly bounded in plain text. `slab` is status-bar's padded plate ` TEXT `, every cell filled.
// Deliberately not a button: no brackets, focus, or key hint. Returns spans no wider than maxWidth: text is
// truncated first; capped padding is dropped only below 5 cells, slab padding only below 3.
export function labelPlate(text, { tone = 'neutral', pad = true, maxWidth = Infinity, form = 'capped', style, measure } = {}) {
  if (!Object.hasOwn(PLATE_TONES, tone)) throw new RangeError(`unknown plate tone: ${tone}`);
  if (!PLATE_FORMS.includes(form)) throw new RangeError(`unknown plate form: ${form}`);
  if (style !== undefined) resolveStyle(style);
  const t = style === undefined ? PLATE_TONES[tone] : style;
  if (maxWidth !== Infinity && (!Number.isInteger(maxWidth) || maxWidth < 0)) {
    throw new RangeError(`maxWidth must be a non-negative integer, got ${maxWidth}`);
  }
  if (measure !== undefined || typeof text === 'object' && text !== null) {
    const padding = pad && maxWidth >= (form === 'slab' ? 3 : 5) ? ' ' : '';
    const capped = form === 'capped' && maxWidth >= 3;
    const textStyle = form === 'capped' && !capped ? { fg: t.bg, bg: 'default', bold: true } : { bg: 'default', ...t, bold: true };
    const content = fitText(text, maxWidth - (capped ? 2 : 0) - padding.length * 2, { measure, style: textStyle })
      .map((s) => span(s.text, { ...textStyle, ...s.style, bold: true }));
    const body = [...(padding ? [span(padding, textStyle)] : []), ...content, ...(padding ? [span(padding, textStyle)] : [])];
    const cap = { fg: t.bg, bg: 'default' };
    return capped ? [span('▐', cap), ...body, span('▌', cap)] : body;
  }
  let label = safeText(text);
  if (form === 'slab') {
    const padding = pad && maxWidth >= 3 ? ' ' : '';
    return [span(padding + fit(label, maxWidth - padding.length * 2) + padding, { ...t, bold: true })];
  }
  const padding = pad && maxWidth >= 5 ? ' ' : '';
  if (maxWidth < 3) return [span(fit(label, maxWidth), { fg: t.bg, bold: true })];
  label = fit(label, maxWidth - 2 - padding.length * 2);
  const cap = { fg: t.bg, bg: 'field' };
  return [span('▐', cap), span(padding + label + padding, { ...t, bold: true }), span('▌', cap)];
}
