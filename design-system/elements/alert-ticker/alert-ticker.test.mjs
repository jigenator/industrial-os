import test from 'node:test'; import assert from 'node:assert/strict'; import { paint, lineWidth } from '../../foundation/cells.mjs';
import { alertTicker } from './alert-ticker.mjs';
const input=[];
test('bounded safe lines at every width',()=>{for(let width=1;width<=160;width++){const lines=alertTicker(input,{width});for(const line of lines){assert.equal(lineWidth(line),width);assert.equal(paint(line,'truecolor').replace(/\x1b\[[0-9;]*m/g,''),paint(line,'none'));}}});
test('the striped caps slant with the Powerline full-cell triangles',()=>{const row=paint(alertTicker([],{width:80})[0],'none');assert.equal(row.slice(0,4),'\uE0BA█\uE0BC ');assert.equal(row.slice(76),'\uE0BA█\uE0BC ');assert.doesNotMatch(row,/[◢◤]/u);});
test('v1 rejects fabricated alerts',()=>{assert.throws(()=>alertTicker([{}],{width:80}));assert.ok(paint(alertTicker([],{width:80})[0],'none').includes('NO ALERTS'));});
