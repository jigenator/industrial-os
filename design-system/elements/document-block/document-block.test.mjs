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
import { documentHeading, listRow, quoteRows, linkLines, codeBand, inlineCode, specTable } from './document-block.mjs';
test('document-block: H1–H6, tasks, quotes, visible URL, inline and fenced code', () => {
  assert.equal(documentHeading({text:'Fixture',level:1},{width:30}).length,2);
  assert.ok(plain(documentHeading({text:'Fixture',level:2},{width:30})[0]).startsWith('▍Fixture'));
  assert.ok(plain(listRow({body:'task',checked:true},{width:30})).startsWith('[x] task'));
  assert.ok(plain(listRow({body:'item'},{width:30})).startsWith('▪ item'));
  const quote=quoteRows({body:['fixture']},{width:30});assert.ok(quote[0].some(s=>s.style.italic));
  const link=linkLines({label:'fixture',url:'https://example.invalid'},{width:12});
  assert.ok(link[0].some(s=>s.style.underline));assert.ok(link.map(plain).join('').includes('https://example.invalid'));
  assert.ok(codeBand({language:'SH',body:['printf fixture']},{width:30})[1].some(s=>s.style.bg==='surface'));
  assert.equal(plain(inlineCode('fixture')),'fixture');
});
test('document-block: open table alignments and narrow record fallback retain every value', () => {
  const table=freeze({headings:['ITEM','COUNT'],rows:[['alpha','123'],['beta','4']],align:['left','right']});
  const wide=specTable(table,{width:30}).map(plain);
  assert.ok(wide[1].includes('━━━━'));assert.doesNotMatch(wide.join(''),/[│┌┐└┘]/);
  for(let width=1;width<=160;width++) {
    const rows=specTable(table,{width});geometry(rows,width);
    const text=rows.map(plain).join('');for(const value of ['ITEM','COUNT','alpha','beta','123','4']) assert.ok(text.includes(value),`${value}/${width}`);
  }
});
test('document-block: measured rich slots survive wrapping without splitting Unicode', () => {
  for(let width=2;width<=160;width++) {
    const value=rich('日本 é 👩‍💻');
    geometry(linkLines({label:value,url:value},{width,measure}),width,measure);
    geometry(codeBand({language:'JS',body:[value]},{width:Math.max(3,width),measure}),Math.max(3,width),measure);
    geometry(specTable({headings:['label'],rows:[[value]]},{width,measure}),width,measure);
    for(const level of [1,2,3,4,5,6]) geometry(documentHeading({text:value,level},{width,measure}),width,measure);
    geometry([listRow({body:value},{width,measure})],width,measure);
    geometry(quoteRows({body:[value]},{width,measure}),width,measure);
  }
  assert.throws(()=>linkLines({label:'日',url:''},{width:1,measure}),RangeError);
});
test('document-block: invalid arguments and injection fail at the text boundary', () => {
  for(const fn of [documentHeading,listRow,quoteRows,linkLines,codeBand,specTable]) {
    assert.throws(()=>fn(null,{width:30}),TypeError);assert.throws(()=>fn({}, {width:0}),RangeError);
  }
  assert.throws(()=>documentHeading({level:7},{width:30}),RangeError);
  assert.throws(()=>specTable({headings:['x'],rows:[[]]},{width:30}),TypeError);
  assert.throws(()=>specTable({headings:['x'],align:['bad']},{width:30}),RangeError);
  assert.throws(()=>codeBand({body:['\u202eunsafe']},{width:30,measure}),TypeError);
  assert.throws(()=>quoteRows({body:[{spans:[span('abc')],width:1}]},{width:30,measure}),RangeError);
});
