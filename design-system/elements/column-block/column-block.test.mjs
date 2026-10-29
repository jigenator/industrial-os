import test from 'node:test';
import assert from 'node:assert/strict';
import { columnBlock } from './column-block.mjs';
import { lineMeter } from '../line-meter/line-meter.mjs';
import { countPlate } from '../count-plate/count-plate.mjs';
import { GLYPHS, lineWidth, paint, span } from '../../foundation/cells.mjs';

const plain = (rows, width = 34, options = {}) => columnBlock(rows, { width, ...options }).map((l) => paint(l, 'none'));
const fixture = [
  { head: true, gutter: [span('○ IDL', { fg: 'decorative' })], value: 'release', right: '2h33m' },
  { gutter: '02AU', value: lineMeter({ percent: 67 }), right: [span('CMP×18', { fg: 'critical', bold: true })] },
  { gutter: 'ACT', value: [span('feat/sidebar*', { fg: 'warning' })], right: '#42' },
  { gutter: 'MDL', value: 'opus-5.5/hi' },
  { gutter: 'PNE', value: 'Updating sidebar', right: '12s' },
];

test('column block reproduces layout B fixture with available glyphs and exact right columns', () => {
  assert.deepEqual(plain(fixture), [
    ' ○ IDL  · release         ·  2h33m',
    '   02AU · ━━━━━━━━─── 67% · CMP×18',
    '   ACT  · feat/sidebar*   ·    #42',
    '   MDL  · opus-5.5/hi             ',
    '   PNE  · Updating sideb… ·    12s',
  ]);
  const lines = columnBlock(fixture, { width: 34 });
  assert.ok(lines[1].some((s) => s.text.includes('━') && s.style.fg === 'accent'));
  assert.ok(lines[2].some((s) => s.text.includes('feat/sidebar*') && s.style.fg === 'warning'));
  assert.equal(plain(fixture, 40)[0], plain(fixture)[0] + ' '.repeat(6));
});

test('column block marks take value cells, never shift the right slot', () => {
  const base = { head: true, gutter: [span('○ IDL')], value: 'long-project-name', right: '2h33m' };
  const marked = { ...base, marks: [[span('●', { fg: 'critical' })]] };
  const [a, b] = plain([base, marked]);
  assert.equal(a, ' ○ IDL  · long-project-n… ·  2h33m');
  assert.equal(b, ' ○ IDL  · long-proje… · ● ·  2h33m');
  assert.equal(a.indexOf('2h33m'), b.indexOf('2h33m'));
  assert.equal(plain([{ value: 'project', marks: ['FLAG'] }])[0].trim(), 'project · FLAG');
  assert.equal(plain([{ value: 'x'.repeat(30), right: '1234567' }])[0], '          xxxxxxxxxxxxxx… · 12345…');
  assert.equal(plain([{ value: 'x'.repeat(30) }])[0], '          xxxxxxxxxxxxxxxxxxxxxxx…');
});

test('column block presence, defaults, continuation and caller-rendered pieces', () => {
  assert.deepEqual(plain([{}, { value: '' }, { marks: [] }, { value: [] }]), []);
  assert.deepEqual(plain([{ gutter: 'ASK', value: 'Choose a target' }, { value: 'then confirm' }]), [
    '   ASK  · Choose a target         ', '          then confirm            ',
  ]);
  assert.equal(plain([{ gutter: 'ACT' }])[0], '   ACT                            ');
  assert.equal(plain([{ right: '#42' }])[0], '                               #42');
  assert.equal(plain([{ marks: ['FLAG'] }])[0].trim(), 'FLAG');
  const lines = columnBlock([{ gutter: 'ACT', value: 'x', marks: ['m'], right: 'r' }], { width: 34 });
  for (const [text, fg] of [['ACT', 'decorative'], ['x', 'secondary'], ['m', 'secondary'], ['r', 'secondary'], [' · ', 'decorative']]) {
    assert.ok(lines[0].some((s) => s.text === text && s.style.fg === fg));
  }
  const badge = countPlate(18);
  assert.ok(plain([{ value: 'count', right: badge }])[0].endsWith(' CMP×…')); // fixed six-cell slot, including caller pads
});

test('column block narrow fallback shrinks value, then stacks indivisible parts without clipping', () => {
  const row = { gutter: 'ACT', value: 'abcdefgh', marks: ['FLAG'], right: '#42' };
  assert.deepEqual(plain([row], 28).map((s) => s.trimEnd()), ['   ACT  · a… · FLAG ·    #42']);
  assert.deepEqual(plain([row], 23).map((s) => s.trimEnd()), ['   ACT  · abcdefgh', '          FLAG', '                    #42']);
  assert.deepEqual(plain([row], 12).map((s) => s.trimEnd()), ['   ACT  · a…', 'FLAG', '         #42']);
  assert.deepEqual(plain([row], 4).map((s) => s.trimEnd()), ['ACT', 'abc…', 'FLAG', ' #42']);
  assert.deepEqual(plain([{ value: 'v', marks: ['FLAG'] }], 1), ['v', 'F', 'L', 'A', 'G']);
});

