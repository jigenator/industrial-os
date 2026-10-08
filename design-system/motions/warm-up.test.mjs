import test from 'node:test';
import assert from 'node:assert/strict';
import { lineWidth, paint, resolveColor, span } from '../foundation/cells.mjs';
import { labelPlate } from '../elements/label-plate/label-plate.mjs';
import { gauge } from '../elements/gauge/gauge.mjs';
import { statusRow } from '../elements/status-row/status-row.mjs';
import { warmUp, warmUpDuration, WARM_UP_DEFAULTS } from './warm-up.mjs';

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
    ...statusRow({ label: 'DOOR', value: 'closed', status: 'success' }, { width }),
    ...statusRow({ label: 'FEED', value: 'retries', status: 'warning' }, { width }),
    ...statusRow({ label: 'PARSE', value: 'failed', status: 'error' }, { width }),
  ];
}

// A two-component Tatsu entry as status-bar paints it (footer.ts:1194-1204): dim label, shape, ink space, code.
const TATSU = [[
  span('TCLI', { fg: 'decorative' }), span(' '), span('▲', { fg: 'warning', bold: true }), span(' ', { fg: 'warning', bold: true }), span('UP×3', { fg: 'warning', bold: true }),
  span('   '),
  span('AWKS', { fg: 'decorative' }), span(' '), span('•', { fg: 'accent', bold: true }), span(' ', { fg: 'accent', bold: true }), span('OK', { fg: 'accent', bold: true }),
]];
// Each part's start in ticks: component * TATSU_WARM_STAGGER (3) + TATSU_WARM_ROLE (shape 0, code 2, label 4); 50 ms ticks.
const PARTS = [
  { left: 0, cols: 4, ink: 'graphic', start: 4 }, { left: 5, cols: 1, ink: 'warn', start: 0 }, { left: 7, cols: 4, ink: 'warn', start: 2 },
  { left: 14, cols: 4, ink: 'graphic', start: 7 }, { left: 19, cols: 1, ink: 'primary', start: 3 }, { left: 21, cols: 2, ink: 'primary', start: 5 },
];
const TATSU_DELAYS = PARTS.map(({ left, cols, start }) => ({ region: { left, cols }, delay: start * 50 }));
// status-bar's warm-up inks (footer.ts:120-125, 403-406), by its hue names; settled is the DS role.
const INKS = {
  graphic: { steps: ['#1c1c1c', '#383838', '#555555'], settled: '#717171' },
  warn: { steps: ['#362814', '#6c4f29', '#a1763e'], settled: '#d79e52' },
  primary: { steps: ['#304001', '#607f02', '#90be03'], settled: '#c0fe04' },
};
// footer.ts:408-411 tatsuWarmInk, with the start already summed.
const reference = (ink, k, start) => {
  const step = Math.floor((k - start) / 2);
  return step < 0 ? '#000000' : step < 3 ? INKS[ink].steps[step] : INKS[ink].settled;
};

test('warmUp: motion-off returns the input and needs no time', () => {
  const lines = specimen(48);
  for (const off of [{ animate: false }, { animate: false, time: 5, stateCells: true }]) {
    const out = warmUp(lines, off);
    assert.deepEqual(color(out), color(lines));
    assert.notEqual(out, lines);
  }
  assert.deepEqual({ ...WARM_UP_DEFAULTS, delays: [...WARM_UP_DEFAULTS.delays] }, { step: 100, delays: [], stateCells: false });
});

test('warmUp: every tick of the Tatsu warm-up matches status-bar (footer.ts:396-411)', () => {
  for (let k = 0; k <= 14; k++) {
    for (const time of [k * 50, k * 50 + 49]) {
      const cells = cellsOf(warmUp(TATSU, { time, delays: TATSU_DELAYS, stateCells: true })[0]);
      assert.equal(cells.map((c) => c.ch).join(''), 'TCLI ▲ UP×3   AWKS • OK', 'characters are current from the first frame');
      for (const { left, cols, ink, start } of PARTS) {
        for (let x = left; x < left + cols; x++) {
          const expected = reference(ink, k, start);
          // Deviation: an opted-in state cell starts at its first visible step, not the invisible field.
          const want = ink === 'warn' && expected === '#000000' ? INKS.warn.steps[0] : expected;
          assert.equal(hex(cells[x].fg), want, `tick ${k} t=${time} cell ${x}`);
          assert.equal(cells[x].bold, TATSU[0].flatMap((s) => [...s.text].map(() => s.style.bold ?? false))[x], 'bold kept');
        }
      }
    }
  }
  // Settled once the last part (AWKS's label, tick 7) has stepped three times: 650 ms; status-bar holds 14 ticks (700 ms).
  assert.equal(warmUpDuration({ delays: TATSU_DELAYS }), 650);
  assert.deepEqual(color(warmUp(TATSU, { time: 650, delays: TATSU_DELAYS, stateCells: true })), color(TATSU));
});

