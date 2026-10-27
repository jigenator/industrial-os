import test from 'node:test'; import assert from 'node:assert/strict'; import { paint, lineWidth } from '../../foundation/cells.mjs';
import { ambientField } from './ambient-field.mjs';
const input=[[{text:'READING',style:{}}]];
test('bounded ambient width',()=>{for(let width=1;width<=160;width++){const a=ambientField([[{text:' '.repeat(width),style:{}}]]);assert.equal(lineWidth(a[0]),width);}});
test('ambient leaves content and held cells alone, off has no decoration',()=>{const lines=Array.from({length:12},()=>[{text:' '.repeat(40),style:{}}]);lines[5]=[{text:'     READING'+ ' '.repeat(28),style:{}}];const a=ambientField(lines);assert.ok(paint(a[5],'none').includes('READING'));assert.equal(a[4][5].text,' ');const b=ambientField(lines,{enabled:false});assert.equal(paint(b[3],'none').trim(),'');assert.ok(a.some(l=>paint(l,'none').includes('┼')));});
