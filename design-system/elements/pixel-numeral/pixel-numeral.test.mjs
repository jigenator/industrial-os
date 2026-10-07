import test from 'node:test';
import assert from 'node:assert/strict';
import { stripVTControlCharacters } from 'node:util';
import { GLYPHS, lineWidth, paint } from '../../foundation/cells.mjs';
import { FONT, NUMERAL_TONES, numeralAt, numeralGrid, numeralLines, pixelNumeral } from './pixel-numeral.mjs';
const text = (lines) => lines.map((line) => paint(line, 'none'));

test('exact extension pixel snapshots and 13-column minimum', () => {
  // footer.ts:325-346 FONT/grid and 1483-1487 half-block renderer, without the footer spine/caption.
  assert.deepEqual(text(pixelNumeral({ value: 64 }, { width: 13 })), ['█▀▀ █ █   █▀█', '█▀█ ▀▀█   █ █', '▀▀▀   ▀ ▀ ▀▀▀']);
  assert.deepEqual(text(pixelNumeral({ value: null }, { width: 13 })), ['▀▀█          ', ' ▀▀          ', ' ▀           ']);
  assert.equal(numeralGrid(0).w, 13);
  assert.equal(numeralGrid(100).w, 17);
  assert.equal(numeralGrid(-1.2).w, 13);
  assert.deepEqual(Object.keys(FONT), ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '-', '?']);
});
test('each tone matches extension NUM, unknown is not zero', () => {
  for (const [value, tone] of [[0, 'ok'], [70, 'ok'], [70.1, 'warn'], [90, 'warn'], [90.1, 'high'], [null, 'unknown']]) {
    assert.equal(numeralGrid(value).g.flat().find((c) => c), NUMERAL_TONES[tone]);
  }
  assert.notDeepEqual(text(pixelNumeral({ value: null }, { width: 13 })), text(pixelNumeral({ value: 0 }, { width: 13 })));
  assert.equal(numeralGrid(5, { tone: 'warn' }).g[0][0], 'warning');
});
test('exponents and narrow values use truthful small text, not clipped pixel digits', () => {
  assert.equal(numeralGrid(1e21), undefined);
  assert.deepEqual(text(pixelNumeral({ value: 1e21 }, { width: 6 })), ['1e+21 ', '      ', '      ']);
  assert.deepEqual(text(pixelNumeral({ value: 100 }, { width: 1 })), ['#', ' ', ' ']);
  assert.deepEqual(text(pixelNumeral({ value: null }, { width: 1 })), ['?', ' ', ' ']);
});
test('reconstruction is seeded, pure, new-shape-only, and settles exactly', () => {
  // footer.ts:351-359 Bayer + hash. Old-only pixels disappear even at progress zero.
  const target = numeralGrid(1), from = numeralGrid(100), saved = structuredClone([target, from]);
  const start = numeralAt(target, from, 0, 42);
  assert.equal(start.w, target.w);
  target.g.forEach((row, y) => row.forEach((ink, x) => {
    if (ink === null) assert.equal(start.g[y][x], null);
    else assert.equal(start.g[y][x], from.g[y][x] === ink ? ink : 'decorative');
  }));
  assert.deepEqual(numeralAt(target, from, 1, 42), target);
  assert.deepEqual(numeralAt(target, from, 0.6, 42), numeralAt(target, from, 0.6, 42));
  assert.notDeepEqual(numeralAt(target, from, 0.6, 42), numeralAt(target, from, 0.6, 123));
  assert.deepEqual([target, from], saved);
  const unknown = numeralGrid(null);
  assert.equal(numeralAt(unknown, numeralGrid(0), 0, 1).g[0][0], 'secondary');
});
test('different half inks survive as foreground/background pixels', () => {
  const grid = { w: 1, g: [['warning'], ['critical'], [null], ['accent'], ['primary'], [null]] };
  assert.deepEqual(numeralLines(grid, { width: 1 }).map((line) => line[0]), [
    { text: '▀', style: { fg: 'warning', bg: 'critical' } }, { text: '▄', style: { fg: 'accent' } }, { text: '▀', style: { fg: 'primary' } },
  ]);
});
test('all widths 1–160: every tone, negative, exponent and frame paint equally with curated glyphs', () => {
  for (let width = 1; width <= 160; width++) {
    for (const value of [0, 37.5, 71, 95, null, -1.2, 1e21]) {
      for (const line of pixelNumeral({ value }, { width })) {
        const plain = paint(line, 'none');
        assert.equal(lineWidth(line), width);
        assert.ok([...plain].every((c) => /[\x20-\x7e]/.test(c) || GLYPHS.includes(c)));
        assert.equal(stripVTControlCharacters(paint(line, 'truecolor')), plain);
      }
    }
    if (width >= 13) for (const progress of [0, 0.3, 0.8, 1]) {
      for (const line of numeralLines(numeralAt(numeralGrid(95), numeralGrid(0), progress, 2), { width })) {
        assert.equal(lineWidth(line), width);
        assert.equal(stripVTControlCharacters(paint(line, 'truecolor')), paint(line, 'none'));
      }
    }
  }
});
test('invalid dimensions, values, tones, grids, progress and seeds throw', () => {
  for (const value of [NaN, Infinity, '1', true]) assert.throws(() => numeralGrid(value), RangeError);
  assert.throws(() => numeralGrid(null, { tone: 'ok' }), RangeError);
  for (const tone of ['bad', '__proto__', 'constructor']) assert.throws(() => numeralGrid(0, { tone }), RangeError);
  assert.throws(() => pixelNumeral({ value: 1 }, { width: 0 }), RangeError);
  const grid = numeralGrid(0);
  for (const p of [-1, 1.1, NaN, Infinity, '0']) assert.throws(() => numeralAt(grid, grid, p, 1), RangeError);
  assert.throws(() => numeralAt(grid, grid, 0, 1.2), RangeError);
  assert.throws(() => numeralAt({}, grid, 0, 1), TypeError);
  assert.throws(() => numeralLines(grid, { width: 1 }), RangeError);
  assert.throws(() => numeralLines({ w: 1, g: Array.from({ length: 6 }, () => ['bad']) }, { width: 1 }), TypeError);
});

test('E2 renderers import only foundation and contain no clock, timer, I/O or unseeded randomness', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const name of ['gauge', 'pixel-numeral', 'segment-meter', 'state-chip', 'mode-plate']) {
    const source = await readFile(new URL(`../${name}/${name}.mjs`, import.meta.url), 'utf8');
    for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) assert.ok(match[1].startsWith('../../foundation/'));
    assert.doesNotMatch(source, /\b(?:Date|performance|process|setTimeout|setInterval|fetch)\b|Math\.random/);
  }
});
