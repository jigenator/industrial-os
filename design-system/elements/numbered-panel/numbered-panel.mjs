import { assertCells, fit, fitLine, lineWidth, safeText, span } from '../../foundation/cells.mjs';
import { labelPlate } from '../label-plate/label-plate.mjs';

const RAIL = { fg: 'structural' };
const CORNER = { fg: 'decorative' };
const COMPACT_BELOW = 40;

export function panelInnerWidth(width) {
  assertCells(width, 'panel width');
  return width < COMPACT_BELOW ? width : width - 4;
}

// Header: number plate, title, rule, and optional meta. Meta is dropped before the title is truncated.
function header(number, title, meta, width) {
  const plate = labelPlate(String(number).padStart(2, '0'), { tone: 'accent', pad: false, maxWidth: width });
  const room = width - lineWidth(plate) - 1;
  const name = fit(title, Math.max(0, room - 2));
  const line = [...plate, span(' '), span(name, { fg: 'primary', bold: true }), span(' ')];
  const rest = width - lineWidth(line);
  const tail = meta && rest >= meta.length + 4 ? [span(' ' + meta + ' ', { fg: 'secondary' }), span('─', RAIL)] : [];
  line.push(span('─'.repeat(Math.max(0, rest - lineWidth(tail))), RAIL), ...tail);
  return fitLine(line, width);
}

// Numbered panel around pre-rendered body lines. Body lines are fitted to panelInnerWidth(width);
// height (if given) pads or clips the body so neighbouring panels align.
// Full form (>= 40 cells) has rails and corners; compact form keeps only the numbered header rule.
export function numberedPanel({ number, title, meta = '' }, body, { width, height } = {}) {
  assertCells(width, 'panel width');
  if (!Number.isInteger(number) || number < 0 || number > 99) throw new RangeError(`panel number must be 0-99, got ${number}`);
  const name = safeText(title);
  const note = safeText(meta);
  const compact = width < COMPACT_BELOW;
  const inner = panelInnerWidth(width);
  const chrome = compact ? 1 : 2;
  const rows = height === undefined ? body.length : height - chrome;
  if (!Number.isInteger(rows) || rows < 0) throw new RangeError(`panel height must fit its ${chrome} chrome line(s), got ${height}`);
  const content = Array.from({ length: rows }, (_, i) => fitLine(body[i] ?? [], inner));
  if (compact) return [header(number, name, note, width), ...content];
  const top = [span('┌', CORNER), ...header(number, name, note, width - 2), span('┐', CORNER)];
  const sides = content.map((line) => [span('│ ', RAIL), ...line, span(' │', RAIL)]);
  const bottom = [span('└', CORNER), span('─'.repeat(width - 2), RAIL), span('┘', CORNER)];
  return [top, ...sides, bottom];
}
