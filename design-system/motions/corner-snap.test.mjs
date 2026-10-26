import test from 'node:test';
import assert from 'node:assert/strict';
import {paint} from '../foundation/cells.mjs';
import {inputFrame} from '../elements/input-frame/input-frame.mjs';
import {cornerSnap,cornerSnapSettling} from './corner-snap.mjs';
const text=lines=>lines.map(line=>paint(line,'none'));
test('corner snap holds spread after 40 ms, returns home on leave/off, keeps focused/form label and body',()=>{
  assert.equal(cornerSnapSettling(),40);
  for(const state of ['hover','focused','form']) {
    const home=inputFrame({state},{width:40,bodyRows:3}),before=structuredClone(home);
    assert.deepEqual(text(cornerSnap(home,{time:0})),text(home));
    const spread=cornerSnap(home,{time:40});
    assert.equal(text(spread)[0].slice(0,2),'┌╴');
    assert.deepEqual(text(cornerSnap(home,{time:1e9})),text(spread));
    assert.deepEqual(text(cornerSnap(home,{animate:false})),text(home));
    assert.deepEqual(text(spread).slice(2,5),text(home).slice(2,5));
    assert.ok(text(spread)[1].includes('INPUT'));
    assert.deepEqual(home,before);
  }
});
