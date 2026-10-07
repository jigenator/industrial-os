import test from 'node:test';
import assert from 'node:assert/strict';
import { lineWidth, paint, span } from '../foundation/cells.mjs';
import { labelPlate } from '../elements/label-plate/label-plate.mjs';
import { gauge } from '../elements/gauge/gauge.mjs';
import { statusRow } from '../elements/status-row/status-row.mjs';
import { latch, latchDuration, LATCH_DEFAULTS } from './latch.mjs';

const plain = (lines) => lines.map((l) => paint(l, 'none'));
const color = (lines) => lines.map((l) => paint(l, 'truecolor'));
const strip = (lines) => color(lines).map((l) => l.replace(/\x1b\[[0-9;]*m/g, ''));
const cellsOf = (line) => line.flatMap((s) => [...s.text].map((ch) => ({ ch, fg: s.style.fg ?? 'secondary', bg: s.style.bg ?? 'field', bold: s.style.bold ?? false })));
const looks = (line) => cellsOf(line).map((c) => `${c.fg}/${c.bg}${c.bold ? '!' : ''}`);
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
// One Tatsu component (footer.ts:1194-1204): dim label, then shape, ink space and code in the state color.
const component = (ink) => [[span('TCLI', { fg: 'decorative' }), span(' '), span(ink === 'accent' ? '•' : '▲', { fg: ink, bold: true }), span(' ', { fg: ink, bold: true }), span(ink === 'accent' ? 'OK' : 'FIX', { fg: ink, bold: true })]];
const STATE = { left: 5 };

test('latch: motion-off returns the input and needs no time', () => {
  const lines = specimen(48);
  for (const off of [{ animate: false }, { animate: false, time: 5, stateCells: true }]) {
    const out = latch(lines, off);
    assert.deepEqual(color(out), color(lines));
    assert.notEqual(out, lines);
  }
  assert.deepEqual({ ...LATCH_DEFAULTS }, { lock: 50, invert: 100, region: undefined, stateCells: false });
  assert.equal(latchDuration(), 150);
  assert.equal(latchDuration({ lock: 0, invert: 40 }), 40);
});

test('latch: tick 0 LOCKED, ticks 1-2 inverted, then settled, as Tatsu (footer.ts:1195, 741-745)', () => {
  for (const ink of ['accent', 'warning']) {
    const lines = component(ink);
    const at = (time) => looks(latch(lines, { time, region: STATE, stateCells: true })[0]);
    const label = ['decorative/field', 'decorative/field', 'decorative/field', 'decorative/field', 'secondary/field'];
    assert.deepEqual(at(0), [...label, ...Array(ink === 'accent' ? 4 : 5).fill('field/accent!')]);
    assert.deepEqual(at(49), at(0));
    assert.deepEqual(at(50), [...label, ...Array(ink === 'accent' ? 4 : 5).fill(`field/${ink}!`)]);
    assert.deepEqual(at(149), at(50));
    assert.deepEqual(color(latch(lines, { time: 150, region: STATE, stateCells: true })), color(lines));
    for (const time of [0, 50, 100, 149, 150]) assert.deepEqual(plain(latch(lines, { time, region: STATE, stateCells: true })), plain(lines));
  }
});

test('latch: warning and critical cells are exempt by default; opted in, their cue stays readable', () => {
  const lines = component('warning');
  assert.deepEqual(color(latch(lines, { time: 0, region: STATE })), color(lines));
  assert.deepEqual(color(latch(lines, { time: 60, region: STATE })), color(lines));
  // A filled state plate inverts to its letters in the state color on the field.
  const plate = [labelPlate('FAULT', { tone: 'critical' })];
  const inverted = cellsOf(latch(plate, { time: 60, stateCells: true })[0]);
  assert.deepEqual(inverted.slice(1, 8).map((c) => `${c.fg}/${c.bg}`), Array(7).fill('critical/field'));
  assert.equal(plain(latch(plate, { time: 60, stateCells: true }))[0], plain(plate)[0]);
  // Inverting a cell whose ink equals its background would hide it, so that cell keeps its look.
  const solid = [[span('█', { fg: 'warning', bg: 'warning' })]];
  assert.deepEqual(color(latch(solid, { time: 60, stateCells: true })), color(solid));
});

test('latch: a region limits the cells, and lock and invert set the phases', () => {
  const lines = [row('abcd', { fg: 'primary' }), row('efgh', { fg: 'accent' })];
  const out = latch(lines, { time: 30, lock: 20, invert: 20, region: { top: 1, left: 1, cols: 2 } });
  assert.deepEqual(looks(out[0]), Array(4).fill('primary/field'));
  assert.deepEqual(looks(out[1]), ['accent/field', 'field/accent!', 'field/accent!', 'accent/field']);
  assert.deepEqual(color(latch(lines, { time: 40, lock: 20, invert: 20 })), color(lines));
  assert.deepEqual(looks(latch(lines, { time: 0, lock: 0, invert: 20 })[0]), Array(4).fill('field/primary!'));
});

test('latch frames are deterministic, keep the input and characters, and keep every line at its exact width', () => {
  for (const width of [1, 2, 3, 7, 23, 24, 40, 48, 100, 160]) {
    const lines = specimen(width);
    const before = JSON.stringify(lines);
    for (const stateCells of [false, true]) {
      for (const time of [0, 49, 50, 100, 149, 150, 9999]) {
        const out = latch(lines, { time, stateCells });
        assert.deepEqual(out, latch(lines, { time, stateCells }));
        out.forEach((line, i) => assert.equal(lineWidth(line), lineWidth(lines[i]), `width ${width} t=${time} line ${i}`));
        assert.deepEqual(plain(out), plain(lines));
        assert.deepEqual(strip(out), plain(out));
      }
    }
    assert.equal(JSON.stringify(lines), before);
  }
});

test('latch rejects invalid options and lines', () => {
  const bad = [[{ lock: -1 }, RangeError], [{ lock: '50' }, RangeError], [{ invert: 60001 }, RangeError], [{ invert: Number.NaN }, RangeError],
    [{ stateCells: 1 }, TypeError], [{ region: { left: -1 } }, RangeError], [{ region: [] }, TypeError], [{ duration: 5 }, TypeError]];
  for (const [options, kind] of bad) {
    assert.throws(() => latch([row('x')], { time: 0, ...options }), kind, JSON.stringify(options));
    assert.throws(() => latch([row('x')], { animate: false, ...options }), kind);
    assert.throws(() => latchDuration(options), kind);
  }
  for (const time of [undefined, -1, Number.NaN, Infinity]) assert.throws(() => latch([row('x')], { time }), RangeError);
  for (const lines of [null, 'abc', [null], [[{ text: 5 }]]]) assert.throws(() => latch(lines, { time: 0 }), TypeError);
  assert.deepEqual(latch([], { time: 0 }), []);
});

test('latch keeps opted-in full-block state cells visible against the field', () => {
  for (const role of ['warning', 'critical']) {
    for (const bg of ['field', 'primary', 'surface']) {
      const block = [[span('█', { fg: role, bg })]];
      for (const time of [0, 25, 50, 100, 149]) {
        const [cell] = cellsOf(latch(block, { time, stateCells: true })[0]);
        assert.equal(cell.ch, '█');
        assert.notEqual(cell.fg, 'field', `${role} on ${bg} at ${time}`);
      }
      assert.equal(cellsOf(latch(block, { time: 0, stateCells: true })[0])[0].fg, 'accent');
    }
  }
});