test('column block renders a function value at its budget, so a meter keeps its reading', () => {
  const meter = { gutter: '02AU', value: (cells) => lineMeter({ percent: 67 }, { maxWidth: cells }), right: [span('CMP×18')] };
  assert.equal(plain([meter])[0], '   02AU · ━━━━━━━━─── 67% · CMP×18');
  assert.deepEqual(plain([meter], 18).map((s) => s.trimEnd()), ['   02AU · ━━━─ 67%', '            CMP×18']);
  assert.deepEqual(plain([meter], 13).map((s) => s.trimEnd()), ['   02AU · 67%', '       CMP×18']);
  assert.deepEqual(plain([{ value: () => [] }]), []);
  assert.throws(() => plain([{ value: () => 'x'.repeat(25) }]), RangeError);
  assert.throws(() => plain([{ value: () => 42 }]), TypeError);
});

test('column block configurable geometry keeps the same column rules', () => {
  assert.deepEqual(plain([{ head: true, gutter: 'AB', value: 'v', right: 'r' }], 12, {
    gutterEnd: 3, headIndent: 0, indent: 1, separator: '|', textCells: 8, rightCells: 2,
  }), ['AB |v    | r']);
});

test('column block widths 1–160: exact lines, whole stacked parts, curated glyphs and color/plain equivalence', () => {
  for (let width = 1; width <= 160; width++) {
    const rows = [...fixture, { gutter: 'ASK', value: 'Choose a target' }, { value: 'then confirm' },
      { value: 'v', marks: ['FLAG', [span('●', { fg: 'critical' })]], right: '#42' }];
    const lines = columnBlock(rows, { width });
    for (const line of lines) {
      assert.equal(lineWidth(line), width);
      const text = paint(line, 'none');
      assert.equal(paint(line, 'truecolor').replace(/\x1b\[[0-9;]*m/g, ''), text);
      for (const ch of text) assert.ok(/[\x20-\x7e]/.test(ch) || GLYPHS.includes(ch));
    }
    const narrow = plain([{ value: 'v', marks: ['FLAG'], right: '#42' }], width).join('').replace(/ /g, '');
    assert.ok(narrow.includes('FLAG'));
    assert.ok(narrow.includes('#42'));
  }
});

test('column block sanitizes strings, rejects unsafe spans/styles and never mutates callers', () => {
  const row = { value: 'h\x1b[31m界\n', marks: ['●'], right: '✓' };
  const before = structuredClone(row);
  assert.ok(plain([row])[0].includes('h?[31m??'));
  assert.ok(plain([row])[0].includes(' · ?'));
  assert.deepEqual(row, before);
  for (const text of ['\x1b[31m', '界', '\n', '★']) assert.throws(() => plain([{ value: [span(text)] }]), TypeError);
  for (const glyph of ['◐', '✓']) {
    assert.ok(plain([{ value: [span(glyph)] }])[0].includes(glyph));
    assert.doesNotThrow(() => plain([{ value: 'v', right: 'r' }], 34, { separator: glyph }));
  }
  for (const style of [null, 'warning', { fg: '__proto__' }, { bg: '#fff' }, { bold: 'yes' }]) assert.throws(() => plain([{ value: [{ text: 'x', style }] }]), TypeError);
  const parts = Object.freeze([Object.freeze(span('abcdef', Object.freeze({ fg: 'warning' })))]);
  assert.doesNotThrow(() => plain([{ value: parts }], 11));
});

test('column block rejects invalid row and geometry input without coercion', () => {
  for (const rows of [null, {}, 'rows', [null], [[]], [1], [{ head: 1 }], [{ value: null }], [{ right: 42 }], [{ marks: 'FLAG' }], [{ marks: [null] }], [{ marks: [undefined] }], [{ value: [{}] }]]) assert.throws(() => plain(rows), TypeError);
  for (const options of [null, 34, '34', []]) assert.throws(() => columnBlock([], options), TypeError);
  for (const width of [0, -1, 1.5, 1001, Infinity, '34']) assert.throws(() => plain([], width), RangeError);
  for (const options of [{ gutterEnd: -1 }, { indent: 8 }, { headIndent: 8 }, { indent: '3' }, { textCells: 0 }, { rightCells: 1001 }, { textCells: 9 }, { separator: '' }]) assert.throws(() => plain([], 34, options), RangeError);
  for (const separator of [42, '\x1b', '界', '★']) assert.throws(() => plain([], 34, { separator }), TypeError);
});
