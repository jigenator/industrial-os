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
  '+──────────────────────────────────────────────────────────────────────────────────────────────────+',
  '  INDUSTRIAL-OS ®                                                                 ⟁ PI AGENT DROID  ',
  '  █▀▄ █▀▄ █▀▄     █▀▀ █▀█ █▀▄ █▀▀                                                 ▌ ▌ ▍ ▍▏█▎▍ ▏█▎▐  ',
  '  █ █ █▀▄ █ █ ▀▀▀ █   █ █ █ █ █▀▀                                                 ▌ ▌ ▍ ▍▏█▎▍ ▏█▎▐  ',
  '  ▀▀  ▀ ▀ ▀▀      ▀▀▀ ▀▀▀ ▀▀  ▀▀▀                                                 HALDENN DYNAMICS  ',
  '+ S/N 0000-BEEF ───────────────────────────────────────────────────────────────────────────────────+',
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
  assert.deepEqual([row1[53].ch, row1[53].fg, row1[53].bg], ['', '#c0fe04', aluminiumAt(53, 1, { width: 104 }).ground]);
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
        assert.doesNotMatch(paint(line, 'none'), /[◢◤◣◥]/u, 'the peak edges are the Powerline triangles');
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
  assert.doesNotMatch(text(unitPlate(UNIT, { width: 48 }).lines).join('\n'), /⟁|HALDENN|/);
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
  assert.match(maker(40)[1], /^ {2}M{40} ® + + + + +⟁ PI AGENT DROID {2}$/);
  assert.match(maker(80)[1], /^ {2}M{80} ® {2}⟁ PI AGENT DROID {2}$/);
  assert.doesNotMatch(maker(80).join('\n'), //);
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
  for (const [field, value] of [['unit', ''], ['unit', 'drd'], ['unit', 'DRD-#'], ['serialLabel', ''], ['serialLabel', 'A B'], ['serial', ''], ['seed', 1.5]]) {
    assert.throws(() => unitPlate({ ...UNIT, [field]: value }, { width: 60 }), RangeError, field);
  }
  for (const width of [0, 1001, 1.5, undefined]) assert.throws(() => unitPlate(UNIT, { width }), RangeError);
  assert.throws(() => unitPlate(UNIT, { width: 60, titleBlock: 'no' }), TypeError);
});

// The pane plates (the Herdr pane header's terminal and agent plates). Their cells were compared with the approved
// sticky droid plate mockup (revision 7) at 40–120 cells and every lighting level; see CONTRIBUTING.md.
const TERM = { unit: 'TERM-ZSH', serial: '~/projects/lunalee', serialLabel: 'DIR', title: '', mark: null, division: ['BRANCH', 'MAIN'] };
const AGT = { unit: 'AGT-CLAUDE', serial: '~/projects/lunalee', serialLabel: 'DIR', title: '', mark: null, division: ['EXTERNAL', 'AGENT'], seed: 7 };
const PANE = { blockWidth: 16, peak: false };

test('a terminal plate: DIR serial, an empty title slot, no barcode, no peak, BRANCH on the block\'s row 4', () => {
  const plate = unitPlate(TERM, { width: 64, ...PANE, barcode: false });
  assert.deepEqual(text(plate.lines), [
    '+──────────────────────────────────────────────────────────────+',
    '  INDUSTRIAL-OS ®                                               ',
    '  ▀█▀ █▀▀ █▀▄ █▄█     ▀▀█ ▄▀▀ █ █                               ',
    '   █  █▀▀ █▀▄ █ █ ▀▀▀ ▄▀   ▀▄ █▀█                               ',
    '   ▀  ▀▀▀ ▀ ▀ ▀ ▀     ▀▀▀ ▀▀  ▀ ▀             BRANCH      MAIN  ',
    '+ DIR ~/projects/lunalee ──────────────────────────────────────+',
  ]);
  assert.deepEqual(plate.paint, []);
  assert.deepEqual(plate.regions, {
    wordmark: { top: 2, left: 2, rows: 3, cols: 31, glyphs: [2, 6, 10, 14, 18, 22, 26, 30] },
    serial: { top: 5, left: 6, rows: 1, cols: 18 }, block: { top: 1, left: 46, rows: 4, cols: 16 }, barcode: null,
  });
});

