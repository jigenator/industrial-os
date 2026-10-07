import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { lineWidth, paint, span } from '../foundation/cells.mjs';
import { labelPlate } from '../elements/label-plate/label-plate.mjs';
import { numberedPanel, panelInnerWidth } from '../elements/numbered-panel/numbered-panel.mjs';
import { gauge } from '../elements/gauge/gauge.mjs';
import { statusRow } from '../elements/status-row/status-row.mjs';
import { MIN_PERIOD_MS, glyphVisible, inRegion, invertCell, resolveRegion, restyleCells } from './frame.mjs';
import { scan, SCAN_DEFAULTS } from './scan.mjs';
import { pulse, PULSE_DEFAULTS } from './pulse.mjs';
import { reveal, revealDuration, REVEAL_DEFAULTS } from './reveal.mjs';

const MOTIONS = { scan, pulse, reveal };
const plain = (lines) => lines.map((l) => paint(l, 'none'));
const color = (lines) => lines.map((l) => paint(l, 'truecolor'));
// One entry per cell: character, effective foreground role, bold.
const cellsOf = (line) => line.flatMap((s) => [...s.text].map((ch) => ({ ch, fg: s.style.fg ?? 'secondary', bg: s.style.bg ?? 'field', bold: s.style.bold ?? false })));
const row = (text, style = {}) => [span(text, style)];

// A realistic block from the real renderers at one width.
function specimen(width) {
  return [
    [...labelPlate('BAY 04', { tone: 'accent', maxWidth: width })],
    ...gauge({ label: 'FILL', value: 42.5 }, { width }),
    ...statusRow({ label: 'DOOR', value: 'closed', status: 'success' }, { width }),
    ...statusRow({ label: 'FEED', value: 'retries', status: 'warning' }, { width }),
    ...statusRow({ label: 'PARSE', value: 'failed', status: 'error' }, { width }),
    ...statusRow({ label: 'LINK', value: null, status: 'unavailable' }, { width }),
  ];
}

test('motion-off (animate: false) returns the input and needs no time', () => {
  const lines = specimen(48);
  for (const [name, motion] of Object.entries(MOTIONS)) {
    for (const off of [{ animate: false }, { animate: false, time: 123 }, { animate: false, time: undefined }]) {
      const out = motion(lines, off);
      assert.deepEqual(color(out), color(lines), name);
      assert.notEqual(out, lines);
      assert.notEqual(out[0], lines[0]);
    }
  }
});

test('time is required, finite, and non-negative while animating', () => {
  for (const [name, motion] of Object.entries(MOTIONS)) {
    for (const time of [undefined, null, '5', Number.NaN, Infinity, -1, -0.001, {}]) {
      assert.throws(() => motion([row('x')], { time }), RangeError, `${name} ${String(time)}`);
    }
    assert.throws(() => motion([row('x')]), RangeError, `${name} omitted options`);
    assert.doesNotThrow(() => motion([row('x')], { time: 0 }));
    assert.doesNotThrow(() => motion([row('x')], { time: 1e12 }));
  }
});

