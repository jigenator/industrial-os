import test from 'node:test'; import assert from 'node:assert/strict'; import { paint, lineWidth } from '../../foundation/cells.mjs';
import { planCounter } from './plan-counter.mjs';
const input={today:4,inbox:null,later:0};
test('bounded safe lines at every width',()=>{for(let width=1;width<=160;width++){const lines=planCounter(input,{width});for(const line of lines){assert.equal(lineWidth(line),width);assert.equal(paint(line,'truecolor').replace(/\x1b\[[0-9;]*m/g,''),paint(line,'none'));}}});
test('unknown distinct from zero',()=>{assert.ok(paint(planCounter(input,{width:36})[1],'none').includes('?'));assert.throws(()=>planCounter({...input,today:-1},{width:36}));});
