import test from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS, lineWidth, paint } from '../../foundation/cells.mjs';
import { gauge, gaugeReading, gaugeScale } from './gauge.mjs';

const text = (lines) => lines.map((l) => paint(l, 'none'));
const allowed = (s) => [...s].every((c) => (c >= ' ' && c <= '~') || GLYPHS.includes(c));
const bar = (line) => line.slice(9, -8); // label column 9 cells, readout column ' ' + 7 cells

test('known value: floored 1/8-cell fill and white readout', () => {
  // width 50 -> bar 33 cells; 64% of 33 = 21.12 cells -> 21 full + 0 eighths (0.96/8 floors to 0)
  const [line] = text(gauge({ label: 'KNOWN', value: 64 }, { width: 50 }));
  assert.equal(line, `KNOWN    ${'█'.repeat(21)}${'░'.repeat(12)}  64.0 %`);
  // 42.5% of 33 = 14.025 cells; 42.5% of 32 = 13.6 cells -> 13 full + ▌ (4/8)
  const [half] = text(gauge({ label: 'FILL', value: 42.5 }, { width: 49 }));
  assert.equal(bar(half), '█'.repeat(13) + '▌' + '░'.repeat(18));
});

test('zero, full, and unknown are visibly distinct', () => {
  const [zero, full, unknown] = [0, 100, null].map((value) => text(gauge({ label: 'G', value }, { width: 40 }))[0]);
  assert.equal(bar(zero), '░'.repeat(23));
  assert.ok(zero.endsWith('  0.0 %'));
  assert.equal(bar(full), '█'.repeat(23));
  // Ranges where (max * n * 8) / max floors to n * 8 - 1 in floating point.
  for (const [max, width] of [[0.7, 3], [3.3, 3], [1.1, 15]]) {
    assert.equal(text(gauge({ value: max, max, unit: '' }, { width }))[1], '█'.repeat(width), `full at max ${max}`);
  }
  assert.ok(full.endsWith('100.0 %'));
  assert.equal(bar(unknown), '╱'.repeat(23));
  assert.ok(unknown.endsWith('UNKNOWN'));
  assert.doesNotMatch(unknown, /0\.0|█|░/);
});

test('readout and bar never overstate', () => {
  const [line] = text(gauge({ label: 'G', value: 99.96 }, { width: 40 }));
  assert.ok(line.endsWith(' 99.9 %'));
  assert.notEqual(bar(line), '█'.repeat(23));
  assert.ok(text(gauge({ label: 'G', value: 0.29, decimals: 2 }, { width: 40 }))[0].endsWith('0.29 %'));
});

test('invalid readings are rejected rather than clamped or zeroed', () => {
  for (const value of [Number.NaN, Infinity, -1, 100.01, '50', true]) {
    assert.throws(() => gauge({ value }, { width: 40 }), RangeError, String(value));
  }
  for (const max of [0, -5, Infinity, Number.NaN, '100']) assert.throws(() => gaugeReading({ value: 0, max }), RangeError);
  assert.throws(() => gaugeReading({ value: 0, decimals: 4 }), RangeError);
  assert.throws(() => gauge({ value: 1 }, { width: 0 }), RangeError);
  assert.equal(gaugeReading({ value: undefined }).known, false);
});

test('large finite readings keep finite, bounded text and fill', () => {
  const [line] = text(gauge({ value: 1e307, max: 1e308 }, { width: 60 }));
  assert.ok(line.includes('1e+307 %'));
  assert.doesNotMatch(line, /Infinity|NaN/);
  assert.ok(line.includes('█'));
  assert.ok(line.includes('░'));
  assert.equal(lineWidth(gaugeScale({ max: 1e308 }, { width: 60 })), 60);
});

test('narrow gauges stack, and an unfittable readout shows # instead of a partial number', () => {
  assert.deepEqual(text(gauge({ label: 'LOAD', value: 50 }, { width: 18 })), ['LOAD        50.0 %', '█████████░░░░░░░░░']);
  assert.deepEqual(text(gauge({ label: 'LOAD', value: 50 }, { width: 4 })), ['####', '██░░']);
});

test('every width from 1 to 160 stays within budget with curated glyphs only', () => {
  for (let width = 1; width <= 160; width++) {
    for (const value of [0, 37.5, 100, null]) {
      for (const line of gauge({ label: 'A LONG GAUGE LABEL', value, max: 100, unit: 'kg/h' }, { width })) {
        assert.equal(lineWidth(line), width);
        assert.ok(allowed(paint(line, 'none')));
      }
    }
    assert.equal(lineWidth(gaugeScale({}, { width })), width);
  }
});

test('the scale starts at the bar origin and ends at its full mark', () => {
  const [g] = text(gauge({ label: 'G', value: 100 }, { width: 60 }));
  const scale = paint(gaugeScale({}, { width: 60 }), 'none');
  assert.equal(scale.indexOf('0'), g.indexOf('█'));
  assert.equal(scale.lastIndexOf('100') + 3, g.lastIndexOf('█') + 1);
  assert.match(scale, /0 +╵ +50 +╵ +100/);
});

test('labels and units cannot inject terminal controls', () => {
  const [line] = gauge({ label: '\x1b[2J', value: 1, unit: '\x1b' }, { width: 40 });
  assert.doesNotMatch(paint([line].flat(), 'none'), /\x1b/);
});
