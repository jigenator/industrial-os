import test from 'node:test'; import assert from 'node:assert/strict';
import { DASHBOARD_INKS as D } from './dashboard-colors.mjs';
import { PI_CHROME, SIGNAL_COLORS, mixOver } from './signal-colors.mjs';
test('dashboard aliases existing palette, derived dim is labeled not another hue',()=>{assert.equal(D.bone,PI_CHROME.bone);assert.equal(D.dim,mixOver(PI_CHROME.bone,0.74));assert.equal(D.muted,SIGNAL_COLORS.checkMid);assert.equal(D.edge,SIGNAL_COLORS.decorative50);assert.equal(D.rule,SIGNAL_COLORS.ghost);assert.ok(Object.isFrozen(D));});
