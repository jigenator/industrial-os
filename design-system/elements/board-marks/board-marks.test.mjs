import test from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS, paint } from '../../foundation/cells.mjs';
import { BOARD_INKS } from '../../foundation/signal-colors.mjs';
import { BOARD_GLYPHS, RUN_MARKS, endMark, pointer, runMark, runTrail, scheduleMark, spine, stateCell } from './board-marks.mjs';

const one = (line) => (assert.equal(line.length, 1), line[0]);

test('the mark vocabulary is frozen, curated and one cell per mark', () => {
  assert.ok(Object.isFrozen(BOARD_GLYPHS) && Object.isFrozen(RUN_MARKS));
  assert.deepEqual({ ...BOARD_GLYPHS }, {
    succeeded: '■', failed: '✕', interrupted: '◩', cancelled: '□', ended: '▪', last: '◆', next: '◇',
    verifying: '▒', cell: '█', pointer: '▶', spine: '▌',
  });
  for (const glyph of Object.values(BOARD_GLYPHS)) assert.ok(GLYPHS.includes(glyph), glyph);
});

test('run outcomes keep a distinct shape and a role ink; dropped reads as interrupted', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(RUN_MARKS)), {
    succeeded: { glyph: '■', ink: 'primary' }, failed: { glyph: '✕', ink: 'critical' },
    cancelled: { glyph: '□', ink: 'decorative' }, interrupted: { glyph: '◩', ink: 'warning' }, dropped: { glyph: '◩', ink: 'warning' },
  });
  assert.deepEqual(one(runMark('failed')), { text: '✕', style: { fg: 'critical' } });
  assert.deepEqual(one(runMark('succeeded', { bold: true })), { text: '■', style: { fg: 'primary', bold: true } });
  for (const bad of ['unknown', 'toString', null]) assert.throws(() => runMark(bad), RangeError);
  assert.throws(() => runMark('failed', { bold: 'yes' }), TypeError);
});

test('a run trail spaces marks by the gap and leaves the gap cells unstyled', () => {
  const trail = runTrail(['succeeded', 'failed', 'cancelled', 'dropped']);
  assert.equal(paint(trail, 'none'), '■ ✕ □ ◩');
  assert.deepEqual(trail[1], { text: ' ', style: {} });
  assert.equal(paint(runTrail(['failed', 'failed'], { gap: 0 }), 'none'), '✕✕');
  assert.deepEqual(runTrail([]), []);
  assert.throws(() => runTrail('failed'), TypeError);
  assert.throws(() => runTrail([], { gap: -1 }), RangeError);
});

test('a finished bar ends in a cross for a failure, a small square for any other miss, and nothing for success', () => {
  assert.deepEqual(one(endMark('failed')), { text: '✕', style: { fg: 'critical', bg: BOARD_INKS.base, bold: true } });
  assert.deepEqual(one(endMark('interrupted')), { text: '▪', style: { fg: 'warning', bg: BOARD_INKS.base, bold: true } });
  assert.deepEqual(one(endMark('cancelled')), { text: '▪', style: { fg: 'decorative', bg: BOARD_INKS.base, bold: true } });
  assert.deepEqual(endMark('succeeded'), []);
});

test('schedule marks: the result column, the strip last and next, and the firing mark', () => {
  assert.deepEqual(one(scheduleMark('result', { outcome: 'succeeded' })), { text: '■', style: { fg: 'secondary', bold: true } });
  assert.deepEqual(one(scheduleMark('result', { outcome: 'failed' })), { text: '✕', style: { fg: 'critical', bold: true } });
  assert.deepEqual(one(scheduleMark('result', { outcome: 'cancelled' })), { text: '◩', style: { fg: 'warning', bold: true } });
  assert.deepEqual(one(scheduleMark('last', { outcome: 'interrupted' })), { text: '◆', style: { fg: 'secondary', bold: true } });
  assert.deepEqual(one(scheduleMark('last', { outcome: 'failed' })), { text: '✕', style: { fg: 'critical', bold: true } });
  assert.deepEqual(one(scheduleMark('next')), { text: '◇', style: { fg: 'decorative' } });
  assert.deepEqual(one(scheduleMark('firing')), { text: '◆', style: { fg: 'accent', bold: true } });
  assert.deepEqual(one(scheduleMark('firing', { lit: false })), { text: '◆', style: { fg: 'decorative', bold: true } });
  assert.throws(() => scheduleMark('soon'), RangeError);
  assert.throws(() => scheduleMark('result', { outcome: 'nope' }), RangeError);
  assert.throws(() => scheduleMark('firing', { lit: 1 }), TypeError);
});

test('state cells, the pointer and the plate spine', () => {
  assert.deepEqual(one(stateCell('live')), { text: '█', style: { fg: 'accent' } });
  assert.deepEqual(one(stateCell('off')), { text: '█', style: { fg: BOARD_INKS.faint } });
  assert.throws(() => stateCell('warning'), RangeError);
  assert.deepEqual(one(pointer()), { text: '▶', style: { fg: 'primary' } });
  assert.deepEqual(one(pointer({ bold: true })), { text: '▶', style: { fg: 'primary', bold: true } });
  assert.deepEqual(one(spine('#95b8d1')), { text: '▌', style: { fg: '#95b8d1' } });
  assert.throws(() => spine('acid'), TypeError);
});

test('plain output keeps every shape: color is never the only cue', () => {
  for (const outcome of Object.keys(RUN_MARKS)) {
    const line = runMark(outcome);
    assert.equal(paint(line, 'truecolor').replace(/\x1b\[[0-9;]*m/g, ''), paint(line, 'none'));
  }
  assert.notEqual(paint(runMark('succeeded'), 'none'), paint(runMark('cancelled'), 'none'));
  assert.notEqual(paint(runMark('failed'), 'none'), paint(runMark('interrupted'), 'none'));
});
