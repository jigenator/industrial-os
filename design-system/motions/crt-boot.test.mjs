import test from 'node:test';
import assert from 'node:assert/strict';
import { lineWidth, paint, resolveStyle, span } from '../foundation/cells.mjs';
import { unitPlate } from '../elements/unit-plate/unit-plate.mjs';
import { CRT_BOOT_TIMING as T, crtBoot, crtBootDuration } from './crt-boot.mjs';

const plate = unitPlate({ unit: 'DRD-C0DE', serial: '0000-BEEF', seed: 0xbeef }, { width: 64 });
const ledger = (n) => Array.from({ length: n }, (_, i) => [span(`  ROW ${String(i).padStart(2, '0')}`, { fg: 'secondary' }), span(' VALUE'.padEnd(54), { fg: 'primary', bg: 'field' })]);
const LINES = [...plate.lines, ...ledger(6)];
const OPTS = { seed: 0xbeef, paint: plate.paint };
const text = (lines) => lines.map((line) => paint(line, 'none'));
const cellsOf = (line) => line.flatMap((s) => [...s.text].map((ch) => ({ ch, ...resolveStyle(s.style) })));
const times = (end) => Array.from({ length: Math.ceil(end / 10) + 2 }, (_, i) => i * 10);

test('motion-off, the end and after give exactly the input; every frame is deterministic and exact width', () => {
  const before = structuredClone(LINES);
  const end = crtBootDuration(LINES, OPTS);
  assert.ok(end > T.ground && end < T.ground + T.spread + 1500, `${end}`);
  assert.deepEqual(crtBoot(LINES, { ...OPTS, animate: false }), LINES);
  for (const t of [end, end + 1, 1e9]) assert.deepEqual(crtBoot(LINES, { ...OPTS, time: t }), LINES);
  for (const t of times(end)) {
    const frame = crtBoot(LINES, { ...OPTS, time: t });
    assert.deepEqual(frame, crtBoot(LINES, { ...OPTS, time: t }), `${t}`);
    assert.equal(frame.length, LINES.length);
    frame.forEach((line, y) => assert.equal(lineWidth(line), lineWidth(LINES[y]), `${t} row ${y}`));
  }
  assert.deepEqual(LINES, before);
  // Another seed is another boot, with the same end only by chance of its pace.
  assert.notDeepEqual(crtBoot(LINES, { ...OPTS, time: 900 }), crtBoot(LINES, { ...OPTS, seed: 1, time: 900 }));
  assert.throws(() => crtBoot(LINES, OPTS), /time/);
});

test('power-on, the grounds, then each row typed left to right behind an acid cursor', () => {
  const mid = Math.floor(LINES.length / 2);
  const power = crtBoot(LINES, { ...OPTS, time: 0 });
  assert.ok(text(power).every((row) => row.trim() === ''), 'power-on shows no text');
  assert.notEqual(cellsOf(power[mid])[0].bg, cellsOf(power[0])[0].bg, 'the middle row lights');
  // The grounds: no ink yet, each cell's background, the plate's paint under the ground to its left.
  const grounds = crtBoot(LINES, { ...OPTS, time: T.power + 50 });
  assert.ok(!text(grounds).join('').match(/[A-Z█◢]/));
  // Mid-boot a typing row shows a cursor, typed text to its left and nothing to its right.
  let seen = 0;
  for (const t of times(crtBootDuration(LINES, OPTS))) {
    crtBoot(LINES, { ...OPTS, time: t }).forEach((line, y) => {
      const cells = cellsOf(line), at = cells.findIndex((c) => c.ch === '█' && c.fg === '#c0fe04');
      if (at < 0 || y < 6) return;
      seen++;
      assert.equal(cells.slice(at + 1).map((c) => c.ch).join('').trim(), '', `${t} row ${y}: nothing past the cursor`);
    });
  }
  assert.ok(seen > 20);
});

test('rows start a stagger apart, never spread more than 2.1 s, and a late arrival types from its time', () => {
  const started = (lines, options, y) => times(crtBootDuration(lines, options)).find((t) => text(crtBoot(lines, { ...options, time: t }))[y].trim() !== '' && t >= T.ground);
  for (const n of [6, 60, 200]) {
    const lines = ledger(n), last = started(lines, { seed: 3 }, n - 1);
    assert.ok(last <= T.ground + T.spread + T.jitter * T.chunk + 10, `${n} rows: last starts at ${last}`);
    assert.ok(crtBootDuration(lines, { seed: 3 }) <= T.ground + T.spread + T.jitter * T.chunk + (T.rowLimit + 1) * T.chunk + T.settle);
  }
  const late = { row: 6, time: 1500 };
  for (const t of times(1500)) if (t < 1500) assert.deepEqual(text(crtBoot(LINES, { ...OPTS, late, time: t })).slice(6).map((r) => r.trim()), Array(6).fill(''), `${t}`);
  assert.ok(crtBootDuration(LINES, { ...OPTS, late }) > 1500);
});

test('a line with a warning or critical cell shows settled in every frame; ground texture shows from the start', () => {
  const lines = [...ledger(3), [span('  ▲ FAILED', { fg: 'critical' }), span(' '.repeat(50))]];
  for (const t of times(crtBootDuration(lines))) assert.deepEqual(crtBoot(lines, { time: t })[3], lines[3], `${t}`);
  // Floor dots declared as ground: present before their row types, never garbled.
  const dots = [[span('· · · · ', { fg: 'secondary' }), span('TEXT')]];
  const ground = [{ row: 0, start: 0, end: 8 }];
  for (const t of [T.power, 200, 400, 500, 600]) {
    // Each dot cell is its dot, or the cursor passing over it.
    [...text(crtBoot(dots, { ground, time: t }))[0].slice(0, 8)].forEach((ch, x) => assert.ok(ch === '· · · · '[x] || ch === '█', `${t} ${x} ${ch}`));
  }
});

test('wide graphemes keep their cells with a measurer; invalid options throw', () => {
  const measure = (s) => [...s].reduce((n, ch) => n + (/\p{Script=Han}/u.test(ch) ? 2 : 1), 0);
  const lines = [[span('  界面 WIDE 界'.padEnd(30))], [span(' '.repeat(31))]];
  for (const t of times(crtBootDuration(lines, { measure }))) {
    crtBoot(lines, { measure, time: t }).forEach((line, y) => assert.equal(lineWidth(line, { measure }), lineWidth(lines[y], { measure }), `${t}`));
  }
  for (const bad of [{ seed: 1.5 }, { paint: [{ row: -1, start: 0, end: 1 }] }, { ground: [{ row: 0, start: 'a', end: 1 }] }, { late: { row: 1, time: -1 } }, { late: { row: 1.5, time: 0 } }]) {
    assert.throws(() => crtBoot(LINES, { ...bad, time: 0 }), RangeError, JSON.stringify(bad));
  }
  for (const bad of [{ paint: 'x' }, { paint: [null] }, { late: 'x' }, { measure: 'x' }]) assert.throws(() => crtBoot(LINES, { ...bad, time: 0 }), TypeError);
  assert.throws(() => crtBoot(LINES, { time: 0, speed: 2 }));
});
