import test from 'node:test';
import assert from 'node:assert/strict';
import { lineWidth, paint, span } from '../foundation/cells.mjs';
import { labelPlate } from '../elements/label-plate/label-plate.mjs';
import { gauge } from '../elements/gauge/gauge.mjs';
import { statusRow } from '../elements/status-row/status-row.mjs';
import { cycle, CYCLE_DEFAULTS } from './cycle.mjs';

const plain = (lines) => lines.map((l) => paint(l, 'none'));
const color = (lines) => lines.map((l) => paint(l, 'truecolor'));
const strip = (lines) => color(lines).map((l) => l.replace(/\x1b\[[0-9;]*m/g, ''));
const styles = (lines) => lines.map((line) => line.flatMap((s) => [...s.text].map(() => JSON.stringify(s.style))));
const row = (text, style = {}) => [span(text, style)];
function specimen(width) {
  return [
    [...labelPlate('BAY 04', { tone: 'accent', maxWidth: width })],
    ...gauge({ label: 'FILL', value: 42.5 }, { width }),
    ...statusRow({ label: 'DOOR', value: 'closed', status: 'success' }, { width }),
    ...statusRow({ label: 'LINK', value: 'checking', status: 'neutral' }, { width }),
    ...statusRow({ label: 'FEED', value: 'retries', status: 'warning' }, { width }),
    [span('TCLI · CHK  AWKS · CHK'.slice(0, width), { fg: 'decorative' })],
  ];
}
// A checking Tatsu component (footer.ts:1194-1204): grey label, grey `·` shape, grey code.
const CHECKING = [[span('TCLI ', { fg: 'decorative' }), span('·', { fg: 'decorative', bold: true }), span(' CHK', { fg: 'decorative', bold: true })]];

test('cycle: motion-off returns the input and needs no time', () => {
  const lines = specimen(48);
  for (const off of [{ animate: false }, { animate: false, time: 150 }]) {
    const out = cycle(lines, off);
    assert.deepEqual(color(out), color(lines));
    assert.notEqual(out, lines);
  }
  assert.deepEqual({ ...CYCLE_DEFAULTS, glyphs: [...CYCLE_DEFAULTS.glyphs] }, { glyphs: ['·', '•', '•', '•', '·'], step: 150, region: undefined });
});

test('cycle: the checking placeholder steps every 150 ms, as Tatsu (footer.ts:391, 747, 1199)', () => {
  // footer.ts:747: tatsuCheck = floor(elapsed / 150); 1199: TATSU_CHECK_GLYPHS[tatsuCheck % 5].
  const shapeAt = (time) => plain(cycle(CHECKING, { time }))[0][5];
  assert.deepEqual([0, 149, 150, 300, 450, 600, 749, 750, 900].map(shapeAt), ['·', '·', '•', '•', '•', '·', '·', '·', '•']);
  for (let time = 0; time < 1500; time += 50) {
    const out = cycle(CHECKING, { time });
    assert.equal(plain(out)[0].replace('•', '·'), 'TCLI · CHK');
    assert.deepEqual(styles(out), styles(CHECKING), 'size and glyph only');
  }
});

test('cycle: only cells showing one of the glyphs, inside the region, change', () => {
  const lines = [row('a·b•c', { fg: 'decorative' }), row('··', { fg: 'decorative' })];
  assert.deepEqual(plain(cycle(lines, { time: 150 })), ['a•b•c', '••']);
  assert.deepEqual(plain(cycle(lines, { time: 0 })), ['a·b·c', '··']);
  assert.deepEqual(plain(cycle(lines, { time: 150, region: { top: 1, left: 1 } })), ['a·b•c', '·•']);
  assert.deepEqual(plain(cycle(lines, { time: 20, glyphs: ['·', '▪', '■'], step: 10 })), ['a■b•c', '■■']);
});

test('cycle never changes warning or critical cells', () => {
  const lines = [[span('·', { fg: 'warning' }), span('·', { fg: 'decorative' }), span('•', { bg: 'critical', fg: 'field' })]];
  assert.equal(plain(cycle(lines, { time: 150 }))[0], '·••');
  assert.equal(plain(cycle(lines, { time: 0 }))[0], '··•');
});

test('cycle frames are deterministic, keep the input and styles, and keep every line at its exact width', () => {
  for (const width of [1, 2, 3, 7, 23, 24, 40, 48, 100, 160]) {
    const lines = specimen(width);
    const before = JSON.stringify(lines);
    for (const time of [0, 149, 150, 600, 750, 99999]) {
      const out = cycle(lines, { time });
      assert.deepEqual(out, cycle(lines, { time }));
      out.forEach((line, i) => assert.equal(lineWidth(line), lineWidth(lines[i]), `width ${width} t=${time} line ${i}`));
      assert.deepEqual(plain(out).map((l) => l.replaceAll('•', '·')), plain(lines).map((l) => l.replaceAll('•', '·')));
      assert.deepEqual(strip(out), plain(out));
    }
    assert.equal(JSON.stringify(lines), before);
  }
});

test('cycle rejects invalid options and lines', () => {
  const bad = [[{ glyphs: [] }, RangeError], [{ glyphs: '·•' }, RangeError], [{ glyphs: ['A'] }, RangeError], [{ glyphs: ['··'] }, RangeError],
    [{ glyphs: [' '] }, RangeError], [{ glyphs: Array(1001).fill('·') }, RangeError], [{ step: 0 }, RangeError], [{ step: '150' }, RangeError],
    [{ region: { top: 1.5 } }, RangeError], [{ region: null }, TypeError], [{ period: 750 }, TypeError]];
  for (const [options, kind] of bad) {
    assert.throws(() => cycle([row('x')], { time: 0, ...options }), kind, JSON.stringify(options).slice(0, 60));
    assert.throws(() => cycle([row('x')], { animate: false, ...options }), kind);
  }
  for (const time of [undefined, -1, Number.NaN, Infinity]) assert.throws(() => cycle([row('x')], { time }), RangeError);
  for (const lines of [null, 'abc', [null], [[{ text: 5 }]]]) assert.throws(() => cycle(lines, { time: 0 }), TypeError);
  assert.deepEqual(cycle([], { time: 0 }), []);
});
