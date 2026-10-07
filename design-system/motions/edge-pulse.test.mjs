import test from 'node:test';
import assert from 'node:assert/strict';
import { fitLine, lineWidth, paint, span } from '../foundation/cells.mjs';
import { gauge } from '../elements/gauge/gauge.mjs';
import { statusRow } from '../elements/status-row/status-row.mjs';
import { labelPlate } from '../elements/label-plate/label-plate.mjs';
import { edgePulse, EDGE_PULSE_DEFAULTS } from './edge-pulse.mjs';

const base = {};
const motion = (lines, options = {}) => edgePulse(lines, { ...base, ...options });
const plain = (lines) => lines.map((l) => paint(l, 'none'));
const colored = (lines) => lines.map((l) => paint(l, 'truecolor'));
const cells = (line) => line.flatMap((s) => [...s.text].map((ch) => ({ ch, fg: s.style.fg ?? 'secondary', bg: s.style.bg ?? 'field', bold: s.style.bold ?? false })));
const row = (text, style = {}) => [span(text, style)];
const specimen = (width) => [
  labelPlate('BAY', { tone: 'accent', maxWidth: width }),
  ...gauge({ label: 'FILL', value: 42.5 }, { width }),
  ...statusRow({ label: 'DOOR', value: 'closed', status: 'success' }, { width }),
  ...statusRow({ label: 'FAULT', value: 'retry', status: 'warning' }, { width }),
  ...statusRow({ label: 'FAULT', value: 'failed', status: 'error' }, { width }),
];

test('edge-pulse: motion-off copies the settled input; ignores time but validates options', () => {
  const lines = specimen(48);
  for (const time of [undefined, NaN, -1, 99]) {
    const out = motion(lines, { animate: false, time });
    assert.deepEqual(out, lines); assert.notEqual(out, lines); assert.notEqual(out[0], lines[0]);
  }
  assert.ok(Object.isFrozen(EDGE_PULSE_DEFAULTS));
  assert.throws(() => motion(lines, { animate: false, typo: 1 }), TypeError);
});

