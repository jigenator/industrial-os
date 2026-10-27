import test from 'node:test';
import assert from 'node:assert/strict';
import { stripVTControlCharacters } from 'node:util';
import { GLYPHS, fit, fitLine, lineWidth, paint, safeText, span } from './cells.mjs';
import { ACID_BLACK } from './palette.mjs';

test('safeText replaces every non-printable-ASCII code point with one ?', () => {
  assert.equal(safeText('OK 42'), 'OK 42');
  assert.equal(safeText('\x1b[31mRED\x07'), '?[31mRED?');
  assert.equal(safeText('\x9b2J'), '?2J'); // C1 CSI
  assert.equal(safeText('e\u0301'), 'e?'); // combining mark
  assert.equal(safeText('界🙂'), '??'); // wide and astral code points
  assert.equal(safeText('a\nb\tc'), 'a?b?c');
  assert.throws(() => safeText(42), TypeError);
  assert.throws(() => safeText(null), TypeError);
});

test('fit never exceeds its budget and marks truncation', () => {
  for (let n = 0; n <= 12; n++) assert.ok([...fit('CALIBRATION', n)].length <= n);
  assert.equal(fit('CALIBRATION', 6), 'CALIB…');
  assert.equal(fit('CALIBRATION', 11), 'CALIBRATION');
  assert.equal(fit('AB', 1), 'A');
});

test('fitLine clips or pads to exactly n cells', () => {
  const line = [span('▐'), span('ABCDEF', { bold: true }), span('▌')];
  for (let n = 0; n <= 12; n++) assert.equal(lineWidth(fitLine(line, n)), n);
  assert.equal(fitLine(line, 4).map((s) => s.text).join(''), '▐ABC');
});

test('paint emits palette truecolor that strips back to the plain text', () => {
  const line = [span('▐', { fg: 'accent' }), span(' 01 ', { fg: 'field', bg: 'accent', bold: true }), span('▌', { fg: 'accent' })];
  const plain = paint(line, 'none');
  const color = paint(line, 'truecolor');
  assert.equal(plain, '▐ 01 ▌');
  assert.equal(stripVTControlCharacters(color), plain);
  assert.match(color, /38;2;192;254;4/); // accent #c0fe04
  assert.match(color, /\x1b\[0m$/);
  assert.doesNotMatch(plain, /\x1b/);
});

test('paint preserves default SGR, every Acid / Black role, bold and adjacent-style coalescing', () => {
  assert.equal(paint([span('A'), span('B')], 'truecolor'), '\x1b[0;38;2;207;207;207;48;2;0;0;0mAB\x1b[0m');
  assert.equal(paint([], 'truecolor'), '\x1b[0m');
  assert.equal(paint([], 'none'), '');
  for (const [role, hex] of Object.entries(ACID_BLACK)) {
    const rgb = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)).join(';');
    assert.equal(paint([span('X', { fg: role, bg: role, bold: true })], 'truecolor'),
      `\x1b[0;1;38;2;${rgb};48;2;${rgb}mX\x1b[0m`);
  }
});

test('paint accepts literal RGB in either channel and coalesces equivalent role/hex styles', () => {
  const line = [span('A', { fg: '#aB09fF', bg: '#F24723', bold: true }), span(' B', { fg: 'accent', bg: '#000000' }), span('C', { fg: '#C0FE04', bg: 'field' })];
  assert.equal(paint(line, 'truecolor'), '\x1b[0;1;38;2;171;9;255;48;2;242;71;35mA\x1b[0;38;2;192;254;4;48;2;0;0;0m BC\x1b[0m');
  assert.equal(stripVTControlCharacters(paint(line, 'truecolor')), paint(line, 'none'));
  assert.equal(paint(line, 'none'), 'A BC');
  assert.equal(paint([span('X', { fg: '#000000', bg: '#FFFFFF' })], 'truecolor'), '\x1b[0;38;2;0;0;0;48;2;255;255;255mX\x1b[0m');
});

