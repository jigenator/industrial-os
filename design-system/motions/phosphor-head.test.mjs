import test from 'node:test';
import assert from 'node:assert/strict';
import { lineWidth, span } from '../foundation/cells.mjs';
import { phosphorHead, PHOSPHOR_HEAD_DEFAULTS } from './phosphor-head.mjs';
test('phosphor-head: styles exactly the supplied already-revealed head without changing text',()=>{
  const input=[[span('fixture',{fg:'primary',bg:'default',italic:true,underline:true})]];
  const before=structuredClone(input);const frame=phosphorHead(input,{time:0,head:{row:0,col:3}});
  assert.equal(frame[0].map(s=>s.text).join(''),'fixture');assert.equal(frame[0][1].text,'t');assert.equal(frame[0][1].style.fg,'accent');
  assert.equal(frame[0][1].style.italic,true);assert.deepEqual(input,before);assert.ok(Object.isFrozen(PHOSPHOR_HEAD_DEFAULTS));
  for(const options of [{animate:false},{time:0,color:false},{time:0}]) assert.deepEqual(phosphorHead(input,options),input);
});
test('phosphor-head: measured grapheme head and state cues remain whole',()=>{
  const measure=s=>[...new Intl.Segmenter('und',{granularity:'grapheme'}).segment(s)].reduce((n,{segment})=>n+(/日|👩/u.test(segment)?2:1),0);
  const input=[[span('日é👩‍💻',{fg:'primary',bg:'default'}),span('WARN',{fg:'warning'}),span('FAIL',{fg:'critical'})]];
  for(const col of [0,2,3,5,9]) {
    const frame=phosphorHead(input,{time:0,head:{row:0,col},measure});
    assert.equal(lineWidth(frame[0],{measure}),13);assert.equal(frame[0].map(s=>s.text).join(''),input[0].map(s=>s.text).join(''));
    assert.deepEqual(frame[0].filter(s=>['warning','critical'].includes(s.style.fg)),input[0].slice(1));
  }
});
test('phosphor-head: invalid options, head positions and control injection rejected',()=>{
  for(const head of [null,{},[],{row:-1,col:0},{row:0,col:0.5}]) assert.throws(()=>phosphorHead([],{time:0,head}),RangeError);
  assert.throws(()=>phosphorHead([],{time:0,color:1}),TypeError);assert.throws(()=>phosphorHead([],{time:0,unknown:1}),TypeError);
  assert.throws(()=>phosphorHead([[span('\x1b[31m')]],{time:0,head:{row:0,col:0},measure:s=>s.length}),TypeError);
});