test('an agent plate: its barcode and EXTERNAL AGENT fill the same 16-column block as the droid\'s, at W − 18 … W − 3', () => {
  for (const width of [64, 99]) {
    const agent = unitPlate(AGT, { width, ...PANE }), droid = unitPlate(UNIT, { width });
    assert.deepEqual(agent.regions.barcode, { top: 2, left: width - 18, rows: 2, cols: 16 });
    assert.equal(droid.regions.barcode.left, width - 18);
    assert.deepEqual(agent.paint, []);
    assert.equal(text(agent.lines)[4].slice(width - 18), 'EXTERNAL   AGENT  ');
    // The barcode is still seeded by the input.
    assert.equal(text(agent.lines)[2].slice(width - 18, width - 2), text(unitPlate(AGT, { width, ...PANE }).lines)[2].slice(width - 18, width - 2));
    assert.notEqual(text(agent.lines)[2], text(unitPlate({ ...AGT, seed: 8 }, { width, ...PANE }).lines)[2]);
  }
});

test('with a blockWidth, a long division widens the block three cells clear of the wordmark, then is cut with …', () => {
  const long = { ...TERM, division: ['BRANCH', 'FEATURE/STICKY-DROID-PLATE-VERY-LONG'] };
  const row = text(unitPlate(long, { width: 72, ...PANE, barcode: false }).lines)[4];
  assert.equal(row.slice(33), '   BRANCH FEATURE/STICKY-DROID-PLATE…  ');
  // A division that fits stays right-aligned in its 16-column block.
  assert.equal(text(unitPlate({ ...TERM, division: ['BRANCH', 'FEATURE/X'] }, { width: 99, ...PANE, barcode: false }).lines)[4].slice(81), 'BRANCH FEATURE/X  ');
  // Without a blockWidth the old rule holds: the block is as wide as its widest line, or left out.
  assert.equal(unitPlate({ ...TERM, division: ['BRANCH', 'X'.repeat(40)] }, { width: 72, barcode: false, peak: false }).regions.block, null);
});

test('regions name the wordmark glyphs, the serial and the barcode for motions', () => {
  const plate = unitPlate({ unit: 'DRD-FA03', serial: '150C-4F01', seed: 1 }, { width: 99 });
  assert.deepEqual(plate.regions.wordmark.glyphs, [2, 6, 10, 14, 18, 22, 26, 30]);
  assert.deepEqual(plate.regions.serial, { top: 5, left: 6, rows: 1, cols: 9 });
  assert.equal(text(plate.lines)[5].slice(6, 15), '150C-4F01');
  assert.deepEqual(plate.regions.barcode, { top: 2, left: 81, rows: 2, cols: 16 });
  assert.equal(unitPlate(UNIT, { width: 48, titleBlock: false }).regions.barcode, null);
});