test('edge-pulse: widths 1–160 with real renderers, deterministic frames and immutable input', () => {
  for (let width = 1; width <= 160; width++) {
    const lines = specimen(width), before = JSON.stringify(lines);
    for (const time of [0, 50, 100, 150, 250, 440, 600, 880, 1520, 2800, 2880, 2960, 5900, 1e12]) {
      const out = motion(lines, { time });
      assert.deepEqual(out, motion(lines, { time }));
      assert.equal(out.length, lines.length);
      out.forEach((l, i) => assert.equal(lineWidth(l), lineWidth(lines[i])));
      assert.deepEqual(colored(out).map((l) => l.replace(/\x1b\[[0-9;]*m/g, '')), plain(out));

    }
    assert.equal(JSON.stringify(lines), before);
  }
});

test('edge-pulse: warning/critical foreground and background cells are exempt', () => {
  for (const role of ['warning', 'critical']) {
    for (const style of [{ fg: role }, { fg: 'primary', bg: role }]) {
      const lines = [row('┼ ■│WARN   ', style)];
      for (const time of [0, 50, 100, 440, 600, 2800, 3850, 5900]) assert.deepEqual(colored(motion(lines, { time })), colored(lines));
    }
  }
});

test('edge-pulse: invalid options, inputs and time are rejected', () => {
  const lines = [row('■ ┼', { fg: 'accent' })];
  for (const time of [undefined, null, -1, NaN, Infinity, '1']) assert.throws(() => motion(lines, { time }), RangeError);
  for (const options of [null, [], 1, 'bad']) assert.throws(() => edgePulse(lines, options), TypeError);
  for (const options of [{ typo: 1 }, { animate: 1 }, { toString: 1 }, JSON.parse('{"__proto__":1}')]) assert.throws(() => motion(lines, { time: 0, ...options }), TypeError);
  for (const region of [{ left: -1 }, { top: .5 }, { rows: NaN }, { cols: -1 }]) assert.throws(() => motion(lines, { time: 0, region }), RangeError);
  assert.throws(() => motion(lines, { time: 0, region: { typo: 1 } }), TypeError);
  for (const options of [{"fraction":-1},{"fraction":1.1},{"period":0},{"step":0}]) {
    assert.throws(() => motion(lines, { time: 0, ...options }), RangeError);
    assert.throws(() => motion(lines, { animate: false, ...options }), RangeError);
  }
  for (const input of [null, {}, 'abc', [null], ['abc'], [[null]], [[{ text: 1 }]]]) assert.throws(() => motion(input, { time: 0 }), TypeError);
});

test('edge-pulse: empty lines and explicit region clipping', () => {
  assert.deepEqual(motion([], { time: 0 }), []);
  assert.deepEqual(motion([[]], { time: 0 }), [[]]);
  const lines = [row('┼ ■│ABC', { fg: 'accent', bg: 'structural' }), row('■ ┼ABC', { fg: 'accent' })];
  const out = motion(lines, { time: 0, region: { top: 1, left: 1, rows: 1, cols: 2 } });
  assert.deepEqual(cells(out[0]), cells(lines[0]));
  assert.deepEqual(cells(out[1]).slice(0, 1), cells(lines[1]).slice(0, 1));
  assert.deepEqual(cells(out[1]).slice(3), cells(lines[1]).slice(3));
  assert.deepEqual(motion(lines, { time: 0, region: { rows: 0, cols: 0 } }), lines);
});

test('edge-pulse: period from slice fraction and exact last-three-step glyph/ink sequence', () => {
  // pi/status-bar/src/footer.ts:219,238–242,781–786,1255–1261.
  const lines = [row('■■■', { fg: '#ff5c00' }), row('■', { fg: '#333333' })];
  const options = { lit: '#ff5c00', used: '#331200', fraction: 1 };
  const edge = (time) => cells(motion(lines, { ...options, time })[0])[2];
  assert.deepEqual(motion(lines, { ...options, time: 0 }), lines);
  assert.equal(edge(3849).ch, '■');
  assert.deepEqual(edge(3850), { ch: '▪', fg: '#ff5c00', bg: 'field', bold: false });
  assert.equal(edge(3899).ch, '▪');
  assert.deepEqual(edge(3900), { ch: '▪', fg: '#331200', bg: 'field', bold: false });
  assert.deepEqual(edge(3950), { ch: '■', fg: '#331200', bg: 'field', bold: false });
  assert.deepEqual(motion(lines, { ...options, time: 4000 }), lines);
  assert.deepEqual(cells(motion(lines, { ...options, time: 3900 })[0]).slice(0, 2), cells(lines[0]).slice(0, 2));
  assert.deepEqual(motion(lines, { ...options, time: 3900 })[1], lines[1]);
  assert.equal(cells(motion(lines, { ...options, fraction: .5, time: 2150 })[0])[2].ch, '▪'); // P=2300
  for (const period of [1, 50, 100]) {
    assert.deepEqual(motion(lines, { ...options, period, time: 0 }), lines);
    assert.deepEqual(motion(lines, { ...options, period, time: period }), lines);
  }
  assert.throws(() => motion(lines, { animate: false, used: 'bad' }), TypeError);
});

test('edge-pulse: active decorative fixtures retain widths 1–160 and immutable options', () => {
  const variants = [{}];
  for (let width = 1; width <= 160; width++) {
    const decoration = [fitLine(row('■'.repeat(width), { fg: 'primary' }), width)];
    const lines = [...specimen(width), ...decoration], before = JSON.stringify(lines);
    for (const variant of variants) {
      const options = { ...variant, region: { top: lines.length - 1, rows: 1, cols: width } }, saved = JSON.stringify(options);
      for (const time of [0, 50, 100, 150, 440, 2880, 3900, 1e12]) {
        const out = motion(lines, { ...options, time });
        assert.deepEqual(out, motion(lines, { ...options, time }));
        assert.deepEqual(out.map(lineWidth), lines.map(lineWidth));
        assert.deepEqual(out.slice(0, -1).map(cells), lines.slice(0, -1).map(cells));
      }
      assert.equal(JSON.stringify(options), saved);
    }
    assert.equal(JSON.stringify(lines), before);
  }
});