test('truecolor paint rejects invalid colors without coercion or prototype lookup', () => {
  const invalid = ['#fff', '#12345678', '#GG1234', '123456', '#123456\n', '#123456\r',
    '#123456\u2028', '#123456\x1b[0m', ' #123456', '#123456 ', '', 'unknown',
    '__proto__', 'constructor', 'toString', null, 123456, true, [], {},
    new String('#123456'), { toString() { throw new Error('must not coerce'); } }];
  for (const channel of ['fg', 'bg']) {
    for (const value of invalid) {
      const line = [span('safe', { [channel]: value })];
      assert.throws(() => paint(line, 'truecolor'), TypeError);
      // Plain painting deliberately ignores styles, including invalid ones.
      assert.equal(paint(line, 'none'), 'safe');
    }
  }
});

test('explicit terminal defaults paint as 39/49 without changing omitted-channel defaults', async () => {
  const { isTerminalDefault, resolveColor, resolveStyle } = await import('./cells.mjs');
  assert.equal(isTerminalDefault('default'), true);
  for (const value of [undefined, null, 'DEFAULT', 'field', new String('default')]) assert.equal(isTerminalDefault(value), false);
  assert.throws(() => resolveColor('default'), TypeError, 'a terminal channel has no known RGB');
  assert.deepEqual(resolveStyle(), { fg: ACID_BLACK.secondary, bg: ACID_BLACK.field, bold: false });
  assert.deepEqual(resolveStyle({ fg: 'accent', bg: 'default', bold: true }), { fg: ACID_BLACK.accent, bg: 'default', bold: true });
  assert.deepEqual(resolveStyle({ fg: 'default', bg: 'default' }), { fg: 'default', bg: 'default', bold: false });
  assert.throws(() => resolveStyle({ fg: 'unknown' }), TypeError);
  assert.equal(paint([span('AB', { fg: 'default', bg: 'default' }), span('C', { fg: 'default', bg: 'default' })], 'truecolor'), '\x1b[0;39;49mABC\x1b[0m');
  assert.equal(paint([span('X', { fg: 'accent', bg: 'default', bold: true })], 'truecolor'), '\x1b[0;1;38;2;192;254;4;49mX\x1b[0m');
  assert.equal(paint([span('X', { fg: 'default' })], 'truecolor'), '\x1b[0;39;48;2;0;0;0mX\x1b[0m');
});

const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });
const measure = (text) => [...segmenter.segment(text)].reduce((n, { segment }) => n + (/\p{Extended_Pictographic}|界|日|本/u.test(segment) ? 2 : 1), 0);

test('measured slots preserve Unicode, rich styles, whole graphemes and caller data', async () => {
  const { textSlot, fitText } = await import('./cells.mjs');
  const original = [span('日本e\u0301', { italic: true, bg: 'default' }), span('👩‍💻🙂!', { underline: true })];
  const before = structuredClone(original);
  const slot = textSlot(original, 10, { measure });
  assert.equal(paint(slot.spans, 'none'), '日本e\u0301👩‍💻🙂!');
  assert.deepEqual(original, before);
  assert.notEqual(slot.spans[0].style, original[0].style);
  for (let width = 0; width <= 160; width++) {
    const clipped = fitText(slot, width, { measure });
    assert.ok(lineWidth(clipped, { measure }) <= width);
    const fitted = fitLine(slot.spans, width, {}, { measure });
    assert.equal(lineWidth(fitted, { measure }), width);
    assert.doesNotMatch(paint(fitted, 'none'), /\?/);
    for (const { segment } of segmenter.segment(paint(clipped, 'none'))) {
      assert.ok(['日', '本', 'e\u0301', '👩‍💻', '🙂', '!', '…'].includes(segment), segment);
    }
  }
  assert.equal(paint(fitText(slot, 4, { measure }), 'none'), '日…');
  assert.match(paint(slot.spans, 'truecolor'), /0;3;/);
  assert.match(paint(slot.spans, 'truecolor'), /0;4;/);
});