test('frames are deterministic, leave the input untouched, and keep every line at its exact width', () => {
  for (const width of [1, 2, 3, 7, 23, 24, 40, 48, 100, 160]) {
    const lines = specimen(width);
    const before = JSON.stringify(lines);
    for (const [name, motion] of Object.entries(MOTIONS)) {
      for (const time of [0, 1, 150, 600, 1000, 1234.5, 2399, 5000, 99999]) {
        for (const extra of [{}, { veil: 'blank' }].filter((e) => name === 'reveal' || !e.veil)) {
          const out = motion(lines, { time, ...extra });
          assert.deepEqual(out, motion(lines, { time, ...extra }), `${name} deterministic`);
          assert.equal(out.length, lines.length);
          out.forEach((line, i) => assert.equal(lineWidth(line), lineWidth(lines[i]), `${name} width ${width} t=${time} line ${i}`));
          // Plain and color frames show the same cells.
          assert.deepEqual(color(out).map((l) => l.replace(/\x1b\[[0-9;]*m/g, '')), plain(out));
        }
      }
    }
    assert.equal(JSON.stringify(lines), before, 'input not mutated');
  }
});

test('scan and pulse never change text; reveal with dim veil never changes text', () => {
  const lines = specimen(60);
  for (let time = 0; time < 6000; time += 97) {
    assert.deepEqual(plain(scan(lines, { time })), plain(lines));
    assert.deepEqual(plain(pulse(lines, { time })), plain(lines));
    assert.deepEqual(plain(reveal(lines, { time })), plain(lines));
  }
});

const marks = (line, lit = 'accent') => cellsOf(line).map((c) => (c.fg === lit ? (c.bold ? 'B' : 'a') : '.')).join('');

test('scan: band position, bold leading cell, entry and exit', () => {
  const lines = [row('abcdefghij', { fg: 'secondary' })];
  // extent 10 + band 3 = 13 steps; period 1300 makes one step per 100 ms.
  const frame = (time, opts = {}) => marks(scan(lines, { period: 1300, band: 3, time, ...opts })[0]);
  assert.equal(frame(0), '..........');
  assert.equal(frame(99), '..........');
  assert.equal(frame(100), 'B.........');
  assert.equal(frame(300), 'aaB.......');
  assert.equal(frame(500), '..aaB.....');
  assert.equal(frame(1000), '.......aaB');
  assert.equal(frame(1100), '........aa');
  assert.equal(frame(1299), '.........a');
  assert.equal(frame(1300), frame(0), 'repeats');
  assert.equal(frame(1300 * 40 + 300), frame(300), 'repeats at large times');
  assert.deepEqual(scan(lines, { period: 1300, band: 3, time: 0 }).map((l) => paint(l, 'truecolor')), [paint(lines[0], 'truecolor')]);
  assert.deepEqual({ ...SCAN_DEFAULTS }, { period: 2400, band: 3, axis: 'x' });
});

test('scan: spaces stay untouched, axis y sweeps whole rows', () => {
  const spaced = [row('a b c', { fg: 'secondary' })];
  // extent 5 + band 5 = 10 steps; period 800 -> 80 ms per step
  assert.equal(marks(scan(spaced, { period: 800, band: 5, time: 400 })[0]), 'a.a.B');
  assert.equal(marks(scan(spaced, { period: 800, band: 5, time: 700 })[0]), '....a');
  const block = [row('aa', { fg: 'secondary' }), row('bb', { fg: 'secondary' }), row('cc', { fg: 'secondary' }), row('dd', { fg: 'secondary' })];
  // 4 rows + band 2 = 6 steps; period 600 -> 100 ms per step
  const rows = (time) => scan(block, { period: 600, band: 2, axis: 'y', time }).map((l) => marks(l));
  assert.deepEqual(rows(0), ['..', '..', '..', '..']);
  assert.deepEqual(rows(100), ['BB', '..', '..', '..']);
  assert.deepEqual(rows(300), ['..', 'aa', 'BB', '..']);
  assert.deepEqual(rows(500), ['..', '..', '..', 'aa']);
});

test('scan recolors only non-state cells: accent becomes white, warning and critical are untouched', () => {
  const line = [span('ok', { fg: 'accent' }), span('wn', { fg: 'warning' }), span('er', { fg: 'critical' }), span('tx', { fg: 'decorative' }), span('hi', { fg: 'primary', bold: true })];
  const out = scan([line], { period: 800, band: 100, time: 370 })[0];
  assert.deepEqual(cellsOf(out).map((c) => c.fg), ['primary', 'primary', 'warning', 'warning', 'critical', 'critical', 'accent', 'accent', 'accent', 'accent']);
  assert.ok(cellsOf(out).slice(-2).every((c) => c.bold), 'existing bold is kept');
});

test('pulse: bright half then dim half, matching only the chosen roles', () => {
  const line = [span('on', { fg: 'accent', bold: true }), span('wn', { fg: 'warning' }), span('tx', {}), span('ab', { fg: 'primary' })];
  const roles = (time, opts) => cellsOf(pulse([line], { period: 1000, time, ...opts })[0]).map((c) => c.fg);
  const rest = ['accent', 'accent', 'warning', 'warning', 'secondary', 'secondary', 'primary', 'primary'];
  assert.deepEqual(roles(0), rest);
  assert.deepEqual(roles(499), rest);
  assert.deepEqual(roles(500), ['decorative', 'decorative', ...rest.slice(2)]);
  assert.deepEqual(roles(999), ['decorative', 'decorative', ...rest.slice(2)]);
  assert.deepEqual(roles(1000), rest);
  assert.deepEqual(roles(1500, { roles: ['accent', 'secondary', 'primary'] }), ['decorative', 'decorative', 'warning', 'warning', 'decorative', 'decorative', 'decorative', 'decorative']);
  assert.equal(cellsOf(pulse([line], { period: 1000, time: 500 })[0])[0].bold, false, 'dim state drops bold');
  assert.deepEqual({ ...PULSE_DEFAULTS, roles: [...PULSE_DEFAULTS.roles] }, { period: 2000, roles: ['accent'] });
});

test('pulse refuses to fade warning or critical, and rejects bad roles', () => {
  for (const roles of [['warning'], ['critical'], ['accent', 'critical'], [], 'accent', ['nope'], null]) {
    assert.throws(() => pulse([row('x')], { time: 0, roles }), RangeError, JSON.stringify(roles));
  }
});

test('reveal: wipe progress, line stagger, dim and blank veils, completion', () => {
  const lines = [row('abcdefghij', { fg: 'primary' }), row('klmnopqrst', { fg: 'primary' })];
  const opts = { duration: 1000, stagger: 500 };
  assert.equal(revealDuration(2, opts), 1500);
  const shown = (time, o = {}) => reveal(lines, { ...opts, time, ...o }).map((l) => cellsOf(l).map((c) => (c.fg === 'primary' ? 'x' : '.')).join(''));
  assert.deepEqual(shown(0), ['..........', '..........']);
  assert.deepEqual(shown(500), ['xxxxx.....', '..........']);
  assert.deepEqual(shown(750), ['xxxxxxx...', 'xx........']);
  assert.deepEqual(shown(1000), ['xxxxxxxxxx', 'xxxxx.....']);
  assert.deepEqual(shown(1499), ['xxxxxxxxxx', 'xxxxxxxxx.']);
  assert.equal(plain(reveal(lines, { ...opts, time: 1500 })).join('|'), plain(lines).join('|'));
  assert.deepEqual(color(reveal(lines, { ...opts, time: 1500 })), color(lines));
  assert.deepEqual(color(reveal(lines, { ...opts, time: 1e9 })), color(lines));
  // Dim veil keeps the characters; blank veil swaps unrevealed ones for spaces.
  assert.equal(plain(reveal(lines, { ...opts, time: 500 }))[0], 'abcdefghij');
  assert.equal(plain(reveal(lines, { ...opts, time: 500, veil: 'blank' }))[0], 'abcde     ');
  assert.equal(plain(reveal(lines, { ...opts, time: 0, veil: 'blank' }))[1], '          ');
  assert.equal(cellsOf(reveal(lines, { ...opts, time: 500 })[0])[9].fg, 'structural');
  assert.deepEqual({ ...REVEAL_DEFAULTS }, { duration: 600, stagger: 60, veil: 'dim' });
});

test('reveal never veils warning or critical cells', () => {
  const line = [span('ab', { fg: 'secondary' }), span('WARN', { fg: 'warning' }), span('ERR', { fg: 'critical' })];
  for (const veil of ['dim', 'blank']) {
    const out = reveal([line], { time: 0, veil })[0];
    assert.equal(paint(out, 'none'), veil === 'blank' ? '  WARNERR' : 'abWARNERR');
    assert.deepEqual(cellsOf(out).slice(2).map((c) => c.fg), ['warning', 'warning', 'warning', 'warning', 'critical', 'critical', 'critical']);
  }
  // A real error row keeps its full word and marker at the veiled start.
  const [errRow] = statusRow({ label: 'PARSE', value: 'failed', status: 'error' }, { width: 48 });
  assert.ok(paint(reveal([errRow], { time: 0, veil: 'blank' })[0], 'none').endsWith('✕ ERROR'));
});

test('state-colored backgrounds are protected as well as foregrounds', () => {
  for (const tone of ['warning', 'critical']) {
    const lines = [labelPlate('FAULT E21', { tone }), [span('DETAILS', { fg: 'primary', bg: tone })]];
    assert.deepEqual(color(scan(lines, { time: 1200, band: 100 })), color(lines));
    assert.deepEqual(color(pulse(lines, { time: 1200, roles: ['primary'] })), color(lines));
    assert.deepEqual(color(reveal(lines, { time: 0, veil: 'blank' })), color(lines));
  }
});

test('revealDuration validates lineCount and options', () => {
  assert.equal(revealDuration(0), 600);
  assert.equal(revealDuration(1), 600);
  assert.equal(revealDuration(10), 600 + 9 * 60);
  for (const n of [-1, 1.5, '3', Number.NaN, Infinity]) assert.throws(() => revealDuration(n), RangeError);
  assert.throws(() => revealDuration(2, { duration: 0 }), RangeError);
});

test('invalid options are rejected, not clamped or ignored', () => {
  const bad = [
    [scan, { time: 0, period: MIN_PERIOD_MS - 1 }],
    [scan, { time: 0, period: Number.NaN }],
    [scan, { time: 0, period: '2000' }],
    [scan, { time: 0, period: 60001 }],
    [scan, { time: 0, band: 0 }],
    [scan, { time: 0, band: 1.5 }],
    [scan, { time: 0, band: 1001 }],
    [scan, { time: 0, axis: 'z' }],
    [pulse, { time: 0, period: 0 }],
    [pulse, { time: 0, period: Infinity }],
    [reveal, { time: 0, duration: 0 }],
    [reveal, { time: 0, duration: -5 }],
    [reveal, { time: 0, stagger: -1 }],
    [reveal, { time: 0, stagger: 1001 }],
    [reveal, { time: 0, veil: 'hide' }],
  ];
  for (const [motion, options] of bad) assert.throws(() => motion([row('x')], options), RangeError, JSON.stringify(options));
  assert.doesNotThrow(() => scan([row('x')], { time: 0, period: MIN_PERIOD_MS }));
  assert.doesNotThrow(() => pulse([row('x')], { time: 0, period: MIN_PERIOD_MS }));
  // Typos and cross-motion options throw; prototype keys are not options.
  for (const motion of Object.values(MOTIONS)) {
    assert.throws(() => motion([row('x')], { time: 0, peroid: 900 }), TypeError);
    assert.throws(() => motion([row('x')], JSON.parse('{"time":0,"__proto__":1}')), TypeError);
    assert.throws(() => motion([row('x')], { time: 0, toString: 1 }), TypeError);
    for (const options of [null, 5, 'time', []]) assert.throws(() => motion([row('x')], options), TypeError);
    // Invalid options are rejected even when motion is off.
    assert.throws(() => motion([row('x')], { animate: false, animate2: 1 }), TypeError);
    assert.throws(() => motion([row('x')], { animate: 'no', time: 0 }), TypeError);
  }
  assert.throws(() => scan([row('x')], { animate: false, band: 0 }), RangeError);
  assert.throws(() => scan([row('x')], { time: 0, pulse: 1 }), TypeError);
});

test('invalid lines are rejected', () => {
  for (const motion of Object.values(MOTIONS)) {
    for (const lines of [null, undefined, 'abc', {}, [null], ['abc'], [[null]], [[{ style: {} }]], [[{ text: 5 }]]]) {
      assert.throws(() => motion(lines, { time: 0 }), TypeError, JSON.stringify(lines));
      assert.throws(() => motion(lines, { animate: false }), TypeError);
    }
  }
});

test('empty and tiny blocks are valid', () => {
  for (const motion of Object.values(MOTIONS)) {
    assert.deepEqual(motion([], { time: 500 }), []);
    assert.deepEqual(motion([[]], { time: 500 }), [[]]);
    const one = [[span('a', { fg: 'accent' })]];
    for (const time of [0, 100, 600, 1200, 5000]) assert.equal(lineWidth(motion(one, { time })[0]), 1);
  }
});

test('there is no frequency cap: a 50 ms period cycles 20 times a second, and motion-off settles it', () => {
  const lines = [row('abcdef', { fg: 'accent' })];
  assert.equal(MIN_PERIOD_MS, 1);
  // Count a cell's rising edges (dim to accent) in one second, sampled every millisecond.
  let edges = 0;
  for (let t = 1; t <= 1000; t++) {
    const was = cellsOf(pulse(lines, { period: 50, time: t - 1 })[0])[0].fg === 'accent';
    const is = cellsOf(pulse(lines, { period: 50, time: t })[0])[0].fg === 'accent';
    if (is && !was) edges++;
  }
  assert.equal(edges, 20);
  assert.doesNotThrow(() => scan(lines, { period: 1, time: 0 }));
  for (const motion of [scan, pulse]) assert.deepEqual(motion(lines, { period: 50, animate: false }), lines);
});

test('motions compose with real renderers at the width they were rendered for', () => {
  const body = [...gauge({ label: 'FILL', value: 64 }, { width: panelInnerWidth(48) }), ...statusRow({ label: 'DOOR', value: 'closed', status: 'success' }, { width: panelInnerWidth(48) })];
  const panel = numberedPanel({ number: 2, title: 'SPECIMEN' }, body, { width: 48 });
  for (const time of [0, 250, 1000, 2399]) {
    const frame = pulse(scan(reveal(panel, { time }), { time }), { time });
    assert.deepEqual(frame.map(lineWidth), panel.map(lineWidth));
    assert.deepEqual(plain(scan(panel, { time })), plain(panel));
  }
  // Animating only the body leaves the frame untouched.
  const lit = numberedPanel({ number: 2, title: 'SPECIMEN' }, scan(body, { time: 1200 }), { width: 48 });
  assert.deepEqual(plain(lit), plain(panel));
});

test('primitives stay pure: standard-library-free, no clock, timer, I/O, or randomness', () => {
  const files = readdirSync(new URL('.', import.meta.url)).filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs'));
  assert.ok(files.includes('frame.mjs') && files.includes('scan.mjs'));
  for (const file of files) {
    const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
    const code = source.split('\n').filter((l) => !l.trimStart().startsWith('//')).join('\n');
    const imports = [...code.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    assert.ok(imports.every((i) => i.startsWith('./') || i.startsWith('../foundation/')), `${file} imports ${imports}`);
    assert.doesNotMatch(code, /\b(Date|performance|setTimeout|setInterval|setImmediate|queueMicrotask|process|console|Math\.random|require)\b/, file);
  }
});

test('restyleCells exempts state cells unless a motion opts in, and then keeps their cue readable', () => {
  const lines = [[span('▲ WARN', { fg: 'warning', bold: true }), span(' ok', { fg: 'accent' })]];
  const grey = () => ({ style: { fg: 'decorative' } });
  assert.deepEqual(cellsOf(restyleCells(lines, grey)[0]).map((c) => c.fg), ['warning', 'warning', 'warning', 'warning', 'warning', 'warning', 'decorative', 'decorative', 'decorative']);
  const seen = [];
  restyleCells(lines, (style, col, row, ch, state) => { seen.push(state); }, { stateCells: true });
  assert.deepEqual(seen, [true, true, true, true, true, true, false, false, false]);
  // Allowed: tint, invert, or resize a glyph; the word keeps its letters.
  const tinted = restyleCells(lines, (style, col, row, ch, state) => (state ? { style: { ...style, fg: '#6c4f29' }, char: ch === '▲' ? '▴' : undefined } : undefined), { stateCells: true });
  assert.equal(cellsOf(tinted[0]).map((c) => c.ch).join(''), '▴ WARN ok');
  const inverted = restyleCells(lines, (style, col, row, ch, state) => (state ? { style: { fg: 'field', bg: 'warning', bold: true } } : undefined), { stateCells: true });
  assert.equal(cellsOf(inverted[0])[0].bg, 'warning');
  // Not allowed: blank, hide on the field, or change a letter.
  assert.throws(() => restyleCells(lines, (s, c, r, ch, state) => (state ? { char: ' ' } : undefined), { stateCells: true }), /blank/);
  assert.throws(() => restyleCells(lines, (s, c, r, ch, state) => (state ? { style: { fg: '#000000' } } : undefined), { stateCells: true }), /hide/);
  assert.throws(() => restyleCells(lines, (s, c, r, ch, state) => (state && ch === 'W' ? { char: 'X' } : undefined), { stateCells: true }), /state word/);
});

test('resolveRegion validates a cell rectangle and inRegion tests membership', () => {
  assert.deepEqual({ ...resolveRegion('m') }, { top: 0, left: 0, rows: Infinity, cols: Infinity });
  const r = resolveRegion('m', { top: 1, left: 2, cols: 3 });
  assert.ok(inRegion(r, 2, 1) && inRegion(r, 4, 9) && !inRegion(r, 5, 1) && !inRegion(r, 2, 0));
  for (const bad of [{ top: -1 }, { left: 1.5 }, { rows: '2' }, { top: Infinity }]) assert.throws(() => resolveRegion('m', bad), RangeError, JSON.stringify(bad));
  for (const bad of [null, [], 3, { width: 2 }]) assert.throws(() => resolveRegion('m', bad), TypeError, JSON.stringify(bad));
});

test('the state cue guard knows a full block shows only its foreground', () => {
  for (const role of ['warning', 'critical']) {
    const onField = [[span('█', { fg: role, bg: 'field' })]];
    const onWhite = [[span('█', { fg: role, bg: 'primary' })]];
    // A black block on the field is hidden even though its colors differ.
    assert.throws(() => restyleCells(onField, () => ({ style: { fg: 'field', bg: role } }), { stateCells: true }), /hide/);
    // A white block on a white background still shows against the field.
    assert.doesNotThrow(() => restyleCells(onWhite, () => ({ style: { fg: 'primary', bg: 'primary' } }), { stateCells: true }));
    assert.ok(glyphVisible({ fg: role, bg: role }, '█'));
    assert.ok(!glyphVisible({ fg: role, bg: role }, '▲'));
    assert.ok(!glyphVisible({ fg: '#000000' }, '█'));
  }
  // invertCell swaps ordinary glyphs, recolors a block to its background, and keeps a block on the field.
  assert.deepEqual(invertCell({ fg: 'warning', bg: 'field' }, '▲'), { fg: 'field', bg: 'warning' });
  assert.deepEqual(invertCell({ fg: 'warning', bg: 'surface' }, '█'), { fg: 'surface', bg: 'surface' });
  assert.equal(invertCell({ fg: 'warning', bg: 'field' }, '█'), undefined);
  assert.equal(invertCell({ fg: 'accent', bg: 'accent' }, 'x'), undefined);
});
