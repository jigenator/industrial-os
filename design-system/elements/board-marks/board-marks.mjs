// The board's one-cell marks: run outcomes, schedule times, state cells, the selection pointer and the plate spine.
// Every mark is a shape as well as a color, so plain output keeps its meaning. Contract: README.md.
import { resolveColor, span } from '../../foundation/cells.mjs';
import { boardTone } from '../../foundation/board-tones.mjs';
import { BOARD_INKS } from '../../foundation/signal-colors.mjs';

export const BOARD_GLYPHS = Object.freeze({
  succeeded: '■', failed: '✕', interrupted: '◩', blocked: '▣', cancelled: '□', ended: '▪', last: '◆', next: '◇',
  verifying: '▒', cell: '█', pointer: '▶', spine: '▌',
});
const G = BOARD_GLYPHS;
export const RUN_MARKS = Object.freeze({
  succeeded: Object.freeze({ glyph: G.succeeded, ink: 'primary' }),
  failed: Object.freeze({ glyph: G.failed, ink: 'critical' }),
  blocked: Object.freeze({ glyph: G.blocked, ink: 'warning' }),
  cancelled: Object.freeze({ glyph: G.cancelled, ink: 'decorative' }),
  interrupted: Object.freeze({ glyph: G.interrupted, ink: 'warning' }),
  dropped: Object.freeze({ glyph: G.interrupted, ink: 'warning' }),
});

function outcomeOf(outcome) {
  if (typeof outcome !== 'string' || !Object.hasOwn(RUN_MARKS, outcome)) throw new RangeError(`unknown run outcome: ${String(outcome)}`);
  return RUN_MARKS[outcome];
}
function flag(value, name) {
  if (typeof value !== 'boolean') throw new TypeError(`${name} must be boolean`);
  return value;
}
const styled = (fg, bold, extra = {}) => (bold ? { fg, ...extra, bold: true } : { fg, ...extra });

export function runMark(outcome, { bold = false } = {}) {
  const mark = outcomeOf(outcome);
  return [span(mark.glyph, styled(mark.ink, flag(bold, 'bold')))];
}

// Newest first, as supplied, `gap` unstyled cells apart.
export function runTrail(outcomes, { gap = 1 } = {}) {
  if (!Array.isArray(outcomes)) throw new TypeError('run trail outcomes must be an array');
  if (!Number.isInteger(gap) || gap < 0 || gap > 1000) throw new RangeError('run trail gap must be 0–1000');
  return outcomes.flatMap((outcome, i) => [...(i && gap ? [span(' '.repeat(gap))] : []), ...runMark(outcome)]);
}

// The end of a finished bar: a cross for a failure, a small square for any other miss, nothing for a success.
export function endMark(outcome) {
  const mark = outcomeOf(outcome);
  if (outcome === 'succeeded') return [];
  return [span(outcome === 'failed' ? G.failed : G.ended, { fg: mark.ink, bg: BOARD_INKS.base, bold: true })];
}

// A schedule's marks: its last result in a column (`result`), its last and next run on a strip, and a firing run.
export function scheduleMark(kind, { outcome, lit = true } = {}) {
  switch (kind) {
    case 'result':
      outcomeOf(outcome);
      return [span(outcome === 'failed' ? G.failed : outcome === 'succeeded' ? G.succeeded : G.interrupted,
        { fg: outcome === 'failed' ? 'critical' : outcome === 'succeeded' ? 'secondary' : 'warning', bold: true })];
    case 'last':
      outcomeOf(outcome);
      return [span(outcome === 'failed' ? G.failed : G.last, { fg: outcome === 'failed' ? 'critical' : 'secondary', bold: true })];
    case 'next': return [span(G.next, { fg: 'decorative' })];
    case 'firing': return [span(G.last, { fg: flag(lit, 'lit') ? 'accent' : 'decorative', bold: true })];
    default: throw new RangeError(`unknown schedule mark: ${String(kind)}`);
  }
}

export const stateCell = (tone) => [span(G.cell, { fg: boardTone(tone).cell })];
export const pointer = ({ bold = false } = {}) => [span(G.pointer, styled('primary', flag(bold, 'bold')))];
export function spine(ink) {
  resolveColor(ink);
  return [span(G.spine, { fg: ink })];
}
