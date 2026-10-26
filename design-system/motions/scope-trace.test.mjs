import test from 'node:test';
import assert from 'node:assert/strict';
import { paint, lineWidth, span } from '../foundation/cells.mjs';
import { scopeMeter } from '../elements/scope-meter/scope-meter.mjs';
import { blipPass, scopeTrace, scopeTraceDuration } from './scope-trace.mjs';
const text = line => paint(line,'none');
test('blipPass is bounded, varied, deterministic and never repeats the preceding pattern', () => {
  let previous;
  const kinds=new Set(), directions=new Set();
  for(let index=0;index<10000;index++) {
    const pass=blipPass(index,previous);
    assert.deepEqual(pass,blipPass(index,previous));
    assert.notEqual(pass.key,previous);
    assert.ok(pass.cells.every(x=>Number.isInteger(x)&&x>=-1&&x<4));
    assert.ok(pass.jitter>=0.6&&pass.jitter<=1.4);
    assert.ok(Object.isFrozen(pass)&&Object.isFrozen(pass.cells));
    const rest=Math.round(8000*pass.jitter/80)*80;
    assert.ok(rest>=4800&&rest<=11200&&rest%80===0);
    kinds.add(pass.kind);directions.add(pass.dir);previous=pass.key;
  }
  assert.equal(kinds.size,3);assert.equal(directions.size,2);
  assert.throws(()=>blipPass(-1),RangeError);
  assert.throws(()=>blipPass(0,{}),TypeError);
});
test('scope-trace carrier takes one pass only; scheduler and rest remain host owned', () => {
  const lines=[scopeMeter()];
  for(let index=0;index<60;index++) {
    const end=scopeTraceDuration({index});
    for(let time=0;time<end;time+=80) {
      const out=scopeTrace(lines,{index,time});
      assert.equal(lineWidth(out[0]),4);
      assert.equal([...text(out[0])].filter(ch=>ch==='┸').length,blipPass(index).cells[time/80]===-1?0:1);
    }
    assert.deepEqual(scopeTrace(lines,{index,time:end}),lines);
  }
  assert.deepEqual(scopeTrace(lines,{animate:false}),lines);
});
test('scope-trace reacquires at 480 white and settles to carrier at 520, off immediately', () => {
  const lines=[scopeMeter()];
  const before=structuredClone(lines);
  assert.notEqual(text(scopeTrace(lines,{mode:'reacquire',time:0})[0]),'────');
  const lock=scopeTrace(lines,{mode:'reacquire',time:480})[0];
  assert.equal(text(lock),'────'); assert.equal(lock[0].style.fg,'primary');
  assert.deepEqual(scopeTrace(lines,{mode:'reacquire',time:520}),lines);
  assert.deepEqual(scopeTrace(lines,{mode:'reacquire',animate:false}),lines);
  assert.equal(scopeTraceDuration({mode:'noise'}),null);
  assert.deepEqual(lines,before);
});
test('scope-trace state cues require explicit opt-in, and lost is never replaced', () => {
  const weak=[scopeMeter({state:'reconnecting'})],lost=[scopeMeter({state:'lost'})];
  assert.deepEqual(scopeTrace(weak,{mode:'noise',time:80}),weak);
  assert.notEqual(text(scopeTrace(weak,{mode:'noise',time:80,stateCells:true})[0]),text(weak[0]));
  assert.deepEqual(scopeTrace(lost,{time:80}),lost);
  assert.deepEqual(scopeTrace([[span('LABEL')]],{time:0}),[[span('LABEL')]]);
  for(const options of [{time:-1},{time:NaN},{time:0,mode:'bars'},{time:0,index:1.5}]) assert.throws(()=>scopeTrace([],options),RangeError);
  assert.throws(()=>scopeTrace([],{time:0,stateCells:1}),TypeError);
  assert.throws(()=>scopeTrace([],{time:0,clock:1}),TypeError);
});
