import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ACID_BLACK } from '@industrial-os/design-system/foundation/palette';
import { SIGNAL_COLORS } from '@industrial-os/design-system/foundation/signal-colors';
const fragment = await readFile(new URL('../spaces.toml', import.meta.url), 'utf8');
const code = fragment.split('\n').map((line) => line.replace(/(^|\s)#.*$/, '')).join('\n');
const contract = await readFile(new URL('../../herdr-plugins/spaces/docs/token-contract.md', import.meta.url), 'utf8');
test('Spaces colors all come from the exported design-system palette', () => {
  const allowed = new Set([...Object.values(ACID_BLACK), ...Object.values(SIGNAL_COLORS)]);
  const values = [...code.matchAll(/"(#[^"]*)"/g)].map((m) => m[1]);
  assert.ok(values.length >= 15);
  for (const value of values) { assert.match(value, /^#[0-9a-f]{6}$/); assert.ok(allowed.has(value)); }
  assert.equal(code.replace(/"[^"]*"/g, '').includes('#'), false);
});
test('every Spaces contract key has exactly one row entry and no foreign custom tokens', () => {
  const list = /^Full key list: `([^`]+)` \((\d+) keys\)\.$/m.exec(contract); assert.ok(list);
  const keys = list[1].split(' '); assert.equal(keys.length, Number(list[2]));
  assert.ok(keys.every((key) => key.startsWith('sp_')), 'workspace custom keys must avoid the shared reporter namespace');
  const referenced = [...code.matchAll(/token\s*=\s*"\$([a-z_]+)"/g)].map((m) => m[1]);
  assert.deepEqual(referenced.toSorted(), keys.toSorted()); assert.equal(new Set(referenced).size, referenced.length);
  assert.match(code, /"state_icon"/); assert.match(code, /token\s*=\s*"git_status"/);
  assert.doesNotMatch(code, /token\s*=\s*"(?:workspace|branch)"/);
});
test('Spaces state icon theme tokens map to the approved roles with no per-state style fiction', () => {
  const roles = { yellow: 'accent', red: 'critical', teal: 'primary', green: 'decorative', overlay0: 'decorative' };
  for (const [key, role] of Object.entries(roles)) assert.match(code, new RegExp(`^${key}\\s*=\\s*"${ACID_BLACK[role]}"`, 'm'));
  const theme = code.split('[ui.sidebar.spaces]')[0];
  assert.equal([...theme.matchAll(/^\w+\s*=/gm)].length, 5);
  assert.match(code, /rows\s*=\s*\[\s*\[\s*"state_icon",/);
  assert.doesNotMatch(code, /token\s*=\s*"state_icon"/);
});
test('zero panes and agents use decorative grey, zero AU removes bold; unknown AU is not disguised as zero', () => {
  for (const key of ['sp_panes', 'sp_agents']) assert.match(code, new RegExp(`token = "\\$${key}", fg = "${ACID_BLACK.secondary}", rules = \\[\\{ starts_with = "00", fg = "${ACID_BLACK.decorative}" \\}\\]`));
  assert.match(code, new RegExp(`token = "\\$sp_au", fg = "${ACID_BLACK.accent}", bold = true, rules = \\[\\{ starts_with = "00", fg = "${ACID_BLACK.decorative}", bold = false \\}\\]`));
  assert.doesNotMatch(code, /starts_with\s*=\s*"\?\?"/);
});
