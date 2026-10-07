import test from 'node:test';
import assert from 'node:assert/strict';
import { stripVTControlCharacters } from 'node:util';
import { fit, fitLine, lineWidth, paint, safeText, span } from './cells.mjs';
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
