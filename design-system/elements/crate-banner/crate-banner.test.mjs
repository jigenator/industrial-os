import test from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS, lineWidth, paint, resolveColor } from '../../foundation/cells.mjs';
import { crateBanner } from './crate-banner.mjs';

const TOOLS = [{ id: 'board', label: 'BOARD', icon: '▦', state: 'ready' }, { id: 'notes', label: 'NOTES', icon: '≡', state: 'ready' }];
const INPUT = { serial: '2610-0427', hold: 2, clock: '09:34', tools: TOOLS };
const plain = (lines) => lines.map((line) => paint(line, 'none'));

// One letter per cell: a space by its background (p paper, a accent, k black); any other cell by ink, background
// and weight (i ink, B bold ink, g label grey, h hairline, e accent edge, s darker accent on paint, A/X ink on paint,
// w/W white on black, d grey lamp, o acid lamp, r divider).
const CODES = {
  '#000000/#f6f6f6/0': 'i', '#000000/#f6f6f6/1': 'B', '#717171/#f6f6f6/0': 'g', '#dadada/#f6f6f6/0': 'h', '#c0fe04/#f6f6f6/0': 'e',
  '#90be03/#c0fe04/0': 's', '#000000/#c0fe04/0': 'A', '#000000/#c0fe04/1': 'X', '#ffffff/#000000/0': 'w', '#ffffff/#000000/1': 'W',
  '#717171/#000000/0': 'd', '#c0fe04/#000000/0': 'o', '#555555/#000000/0': 'r', '#555555/#000000/1': 'R',
};
const SPACES = { '#f6f6f6': 'p', '#c0fe04': 'a', '#000000': 'k' };
const cellsOf = (line) => line.flatMap((s) => [...s.text].map((ch) => ({ ch, fg: resolveColor(s.style.fg).toLowerCase(), bg: resolveColor(s.style.bg).toLowerCase(), bold: !!s.style.bold })));
const codes = (lines) => lines.map((line) => cellsOf(line).map((c) => (c.ch === ' ' ? SPACES[c.bg] : CODES[`${c.fg}/${c.bg}/${c.bold ? 1 : 0}`]) ?? '?').join(''));

