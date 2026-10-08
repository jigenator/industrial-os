import test from 'node:test';
import assert from 'node:assert/strict';
import { fitLine, lineWidth, paint, span } from '../foundation/cells.mjs';
import { gauge } from '../elements/gauge/gauge.mjs';
import { statusRow } from '../elements/status-row/status-row.mjs';
import { labelPlate } from '../elements/label-plate/label-plate.mjs';
import { nudge, NUDGE_DEFAULTS } from './nudge.mjs';

const base = {};
const motion = (lines, options = {}) => nudge(lines, { ...base, ...options });
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

test('nudge: motion-off copies the settled input; ignores time but validates options', () => {
  const lines = specimen(48);
  for (const time of [undefined, NaN, -1, 99]) {
    const out = motion(lines, { animate: false, time });
    assert.deepEqual(out, lines); assert.notEqual(out, lines); assert.notEqual(out[0], lines[0]);
  }
  assert.ok(Object.isFrozen(NUDGE_DEFAULTS));
  assert.throws(() => motion(lines, { animate: false, typo: 1 }), TypeError);
});

test('nudge: widths 1–160 with real renderers, deterministic frames and immutable input', () => {
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

test('nudge: warning/critical foreground and background cells are exempt', () => {
  for (const role of ['warning', 'critical']) {
    for (const style of [{ fg: role }, { fg: 'primary', bg: role }]) {
      const lines = [row('┼ ■│WARN   ', style)];
      for (const time of [0, 50, 100, 440, 600, 2800, 3850, 5900]) assert.deepEqual(colored(motion(lines, { time })), colored(lines));
    }
  }
});

test('nudge: invalid options, inputs and time are rejected', () => {
  const lines = [row('■ ┼', { fg: 'accent' })];
  for (const time of [undefined, null, -1, NaN, Infinity, '1']) assert.throws(() => motion(lines, { time }), RangeError);
  for (const options of [null, [], 1, 'bad']) assert.throws(() => nudge(lines, options), TypeError);
  for (const options of [{ typo: 1 }, { animate: 1 }, { toString: 1 }, JSON.parse('{"__proto__":1}')]) assert.throws(() => motion(lines, { time: 0, ...options }), TypeError);
  for (const region of [{ left: -1 }, { top: .5 }, { rows: NaN }, { cols: -1 }]) assert.throws(() => motion(lines, { time: 0, region }), RangeError);
  assert.throws(() => motion(lines, { time: 0, region: { typo: 1 } }), TypeError);
  for (const options of [{"glyph":"x"},{"glyph":"┼┼"},{"period":0},{"tick":0}]) {
    assert.throws(() => motion(lines, { time: 0, ...options }), RangeError);
    assert.throws(() => motion(lines, { animate: false, ...options }), RangeError);
  }
  for (const input of [null, {}, 'abc', [null], ['abc'], [[null]], [[{ text: 1 }]]]) assert.throws(() => motion(input, { time: 0 }), TypeError);
});

test('nudge: empty lines and explicit region clipping', () => {
  assert.deepEqual(motion([], { time: 0 }), []);
  assert.deepEqual(motion([[]], { time: 0 }), [[]]);
  const lines = [row('┼ ■│ABC', { fg: 'accent', bg: 'structural' }), row('■ ┼ABC', { fg: 'accent' })];
  const out = motion(lines, { time: 0, region: { top: 1, left: 1, rows: 1, cols: 2 } });
  assert.deepEqual(cells(out[0]), cells(lines[0]));
  assert.deepEqual(cells(out[1]).slice(0, 1), cells(lines[1]).slice(0, 1));
  assert.deepEqual(cells(out[1]).slice(3), cells(lines[1]).slice(3));
  assert.deepEqual(motion(lines, { time: 0, region: { rows: 0, cols: 0 } }), lines);
});

test('nudge: exact CAL offsets once per six seconds; only swaps with blanks', () => {
  // pi/status-bar/src/footer.ts:365–366,500,1549–1550. CAL=[1,1,0,-1,-1,0], shifted ink is bold acid.
  const lines = [row('  ┼  ', { fg: 'decorative' })];
  const expected = ['   ┼ ', '   ┼ ', '  ┼  ', ' ┼   ', ' ┼   ', '  ┼  '];
  for (let k = 0; k < 6; k++) {
    assert.equal(plain(motion(lines, { time: k * 50 }))[0], expected[k]);
    assert.equal(plain(motion(lines, { time: k * 50 + 49 }))[0], expected[k]);
  }
  assert.equal(cells(motion(lines, { time: 0 })[0])[3].fg, 'accent');
  assert.equal(cells(motion(lines, { time: 0 })[0])[3].bold, true);
  assert.equal(cells(motion(lines, { time: 150 })[0])[1].fg, 'accent');
  assert.deepEqual(cells(motion(lines, { time: 100 })[0]), cells(lines[0]));
  assert.deepEqual(motion(lines, { time: 5999 }), lines);
  assert.equal(plain(motion(lines, { time: 6000 }))[0], expected[0]);
  for (const text of ['┼A', 'A┼', '┼']) assert.deepEqual(motion([row(text)], { time: text === 'A┼' ? 150 : 0 }), [row(text)]);
  const stateNeighbour = [[span('┼'), span(' ', { bg: 'warning' })]];
  assert.deepEqual(motion(stateNeighbour, { time: 0 }), stateNeighbour);
  const two = [row(' ┼ ┼ ')];
  assert.equal(plain(motion(two, { time: 0 }))[0], '  ┼┼ ', 'only the first marked glyph shifts');
  for (const period of [1, 50]) assert.doesNotThrow(() => motion(lines, { time: 0, period }));
});

test('nudge: active decorative fixtures retain widths 1–160 and immutable options', () => {
  const variants = [{}];
  for (let width = 1; width <= 160; width++) {
    const decoration = [fitLine(row(width === 1 ? '┼' : ' ┼', { fg: 'primary' }), width)];
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

import { nudgeOffset } from './nudge.mjs';
test('nudgeOffset projects calibration steps while hosts retain center-window admission', () => {
  assert.deepEqual([0, 50, 100, 150, 200, 250, 5999, 6000].map((t) => nudgeOffset(t)), [1, 1, 0, -1, -1, 0, 0, 1]);
  assert.throws(() => nudgeOffset(-1), RangeError);
  assert.throws(() => nudgeOffset(0, { tick: 0 }), RangeError);
});
