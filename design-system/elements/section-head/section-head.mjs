// A section or group head: a square mark, a bold title, an optional count and a faint rule to the edge.
// Contract: README.md.
import { assertCells, fitLine, fitText, lineWidth, resolveColor, span } from '../../foundation/cells.mjs';
import { BOARD_INKS } from '../../foundation/signal-colors.mjs';

export function sectionHead(input, { width, measure, ellipsis } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('section head input must be an object');
  const { title, count = '', mark = 'primary' } = input;
  assertCells(width, 'section head width');
  if (typeof title !== 'string' && (typeof title !== 'object' || title === null)) throw new TypeError('section head title must be text');
  if (typeof count !== 'string') throw new TypeError('section head count must be a string');
  resolveColor(mark);
  const name = fitText(title, Math.max(0, width - 2), { measure, ellipsis, style: { fg: 'primary', bold: true } });
  const line = [span('■', { fg: mark }), span(' '), ...name];
  let used = 2 + lineWidth(name, { measure });
  const tally = count ? fitText(count, Infinity, { measure, style: { fg: 'decorative' } }) : [];
  const tallyWidth = lineWidth(tally, { measure });
  if (tallyWidth && used + 2 + tallyWidth <= width) {
    line.push(span('  '), ...tally);
    used += 2 + tallyWidth;
  }
  if (width - used > 2) line.push(span('  '), span('─'.repeat(width - used - 2), { fg: BOARD_INKS.faint }));
  return fitLine(line, width, {}, { measure });
}
