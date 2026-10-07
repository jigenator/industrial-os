import test from 'node:test';
import assert from 'node:assert/strict';
import { stripVTControlCharacters } from 'node:util';
import { GLYPHS, fitLine, lineWidth, paint } from '../../foundation/cells.mjs';
import { stateChip, stateChips, TATSU_STATES } from './state-chip.mjs';
const text = (lines) => lines.map((line) => paint(line, 'none'));

test('exact Tatsu snapshots in every state with dim labels and bold role-colored state text', () => {
  // footer.ts:24-37 and 1192-1203: label + field space + shape/code, no plate.
  const expected = ['• OK', '▲ UP', '▲ FIX', '◆ EDIT', '✕ MISS', '✕ NRUN', '✕ UNAV', '· CHK', '· OFF'];
  Object.entries(TATSU_STATES).forEach(([state, look], i) => {
    const line = stateChip({ label: 'TCLI', state });
    assert.equal(paint(line, 'none'), `TCLI ${expected[i]}`);
    assert.deepEqual(line[0].style, { fg: 'decorative' });
    assert.deepEqual(line[2].style, { fg: look.tone, bold: true });
  });
  assert.notEqual(paint(stateChip({ label: 'X', state: 'unavailable' }), 'none'), paint(stateChip({ label: 'X', state: 'current' }), 'none'));
});
test('behind counts and combined behind/repair with edits match extension grammar', () => {
  assert.equal(paint(stateChip({ label: 'TCLI', state: 'behind', commitsBehind: 1, localChanges: true }), 'none'), 'TCLI ▲ UP×1 ◆ EDIT');
  assert.equal(paint(stateChip({ label: 'X', state: 'behind', commitsBehind: 0 }), 'none'), 'X ▲ UP×0');
  assert.equal(paint(stateChip({ label: 'AWKS', state: 'repair', localChanges: true }), 'none'), 'AWKS ▲ FIX ◆ EDIT');
  assert.equal(paint(stateChip({ label: 'AWKS', state: 'current', localChanges: true }), 'none'), 'AWKS • OK');
});
test('three-cell gaps and whole-part line breaks, oversized parts wrap rather than disappear', () => {
  // footer.ts:1167-1180: whole components move together unless wider than the whole line.
  const parts = [{ label: 'TCLI', state: 'behind', commitsBehind: 1 }, { label: 'AWKS', state: 'current' }];
  assert.deepEqual(text(stateChips(parts, { width: 23 })), ['TCLI ▲ UP×1   AWKS • OK']);
  assert.deepEqual(text(stateChips(parts, { width: 20 })), ['TCLI ▲ UP×1'.padEnd(20), 'AWKS • OK'.padEnd(20)]);
  assert.deepEqual(text(stateChips([parts[0]], { width: 5 })), ['TCLI ', '▲    ', 'UP×1 ']);
  assert.equal(text(stateChips([parts[0]], { width: 1 })).join('').replaceAll(' ', ''), 'TCLI▲UP×1');
  assert.deepEqual(stateChips([], { width: 20 }), []);
});
test('generic preset and all caller text are control-safe', () => {
  const preset = { busy: { shape: '◆', code: 'GO\x1b', tone: 'warning' } };
  assert.equal(paint(stateChip({ label: '界\x1b', state: 'busy' }, { preset }), 'none'), '?? ◆ GO?');
});
test('every state and combination, inline and line widths 1–160, glyphs and plain/color match', () => {
  for (let width = 1; width <= 160; width++) for (const state of Object.keys(TATSU_STATES)) for (const localChanges of [false, true]) {
    const input = { label: 'TCLI', state, commitsBehind: 12, localChanges };
    const piece = stateChip(input, { maxWidth: width });
    assert.ok(lineWidth(piece) <= width);
    for (const line of [fitLine(piece, width), ...stateChips([input, { label: 'AWKS', state: 'current' }], { width })]) {
      const plain = paint(line, 'none');
      assert.equal(lineWidth(line), width);
      assert.ok([...plain].every((c) => /[\x20-\x7e]/.test(c) || GLYPHS.includes(c)));
      assert.equal(stripVTControlCharacters(paint(line, 'truecolor')), plain);
    }
  }
});
test('invalid states, count, flags, widths, preset and text throw', () => {
  for (const state of ['bad', '__proto__', 'constructor']) assert.throws(() => stateChip({ label: 'X', state }), RangeError);
  for (const commitsBehind of [-1, 0.2, NaN, Infinity, '1', Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => stateChip({ label: 'X', state: 'behind', commitsBehind }), RangeError);
  assert.throws(() => stateChip({ label: 1, state: 'current' }), TypeError);
  assert.throws(() => stateChip({ label: 'X', state: 'current', localChanges: 1 }), TypeError);
  assert.throws(() => stateChip({ label: 'X', state: 'current' }, { maxWidth: -1 }), RangeError);
  assert.throws(() => stateChips([], { width: 0 }), RangeError);
  assert.throws(() => stateChips({}, { width: 20 }), TypeError);
  for (const shape of ['界', 'xx', '\x1b']) assert.throws(() => stateChip({ label: 'X', state: 'x' }, { preset: { x: { shape, code: 'X', tone: 'warning' } } }), TypeError);
});
