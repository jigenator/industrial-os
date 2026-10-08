import { assertCells, fitLine, lineWidth, span } from '../../foundation/cells.mjs';
import { lamp } from '../lamp/lamp.mjs';
import { labelPlate } from '../label-plate/label-plate.mjs';
import { COUNT_PLATES, countPlate } from '../count-plate/count-plate.mjs';

// Unit marks shown at most, each two cells (pi/status-bar/src/footer.ts PULSE_CAP).
export const RAIL_MARKS = 6;

function readActivity(activity) {
  if (activity === null || activity === undefined) return { state: 'unknown', units: undefined };
  if (typeof activity !== 'object') throw new TypeError('activity must be { working, units }, null or undefined');
  if (typeof activity.working !== 'boolean') throw new TypeError('activity.working must be a boolean');
  const { units } = activity;
  if (units !== null && units !== undefined && (typeof units !== 'number' || !Number.isSafeInteger(units) || units < 0)) {
    throw new RangeError(`activity.units must be a non-negative integer or null, got ${units}`);
  }
  return { state: activity.working ? 'working' : 'idle', units: units ?? undefined };
}

// Settled marks: one `█·` pair per active unit up to six, then `··` pairs. The shuttle is a host's motion.
export function unitMarks(units, { sides = [] } = {}) {
  readActivity({ working: false, units });
  if (!Array.isArray(sides) || sides.length > RAIL_MARKS || sides.some((s) => s !== 0 && s !== 1)) throw new RangeError('sides must contain at most six 0/1 poses');
  const out = [];
  for (let q = 0; q < RAIL_MARKS; q++) {
    if (q < Math.min(RAIL_MARKS, units ?? 0)) out.push(...(sides[q] === 1 ? [span('·', { fg: 'decorative' }), span('█', { fg: 'accent' })] : [span('█', { fg: 'accent' }), span('·', { fg: 'decorative' })]));
    else out.push(span('··', { fg: 'decorative' }));
  }
  return out;
}

// The rail's pieces, each an array of spans, left to right: lamp, ROOT, the six unit marks (unless `marks` is
// false), and the AU badge. Hosts and frames join them with one field cell.
export function threadRailPieces(activity, { marks: withMarks = true } = {}) {
  if (typeof withMarks !== 'boolean') throw new TypeError('marks must be a boolean');
  const { state, units } = readActivity(activity);
  const pieces = [lamp(state), labelPlate('ROOT', { tone: 'accent', form: 'slab' })];
  if (withMarks) pieces.push(unitMarks(units));
  pieces.push(countPlate(units, COUNT_PLATES.units));
  return pieces;
}

const joinPieces = (pieces) => pieces.flatMap((piece, i) => (i ? [span(' '), ...piece] : piece));

export function threadRailSpans(activity, options) {
  return joinPieces(threadRailPieces(activity, options));
}

// Re-render a piece too wide for the line at that width: ROOT truncates like a label plate, and the badge drops
// its pads and then shows `#` cells, never partial digits. The one-cell lamp always fits.
function fitPiece(index, piece, units, width) {
  if (lineWidth(piece) <= width) return piece;
  return index === 1 ? labelPlate('ROOT', { tone: 'accent', form: 'slab', maxWidth: width }) : countPlate(units, COUNT_PLATES.units, { maxWidth: width });
}

// The rail as lines of exactly `width` cells. Marks yield first; then lamp, ROOT and badge wrap onto further lines.
export function threadRail(activity, { width, align = 'left' } = {}) {
  assertCells(width, 'thread rail width');
  if (align !== 'left' && align !== 'right') throw new RangeError(`align must be 'left' or 'right', got ${align}`);
  const { units } = readActivity(activity);
  const place = (line) => fitLine(align === 'right' ? [span(' '.repeat(Math.max(0, width - lineWidth(line)))), ...line] : line, width);
  for (const withMarks of [true, false]) {
    const line = threadRailSpans(activity, { marks: withMarks });
    if (lineWidth(line) <= width) return [place(line)];
  }
  const lines = [];
  let line = [];
  threadRailPieces(activity, { marks: false }).forEach((raw, i) => {
    const piece = fitPiece(i, raw, units, width);
    if (line.length && lineWidth(line) + 1 + lineWidth(piece) > width) {
      lines.push(line);
      line = [];
    }
    line = line.length ? [...line, span(' '), ...piece] : piece;
  });
  lines.push(line);
  return lines.map(place);
}
