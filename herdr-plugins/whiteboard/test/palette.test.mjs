// Rust cannot import the design-system package, so src/palette.rs mirrors it; this compares the two.
// Run from a checkout where the root `npm install` has linked the package.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { ACID_BLACK } from '@industrial-os/design-system/foundation/palette';

import { SIGNAL_COLORS } from '@industrial-os/design-system/foundation/signal-colors';

const src = new URL('../src/', import.meta.url);
const hex = (r, g, b) => '#' + [r, g, b].map((v) => v.toLowerCase().padStart(2, '0')).join('');

test('every palette.rs constant matches its design-system role or signal', () => {
  const rust = readFileSync(new URL('palette.rs', src), 'utf8');
  const found = {};
  for (const [, name, r, g, b] of rust.matchAll(/pub const (\w+): Color = Color::Rgb\(0x(\w\w), 0x(\w\w), 0x(\w\w)\);/g)) {
    found[name.toLowerCase()] = hex(r, g, b);
  }
  assert.deepEqual(found, { ...ACID_BLACK, violet: SIGNAL_COLORS.violet, cobalt: SIGNAL_COLORS.cobalt, pink: SIGNAL_COLORS.pink });
});

test('no other source file writes a color value', () => {
  for (const file of readdirSync(src).filter((f) => f.endsWith('.rs') && f !== 'palette.rs')) {
    const text = readFileSync(new URL(file, src), 'utf8');
    assert.doesNotMatch(text, /Color::(Rgb|Indexed|Red|Green|Yellow|Blue|Magenta|Cyan|Gray|DarkGray|White|Black|Light\w+)\b/, file);
  }
});
