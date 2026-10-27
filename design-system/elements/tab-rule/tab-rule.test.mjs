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

test('name-rule centers the exact plate/readout group with symmetric outer gaps and rail-only joins', () => {
  const meter=[span('⡧⠤⠤⠤⠤⠤')];
  for(const width of [40,41,64,65,99,100]) for(const joins of [[],[2,width-3]]) {
    for(const [input,group] of [
      [{},' LUNALEE '],
      [{time:'10:29'},' LUNALEE  10:29'],
      [{label:'thinking',meter},' LUNALEE  thinking  ⡧⠤⠤⠤⠤⠤'],
      [{label:'thinking 0:21',meter},' LUNALEE  thinking 0:21  ⡧⠤⠤⠤⠤⠤'],
    ]) {
      const line=paint(nameRule({...input,joins},{width}),'none');
      const left=Math.floor((width-group.length)/2),right=left+group.length;
      assert.equal(line.slice(left,right),group);
      assert.equal(line[left-1],' ');assert.equal(line[right],' ');
      assert.equal(line[left-2],joins.includes(left-2)?'┴':'─');assert.equal(line[right+1],joins.includes(right+1)?'┴':'─');
      assert.ok(width-right-left>=0 && width-right-left<=1);
      for(const join of joins) assert.equal(line[join],'┴');
    }
  }
});

test('board rules: separate tab and hairline inks, an optional lead cell, and a vertical hairline', async () => {
  const { verticalRule } = await import('./tab-rule.mjs');
  const { BOARD_INKS } = await import('../../foundation/signal-colors.mjs');
  const inks = { tab: 'accent', rule: BOARD_INKS.faint };
  const header = tabRule({ tabCells: 14, inks }, { width: 20 });
  assert.equal(paint(header, 'none'), ' ━━━━━━━━━━━━━━─────');
  assert.deepEqual(header, [span(' ', { bg: 'default' }), span('━'.repeat(14), { fg: 'accent', bg: 'default' }), span('─────', { fg: BOARD_INKS.faint, bg: 'default' })]);
  assert.deepEqual(tabRule({ tabCells: 3, inks: { tab: 'primary', rule: BOARD_INKS.faint } }, { width: 6, lead: false }),
    [span('━━━', { fg: 'primary', bg: 'default' }), span('───', { fg: BOARD_INKS.faint, bg: 'default' })]);
  assert.deepEqual(tabRule({ tabCells: 0, inks }, { width: 4, lead: false }), [span('────', { fg: BOARD_INKS.faint, bg: 'default' })]);
  // Omitted inks keep each part's original ink; omitted options keep the original bytes.
  assert.deepEqual(tabRule({ focused: true, inks: { rule: BOARD_INKS.faint } }, { width: 18 })[1], span('━'.repeat(14), { fg: 'accent', bg: 'default' }));
  for (let width = 1; width <= 160; width++) {
    assert.deepEqual(tabRule({ focused: true }, { width, lead: true }), tabRule({ focused: true }, { width }));
    assert.equal(lineWidth(tabRule({ tabCells: 14, inks }, { width, lead: false })), width);
  }
  assert.throws(() => tabRule({ inks: { tab: 'acid' } }, { width: 10 }), TypeError);
  assert.throws(() => tabRule({ inks: 'accent' }, { width: 10 }), TypeError);
  assert.throws(() => tabRule({}, { width: 10, lead: 1 }), TypeError);
  const column = verticalRule({ ink: BOARD_INKS.faint }, { height: 3 });
  assert.deepEqual(column, Array(3).fill([span('│', { fg: BOARD_INKS.faint, bg: 'default' })]));
  assert.equal(verticalRule({}, { height: 1 })[0][0].style.fg, '#3a3f46');
  assert.throws(() => verticalRule({}, { height: 0 }), RangeError);
});
