// One event as a row: the board's event log (`log`) or a popup's event list (`detail`). Supplied text only; the host
// formats the clock. Contract: README.md.
import { assertCells, fitLine, fitText, lineWidth, span } from '../../foundation/cells.mjs';
import { boardTone } from '../../foundation/board-tones.mjs';

const DETAIL_VERB = { live: 'accent', crit: 'critical', warn: 'warning' };

function text(value, name) {
  if (typeof value !== 'string') throw new TypeError(`event ${name} must be a string`);
  return value;
}

export function eventRow(event, { width, measure, form = 'log', ellipsis } = {}) {
  if (event === null || typeof event !== 'object' || Array.isArray(event)) throw new TypeError('event must be an object');
  const { time, tone, verb, ref = '', text: subject = '' } = event;
  for (const [name, value] of [['time', time], ['verb', verb], ['ref', ref], ['text', subject]]) text(value, name);
  const colors = boardTone(tone);
  assertCells(width, 'event row width');
  if (form !== 'log' && form !== 'detail') throw new RangeError('event row form must be log or detail');
  const fit = (value, n, style) => fitText(value, Math.max(0, Math.min(1000, n)), { measure, ellipsis, style });
  if (form === 'detail') {
    // Clock at 0, a bold verb in its state ink at 10, the reference at 16.
    const clock = fit(time, 9, { fg: 'decorative' });
    const line = [...clock, span(' '.repeat(Math.max(0, 10 - lineWidth(clock, { measure }))))];
    const verbShown = fit(verb, 5, { fg: DETAIL_VERB[tone] ?? 'secondary', bold: true });
    line.push(...verbShown, span(' '.repeat(6 - lineWidth(verbShown, { measure }))));
    if (ref) line.push(...fit(ref, width - 16, { fg: 'secondary' }));
    return fitLine(line, width, {}, { measure });
  }
  // Clock, a state cell at 6, a five-cell verb at 8 (bold and in its ink only for warnings and failures), then the
  // reference in primary and the subject in decorative from 14.
  const loud = tone === 'crit' || tone === 'warn';
  const clock = fit(time, 5, { fg: 'decorative' });
  const verbShown = fit(verb, 5, loud ? { fg: colors.ink, bold: true } : { fg: 'secondary' });
  const line = [...clock, span(' '.repeat(Math.max(1, 6 - lineWidth(clock, { measure })))), span('█', { fg: colors.cell }), span(' '),
    { ...verbShown[0], text: (verbShown[0]?.text ?? '').padEnd(5) }, span(' ')];
  let x = 14;
  if (ref) {
    const shown = fit(ref, width - x, { fg: 'primary' });
    line.push(...shown, span(' '));
    x += lineWidth(shown, { measure }) + 1;
  }
  line.push(...fit(subject, width - x, { fg: 'decorative' }));
  return fitLine(line, width, {}, { measure });
}
