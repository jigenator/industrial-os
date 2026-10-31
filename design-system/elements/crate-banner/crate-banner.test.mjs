import test from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS, lineWidth, paint, resolveColor } from '../../foundation/cells.mjs';
import { surfaceAt } from '../../foundation/surface.mjs';
import { crateBanner } from './crate-banner.mjs';

const TOOLS = [{ id: 'board', label: 'BOARD', icon: '▦', state: 'ready' }, { id: 'notes', label: 'NOTES', icon: '≡', state: 'ready' }];
const INPUT = { serial: '2610-0427', hold: 2, clock: '09:34', tools: TOOLS };
const plain = (lines) => lines.map((line) => paint(line, 'none'));

// The approved aluminium ground, written out independently of the element: l = 214 + 26(1−u²) − 6t + 3.2·sin(0.42x +
// 2.3y) + 1.6·sin(1.37x + 5.1y), RGB (l−3, l, l+4), each channel clamped and rounded; hairlines are 28 darker.
const hx = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const rgbOf = (color) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
function groundAt(x, y, width) {
  const t = y / 5, u = width === 1 ? 0 : 2 * x / (width - 1) - 1;
  return hx([-3, 0, 4].map((d) => 214 + 26 * (1 - u * u) - 6 * t + 3.2 * Math.sin(0.42 * x + 2.3 * y) + 1.6 * Math.sin(1.37 * x + 5.1 * y) + d));
}
const hairOn = (ground) => hx(rgbOf(ground).map((v) => v - 28));
const frostOver = (under) => hx(rgbOf(under).map((v) => 255 * 0.1 + v * 0.9));
const luminance = (color) => rgbOf(color).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
// The host background under the strip in the mockup: its pane gradient (top 34, drop 26, edge 8) on row 6 of 22 rows.
const paneRow = (width) => Array.from({ length: width }, (_, x) => surfaceAt(x, 6, { width, height: 22, gradient: { top: 34, drop: 26, edge: 8 } }));

// One letter per cell. A space by its background: p the aluminium ground at that cell, a accent, k black, f the
// frosted strip. Any other cell by ink, background and weight: on the ground i/B ink, g label grey, h hairline,
// e accent edge; on paint s darker accent, A/X ink; on black w/W white, d grey lamp, o acid lamp, r divider; on
// frost v/V white, l lifted lamp, c acid lamp, q lifted divider.
const INKS = { '#000000': 'ink', '#4f5257': 'label', '#c0fe04': 'acid', '#90be03': 'shade', '#ffffff': 'white', '#717171': 'lamp', '#555555': 'rule', '#9c9c9c': 'frostLamp', '#868686': 'frostRule' };
const LETTERS = {
  'p/ink/0': 'i', 'p/ink/1': 'B', 'p/label/0': 'g', 'p/hair/0': 'h', 'p/acid/0': 'e', 'a/shade/0': 's', 'a/ink/0': 'A', 'a/ink/1': 'X',
  'k/white/0': 'w', 'k/white/1': 'W', 'k/lamp/0': 'd', 'k/acid/0': 'o', 'k/rule/0': 'r', 'k/rule/1': 'R',
  'f/white/0': 'v', 'f/white/1': 'V', 'f/frostLamp/0': 'l', 'f/acid/0': 'c', 'f/frostRule/0': 'q',
};
const cellsOf = (line) => line.flatMap((s) => [...s.text].map((ch) => ({ ch, fg: resolveColor(s.style.fg).toLowerCase(), bg: resolveColor(s.style.bg).toLowerCase(), bold: !!s.style.bold })));
// Rows 0–5 are plate rows (the compact row is row 0); `backdrop` is the strip's host background.
const codes = (lines, { backdrop = null } = {}) => lines.map((line, y) => cellsOf(line).map((c, x, row) => {
  const ground = y < 6 ? groundAt(x, y, row.length) : null;
  const bg = c.bg === ground ? 'p' : c.bg === '#c0fe04' ? 'a' : c.bg === '#000000' ? 'k' : backdrop && c.bg === frostOver(backdrop[x]) ? 'f' : '?';
  if (c.ch === ' ') return bg;
  return LETTERS[`${bg}/${ground && c.fg === hairOn(ground) ? 'hair' : INKS[c.fg]}/${c.bold ? 1 : 0}`] ?? '?';
}).join(''));

