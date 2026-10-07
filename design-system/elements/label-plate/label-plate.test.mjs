import test from 'node:test';
import assert from 'node:assert/strict';
import { stripVTControlCharacters } from 'node:util';
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

test('capped output is unchanged by the form option', () => {
  for (const tone of Object.keys(PLATE_TONES)) {
    for (const max of [Infinity, 0, 2, 4, 12]) {
      assert.deepEqual(labelPlate('SECTOR 7', { tone, maxWidth: max, form: 'capped' }), labelPlate('SECTOR 7', { tone, maxWidth: max }));
    }
  }
});

test('slab plates are status-bar padded plates: one filled span, no caps', () => {
  // pi/status-bar/src/footer.ts renderFooter: plate() draws ` ${LABEL[key]}`.padEnd(8) in PLATE / GREY_PLATE.
  assert.equal(text(labelPlate('01 ACT', { tone: 'accent', form: 'slab' })), ' 01 ACT ');
  assert.equal(text(labelPlate('02 CTX', { tone: 'warning', form: 'slab' })), ' 02 CTX ');
  assert.equal(text(labelPlate('05 EXT', { form: 'slab' })), ' 05 EXT ');
  assert.equal(text(labelPlate('ROOT', { tone: 'accent', form: 'slab', pad: false })), 'ROOT');
  assert.deepEqual(labelPlate('01 ACT', { tone: 'accent', form: 'slab' }), [{ text: ' 01 ACT ', style: { fg: 'field', bg: 'accent', bold: true } }]);
  // GREY_PLATE { fg: text, bg: plate } = DS primary on structural; PLATE.ok { field on primary(acid) } = DS accent.
  assert.deepEqual(labelPlate('05 EXT', { form: 'slab' })[0].style, { fg: 'primary', bg: 'structural', bold: true });
  // The MDL plate { fg: field, bg: text } is the bright tone.
  assert.deepEqual(labelPlate('03 MDL', { tone: 'bright', form: 'slab' })[0].style, { fg: 'field', bg: 'primary', bold: true });
  assert.deepEqual(labelPlate('02 CTX', { tone: 'critical', form: 'slab' })[0].style, { fg: 'field', bg: 'critical', bold: true });
  for (const tone of Object.keys(PLATE_TONES)) assert.equal(lineWidth(labelPlate('WARN', { tone, form: 'slab' })), 6);
});

test('slab plates fit maxWidth: truncate text first, keep padding down to 3 cells', () => {
  for (let max = 0; max <= 20; max++) {
    const line = labelPlate('CALIBRATION RUN', { form: 'slab', maxWidth: max });
    assert.ok(lineWidth(line) <= max, `max ${max}`);
    assert.ok(allowed(text(line)));
  }
  assert.equal(text(labelPlate('CALIBRATION RUN', { form: 'slab', maxWidth: 10 })), ' CALIBRA… ');
  assert.equal(text(labelPlate('CALIBRATION RUN', { form: 'slab', maxWidth: 3 })), ' C ');
  assert.equal(text(labelPlate('CALIBRATION RUN', { form: 'slab', maxWidth: 2 })), 'C…');
  assert.equal(text(labelPlate('CALIBRATION RUN', { form: 'slab', maxWidth: 0 })), '');
});

test('slab text cannot inject controls, and plain equals stripped color', () => {
  const line = labelPlate('\x1b[2J01', { tone: 'critical', form: 'slab' });
  assert.equal(text(line), ' ?[2J01 ');
  assert.equal(stripVTControlCharacters(paint(line, 'truecolor')), text(line));
});

test('invalid forms are rejected', () => {
  for (const form of ['round', 'toString', '', null]) assert.throws(() => labelPlate('X', { form }), RangeError);
});
