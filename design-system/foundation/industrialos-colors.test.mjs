import test from 'node:test';
import assert from 'node:assert/strict';
import { INDUSTRIALOS_COLORS, shadeRamp } from './industrialos-colors.mjs';
import { paint, span } from './cells.mjs';
import { stripVTControlCharacters } from 'node:util';

const approved = [
  ['acid-lime', '#C0FE04', 'lime'], ['acid-lime-link', '#E5FF45', 'lime'], ['acid-lime-pale', '#EAFC88', 'lime'],
  ['signal-red', '#F24723', 'red-orange'], ['signal-orange', '#FF5C00', 'orange'], ['violet', '#5200FF', 'violet'],
  ['indigo', '#3F01FB', 'indigo'], ['link-blue', '#0000F8', 'blue'], ['field-black', '#000000', 'neutral'],
  ['input-black', '#0E0E0E', 'neutral'], ['surface-grey', '#1C1C1C', 'neutral'], ['input-hover-grey', '#1F1F1F', 'neutral'],
  ['structure-grey', '#555555', 'neutral'], ['muted-grey', '#717171', 'neutral'], ['light-paper', '#F6F6F6', 'neutral'],
  ['paper-white', '#FFFFFF', 'neutral'], ['magenta', '#FF15BD', 'magenta'], ['lavender', '#9C84F5', 'violet'],
  ['steel-blue', '#48617F', 'blue'], ['pale-blue', '#95B8D1', 'blue'], ['yellow', '#F8ED34', 'yellow'],
  ['mint', '#8DF3BC', 'mint'],
];

function assertFrozen(value) {
  if (value === null || typeof value !== 'object') return;
  assert.ok(Object.isFrozen(value));
  for (const child of Object.values(value)) assertFrozen(child);
}

test('IndustrialOS colors keep the approved 22 hex values and families under unique kebab-case ids', () => {
  assert.equal(INDUSTRIALOS_COLORS.length, 22);
  assert.equal(new Set(INDUSTRIALOS_COLORS.map((color) => color.id)).size, INDUSTRIALOS_COLORS.length);
  assert.deepEqual(INDUSTRIALOS_COLORS.map((color) => [color.id, color.hex, color.family]), approved);
  for (const color of INDUSTRIALOS_COLORS) {
    assert.deepEqual(Object.keys(color), ['id', 'name', 'hex', 'family', 'role']);
    assert.match(color.id, /^[a-z]+(?:-[a-z]+)*$/);
    assert.match(color.hex, /^#[0-9A-F]{6}$/);
    for (const value of [color.name, color.family, color.role]) {
      assert.ok(value.length > 0);
      assert.match(value, /^[\x20-\x7e]+$/);
    }
  }
});

test('IndustrialOS colors and their records are immutable', () => {
  assertFrozen(INDUSTRIALOS_COLORS);
  assert.throws(() => INDUSTRIALOS_COLORS.push({}), TypeError);
  assert.throws(() => { INDUSTRIALOS_COLORS[0].hex = '#000000'; }, TypeError);
  assert.throws(() => { INDUSTRIALOS_COLORS[0].role = 'Other'; }, TypeError);
});

test('shadeRamp fixes the exact center, order, derivation labels and rounded sRGB mixes', () => {
  const ramp = shadeRamp('#c0fE04');
  assert.deepEqual(ramp, [
    { id: 'dark-75', label: 'BLACK 75%', kind: 'derived', hex: '#304001' },
    { id: 'dark-40', label: 'BLACK 40%', kind: 'derived', hex: '#739802' },
    { id: 'base', label: 'BASE', kind: 'base', hex: '#C0FE04' },
    { id: 'light-40', label: 'WHITE 40%', kind: 'derived', hex: '#D9FE68' },
    { id: 'light-75', label: 'WHITE 75%', kind: 'derived', hex: '#EFFFC0' },
  ]);
  assert.deepEqual(shadeRamp('#c0fE04'), ramp);
  assertFrozen(ramp);
  assert.deepEqual(shadeRamp('#000000').map((step) => step.hex), ['#000000', '#000000', '#000000', '#666666', '#BFBFBF']);
  assert.deepEqual(shadeRamp('#FFFFFF').map((step) => step.hex), ['#404040', '#999999', '#FFFFFF', '#FFFFFF', '#FFFFFF']);
});

test('shadeRamp is deterministic across every byte and preserves every color as its center', () => {
  for (let channel = 0; channel <= 255; channel++) {
    const hex = '#' + channel.toString(16).padStart(2, '0').repeat(3);
    const ramp = shadeRamp(hex);
    const expected = [Math.round(channel / 4), Math.round(channel * 3 / 5), channel,
      Math.round(channel * 3 / 5 + 102), Math.round(channel / 4 + 191.25)];
    assert.deepEqual(ramp.map((step) => parseInt(step.hex.slice(1, 3), 16)), expected);
    assert.deepEqual(shadeRamp(hex), ramp);
  }
  for (const color of INDUSTRIALOS_COLORS) {
    const channels = [1, 3, 5].map((offset) => parseInt(color.hex.slice(offset, offset + 2), 16));
    const expected = [[0, 0.75], [0, 0.4], [0, 0], [255, 0.4], [255, 0.75]].map(([target, proportion]) =>
      '#' + channels.map((value) => Math.round(value * (1 - proportion) + target * proportion).toString(16).padStart(2, '0')).join('').toUpperCase());
    assert.deepEqual(shadeRamp(color.hex).map((step) => step.hex), expected);
    assert.equal(shadeRamp(color.hex)[2].hex, color.hex);
  }
});

test('every IndustrialOS color and derived shade paints its actual RGB without changing plain cells', () => {
  for (const color of INDUSTRIALOS_COLORS) {
    for (const step of shadeRamp(color.hex)) {
      const rgb = [1, 3, 5].map((offset) => parseInt(step.hex.slice(offset, offset + 2), 16)).join(';');
      const line = [span('  ', { bg: step.hex }), span(color.name + ' ' + step.hex)];
      const painted = paint(line, 'truecolor');
      assert.ok(painted.startsWith(`\x1b[0;38;2;207;207;207;48;2;${rgb}m  `));
      assert.equal(stripVTControlCharacters(painted), paint(line, 'none'));
    }
  }
});

test('shadeRamp rejects anything except a primitive exact six-digit hex string', () => {
  for (const value of [undefined, null, 123456, true, {}, [], new String('#123456'),
    '#fff', '#12345678', '123456', '#gg0000', ' #123456', '#123456 ', '#123456\n',
    '#123456\r', '#123456\u2028', '#123456\x1b[0m', 'accent']) {
    assert.throws(() => shadeRamp(value), TypeError);
  }
});
