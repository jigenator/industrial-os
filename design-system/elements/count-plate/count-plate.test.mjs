import test from 'node:test';
import assert from 'node:assert/strict';
import { stripVTControlCharacters } from 'node:util';
import { GLYPHS, lineWidth, paint } from '../../foundation/cells.mjs';
import { SIGNAL_COLORS } from '../../foundation/signal-colors.mjs';
import { COUNT_PLATES, countPlate } from './count-plate.mjs';

const text = (line) => paint(line, 'none');
const allowed = (s) => [...s].every((c) => (c >= ' ' && c <= '~') || GLYPHS.includes(c));
const { compactions: CMP, units: AU } = COUNT_PLATES;

test('CMP plate matches status-bar exactly: fixed eight cells, 99+ in the pad cell, ?? unknown', () => {
  // pi/status-bar/src/footer.ts cmpPlate: ` CMP×${padStart(2, '0')} `, ` CMP×99+` above 99, ` CMP×?? ` unknown.
  assert.equal(text(countPlate(0, CMP)), ' CMP×00 ');
  assert.equal(text(countPlate(7, CMP)), ' CMP×07 ');
  assert.equal(text(countPlate(99, CMP)), ' CMP×99 ');
  assert.equal(text(countPlate(100, CMP)), ' CMP×99+');
  assert.equal(text(countPlate(123456, CMP)), ' CMP×99+');
  assert.equal(text(countPlate(null, CMP)), ' CMP×?? ');
  assert.equal(text(countPlate(undefined)), ' CMP×?? ', 'compactions is the default spec');
  for (const n of [0, 5, 42, 99, 100, 1e6, null]) assert.equal(lineWidth(countPlate(n, CMP)), 8);
});

test('CMP tiers follow cmpStyle: 0/unknown grey, 1-2 violet, 3-4 pink, 5+ critical', () => {
  // footer.ts cmpStyle: 0/unknown text on plate, <=2 text on violet, <=4 field on pink, else field on high.
  const style = (n) => countPlate(n, CMP)[0].style;
  assert.deepEqual(style(0), { fg: 'primary', bg: 'structural', bold: true });
  assert.deepEqual(style(null), { fg: 'primary', bg: 'structural', bold: true });
  for (const n of [1, 2]) assert.deepEqual(style(n), { fg: 'primary', bg: SIGNAL_COLORS.violet, bold: true });
  for (const n of [3, 4]) assert.deepEqual(style(n), { fg: 'field', bg: SIGNAL_COLORS.pink, bold: true });
  for (const n of [5, 99, 100]) assert.deepEqual(style(n), { fg: 'field', bg: 'critical', bold: true }, `count ${n}`);
});

test('AU badge matches status-bar exactly: seven cells to 99, then the exact value widens it', () => {
  // footer.ts unitBadge: ` ${units === undefined ? ' ?' : String(units).padStart(2, '0')} AU `.
  assert.equal(text(countPlate(0, AU)), ' 00 AU ');
  assert.equal(text(countPlate(3, AU)), ' 03 AU ');
  assert.equal(text(countPlate(12, AU)), ' 12 AU ');
  assert.equal(text(countPlate(null, AU)), '  ? AU ');
  assert.equal(text(countPlate(100, AU)), ' 100 AU ');
  assert.equal(text(countPlate(123456, AU)), ' 123456 AU ');
  // footer.ts badgeStyle: unknown GREY_PLATE, 0 secondary on surface (not bold), else field on text, bold.
  assert.deepEqual(countPlate(null, AU)[0].style, { fg: 'primary', bg: 'structural', bold: true });
  assert.deepEqual(countPlate(0, AU)[0].style, { fg: 'secondary', bg: 'surface', bold: false });
  assert.deepEqual(countPlate(1, AU)[0].style, { fg: 'field', bg: 'primary', bold: true });
});

test('unknown is never zero-shaped', () => {
  for (const spec of [CMP, AU]) {
    const unknown = text(countPlate(null, spec));
    assert.match(unknown, /\?/);
    assert.doesNotMatch(unknown, /0/);
    assert.notEqual(unknown, text(countPlate(0, spec)));
  }
  assert.notDeepEqual(countPlate(null, AU)[0].style, countPlate(0, AU)[0].style);
});

