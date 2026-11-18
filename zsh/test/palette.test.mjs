import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ACID_BLACK } from '@industrial-os/design-system/foundation/palette';

const theme = readFileSync(new URL('../industrial-os.zsh-theme', import.meta.url), 'utf8');

test('each mirrored role matches Acid / Black, with no other hex literals', () => {
  const roles = [...theme.matchAll(/^  (\w+) '(#[\da-f]{6})'$/gm)];
  assert.deepEqual(roles.map(([, role]) => role).sort(),
    ['primary', 'secondary', 'accent', 'warning', 'critical'].sort());
  for (const [, role, hex] of roles) assert.equal(hex, ACID_BLACK[role], role);
  assert.deepEqual([...theme.matchAll(/#[\da-fA-F]{6}\b/g)].map(([hex]) => hex), roles.map(([, , hex]) => hex));
});
