import test from 'node:test';
import assert from 'node:assert/strict';
import { paint, lineWidth, span, textSlot } from '../foundation/cells.mjs';
import { reveal, revealDuration } from './reveal.mjs';
const measure=text=>[...new Intl.Segmenter('und',{granularity:'grapheme'}).segment(text)].reduce((n,{segment})=>n+(['日','👩‍💻'].includes(segment)?2:1),0);
test('reveal measured option rows never tear wide, combining or ZWJ slots', () => {
  const lines=[textSlot([span('日 é 👩‍💻',{fg:'primary',bg:'default',italic:true,underline:true})],7,{measure}).spans];
  const before=structuredClone(lines);
  for(const veil of ['blank','dim']) for(let time=0;time<=640;time+=40) {
    const out=reveal(lines,{time,duration:40,stagger:40,veil,measure});
    assert.equal(lineWidth(out[0],{measure}),7);
    assert.ok(!paint(out[0],'none').includes('?'));
    for(const s of out[0]) assert.equal(s.style.italic,true);
  }
  assert.deepEqual(lines,before);
  assert.deepEqual(reveal(lines,{time:revealDuration(1,{duration:40}),duration:40,measure}),lines);
  const warning=[[span('▲ error 日',{fg:'warning'})]];
  assert.equal(paint(reveal(warning,{time:0,veil:'blank',measure})[0],'none'),'▲ error 日');
  assert.throws(()=>reveal(lines,{animate:false,measure:1}),TypeError);
});
