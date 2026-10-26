import test from 'node:test';
import assert from 'node:assert/strict';
import { lineWidth, paint, span, textSlot } from '../../foundation/cells.mjs';
import { tabRule, neatline, nameRule, leader } from './tab-rule.mjs';

test('tab-rule bounds every state at widths 1–160 and preserves plain/color geometry', () => {
  for(let width=1;width<=160;width++) for(const line of [tabRule({}, {width}), tabRule({focused:true},{width}), neatline({label:'START OF CONVERSATION'}, {width}), nameRule({time:'09:41'}, {width}), nameRule({label:'using a tool',meter:[span('⡧⠤⠤⠤⠤⠤')]}, {width})]) {
    assert.ok(lineWidth(line)<=width);
    assert.equal(paint(line,'truecolor').replace(/\x1b\[[0-9;]*m/g,''),paint(line,'none'));
    for(const item of line) assert.equal(typeof item.text,'string');
  }
});

test('tab-rule measured slots keep wide, combining and ZWJ graphemes; no input mutation', () => {
  const measure = text => [...new Intl.Segmenter('und',{granularity:'grapheme'}).segment(text)].reduce((n,{segment})=>n+(['日','本','👩‍💻'].includes(segment)?2:1),0);
  const value=textSlot([span('日本 é 👩‍💻',{italic:true,bg:'default'})],9,{measure});
  const before=structuredClone(value);
  for(let width=1;width<=40;width++) {
    const line=nameRule({plate:value,label:value,time:value}, {width,measure});
    assert.ok(lineWidth(line,{measure})<=width);
    assert.ok(!paint(line,'none').includes('?'));
  }
  assert.deepEqual(value,before);
  assert.throws(()=>{ const value={spans:[span('bad\x1b')],width:4}; const width=40; nameRule({plate:value,label:value,time:value}, {width,measure}); },TypeError);
  assert.throws(()=>{ const value={spans:[span('abc')],width:2}; const width=40; nameRule({plate:value,label:value,time:value}, {width,measure}); },RangeError);
});

test('tab-rule ASCII default sanitizes control input', () => {
  assert.ok(!paint(neatline({label:'\x1b[31m'}, {width:20}),'none').includes('\x1b'));
});
test('tab-rule has columns 1–14 heavy then hairline, no ruler', () => {
  assert.equal(paint(tabRule({}, {width:20}),'none'),' ━━━━━━━━━━━━━━─────');
  assert.equal(paint(leader({glyph:'·'},{maxWidth:3}),'none'),'···');
  assert.match(paint(nameRule({label:'long operation',meter:[span('⡧⠤⠤⠤⠤⠤')]},{width:24}),'none'),/LUNALEE/);
  assert.throws(()=>tabRule({focused:1},{width:20}),TypeError);
  assert.throws(()=>leader({glyph:'x'},{maxWidth:4}),RangeError);
  assert.throws(()=>nameRule({joins:[20]},{width:20}),RangeError);
});
test('name-rule structural meter is not an unmeasured Unicode bypass',()=>{
  assert.throws(()=>nameRule({meter:[span('日本')]},{width:30}),TypeError);
});

test('neatline dashes are ghost while registration marks retain rule ink', async () => {
  const { SIGNAL_COLORS } = await import('../../foundation/signal-colors.mjs');
  const { SURFACE_PALETTE: P } = await import('../../foundation/surface-palette.mjs');
  for (const label of ['', 'START OF CONVERSATION']) {
    const line = neatline({label},{width:66});
    for (const s of line) {
      if(s.text.includes('┄')) assert.equal(s.style.fg,SIGNAL_COLORS.ghost);
      if(s.text.includes('┼')) assert.equal(s.style.fg,P.rule);
    }
  }
});