// Goldens taken from the approved mockup (lunalee prototypes/crate-banner, paint.html v10) by running its own cell
// engine for oneStroke('serialAligned', 'mark', 'barcode') at 60 and 40 columns, HOLD 2, clock 09:34.
const MOCKUP = {
  60: {
    text: [
      '  +──────────────────────────◢────◤───────+────────────────+',
      '  │ INDUSTRIAL-OS ®         ◢    ◤     ⟁  │ HOLD 2   09:34 │',
      '  │                        ◢    ◤         +────────────────+',
      '  │ HALDENN DYNAMICS      ◢    ◤          │ UNIT      M-02 │',
      '  │                      ◢    ◤           │ ▌▏▏▍▐▐█▏▍▐▍▍▍▐ │',
      '  + S/N 2610-0427 ──────◢────◤────────────+────────────────+',
      '  ▦ BOARD · │ ≡ NOTES · │                                   ',
    ],
    cells: [
      'aaBhhhhhhhhhhhhhhhhhhhhhhhhhhessssehhhhhhhBhhhhhhhhhhhhhhhhB',
      'aahpBBBBBBBBBBBBBpipppppppppeaaaaepppppBpphpggggpBpppBBBBBph',
      'aahppppppppppppppppppppppppeaaaaepppppppppBhhhhhhhhhhhhhhhhB',
      'aahpgggggggpggggggggppppppeaaaaepppppppppphpggggppppppBBBBph',
      'aahppppppppppppppppppppppeaaaaeppppppppppphpiiiiiiiiiiiiiiph',
      'aaBpgggpgggggggggphhhhhhessssehhhhhhhhhhhhBhhhhhhhhhhhhhhhhB',
      'kkWkWWWWWkdkrkWkWWWWWkdkrkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    ],
    // HOLD 0 with BOARD open: only rows 1 and 6 change.
    idle: { 1: 'aahpBBBBBBBBBBBBBpipppppppppeaaaaepppppBpphpggggpgpppBBBBBph', 6: 'kkWkWWWWWkokrkWkWWWWWkdkrkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk' },
    spans: [{ id: 'board', row: 6, start: 1, end: 12 }, { id: 'notes', row: 6, start: 13, end: 24 }],
  },
  40: {
    text: [
      '  +────────────────────◢─◤─────────────+',
      '  │ INDUSTRIAL-OS ® ⟁ ◢│◤HOLD 2  09:34 │',
      '  │                  ◢ ◤───────────────+',
      '  │ HALDENN DYNAMICS◢ ◤│ UNIT     M-02 │',
      '  │                ◢ ◤ │ ▌▏▏▍▐▐█▏▍▐▍▍▐ │',
      '  + S/N 2610-0427 ◢─◤──+───────────────+',
      '  BOARD ·│ NOTES ·│                     ',
    ],
    cells: [
      'aaBhhhhhhhhhhhhhhhhhhhhesehhhhhhhhhhhhhB',
      'aahpBBBBBBBBBBBBBpipBpeseggggpBppBBBBBph',
      'aahppppppppppppppppppeaehhhhhhhhhhhhhhhB',
      'aahpgggggggpggggggggeaehpggggpppppBBBBph',
      'aahppppppppppppppppeaephpiiiiiiiiiiiiiph',
      'aaBpgggpgggggggggpesehhBhhhhhhhhhhhhhhhB',
      'kkWWWWWkdrkWWWWWkdrkkkkkkkkkkkkkkkkkkkkk',
    ],
    idle: { 1: 'aahpBBBBBBBBBBBBBpipBpeseggggpgppBBBBBph', 6: 'kkWWWWWkorkWWWWWkdrkkkkkkkkkkkkkkkkkkkkk' },
    spans: [{ id: 'board', row: 6, start: 1, end: 9 }, { id: 'notes', row: 6, start: 10, end: 18 }],
  },
};

test('the full form reproduces the approved mockup cell for cell at 60 and 40 columns', () => {
  for (const [width, golden] of Object.entries(MOCKUP)) {
    const { lines, tools } = crateBanner(INPUT, { width: Number(width) });
    assert.deepEqual(plain(lines), golden.text, `${width} text`);
    assert.deepEqual(codes(lines), golden.cells, `${width} cells`);
    assert.deepEqual(tools, golden.spans);
    const idle = crateBanner({ ...INPUT, hold: 0, tools: [{ ...TOOLS[0], state: 'open' }, TOOLS[1]] }, { width: Number(width) });
    const expected = golden.cells.map((row, y) => golden.idle[y] ?? row);
    assert.deepEqual(codes(idle.lines), expected, `${width} HOLD 0, BOARD open`);
    assert.equal(plain(idle.lines)[6], golden.text[6].replace('·', '●'));
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
    // A disabled tool keeps its item width, so a state change never moves the tools after it.
    const ready = crateBanner({ ...INPUT, tools: tools.map((t) => ({ ...t, state: 'ready', hover: false })) }, { width });
    assert.deepEqual(ready.tools, spans);
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
          assert.deepEqual([grid[1][x + 1].ch, grid[1][x + 1].bg], [' ', '#f6f6f6'], `${width} the mark keeps its blank cell`);
        }
      }
    }
  }
});

test('long text is cut with an ellipsis before the stroke; ® goes before the maker is cut', () => {
  const rows = plain(crateBanner(VARIANTS[3], { width: 40 }).lines);
  assert.equal(rows[1], '  │ A VERY LONG MA… * ◢│◤HOLD ?  --:-- │');
  assert.equal(rows[3], '  │ A DIVISION NAME…◢ ◤│ UNIT UNIT-NU… │');
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
  assert.ok(plain(crateBanner(input, { width: 60, measure }).lines)[3].includes('Haldenn · 動力'));
  assert.ok(plain(crateBanner(input, { width: 60 }).lines)[3].includes('Haldenn ? ??'), 'without a measurer text stays ASCII');
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
});
