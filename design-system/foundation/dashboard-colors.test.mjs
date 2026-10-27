import test from 'node:test'; import assert from 'node:assert/strict';
import { DASHBOARD_INKS as D } from './dashboard-colors.mjs';
import { SIGNAL_COLORS, mixOver } from './signal-colors.mjs';
import { SURFACE_PALETTE as P } from './surface-palette.mjs';
test('dashboard aliases existing palette, derived dim is labeled not another hue',()=>{assert.equal(D.bone,P.bone);assert.equal(D.dim,mixOver(P.bone,0.74));assert.equal(D.muted,SIGNAL_COLORS.checkMid);assert.equal(D.edge,P.rule);assert.equal(D.rule,SIGNAL_COLORS.ghost);assert.ok(Object.isFrozen(D));});
