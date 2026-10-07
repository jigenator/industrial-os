import test from 'node:test';
import assert from 'node:assert/strict';
import { stripVTControlCharacters } from 'node:util';
import { GLYPHS, fitLine, lineWidth, paint } from '../../foundation/cells.mjs';
import { SIGNAL_COLORS } from '../../foundation/signal-colors.mjs';
import { modePlate, PNYTL_MODES, pnytlPlate } from './mode-plate.mjs';

test('exact PNYTL snapshots in all seven modes, with a white 16-cell body', () => {
  // footer.ts:143-147 and 1153-1159, one field gap each side, not half-block caps.
  for (const [state, { code, ink }] of Object.entries(PNYTL_MODES)) {
    const line = pnytlPlate(state);
    assert.equal(paint(line, 'none'), `  ⌑ PNYTL // ${code}  `);
    assert.equal(lineWidth(line), 18);
    assert.equal(lineWidth(line.filter((s) => s.style.bg === 'primary')), 16);
    assert.deepEqual(line.find((s) => s.text === code).style, { fg: ink, bg: 'primary', bold: true });
    assert.equal(line[2].style.fg, 'field');
  }
  assert.notEqual(paint(pnytlPlate('unknown'), 'none'), paint(pnytlPlate('off'), 'none'));
});
test('active is the explicit light frame, gated to confirmed enabled PNYTL modes', () => {
  for (const state of ['lite', 'full', 'ultra', 'review']) {
    const line = pnytlPlate(state, { active: true });
    assert.equal(paint(line, 'none'), `  • PNYTL // ${PNYTL_MODES[state].code}  `);
    assert.equal(line[2].style.fg, SIGNAL_COLORS.pink);
  }
  for (const state of ['off', 'checking', 'unknown']) assert.deepEqual(pnytlPlate(state, { active: true }), pnytlPlate(state));
});
test('generic icon/title/code/ink and sanitized caller text', () => {
  assert.equal(paint(modePlate({ icon: '◆', title: 'LINK', code: 'ON', ink: 'accent' }), 'none'), '  ◆ LINK // ON  ');
  assert.equal(paint(modePlate({ title: '\x1b', code: '界', ink: 'warning' }), 'none'), '  ⌑ ? // ?  ');
});
test('inline maxWidth 0–160 and fitted lines 1–160 keep curated glyphs and plain/color equivalence', () => {
  for (let width = 0; width <= 160; width++) for (const state of Object.keys(PNYTL_MODES)) for (const active of [false, true]) {
    const piece = pnytlPlate(state, { maxWidth: width, active });
    assert.equal(lineWidth(piece), Math.min(width, 18));
    const line = width ? fitLine(piece, width) : piece;
    assert.equal(lineWidth(line), width);
    const plain = paint(line, 'none');
    assert.ok([...plain].every((c) => /[\x20-\x7e]/.test(c) || GLYPHS.includes(c)));
    assert.equal(stripVTControlCharacters(paint(line, 'truecolor')), plain);
  }
});
test('invalid states, widths, icons, inks and text fail explicitly', () => {
  for (const state of ['bad', '__proto__', 'constructor', undefined]) assert.throws(() => pnytlPlate(state), RangeError);
  for (const maxWidth of [-1, 0.5, NaN, 1001]) assert.throws(() => pnytlPlate('lite', { maxWidth }), RangeError);
  for (const icon of ['界', '\x1b', 'xx', 3]) assert.throws(() => modePlate({ title: 'X', code: 'ON', ink: 'primary', icon }), TypeError);
  assert.throws(() => modePlate({ title: 'X', code: 'ON', ink: 'bad' }), TypeError);
  assert.throws(() => modePlate({ title: 1, code: 'ON', ink: 'primary' }), TypeError);
  assert.throws(() => pnytlPlate('off', { active: 1 }), TypeError);
});
