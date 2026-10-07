import test from 'node:test';
import assert from 'node:assert/strict';
import { stripVTControlCharacters } from 'node:util';
import { GLYPHS, lineWidth, paint } from '../../foundation/cells.mjs';
import { RAIL_MARKS, threadRail, threadRailPieces, threadRailSpans } from './thread-rail.mjs';

const text = (lines) => lines.map((l) => paint(l, 'none'));
const allowed = (s) => [...s].every((c) => (c >= ' ' && c <= '~') || GLYPHS.includes(c));
const cellsOf = (line) => line.flatMap((s) => [...s.text].map((ch) => ({ ch, ...s.style })));

test('the full rail matches status-bar: lamp, blank, ROOT, six marks and the AU badge', () => {
  // pi/status-bar/test/footer.test.ts wide snapshot: `ROOT  █·█·█·······   03 AU` after the lamp cell.
  // footer.ts group(): [lamp, ' ', ...root, ' ', ...rail, ' ', ...badge].
  assert.equal(paint(threadRailSpans({ working: true, units: 3 }), 'none'), '█  ROOT  █·█·█·······  03 AU ');
  assert.equal(lineWidth(threadRailSpans({ working: true, units: 3 })), 29);
  for (const units of [0, 1, 3, 6, 7, 99, null]) {
    const marks = text([threadRailPieces({ working: false, units })[2]])[0];
    const shown = Math.min(RAIL_MARKS, units ?? 0);
    assert.equal(marks, '█·'.repeat(shown) + '··'.repeat(RAIL_MARKS - shown), `units ${units}: six marks max, never invented`);
  }
});

test('lamp, ROOT and badge styles follow the footer', () => {
  const cells = cellsOf(threadRailSpans({ working: true, units: 3 }));
  assert.deepEqual([cells[0].ch, cells[0].bg], ['█', 'accent']);
  assert.ok(cells.slice(2, 8).every((c) => c.fg === 'field' && c.bg === 'accent' && c.bold), 'ROOT is bright');
  assert.ok(cells.slice(9, 21).every((c) => (c.ch === '█' ? c.fg === 'accent' : c.fg === 'decorative')), 'acid marks, grey dots');
  assert.ok(cells.slice(22).every((c) => c.fg === 'field' && c.bg === 'primary'), 'known badge is black on white');
  assert.equal(cellsOf(threadRailSpans({ working: false, units: 0 }))[0].bg, 'surface', 'idle lamp');
  assert.ok(cellsOf(threadRailSpans({ working: false, units: 0 })).slice(2, 8).every((c) => c.bg === 'accent'), 'ROOT stays bright while idle');
});

test('unknown activity: hatched lamp and ? AU, never zero', () => {
  // footer.test.ts: absent activity shows `╱` graphic on surface, `  ? AU ` and twelve dots.
  for (const activity of [undefined, null]) {
    const [line] = text([threadRailSpans(activity)]);
    assert.equal(line, '╱  ROOT  ············   ? AU ');
  }
  const unknownUnits = text([threadRailSpans({ working: true, units: null })])[0];
  assert.match(unknownUnits, / {2}\? AU $/);
  assert.notEqual(unknownUnits, text([threadRailSpans({ working: true, units: 0 })])[0]);
});

test('large counts stay exact and widen the badge', () => {
  assert.equal(text([threadRailSpans({ working: true, units: 120 })])[0], '█  ROOT  █·█·█·█·█·█·  120 AU ');
  assert.equal(text([threadRailSpans({ working: true, units: Number.MAX_SAFE_INTEGER })])[0].endsWith(' 9007199254740991 AU '), true);
});

test('marks yield first, then the rail wraps; nothing is clipped while it fits', () => {
  const a = { working: true, units: 12 };
  assert.deepEqual(text(threadRail(a, { width: 29 })), ['█  ROOT  █·█·█·█·█·█·  12 AU ']);
  assert.deepEqual(text(threadRail(a, { width: 28 })), ['█  ROOT   12 AU             ']);
  assert.deepEqual(text(threadRail(a, { width: 16 })), ['█  ROOT   12 AU ']);
  // footer.test.ts minimal snapshot at 30 columns is `█  ROOT   03 AU`: the footer's minimal layout never draws
  // marks; that is the marks-free rail. The standalone rail keeps its marks whenever they fit.
  assert.equal(paint(threadRailSpans({ working: true, units: 3 }, { marks: false }), 'none'), '█  ROOT   03 AU ');
  assert.equal(text(threadRail({ working: true, units: 3 }, { width: 30 }))[0], '█  ROOT  █·█·█·······  03 AU  ');
  assert.deepEqual(text(threadRail(a, { width: 15 })), ['█  ROOT        ', ' 12 AU         ']);
  assert.deepEqual(text(threadRail(a, { width: 8 })), ['█  ROOT ', ' 12 AU  ']);
  assert.deepEqual(text(threadRail(a, { width: 6 })), ['█     ', ' ROOT ', '12 AU ']);
  assert.deepEqual(text(threadRail(a, { width: 1 })), ['█', 'R', '#']);
  assert.deepEqual(text(threadRail(a, { width: 40, align: 'right' })), [' '.repeat(11) + '█  ROOT  █·█·█·█·█·█·  12 AU ']);
});

test('every width from 1 to 160 is exact, curated, and keeps the count or #', () => {
  for (let width = 1; width <= 160; width++) {
    for (const activity of [undefined, { working: true, units: 0 }, { working: false, units: 12 }, { working: true, units: 123456 }, { working: true, units: null }]) {
      for (const align of ['left', 'right']) {
        const lines = threadRail(activity, { width, align });
        for (const line of lines) {
          assert.equal(lineWidth(line), width, `${width}`);
          assert.ok(allowed(paint(line, 'none')));
          assert.equal(stripVTControlCharacters(paint(line, 'truecolor')), paint(line, 'none'));
        }
        const all = text(lines).join('\n');
        if (width >= 4) assert.match(all, /AU|#/, `${width}: badge`);
        assert.match(all, /R/, `${width}: ROOT`);
      }
    }
  }
});

test('invalid activity throws instead of becoming unknown', () => {
  for (const units of [-1, 1.5, Number.NaN, Infinity]) assert.throws(() => threadRail({ working: true, units }, { width: 40 }), RangeError, String(units));
  assert.throws(() => threadRail({ working: true, units: '3' }, { width: 40 }), RangeError);
  assert.throws(() => threadRail({ working: 'yes', units: 3 }, { width: 40 }), TypeError);
  assert.throws(() => threadRail(3, { width: 40 }), TypeError);
  assert.throws(() => threadRail(undefined, { width: 0 }), RangeError);
  assert.throws(() => threadRail(undefined, { width: 40, align: 'center' }), RangeError);
  assert.throws(() => threadRailPieces(undefined, { marks: 'no' }), TypeError);
});