test('narrow budgets drop the pads, then show # cells, never partial digits', () => {
  assert.equal(text(countPlate(7, CMP, { maxWidth: 7 })), 'CMP×07');
  assert.equal(text(countPlate(7, CMP, { maxWidth: 6 })), 'CMP×07');
  assert.equal(text(countPlate(7, CMP, { maxWidth: 5 })), '#####');
  assert.equal(text(countPlate(100, CMP, { maxWidth: 7 })), 'CMP×99+');
  assert.equal(text(countPlate(3, AU, { maxWidth: 5 })), '03 AU');
  assert.equal(text(countPlate(null, AU, { maxWidth: 4 })), '? AU');
  assert.equal(text(countPlate(3, AU, { maxWidth: 1 })), '#');
  assert.deepEqual(countPlate(3, AU, { maxWidth: 0 }), []);
  for (let max = 0; max <= 12; max++) {
    for (const spec of [CMP, AU]) {
      for (const n of [0, 3, 12, 100, null]) {
        const line = countPlate(n, spec, { maxWidth: max });
        const shown = text(line);
        assert.ok(lineWidth(line) <= max, `max ${max}`);
        assert.ok(allowed(shown));
        assert.ok(shown === '' || /^#+$/.test(shown) || shown.includes(spec.label), `label or # at ${max}: ${shown}`);
      }
    }
  }
});

test('a custom spec uses the same rules', () => {
  const spec = { label: 'RTY', side: 'after', joiner: '×', cap: 9, unknown: '??', unknownStyle: { fg: 'secondary' }, tiers: [{ upTo: Infinity, style: { fg: 'warning' } }] };
  assert.equal(text(countPlate(4, spec)), ' 04×RTY ');
  assert.equal(text(countPlate(12, spec)), ' 9+×RTY ');
  assert.equal(text(countPlate(null, spec)), ' ??×RTY ');
  assert.equal(text(countPlate(1, { ...spec, label: 'A\x1b[2J' })), ' 01×A?[2J ');
});

test('plain output equals stripped color output', () => {
  for (const spec of [CMP, AU]) {
    for (const n of [0, 1, 3, 5, 100, null]) {
      const line = countPlate(n, spec);
      assert.equal(stripVTControlCharacters(paint(line, 'truecolor')), text(line));
    }
  }
});

test('invalid counts and specs throw rather than becoming unknown or zero', () => {
  for (const n of [-1, 1.5, Number.NaN, Infinity, 2 ** 60]) assert.throws(() => countPlate(n, CMP), RangeError, String(n));
  for (const n of ['3', true, {}]) assert.throws(() => countPlate(n, AU), TypeError, String(n));
  assert.throws(() => countPlate(1, CMP, { maxWidth: -1 }), RangeError);
  assert.throws(() => countPlate(1, CMP, { maxWidth: 1.5 }), RangeError);
  assert.throws(() => countPlate(1, null), TypeError);
  assert.throws(() => countPlate(1, { ...CMP, side: 'left' }), RangeError);
  assert.throws(() => countPlate(1, { ...CMP, joiner: 'x' }), RangeError);
  assert.throws(() => countPlate(1, { ...CMP, joiner: '××' }), RangeError);
  assert.throws(() => countPlate(1, { ...CMP, cap: 0 }), RangeError);
  assert.throws(() => countPlate(1, { ...CMP, unknown: '0' }), RangeError);
  assert.throws(() => countPlate(1, { ...CMP, label: 3 }), TypeError);
  assert.throws(() => countPlate(1, { ...CMP, tiers: [] }), RangeError);
  assert.throws(() => countPlate(1, { ...CMP, tiers: [{ upTo: 4, style: {} }] }), RangeError);
  assert.throws(() => countPlate(1, { ...CMP, tiers: [{ upTo: 4, style: {} }, { upTo: 2, style: {} }, { upTo: Infinity, style: {} }] }), RangeError);
});
