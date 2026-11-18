import { assertLines, assertMs, assertTime, blockWidth, copyLines, joinCells, resolveOptions, restyleCells } from './frame.mjs';
import { lineWidth, textSlot } from '../foundation/cells.mjs';

export const REVEAL_DEFAULTS = Object.freeze({ duration: 600, stagger: 60, veil: 'dim' });

function check(o) {
  if (o.measure !== undefined && typeof o.measure !== 'function') throw new TypeError('reveal measure must be a function');
  assertMs(o.duration, 'reveal duration', { min: 1 });
  assertMs(o.stagger, 'reveal stagger', { max: 1000 });
  if (o.veil !== 'dim' && o.veil !== 'blank') throw new RangeError(`reveal veil must be 'dim' or 'blank', got ${o.veil}`);
  if (o.outgoing !== undefined) {
    assertLines(o.outgoing);
    if (o.measure !== undefined) throw new TypeError('reveal outgoing takes one-cell lines, without measure');
  }
}

// Total ms until a reveal of lineCount lines is complete. Hosts use it to know when to stop redrawing.
export function revealDuration(lineCount, options = {}) {
  const o = resolveOptions('reveal', options, { ...REVEAL_DEFAULTS, measure: undefined, outgoing: undefined });
  if (!Number.isInteger(lineCount) || lineCount < 0) throw new RangeError(`reveal lineCount must be an integer >= 0, got ${lineCount}`);
  check(o);
  return o.duration + Math.max(0, lineCount - 1) * o.stagger;
}

// One-shot left-to-right wipe, each line starting `stagger` ms after the one above. Cells not yet reached
// are veiled: 'dim' (default) preserves characters in structural grey; 'blank' replaces them with spaces.
// Apply only to decoration; keep complete essential blocks outside it. State-colored cells are exempt. Time 0 is the fully veiled start; at revealDuration() and
// beyond, or with animate: false, the output equals the input.
export function reveal(lines, options = {}) {
  const o = resolveOptions('reveal', options, { ...REVEAL_DEFAULTS, measure: undefined, outgoing: undefined });
  assertLines(lines);
  check(o);
  assertTime(o, 'reveal');
  if (o.measure !== undefined) lines.forEach(line => textSlot(line, lineWidth(line, { measure: o.measure }), { measure: o.measure }));
  if (!o.animate) return copyLines(lines);

  const width = o.measure === undefined ? blockWidth(lines) : Math.max(0, ...lines.map(line => lineWidth(line, { measure: o.measure })));
  const shown = (row) => Math.min(1, Math.max(0, (o.time - row * o.stagger) / o.duration)) * width;
  // With outgoing lines, a cell not yet reached shows the outgoing block's cell there: the new block wipes in over the
  // old one with a clean vertical front, and nothing is veiled. State cells take part, since both blocks are whole.
  if (o.outgoing !== undefined) {
    const cellsOf = (line) => line.flatMap((s) => [...s.text].map((ch) => ({ ch, style: s.style })));
    return lines.map((line, row) => {
      const front = Math.floor(shown(row)), old = cellsOf(o.outgoing[row] ?? []);
      return joinCells(cellsOf(line).map((cell, col) => (col < front || !old[col] ? cell : old[col])));
    });
  }
  return restyleCells(lines, (style, col, row, ch) => {
    if (col < Math.floor(shown(row))) return undefined;
    const veiled = { ...style, fg: 'structural', bold: false };
    return o.veil === 'blank' ? { style: veiled, char: o.measure ? ' '.repeat(o.measure(ch)) : ' ' } : ch === ' ' ? undefined : { style: veiled };
  }, { measure: o.measure });
}
