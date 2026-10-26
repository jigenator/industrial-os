import { assertCells, fitLine, fitText, lineWidth, span } from '../../foundation/cells.mjs';
import { SURFACE_PALETTE as P } from '../../foundation/surface-palette.mjs';
import { labelPlate } from '../label-plate/label-plate.mjs';
import { actionLabel } from '../action-label/action-label.mjs';

function row(left, title, meta, width, measure, background, margin) {
  const clear = { bg: background };
  const available = Math.max(0, width - margin - lineWidth(left, { measure }));
  const middle = fitText(title, Math.max(0, available - 1), { measure, style: { fg: background === 'default' ? 'primary' : 'secondary', ...clear, bold: background === 'default' } });
  const used = lineWidth(left, { measure }) + 1 + lineWidth(middle, { measure });
  const metaBudget = Math.max(0, width - used - 2);
  const right = fitText(meta, metaBudget >= 8 ? metaBudget : 0, { measure, style: { fg: 'decorative', ...clear } });
  const rightWidth = lineWidth(right, { measure });
  return fitLine([...left, span(' ', clear), ...middle, ...(rightWidth ? [span(' '.repeat(Math.max(0, width - 1 - used - rightWidth)), clear), ...right, span(' ', clear)] : [])], width, clear, { measure });
}

export function popupHeader({ plate, title = '', meta = '', style = { fg: 'field', bg: P.wheat } }, { width, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width, 'popup header width');
  const label = labelPlate(plate, { form: 'slab', style, maxWidth: Math.max(0, width - 1), measure });
  return row([span(' ', { bg: 'default' }), ...label], title, meta, width, measure, 'default', 1);
}

export function popupFooter({ escape = 'back to the desk', meta = '' } = {}, { width, measure } = {}) {
  for (const value of arguments) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('input and options must be objects');
  assertCells(width, 'popup footer width');
  const key = actionLabel({ label: 'Esc', kind: 'keycap' }, { maxWidth: width, style: { fg: 'field', bg: P.plateGrey }, measure });
  return row(key, escape, meta, width, measure, 'surface', 0);
}
