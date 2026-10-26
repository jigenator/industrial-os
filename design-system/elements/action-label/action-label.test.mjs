import test from 'node:test';
import assert from 'node:assert/strict';
import { lineWidth, paint, span, textSlot } from '../../foundation/cells.mjs';
import { actionLabel, keyHints } from './action-label.mjs';

test('action-label bounds every state at widths 1–160 and preserves plain/color geometry', () => {
  for(let width=1;width<=160;width++) for(const line of [keyHints([{key:'^O',label:'open'},{key:'Esc',label:'back'}],{width}), ...['ready','read','hover'].map(state=>actionLabel({state},{maxWidth:width}))]) {
    assert.ok(lineWidth(line)<=width);
    assert.equal(paint(line,'truecolor').replace(/\x1b\[[0-9;]*m/g,''),paint(line,'none'));
    for(const item of line) assert.equal(typeof item.text,'string');
  }
});

test('action-label measured slots keep wide, combining and ZWJ graphemes; no input mutation', () => {
  const measure = text => [...new Intl.Segmenter('und',{granularity:'grapheme'}).segment(text)].reduce((n,{segment})=>n+(['日','本','👩‍💻'].includes(segment)?2:1),0);
  const value=textSlot([span('日本 é 👩‍💻',{italic:true,bg:'default'})],9,{measure});
  const before=structuredClone(value);
  for(let width=1;width<=40;width++) {
    const line=keyHints([{key:value,label:value}], {width,measure});
    assert.ok(lineWidth(line,{measure})<=width);
    assert.ok(!paint(line,'none').includes('?'));
  }
  assert.deepEqual(value,before);
  assert.throws(()=>{ const value={spans:[span('bad\x1b')],width:4}; const width=40; keyHints([{key:value,label:value}], {width,measure}); },TypeError);
  assert.throws(()=>{ const value={spans:[span('abc')],width:2}; const width=40; keyHints([{key:value,label:value}], {width,measure}); },RangeError);
});

test('action-label ASCII default sanitizes control input', () => {
  assert.ok(!paint(actionLabel({label:'\x1b[31m'}, {maxWidth:20}),'none').includes('\x1b'));
});
test('action-label read action has brackets; keyHints drops entire tokens', () => {
  assert.equal(paint(actionLabel({state:'read'}),'none'),'[open ▸]');
  assert.equal(paint(keyHints([{key:'^O',label:'open'},{key:'Esc',label:'back'}],{width:13}),'none'),' ^O open     ');
  assert.throws(()=>actionLabel({state:'disabled'}),RangeError);
  assert.throws(()=>actionLabel({}, {maxWidth:-1}),RangeError);
  assert.throws(()=>keyHints([{label:3}],{width:30}),TypeError);
});

test('action hover uses the wheat highlight, read is not bold, and unused focus is refused', async () => {
  const { SURFACE_PALETTE: P } = await import('../../foundation/surface-palette.mjs');
  assert.equal(actionLabel()[0].style.bg, P.wheat);
  assert.equal(actionLabel({state:'hover'})[0].style.bg, P.wheatHi);
  assert.ok(actionLabel({state:'read'}).every(s => s.style.bold === false));
  assert.throws(() => actionLabel({state:'focused'}), RangeError);
});
