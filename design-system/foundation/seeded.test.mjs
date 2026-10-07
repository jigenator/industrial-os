import test from 'node:test';
import assert from 'node:assert/strict';
import { between, hash, pick, random, seedFrom, shuffle } from './seeded.mjs';

test('random is deterministic per seed and stays in [0, 1)', () => {
  const a = random(42), b = random(42), c = random(43);
  const xs = Array.from({ length: 1000 }, () => a());
  assert.deepEqual(Array.from({ length: 1000 }, () => b()), xs);
  assert.notDeepEqual(Array.from({ length: 1000 }, () => c()), xs);
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  for (const bad of [1.5, Number.NaN, '1', undefined]) assert.throws(() => random(bad), RangeError);
});

test('hash is stateless and in [0, 1); helpers draw within their bounds', () => {
  assert.equal(hash(1, 2, 3), hash(1, 2, 3));
  assert.notEqual(hash(1, 2, 3), hash(2, 1, 3));
  for (let i = 0; i < 200; i++) { const h = hash(i, i * 7, 99); assert.ok(h >= 0 && h < 1); }
  const r = random(7);
  for (let i = 0; i < 500; i++) { const n = between(r, [2, 5]); assert.ok(n >= 2 && n <= 5 && Number.isInteger(n)); }
  assert.ok(['a', 'b'].includes(pick(r, ['a', 'b'])));
  const list = [1, 2, 3, 4, 5];
  assert.deepEqual(shuffle(r, list).sort(), list);
  assert.deepEqual(list, [1, 2, 3, 4, 5]);
  const s = seedFrom(r);
  assert.ok(Number.isInteger(s) && s >= 0 && s < 2 ** 31);
});
