import test from 'node:test';
import assert from 'node:assert/strict';
import { paint, resolveColor, span } from './cells.mjs';
import { INDUSTRIALOS_COLORS } from './industrialos-colors.mjs';
import { BOARD_INKS } from './signal-colors.mjs';
import { BOARD_TONES, CATEGORY_TONES, boardTone } from './board-tones.mjs';

test('every board tone has a text ink, a state-cell color and a chip style, frozen', () => {
  assert.ok(Object.isFrozen(BOARD_TONES));
  assert.deepEqual(Object.keys(BOARD_TONES), ['live', 'crit', 'warn', 'idle', 'off', 'ok']);
  for (const [name, tone] of Object.entries(BOARD_TONES)) {
    assert.ok(Object.isFrozen(tone) && Object.isFrozen(tone.chip), name);
    for (const color of [tone.ink, tone.cell, tone.chip.fg, tone.chip.bg]) assert.doesNotThrow(() => resolveColor(color), name);
    assert.doesNotThrow(() => paint([span(' X ', { ...tone.chip, bold: true })], 'truecolor'));
  }
});

test('board tones are the automations monitor values: roles for state, white mixes for quiet cells', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(BOARD_TONES)), {
    live: { ink: 'primary', cell: 'accent', chip: { fg: 'field', bg: 'accent' } },
    crit: { ink: 'critical', cell: 'critical', chip: { fg: 'primary', bg: 'critical' } },
    warn: { ink: 'warning', cell: 'warning', chip: { fg: 'field', bg: 'warning' } },
    idle: { ink: 'decorative', cell: 'structural', chip: { fg: 'secondary', bg: BOARD_INKS.chip } },
    off: { ink: 'decorative', cell: BOARD_INKS.faint, chip: { fg: 'primary', bg: 'structural' } },
    ok: { ink: 'secondary', cell: 'structural', chip: { fg: 'secondary', bg: BOARD_INKS.chip } },
  });
});

test('boardTone returns a tone and rejects unknown or inherited names', () => {
  assert.equal(boardTone('warn'), BOARD_TONES.warn);
  for (const bad of ['warning', 'toString', '', undefined]) assert.throws(() => boardTone(bad), RangeError, String(bad));
});

test('category tones are seven IndustrialOS fills, in order, each with the ink that reads on it', () => {
  assert.ok(Object.isFrozen(CATEGORY_TONES) && CATEGORY_TONES.every(Object.isFrozen));
  assert.deepEqual(CATEGORY_TONES.map((t) => [t.id, t.ink]), [
    ['pale-blue', 'field'], ['magenta', 'field'], ['mint', 'field'], ['lavender', 'field'],
    ['yellow', 'field'], ['steel-blue', 'primary'], ['violet', 'primary'],
  ]);
  for (const tone of CATEGORY_TONES) {
    assert.equal(tone.fill, INDUSTRIALOS_COLORS.find((c) => c.id === tone.id).hex.toLowerCase(), tone.id);
  }
});
