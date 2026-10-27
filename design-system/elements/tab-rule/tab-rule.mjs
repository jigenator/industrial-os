import { GLYPHS, assertCells, fitLine, fitText, lineWidth, resolveStyle, span, textSlot } from '../../foundation/cells.mjs';
import { SIGNAL_COLORS } from '../../foundation/signal-colors.mjs';
import { SURFACE_PALETTE as P } from '../../foundation/surface-palette.mjs';
import { labelPlate } from '../label-plate/label-plate.mjs';

const clear = { bg: 'default' };
const rule = { fg: P.rule, ...clear };

export function leader({ glyph = '┄' } = {}, { maxWidth = 0 } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  if (!['┄', '·'].includes(glyph)) throw new RangeError('leader glyph must be ┄ or ·');
  if (!Number.isInteger(maxWidth) || maxWidth < 0 || maxWidth > 1000) throw new RangeError('leader maxWidth must be 0–1000');
  return [span(glyph.repeat(maxWidth), rule)];
}

export function tabRule({ tabCells = 14, focused = false, inks } = {}, { width, lead = true } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width, 'tab rule width');
  if (!Number.isInteger(tabCells) || tabCells < 0 || tabCells > 1000) throw new RangeError('tabCells must be 0–1000');
  if (typeof focused !== 'boolean') throw new TypeError('focused must be boolean');
  if (typeof lead !== 'boolean') throw new TypeError('lead must be boolean');
  if (inks === undefined && lead) {
    const tab = Math.min(tabCells, width - 1);
    return fitLine([span(' ', clear), span('━'.repeat(tab) + '─'.repeat(width - 1 - tab), { fg: focused ? 'accent' : P.rule, ...clear })], width, clear);
  }
  // Separate tab and hairline inks, and an optional lead cell, for hosts such as the automations monitor.
  if (inks !== undefined && (inks === null || typeof inks !== 'object' || Array.isArray(inks))) throw new TypeError('inks must be an object');
  const { tab: tabInk = focused ? 'accent' : P.rule, rule: ruleInk = focused ? 'accent' : P.rule } = inks ?? {};
  resolveStyle({ fg: tabInk, bg: ruleInk });
  const room = width - (lead ? 1 : 0), tab = Math.min(tabCells, room);
  return fitLine([...(lead ? [span(' ', clear)] : []), ...(tab ? [span('━'.repeat(tab), { fg: tabInk, ...clear })] : []),
    ...(room - tab ? [span('─'.repeat(room - tab), { fg: ruleInk, ...clear })] : [])], width, clear);
}

// A vertical hairline `height` cells tall, one line per cell.
export function verticalRule({ ink = P.rule } = {}, { height } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(height, 'vertical rule height');
  resolveStyle({ fg: ink });
  return Array.from({ length: height }, () => [span('│', { fg: ink, ...clear })]);
}

const neatlineSpans = text => [...text].map(ch => span(ch, ch === '┄' ? { fg: SIGNAL_COLORS.ghost, ...clear } : rule));

export function neatline({ label = '' } = {}, { width, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width, 'neatline width');
  const content = fitText(label, Math.max(0, width - 6), { measure, style: { fg: 'decorative', ...clear } });
  const size = lineWidth(content, { measure });
  if (width < 6 || !size) return fitLine(neatlineSpans(width > 1 ? ' ┼' + '┄'.repeat(Math.max(0, width - 4)) + (width > 3 ? '┼ ' : '') : '┼'), width, clear);
  const left = Math.floor((width - size - 2) / 2);
  return fitLine([...neatlineSpans(' ┼' + '┄'.repeat(Math.max(0, left - 2)) + ' '), ...content, ...neatlineSpans(' ' + '┄'.repeat(Math.max(0, width - left - size - 4)) + '┼ ')], width, clear, { measure });
}

export function nameRule({ plate = 'LUNALEE', label = '', time = '', meter = [], joins = [] } = {}, { width, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width, 'name rule width');
  if (!Array.isArray(joins) || joins.some((x) => !Number.isInteger(x) || x < 0 || x >= width)) throw new RangeError('joins must be columns inside width');
  // Meter spans are structural, not an unchecked route for caller text or ANSI.
  if (measure === undefined && meter.some(s => [...s.text].some(ch => !/[\x20-\x7e]/u.test(ch) && !GLYPHS.includes(ch)))) throw new TypeError('meter spans require curated glyphs or a measurer');
  const structuralMeasure = measure ?? ((text) => [...text].length);
  const meterLine = textSlot(meter, lineWidth(meter, { measure: structuralMeasure }), { measure: structuralMeasure }).spans;
  const name = labelPlate(plate, { form: 'slab', tone: 'accent', maxWidth: width, measure });
  const nameWidth = lineWidth(name, { measure });
  const room = Math.max(0, width - nameWidth - 3);
  const trace = lineWidth(meterLine, { measure }) <= room ? meterLine : [];
  const traceWidth = lineWidth(trace, { measure });
  const working = fitText(label, Math.max(0, room - traceWidth - (traceWidth ? 2 : 0)), { measure, style: { fg: 'primary', ...clear } });
  const stamp = fitText(time, room, { measure, style: { fg: 'decorative', ...clear } });
  const tail = lineWidth(working, { measure }) || traceWidth
    ? [span(' ', clear), ...working, ...(traceWidth ? [span('  ', clear), ...trace] : [])]
    : lineWidth(stamp, { measure }) ? [span(' ', clear), ...stamp] : [];
  const body = [...name, ...tail];
  const size = lineWidth(body, { measure });
  const left = Math.max(0, Math.floor((width - size) / 2));
  const rail = (start, end) => Array.from({ length: Math.max(0, end - start) }, (_, i) => joins.includes(start + i) ? '┴' : start + i === 0 || start + i === width - 1 ? ' ' : '─').join('');
  return fitLine([span(rail(0, Math.max(0, left - 1)), rule), ...(left ? [span(' ', clear)] : []), ...body, span(' ', clear), span(rail(left + size + 1, width), rule)], width, clear, { measure });
}
