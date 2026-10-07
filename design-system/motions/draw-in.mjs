import { lineWidth } from '../foundation/cells.mjs';
import { MIN_PERIOD_MS, assertLines, assertMs, assertTime, copyLines, resolveOptions, restyleCells } from './frame.mjs';

// status-bar's USG row boot (pi/status-bar/src/footer.ts USAGE_SWEEP_CELLS_PER_TICK, drawIn): 3 cells a 50 ms tick,
// the line below one tick behind.
export const DRAW_IN_DEFAULTS = Object.freeze({ tick: 50, cells: 3, lag: 50 });

// The path lock's one-tick latch: bold black on acid.
const LOCKED = Object.freeze({ fg: 'field', bg: 'accent', bold: true });
const BLANK = Object.freeze({ bg: 'field' });

function check(o) {
  assertMs(o.tick, 'drawIn tick', { min: MIN_PERIOD_MS });
  if (!Number.isInteger(o.cells) || o.cells < 1 || o.cells > 1000) throw new RangeError(`drawIn cells must be an integer from 1 to 1000, got ${o.cells}`);
  assertMs(o.lag, 'drawIn lag');
}

// Cells line `row` has reached: on tick k of its own start, (k + 1) * cells; nothing before it starts.
const frontOf = (o, row) => {
  const t = o.time - row * o.lag;
  return t < 0 ? 0 : (Math.floor(t / o.tick) + 1) * o.cells;
};

// A line is settled on the tick its latched band has passed its last cell: k * cells >= width.
const settledAt = (lines, o) => lines.reduce((max, line, row) => {
  const width = lineWidth(line);
  return width === 0 ? max : Math.max(max, row * o.lag + Math.ceil(width / o.cells) * o.tick);
}, 0);

// Total ms until every line is drawn and settled. Hosts use it to know when to stop redrawing.
export function drawInDuration(lines, options = {}) {
  const o = resolveOptions('drawIn', options, DRAW_IN_DEFAULTS);
  assertLines(lines);
  check(o);
  return settledAt(lines, o);
}

// One-shot draw-in, like a terminal writing the block: each line's front advances `cells` cells a tick from its left
// edge, starting `lag` ms after the line above. Cells ahead of the front are blank field; the `cells` cells at the
// front latch (bold black on acid) with their current character, blank cells included; cells behind are settled.
// Like reveal's blank veil it hides text, so apply it only while a block appears. Warning and critical cells are
// exempt and always shown settled. At drawInDuration() and beyond, or with animate: false, the output equals the input.
export function drawIn(lines, options = {}) {
  const o = resolveOptions('drawIn', options, DRAW_IN_DEFAULTS);
  assertLines(lines);
  check(o);
  assertTime(o, 'drawIn');
  if (!o.animate || o.time >= settledAt(lines, o)) return copyLines(lines);

  const fronts = lines.map((_, row) => frontOf(o, row));
  return restyleCells(lines, (style, col, row) => {
    const front = fronts[row];
    if (col >= front) return { style: BLANK, char: ' ' };
    if (col >= front - o.cells) return { style: LOCKED };
    return undefined;
  });
}
