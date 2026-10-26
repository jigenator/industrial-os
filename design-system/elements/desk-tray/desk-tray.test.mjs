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
import { deskStrip, deskHeading, questionTitle, questionBody, deskFooter, DESK_COLUMNS } from './desk-tray.mjs';
test('desk-tray: one exact grid, clear notch omitted, steady waiting notch and right margins', () => {
  assert.deepEqual(DESK_COLUMNS,{stripe:1,content:3,body:5});
  assert.equal(plain(deskStrip({state:'clear'},{width:70}))[1],' ');
  const strip=plain(deskStrip({state:'waiting',count:'2 waiting on you',hint:'^O open'},{width:70}));
  assert.equal(strip[1],'●');assert.equal(strip.slice(3,9),' DESK ');assert.ok(strip.endsWith('^O open '));
  const head=plain(deskHeading({count:'2 waiting on you',hint:'Esc puts off'},{width:70}));assert.equal(head.slice(3,9),' DESK ');assert.ok(head.endsWith('Esc puts off '));assert.doesNotMatch(head,/┄/);
  const title=plain(questionTitle({label:'QUESTION 07',title:'Fixture',open:true,meta:'1/2'},{width:70}));assert.equal(title[1],'█');assert.equal(title[2],'▸');assert.equal(title.slice(3,14),'QUESTION 07');assert.ok(title.endsWith('1/2 '));
  const rows=questionBody({prompt:['Fixture prompt'],options:[{label:'1',body:'Fixture option',selected:true,pick:true}]},{width:70}).map(plain);
  assert.equal(rows[0][1],'│');assert.equal(rows[0].slice(5,19),'Fixture prompt');assert.equal(rows[1][5],'●');assert.ok(rows[1].endsWith('◆ her pick '));
  assert.equal(plain(deskFooter({state:'decline',text:'Enter confirms'},{width:70})).slice(5,16),' ▲ DECLINE?');
});
test('desk-tray: every footer/state at widths 1–160; measured prompt/options and input immutability', () => {
  for(let width=1;width<=160;width++) {
    for(const state of ['clear','waiting','open']) geometry([deskStrip({state,count:'2 waiting on you'},{width})],width);
    for(const state of ['hint','saving','error','decline','readonly']) geometry([deskFooter({state,text:rich('日本 é 👩‍💻')},{width,measure})],width,measure);
    const input=freeze({prompt:[rich('日本 é 👩‍💻')],options:[{label:'1',body:rich('日本'),pick:true},{body:'other'}]});
    geometry(questionBody(input,{width,measure}),width,measure);
    geometry([deskHeading({count:rich('日本')},{width,measure}),questionTitle({title:rich('日本')},{width,measure})],width,measure);
  }
});
test('desk-tray: no validation/error content concealed and invalid inputs rejected', () => {
  for(const state of ['saving','error','decline','readonly']) assert.match(plain(deskFooter({state,text:'fixture notice'},{width:70})),/fixture notice/);
  assert.throws(()=>deskStrip({state:'other'},{width:40}),RangeError);
  assert.throws(()=>questionBody({options:[{body:'x',selected:1}]},{width:40}),TypeError);
  assert.throws(()=>questionTitle({open:1},{width:40}),TypeError);
  assert.throws(()=>deskFooter({state:'error',text:'\x1b[31m'},{width:40,measure}),TypeError);
  for(const fn of [deskStrip,deskHeading,questionTitle,questionBody,deskFooter]) {assert.throws(()=>fn(null,{width:40}),TypeError);assert.throws(()=>fn({}, {width:0}),RangeError);}
});
