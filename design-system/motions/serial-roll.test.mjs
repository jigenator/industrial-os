import test from 'node:test';
import assert from 'node:assert/strict';
import { span } from '../foundation/cells.mjs';
import { serialRoll, serialRollDuration, SERIAL_ROLL_DEFAULTS } from './serial-roll.mjs';

const GLYPHS = Object.fromEntries([...'0123456789ABCDEF'].map((ch) => [ch, [`${ch}${ch}${ch}`, `${ch} ${ch}`, `${ch}${ch}${ch}`]]));
const block = () => [
  [span('S/N 150C-4F01', { fg: 'field' })],
  [span('.... ... ...', { fg: 'field' })], [span('.... ... ...', { fg: 'field' })], [span('.... ... ...', { fg: 'field' })],
];
// The droid plate's K5: eight serial digits lock 50 ms apart from 120 ms; the four unit digits lock on the odd steps.
const SLOTS = [
  ...[4, 5, 6, 7, 9, 10, 11, 12].map((col, i) => ({ kind: 'text', row: 0, col, lock: i })),
  ...[0, 4].map((col, i) => ({ kind: 'pixel', row: 1, col, lock: 2 * i + 1, ink: 'accent' })),
];
const text = (lines) => lines.map((line) => line.map((s) => s.text).join(''));

test('the roll locks left to right and ends exactly on the input', () => {
  assert.equal(SERIAL_ROLL_DEFAULTS.tick, 40);
  assert.equal(serialRollDuration({ slots: SLOTS, glyphs: GLYPHS }), 120 + 7 * 50);
  const input = block();
  const at = (time) => text(serialRoll(input, { time, slots: SLOTS, glyphs: GLYPHS, seed: 3 }));
  assert.deepEqual(at(470), text(input));
  assert.deepEqual(text(serialRoll(input, { animate: false, slots: SLOTS, glyphs: GLYPHS })), text(input));
  const early = at(0);
  assert.notEqual(early[0], text(input)[0]);
  assert.equal(early[0].slice(0, 4), 'S/N '); // only the slots roll
  assert.match(early[0].slice(4), /^[0-9A-F]{4}-[0-9A-F]{4}$/);
  // At 175 ms the first two serial digits and the first unit glyph have locked.
  const mid = at(175);
  assert.equal(mid[0].slice(4, 6), '15');
  assert.deepEqual(mid.slice(1).map((row) => row.slice(0, 3)), ['...', '...', '...']);
  // Same seed and time, same frame; the digits change every 40 ms tick.
  assert.deepEqual(at(10), at(30));
  assert.notDeepEqual(at(10), at(50));
});

test('pixel slots take the slot ink; hold shows other lines until the roll ends', () => {
  const input = block(), hold = { region: { top: 1, left: 9, rows: 3, cols: 3 }, lines: [[span('x'.repeat(13))], [span('x'.repeat(12))], [span('x'.repeat(12))], [span('x'.repeat(12))]] };
  const frame = serialRoll(input, { time: 0, slots: SLOTS, glyphs: GLYPHS, hold });
  assert.ok(frame[1].some((s) => s.style.fg === 'accent'));
  assert.equal(text(frame)[1].slice(9), 'xxx');
  assert.equal(text(serialRoll(input, { time: 470, slots: SLOTS, glyphs: GLYPHS, hold }))[1].slice(9), '...');
});

test('invalid options throw', () => {
  assert.throws(() => serialRoll(block(), { time: 0, slots: [{ kind: 'pixel', row: 0, col: 0, lock: 0 }] }), TypeError);
  assert.throws(() => serialRoll(block(), { time: 0, slots: [{ kind: 'x', row: 0, col: 0, lock: 0 }] }), TypeError);
  assert.throws(() => serialRoll(block(), { time: 0, slots: [{ kind: 'text', row: -1, col: 0, lock: 0 }] }), RangeError);
  assert.throws(() => serialRoll(block(), { time: -1, slots: SLOTS, glyphs: GLYPHS }), RangeError);
  assert.throws(() => serialRoll(block(), { time: 0, seed: 1.5 }), RangeError);
  assert.equal(serialRollDuration(), 0);
});
