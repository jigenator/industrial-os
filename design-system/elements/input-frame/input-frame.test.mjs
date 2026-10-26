import test from 'node:test';
import assert from 'node:assert/strict';
import { lineWidth,paint } from '../../foundation/cells.mjs';
import { inputFrame } from './input-frame.mjs';
test('input-frame has no body fill in any state, pose or size',()=>{
  for(let width=1;width<=160;width++) for(const bodyRows of [1,3]) for(const state of ['idle','hover','focused','form']) for(const spread of [false,true]) {
    const lines=inputFrame({state,spread,scroll:'2-4 OF 5'},{width,bodyRows});
    assert.equal(lines.length,bodyRows+4);
    for(const line of lines) assert.equal(lineWidth(line),width);
    for(const line of lines.slice(2,bodyRows+2)) {
      assert.equal(paint(line,'none'),' '.repeat(width));
      for(const s of line) assert.equal(s.style.bg,'default');
    }
  }
});
test('input-frame preserves focused/form labels and rejects bad states and budgets',()=>{
  assert.match(paint(inputFrame({state:'focused'},{width:30})[1],'none'),/INPUT/);
  assert.equal(inputFrame({state:'form',label:'QUESTION 07'},{width:40})[1].find(s=>s.text.includes('QUESTION')).style.bg,'critical');
  assert.throws(()=>inputFrame({state:'typing'},{width:30}),RangeError);
  assert.throws(()=>inputFrame({spread:1},{width:30}),TypeError);
  assert.throws(()=>inputFrame({}, {width:30,bodyRows:0}),RangeError);
});
test('input-frame measured labels retain wide, combining and ZWJ text',()=>{
  const measure=t=>[...new Intl.Segmenter('und',{granularity:'grapheme'}).segment(t)].reduce((n,{segment})=>n+(['日','👩‍💻'].includes(segment)?2:1),0);
  const lines=inputFrame({state:'focused',label:'日 é 👩‍💻',scroll:'1/2'},{width:40,measure});
  assert.ok(paint(lines[1],'none').includes('日 é 👩‍💻'));
  for(const line of lines) assert.equal(lineWidth(line,{measure}),40);
  assert.throws(()=>inputFrame(1,{width:30}),TypeError);
  assert.throws(()=>inputFrame({label:'bad'}, {width:30,measure}),TypeError);
});

test('input scroll readout leaves a blank before the home right corner', () => {
  for (const width of [30,40,66]) {
    const line = inputFrame({state:'focused',scroll:'2-4 OF 5'},{width})[1];
    const text = paint(line,'none');
    assert.ok(text.endsWith('2-4 OF 5 ╶┐  '));
    assert.equal(text.indexOf('╶┐'),width-4);
    assert.equal(paint(inputFrame({state:'focused',scroll:'2-4 OF 5',spread:true},{width})[1],'none').indexOf('2-4 OF 5'),width-13);
  }
});
