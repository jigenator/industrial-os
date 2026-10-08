import test from 'node:test';
import assert from 'node:assert/strict';
import { fitLine, lineWidth, paint, span } from '../foundation/cells.mjs';
import { gauge } from '../elements/gauge/gauge.mjs';
import { statusRow } from '../elements/status-row/status-row.mjs';
import { labelPlate } from '../elements/label-plate/label-plate.mjs';
import { wipe, WIPE_DEFAULTS, wipeDuration } from './wipe.mjs';

const base = {};
const motion = (lines, options = {}) => wipe(lines, { ...base, ...options });
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

test('wipe: motion-off copies the settled input; ignores time but validates options', () => {
  const lines = specimen(48);
  for (const time of [undefined, NaN, -1, 99]) {
    const out = motion(lines, { animate: false, time });
    assert.deepEqual(out, lines); assert.notEqual(out, lines); assert.notEqual(out[0], lines[0]);
  }
  assert.ok(Object.isFrozen(WIPE_DEFAULTS));
  assert.throws(() => motion(lines, { animate: false, typo: 1 }), TypeError);
});

test('wipe: widths 1–160 with real renderers, deterministic frames and immutable input', () => {
  for (let width = 1; width <= 160; width++) {
    const lines = specimen(width), before = JSON.stringify(lines);
    for (const time of [0, 50, 100, 150, 250, 440, 600, 880, 1520, 2800, 2880, 2960, 5900, 1e12]) {
      const out = motion(lines, { time });
      assert.deepEqual(out, motion(lines, { time }));
      assert.equal(out.length, lines.length);
      out.forEach((l, i) => assert.equal(lineWidth(l), lineWidth(lines[i])));
      assert.deepEqual(colored(out).map((l) => l.replace(/\x1b\[[0-9;]*m/g, '')), plain(out));
      assert.deepEqual(plain(out), plain(lines));
    }
    assert.equal(JSON.stringify(lines), before);
  }
});

test('wipe: warning/critical foreground and background cells are exempt', () => {
  for (const role of ['warning', 'critical']) {
    for (const style of [{ fg: role }, { fg: 'primary', bg: role }]) {
      const lines = [row('┼ ■│WARN   ', style)];
      for (const time of [0, 50, 100, 440, 600, 2800, 3850, 5900]) assert.deepEqual(colored(motion(lines, { time })), colored(lines));
    }
  }
});

test('wipe: invalid options, inputs and time are rejected', () => {
  const lines = [row('■ ┼', { fg: 'accent' })];
  for (const time of [undefined, null, -1, NaN, Infinity, '1']) assert.throws(() => motion(lines, { time }), RangeError);
  for (const options of [null, [], 1, 'bad']) assert.throws(() => wipe(lines, options), TypeError);
  for (const options of [{ typo: 1 }, { animate: 1 }, { toString: 1 }, JSON.parse('{"__proto__":1}')]) assert.throws(() => motion(lines, { time: 0, ...options }), TypeError);
  for (const region of [{ left: -1 }, { top: .5 }, { rows: NaN }, { cols: -1 }]) assert.throws(() => motion(lines, { time: 0, region }), RangeError);
  assert.throws(() => motion(lines, { time: 0, region: { typo: 1 } }), TypeError);
  for (const options of [{"times":[]},{"times":[2,1],"fractions":[0.5,1]},{"fractions":[0.4,0.8,0.9]},{"direction":"up"}]) {
    assert.throws(() => motion(lines, { time: 0, ...options }), RangeError);
    assert.throws(() => motion(lines, { animate: false, ...options }), RangeError);
  }
  for (const input of [null, {}, 'abc', [null], ['abc'], [[null]], [[{ text: 1 }]]]) assert.throws(() => motion(input, { time: 0 }), TypeError);
});

test('wipe: empty lines and explicit region clipping', () => {
  assert.deepEqual(motion([], { time: 0 }), []);
  assert.deepEqual(motion([[]], { time: 0 }), [[]]);
  const lines = [row('┼ ■│ABC', { fg: 'accent', bg: 'structural' }), row('■ ┼ABC', { fg: 'accent' })];
  const out = motion(lines, { time: 0, region: { top: 1, left: 1, rows: 1, cols: 2 } });
  assert.deepEqual(cells(out[0]), cells(lines[0]));
  assert.deepEqual(cells(out[1]).slice(0, 1), cells(lines[1]).slice(0, 1));
  assert.deepEqual(cells(out[1]).slice(3), cells(lines[1]).slice(3));
  assert.deepEqual(motion(lines, { time: 0, region: { rows: 0, cols: 0 } }), lines);
});

test('wipe: exact settle steps, short plate proportions, direction and completion', () => {
  // pi/claude-interrupt/src/index.ts:105–110; plate width 19 with outputPad=1.
  const lines = [row(' DIRECTIVE UPDATED ', { fg: 'primary', bg: 'structural', bold: true })];
  const count = (time, options = {}) => cells(motion(lines, { time, ...options })[0]).filter((c) => c.bg === 'structural').length;
  assert.equal(count(2799), 0);
  assert.equal(count(2800), 8);
  assert.equal(count(2879), 8);
  assert.equal(count(2880), 16);
  assert.equal(count(2959), 16);
  assert.equal(count(2960), 19);
  assert.equal(wipeDuration(), 2960);
  assert.deepEqual(motion(lines, { time: 2960 }), lines);
  assert.deepEqual(motion(lines, { time: 1e12 }), lines);
  const short = [row('ABC', { fg: 'primary', bg: 'structural' })];
  assert.deepEqual(cells(motion(short, { time: 2800 })[0]).map((c) => c.bg), ['accent', 'structural', 'structural']);
  assert.deepEqual(cells(motion(short, { time: 2800, direction: 'ltr' })[0]).map((c) => c.bg), ['structural', 'structural', 'accent']);
  assert.equal(wipeDuration({ times: [10, 20], fractions: [.5, 1] }), 20);
  assert.throws(() => motion(lines, { time: 0, fromStyle: { fg: 'unknown' } }), TypeError);
  assert.throws(() => motion(lines, { time: 0, fromStyle: { bold: 'yes' } }), TypeError);
  assert.throws(() => motion(lines, { time: 0, fromStyle: { typo: 1 } }), TypeError);
});

test('wipe: active decorative fixtures retain widths 1–160 and immutable options', () => {
  const variants = [{}];
  for (let width = 1; width <= 160; width++) {
    const decoration = [fitLine(row('■'.repeat(width), { fg: 'primary', bg: 'structural', bold: true }), width)];
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

test('wipe accepts terminal-default channels in the starting style', () => {
  const lines = [[span('AB', { fg: 'primary', bg: 'structural' })]];
  const fromStyle = { fg: 'accent', bg: 'default' };
  assert.deepEqual(wipe(lines, { time: 0, fromStyle })[0][0].style, fromStyle);
  assert.deepEqual(wipe(lines, { animate: false, fromStyle }), lines);
});