// Goldens from the approved mockup (lunalee prototypes/crate-banner, texture.html round 5: ground C brushed aluminium,
// HALDENN DYNAMICS under the maker, shadow off), taken by running its own cell engine for
// oneStroke('serialAligned', 'mark', 'barcode') at 60 and 40 columns, clock 09:34. `cells` is the solid strip;
// `frosted` the strip row with the mockup's "frosted 10%" over its pane row, and the approved lifted lamp and
// divider inks in place of the mockup's #717171 and #555555. Each case lists the rows that differ from HOLD 2.
const MOCKUP = {
  60: {
    text: [
      '  +──────────────────────────◢────◤───────+────────────────+',
      '  │ INDUSTRIAL-OS ®         ◢    ◤     ⟁  │ HOLD 2   09:34 │',
      '  │ HALDENN DYNAMICS       ◢    ◤         +────────────────+',
      '  │                       ◢    ◤          │ UNIT      M-02 │',
      '  │                      ◢    ◤           │ ▌▏▏▍▐▐█▏▍▐▍▍▍▐ │',
      '  + S/N 2610-0427 ──────◢────◤────────────+────────────────+',
      '  ▦ BOARD · │ ≡ NOTES · │                                   ',
    ],
    cells: [
      'aaBhhhhhhhhhhhhhhhhhhhhhhhhhhessssehhhhhhhBhhhhhhhhhhhhhhhhB',
      'aahpBBBBBBBBBBBBBpipppppppppeaaaaepppppBpphpggggpBpppBBBBBph',
      'aahpgggggggpggggggggpppppppeaaaaepppppppppBhhhhhhhhhhhhhhhhB',
      'aahpppppppppppppppppppppppeaaaaepppppppppphpggggppppppBBBBph',
      'aahppppppppppppppppppppppeaaaaeppppppppppphpiiiiiiiiiiiiiiph',
      'aaBpgggpgggggggggphhhhhhessssehhhhhhhhhhhhBhhhhhhhhhhhhhhhhB',
      'kkWkWWWWWkdkrkWkWWWWWkdkrkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    frosted: 'ffVfVVVVVflfqfVfVVVVVflfqfffffffffffffffffffffffffffffffffff',
    cases: [
      { hold: 0, open: ['board'], text: { 1: '  │ INDUSTRIAL-OS ®         ◢    ◤     ⟁  │ HOLD 0   09:34 │', 6: '  ▦ BOARD ● │ ≡ NOTES · │                                   ' },
        cells: { 1: 'aahpBBBBBBBBBBBBBpipppppppppeaaaaepppppBpphpggggpgpppBBBBBph', 6: 'kkWkWWWWWkokrkWkWWWWWkdkrkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk' },
        frosted: 'ffVfVVVVVfcfqfVfVVVVVflfqfffffffffffffffffffffffffffffffffff' },
      { hold: 12, open: ['board', 'notes'], text: { 1: '  │ INDUSTRIAL-OS ®         ◢    ◤     ⟁  │ HOLD 12  09:34 │', 6: '  ▦ BOARD ● │ ≡ NOTES ● │                                   ' },
        cells: { 1: 'aahpBBBBBBBBBBBBBpipppppppppeaaaaepppppBpphpggggpBBppBBBBBph', 6: 'kkWkWWWWWkokrkWkWWWWWkokrkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk' },
        frosted: 'ffVfVVVVVfcfqfVfVVVVVfcfqfffffffffffffffffffffffffffffffffff' },
    ],
    // The first tool owns the strip's leading cell, so its hover lines up with the stripe (the mockup's span began at 1).
    spans: [{ id: 'board', row: 6, start: 0, end: 12 }, { id: 'notes', row: 6, start: 13, end: 24 }],
  },
  40: {
    text: [
      '  +────────────────────◢─◤─────────────+',
      '  │ INDUSTRIAL-OS ® ⟁ ◢│◤HOLD 2  09:34 │',
      '  │ HALDENN DYNAMICS ◢ ◤───────────────+',
      '  │                 ◢ ◤│ UNIT     M-02 │',
      '  │                ◢ ◤ │ ▌▏▏▍▐▐█▏▍▐▍▍▐ │',
      '  + S/N 2610-0427 ◢─◤──+───────────────+',
      '  BOARD ·│ NOTES ·│                     ',
    ],
    cells: [
      'aaBhhhhhhhhhhhhhhhhhhhhesehhhhhhhhhhhhhB',
      'aahpBBBBBBBBBBBBBpipBpeseggggpBppBBBBBph',
      'aahpgggggggpggggggggpeaehhhhhhhhhhhhhhhB',
      'aahpppppppppppppppppeaehpggggpppppBBBBph',
      'aahppppppppppppppppeaephpiiiiiiiiiiiiiph',
      'aaBpgggpgggggggggpesehhBhhhhhhhhhhhhhhhB',
      'kkWWWWWkdrkWWWWWkdrkkkkkkkkkkkkkkkkkkkkk',
    ],
    frosted: 'ffVVVVVflqfVVVVVflqfffffffffffffffffffff',
    cases: [
      { hold: 0, open: ['board'], text: { 1: '  │ INDUSTRIAL-OS ® ⟁ ◢│◤HOLD 0  09:34 │', 6: '  BOARD ●│ NOTES ·│                     ' },
        cells: { 1: 'aahpBBBBBBBBBBBBBpipBpeseggggpgppBBBBBph', 6: 'kkWWWWWkorkWWWWWkdrkkkkkkkkkkkkkkkkkkkkk' },
        frosted: 'ffVVVVVfcqfVVVVVflqfffffffffffffffffffff' },
      { hold: 12, open: ['board', 'notes'], text: { 1: '  │ INDUSTRIAL-OS ® ⟁ ◢│◤HOLD 12 09:34 │', 6: '  BOARD ●│ NOTES ●│                     ' },
        cells: { 1: 'aahpBBBBBBBBBBBBBpipBpeseggggpBBpBBBBBph', 6: 'kkWWWWWkorkWWWWWkorkkkkkkkkkkkkkkkkkkkkk' },
        frosted: 'ffVVVVVfcqfVVVVVfcqfffffffffffffffffffff' },
    ],
    // The first tool owns the strip's leading cell, so its hover lines up with the stripe (the mockup's span began at 1).
    spans: [{ id: 'board', row: 6, start: 0, end: 9 }, { id: 'notes', row: 6, start: 10, end: 18 }],
  },
};

test('the full form reproduces the approved mockup cell for cell at 60 and 40 columns, solid and frosted', () => {
  for (const [key, golden] of Object.entries(MOCKUP)) {
    const width = Number(key), backdrop = paneRow(width);
    for (const { hold = 2, open = [], text = {}, cells = {}, frosted = golden.frosted } of [{}, ...golden.cases]) {
      const tools = TOOLS.map((tool) => ({ ...tool, state: open.includes(tool.id) ? 'open' : 'ready' }));
      const rows = (base, diff) => base.map((row, y) => diff[y] ?? row);
      const solid = crateBanner({ ...INPUT, hold, tools }, { width });
      assert.deepEqual(plain(solid.lines), rows(golden.text, text), `${width} HOLD ${hold} text`);
      assert.deepEqual(codes(solid.lines), rows(golden.cells, cells), `${width} HOLD ${hold} cells`);
      assert.deepEqual(solid.tools, golden.spans);
      const frost = crateBanner({ ...INPUT, hold, tools }, { width, stripBackdrop: backdrop });
      assert.deepEqual(plain(frost.lines), plain(solid.lines), 'frosting changes no glyph');
      assert.deepEqual(codes(frost.lines, { backdrop }), [...rows(golden.cells, cells).slice(0, 6), frosted], `${width} HOLD ${hold} frosted`);
      assert.deepEqual(frost.tools, solid.tools);
    }
  }
});

test('hover inks the whole item black on acid and keeps the lamp truthful; disabled has no lamp and no hover', () => {
  const tools = [{ id: 'board', label: 'BOARD', icon: '▦', state: 'open', hover: true }, { id: 'notes', label: 'NOTES', icon: '≡', state: 'ready', hover: true }, { id: 'files', label: 'FILES', icon: '▦', state: 'disabled', hover: true }];
  for (const width of [60, 40]) {
    const { lines, tools: spans } = crateBanner({ ...INPUT, tools }, { width });
    const row = cellsOf(lines[6]);
    for (const [i, { start, end }] of spans.entries()) {
      const item = row.slice(start, end);
      const shown = item.map((c) => c.ch).join('');
      if (i < 2) {
        assert.ok(item.every((c) => c.bg === '#c0fe04' && c.fg === '#000000'), `${width} ${spans[i].id}`);
        assert.ok(shown.includes(i === 0 ? '●' : '·'));
      } else {
        assert.ok(item.every((c) => c.bg === '#000000'));
        assert.ok(!/[●·]/.test(shown));
        assert.ok(item.filter((c) => c.ch !== ' ').every((c) => c.fg === '#555555' && !c.bold));
      }
      assert.equal(row[end].ch, '│');
    }
    // The leading cell belongs to the first tool: acid under the stripe while it is hovered, black otherwise.
    assert.equal(spans[0].start, 0);
    assert.equal(cellsOf(crateBanner({ ...INPUT, tools: tools.map((t) => ({ ...t, hover: false })) }, { width }).lines[6])[0].bg, '#000000');
    // A disabled tool keeps its item width, so a state change never moves the tools after it.
    const ready = crateBanner({ ...INPUT, tools: tools.map((t) => ({ ...t, state: 'ready', hover: false })) }, { width });
    assert.deepEqual(ready.tools, spans);
    // Frosted, hover keeps its solid acid; the disabled label and the dividers take the lifted divider ink.
    const backdrop = paneRow(width);
    const frosted = cellsOf(crateBanner({ ...INPUT, tools }, { width, stripBackdrop: backdrop }).lines[6]);
    for (const [i, { start, end }] of spans.entries()) {
      const item = frosted.slice(start, end);
      if (i < 2) assert.deepEqual(item, row.slice(start, end), 'hover is unchanged by frosting');
      else assert.ok(item.every((c, k) => c.bg === frostOver(backdrop[start + k]) && (c.ch === ' ' || c.fg === '#868686')));
      assert.deepEqual([frosted[end].ch, frosted[end].fg], ['│', '#868686']);
    }
  }
});

test('the division sits directly under the maker, with a blank cell before the stroke at 40 cells', () => {
  const rows = plain(crateBanner(INPUT, { width: 40 }).lines);
  assert.equal(rows[2].slice(4, 22), 'HALDENN DYNAMICS ◢');
  assert.equal(rows[3].slice(2, 20), '│' + ' '.repeat(17), 'row 3 is open ground');
  // At every full width the division keeps clear of the stroke on its row.
  for (let width = 40; width <= 160; width++) {
    const row = plain(crateBanner(INPUT, { width }).lines)[2];
    assert.ok(row.indexOf('HALDENN DYNAMICS') === 4 && row.indexOf('◢') >= 4 + 'HALDENN DYNAMICS'.length + 1, `${width}`);
  }
});

const VARIANTS = [
  INPUT,
  { serial: 'X', hold: 0, clock: null, tools: [] },
  { serial: '2610-0427', hold: 120, clock: '23:59', registered: false, mark: null, tools: TOOLS.map((t) => ({ ...t, icon: undefined })) },
  { maker: 'A VERY LONG MAKER NAME FOR A CRATE', division: 'A DIVISION NAME LONGER THAN THE PLATE', unit: 'UNIT-NUMBER-LONG', serial: 'SERIAL-0123456789-LONG', hold: null, mark: '*',
    tools: [...TOOLS, { id: 'files', label: 'FILES', icon: '▦', state: 'disabled' }, { id: 'logs', label: 'A VERY LONG TOOL', state: 'open', hover: true }] },
];

test('every width from 1 to 160 is exact, in both forms, with the stroke clear of all text', () => {
  for (const input of VARIANTS) {
    for (let width = 1; width <= 160; width++) {
      for (const form of ['full', 'compact']) {
        const { lines, tools } = crateBanner(input, { width, form });
        const full = form === 'full' && width >= 40;
        // The aluminium ground under every plate cell but the paint (and the compact row's black chips); hairlines
        // follow it, and every label reads at 4.5:1 or more on its own cell.
        for (const [y, line] of lines.slice(0, full ? 6 : 1).entries()) {
          for (const [x, c] of cellsOf(line).entries()) {
            if (c.bg === '#c0fe04' || (!full && c.bg === '#000000')) continue;
            const ground = groundAt(x, y, width);
            assert.equal(c.bg, ground, `${form} ${width} (${x},${y}) ground`);
            if ('─│'.includes(c.ch)) assert.equal(c.fg, hairOn(ground), `${form} ${width} (${x},${y}) hairline`);
            if (c.fg === '#4f5257' && c.ch !== ' ') assert.ok(contrast(c.fg, c.bg) >= 4.5, `${form} ${width} (${x},${y}) label contrast`);
          }
        }
        // Frosting changes only the strip's black cells; the compact row has no strip and ignores it.
        const backdrop = Array.from({ length: width }, (_, x) => hx([x % 40, 31, 33]));
        const frosted = crateBanner(input, { width, form, stripBackdrop: backdrop });
        assert.deepEqual(frosted.tools, tools);
        assert.deepEqual(frosted.lines.slice(0, full ? 6 : 1), lines.slice(0, full ? 6 : 1));
        if (full) {
          const strip = cellsOf(frosted.lines[6]), solid = cellsOf(lines[6]);
          strip.forEach((c, x) => assert.equal(c.bg, solid[x].bg === '#000000' ? frostOver(backdrop[x]) : solid[x].bg, `${width} strip (${x})`));
        }
        assert.equal(lines.length, full ? 7 : 1, `${form} ${width}`);
        for (const line of lines) {
          assert.equal(lineWidth(line), width, `${form} ${width}`);
          assert.equal(paint(line, 'truecolor').replace(/\x1b\[[0-9;]*m/g, ''), paint(line, 'none'));
          for (const ch of paint(line, 'none')) assert.ok(/[\x20-\x7e]/.test(ch) || GLYPHS.includes(ch), ch);
        }
        let last = 0;
        for (const span of tools) {
          assert.equal(span.row, full ? 6 : 0);
          assert.ok(span.start >= last && span.end > span.start && span.end < width, `${form} ${width} ${span.id}`);
          assert.equal(cellsOf(lines[span.row])[span.end].ch, '│');
          last = span.end + 1;
        }
        if (!full) continue;
        const grid = lines.map(cellsOf);
        for (let y = 0; y < 6; y++) {
          for (let x = 2; x < width; x++) {
            const c = grid[y][x];
            // Under the paint only frame cells; text never sits on or under the stroke.
            if (c.bg === '#c0fe04') assert.ok(' ─│+'.includes(c.ch), `${width} (${x},${y}) ${c.ch}`);
            if (c.ch === '◢' || c.ch === '◤') assert.equal(c.fg, '#c0fe04');
          }
        }
        if (input.mark !== null) {
          const x = width - (width >= 56 ? 18 : 17) - 3;
          assert.equal(grid[1][x].ch, input.mark ?? '⟁');
          assert.deepEqual([grid[1][x + 1].ch, grid[1][x + 1].bg], [' ', groundAt(x + 1, 1, width)], `${width} the mark keeps its blank cell`);
        }
      }
    }
  }
});

test('long text is cut with an ellipsis before the stroke; ® goes before the maker is cut', () => {
  const rows = plain(crateBanner(VARIANTS[3], { width: 40 }).lines);
  assert.equal(rows[1], '  │ A VERY LONG MA… * ◢│◤HOLD ?  --:-- │');
  assert.equal(rows[2], '  │ A DIVISION NAME …◢ ◤───────────────+');
  assert.equal(rows[3], '  │                 ◢ ◤│ UNIT UNIT-NU… │');
  assert.equal(rows[5], '  + S/N SERIAL-0… ◢─◤──+───────────────+');
  assert.equal(rows[6], '  BOARD ·│ NOTES ·│ FILES  │            ', 'a tool that does not fit whole is left out');
  assert.equal(plain(crateBanner({ ...INPUT, maker: 'INDUSTRIAL-OS-X' }, { width: 40 }).lines)[1], '  │ INDUSTRIAL-OS-X ⟁ ◢│◤HOLD 2  09:34 │');
});

test('HOLD shows 99+ above 99, is grey at 0, and an unknown hold or clock is never zero', () => {
  const row = (input, width) => plain(crateBanner({ ...INPUT, ...input }, { width }).lines)[1];
  assert.ok(row({ hold: 100 }, 60).endsWith('│ HOLD 99+ 09:34 │'));
  assert.ok(row({ hold: 99 }, 40).endsWith('◤HOLD 99 09:34 │'));
  assert.ok(row({ hold: 100 }, 40).endsWith('◤HOLD 99+      │'), 'narrow: HOLD keeps priority over the clock');
  assert.ok(row({ hold: null, clock: null }, 60).endsWith('│ HOLD ?   --:-- │'));
  const count = (hold) => codes(crateBanner({ ...INPUT, hold }, { width: 60 }).lines)[1][49];
  assert.deepEqual([count(0), count(3), count(null)], ['g', 'B', 'g']);
  assert.equal(codes(crateBanner({ ...INPUT, clock: null }, { width: 60 }).lines)[1].slice(53, 58), 'ggggg');
});

test('the compact row sheds icons, ®, clock, HOLD, then tools, and cuts the maker last', () => {
  const row = (width, input = INPUT) => plain(crateBanner(input, { width, form: 'compact' }).lines)[0];
  assert.equal(row(59), '   INDUSTRIAL-OS ®  HOLD 2  09:34   ▦ BOARD · │ ≡ NOTES · │');
  assert.equal(row(58), '   INDUSTRIAL-OS ®       HOLD 2  09:34   BOARD ·│ NOTES ·│');
  assert.equal(row(52), '   INDUSTRIAL-OS   HOLD 2  09:34   BOARD ·│ NOTES ·│');
  assert.equal(row(50), '   INDUSTRIAL-OS        HOLD 2   BOARD ·│ NOTES ·│');
  assert.equal(row(43), '   INDUSTRIAL-OS          BOARD ·│ NOTES ·│');
  assert.equal(row(36), '   INDUSTRIAL-OS            BOARD ·│');
  assert.equal(row(27), '   INDUSTRIAL-OS           ');
  assert.equal(row(15), '   INDUSTRIAL-…');
  assert.equal(row(5), 'INDU…', 'below six cells the stripe gives way to the maker');
  assert.equal(row(1), 'I');
  assert.equal(row(39, { ...INPUT, tools: [] }), '   INDUSTRIAL-OS ®       HOLD 2  09:34 ');
  const { lines, tools } = crateBanner(INPUT, { width: 39 });
  assert.equal(lines.length, 1, 'the full form below 40 cells is the compact row');
  assert.deepEqual(tools, crateBanner(INPUT, { width: 39, form: 'compact' }).tools);
  assert.deepEqual(codes(lines)[0].slice(0, 4), 'aapB');
});

test('the barcode is generated from the serial alone', () => {
  const bars = (serial, width = 60) => plain(crateBanner({ ...INPUT, serial }, { width }).lines)[4].slice(-16, -2);
  assert.equal(bars('2610-0427'), bars('2610-0427'));
  assert.notEqual(bars('2610-0427'), bars('2610-0428'));
  assert.match(bars('A'), /^▌[▏▎▍▌▐█ ]{12}▐$/);
});

test('a host measurer keeps Unicode text and wide graphemes within the exact width', () => {
  const measure = (text) => [...text].reduce((n, ch) => n + (/[\u3000-\u9fff]/u.test(ch) ? 2 : 1), 0);
  const input = { ...INPUT, maker: '工業-OS', division: 'Haldenn · 動力', tools: [{ id: 'board', label: '板 BOARD', icon: '▦', state: 'ready' }] };
  for (const width of [12, 40, 60]) {
    for (const form of ['full', 'compact']) {
      const { lines, tools } = crateBanner(input, { width, form, measure });
      for (const line of lines) assert.equal(lineWidth(line, { measure }), width);
      assert.ok(plain(lines).join('\n').includes('工業-OS'));
      for (const { start, end, row } of tools) assert.ok(end > start && end < width && row === lines.length - 1);
    }
  }
  assert.ok(plain(crateBanner(input, { width: 60, measure }).lines)[2].includes('Haldenn · 動力'));
  assert.ok(plain(crateBanner(input, { width: 60 }).lines)[2].includes('Haldenn ? ??'), 'without a measurer text stays ASCII');
  assert.throws(() => crateBanner({ ...input, maker: 'bad\x1b[31m' }, { width: 60, measure }), TypeError);
});

test('planning the tool layout is linear in the number of tools', () => {
  const calls = (n, form, width) => {
    let count = 0;
    const measure = (text) => { count++; return [...text].length; };
    const tools = Array.from({ length: n }, (_, i) => ({ id: String(i), label: 'A', state: 'ready' }));
    crateBanner({ serial: 'X', tools }, { width, form, measure });
    return count;
  };
  for (const [form, width] of [['compact', 1], ['compact', 60], ['full', 60]]) {
    const small = calls(100, form, width), large = calls(200, form, width);
    assert.ok(large - small <= 2 * (small + 50), `${form} at ${width}: ${small} measure calls for 100 tools, ${large} for 200`);
  }
});

test('a tool without a lamp is just its icon and label, and still hovers and hit-tests', () => {
  for (const [width, text] of [[60, '  ▦ BOARD │ ≡ NOTES · │'], [40, '  BOARD │ NOTES ·│']]) {
    const tools = [{ id: 'board', label: 'BOARD', icon: '▦', state: 'ready', lamp: false }, { id: 'notes', label: 'NOTES', icon: '≡', state: 'ready' }];
    const { lines, tools: spans } = crateBanner({ ...INPUT, tools }, { width });
    assert.ok(plain(lines)[6].startsWith(text), plain(lines)[6]);
    assert.deepEqual(spans[0], { id: 'board', row: 6, start: 0, end: text.indexOf('│') });
    const hovered = cellsOf(crateBanner({ ...INPUT, tools: [{ ...tools[0], hover: true }, tools[1]] }, { width }).lines[6]);
    assert.ok(hovered.slice(0, spans[0].end).every((c) => c.bg === '#c0fe04'));
    assert.ok(!/[●·]/.test(plain(lines)[6].slice(0, spans[0].end)));
  }
  assert.throws(() => crateBanner({ ...INPUT, tools: [{ id: 'a', label: 'A', state: 'ready', lamp: 'no' }] }, { width: 60 }), TypeError);
});

test('® and the mark are optional; the input is not changed', () => {
  const input = structuredClone(INPUT);
  const rows = plain(crateBanner({ ...input, registered: false, mark: null }, { width: 60 }).lines);
  assert.equal(rows[1], '  │ INDUSTRIAL-OS           ◢    ◤        │ HOLD 2   09:34 │');
  crateBanner(input, { width: 60 });
  assert.deepEqual(input, INPUT);
});

test('invalid input throws', () => {
  const bad = (input, options = { width: 60 }) => () => crateBanner({ ...INPUT, ...input }, options);
  assert.throws(() => crateBanner(null, { width: 60 }), TypeError);
  assert.throws(bad({}, { width: 0 }), RangeError);
  assert.throws(bad({}, { width: 1001 }), RangeError);
  assert.throws(bad({}, { width: 60.5 }), RangeError);
  assert.throws(bad({}, { width: 60, form: 'tall' }), RangeError);
  assert.throws(bad({}, { width: 60, measure: 3 }), TypeError);
  assert.throws(bad({ serial: undefined }), TypeError);
  assert.throws(bad({ serial: '' }), RangeError);
  assert.throws(bad({ maker: 3 }), TypeError);
  assert.throws(bad({ registered: 'yes' }), TypeError);
  assert.throws(bad({ hold: -1 }), RangeError);
  assert.throws(bad({ hold: 1.5 }), RangeError);
  assert.throws(bad({ hold: '2' }), TypeError);
  assert.throws(bad({ clock: '9:34' }), RangeError);
  assert.throws(bad({ clock: '24:00' }), RangeError);
  assert.throws(bad({ clock: 934 }), TypeError);
  assert.throws(bad({ mark: '⟁⟁' }), TypeError);
  assert.throws(bad({ mark: '😀' }), TypeError);
  assert.throws(bad({ tools: {} }), TypeError);
  assert.throws(bad({ tools: [null] }), TypeError);
  assert.throws(bad({ tools: [{ id: 'a', label: 'A', state: 'hover' }] }), RangeError);
  assert.throws(bad({ tools: [{ id: 'a', label: 'A', state: 'ready', hover: 1 }] }), TypeError);
  assert.throws(bad({ tools: [{ id: 'a', label: 'A', state: 'ready', icon: 'AB' }] }), TypeError);
  assert.throws(bad({ tools: [{ id: 'a', label: 3, state: 'ready' }] }), TypeError);
  assert.throws(bad({ tools: [{ id: 'a', label: 'A', state: 'ready' }, { id: 'a', label: 'B', state: 'open' }] }), RangeError);
  // The strip backdrop is one #rrggbb per cell, checked in both forms even though the compact row ignores it.
  const backdrop = (width, color = '#1e1f21') => Array(width).fill(color);
  for (const form of ['full', 'compact']) {
    assert.throws(bad({}, { width: 60, form, stripBackdrop: backdrop(59) }), RangeError);
    assert.throws(bad({}, { width: 60, form, stripBackdrop: backdrop(61) }), RangeError);
    assert.throws(bad({}, { width: 60, form, stripBackdrop: '#1e1f21' }), TypeError);
    assert.throws(bad({}, { width: 60, form, stripBackdrop: backdrop(60, 'field') }), TypeError);
    assert.throws(bad({}, { width: 60, form, stripBackdrop: backdrop(60, '#fff') }), TypeError);
    assert.throws(bad({}, { width: 60, form, stripBackdrop: [...backdrop(59), 0x1e1f21] }), TypeError);
    assert.throws(bad({}, { width: 60, form, stripBackdrop: [...backdrop(59), '#1e1f21 '] }), TypeError);
    assert.doesNotThrow(bad({}, { width: 60, form, stripBackdrop: null }));
    assert.doesNotThrow(bad({}, { width: 60, form, stripBackdrop: backdrop(60, '#1E1F21') }));
  }
  assert.deepEqual(crateBanner(INPUT, { width: 30, form: 'compact', stripBackdrop: backdrop(30) }), crateBanner(INPUT, { width: 30, form: 'compact' }));
});
