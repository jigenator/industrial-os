import test from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS, paint, resolveColor, span } from './cells.mjs';
import { ACID_BLACK } from './palette.mjs';
import { SIGNAL_COLORS, mixOver } from './signal-colors.mjs';

test('signal colors are frozen lowercase #rrggbb values that paint as literal RGB', () => {
  assert.ok(Object.isFrozen(SIGNAL_COLORS));
  for (const [name, hex] of Object.entries(SIGNAL_COLORS)) {
    assert.match(hex, /^#[0-9a-f]{6}$/, name);
    assert.equal(resolveColor(hex), hex);
    assert.doesNotThrow(() => paint([span('X', { fg: hex, bg: hex })], 'truecolor'), name);
  }
  // No signal color shadows a role name.
  for (const name of Object.keys(SIGNAL_COLORS)) assert.ok(!Object.hasOwn(ACID_BLACK, name), name);
});

test('mixOver mixes channels over black with ties up, and returns mirrored mixes exactly', () => {
  assert.equal(mixOver('#ff8040', 0), '#000000');
  assert.equal(mixOver('#FF8040', 1), '#ff8040');
  assert.equal(mixOver('#010305', 0.5), '#010203'); // 0.5 -> 1, 1.5 -> 2, 2.5 -> 3
  assert.equal(mixOver('structural', 0.5), '#2b2b2b');
  // The extension's values win where its rounding differs from ties-up (accent 75%: 190.5 -> 0xbe, not 0xbf).
  assert.equal(mixOver('accent', 0.75), SIGNAL_COLORS.accent75);
  assert.equal(mixOver('#C0FE04', 0.75), '#90be03');
  assert.equal(mixOver('warning', 0.2), SIGNAL_COLORS.warningZone);
  assert.equal(mixOver('critical', 0.2), SIGNAL_COLORS.criticalZone);
  assert.equal(mixOver('warning', 0.5), SIGNAL_COLORS.warning50);
  assert.equal(mixOver(SIGNAL_COLORS.kmi, 0.5), SIGNAL_COLORS.kmiMid);
  assert.equal(mixOver(SIGNAL_COLORS.cld, 0.2), SIGNAL_COLORS.cldUsed);
  for (const bad of [-0.1, 1.1, Number.NaN, '0.5', undefined]) assert.throws(() => mixOver('accent', bad), RangeError, String(bad));
  for (const bad of ['acid', '#fff', 42, null]) assert.throws(() => mixOver(bad, 0.5), TypeError, String(bad));
});

test('every curated glyph is a single code point listed once', () => {
  const glyphs = [...GLYPHS];
  assert.equal(new Set(glyphs).size, glyphs.length);
  for (const glyph of '━┃┏┓┗┛┼▀▄▒▓▚▞■▪·•◆▴⌑⑂×') assert.ok(GLYPHS.includes(glyph), glyph);
});

test('mixOver rejects unknown terminal-default RGB rather than manufacturing a color', () => {
  for (const proportion of [0, 0.25, 0.5, 1]) assert.throws(() => mixOver('default', proportion), TypeError);
});
