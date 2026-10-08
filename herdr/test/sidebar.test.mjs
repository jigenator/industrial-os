// Checks sidebar.toml against its two sources: every color is a design-system value, and every token is in the
// token contract that pi/herdr-sidebar owns (read from its canonical document, not copied).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ACID_BLACK } from '@industrial-os/design-system/foundation/palette';
import { SIGNAL_COLORS } from '@industrial-os/design-system/foundation/signal-colors';

const fragment = await readFile(new URL('../sidebar.toml', import.meta.url), 'utf8');
const contract = await readFile(new URL('../../pi/herdr-sidebar/docs/token-contract.md', import.meta.url), 'utf8');
// Comments removed: colors are quoted, so a `#` at a line start or after whitespace begins a comment.
const code = fragment.split('\n').map((line) => line.replace(/(^|\s)#.*$/, '')).join('\n');
// Scope layout checks to the canonical Pi override, not to any global agent rows.
const piRows = () => {
  const table = /^\[ui\.sidebar\.agents\.rows_by_agent\]\s*\n([\s\S]*?)(?=^\[|$(?![\s\S]))/m.exec(code);
  assert.ok(table, 'rows_by_agent is a table');
  assert.match(table[1], /^pi\s*=\s*\[/m, 'Pi has a complete row override');
  assert.equal([...table[1].matchAll(/^([a-z_]+)\s*=/gm)].length, 1, 'only Pi is overridden');
  assert.doesNotMatch(code, /^rows\s*=/m, 'global rows must stay absent so other agents retain their rows');
  return table[1];
};
const keyList = () => {
  const match = /^Full key list: `([^`]+)` \((\d+) keys\)\.$/m.exec(contract);
  assert.ok(match, 'the token contract states the full key list');
  const keys = match[1].split(' ');
  assert.equal(keys.length, Number(match[2]));
  return keys;
};
const value = (key) => {
  const match = new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm').exec(code);
  assert.ok(match, `${key} is set`);
  return match[1].trim();
};

test('every color is an exported design-system palette or signal color', () => {
  const allowed = new Set([...Object.values(ACID_BLACK), ...Object.values(SIGNAL_COLORS)].map((hex) => hex.toLowerCase()));
  const rows = piRows();
  assert.ok([...rows.matchAll(/"(#[^"]*)"/g)].length > 30, 'Pi rows set their colors');
  const colors = [...code.matchAll(/"(#[^"]*)"/g)].map((match) => match[1]);
  assert.ok(colors.length > 30, 'the fragment sets colors');
  for (const color of colors) {
    assert.match(color, /^#[0-9a-f]{6}$/, `${color} is lowercase #rrggbb`);
    assert.ok(allowed.has(color), `${color} is a design-system color`);
  }
  // Nothing outside quotes looks like a color, so the scan above saw every one.
  assert.equal(code.replace(/"[^"]*"/g, '').includes('#'), false);
});

test('every token is in the contract key list, and every key in the list has a row', () => {
  const keys = keyList();
  const rows = piRows();
  const referenced = [...rows.matchAll(/token\s*=\s*"\$([A-Za-z0-9_-]+)"/g)].map((match) => match[1]);
  for (const name of referenced) assert.ok(keys.includes(name), `$${name} is in the token contract`);
  assert.deepEqual([...new Set(referenced)].sort(), [...keys].sort());
  assert.equal(new Set(referenced).size, referenced.length, 'each token appears once');
  // Every token entry is a custom `$` token; Herdr's built-in tokens are not part of this layout.
  assert.equal([...rows.matchAll(/token\s*=\s*"/g)].length, referenced.length);
});

test('the width lock, row gap and theme block match the contract', () => {
  for (const key of ['sidebar_width', 'sidebar_min_width', 'sidebar_max_width']) assert.equal(value(key), '36');
  assert.equal(value('row_gap'), '1');
  assert.equal(value('sidebar_bg'), `"${ACID_BLACK.field}"`);
  assert.equal(value('active_row_bg'), `"${ACID_BLACK.surface}"`);
  assert.equal(value('selection_bg'), `"${ACID_BLACK.surface}"`);
  for (const table of ['[theme.custom]', '[ui]', '[ui.sidebar.agents]', '[ui.sidebar.agents.rows_by_agent]']) assert.ok(code.includes(`\n${table}\n`), `${table} is a table`);
});

test('Pi-only layout preserves other agents and scopes row_gap to the agents panel', () => {
  piRows();
  const panel = /^\[ui\.sidebar\.agents\]\s*\n([\s\S]*?)(?=^\[)/m.exec(code);
  assert.ok(panel);
  assert.match(panel[1], /^row_gap\s*=\s*1\s*$/m);
  assert.doesNotMatch(piRows(), /^row_gap\s*=/m);
});

test('bar_idle is decorative grey without bold or zone rules', () => {
  const entry = /\{\s*token\s*=\s*"\$bar_idle"([^}]+)\}/.exec(piRows());
  assert.ok(entry);
  assert.match(entry[1], new RegExp(`fg\\s*=\\s*"${ACID_BLACK.decorative}"`));
  assert.doesNotMatch(entry[1], /bold\s*=\s*true|rules\s*=/);
});

test('g1 colors every contract state code: WRK and SUB accent, BLK and QNS critical, DNE primary, IDL and UNK decorative', () => {
  const states = /^- `g1`:[\s\S]*?(?=^- )/m.exec(contract);
  assert.ok(states, 'the token contract lists the g1 states');
  const codes = [...states[0].matchAll(/`[^`\s]+ ([A-Z]{3})`/g)].map((match) => match[1]);
  assert.deepEqual(codes, ['QNS', 'BLK', 'WRK', 'SUB', 'DNE', 'IDL', 'UNK']);
  const entry = /\{\s*token\s*=\s*"\$g1"(.+)\}\s*,?\s*$/m.exec(piRows());
  assert.ok(entry);
  assert.match(entry[1], new RegExp(`^\\s*,\\s*fg\\s*=\\s*"${ACID_BLACK.decorative}"`), 'decorative by default');
  const rules = Object.fromEntries([...entry[1].matchAll(/\{\s*contains\s*=\s*"([A-Z]+)"\s*,\s*fg\s*=\s*"(#[0-9a-f]{6})"\s*\}/g)].map((match) => [match[1], match[2]]));
  const expected = { WRK: ACID_BLACK.accent, SUB: ACID_BLACK.accent, BLK: ACID_BLACK.critical, QNS: ACID_BLACK.critical, DNE: ACID_BLACK.primary };
  assert.deepEqual(rules, expected);
  for (const code of codes) assert.ok(code in rules || code === 'IDL' || code === 'UNK', `${code} has a color role`);
});
