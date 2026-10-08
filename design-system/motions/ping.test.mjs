import test from 'node:test';
import assert from 'node:assert/strict';
import { fitLine, lineWidth, paint, span } from '../foundation/cells.mjs';
import { gauge } from '../elements/gauge/gauge.mjs';
import { statusRow } from '../elements/status-row/status-row.mjs';
import { labelPlate } from '../elements/label-plate/label-plate.mjs';
import { ping, PING_DEFAULTS, pingDuration } from './ping.mjs';

const base = {};
const motion = (lines, options = {}) => ping(lines, { ...base, ...options });
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

test('ping: motion-off copies the settled input; ignores time but validates options', () => {
  const lines = specimen(48);
  for (const time of [undefined, NaN, -1, 99]) {
    const out = motion(lines, { animate: false, time });
    assert.deepEqual(out, lines); assert.notEqual(out, lines); assert.notEqual(out[0], lines[0]);
  }
  assert.ok(Object.isFrozen(PING_DEFAULTS));
  assert.throws(() => motion(lines, { animate: false, typo: 1 }), TypeError);
});

test('ping: widths 1–160 with real renderers, deterministic frames and immutable input', () => {
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

test('ping: warning/critical foreground and background cells are exempt', () => {
  for (const role of ['warning', 'critical']) {
    for (const style of [{ fg: role }, { fg: 'primary', bg: role }]) {
      const lines = [row('┼ ■│WARN   ', style)];
      for (const time of [0, 50, 100, 440, 600, 2800, 3850, 5900]) assert.deepEqual(colored(motion(lines, { time })), colored(lines));
    }
  }
});

test('ping: invalid options, inputs and time are rejected', () => {
  const lines = [row('■ ┼', { fg: 'accent' })];
  for (const time of [undefined, null, -1, NaN, Infinity, '1']) assert.throws(() => motion(lines, { time }), RangeError);
  for (const options of [null, [], 1, 'bad']) assert.throws(() => ping(lines, options), TypeError);
  for (const options of [{ typo: 1 }, { animate: 1 }, { toString: 1 }, JSON.parse('{"__proto__":1}')]) assert.throws(() => motion(lines, { time: 0, ...options }), TypeError);
  for (const region of [{ left: -1 }, { top: .5 }, { rows: NaN }, { cols: -1 }]) assert.throws(() => motion(lines, { time: 0, region }), RangeError);
  assert.throws(() => motion(lines, { time: 0, region: { typo: 1 } }), TypeError);
  for (const options of [{"ghostAt":0},{"frame":0},{"repeats":1.5},{"repeats":1,"repeatAfter":0}]) {
    assert.throws(() => motion(lines, { time: 0, ...options }), RangeError);
    assert.throws(() => motion(lines, { animate: false, ...options }), RangeError);
  }
  for (const input of [null, {}, 'abc', [null], ['abc'], [[null]], [[{ text: 1 }]]]) assert.throws(() => motion(input, { time: 0 }), TypeError);
});

test('ping: empty lines and explicit region clipping', () => {
  assert.deepEqual(motion([], { time: 0 }), []);
  assert.deepEqual(motion([[]], { time: 0 }), [[]]);
  const lines = [row('┼ ■│ABC', { fg: 'accent', bg: 'structural' }), row('■ ┼ABC', { fg: 'accent' })];
  const out = motion(lines, { time: 0, region: { top: 1, left: 1, rows: 1, cols: 2 } });
  assert.deepEqual(cells(out[0]), cells(lines[0]));
  assert.deepEqual(cells(out[1]).slice(0, 1), cells(lines[1]).slice(0, 1));
  assert.deepEqual(cells(out[1]).slice(3), cells(lines[1]).slice(3));
  assert.deepEqual(motion(lines, { time: 0, region: { rows: 0, cols: 0 } }), lines);
});

test('ping: exact launch, stagger, grey, disappearance and repeat on the 40 ms grid', () => {
  // pi/claude-interrupt/src/index.ts:67–71,113–120.
  const lines = [row('││ │ │  │  │   │')];
  const p = (time) => plain(motion(lines, { time }))[0];
  const inks = (time) => cells(motion(lines, { time })[0]).filter((c) => c.ch !== ' ').map((c) => c.fg);
  assert.equal(p(0), ' '.repeat(16));
  assert.equal(p(159), ' '.repeat(16));
  assert.equal(p(160), '│' + ' '.repeat(15));
  assert.equal(p(199), p(160));
  assert.equal(p(200), '││' + ' '.repeat(14));
  assert.equal(p(400), plain(lines)[0]);
  assert.deepEqual(inks(400), Array(7).fill('accent'));
  assert.deepEqual(inks(440), ['decorative', ...Array(6).fill('accent')]);
  assert.equal(p(560).slice(0, 2), ' │');
  assert.equal(p(800), ' '.repeat(16));
  assert.equal(p(879), ' '.repeat(16));
  assert.equal(p(880), p(160));
  assert.equal(p(1120), p(400));
  assert.equal(p(1160), p(440));
  assert.equal(p(1520), ' '.repeat(16));
  assert.equal(pingDuration(lines), 1520);
  assert.equal(pingDuration([]), 0);
  assert.equal(pingDuration(lines, { repeats: 0 }), 800);
  assert.throws(() => pingDuration(lines, { launch: -1 }), RangeError);
});

test('ping: active decorative fixtures retain widths 1–160 and immutable options', () => {
  const variants = [{}];
  for (let width = 1; width <= 160; width++) {
    const decoration = [fitLine(row('│'.repeat(width), { fg: 'primary' }), width)];
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

test('ping offStyle replaces disappearing bar styles, retaining gaps and motion-off input', () => {
  const offStyle = { fg: 'default', bg: 'default' };
  const lines = [[span('│', { fg: 'accent', bg: 'default', bold: true }), span(' ', offStyle)]];
  for (const time of [0, 800, 1520]) assert.deepEqual(ping(lines, { time, offStyle }), [[span('  ', offStyle)]]);
  assert.deepEqual(ping(lines, { time: 160, offStyle })[0][0].style, { fg: 'accent', bg: 'default', bold: true });
  assert.deepEqual(ping(lines, { time: 440, offStyle })[0][0].style, { fg: 'decorative', bg: 'default', bold: true });
  assert.deepEqual(ping(lines, { animate: false, offStyle }), lines);
  for (const style of [null, [], 1, { fg: 'invalid' }, { bold: 1 }, { other: true }]) assert.throws(() => ping(lines, { time: 0, offStyle: style }), TypeError);
});
