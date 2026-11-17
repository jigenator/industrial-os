// The serial roll (K5): a decode over hex. A plate's identity digits roll through random hex every `tick` ms and lock
// left to right, slot by slot, `step` ms apart after `start`; text slots are one cell, pixel slots one 3×3 wordmark
// glyph. Cells under `hold` show `hold.lines` until the last slot locks (a fallback barcode switching to the real one).
// Pure and seeded; at its duration, and with motion off, the output equals the input.
import { hash } from '../foundation/seeded.mjs';
import { assertLines, assertMs, assertTime, inRegion, joinCells, resolveOptions, resolveRegion } from './frame.mjs';

export const SERIAL_ROLL_DEFAULTS = Object.freeze({ seed: 0, tick: 40, start: 120, step: 50, slots: Object.freeze([]), glyphs: undefined, hold: undefined });
const HEX = '0123456789ABCDEF';

function check(options) {
  const o = resolveOptions('serialRoll', options, SERIAL_ROLL_DEFAULTS);
  if (!Number.isInteger(o.seed)) throw new RangeError('serialRoll seed must be an integer');
  assertMs(o.tick, 'serialRoll tick', { min: 1, max: 1000 });
  assertMs(o.start, 'serialRoll start', { max: 5000 });
  assertMs(o.step, 'serialRoll step', { max: 1000 });
  if (!Array.isArray(o.slots)) throw new TypeError('serialRoll slots must be an array');
  for (const s of o.slots) {
    if (!s || !['text', 'pixel'].includes(s.kind)) throw new TypeError('serialRoll slot kind must be text or pixel');
    for (const key of ['row', 'col', 'lock']) if (!Number.isInteger(s[key]) || s[key] < 0) throw new RangeError(`serialRoll slot ${key} must be a non-negative integer`);
  }
  if (o.slots.some((s) => s.kind === 'pixel')) {
    if (!o.glyphs || typeof o.glyphs !== 'object') throw new TypeError('serialRoll pixel slots need glyphs');
    for (const ch of HEX) {
      const g = o.glyphs[ch];
      if (!Array.isArray(g) || g.length !== 3 || g.some((row) => typeof row !== 'string' || [...row].length !== 3)) throw new TypeError(`serialRoll glyph ${ch} must be three rows of three cells`);
    }
  }
  if (o.hold !== undefined) {
    if (!o.hold || typeof o.hold !== 'object') throw new TypeError('serialRoll hold must be { region, lines }');
    assertLines(o.hold.lines);
    o.hold = { lines: o.hold.lines, region: resolveRegion('serialRoll', o.hold.region) };
  }
  return o;
}

// Total ms until the last slot locks.
export function serialRollDuration(options = {}) {
  const o = check(options);
  return o.slots.length ? o.start + Math.max(...o.slots.map((s) => s.lock)) * o.step : 0;
}

const cellsOf = (line) => line.flatMap((s) => [...s.text].map((ch) => ({ ch, style: s.style })));
export function serialRoll(lines, options = {}) {
  assertLines(lines);
  const o = check(options);
  assertTime(o, 'serialRoll');
  const end = serialRollDuration(options);
  const grid = lines.map(cellsOf);
  if (!o.animate || o.time >= end) return lines.map((line) => line.slice());
  const k = Math.floor(o.time / o.tick), roll = (i, salt) => HEX[Math.floor(hash(k, i * 7 + salt, o.seed) * 16)];
  if (o.hold) {
    const held = o.hold.lines.map(cellsOf);
    grid.forEach((row, y) => row.forEach((_, x) => { if (inRegion(o.hold.region, x, y) && held[y]?.[x]) row[x] = held[y][x]; }));
  }
  o.slots.forEach((s, i) => {
    if (o.time >= o.start + s.lock * o.step) return;
    if (s.kind === 'text') {
      const cell = grid[s.row]?.[s.col];
      if (cell && cell.ch !== ' ') grid[s.row][s.col] = { ch: roll(i, 1), style: cell.style };
      return;
    }
    const g = o.glyphs[roll(i, 2)];
    for (let dy = 0; dy < 3; dy++) [...g[dy]].forEach((ch, dx) => {
      const cell = grid[s.row + dy]?.[s.col + dx];
      if (cell) grid[s.row + dy][s.col + dx] = { ch, style: s.ink === undefined ? cell.style : { ...cell.style, fg: s.ink } };
    });
  });
  return grid.map(joinCells);
}
