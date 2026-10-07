import test from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS, lineWidth, paint } from '../../foundation/cells.mjs';
import { labelPlate, PLATE_TONES } from './label-plate.mjs';

const text = (line) => paint(line, 'none');
const allowed = (s) => [...s].every((c) => (c >= ' ' && c <= '~') || GLYPHS.includes(c));

test('plates are bounded by caps and padding in plain text', () => {
  assert.equal(text(labelPlate('SECTOR 7', { tone: 'accent' })), '▐ SECTOR 7 ▌');
  assert.equal(text(labelPlate('01', { tone: 'accent', pad: false })), '▐01▌');
  for (const tone of Object.keys(PLATE_TONES)) assert.equal(lineWidth(labelPlate('WARN', { tone })), 8);
});

test('plates are informational, not button-shaped', () => {
  assert.doesNotMatch(text(labelPlate('MANIFEST')), /[[\]<>]/);
});

test('plates fit maxWidth: truncate text first, keep padding down to 5 cells', () => {
  for (let max = 0; max <= 20; max++) {
    const line = labelPlate('CALIBRATION RUN', { maxWidth: max });
    assert.ok(lineWidth(line) <= max, `max ${max}`);
    assert.ok(allowed(text(line)));
  }
  assert.equal(text(labelPlate('CALIBRATION RUN', { maxWidth: 12 })), '▐ CALIBRA… ▌');
  assert.equal(text(labelPlate('CALIBRATION RUN', { maxWidth: 4 })), '▐C…▌');
});

test('plate text cannot inject terminal controls', () => {
  const line = labelPlate('\x1b]0;owned\x07OK', { tone: 'critical' });
  assert.equal(text(line), '▐ ?]0;owned?OK ▌');
  assert.equal(paint(line, 'truecolor').split('\x1b').length - 1, 4); // only the 3 span SGRs + reset
});

test('invalid tone and width are rejected', () => {
  for (const tone of ['success', 'toString', '__proto__', 'constructor']) {
    assert.throws(() => labelPlate('X', { tone }), RangeError);
  }
  assert.throws(() => labelPlate('X', { maxWidth: -1 }), RangeError);
  assert.throws(() => labelPlate('X', { maxWidth: 2.5 }), RangeError);
  assert.throws(() => labelPlate(7), TypeError);
});
