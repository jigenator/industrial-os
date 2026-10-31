import test from 'node:test';
import assert from 'node:assert/strict';
import { SURFACE_PALETTE } from './surface-palette.mjs';
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
  assert.equal(SURFACE_PALETTE.inputHover, undefined);
  assert.equal(SURFACE_PALETTE.alpha, undefined);
  for (const value of Object.values(SURFACE_PALETTE).flat()) assert.match(value, /^#[0-9a-f]{6}$/);
});
