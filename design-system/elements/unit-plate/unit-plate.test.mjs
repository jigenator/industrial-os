import test from 'node:test';
import assert from 'node:assert/strict';
import { stripVTControlCharacters } from 'node:util';
import { GLYPHS, lineWidth, paint, resolveStyle } from '../../foundation/cells.mjs';
import { SIGNAL_COLORS } from '../../foundation/signal-colors.mjs';
import { aluminiumAt } from '../../foundation/surface.mjs';
import { SURFACE_PALETTE } from '../../foundation/surface-palette.mjs';
import { UNIT_PLATE_ROWS, unitPlate } from './unit-plate.mjs';

const UNIT = { unit: 'DRD-C0DE', serial: '0000-BEEF', seed: 0xbeef };
const cellsOf = (line) => line.flatMap((s) => [...s.text].map((ch) => ({ ch, ...resolveStyle(s.style) })));
const text = (lines) => lines.map((line) => line.map((s) => s.text).join(''));

// The approved droid header mockup's plate rows (droid-header-concepts k-motion g-shared.mjs, session 0000BEEF).
const MOCKUP_104 = [
  '+─────────────────────────────────────────────────────◢───◤◥───◣───────────────────────────────────────+',
  '  INDUSTRIAL-OS ®                                    ◢   ◤  ◥   ◣                     ⟁ PI AGENT DROID  ',
  '  █▀▄ █▀▄ █▀▄     █▀▀ █▀█ █▀▄ █▀▀                   ◢   ◤    ◥   ◣                    ▌ ▌ ▍ ▍▏█▎▍ ▏█▎▐  ',
  '  █ █ █▀▄ █ █ ▀▀▀ █   █ █ █ █ █▀▀                  ◢   ◤      ◥   ◣                   ▌ ▌ ▍ ▍▏█▎▍ ▏█▎▐  ',
  '  ▀▀  ▀ ▀ ▀▀      ▀▀▀ ▀▀▀ ▀▀  ▀▀▀                 ◢   ◤        ◥   ◣                  HALDENN DYNAMICS  ',
  '+ S/N 0000-BEEF ─────────────────────────────────◢───◤──────────◥───◣──────────────────────────────────+',
];
const MOCKUP_64 = [
  '+──────────────────────────────────────────────────────────────+',
  '  INDUSTRIAL-OS ®                             ⟁ PI AGENT DROID  ',
  '  █▀▄ █▀▄ █▀▄     █▀▀ █▀█ █▀▄ █▀▀             ▌ ▌ ▍ ▍▏█▎▍ ▏█▎▐  ',
  '  █ █ █▀▄ █ █ ▀▀▀ █   █ █ █ █ █▀▀             ▌ ▌ ▍ ▍▏█▎▍ ▏█▎▐  ',
  '  ▀▀  ▀ ▀ ▀▀      ▀▀▀ ▀▀▀ ▀▀  ▀▀▀             HALDENN DYNAMICS  ',
  '+ S/N 0000-BEEF ───────────────────────────────────────────────+',
];

test('the plate matches the approved mockup at 104 and 64 cells: blocks, barcode, serial and peak', () => {
  assert.deepEqual(text(unitPlate(UNIT, { width: 104 }).lines), MOCKUP_104);
  assert.deepEqual(text(unitPlate(UNIT, { width: 64 }).lines), MOCKUP_64);
  const { lines, paint: strokes } = unitPlate(UNIT, { width: 104 });
  // Two strokes a row, three solid cells between their slanted edges, moving out a cell per row.
  assert.deepEqual(strokes.slice(0, 4), [{ row: 0, start: 54, end: 59 }, { row: 0, start: 59, end: 64 }, { row: 1, start: 53, end: 58 }, { row: 1, start: 60, end: 65 }]);
  assert.equal(strokes.length, 12);
  const row1 = cellsOf(lines[1]);
  assert.deepEqual(row1.slice(2, 15).map((c) => [c.fg, c.bold]), Array(13).fill(['#000000', true]));
  assert.deepEqual([row1[53].ch, row1[53].fg, row1[53].bg], ['◢', '#c0fe04', aluminiumAt(53, 1, { width: 104 }).ground]);
  assert.deepEqual([row1[54].bg, row1[54].fg], ['#c0fe04', SIGNAL_COLORS.accent75]);
  assert.deepEqual([cellsOf(lines[0])[55].ch, cellsOf(lines[0])[55].bg], ['─', '#c0fe04'], 'the hairline runs on under the paint');
  assert.equal(cellsOf(lines[4])[86].fg, SURFACE_PALETTE.aluminiumLabel);
});

