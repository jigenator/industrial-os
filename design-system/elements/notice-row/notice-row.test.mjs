import test from 'node:test';
import assert from 'node:assert/strict';
import { lineWidth, paint, span, textSlot } from '../../foundation/cells.mjs';
import { noticeRow } from './notice-row.mjs';

test('notice-row bounds every state at widths 1–160 and preserves plain/color geometry', () => {
  for(let width=1;width<=160;width++) for(const line of noticeRow({glyph:'✕',plate:'LINK',tone:'critical',text:'not running',detail:['Synthetic recovery command']},{width})) {
    assert.ok(lineWidth(line)<=width);
    assert.equal(paint(line,'truecolor').replace(/\x1b\[[0-9;]*m/g,''),paint(line,'none'));
    for(const item of line) assert.equal(typeof item.text,'string');
  }
});

test('notice-row measured slots keep wide, combining and ZWJ graphemes; no input mutation', () => {
  const measure = text => [...new Intl.Segmenter('und',{granularity:'grapheme'}).segment(text)].reduce((n,{segment})=>n+(['日','本','👩‍💻'].includes(segment)?2:1),0);
  const value=textSlot([span('日本 é 👩‍💻',{italic:true,bg:'default'})],9,{measure});
  const before=structuredClone(value);
  for(let width=2;width<=40;width++) {
    const line=noticeRow({plate:value,text:value,detail:[value]}, {width,measure})[0];
    assert.ok(lineWidth(line,{measure})<=width);
    assert.ok(!paint(line,'none').includes('?'));
  }
  assert.deepEqual(value,before);
  assert.throws(()=>{ const value={spans:[span('bad\x1b')],width:4}; const width=40; noticeRow({plate:value,text:value,detail:[value]}, {width,measure})[0]; },TypeError);
  assert.throws(()=>{ const value={spans:[span('abc')],width:2}; const width=40; noticeRow({plate:value,text:value,detail:[value]}, {width,measure})[0]; },RangeError);
});

test('notice-row ASCII default sanitizes control input', () => {
  assert.ok(!paint(noticeRow({text:'\x1b[31m'}, {width:20})[0],'none').includes('\x1b'));
});
test('notice detail keeps all source characters, including recovery commands', () => {
  const lines=noticeRow({detail:['run synthetic-command --retry']},{width:7});
  assert.equal(lines.slice(1).map(l=>paint(l,'none')).join('').trimEnd(),'run synthetic-command --retry');
  assert.throws(()=>noticeRow({glyph:'A'},{width:20}),RangeError);
  assert.throws(()=>noticeRow({detail:'bad'},{width:20}),TypeError);
  assert.throws(()=>noticeRow({tone:'error'},{width:20}),RangeError);
});

test('notice-row refuses a detail grapheme wider than its entire viewport', () => {
  assert.throws(()=>noticeRow({detail:['日']},{width:1,measure:t=>t==='日'?2:[...t].length}),RangeError);
});
