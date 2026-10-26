import test from 'node:test';
import assert from 'node:assert/strict';
import { fitLine, lineWidth, paint, span } from '../foundation/cells.mjs';
import { calloutEntrance, calloutEntranceDuration, CALLOUT_ENTRANCE_DEFAULTS } from './callout-entrance.mjs';
const plain = lines => lines.map(l => paint(l,'none'));
const blank = (width=20) => Array.from({length:5},()=>fitLine([],width,{bg:'default'}));
test('callout-entrance: exact uneven plot phases and finite 900-ms completion',()=>{
  const input=blank();const before=structuredClone(input);
  const gutter={top:1,left:1,rows:1,cols:1};
  for(const [time,glyph] of [[0,'+'],[79,'+'],[80,'◇'],[199,'◇'],[200,'◆'],[699,'◆'],[700,'◇'],[799,'◇'],[800,'·'],[899,'·']]) {
    assert.equal(plain(calloutEntrance(input,{time,gutter}))[1][1],glyph);
    assert.equal(plain(calloutEntrance(input,{time,gutter,color:false}))[1][1],glyph);
  }
  assert.deepEqual(calloutEntrance(input,{time:900,gutter}),input);
  assert.deepEqual(calloutEntrance(input,{animate:false,gutter}),input);
  assert.equal(calloutEntranceDuration(input),900);assert.deepEqual(input,before);assert.ok(Object.isFrozen(CALLOUT_ENTRANCE_DEFAULTS));
});
test('callout-entrance: text settle is style-only and readout reveals only allowed dashes',()=>{
  const input=[[span('fixture',{fg:'primary',bg:'default'})],[span('┄┄┄┄┄┄┄┄ stamp',{fg:'decorative',bg:'default'})],fitLine([],20,{bg:'default'})];
  const options={gutter:{top:2,left:0,rows:1,cols:1},textRegion:{top:0,left:0,rows:1,cols:7},readoutRegion:{top:1,left:0,rows:1,cols:8}};
  const frame=calloutEntrance(input,{...options,time:0});assert.equal(plain(frame)[0],'fixture');assert.equal(frame[0][0].style.fg,'decorative');
  assert.equal(plain(frame)[1],'┄┄       stamp');
  assert.equal(plain(calloutEntrance(input,{...options,time:120}))[1],'┄┄┄┄┄┄┄┄ stamp');
  assert.equal(calloutEntrance(input,{...options,time:0,color:false})[0][0].style.fg,'primary');
});
test('callout-entrance: register out/home/white/bone/grey and 700-ms completion',()=>{
  const input=blank(),gutter={top:0,left:1,rows:5,cols:8},o={mode:'register',gutter};
  for(const time of [0,40,80,120,160,560,600,640,680]) {
    const frame=calloutEntrance(input,{...o,time});const home=time>=80;
    assert.equal(plain(frame)[home?1:0][home?2:1],'┌');
    assert.equal(plain(frame)[home?3:4][home?7:8],'┘');
    const mark=frame[home?1:0].find(s=>s.text.includes('┌'));
    assert.equal(mark.style.fg,time<160?'primary':time<600?'#e6e2d3':'decorative');
  }
  assert.deepEqual(calloutEntrance(input,{...o,time:700}),input);assert.equal(calloutEntranceDuration(input,o),700);
});
test('callout-entrance: measured rich text, bounded geometry and warning/critical protection',()=>{
  const measure=s=>[...new Intl.Segmenter('und',{granularity:'grapheme'}).segment(s)].reduce((n,{segment})=>n+(/日|👩/u.test(segment)?2:1),0);
  const input=[[span(' 日é👩‍💻',{fg:'primary',bg:'default'})],[span('▲ WARN',{fg:'warning'})],[span('✕ FAIL',{fg:'critical'})]];
  const o={gutter:{top:0,left:0,rows:1,cols:1},textRegion:{top:0,left:1,rows:3,cols:20},measure};
  for(const time of [0,40,80,700,899,900]) {
    const frame=calloutEntrance(input,{...o,time});assert.deepEqual(frame.slice(1),input.slice(1));
    frame.forEach((line,i)=>assert.equal(lineWidth(line,{measure}),lineWidth(input[i],{measure})));
  }
  assert.deepEqual(calloutEntrance([[span('occupied')]],{time:0}),[[span('occupied')]]);
  assert.deepEqual(calloutEntrance(blank(),{time:0,mode:'register'}),blank());
  for(const value of [null,4,[]]) assert.throws(()=>calloutEntrance([],value),TypeError);
  for(const value of [{mode:'bad'},{time:-1},{time:0,gutter:{cols:Infinity}}]) assert.throws(()=>calloutEntrance([],value),RangeError);
});

test('callout-entrance: registration composes the real mirrored callout without moving body/readout', async()=>{
  const { callout } = await import('../elements/callout/callout.mjs');
  const width=66,input=[fitLine([],width,{bg:'default'}),...callout({side:'right',name:'OPERATOR',body:['Fixture reply.'],readout:'09:41'},{width}),fitLine([],width,{bg:'default'})];
  const gutter={top:0,left:47,rows:5,cols:19};
  const early=calloutEntrance(input,{mode:'register',gutter,time:0});
  assert.equal(plain(early)[1].slice(63,65),'  ');assert.equal(plain(early)[0][65],'┐');
  for(const time of [0,40,80,160,600,699,700]) {
    const frame=calloutEntrance(input,{mode:'register',gutter,time});
    assert.equal(plain(frame)[2],plain(input)[2]);assert.ok(plain(frame)[3].includes('09:41'));
  }
});

test('callout-entrance: helper-derived regions hide timestamp before 120 ms and tolerate misplaced gutters', async()=>{
  const {callout,calloutGeometry}=await import('../elements/callout/callout.mjs');
  for (const width of [1,2,7,24,66,100]) for (const body of [[],['short'],['a considerably longer synthetic reply']]) {
    const input={body,readout:'09:41'},options={width},geometry=calloutGeometry(input,options),lines=callout(input,options);
    const motion={gutter:geometry.plotGutter,textRegion:geometry.textRegion,readoutRegion:geometry.readoutRegion,timestampRegion:geometry.timestampRegion};
    for (const time of [0,40,80,119,120,160,900]) {
      const frame=calloutEntrance(lines,{...motion,time});
      frame.forEach(l=>assert.equal(lineWidth(l),width));
      if(width>=24) assert.equal(plain(frame).join('').includes('09:41'),time>=120);
      for(const delta of [-1,0,1]) {
        assert.doesNotThrow(()=>calloutEntrance(lines,{...motion,gutter:{...motion.gutter,left:motion.gutter.left+delta},time}));
        assert.doesNotThrow(()=>calloutEntrance(lines,{mode:'register',gutter:{...geometry.registerGutter,left:geometry.registerGutter.left+delta,rows:geometry.registerGutter.rows+delta},time}));
      }
    }
  }
});