test('measured slots reject injection, forged widths, split clusters and invalid measurements', async () => {
  const { textSlot, fitText } = await import('./cells.mjs');
  for (const text of ['a\x1b[31m', '\x00', '\x7f', '\x9b', '\n', '\t', '\u202e', '\u2066', '\u200f']) {
    assert.throws(() => textSlot([span(text)], 1, { measure }), TypeError);
    assert.throws(() => fitText(text, 10, { measure }), TypeError);
  }
  for (const width of [-1, 1.5, Infinity, NaN, '1']) assert.throws(() => textSlot([span('A')], width, { measure }), RangeError);
  for (const bad of [-1, 1.5, Infinity, NaN, '1']) assert.throws(() => fitText('A', 10, { measure: () => bad }), RangeError);
  assert.throws(() => textSlot([span('A')], 1), TypeError);
  assert.throws(() => textSlot(Array(1), 0, { measure }), TypeError);
  assert.throws(() => fitText('\ud800', 1, { measure }), TypeError);
  assert.throws(() => textSlot([span('界')], 1, { measure }), RangeError);
  assert.throws(() => fitText({ spans: [span('界')], width: 1 }, 10, { measure }), RangeError);
  assert.throws(() => textSlot([span('e'), span('\u0301')], 1, { measure }), RangeError);
  assert.throws(() => textSlot([span('👩'), span('‍💻')], 4, { measure }), RangeError);
  assert.throws(() => textSlot([span('A', { underline: 'yes' })], 1, { measure }), TypeError);
  assert.throws(() => fitText('A', 1001, { measure }), RangeError);
});

test('curated survey glyphs and braille keep a one-cell ruler in the narrow contract', async () => {
  const { GLYPHS } = await import('./cells.mjs');
  const newGlyphs = '╴╶┄├└┴┸▤▣▸▾▼◇›' + Array.from({ length: 256 }, (_, n) => String.fromCodePoint(0x2800 + n)).join('');
  for (const ch of newGlyphs) {
    assert.ok(GLYPHS.includes(ch), ch);
    assert.equal(lineWidth([span(`│${ch}│`)]), 3);
    assert.equal(measure(ch), 1);
  }
});

test('measured strings and slots reject leading Extend or ZWJ before attaching to element gaps', async () => {
  const { textSlot, fitText } = await import('./cells.mjs');
  for (const prefix of ['\u0301', '\u200d', '\ufe0f', '🏻']) {
    const text = prefix + 'fixture';
    const slot = { spans: [span(''), span(text)], width: measure(text) };
    assert.throws(() => textSlot(slot.spans, slot.width, { measure }), RangeError);
    assert.throws(() => fitText(slot, 20, { measure }), RangeError);
    assert.throws(() => fitText(text, 20, { measure }), RangeError);
  }
});

test('image graticule junction glyphs have the same narrow ruler contract',()=>{
  for(const glyph of ['┬','┤']) {
    assert.ok(GLYPHS.includes(glyph));
    assert.equal(lineWidth([span(glyph.repeat(40))]),40);
  }
});

test('heavy frame junction glyphs have the same narrow ruler contract', () => {
  for (const glyph of ['┣', '┫', '┻']) {
    assert.ok(GLYPHS.includes(glyph));
    assert.equal(lineWidth([span(`┃${glyph.repeat(40)}┃`)]), 42);
  }
});

test('board glyphs (run marks, slot floor, pointer, arrows and dashes) have the same narrow ruler contract', () => {
  for (const glyph of '□◩▁▶↑↓–—') {
    assert.ok(GLYPHS.includes(glyph), glyph);
    assert.equal(lineWidth([span(`│${glyph.repeat(40)}│`)]), 42);
    assert.equal(safeText(glyph), '?', 'caller text stays printable ASCII without a measurer');
  }
});

test('fitText ellipsis: always marks an overflow, even at one cell; the default keeps the first grapheme', async () => {
  const { fitText } = await import('./cells.mjs');
  const measure = (text) => [...text].length;
  for (const options of [{}, { measure }]) {
    assert.deepEqual(fitText('ABC', 1, options), [span('A')]);
    assert.deepEqual(fitText('ABC', 1, { ...options, ellipsis: 'always' }), [span('…')]);
    assert.deepEqual(fitText('ABC', 1, { ...options, ellipsis: 'always', style: { fg: 'accent' } }), [span('…', { fg: 'accent' })]);
    assert.deepEqual(fitText('A', 1, { ...options, ellipsis: 'always' }), [span('A')]);
    assert.deepEqual(fitText('ABC', 0, { ...options, ellipsis: 'always' }), fitText('ABC', 0, options));
    for (let n = 2; n <= 5; n++) assert.deepEqual(fitText('ABCDEF', n, { ...options, ellipsis: 'always' }), fitText('ABCDEF', n, options));
  }
  assert.throws(() => fitText('ABC', 1, { ellipsis: 'never' }), RangeError);
});
