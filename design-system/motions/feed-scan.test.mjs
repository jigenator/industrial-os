import test from 'node:test';
import assert from 'node:assert/strict';
import {paint} from '../foundation/cells.mjs';
import {feedBezel} from '../elements/feed-bezel/feed-bezel.mjs';
import {feedScan,feedScanDuration} from './feed-scan.mjs';
test('feed scan touches side rails only, ends at 720 ms and is absent off',()=>{
  const lines=feedBezel({imageRect:{x:8,y:1,width:32,height:16}},{width:50,height:19});
  const options={top:1,rows:16,rails:[7,40]};
  const before=structuredClone(lines);
  assert.equal(feedScanDuration(options),720);
  for(let time=0;time<=720;time+=40) {
    const frame=feedScan(lines,{...options,time});
    for(let y=1;y<=16;y++) assert.equal(paint(frame[y],'none').slice(8,40),' '.repeat(32));
  }
  assert.equal(paint(feedScan(lines,{...options,time:0})[1],'none')[7],'┃');
  assert.deepEqual(feedScan(lines,{...options,time:720}),lines);
  assert.deepEqual(feedScan(lines,{...options,animate:false}),lines);
  assert.deepEqual(lines,before);
  assert.throws(()=>feedScan(lines,{time:0,rails:[-1]}),RangeError);
});
