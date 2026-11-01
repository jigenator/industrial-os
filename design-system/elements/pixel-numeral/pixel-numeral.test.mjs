import test from 'node:test';
import assert from 'node:assert/strict';
import { stripVTControlCharacters } from 'node:util';
import { GLYPHS, lineWidth, paint, span } from '../../foundation/cells.mjs';
import { FONT, HEX_FONT, LETTER_FONT, NUMERAL_TONES, numeralAt, numeralGrid, numeralLines, pixelNumeral, textGrid } from './pixel-numeral.mjs';
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
test('hex text grids: exact width, distinct letters, the same packing and reconstruction', () => {
  assert.deepEqual(Object.keys(HEX_FONT), ['A', 'B', 'C', 'D', 'E', 'F']);
  assert.ok(Object.isFrozen(HEX_FONT) && Object.values(HEX_FONT).every(Object.isFrozen));
  // A unit code: four glyphs and three gaps, no 13-column minimum and no number formatting.
  const unit = textGrid('C0DE');
  assert.equal(unit.w, 15);
  assert.deepEqual(text(numeralLines(unit, { width: 15 })), ['█▀▀ █▀█ █▀▄ █▀▀', '█   █ █ █ █ █▀▀', '▀▀▀ ▀▀▀ ▀▀  ▀▀▀']);
  assert.deepEqual(text(numeralLines(textGrid('ABDEF'), { width: 19 })), ['█▀█ █▀▄ █▀▄ █▀▀ █▀▀', '█▀█ █▀▄ █ █ █▀▀ █▀▀', '▀ ▀ ▀▀  ▀▀  ▀▀▀ ▀  ']);
  // Every letter differs from every digit that shares its outline, and from the others.
  const shapes = [...Object.values(FONT), ...Object.values(HEX_FONT)].map((rows) => rows.join('/'));
  assert.equal(new Set(shapes).size, shapes.length);
  assert.equal(textGrid('7').w, 3);
  assert.ok(textGrid('BEEF').g.flat().filter(Boolean).every((ink) => ink === 'primary'));
  assert.ok(textGrid('????', { ink: 'decorative' }).g.flat().filter(Boolean).every((ink) => ink === 'decorative'));
  assert.deepEqual(numeralAt(unit, { w: 15, g: Array.from({ length: 6 }, () => Array(15).fill(null)) }, 1, 7), unit);
  // numeralGrid keeps its digit-only reading contract.
  assert.deepEqual(textGrid('64.0'), numeralGrid(64));
  for (const bad of ['', 'c0de', 'G', 'r', '1 2', 'A'.repeat(251)]) assert.throws(() => textGrid(bad), RangeError, JSON.stringify(bad));
  for (const bad of [null, 12, ['A']]) assert.throws(() => textGrid(bad), TypeError);
  assert.throws(() => textGrid('A', { ink: 'bad' }), TypeError);
});
test('unit-code letters: R draws DRD- in the same stroke, never as A, in the instrument and dashboard faces', () => {
  assert.deepEqual(Object.keys(LETTER_FONT), ['R']);
  assert.ok(Object.isFrozen(LETTER_FONT) && Object.values(LETTER_FONT).every(Object.isFrozen));
  assert.deepEqual(LETTER_FONT.R, ['110', '101', '110', '101', '101']);
  // The droid header's wordmark: eight glyphs and seven gaps.
  const mark = textGrid('DRD-C0DE');
  assert.equal(mark.w, 31);
  assert.deepEqual(text(numeralLines(mark, { width: 31 })), ['█▀▄ █▀▄ █▀▄     █▀▀ █▀█ █▀▄ █▀▀', '█ █ █▀▄ █ █ ▀▀▀ █   █ █ █ █ █▀▀', '▀▀  ▀ ▀ ▀▀      ▀▀▀ ▀▀▀ ▀▀  ▀▀▀']);
  const shapes = [...Object.values(FONT), ...Object.values(HEX_FONT), ...Object.values(LETTER_FONT)].map((rows) => rows.join('/'));
  assert.equal(new Set(shapes).size, shapes.length);
  assert.deepEqual(textGrid('R', { face: 'dashboard' }), textGrid('R'));
  assert.throws(() => textGrid('R', { face: 'tall' }), RangeError);
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

test('dashboard face: rounded digits through textGrid, default face unchanged', async () => {
  const { DASHBOARD_FONT } = await import('./pixel-numeral.mjs');
  assert.ok(Object.isFrozen(DASHBOARD_FONT) && Object.values(DASHBOARD_FONT).every(Object.isFrozen));
  assert.deepEqual(textGrid('42'), textGrid('42', { face: 'instrument' }));
  assert.deepEqual(text(numeralLines(textGrid('2357', { face: 'dashboard' }), { width: 15 })), ['▀▀▄ ▀▀▄ █▀▀ ▀▀█', '▄▀   ▀▄ ▀▀▄  █ ', '▀▀▀ ▀▀  ▀▀   ▀ ']);
  for (const value of ['0', '1', '42', String(Number.MAX_SAFE_INTEGER), '?']) {
    const grid = textGrid(value, { face: 'dashboard', ink: 'decorative' });
    assert.equal(grid.w, value.length * 4 - 1);
    assert.equal(lineWidth(numeralLines(grid, { width: grid.w })[0]), grid.w);
  }
  assert.notDeepEqual(textGrid('?', { face: 'dashboard' }), textGrid('0', { face: 'dashboard' }));
  assert.notDeepEqual(textGrid('2', { face: 'dashboard' }), textGrid('2'));
  for (const face of ['', 'Dashboard', '__proto__', null]) assert.throws(() => textGrid('1', { face }), RangeError);
});

test('the tall face: a condensed 4×9 font in five rows, with a narrow colon and minus', async () => {
  const { TALL_FONT } = await import('./pixel-numeral.mjs');
  assert.ok(Object.isFrozen(TALL_FONT));
  assert.deepEqual(Object.keys(TALL_FONT).sort(), ['-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', '?']);
  for (const [ch, rows] of Object.entries(TALL_FONT)) {
    assert.equal(rows.length, 9, ch);
    assert.equal(new Set(rows.map((r) => r.length)).size, 1, ch);
    assert.ok(rows.every((r) => /^[01]+$/.test(r)), ch);
  }
  assert.equal(new Set(Object.values(TALL_FONT).map((rows) => rows.join('/'))).size, 13, 'every tall glyph is distinct');
  const grid = textGrid('12:05', { ink: 'accent', face: 'tall' });
  assert.equal(grid.w, 4 + 1 + 4 + 1 + 1 + 1 + 4 + 1 + 4);
  assert.equal(grid.g.length, 10);
  assert.ok(grid.g[9].every((c) => c === null), 'the tenth pixel row is empty');
  const lines = numeralLines(grid, { width: grid.w });
  assert.equal(lines.length, 5);
  assert.deepEqual(numeralLines(textGrid('0', { face: 'tall' }), { width: 4 }).map((l) => paint(l, 'none')), ['▄▀▀▄', '█  █', '█  █', '█  █', ' ▀▀ ']);
  assert.deepEqual(numeralLines(textGrid('-', { face: 'tall' }), { width: 3 }).map((l) => paint(l, 'none')), ['   ', '   ', '▀▀▀', '   ', '   ']);
  assert.deepEqual(numeralLines(textGrid('?', { face: 'tall' }), { width: 4 }).map((l) => paint(l, 'none')), ['▄▀▀▄', '   █', ' ▄▀ ', ' ▀  ', ' ▀  ']);
  // Blank cells carry no style, so a host can lay the numeral over its own background.
  assert.deepEqual(lines[0][4], span(' '));
  assert.throws(() => textGrid('1.5', { face: 'tall' }), RangeError);
  assert.throws(() => textGrid('A', { face: 'tall' }), RangeError);
  assert.throws(() => textGrid('1', { face: 'huge' }), RangeError);
  // Faces keep their own row counts; a reconstruction needs matching faces.
  assert.throws(() => numeralAt(grid, textGrid('12345', { face: 'dashboard' }), 0.5, 1), RangeError);
  assert.deepEqual(numeralAt(grid, grid, 0.5, 1), grid);
  assert.throws(() => textGrid('1', { face: 'small' }), RangeError);
});