test('warmUp: warning and critical cells are exempt by default and readable when opted in', () => {
  const line = [span('▲ WARN', { fg: 'warning', bold: true }), span('ERR', { fg: 'field', bg: 'critical', bold: true }), span('ok', { fg: 'accent' })];
  const out = warmUp([line], { time: 0 })[0];
  assert.deepEqual(cellsOf(out).map((c) => c.fg), ['warning', 'warning', 'warning', 'warning', 'warning', 'warning', 'field', 'field', 'field', '#304001', '#304001']);
  for (let time = 0; time < 400; time += 10) {
    const cells = cellsOf(warmUp([line], { time, stateCells: true })[0]);
    assert.equal(cells.map((c) => c.ch).join(''), '▲ WARNERRok');
    for (const c of cells.slice(0, 9)) assert.notEqual(hex(c.fg), hex(c.bg), `state cell visible at ${time}`);
  }
  assert.equal(hex(cellsOf(warmUp([line], { time: 0, stateCells: true })[0])[0].fg), '#362814');
  // Before its delay a state cell already shows its 25% step; an ordinary cell is still the field.
  const delayed = cellsOf(warmUp([line], { time: 0, stateCells: true, delays: [{ delay: 500 }] })[0]);
  assert.deepEqual([delayed[0].fg, delayed[9].fg], ['#362814', 'field']);
  assert.equal(hex(cellsOf(warmUp([[span('✕', { fg: 'critical' })]], { time: 150, stateCells: true })[0])[0].fg), '#792412');
});

test('warmUp: steps any color with mixOver, before and after its delay', () => {
  const line = [span('ab', { fg: 'primary' }), span('cd', { fg: '#ff15bd' })];
  const fgs = (time, o = {}) => cellsOf(warmUp([line], { time, ...o })[0]).map((c) => hex(c.fg));
  assert.deepEqual(fgs(0), ['#404040', '#404040', '#40052f', '#40052f']);
  assert.deepEqual(fgs(100), ['#808080', '#808080', '#800b5f', '#800b5f']);
  assert.deepEqual(fgs(299), ['#bfbfbf', '#bfbfbf', '#bf108e', '#bf108e']);
  assert.deepEqual(fgs(300), ['#ffffff', '#ffffff', '#ff15bd', '#ff15bd']);
  const delays = [{ region: { left: 2 }, delay: 200 }, { region: { left: 0 }, delay: 1000 }];
  assert.deepEqual(fgs(0, { delays }), ['#000000', '#000000', '#000000', '#000000'], 'first matching entry wins');
  assert.deepEqual(fgs(200, { delays }), ['#000000', '#000000', '#40052f', '#40052f']);
  assert.equal(warmUpDuration({ delays }), 1300);
  assert.equal(warmUpDuration(), 300);
  assert.equal(warmUpDuration({ step: 50 }), 150);
});

test('warmUp frames are deterministic, keep the input, keep characters, and keep every line at its exact width', () => {
  for (const width of [1, 2, 3, 7, 23, 24, 40, 48, 100, 160]) {
    const lines = specimen(width);
    const before = JSON.stringify(lines);
    for (const stateCells of [false, true]) {
      for (const time of [0, 1, 99, 100, 150, 250, 299, 300, 5000]) {
        const out = warmUp(lines, { time, stateCells, delays: [{ region: { top: 1 }, delay: 100 }] });
        assert.deepEqual(out, warmUp(lines, { time, stateCells, delays: [{ region: { top: 1 }, delay: 100 }] }));
        out.forEach((line, i) => assert.equal(lineWidth(line), lineWidth(lines[i]), `width ${width} t=${time} line ${i}`));
        assert.deepEqual(plain(out), plain(lines));
        assert.deepEqual(strip(out), plain(out));
      }
    }
    assert.equal(JSON.stringify(lines), before);
  }
});

test('warmUp rejects invalid options and lines', () => {
  const bad = [
    [{ step: 0 }, RangeError], [{ step: '100' }, RangeError], [{ step: 60001 }, RangeError],
    [{ delays: 'x' }, RangeError], [{ delays: [null] }, RangeError], [{ delays: [5] }, RangeError],
    [{ delays: [{ delay: -1 }] }, RangeError], [{ delays: [{ delay: 'a' }] }, RangeError], [{ delays: [{}] }, RangeError],
    [{ delays: [{ delay: 0, region: { top: -1 } }] }, RangeError], [{ delays: [{ delay: 0, region: 3 }] }, TypeError],
    [{ delays: [{ delay: 0, when: 1 }] }, TypeError], [{ delays: Array(1001).fill({ delay: 0 }) }, RangeError],
    [{ stateCells: 'yes' }, TypeError], [{ stagger: 3 }, TypeError],
  ];
  for (const [options, kind] of bad) {
    assert.throws(() => warmUp([row('x')], { time: 0, ...options }), kind, JSON.stringify(options).slice(0, 80));
    assert.throws(() => warmUp([row('x')], { animate: false, ...options }), kind);
    assert.throws(() => warmUpDuration(options), kind);
  }
  for (const time of [undefined, -1, Number.NaN, Infinity]) assert.throws(() => warmUp([row('x')], { time }), RangeError);
  for (const lines of [null, 'abc', [null], [[{ text: 5 }]]]) assert.throws(() => warmUp(lines, { time: 0 }), TypeError);
  assert.deepEqual(warmUp([], { time: 0 }), []);
});

test('warmUp rejects terminal-default foreground when an RGB mix is needed', () => {
  const lines = [[span('A', { fg: 'default', bg: 'default' })]];
  assert.throws(() => warmUp(lines, { time: 0 }), TypeError);
  assert.deepEqual(warmUp(lines, { animate: false }), lines);
  const transparent = [[span('A', { fg: 'accent', bg: 'default' })]];
  assert.equal(warmUp(transparent, { time: 0 })[0][0].style.bg, 'default');
});

test('warmUp preserves opted-in state cues on an unknown terminal-default background', () => {
  const lines = [[span('▲ WARN', { fg: 'warning', bg: 'default' })]];
  for (const time of [0, 100, 200]) assert.doesNotThrow(() => warmUp(lines, { time, stateCells: true }));
});
