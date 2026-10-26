import test from 'node:test';
import assert from 'node:assert/strict';
import { lineWidth, paint, span } from '../../foundation/cells.mjs';
import { feedBezel,imageInset,imageLabel } from './feed-bezel.mjs';
test('feed-bezel and image inset preserve every reserved image cell at widths 1–160 and tiny heights',()=>{
  for(let width=1;width<=160;width++) for(const height of [1,2,3,20]) {
    const rect={x:width>6?3:0,y:height>4?2:0,width:Math.max(1,width-6),height:Math.max(1,height-4)};
    const before=structuredClone(rect);
    for(const lines of [feedBezel({imageRect:rect,callsign:'M-02',channel:'CH 02',pose:'FRONT',meter:[span('────')],lamp:[span('● RX')]},{width,height}),imageInset(rect,{width,height})]) {
      assert.equal(lines.length,height);
      for(let y=0;y<height;y++) {
        assert.equal(lineWidth(lines[y]),width);
        const text=paint(lines[y],'none');
        if(y>=rect.y&&y<rect.y+rect.height) assert.equal(text.slice(rect.x,rect.x+rect.width),' '.repeat(rect.width));
      }
    }
    assert.deepEqual(rect,before);
  }
});
test('image label covers hover, missing and unsupported without inventing an action',()=>{
  for(let maxWidth=0;maxWidth<=160;maxWidth++) for(const input of [{label:'sample'},{label:'sample',hover:true},{label:'sample',missing:true},{label:'sample',unsupported:true}]) assert.ok(lineWidth(imageLabel(input,{maxWidth}))<=maxWidth);
  assert.match(paint(imageLabel({label:'sample',hover:true}),'none'),/open/);
  assert.ok(!paint(imageLabel({label:'sample',missing:true,hover:true}),'none').includes('open'));
  assert.throws(()=>feedBezel({imageRect:{x:0,y:0,width:2,height:2}},{width:1,height:1}),RangeError);
  assert.throws(()=>imageLabel({label:'x',hover:1}),TypeError);
});
test('feed-bezel measured callsign/channel/pose and image labels preserve slots',()=>{
  const measure=t=>[...new Intl.Segmenter('und',{granularity:'grapheme'}).segment(t)].reduce((n,{segment})=>n+(['日','👩‍💻'].includes(segment)?2:1),0);
  const imageRect={x:16,y:1,width:32,height:16};
  const lines=feedBezel({imageRect,callsign:'日 é',channel:'02',pose:'👩‍💻'},{width:80,height:19,measure});
  assert.ok(paint(lines[0],'none').includes('日 é'));
  assert.ok(paint(imageLabel({label:'日 👩‍💻'},{measure}),'none').includes('日 👩‍💻'));
  for(const line of lines) assert.equal(lineWidth(line,{measure}),80);
  assert.throws(()=>feedBezel(1,{width:30,height:20}),TypeError);
});
test('feed structural spans require a measurer for noncurated Unicode',()=>{
  assert.throws(()=>feedBezel({imageRect:{x:2,y:1,width:20,height:10},lamp:[span('日本')]},{width:40,height:15}),TypeError);
});
