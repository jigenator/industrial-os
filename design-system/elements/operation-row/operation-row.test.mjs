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
import { operationHeading, operationRow, operationDetail } from './operation-row.mjs';
test('operation-row: fixed columns, selected gutter, duration priority and supplied category case', () => {
  const input=freeze({state:'running',time:'09:40',category:'tool',detail:'x'.repeat(100),duration:'running 1:00',selected:true});
  const line=plain(operationRow(input,{width:70}));assert.equal(line[1],'▸');assert.equal(line.slice(2,7),'09:40');assert.equal(line.slice(8,12),'tool');assert.ok(line.endsWith('running 1:00'));
  assert.equal(plain(operationRow({...input,duration:'2.3s'},{width:12})).slice(-4),'2.3s');
  const heading=plain(operationHeading({focused:true,code:'O-01'},{width:70}));assert.match(heading,/focused/);assert.ok(heading.endsWith('O-01'));assert.doesNotMatch(heading,/┄/);
  assert.equal(plain(operationDetail({label:'STATUS',value:'running'},{width:50})).slice(15,22),'running');
});
test('operation-row: all plain state shapes, color parity, widths 1–160 and measured slots', () => {
  const shapes={running:'▒',done:'█',failed:'✕',neutral:'·',waiting:'▲'};
  for(let width=1;width<=160;width++) for(const [state,glyph] of Object.entries(shapes)) {
    const input={state,time:'09:40',category:'TOOL',detail:rich('日本 é 👩‍💻'),duration:'2.3s',hover:true};
    const row=operationRow(input,{width,measure,color:false});assert.equal(plain(row)[0],glyph);geometry([row],width,measure);
    geometry([operationHeading({label:rich('日本'),code:'O-01',focused:true},{width,measure}),operationDetail({label:rich('日本'),value:rich('é 👩‍💻')},{width,measure})],width,measure);
  }
});
test('operation-row: invalid arguments, styles, columns and injection are rejected', () => {
  assert.throws(()=>operationRow({state:'other'},{width:40}),RangeError);
  assert.throws(()=>operationRow({}, {width:40,columns:{time:-1}}),RangeError);
  assert.throws(()=>operationRow({}, {width:40,styles:{detail:{fg:'bad'}}}),TypeError);
  assert.throws(()=>operationRow({detail:'\x1b[31m'},{width:40,measure}),TypeError);
  assert.throws(()=>operationRow({selected:1},{width:40}),TypeError);
  for(const fn of [operationHeading,operationRow,operationDetail]) {assert.throws(()=>fn(null,{width:40}),TypeError);assert.throws(()=>fn({}, {width:0}),RangeError);}
});

test('operation-row: dots approach short durations, bold selection, detail label gap',()=>{
  const row=operationRow({detail:'Fixture',duration:'2.3s',selected:true},{width:70});
  assert.ok(plain(row).endsWith('· 2.3s'));assert.ok(row.find(s=>s.text==='▸').style.bold);
  assert.ok(plain(operationDetail({label:'STATUS',value:'running'},{width:40})).startsWith('STATUS ·'));
});
