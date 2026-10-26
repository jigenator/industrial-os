import test from 'node:test';
import assert from 'node:assert/strict';
import { lineWidth, paint, span, textSlot } from '../../foundation/cells.mjs';
import { popupHeader, popupFooter } from './popup-header.mjs';

test('popup-header bounds every state at widths 1–160 and preserves plain/color geometry', () => {
  for(let width=1;width<=160;width++) for(const line of [popupHeader({plate:'SHEET 05',title:'SYNTHETIC FIXTURE',meta:'09:41'},{width}), popupFooter({escape:'back',meta:'all 23 rows'}, {width})]) {
    assert.ok(lineWidth(line)<=width);
    assert.equal(paint(line,'truecolor').replace(/\x1b\[[0-9;]*m/g,''),paint(line,'none'));
    for(const item of line) assert.equal(typeof item.text,'string');
  }
});

test('popup-header measured slots keep wide, combining and ZWJ graphemes; no input mutation', () => {
  const measure = text => [...new Intl.Segmenter('und',{granularity:'grapheme'}).segment(text)].reduce((n,{segment})=>n+(['日','本','👩‍💻'].includes(segment)?2:1),0);
  const value=textSlot([span('日本 é 👩‍💻',{italic:true,bg:'default'})],9,{measure});
  const before=structuredClone(value);
  for(let width=1;width<=40;width++) {
    const line=popupHeader({plate:value,title:value,meta:value}, {width,measure});
    assert.ok(lineWidth(line,{measure})<=width);
    assert.ok(!paint(line,'none').includes('?'));
  }
  assert.deepEqual(value,before);
  assert.throws(()=>{ const value={spans:[span('bad\x1b')],width:4}; const width=40; popupHeader({plate:value,title:value,meta:value}, {width,measure}); },TypeError);
  assert.throws(()=>{ const value={spans:[span('abc')],width:2}; const width=40; popupHeader({plate:value,title:value,meta:value}, {width,measure}); },RangeError);
});

test('popup-header ASCII default sanitizes control input', () => {
  assert.ok(!paint(popupHeader({plate:'SHEET',title:'\x1b[31m'}, {width:30}),'none').includes('\x1b'));
});
test('popup header has spacing only, meta yields to the essential plate', () => {
  const row=popupHeader({plate:'IMAGE',title:'sample',meta:'1280 x 704'},{width:40});
  assert.equal(lineWidth(row),40);
  assert.match(paint(row,'none'),/^  IMAGE  sample/);
  assert.ok(!/[─┄━·]/u.test(paint(row,'none')));
  assert.match(paint(popupFooter({}, {width:10}),'none'),/Esc/);
  assert.throws(()=>popupHeader({plate:'X'},{width:0}),RangeError);
  assert.throws(()=>popupFooter({}, {width:NaN}),RangeError);
});

test('popup header gives a full title priority over a 46-cell meta at width 66', () => {
  const meta = 'm'.repeat(46);
  const line = popupHeader({plate:'SHEET 05',title:'VENUE SHORTLIST',meta},{width:66});
  const text = paint(line,'none');
  assert.equal(lineWidth(line),66);
  assert.ok(text.includes('VENUE SHORTLIST'));
  assert.ok(text.endsWith('… '));
  assert.ok(!text.includes(meta));
  const cramped = paint(popupHeader({plate:'IMAGE',title:'VENUE SHORTLIST',meta:'optional'},{width:30}),'none');
  assert.ok(cramped.includes('VENUE SHORTLIST'));
  assert.ok(!cramped.includes('optional'));
  const clipped = paint(popupHeader({plate:'IMAGE',title:'VENUE SHORTLIST',meta},{width:18}),'none');
  assert.ok(clipped.includes('…'));
  assert.ok(!clipped.includes('m'));
});

test('popup footer escape text uses secondary ink', () => {
  const line = popupFooter({escape:'back to chat'},{width:40});
  assert.equal(line.find(s => s.text.includes('back to chat')).style.fg,'secondary');
});
