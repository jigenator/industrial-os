// The board's time axis: a scale from time to columns, the axis ruler with hour labels, a lane's track, runs on it and
// the NOW line. Columns are relative to the lane's first cell; the host places the pieces. Contract: README.md.
import { assertCells, fitText, lineWidth, resolveColor, span } from '../../foundation/cells.mjs';
import { BOARD_INKS } from '../../foundation/signal-colors.mjs';
import { BOARD_GLYPHS, endMark } from '../board-marks/board-marks.mjs';

const HOUR = 3_600_000;
const QUARTER = 900_000;

function object(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}
function column(value, name, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (!Number.isInteger(value) || Math.abs(value) > 100_000) throw new RangeError(`${name} must be an integer column`);
  return value;
}
// Consecutive cells of the same style become one span.
function runs(cells) {
  const out = [];
  for (const [ch, style] of cells) {
    const last = out.at(-1);
    if (last && JSON.stringify(last.style) === JSON.stringify(style)) last.text += ch;
    else out.push(span(ch, style));
  }
  return out;
}

export function laneScale({ past, future } = {}, { width } = {}) {
  for (const [name, value] of [['past', past], ['future', future]]) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new RangeError(`lane ${name} must be a positive number of milliseconds`);
  }
  assertCells(width, 'lane width');
  const col = (dt) => {
    if (typeof dt !== 'number' || !Number.isFinite(dt)) throw new RangeError('lane time must be a finite number of milliseconds');
    return Math.round(((dt + past) / (past + future)) * (width - 1));
  };
  return { col, now: col(0) };
}

// The ruler: structural line, faint quarter marks, structural hour ticks and an acid NOW junction. Hour labels are
// placed pieces centred on their tick, kept inside the lane on the right; the first may start one or two cells left
// of it, over the host's heading row.
export function laneAxis({ past, future } = {}, { width } = {}) {
  const { col } = laneScale({ past, future }, { width });
  const cells = Array.from({ length: width }, () => ['─', { fg: 'structural' }]);
  for (let k = Math.ceil(-past / QUARTER); k <= Math.floor(future / QUARTER); k++) {
    if ((k * QUARTER) % HOUR) cells[col(k * QUARTER)] = ['┴', { fg: BOARD_INKS.faint }];
  }
  const labels = [];
  for (let h = Math.ceil(-past / HOUR); h <= Math.floor(future / HOUR); h++) {
    const x = col(h * HOUR), text = h === 0 ? 'NOW' : `${h > 0 ? '+' : ''}${h}H`;
    cells[x] = h === 0 ? ['┼', { fg: 'accent' }] : ['┬', { fg: 'structural' }];
    labels.push({ at: Math.min(x - Math.floor(text.length / 2), width - text.length), line: [span(text, h === 0 ? { fg: 'primary', bold: true } : { fg: 'decorative' })] });
  }
  return { ruler: runs(cells), labels };
}

// A lane's base: faint and solid up to NOW, then dotted on even absolute columns (`origin` is the lane's first absolute
// column, so stacked lanes align). Since `since`, up to NOW, it is dashed (the source stopped) or hatched (unheard).
export function laneTrack({ now, since = null, after = 'dashed' } = {}, { width, origin = 0 } = {}) {
  assertCells(width, 'lane width');
  column(now, 'now');
  column(since, 'since', { nullable: true });
  column(origin, 'origin');
  if (after !== 'dashed' && after !== 'hatched') throw new RangeError('lane after must be dashed or hatched');
  const faint = { fg: BOARD_INKS.faint };
  return runs(Array.from({ length: width }, (_, x) => {
    const quiet = since !== null && x > since && x <= now;
    if (quiet && after === 'hatched') return ['╱', { fg: BOARD_INKS.hatch }];
    if (x > now) return (origin + x) % 2 === 0 ? ['·', faint] : [' ', {}];
    return [quiet ? '┄' : '─', faint];
  }));
}

// One run, from column `from` to `to`, as pieces to lay over its track in order. Finished: a grey bar ending in its
// miss mark. Live: hatched until `verified` (all of it while `verifying`), then solid `fill`, its label in `ink` on the
// fill (or in secondary to the left when the bar is too short), and with `head` one more cell at NOW, acid while `lit`.
// Returns null when it ends before the lane; `span` is the live run's drawn extent, for the host's hit regions.
export function laneRun(run, { width, measure } = {}) {
  const { from, to, verified = null, verifying = false, live = false, outcome = 'succeeded', label = '', fill = 'decorative', ink = 'field', head = false, lit = true } = object(run, 'lane run');
  assertCells(width, 'lane width');
  column(from, 'from');
  column(to, 'to');
  column(verified, 'verified', { nullable: true });
  for (const [name, value] of [['verifying', verifying], ['live', live], ['head', head], ['lit', lit]]) if (typeof value !== 'boolean') throw new TypeError(`lane run ${name} must be boolean`);
  resolveColor(fill);
  resolveColor(ink);
  const shown = live && head;
  let x0 = from;
  const x1 = Math.min(width - 1 - (shown ? 1 : 0), Math.max(x0, to - (shown ? 1 : 0)));
  if (x1 < 0) return null;
  x0 = Math.max(0, x0);
  if (!live) {
    const mark = endMark(outcome);
    const bar = Array.from({ length: x1 - x0 + 1 - mark.length }, () => [' ', { bg: BOARD_INKS.base }]);
    return { pieces: [{ at: x0, line: [...runs(bar), ...mark] }], span: null };
  }
  const xv = verified !== null ? Math.max(x0, verified) : verifying ? x1 + 1 : x0;
  const bar = Array.from({ length: x1 - x0 + 1 }, (_, i) => (x0 + i < xv ? [BOARD_GLYPHS.verifying, { fg: fill, bg: 'field' }] : [' ', { bg: fill }]));
  const pieces = [{ at: x0, line: runs(bar) }];
  const text = fitText(label, Infinity, { measure });
  const size = lineWidth(text, { measure });
  if (size) {
    const inside = x1 - x0 >= size + 1;
    const at = inside ? Math.max(x0, Math.min(xv, x1 - size)) : Math.max(0, x0 - size - 1);
    const style = inside ? { fg: ink, bg: fill, bold: true } : { fg: 'secondary', bold: true };
    pieces.push({ at, line: fitText(label, width - at, { measure, style }) });
  }
  if (shown) pieces.push({ at: x1 + 1, line: [span(' ', { bg: lit ? 'accent' : fill })] });
  return { pieces, span: [x0, shown ? x1 + 1 : x1] };
}

// NOW through a board column: it crosses track, gaps and blank cells on the field, never a bar, mark, text or a
// selection. `quiet` draws a faint NOW over blank cells only, for strips beside text.
export function crossNow(cell, { quiet = false } = {}) {
  const { text, style = {} } = object(cell, 'cell');
  if (typeof text !== 'string') throw new TypeError('cell text must be a string');
  if (quiet) return text === ' ' ? span('│', { fg: BOARD_INKS.faint }) : null;
  const onField = style.bg === undefined || resolveColor(style.bg) === resolveColor('field');
  return onField && [' ', '─', '·', '┄'].includes(text) ? span('│', { fg: 'accent' }) : null;
}
