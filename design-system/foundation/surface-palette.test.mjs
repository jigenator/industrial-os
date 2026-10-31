import test from 'node:test';
import assert from 'node:assert/strict';
import { ALUMINIUM_GROUND, FROST_ALPHA, SURFACE_PALETTE } from './surface-palette.mjs';
import { ACID_BLACK } from './palette.mjs';

test('surface palette keeps canonical roles and the locked survey colors, without alpha policy', () => {
  assert.ok(Object.isFrozen(SURFACE_PALETTE));
  assert.ok(Object.isFrozen(SURFACE_PALETTE.dots));
  for (const [key, value] of Object.entries(ACID_BLACK)) assert.equal(SURFACE_PALETTE[key], value);
  assert.equal(SURFACE_PALETTE.plateGrey, '#a8a8a8');
  assert.equal(SURFACE_PALETTE.bone, '#e6e2d3');
  assert.equal(SURFACE_PALETTE.criticalHover, '#ff694c');
  assert.equal(SURFACE_PALETTE.floor, '#262626');
  assert.equal(SURFACE_PALETTE.code, '#00e5ff');
  assert.equal(SURFACE_PALETTE.yellow, '#ffd400');
  assert.equal(SURFACE_PALETTE.paperHair, '#dadada');
  assert.equal(SURFACE_PALETTE.aluminiumLabel, '#4f5257');
  assert.equal(SURFACE_PALETTE.frostLamp, '#9c9c9c');
  assert.equal(SURFACE_PALETTE.frostRule, '#868686');
  assert.equal(SURFACE_PALETTE.inputHover, undefined);
  assert.equal(SURFACE_PALETTE.alpha, undefined);
  for (const value of Object.values(SURFACE_PALETTE).flat()) assert.match(value, /^#[0-9a-f]{6}$/);
});

test('the crate banner aluminium ground and strip frost are fixed, frozen numbers', () => {
  assert.deepEqual(ALUMINIUM_GROUND, {
    base: 214, band: 26, fall: 6, streaks: [{ amplitude: 3.2, x: 0.42, y: 2.3 }, { amplitude: 1.6, x: 1.37, y: 5.1 }], channels: [-3, 0, 4], hair: -28,
  });
  for (const part of [ALUMINIUM_GROUND, ALUMINIUM_GROUND.streaks, ALUMINIUM_GROUND.channels, ...ALUMINIUM_GROUND.streaks]) assert.ok(Object.isFrozen(part));
  assert.equal(FROST_ALPHA, 0.1);
  // Its lightness stays inside 8-bit RGB, so no channel clamps: 203.2–244.8 before the channel offsets.
  const { base, band, fall, streaks, channels } = ALUMINIUM_GROUND;
  const swing = streaks.reduce((sum, s) => sum + s.amplitude, 0);
  assert.ok(base - fall - swing + Math.min(...channels) >= 0 && base + band + swing + Math.max(...channels) <= 255);
});
