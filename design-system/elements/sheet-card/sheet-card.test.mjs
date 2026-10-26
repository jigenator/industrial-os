import test from 'node:test';
import assert from 'node:assert/strict';
import { fitLine, lineWidth, paint, span, textSlot } from '../../foundation/cells.mjs';
const plain = line => paint(line, 'none');
const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });
const measure = text => [...segmenter.segment(text)].reduce((n, { segment }) => n + (/\p{Script=Han}|\p{Extended_Pictographic}/u.test(segment) ? 2 : 1), 0);
const rich = value => textSlot([span(value, { fg: 'primary', bg: 'default', italic: true, underline: true })], measure(value), { measure });
const freeze = value => { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); } return value; };
function geometry(lines, width, measure) {
  for (const line of lines) {
    assert.equal(lineWidth(line, { measure }), width);
    assert.equal(paint(line, 'truecolor').replace(/\x1b\[[0-9;]*m/g, ''), plain(line));
  }
}
import { cardState, cardHeading, sheetCard, stackRow, stackCard, sheetListRow, SHEET_STATES } from './sheet-card.mjs';
test('sheet-card: shared state words, heading, read band and fixed card row counts', () => {
  const words={unread:'unread ◆',read:'read',waiting:'waiting on you ●',answered:'answered',declined:'declined','delivery-waiting':'delivery waiting ●'};
  for(const [state,word] of Object.entries(words)) assert.equal(plain(cardState({state})),word);
  assert.equal(plain(cardState({state:'answered',answer:'fixture'})),'answered · fixture');
  const input=freeze({heading:{number:'05',time:'09:41',state:'unread'},title:'Fixture',gist:['first','second'],footer:'no answer needed'});
  assert.equal(sheetCard(input,{width:70}).length,5);assert.equal(sheetCard({...input,kind:'question'},{width:70}).length,3);
  const read=sheetCard({...input,read:true,heading:{...input.heading,state:'read'}},{width:70});
  assert.ok(read.every(l=>l.every(s=>s.style.bg==='default')));assert.match(read.map(plain).join(''),/\[open ▸\]/);
  const heading=plain(cardHeading(input.heading,{width:70}));assert.ok(heading.includes('▤ SHEET 05  09:41'));assert.ok(heading.endsWith('unread ◆ '));assert.ok(Object.isFrozen(SHEET_STATES.waiting));
});
test('sheet-card: selection is immediate, tree columns are reserved and list rows share words', () => {
  const row={label:'QUESTION 07',title:'Fixture',state:'waiting',selected:true,last:true};
  assert.ok(plain(stackRow(row,{width:70})).startsWith(' └─█▸'));
  const list = plain(sheetListRow({...row,updated:'Mon'},{width:70}));
  assert.equal(list.slice(40,56),'waiting on you ●'); assert.equal(list.slice(62,65),'Mon');
  const stack=stackCard({heading:'2 fixtures',rows:[row,row]},{width:70});assert.equal(stack.length,3);assert.ok(plain(stack[1]).startsWith(' ├─'));assert.ok(plain(stack[2]).startsWith(' └─'));
});
test('sheet-card: widths 1–160, every state, measured slots, plain/color geometry and immutability', () => {
  for(let width=1;width<=160;width++) for(const state of Object.keys(SHEET_STATES)) {
    const row=freeze({label:rich('番号'),title:rich('日本 é 👩‍💻'),state,answer:rich('日本'),updated:rich('時刻'),selected:true});
    geometry([stackRow(row,{width,measure}),sheetListRow(row,{width,measure})],width,measure);
    geometry(sheetCard({heading:{number:'05',state},title:rich('日本 é 👩‍💻'),gist:[rich('日本')]},{width,measure}),width,measure);
  }
});
test('sheet-card: invalid states, flags, dimensions and unsafe slots are rejected', () => {
  assert.throws(()=>cardState({state:'missing'}),RangeError);
  assert.throws(()=>sheetCard({hover:1},{width:40}),TypeError);
  assert.throws(()=>sheetCard({kind:'other'},{width:40}),RangeError);
  assert.throws(()=>stackRow({selected:1},{width:40}),TypeError);
  assert.throws(()=>cardHeading({number:'\x1b[31m'},{width:40,measure}),TypeError);
  assert.throws(()=>stackCard({rows:null},{width:40}),TypeError);
  assert.throws(()=>sheetCard({gist:[rich('abc')]},{width:40}),TypeError);
});

test('sheet-card: ^P fixed columns, no tint, floor leaders and wheat selected read fill', () => {
  const columns={state:60,updated:82};
  for(const state of ['unread','waiting','read','answered','declined','delivery-waiting']) {
    const row=sheetListRow({label:'05',title:'Fixture',state,updated:'Mon'},{width:100,columns});
    const text=plain(row);assert.equal(text.slice(60,60+plain(cardState({state})).length),plain(cardState({state})));assert.equal(text.slice(82,85),'Mon');
    assert.ok(text.slice(20,60).includes('·'));assert.ok(row.every(s=>s.style.bg==='default'));
  }
  const selected=sheetListRow({label:'05',title:'Fixture',state:'read',selected:true},{width:100,columns});
  assert.ok(selected.some(s=>s.style.bg==='#e3cfa0'));assert.ok(!plain(selected).includes('·'));
  assert.throws(()=>sheetListRow({}, {width:40,columns:{state:30,updated:20}}),RangeError);
});

test('sheet-card: review inks and read STACK tint', () => {
  const read=sheetCard({heading:{state:'read'},title:'Title',read:true,footer:'Footer'},{width:70});
  assert.equal(read[1].find(s=>s.text.includes('Title')).style.fg,'secondary');
  assert.equal(read[4].find(s=>s.text.includes('Footer')).style.fg,'decorative');
  assert.equal(read[1].find(s=>s.text.includes('█')).style.fg,'#333333');
  assert.ok(cardState({state:'unread'}).every(s=>s.style.bold));
  assert.ok(stackRow({state:'read',title:'Fixture'},{width:70}).some(s=>s.style.bg==='#1d1a12'));
});
