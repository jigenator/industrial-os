import test from 'node:test';
import assert from 'node:assert/strict';
import { fitLine, lineWidth, paint, span } from '../foundation/cells.mjs';
import { gauge } from '../elements/gauge/gauge.mjs';
import { statusRow } from '../elements/status-row/status-row.mjs';
import { labelPlate } from '../elements/label-plate/label-plate.mjs';
import { ghost, GHOST_DEFAULTS, ghostDuration, GHOST_WAIT, GHOST_GLITCH } from './ghost.mjs';

const base = {"region":{}};
const motion = (lines, options = {}) => ghost(lines, { ...base, ...options });
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

test('ghost: motion-off copies the settled input; ignores time but validates options', () => {
  const lines = specimen(48);
  for (const time of [undefined, NaN, -1, 99]) {
    const out = motion(lines, { animate: false, time });
    assert.deepEqual(out, lines); assert.notEqual(out, lines); assert.notEqual(out[0], lines[0]);
  }
  assert.ok(Object.isFrozen(GHOST_DEFAULTS));
  assert.throws(() => motion(lines, { animate: false, typo: 1 }), TypeError);
});

test('ghost: widths 1–160 with real renderers, deterministic frames and immutable input', () => {
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

test('ghost: warning/critical foreground and background cells are exempt', () => {
  for (const role of ['warning', 'critical']) {
    for (const style of [{ fg: role }, { fg: 'primary', bg: role }]) {
      const lines = [row('┼ ■│WARN   ', style)];
      for (const time of [0, 50, 100, 440, 600, 2800, 3850, 5900]) assert.deepEqual(colored(motion(lines, { time })), colored(lines));
    }
  }
});

test('ghost: invalid options, inputs and time are rejected', () => {
  const lines = [row('■ ┼', { fg: 'accent' })];
  for (const time of [undefined, null, -1, NaN, Infinity, '1']) assert.throws(() => motion(lines, { time }), RangeError);
  for (const options of [null, [], 1, 'bad']) assert.throws(() => ghost(lines, options), TypeError);
  for (const options of [{ typo: 1 }, { animate: 1 }, { toString: 1 }, JSON.parse('{"__proto__":1}')]) assert.throws(() => motion(lines, { time: 0, ...options }), TypeError);
  for (const region of [{ left: -1 }, { top: .5 }, { rows: NaN }, { cols: -1 }]) assert.throws(() => motion(lines, { time: 0, region }), RangeError);
  assert.throws(() => motion(lines, { time: 0, region: { typo: 1 } }), TypeError);
  for (const options of [{"seed":NaN},{"level":0},{"level":4},{"mode":"bad"},{"tick":0}]) {
    assert.throws(() => motion(lines, { time: 0, ...options }), RangeError);
    assert.throws(() => motion(lines, { animate: false, ...options }), RangeError);
  }
  for (const input of [null, {}, 'abc', [null], ['abc'], [[null]], [[{ text: 1 }]]]) assert.throws(() => motion(input, { time: 0 }), TypeError);
});

test('ghost: empty lines and explicit region clipping', () => {
  assert.deepEqual(motion([], { time: 0 }), []);
  assert.deepEqual(motion([[]], { time: 0 }), [[]]);
  const lines = [row('┼ ■│ABC', { fg: 'accent', bg: 'structural' }), row('■ ┼ABC', { fg: 'accent' })];
  const out = motion(lines, { time: 0, region: { top: 1, left: 1, rows: 1, cols: 2 } });
  assert.deepEqual(cells(out[0]), cells(lines[0]));
  assert.deepEqual(cells(out[1]).slice(0, 1), cells(lines[1]).slice(0, 1));
  assert.deepEqual(cells(out[1]).slice(3), cells(lines[1]).slice(3));
  assert.deepEqual(motion(lines, { time: 0, region: { rows: 0, cols: 0 } }), lines);
});

test('ghost: seeded GLITCH levels, exact fixed runs, durations and protected readouts/edge', () => {
  // pi/status-bar/src/footer.ts:369–373,684–686,1441–1456.
  const lines = [row('████████', { fg: 'accent', bg: 'surface' })];
  const expected = ['█▓██████', '█▓▒█████', '█▒▚▞▓░▞█'];
  for (const level of [1, 2, 3]) {
    const options = { seed: 0, level, region: {} };
    const d = ghostDuration(lines, options);
    assert.equal(d, (level + 1) * 50);
    assert.equal(plain(motion(lines, { ...options, time: 0 }))[0], expected[level - 1]);
    assert.equal(plain(motion(lines, { ...options, time: d - 1 }))[0], expected[level - 1]);
    assert.deepEqual(motion(lines, { ...options, time: d }), lines);
    assert.ok(Object.isFrozen(GHOST_GLITCH[level]));
    assert.ok(Object.isFrozen(GHOST_GLITCH[level].wait));
  }
  const reading = [row('████ 42.0 %', { fg: 'accent' })];
  for (let seed = 0; seed < 30; seed++) {
    const out = motion(reading, { time: 0, seed, level: 3, region: {} });
    assert.equal(plain(out)[0].slice(4), ' 42.0 %');
    assert.equal(plain(out)[0][3], '█'); // edge square is not eligible
  }
  assert.deepEqual(GHOST_WAIT, [2200, 4200]); assert.ok(Object.isFrozen(GHOST_WAIT));
  assert.throws(() => ghost(lines, { time: 0 }), TypeError, 'region must be explicit');
});

test('ghost: registration A+B, bright first tick, grey echoes, anchor lift and full recovery', () => {
  // pi/status-bar/src/footer.ts:847–889,1627–1643. Geometry-only groups; seed=0 chooses mid and bottom-right.
  const lines = Array.from({ length: 5 }, (_, i) => row(i === 0 ? '┏      ┓' : i === 4 ? '┗      ┛' : '        ', { fg: 'decorative' }));
  const options = { seed: 0, mode: 'registration', region: {} };
  assert.equal(ghostDuration(lines, options), 250);
  assert.equal(plain(motion(lines, { ...options, time: 0 }))[1], '     ┼  ');
  assert.equal(cells(motion(lines, { ...options, time: 0 })[1])[5].fg, 'secondary');
  assert.equal(cells(motion(lines, { ...options, time: 50 })[1])[5].fg, 'decorative');
  assert.equal(plain(motion(lines, { ...options, time: 100 }))[4], '┗    ━┛┛');
  assert.equal(plain(motion(lines, { ...options, time: 150 }))[4], '┗    ━┛ ');
  assert.equal(plain(motion(lines, { ...options, time: 200 }))[4], '┗    ━┛┛');
  assert.deepEqual(motion(lines, { ...options, time: 250 }), lines);
  const occupied = lines.map((line) => row(plain([line])[0].replaceAll(' ', 'X'), { fg: 'secondary' }));
  for (let seed = 0; seed < 15; seed++) for (let time = 0; time < 600; time += 50) {
    const out = motion(occupied, { ...options, seed, time });
    cells(out[1]).forEach((c) => assert.equal(c.ch, 'X', 'nonblank readout never overwritten'));
  }
});

test('ghost: active decorative fixtures retain widths 1–160 and immutable options', () => {
  const variants = [{ seed: 1, mode: 'fill' }, { seed: 12345, mode: 'registration' }];
  for (let width = 1; width <= 160; width++) {
    const decoration = [fitLine(row('█'.repeat(width), { fg: 'accent', bg: 'surface' }), width)];
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
