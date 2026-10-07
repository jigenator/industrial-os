import { assertLines, assertMs, assertTime, blockWidth, copyLines, resolveOptions, restyleCells } from './frame.mjs';

export const REVEAL_DEFAULTS = Object.freeze({ duration: 600, stagger: 60, veil: 'dim' });

function check(o) {
  assertMs(o.duration, 'reveal duration', { min: 1 });
  assertMs(o.stagger, 'reveal stagger', { max: 1000 });
  if (o.veil !== 'dim' && o.veil !== 'blank') throw new RangeError(`reveal veil must be 'dim' or 'blank', got ${o.veil}`);
}

// Total ms until a reveal of lineCount lines is complete. Hosts use it to know when to stop redrawing.
export function revealDuration(lineCount, options = {}) {
  const o = resolveOptions('reveal', options, REVEAL_DEFAULTS);
  if (!Number.isInteger(lineCount) || lineCount < 0) throw new RangeError(`reveal lineCount must be an integer >= 0, got ${lineCount}`);
  check(o);
  return o.duration + Math.max(0, lineCount - 1) * o.stagger;
}

// One-shot left-to-right wipe, each line starting `stagger` ms after the one above. Cells not yet reached
// are veiled: 'dim' (default) preserves characters in structural grey; 'blank' replaces them with spaces.
// Apply only to decoration; keep complete essential blocks outside it. State-colored cells are exempt. Time 0 is the fully veiled start; at revealDuration() and
// beyond, or with animate: false, the output equals the input.
export function reveal(lines, options = {}) {
  const o = resolveOptions('reveal', options, REVEAL_DEFAULTS);
  assertLines(lines);
  check(o);
  assertTime(o, 'reveal');
  if (!o.animate) return copyLines(lines);

  const width = blockWidth(lines);
  const shown = (row) => Math.min(1, Math.max(0, (o.time - row * o.stagger) / o.duration)) * width;
  return restyleCells(lines, (style, col, row, ch) => {
    if (col < Math.floor(shown(row))) return undefined;
    const veiled = { ...style, fg: 'structural', bold: false };
    return o.veil === 'blank' ? { style: veiled, char: ' ' } : ch === ' ' ? undefined : { style: veiled };
  });
}