test('unlit levels: the same glyphs on the graphite ground, with PLATE_LIGHTING inks by role', async () => {
  const { graphiteAt } = await import('../../foundation/surface.mjs');
  const { PLATE_LIGHTING } = await import('../../foundation/surface-palette.mjs');
  for (const level of ['dark', 'standby']) for (const width of [1, 20, 48, 64, 99, 104, 160]) for (const [input, options] of [[UNIT, {}], [TERM, { ...PANE, barcode: false }], [AGT, PANE], [{ ...UNIT, unit: 'DRD-????' }, {}]]) {
    const lit = unitPlate(input, { width, ...options }), dim = unitPlate(input, { width, ...options, lighting: level });
    assert.deepEqual(text(dim.lines), text(lit.lines));
    assert.deepEqual(dim.paint, lit.paint);
    const P = PLATE_LIGHTING[level], painted = new Set(lit.paint.flatMap(({ row, start, end }) => Array.from({ length: end - start }, (_, i) => `${row}/${start + i}`)));
    dim.lines.forEach((line, y) => {
      let x = 0;
      for (const s of line) for (const ch of s.text) {
        const g = graphiteAt(x, y, { width, level });
        if (s.style.bg === P.peak) assert.ok(painted.has(`${y}/${x}`));
        else assert.equal(s.style.bg, g.ground);
        if (ch === '─' && !painted.has(`${y}/${x}`)) assert.equal(s.style.fg, g.hair);
        if (ch === '+' && (x === 0 || x === width - 1)) assert.equal(s.style.fg, P.corner);
        x++;
      }
    });
  }
  const dark = unitPlate(UNIT, { width: 104, lighting: 'dark' }), P = PLATE_LIGHTING.dark;
  const cellAt = (lines, row, col) => { let x = 0; for (const s of lines[row]) for (const ch of s.text) { if (x === col) return { ch, ...s.style }; x++; } };
  assert.equal(cellAt(dark.lines, 2, 2).fg, P.word); // the wordmark
  assert.equal(cellAt(dark.lines, 2, 86).fg, P.bars); // the barcode's first bar
  assert.equal(cellAt(dark.lines, 4, 86).fg, P.label); // HALDENN
  assert.equal(cellAt(dark.lines, 1, 2).fg, P.value); // the maker
  assert.equal(cellAt(dark.lines, 5, 6).fg, P.value); // the serial
  assert.equal(cellAt(unitPlate({ ...UNIT, unit: 'DRD-????' }, { width: 104, lighting: 'standby' }).lines, 2, 18).fg, PLATE_LIGHTING.standby.label); // unknown digit
});

test('fitUnitCode: the whole name when its wordmark fits before the block, else the bare prefix, never a cut name', async () => {
  const { fitUnitCode } = await import('./unit-plate.mjs');
  const fit = (prefix, code, width, titleBlock = width >= 56) => fitUnitCode(prefix, code, { width, titleBlock });
  assert.equal(fit('TERM', 'ZSH', 56), 'TERM-ZSH');
  assert.equal(fit('TERM', 'BASH', 56), 'TERM');
  assert.equal(fit('TERM', 'XONSH', 64), 'TERM-XONSH');
  assert.equal(fit('TERM', 'ELVISH', 64), 'TERM');
  assert.equal(fit('AGT', 'CLAUDE', 64), 'AGT-CLAUDE');
  assert.equal(fit('AGT', 'GEMINI', 64), 'AGT-GEMINI');
  assert.equal(fit('AGT', 'OPENCODE', 64), 'AGT');
  assert.equal(fit('AGT', 'CLAUDE', 56), 'AGT');
  assert.equal(fit('TERM', 'ZSH', 48), 'TERM-ZSH'); // no title block: up to the margin
  for (const code of ['', 'zsh', 'Z_SH', 'ZS H']) assert.equal(fit('TERM', code, 99), 'TERM');
  assert.throws(() => fitUnitCode('term', 'ZSH', { width: 64 }), RangeError);
  assert.throws(() => fitUnitCode('TERM', 1, { width: 64 }), TypeError);
  assert.throws(() => fitUnitCode('TERM', 'ZSH', { width: 0 }), RangeError);
});

test('invalid pane-plate options throw', () => {
  for (const [name, value] of [['barcode', 'no'], ['peak', 1]]) assert.throws(() => unitPlate(UNIT, { width: 60, [name]: value }), TypeError);
  for (const [name, value] of [['blockWidth', -1], ['blockWidth', 1.5], ['lighting', 'off']]) assert.throws(() => unitPlate(UNIT, { width: 60, [name]: value }), RangeError);
});

