import test from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS } from './cells.mjs';
import { BARCODE_BARS, barcode } from './barcode.mjs';
import { random } from './seeded.mjs';

test('a barcode is exactly n cells of guard bars around picked bars, deterministic for its picker', () => {
  assert.ok(Object.isFrozen(BARCODE_BARS));
  for (const bar of BARCODE_BARS) assert.ok(bar === ' ' || GLYPHS.includes(bar), bar);
  const seeded = (seed) => { const r = random(seed); return (count) => Math.floor(r() * count); };
  // The droid header mockup's bars for session 0000BEEF.
  assert.equal(barcode(16, seeded(0xbeef)), '▌ ▌ ▍ ▍▏█▎▍ ▏█▎▐');
  assert.equal(barcode(16, seeded(0xbeef)), barcode(16, seeded(0xbeef)));
  assert.notEqual(barcode(16, seeded(1)), barcode(16, seeded(2)));
  for (const n of [1, 2, 3, 16, 160, 1000]) {
    const code = barcode(n, seeded(n));
    assert.equal([...code].length, n);
    assert.equal(code[0], '▌');
    if (n > 1) assert.equal([...code].at(-1), '▐');
  }
  let calls = 0;
  barcode(10, () => { calls++; return 0; });
  assert.equal(calls, 8);
});

test('invalid widths, pickers and picks throw', () => {
  for (const n of [0, 1001, 1.5, '4']) assert.throws(() => barcode(n, () => 0), RangeError);
  assert.throws(() => barcode(4, null), TypeError);
  for (const pick of [() => -1, () => 10, () => 0.5, () => '1']) assert.throws(() => barcode(4, pick), RangeError);
});