test('every width 1–160 gives six exact rows on the aluminium ground, with curated glyphs only', () => {
  for (const input of [UNIT, { ...UNIT, unit: 'DRD-????', serial: '????-????' }, { ...UNIT, maker: 'A-VERY-LONG-MAKER-NAME-THAT-KEEPS-GOING', registered: false, mark: null }]) {
    for (let width = 1; width <= 160; width++) for (const titleBlock of [true, false]) {
      const { lines, paint: strokes } = unitPlate(input, { width, titleBlock });
      assert.equal(lines.length, UNIT_PLATE_ROWS);
      const painted = new Set(strokes.flatMap((s) => Array.from({ length: s.end - s.start }, (_, i) => `${s.row}:${s.start + i}`)));
      lines.forEach((line, y) => {
        assert.equal(lineWidth(line), width, `${width} row ${y}`);
        assert.equal(stripVTControlCharacters(paint(line, 'truecolor')), paint(line, 'none'));
        cellsOf(line).forEach((c, x) => {
          assert.ok(/[\x20-\x7e]/.test(c.ch) || GLYPHS.includes(c.ch), c.ch);
          const { ground, hair } = aluminiumAt(x, y, { width });
          if (c.bg === '#c0fe04') assert.ok(painted.has(`${y}:${x}`), `paint at ${width} ${y}:${x} is listed`);
          else assert.equal(c.bg, ground, `${width} ${y}:${x}`);
          if (c.ch === '─' && c.bg !== '#c0fe04') assert.equal(c.fg, hair);
        });
      });
      if (!titleBlock) assert.deepEqual(strokes, []);
    }
  }
});

test('the title block and peak need room; the wordmark falls back to text; unknown digits are grey', () => {
  // The title block needs two cells clear of the left block, and the peak two and three cells clear of the blocks.
  assert.doesNotMatch(text(unitPlate(UNIT, { width: 48 }).lines).join('\n'), /⟁|HALDENN|◢/);
  assert.match(text(unitPlate(UNIT, { width: 56 }).lines).join('\n'), /⟁ PI AGENT DROID/);
  const stroke = (width) => { const p = unitPlate(UNIT, { width }).paint; return p.length ? p[0].end - p[0].start - 2 : 0; };
  assert.deepEqual([64, 71, 72, 74, 76, 104].map(stroke), [0, 0, 1, 2, 3, 3]);
  assert.deepEqual(text(unitPlate(UNIT, { width: 104, titleBlock: false }).lines).slice(1, 3).map((r) => r.trimEnd()), ['  INDUSTRIAL-OS ®', '  █▀▄ █▀▄ █▀▄     █▀▀ █▀█ █▀▄ █▀▀']);
  // Too narrow for the pixels: the unit as bold text, cut with an ellipsis.
  const narrow = unitPlate(UNIT, { width: 20 }).lines;
  assert.equal(text(narrow)[2], '  DRD-C0DE          ');
  assert.equal(text(unitPlate(UNIT, { width: 8 }).lines)[2], '  DRD-… ');
  const unknown = cellsOf(unitPlate({ ...UNIT, unit: 'DRD-????' }, { width: 104 }).lines[2]);
  assert.ok(unknown.slice(18, 33).filter((c) => c.ch !== ' ').every((c) => c.fg === SURFACE_PALETTE.aluminiumLabel));
  assert.ok(unknown.slice(2, 17).filter((c) => c.ch !== ' ').every((c) => c.fg === '#000000'));
  // The barcode is the seed's: the same seed the same bars, another seed others.
  const bars = (seed) => text(unitPlate({ ...UNIT, seed }, { width: 104 }).lines)[2].slice(86, 102);
  assert.equal(bars(0xbeef), bars(0xbeef));
  assert.notEqual(bars(1), bars(2));
  // A long maker keeps the peak clear of it, then displaces the title block; past the margin it loses ® first, then clips.
  const maker = (n) => text(unitPlate({ ...UNIT, maker: 'M'.repeat(n) }, { width: 104 }).lines);
  assert.match(maker(40)[1], /^ {2}M{40} ® +◢ +◤ +◥ +◣ +⟁ PI AGENT DROID {2}$/);
  assert.match(maker(80)[1], /^ {2}M{80} ® {2}⟁ PI AGENT DROID {2}$/);
  assert.doesNotMatch(maker(80).join('\n'), /◢/);
  assert.match(maker(90)[1], /^ {2}M{90} ® {10}$/);
  assert.equal(maker(100)[1], `  ${'M'.repeat(100)}  `);
  assert.equal(maker(120)[1], `  ${'M'.repeat(100)}… `);
});

test('invalid input throws and the input is not changed', () => {
  const input = { ...UNIT, division: ['A', 'B'] };
  const before = structuredClone(input);
  unitPlate(input, { width: 60 });
  assert.deepEqual(input, before);
  for (const bad of [null, [], 'x']) assert.throws(() => unitPlate(bad, { width: 60 }), TypeError);
  for (const [field, value] of [['unit', 7], ['serial', null], ['maker', 1], ['title', 2], ['registered', 'yes'], ['mark', 'ab'], ['mark', '日'], ['division', ['A']], ['division', 'AB']]) {
    assert.throws(() => unitPlate({ ...UNIT, [field]: value }, { width: 60 }), TypeError, field);
  }
  for (const [field, value] of [['unit', ''], ['unit', 'drd'], ['unit', 'DRD-XYZ'], ['serial', ''], ['seed', 1.5]]) {
    assert.throws(() => unitPlate({ ...UNIT, [field]: value }, { width: 60 }), RangeError, field);
  }
  for (const width of [0, 1001, 1.5, undefined]) assert.throws(() => unitPlate(UNIT, { width }), RangeError);
  assert.throws(() => unitPlate(UNIT, { width: 60, titleBlock: 'no' }), TypeError);
});
