import test from 'node:test';
import assert from 'node:assert/strict';
import { lineWidth, paint, resolveColor, span } from '../foundation/cells.mjs';
import { labelPlate } from '../elements/label-plate/label-plate.mjs';
import { gauge } from '../elements/gauge/gauge.mjs';
import { statusRow } from '../elements/status-row/status-row.mjs';
import { beacon, BEACON_DEFAULTS } from './beacon.mjs';

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
// A behind Tatsu component (footer.ts:1194-1204): its amber `▲` beside an unchanging code.
const BEHIND = [[span('TCLI', { fg: 'decorative' }), span(' '), span('▲', { fg: 'warning', bold: true }), span(' UP×3', { fg: 'warning', bold: true })]];
const shape = (time, o = {}) => {
  const c = cellsOf(beacon(BEHIND, { time, stateCells: true, ...o })[0])[5];
  return `${c.ch} ${resolveColor(c.fg).toLowerCase()}`;
};

test('beacon: motion-off returns the input and needs no time', () => {
  const lines = specimen(48);
  for (const off of [{ animate: false }, { animate: false, time: 3900, stateCells: true }]) {
    const out = beacon(lines, off);
    assert.deepEqual(color(out), color(lines));
    assert.notEqual(out, lines);
  }
  assert.deepEqual({ ...BEACON_DEFAULTS }, { period: 4000, step: 50, region: undefined, stateCells: false });
});

test('beacon: the last 150 ms of each 4000 ms period, as Tatsu (footer.ts:748-749, 1198-1200)', () => {
  // footer.ts:748: beaconAt = elapsed % 4000 - 3850; 1199: ▴ while beacon < 2; 1200: warnDim while beacon > 0.
  assert.equal(shape(0), '▲ #d79e52', 'never opens on a pulse');
  assert.equal(shape(3849), '▲ #d79e52');
  assert.equal(shape(3850), '▴ #d79e52');
  assert.equal(shape(3899), '▴ #d79e52');
  assert.equal(shape(3900), '▴ #6c4f29');
  assert.equal(shape(3950), '▲ #6c4f29');
  assert.equal(shape(3999), '▲ #6c4f29');
  assert.equal(shape(4000), '▲ #d79e52');
  assert.equal(shape(4000 * 25 + 3900), '▴ #6c4f29', 'repeats');
  for (let time = 0; time < 8000; time += 25) {
    const out = beacon(BEHIND, { time, stateCells: true })[0];
    assert.equal(paint(out, 'none').replace('▴', '▲'), 'TCLI ▲ UP×3', 'only the triangle changes');
    assert.deepEqual(cellsOf(out).slice(6).map((c) => c.fg), Array(5).fill('warning'), 'the code keeps its color');
  }
  // Other inks use their own 50% mix.
  const acid = cellsOf(beacon([row('▲', { fg: 'accent' })], { time: 3900 })[0])[0];
  assert.deepEqual([acid.ch, acid.fg], ['▴', '#607f02']);
});

test('beacon: warning and critical cells are exempt by default; a region limits the cells', () => {
  assert.deepEqual(color(beacon(BEHIND, { time: 3900 })), color(BEHIND));
  const lines = [row('▲ ▲', { fg: 'accent' }), row('▲', { fg: 'accent' })];
  const out = beacon(lines, { time: 3850, region: { top: 0, left: 1 } });
  assert.deepEqual(plain(out), ['▲ ▴', '▲']);
  // A dim ink equal to the background would hide the glyph; it then only resizes.
  const hidden = [[span('▲', { fg: 'warning', bg: '#6c4f29' })]];
  assert.deepEqual(cellsOf(beacon(hidden, { time: 3900, stateCells: true })[0])[0], { ch: '▴', fg: 'warning', bg: '#6c4f29', bold: false });
  // The status row's warning marker beacons when opted in, with its word intact.
  const [warnRow] = statusRow({ label: 'FEED', value: 'retries', status: 'warning' }, { width: 48 });
  assert.ok(paint(beacon([warnRow], { time: 3900, stateCells: true })[0], 'none').endsWith('▴ WARN '));
});

test('beacon: period and step options', () => {
  const lines = [row('▲', { fg: 'accent' })];
  const at = (time) => plain(beacon(lines, { time, period: 300, step: 100 }))[0] + cellsOf(beacon(lines, { time, period: 300, step: 100 })[0])[0].fg;
  assert.deepEqual([0, 99, 100, 200, 299, 300].map(at), ['▴accent', '▴accent', '▴#607f02', '▲#607f02', '▲#607f02', '▴accent']);
});

test('beacon frames are deterministic, keep the input, and keep every line at its exact width', () => {
  for (const width of [1, 2, 3, 7, 23, 24, 40, 48, 100, 160]) {
    const lines = specimen(width);
    const before = JSON.stringify(lines);
    for (const stateCells of [false, true]) {
      for (const time of [0, 3849, 3850, 3900, 3950, 3999, 4000, 123456]) {
        const out = beacon(lines, { time, stateCells });
        assert.deepEqual(out, beacon(lines, { time, stateCells }));
        out.forEach((line, i) => assert.equal(lineWidth(line), lineWidth(lines[i]), `width ${width} t=${time} line ${i}`));
        assert.deepEqual(plain(out).map((l) => l.replaceAll('▴', '▲')), plain(lines));
        assert.deepEqual(strip(out), plain(out));
      }
    }
    assert.equal(JSON.stringify(lines), before);
  }
});

test('beacon rejects invalid options and lines', () => {
  const bad = [[{ period: 0 }, RangeError], [{ period: 149 }, RangeError], [{ period: 60001 }, RangeError], [{ step: 0 }, RangeError],
    [{ step: '50' }, RangeError], [{ stateCells: 'yes' }, TypeError], [{ region: { cols: -1 } }, RangeError], [{ region: 'a' }, TypeError], [{ glyph: '▲' }, TypeError]];
  for (const [options, kind] of bad) {
    assert.throws(() => beacon([row('x')], { time: 0, ...options }), kind, JSON.stringify(options));
    assert.throws(() => beacon([row('x')], { animate: false, ...options }), kind);
  }
  assert.doesNotThrow(() => beacon([row('▲')], { time: 0, period: 3, step: 1 }));
  for (const time of [undefined, -1, Number.NaN, Infinity]) assert.throws(() => beacon([row('x')], { time }), RangeError);
  for (const lines of [null, 'abc', [null], [[{ text: 5 }]]]) assert.throws(() => beacon(lines, { time: 0 }), TypeError);
  assert.deepEqual(beacon([], { time: 3900 }), []);
});

test('beacon rejects terminal-default foreground when dimming needs RGB', () => {
  const lines = [[span('▲', { fg: 'default', bg: 'default' })]];
  assert.throws(() => beacon(lines, { time: 3900 }), TypeError);
  assert.deepEqual(beacon(lines, { animate: false }), lines);
  assert.equal(beacon([[span('▲', { fg: 'accent', bg: 'default' })]], { time: 3900 })[0][0].style.bg, 'default');
});

test('beacon preserves opted-in state cues on an unknown terminal-default background', () => {
  const lines = [[span('▲', { fg: 'warning', bg: 'default' })]];
  assert.doesNotThrow(() => beacon(lines, { time: 3900, stateCells: true }));
});
