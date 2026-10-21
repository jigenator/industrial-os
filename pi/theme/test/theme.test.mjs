// Checks industrial-os.json: Pi accepts and builds it, every color is a design-system value named after its source,
// and the approved token choices hold. Needs the root npm install and PI_HOST_ROOT; see CONTRIBUTING.md.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { ACID_BLACK } from '@industrial-os/design-system/foundation/palette';
import { PI_CHROME, SIGNAL_COLORS } from '@industrial-os/design-system/foundation/signal-colors';

const THEME_PATH = fileURLToPath(new URL('../industrial-os.json', import.meta.url));
const theme = JSON.parse(readFileSync(THEME_PATH, 'utf8'));
const host = process.env.PI_HOST_ROOT;
assert.ok(host, 'PI_HOST_ROOT names the installed Pi package; see CONTRIBUTING.md');
// Pi's own validator and loader. Internal dist paths of Pi 1.3.0: Pi exports neither from its package root.
const { validateThemeJson } = await import(`${host}/dist/modes/interactive/theme/theme-schema.js`);
const { loadThemeFromPath } = await import(`${host}/dist/modes/interactive/theme/theme.js`);

// The design-system sources a theme variable may name, in lookup order. A name in two sources would be ambiguous.
const SOURCES = { ACID_BLACK, SIGNAL_COLORS, PI_CHROME };

test('Pi validates the theme and builds it as the dark industrial-os theme', () => {
  assert.doesNotThrow(() => validateThemeJson(THEME_PATH, theme));
  const built = loadThemeFromPath(THEME_PATH, 'truecolor');
  assert.equal(built.name, 'industrial-os');
  assert.equal(built.appearance, 'dark');
});

test('every variable is named after a design-system color and holds its value', () => {
  for (const [name, hex] of Object.entries(theme.vars)) {
    const owners = Object.entries(SOURCES).filter(([, colors]) => Object.hasOwn(colors, name));
    assert.equal(owners.length, 1, `${name} names exactly one design-system color`);
    assert.equal(hex, owners[0][1][name], `${name} is ${owners[0][0]}.${name}`);
  }
});

test('every token names a variable, and every variable is used', () => {
  const used = [...Object.values(theme.colors), ...Object.values(theme.export)];
  for (const value of used) assert.ok(Object.hasOwn(theme.vars, value), `${value} is a variable, not a literal`);
  assert.deepEqual(Object.keys(theme.vars).filter((name) => !used.includes(name)), []);
});

test('the editor border is bone at every thinking level and acid in bash mode', () => {
  const thinking = Object.entries(theme.colors).filter(([token]) => token.startsWith('thinking') && token !== 'thinkingText');
  assert.equal(thinking.length, 7);
  for (const [token, value] of thinking) assert.equal(value, 'bone', token);
  assert.equal(theme.colors.bashMode, 'accent');
});

test('acid marks only highlights, and state colors keep their roles', () => {
  const acid = Object.keys(theme.colors).filter((token) => theme.colors[token] === 'accent').sort();
  assert.deepEqual(acid, ['accent', 'bashMode', 'borderAccent', 'success', 'syntaxKeyword', 'toolDiffAdded']);
  assert.equal(theme.colors.error, 'critical');
  assert.equal(theme.colors.toolDiffRemoved, 'critical');
  assert.equal(theme.colors.warning, 'warning');
  assert.equal(theme.colors.text, 'primary');
  assert.equal(theme.export.pageBg, 'field');
});
