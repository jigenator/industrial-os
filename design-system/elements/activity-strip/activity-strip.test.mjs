import test from 'node:test'; import assert from 'node:assert/strict'; import { paint, lineWidth } from '../../foundation/cells.mjs';
import { activityStrip } from './activity-strip.mjs';
const input={blocks:Array.from({length:21},(_,i)=>({start:new Date(172800000+i*28800000).toISOString(),you:i%4,agents:i%6,future:i>19})),total:{you:10,agents:12},previous:{you:12,agents:16}};
test('bounded safe lines at every width',()=>{for(let width=1;width<=160;width++){const lines=activityStrip(input,{width});for(const line of lines){assert.equal(lineWidth(line),width);assert.equal(paint(line,'truecolor').replace(/\x1b\[[0-9;]*m/g,''),paint(line,'none'));}}});
test('week is 21 mapped blocks; future is a dot, comparison is truthful',()=>{const lines=activityStrip(input,{width:36});assert.equal(paint(lines[2],'none')[33],'·');assert.ok(paint(lines[4],'none').includes('6 fewer'));assert.throws(()=>activityStrip({...input,blocks:[]},{width:33}));});
