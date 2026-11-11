// Checks themes/acid-black.json, the Herdr desktop theme: each color holds its approved design-system value.
// Herdr's own loader is not run here; CONTRIBUTING.md records the live install check.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ACID_BLACK } from '@industrial-os/design-system/foundation/palette';
import { HERDR_TERMINAL, SIGNAL_COLORS } from '@industrial-os/design-system/foundation/signal-colors';

const theme = JSON.parse(await readFile(new URL('../themes/acid-black.json', import.meta.url), 'utf8'));
const { field, surface, primary, secondary, accent, decorative, structural, critical } = ACID_BLACK;
const { ghost } = SIGNAL_COLORS;

test('terminal colors: field and primary, then Terminal Basic Dark from HERDR_TERMINAL', () => {
  assert.deepEqual(Object.keys(theme), ['background', 'foreground', 'selection', 'cursor', 'ansi', 'colors']);
  assert.equal(theme.background, field);
  assert.equal(theme.foreground, primary);
  assert.equal(theme.selection, HERDR_TERMINAL.selection);
  assert.equal(theme.cursor, HERDR_TERMINAL.cursor);
  assert.deepEqual(theme.ansi, [...HERDR_TERMINAL.ansi]);
});

test('panel colors keep the Acid / Black roles herdr-tui used: field chrome, white focus, acid working', () => {
  assert.deepEqual(theme.colors, {
    canvas: field, chrome: field, surface, popover: surface, raised: surface, hover: ghost, selected: surface,
    border: ghost, input: structural, foreground: primary, muted: secondary, dim: decorative,
    accent: primary, accent_foreground: field, solid: primary, solid_foreground: field,
    working: accent, blocked: critical, done: primary, idle: decorative, unknown: decorative,
  });
});

test('every color is lowercase #rrggbb', () => {
  const all = [theme.background, theme.foreground, theme.selection, theme.cursor, ...theme.ansi, ...Object.values(theme.colors)];
  for (const color of all) assert.match(color, /^#[0-9a-f]{6}$/);
});
