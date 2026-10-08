import test from 'node:test';
import assert from 'node:assert/strict';
import { lineWidth, paint, resolveColor, span } from '../foundation/cells.mjs';
import { labelPlate } from '../elements/label-plate/label-plate.mjs';
import { gauge } from '../elements/gauge/gauge.mjs';
import { statusRow } from '../elements/status-row/status-row.mjs';
import { fade, FADE_DEFAULTS } from './fade.mjs';

const plain = (lines) => lines.map((l) => paint(l, 'none'));
const color = (lines) => lines.map((l) => paint(l, 'truecolor'));
const strip = (lines) => color(lines).map((l) => l.replace(/\x1b\[[0-9;]*m/g, ''));
const cellsOf = (line) => line.flatMap((s) => [...s.text].map((ch) => ({ ch, fg: s.style.fg ?? 'secondary', bg: s.style.bg ?? 'field', bold: s.style.bold ?? false })));
const hex = (c) => resolveColor(c).toLowerCase();
const row = (text, style = {}) => [span(text, style)];
function specimen(width) {
  return [
    [...labelPlate('BAY 04', { tone: 'accent', maxWidth: width })],
    ...gauge({ label: 'FILL', value: 42.5 }, { width }),
    ...gauge({ label: 'LINK', value: null }, { width }),
    ...statusRow({ label: 'FEED', value: 'retries', status: 'warning' }, { width }),
    ...statusRow({ label: 'PARSE', value: 'failed', status: 'error' }, { width }),
  ];
}
// status-bar's checking fade levels (footer.ts:103 TATSU_CHECK_FADE_LEVELS), copied here as the reference.
const LEVELS = ['#717171', '#7b7b7b', '#868686', '#919191', '#9c9c9c', '#919191', '#868686', '#7b7b7b'];
const CODE = [[span('TCLI ', { fg: 'decorative' }), span('· ', { fg: 'structural', bold: true }), span('CHK', { fg: 'decorative', bold: true })]];

test('fade: motion-off returns the input and needs no time', () => {
  const lines = specimen(48);
  for (const off of [{ animate: false }, { animate: false, time: 450 }]) {
    const out = fade(lines, off);
    assert.deepEqual(color(out), color(lines));
    assert.notEqual(out, lines);
  }
  assert.deepEqual(FADE_DEFAULTS.levels.map(hex), LEVELS);
  assert.equal(FADE_DEFAULTS.period, 1200);
  assert.deepEqual([...FADE_DEFAULTS.roles], ['decorative']);
});

test('fade: the eight-step check fade, 150 ms a step, as Tatsu (footer.ts:390, 747, 1196)', () => {
  // footer.ts:1196: TATSU_CHECK_FADE_INKS[tatsuCheck % 8], tatsuCheck = floor(elapsed / 150).
  for (let k = 0; k < 24; k++) {
    for (const time of [k * 150, k * 150 + 149]) {
      const cells = cellsOf(fade(CODE, { time, region: { left: 7 } })[0]);
      assert.deepEqual(cells.slice(7).map((c) => hex(c.fg)), Array(3).fill(LEVELS[k % 8]), `t=${time}`);
      assert.ok(cells.slice(7).every((c) => c.bold), 'bold kept');
      assert.deepEqual(cells.slice(0, 7).map((c) => c.fg), [...Array(5).fill('decorative'), 'structural', 'structural'], 'label and shape stay put');
    }
  }
  assert.deepEqual(color(fade(CODE, { time: 0 })), color(CODE), 'time 0 equals the input');
});

test('fade: roles, levels and period options; warning and critical never fade', () => {
  const lines = [[span('ab', { fg: 'secondary' }), span('cd', { fg: 'decorative' }), span(' ', { fg: 'secondary' }), span('W', { fg: 'warning' }), span('E', { fg: 'field', bg: 'critical' })]];
  const fgs = (o) => cellsOf(fade(lines, o)[0]).map((c) => c.fg);
  assert.deepEqual(fgs({ time: 600 }), ['secondary', 'secondary', '#9c9c9c', '#9c9c9c', 'secondary', 'warning', 'field']);
  assert.deepEqual(fgs({ time: 50, roles: ['secondary'], levels: ['primary', '#123456'], period: 100 }), ['#123456', '#123456', 'decorative', 'decorative', 'secondary', 'warning', 'field']);
  assert.deepEqual(fgs({ time: 0, roles: ['secondary', 'field'], levels: ['primary'] }), ['primary', 'primary', 'decorative', 'decorative', 'secondary', 'warning', 'field']);
});

test('fade frames are deterministic, keep the input and characters, and keep every line at its exact width', () => {
  for (const width of [1, 2, 3, 7, 23, 24, 40, 48, 100, 160]) {
    const lines = specimen(width);
    const before = JSON.stringify(lines);
    for (const time of [0, 149, 150, 600, 1199, 1200, 99999]) {
      const out = fade(lines, { time, roles: ['decorative', 'secondary', 'accent'] });
      assert.deepEqual(out, fade(lines, { time, roles: ['decorative', 'secondary', 'accent'] }));
      out.forEach((line, i) => assert.equal(lineWidth(line), lineWidth(lines[i]), `width ${width} t=${time} line ${i}`));
      assert.deepEqual(plain(out), plain(lines));
      assert.deepEqual(strip(out), plain(out));
    }
    assert.equal(JSON.stringify(lines), before);
  }
});

test('fade rejects invalid options and lines', () => {
  const bad = [[{ levels: [] }, RangeError], [{ levels: ['#fff'] }, RangeError], [{ levels: ['nope'] }, RangeError], [{ levels: 'decorative' }, RangeError],
    [{ period: 0 }, RangeError], [{ period: 60001 }, RangeError], [{ roles: [] }, RangeError], [{ roles: ['warning'] }, RangeError],
    [{ roles: ['decorative', 'critical'] }, RangeError], [{ roles: ['#717171'] }, RangeError], [{ region: { rows: 'a' } }, RangeError], [{ step: 150 }, TypeError]];
  for (const [options, kind] of bad) {
    assert.throws(() => fade([row('x')], { time: 0, ...options }), kind, JSON.stringify(options));
    assert.throws(() => fade([row('x')], { animate: false, ...options }), kind);
  }
  for (const time of [undefined, -1, Number.NaN, Infinity]) assert.throws(() => fade([row('x')], { time }), RangeError);
  for (const lines of [null, 'abc', [null], [[{ text: 5 }]]]) assert.throws(() => fade(lines, { time: 0 }), TypeError);
  assert.deepEqual(fade([], { time: 0 }), []);
});

test('fade rejects unresolved terminal-default levels', () => {
  assert.throws(() => fade([[span('A', { fg: 'accent' })]], { time: 0, levels: ['default'] }), TypeError);
});
