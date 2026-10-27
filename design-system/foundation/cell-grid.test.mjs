import test from 'node:test'; import assert from 'node:assert/strict'; import { CellGrid } from './cell-grid.mjs'; import { lineWidth, paint, span } from './cells.mjs';
test('grid clips coordinates, sanitizes external text and copies output', () => { const g = new CellGrid(4, 2); g.text(-1, 0, 'ab\x1bc'); assert.equal(paint(g.lines()[0], 'none'), 'b?c '); g.put(40, 40, 'x'); assert.throws(() => g.put(0, 0, '\x1b')); assert.throws(() => g.put(0, 0, '好')); assert.throws(() => g.put(0, 0, 'a', {fg:'bad'})); const lines = g.lines(); lines[0][0].text = 'z'; assert.equal(g.rows[0][0].text,'b'); });
test('invalid dimensions rejected', () => { for (const n of [0,-1,Infinity,1.2,1001]) assert.throws(() => new CellGrid(n,2)); });
const measure = (text) => [...new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(text)].reduce((n, { segment }) => n + (/\p{Extended_Pictographic}|[\u3000-\u9fff]/u.test(segment) ? 2 : 1), 0);
test('measured text keeps wide graphemes whole with continuation cells and clips with an ellipsis', () => {
  const g = new CellGrid(8, 1, { measure });
  assert.equal(g.text(0, 0, 'a日本語', { fg: 'accent' }), 7); assert.deepEqual(g.lines()[0].map(s => s.text), ['a', '日', '', '本', '', '語', '', ' ']);
  assert.equal(lineWidth(g.lines()[0], { measure }), 8); assert.equal(g.rows[0][2].style.fg, 'accent');
  assert.equal(g.text(0, 0, '\u{1F469}\u200d\u{1F4BB}\u{1F469}\u200d\u{1F4BB}\u{1F469}\u200d\u{1F4BB}\u{1F469}\u200d\u{1F4BB}\u{1F469}\u200d\u{1F4BB}'), 7); assert.equal(paint(g.lines()[0], 'none'), '\u{1F469}\u200d\u{1F4BB}\u{1F469}\u200d\u{1F4BB}\u{1F469}\u200d\u{1F4BB}… ');
  assert.equal(g.text(0, 0, '“quoted” — é', {}, 8), 8); assert.equal(paint(g.lines()[0], 'none'), '“quoted…');
  assert.throws(() => g.text(0, 0, 'bad\x1b[2J'), TypeError); assert.throws(() => g.text(0, 0, 'rtl\u202e'), TypeError);
});
test('overwriting either half of a wide grapheme blanks the whole grapheme; edges never split one', () => {
  const g = new CellGrid(4, 1, { measure });
  g.text(0, 0, '日本'); g.put(1, 0, 'x'); assert.deepEqual(g.lines()[0].map(s => s.text), [' ', 'x', '本', '']);
  g.put(2, 0, 'y'); assert.deepEqual(g.lines()[0].map(s => s.text), [' ', 'x', 'y', ' ']);
  g.text(3, 0, '日'); assert.equal(paint(g.lines()[0], 'none'), ' xy…');
  g.place(-1, 0, [[span('日本', {})]]); assert.deepEqual(g.lines()[0].map(s => s.text), [' ', '本', '', '…']);
  assert.throws(() => g.place(0, 0, [[span('\x07', {})]]), TypeError); assert.throws(() => new CellGrid(2, 2, { measure: 1 }), TypeError);
  const plain = new CellGrid(3, 1); plain.text(0, 0, '日本'); assert.equal(paint(plain.lines()[0], 'none'), '?? ');
});
