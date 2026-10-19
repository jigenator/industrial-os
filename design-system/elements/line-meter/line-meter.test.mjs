import test from 'node:test';
import assert from 'node:assert/strict';
import { lineMeter } from './line-meter.mjs';
import { paint, lineWidth } from '../../foundation/cells.mjs';
import { SIGNAL_COLORS } from '../../foundation/signal-colors.mjs';

const text = (input, options) => paint(lineMeter(input, options), 'none');

test('line meter reproduces sidebar readings, including unknown versus zero', () => {
  for (const [percent, expected] of [
    [0, '─────────── 00%'], [0.9, '─────────── 00%'], [1, '━────────── 01%'],
    [67, '━━━━━━━━─── 67%'], [70, '━━━━━━━━─── 70%'], [90, '━━━━━━━━━━─ 90%'],
    [99, '━━━━━━━━━━━ 99%'], [100, '━━━━━━━━━━━ 99%'], [null, '─────────── --%'],
    [undefined, '─────────── --%'],
  ]) assert.equal(text({ percent }), expected);
});

test('line meter uses inclusive zones, role state inks and nonbold idle override', () => {
  for (const [percent, fg, bold] of [[69.99, 'accent', false], [70, 'warning', false], [89.99, 'warning', false], [90, 'critical', true], [100, 'critical', true]]) {
    assert.deepEqual(lineMeter({ percent })[0].style, { fg, bold });
    assert.deepEqual(lineMeter({ percent, tone: 'idle' })[0].style, { fg: 'decorative', bold: false });
    assert.equal(text({ percent, tone: 'idle' }), text({ percent }));
  }
  assert.equal(lineMeter({ percent: null, tone: 'idle' })[0].style.fg, SIGNAL_COLORS.ghost);
  assert.equal(lineMeter({ percent: 20 }, { zones: { warn: 20, high: 30 } })[0].style.fg, 'warning');
  assert.equal(lineMeter({ percent: 30 }, { zones: { warn: 20, high: 30 } })[0].style.fg, 'critical');
});

test('line meter shortens bar first, recomputes ceil fill, then preserves whole readout', () => {
  const expected = ['', '#', '##', '67%', '67%', '━ 67%', '━━ 67%', '━━━ 67%', '━━━─ 67%'];
  expected.forEach((s, maxWidth) => assert.equal(text({ percent: 67 }, { maxWidth }), s));
  assert.equal(text({ percent: null }, { maxWidth: 3 }), '--%');
  assert.equal(text({ percent: 100 }, { cells: 1 }), '━ 99%');
  assert.equal(text({ percent: 100 }, { cells: 11 }), '━━━━━━━━━━━ 99%');
  assert.equal(text({ percent: 100 }, { cells: 100 }), '━'.repeat(99) + '─ 99%');
  assert.equal(lineWidth(lineMeter({ percent: 100 }, { cells: 1000 })), 1004);
});

test('line meter widths 1–160 preserve readout, plain/color cells, and state shape', () => {
  for (let maxWidth = 1; maxWidth <= 160; maxWidth++) for (const percent of [null, 0, 67, 70, 90, 100]) for (const tone of ['zone', 'idle']) {
    const line = lineMeter({ percent, tone }, { maxWidth });
    assert.ok(lineWidth(line) <= maxWidth);
    assert.equal(paint(line, 'truecolor').replace(/\x1b\[[0-9;]*m/g, ''), paint(line, 'none'));
    if (maxWidth >= 3) assert.ok(paint(line, 'none').endsWith(percent === null ? '--%' : `${Math.min(99, percent).toString().padStart(2, '0')}%`));
  }
});

test('line meter rejects invalid readings, geometry, zones, tones and injected inputs', () => {
  for (const input of [undefined, null, 67, '67', []]) assert.throws(() => lineMeter(input), TypeError);
  for (const options of [null, 11, '11', []]) assert.throws(() => lineMeter({}, options), TypeError);
  for (const percent of [-1, 101, NaN, Infinity, -Infinity]) assert.throws(() => lineMeter({ percent }), RangeError);
  for (const percent of ['67', '\x1b[31m', {}, true]) assert.throws(() => lineMeter({ percent }), TypeError);
  for (const cells of [0, -1, 1.5, 1001, Infinity, '11']) assert.throws(() => lineMeter({}, { cells }), RangeError);
  for (const maxWidth of [-1, 0.5, NaN, '15', null]) assert.throws(() => lineMeter({}, { maxWidth }), RangeError);
  for (const zones of [null, {}, { warn: 70, high: 70 }, { warn: -1, high: 90 }, { warn: 70, high: 101 }, { warn: '70', high: 90 }, { warn: 70, high: Infinity }]) assert.throws(() => lineMeter({}, { zones }), RangeError);
  for (const tone of ['warn', '\x1b[31m', null, {}]) assert.throws(() => lineMeter({ tone }), RangeError);
});
