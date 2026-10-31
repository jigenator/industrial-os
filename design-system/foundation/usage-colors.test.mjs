import test from 'node:test';
import assert from 'node:assert/strict';
import { ACID_BLACK } from './palette.mjs';
import { SIGNAL_COLORS, mixOver } from './signal-colors.mjs';
import { USAGE_COLORS, USAGE_NEUTRAL, usageColors } from './usage-colors.mjs';

test('usage tokens alias the established lit/used/mid families exactly', () => {
  for (const id of ['gpt', 'cld', 'kmi']) {
    const family = usageColors(`usage.${id}`);
    assert.equal(family, USAGE_COLORS[`usage.${id}`]);
    assert.deepEqual(family, { lit: SIGNAL_COLORS[id], used: SIGNAL_COLORS[`${id}Used`], mid: SIGNAL_COLORS[`${id}Mid`] });
    assert.ok(Object.isFrozen(family));
  }
  assert.ok(Object.isFrozen(USAGE_COLORS));
});

test('absent, invalid, unknown and prototype tokens use one derived neutral family', () => {
  assert.deepEqual(USAGE_NEUTRAL, { lit: ACID_BLACK.secondary, used: mixOver('secondary', 0.2), mid: mixOver('secondary', 0.5) });
  assert.ok(Object.isFrozen(USAGE_NEUTRAL));
  for (const token of [undefined, null, '', 'gpt', 'usage.grok', 'usage.GPT', '__proto__', 'constructor', {}, 42]) assert.equal(usageColors(token), USAGE_NEUTRAL);
});
