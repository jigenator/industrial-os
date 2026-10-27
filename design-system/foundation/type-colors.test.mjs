import test from 'node:test'; import assert from 'node:assert/strict';
import { TYPE_COLORS, typeColor } from './type-colors.mjs'; import { DASHBOARD_INKS } from './dashboard-colors.mjs';
test('five source colors, own-token resolution and neutral fallback', () => {
  assert.equal(Object.keys(TYPE_COLORS).length, 5); assert.ok(Object.isFrozen(TYPE_COLORS));
  for (const k of Object.keys(TYPE_COLORS)) assert.equal(typeColor(k), TYPE_COLORS[k]);
  for (const k of [undefined, null, '', '#ffffff', '__proto__', 'constructor', 'type.future']) assert.equal(typeColor(k), DASHBOARD_INKS.bone);
  assert.equal(TYPE_COLORS['type.pr'], '#7533ff'); assert.equal(TYPE_COLORS['type.linear'], '#5e6ad2'); assert.equal(TYPE_COLORS['type.msg'], '#00a3a6'); assert.equal(TYPE_COLORS['type.email'], '#dec093');
});
