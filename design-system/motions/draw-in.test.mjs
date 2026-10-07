import test from 'node:test';
import assert from 'node:assert/strict';
import { lineWidth, paint, span } from '../foundation/cells.mjs';
import { labelPlate } from '../elements/label-plate/label-plate.mjs';
import { gauge } from '../elements/gauge/gauge.mjs';
import { statusRow } from '../elements/status-row/status-row.mjs';
import { drawIn, drawInDuration, DRAW_IN_DEFAULTS } from './draw-in.mjs';

const plain = (lines) => lines.map((l) => paint(l, 'none'));
const color = (lines) => lines.map((l) => paint(l, 'truecolor'));
const strip = (lines) => color(lines).map((l) => l.replace(/\x1b\[[0-9;]*m/g, ''));
const cellsOf = (line) => line.flatMap((s) => [...s.text].map((ch) => ({ ch, fg: s.style.fg ?? 'secondary', bg: s.style.bg ?? 'field', bold: s.style.bold ?? false })));
const row = (text, style = {}) => [span(text, style)];
function specimen(width) {
  return [
    [...labelPlate('BAY 04', { tone: 'accent', maxWidth: width })],
    ...gauge({ label: 'FILL', value: 42.5 }, { width }),
    ...statusRow({ label: 'DOOR', value: 'closed', status: 'success' }, { width }),
    ...statusRow({ label: 'FEED', value: 'retries', status: 'warning' }, { width }),
    ...statusRow({ label: 'PARSE', value: 'failed', status: 'error' }, { width }),
  ];
}
// L: the latched front (bold black on acid); _: blank field ahead of the front; otherwise the settled character.
const marks = (lines) => lines.map((line) => cellsOf(line).map((c) => (c.fg === 'field' && c.bg === 'accent' && c.bold ? 'L' : c.ch === ' ' && c.fg === 'secondary' && c.bg === 'field' && !c.bold ? '_' : c.ch)).join(''));

test('drawIn: motion-off returns the input and needs no time', () => {
  const lines = specimen(48);
  for (const off of [{ animate: false }, { animate: false, time: 5 }]) {
    const out = drawIn(lines, off);
    assert.deepEqual(color(out), color(lines));
    assert.notEqual(out, lines);
    assert.notEqual(out[0], lines[0]);
  }
  assert.deepEqual({ ...DRAW_IN_DEFAULTS }, { tick: 50, cells: 3, lag: 50 });
});

test('drawIn: the USG row boot frame by frame (footer.ts:1311-1313)', () => {
  // footer.ts:1312: on tick k the top front has reached (k + 1) * 3 cells and the text row k * 3, one tick behind.
  // footer.ts:1313: cells at or past the front are blank field, the three before it LOCKED, the rest settled.
  const lines = [row('ABCDEFGHIJ', { fg: 'primary' }), row('abcdefghij', { fg: 'decorative' })];
  const at = (time) => marks(drawIn(lines, { time }));
  assert.deepEqual(at(0), ['LLL_______', '__________']);
  assert.deepEqual(at(49), ['LLL_______', '__________']);
  assert.deepEqual(at(50), ['ABCLLL____', 'LLL_______']);
  assert.deepEqual(at(100), ['ABCDEFLLL_', 'abcLLL____']);
  assert.deepEqual(at(150), ['ABCDEFGHIL', 'abcdefLLL_']);
  assert.deepEqual(at(200), ['ABCDEFGHIJ', 'abcdefghiL']);
  assert.equal(drawInDuration(lines), 250);
  assert.deepEqual(at(249), ['ABCDEFGHIJ', 'abcdefghiL']);
  assert.deepEqual(color(drawIn(lines, { time: 250 })), color(lines));
  assert.deepEqual(color(drawIn(lines, { time: 1e9 })), color(lines));
  // The front shows each cell's current character, and blank cells latch too.
  const spaced = [row('A  B', { fg: 'primary' })];
  const front = drawIn(spaced, { time: 0 })[0];
  assert.equal(paint(front, 'none'), 'A   ');
  assert.deepEqual(cellsOf(front).slice(0, 3).map((c) => [c.ch, c.fg, c.bg, c.bold]), [['A', 'field', 'accent', true], [' ', 'field', 'accent', true], [' ', 'field', 'accent', true]]);
});

test('drawInDuration matches status-bar USAGE_BOOT_TICKS for its widest 78-cell row (27 ticks, 1350 ms)', () => {
  // footer.ts:387: ceil(78 / 3) + 1 ticks, the +1 being the text row's lag.
  const lines = [row('x'.repeat(78)), row('y'.repeat(78))];
  assert.equal(drawInDuration(lines), 27 * 50);
  assert.equal(drawInDuration([]), 0);
  assert.equal(drawInDuration([[]]), 0);
  assert.equal(drawInDuration([row('abc'), [], row('abcdef')]), 2 * 50 + 2 * 50);
  assert.equal(drawInDuration(lines, { tick: 10, cells: 6, lag: 0 }), 130);
  // A narrower line below settles no later than the line above.
  assert.equal(drawInDuration([row('x'.repeat(30)), row('y'.repeat(3))]), 500);
});

test('drawIn: lag and cells options; lag 0 sweeps every line together', () => {
  const lines = [row('abcdef'), row('ghijkl'), row('mnopqr')];
  assert.deepEqual(marks(drawIn(lines, { time: 0, lag: 0, cells: 2 })), ['LL____', 'LL____', 'LL____']);
  assert.deepEqual(marks(drawIn(lines, { time: 100, lag: 100, cells: 2, tick: 40 })), ['abcdLL', 'LL____', '______']);
});

test('drawIn never blanks or latches warning and critical cells', () => {
  const line = [span('ab', { fg: 'secondary' }), span('▲ WARN', { fg: 'warning', bold: true }), span('ERR', { bg: 'critical', fg: 'field' })];
  const out = drawIn([line], { time: 0 })[0];
  assert.equal(paint(out, 'none'), 'ab▲ WARNERR');
  assert.deepEqual(cellsOf(out).slice(2).map((c) => c.fg), ['warning', 'warning', 'warning', 'warning', 'warning', 'warning', 'field', 'field', 'field']);
  const [errRow] = statusRow({ label: 'PARSE', value: 'failed', status: 'error' }, { width: 48 });
  assert.ok(paint(drawIn([errRow], { time: 0 })[0], 'none').endsWith('✕ ERROR'));
});

test('drawIn frames are deterministic, keep the input, and keep every line at its exact width', () => {
  for (const width of [1, 2, 3, 7, 23, 24, 40, 48, 100, 160]) {
    const lines = specimen(width);
    const before = JSON.stringify(lines);
    const end = drawInDuration(lines);
    for (const time of [0, 1, 49, 50, 333, 600, end - 1, end, 99999].filter((t) => t >= 0)) {
      const out = drawIn(lines, { time });
      assert.deepEqual(out, drawIn(lines, { time }));
      assert.equal(out.length, lines.length);
      out.forEach((line, i) => assert.equal(lineWidth(line), lineWidth(lines[i]), `width ${width} t=${time} line ${i}`));
      assert.deepEqual(strip(out), plain(out));
      // Every drawn character is the current one or a blank.
      plain(out).forEach((text, i) => [...text].forEach((ch, j) => assert.ok(ch === ' ' || ch === [...plain(lines)[i]][j])));
    }
    assert.deepEqual(color(drawIn(lines, { time: end })), color(lines));
    assert.equal(JSON.stringify(lines), before, 'input not mutated');
  }
});

test('drawIn rejects invalid options and lines', () => {
  const bad = [{ tick: 0 }, { tick: -1 }, { tick: '50' }, { tick: 60001 }, { cells: 0 }, { cells: 1.5 }, { cells: 1001 }, { lag: -1 }, { lag: Number.NaN }];
  for (const options of bad) {
    assert.throws(() => drawIn([row('x')], { time: 0, ...options }), RangeError, JSON.stringify(options));
    assert.throws(() => drawIn([row('x')], { animate: false, ...options }), RangeError);
    assert.throws(() => drawInDuration([row('x')], options), RangeError);
  }
  for (const time of [undefined, -1, Number.NaN, Infinity, '0']) assert.throws(() => drawIn([row('x')], { time }), RangeError);
  assert.throws(() => drawIn([row('x')], { time: 0, speed: 3 }), TypeError);
  assert.throws(() => drawInDuration([row('x')], { region: {} }), TypeError);
  for (const lines of [null, 'abc', [null], [[{ text: 5 }]]]) {
    assert.throws(() => drawIn(lines, { time: 0 }), TypeError);
    assert.throws(() => drawInDuration(lines), TypeError);
  }
  assert.deepEqual(drawIn([], { time: 0 }), []);
  assert.deepEqual(drawIn([[]], { time: 0 }), [[]]);
});
