import test from 'node:test'; import assert from 'node:assert/strict'; import { paint, lineWidth } from '../../foundation/cells.mjs';
import { activityTrace } from './activity-trace.mjs';
const input=[0,1,2,3];
test('bounded safe lines at every width',()=>{for(let width=1;width<=160;width++){const lines=activityTrace(input,{width});for(const line of lines){assert.equal(lineWidth(line),width);assert.equal(paint(line,'truecolor').replace(/\x1b\[[0-9;]*m/g,''),paint(line,'none'));}}});
test('empty trace is flat; no fake signal',()=>{const s=paint(activityTrace([],{width:33})[0],'none');assert.ok(s.includes('IDLE'));assert.ok(s.includes('⣀'));assert.ok(paint(activityTrace([],{width:33,connected:false})[0],'none').includes('OFFLINE'));assert.throws(()=>activityTrace([-1],{width:33}));});
