import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ACID_BLACK } from '@industrial-os/design-system/foundation/palette';

const source = readFileSync(new URL('../industrial-os.omp.json', import.meta.url), 'utf8');

test('each mirrored role matches Acid / Black, with no other hex literals', () => {
  const { palette } = JSON.parse(source);
  assert.deepEqual(Object.keys(palette).sort(),
    ['primary', 'secondary', 'accent', 'warning', 'critical'].sort());
  for (const [role, hex] of Object.entries(palette)) assert.equal(hex, ACID_BLACK[role], role);
  assert.deepEqual([...source.matchAll(/#[\da-fA-F]{6}\b/g)].map(([hex]) => hex), Object.values(palette));
});
