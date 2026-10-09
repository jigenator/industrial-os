// Checks theme.toml: every color is a design-system value, each key holds its approved role, and with sidebar.toml
// and spaces.toml it sets every Herdr 0.9.3 [theme.custom] key exactly once.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ACID_BLACK } from '@industrial-os/design-system/foundation/palette';
import { HERDR_CHROME, SIGNAL_COLORS } from '@industrial-os/design-system/foundation/signal-colors';

// Herdr 0.9.3's CustomThemeColors fields, in source order: src/config/theme.rs:99-151 in the Herdr repository.
const HERDR_THEME_KEYS = ['accent', 'panel_bg', 'sidebar_bg', 'active_row_bg', 'selection_bg', 'surface0', 'surface1', 'surface_dim', 'overlay0', 'overlay1', 'text', 'subtext0', 'mauve', 'green', 'yellow', 'red', 'blue', 'teal', 'peach'];

// Comments removed: colors are quoted, so a `#` at a line start or after whitespace begins a comment.
const code = async (name) => (await readFile(new URL(`../${name}`, import.meta.url), 'utf8')).split('\n').map((line) => line.replace(/(^|\s)#.*$/, '')).join('\n');
const theme = await code('theme.toml');
const sidebar = await code('sidebar.toml');
const spaces = await code('spaces.toml');
// The [theme.custom] table's key = "value" pairs, in file order.
const custom = (text) => {
  const table = /^\[theme\.custom\]\s*\n([\s\S]*?)(?=^\[|$(?![\s\S]))/m.exec(text);
  assert.ok(table, '[theme.custom] is a table');
  return [...table[1].matchAll(/^([a-z_0-9]+)\s*=\s*"([^"]*)"\s*$/gm)].map((match) => [match[1], match[2]]);
};

test('every theme color is an exported design-system palette, signal or Herdr chrome color', () => {
  const allowed = new Set([...Object.values(ACID_BLACK), ...Object.values(SIGNAL_COLORS), ...Object.values(HERDR_CHROME)]);
  const colors = [...theme.matchAll(/"(#[^"]*)"/g)].map((match) => match[1]);
  assert.equal(colors.length, 11);
  for (const color of colors) {
    assert.match(color, /^#[0-9a-f]{6}$/, `${color} is lowercase #rrggbb`);
    assert.ok(allowed.has(color), `${color} is a design-system color`);
  }
  // Nothing outside quotes looks like a color, and the fragment is only the one table.
  assert.equal(theme.replace(/"[^"]*"/g, '').includes('#'), false);
  assert.deepEqual([...theme.matchAll(/^\[.*\]\s*$/gm)].map((match) => match[0].trim()), ['[theme.custom]']);
  assert.equal([...theme.matchAll(/^\S+\s*=/gm)].length, 11, 'no key outside the 11 theme keys');
});

test('theme, sidebar and Spaces fragments together set every Herdr 0.9.3 theme key exactly once', () => {
  const keys = [theme, sidebar, spaces].flatMap((text) => custom(text).map(([key]) => key));
  assert.equal(new Set(keys).size, keys.length, `no key is set twice: ${keys}`);
  assert.deepEqual(keys.toSorted(), HERDR_THEME_KEYS.toSorted());
  assert.equal(HERDR_THEME_KEYS.length, 19);
});

test('each theme key holds its approved Acid & Orange value', () => {
  const approved = {
    accent: ACID_BLACK.primary,
    panel_bg: ACID_BLACK.field,
    surface0: ACID_BLACK.surface,
    surface1: HERDR_CHROME.signalOrange30,
    surface_dim: SIGNAL_COLORS.ghost,
    overlay1: HERDR_CHROME.signalOrange,
    text: ACID_BLACK.primary,
    subtext0: ACID_BLACK.secondary,
    mauve: ACID_BLACK.accent,
    blue: ACID_BLACK.accent,
    peach: ACID_BLACK.warning,
  };
  assert.deepEqual(Object.fromEntries(custom(theme)), approved);
  // Deliberate pin on the approved values: a design-system role change must be re-approved here too.
  assert.deepEqual(Object.values(approved), ['#ffffff', '#000000', '#1c1c1c', '#4d1c00', '#333333', '#ff5c00', '#ffffff', '#cfcfcf', '#c0fe04', '#c0fe04', '#d79e52']);
});

test('panel_bg is the field, because Herdr draws it as the ink on accent, acid and critical controls', () => {
  assert.equal(Object.fromEntries(custom(theme)).panel_bg, ACID_BLACK.field);
});

test('the sidebar and Spaces fragments keep their eight theme keys unchanged', () => {
  assert.deepEqual(custom(sidebar), [['sidebar_bg', ACID_BLACK.field], ['active_row_bg', ACID_BLACK.surface], ['selection_bg', ACID_BLACK.surface]]);
  assert.deepEqual(custom(spaces), [['yellow', ACID_BLACK.accent], ['red', ACID_BLACK.critical], ['teal', ACID_BLACK.primary], ['green', ACID_BLACK.decorative], ['overlay0', ACID_BLACK.decorative]]);
});