test('display text is printable ASCII: a Unicode branch, maker or title is drawn as ? and never throws', () => {
  const plate = unitPlate({ unit: 'TERM-ZSH', serial: '~/日本', serialLabel: 'DIR', maker: 'ÏNDUSTRIAL', mark: null, title: 'tést', division: ['BRANCH', '日本語'] }, { width: 99, blockWidth: 16, barcode: false, peak: false });
  const rows = text(plate.lines);
  assert.match(rows[4], /BRANCH +\?\?\?  $/);
  assert.ok(rows[1].includes('?NDUSTRIAL'));
  assert.ok(rows[1].includes('t?st'));
  assert.ok(rows[5].includes('~/??'));
  for (const W of [1, 24, 56, 64, 99, 160]) {
    for (const branch of ['日本語', '🙂🙂', 'é'.repeat(40), 'a\u0301b']) {
      const p = unitPlate({ unit: 'TERM', serial: '~', serialLabel: 'DIR', mark: null, title: '', division: ['BRANCH', branch] }, { width: W, blockWidth: 16, barcode: false, peak: false });
      assert.ok(p.lines.every((line) => lineWidth(line) === W), `${W} ${branch}`);
      assert.ok(text(p.lines).every((row) => [...row].every((ch) => /[\x20-\x7e]/.test(ch) || GLYPHS.includes(ch))), `${W} ${branch}`);
    }
  }
});

test('peakFrom moves the peak right: its left-most painted cell at that column, two cells clear of the title block, else none', () => {
  const from = (W) => Math.ceil(W / 2 + 14 / 8.5 + 2); // the Herdr pane plate's rule: the grip's half-width and two cells right of centre
  const spans = (p) => ({ lo: Math.min(...p.paint.map((r) => r.start)), hi: Math.max(...p.paint.map((r) => r.end)) - 1 });
  for (let W = 56; W <= 200; W++) {
    const p = unitPlate(UNIT, { width: W, blockWidth: 16, peakFrom: from(W) });
    if (W < 80) { assert.deepEqual(p.paint, [], `${W}: no room`); continue; }
    const { lo, hi } = spans(p), bx = W - 18;
    assert.equal(lo, from(W), `${W}`);
    assert.ok(hi <= bx - 3, `${W}: two clear cells before the block`);
    // Its strokes are the widest that fit, as the centred peak's are.
    const b = p.paint[0].end - p.paint[0].start - 2;
    assert.equal(b, W >= 88 ? 3 : W >= 84 ? 2 : 1, `${W}`);
    assert.equal([...text(p.lines)[5]][lo], '\uE0BA', `${W}: the bottom row's left edge`);
  }
  // A column inside the left block is moved past it; the default (null) keeps the centred peak.
  const inside = spans(unitPlate(UNIT, { width: 104, peakFrom: 5 }));
  assert.equal(inside.lo, 32 + 3); // the wordmark ends in column 32
  assert.deepEqual(unitPlate(UNIT, { width: 104, peakFrom: null }).paint, unitPlate(UNIT, { width: 104 }).paint);
  for (const bad of [-1, 1.5, 1001, '40']) assert.throws(() => unitPlate(UNIT, { width: 104, peakFrom: bad }), RangeError);
});

test('sessionUnit: DRD from the last four hex digits, the serial from the last group, the seed from the last eight', async () => {
  const { sessionUnit } = await import('./unit-plate.mjs');
  assert.deepEqual(sessionUnit('01a1e81c-27f3-70f3-b278-150c4f01fa03'), { unit: 'DRD-FA03', serial: '150C-4F01', seed: 0x4f01fa03 | 0 });
  // Two sessions started in the same second share their first eight digits but not their serial.
  assert.notEqual(sessionUnit('01a1e81c-5b10-7a42-9c3e-2d7e88b1a4c9').serial, sessionUnit('01a1e81c-27f3-70f3-b278-150c4f01fa03').serial);
  assert.equal(sessionUnit('ABCDEF012345').serial, 'ABCD-EF01');
  for (const id of [undefined, null, '', 'abc', '01a1e81c-27f', 42]) assert.equal(sessionUnit(id), null);
});
