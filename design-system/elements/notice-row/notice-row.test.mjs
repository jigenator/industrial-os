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

test('connection notices can put the LINK plate before an independently inked glyph', async () => {
  const { SURFACE_PALETTE: P } = await import('../../foundation/surface-palette.mjs');
  const input={plate:'LINK',plateFirst:true,glyph:'⠋',glyphInk:'accent',plateStyle:{fg:'field',bg:P.plateGrey},text:'connecting'};
  const line=noticeRow(input,{width:66})[0];
  assert.ok(paint(line,'none').startsWith('  LINK  ⠋ connecting'));
  assert.equal(line.find(s=>s.text.includes('LINK')).style.bg,P.plateGrey);
  assert.equal(line.find(s=>s.text.includes('⠋')).style.fg,'accent');
  assert.equal(line.find(s=>s.text==='connecting').style.fg,'decorative');
  assert.equal(noticeRow({tone:'critical',text:'not delivered'},{width:66})[0].find(s=>s.text==='not delivered').style.fg,'secondary');
  assert.throws(()=>noticeRow({...input,plateFirst:1},{width:66}),TypeError);
  assert.throws(()=>noticeRow({...input,glyphInk:'invalid'},{width:66}),TypeError);
  assert.throws(()=>noticeRow({...input,plateStyle:{bg:'invalid'}},{width:66}),TypeError);
});

test('command details are full-width surface bands, with SH on the first row and no hard wrapping', () => {
  const input={detail:[{kind:'command',text:'$ cd synthetic-project',label:'SH'},{kind:'command',text:'  service && bun run src/main.ts',label:''}]};
  const before=structuredClone(input);
  for(let width=1;width<=160;width++) {
    const lines=noticeRow(input,{width});
    assert.equal(lines.length,3);
    for(const line of lines.slice(1)) {
      assert.equal(lineWidth(line),width);
      assert.ok(line.every(s=>s.style.bg==='surface'||s.style.bg==='structural'));
      assert.equal(paint(line,'truecolor').replace(/\x1b\[[0-9;]*m/g,''),paint(line,'none'));
    }
  }
  const lines=noticeRow(input,{width:66});
  assert.ok(paint(lines[1],'none').endsWith(' SH   '));
  assert.ok(!paint(lines[2],'none').includes(' SH '));
  assert.ok(paint(lines[2],'none').includes('service && bun run src/main.ts'));
  const command='/a/synthetic/path/with/no/safe/wrap/point/'.repeat(3);
  const clipped=noticeRow({detail:[{kind:'command',text:command}]},{width:30});
  assert.equal(clipped.length,2);
  assert.ok(paint(clipped[1],'none').includes('…'));
  assert.deepEqual(input,before);
  assert.throws(()=>noticeRow({detail:[{kind:'unknown',text:'x'}]},{width:66}),RangeError);
});

test('command text and label slots use the measured trust boundary, including tiny budgets', () => {
  const measure=text=>[...new Intl.Segmenter('und',{granularity:'grapheme'}).segment(text)].reduce((n,{segment})=>n+(['日','👩‍💻'].includes(segment)?2:1),0);
  const value=textSlot([span('日 é 👩‍💻',{italic:true})],7,{measure});
  const input={detail:[{kind:'command',text:value,label:'SH'}]};
  const before=structuredClone(input);
  for(let width=1;width<=40;width++) for(const line of noticeRow(input,{width,measure})) assert.equal(lineWidth(line,{measure}),width);
  assert.ok(paint(noticeRow(input,{width:40,measure})[1],'none').includes('日 é 👩‍💻'));
  assert.deepEqual(input,before);
  assert.throws(()=>noticeRow({detail:[{kind:'command',text:'bad\x1b'}]},{width:40,measure}),TypeError);
  assert.throws(()=>noticeRow({detail:[{kind:'command',text:{spans:[span('abc')],width:2}}]},{width:40,measure}),RangeError);
});

test('connection variants compose measured word inks without host-drawn chrome', async () => {
  const { SURFACE_PALETTE: P } = await import('../../foundation/surface-palette.mjs');
  const measure = text => [...text].length;
  const variants = [
    { glyph:'⠋', glyphInk:'accent', plateInk:P.plateGrey, words:[span('connecting',{fg:'secondary'})] },
    { glyph:'⠋', glyphInk:'warning', plateInk:'warning', words:[span('reconnecting',{fg:'warning',bold:true}),span(' · history is last known',{fg:'decorative'})] },
    { glyph:'■', glyphInk:'critical', plateInk:'critical', words:[span('not running · retrying',{fg:'critical',bold:true}),span(' · next try 10s',{fg:'decorative'})] },
    { glyph:'✕', glyphInk:'critical', plateInk:'critical', words:[span('rejected: token · press r to retry',{fg:'critical',bold:true})] },
    { glyph:'◇', glyphInk:'decorative', plateInk:P.plateGrey, words:[span('disconnected · cached sheets are read-only',{fg:'secondary'})] },
  ];
  for (const {glyph,glyphInk,plateInk,words} of variants) {
    const text=textSlot(words,lineWidth(words,{measure}),{measure});
    const input={plate:'LINK',plateFirst:true,glyph,glyphInk,plateStyle:{fg:'field',bg:plateInk},text};
    const before=structuredClone(input);
    for(let width=1;width<=160;width++) assert.equal(lineWidth(noticeRow(input,{width,measure})[0],{measure}),width);
    const line=noticeRow(input,{width:66,measure})[0];
    assert.ok(paint(line,'none').includes(words.map(s=>s.text).join('')));
    for(const word of words) assert.equal(line.find(s=>s.text===word.text).style.fg,word.style.fg);
    assert.deepEqual(input,before);
  }
});
