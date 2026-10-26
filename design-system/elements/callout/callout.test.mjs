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
import { callout, subtitle, timestampLeader } from './callout.mjs';
test('callout: mirrored corners, continuation, references and timestamp leaders', () => {
  const input=freeze({ name:'FIXTURE',body:['Synthetic body'],readout:'09:41',reference:'answer to QUESTION 07' });
  const left=callout(input,{width:60}).map(plain),right=callout({...input,side:'right'},{width:60}).map(plain);
  assert.equal(left.length,4);assert.ok(left[0].startsWith(' ┌╴FIXTURE'));assert.ok(right[0].endsWith('FIXTURE╶┐ '));
  assert.ok(left[3].includes('└╴┄'));assert.ok(right[3].includes('09:41'));assert.ok(right[3].endsWith('╶┘ '));
  assert.ok(left[2].includes('answer to QUESTION 07'));
  assert.doesNotMatch(plain(callout({...input,first:false},{width:60})[0]),/FIXTURE/);
  assert.equal(plain(timestampLeader({readout:'09:41',cells:3},{width:12})).trim(),'┄┄┄ 09:41');
});
test('callout: every width 1–160, both sides, states, measured slots and immutable inputs', () => {
  for(let width=1;width<=160;width++) for(const side of ['left','right']) for(const readout of ['delivered','waiting','sending','not delivered','queued','with her']) {
    geometry(callout({side,body:['Fixture body'],readout},{width}),width);
    const input=freeze({side,name:rich('日本 👩‍💻'),body:[rich('é 日本 👩‍💻')],readout:rich('時刻')});
    geometry(callout(input,{width,measure}),width,measure);
    geometry(subtitle({body:[rich('日本 é 👩‍💻')],ambient:true,aside:true},{width,measure}),width,measure);
  }
  const line=subtitle({body:['fixture'],aside:true},{width:20})[0];assert.ok(line.some(s=>s.style.italic));
});
test('callout: invalid inputs, injection and forged slots are rejected', () => {
  for(const width of [0,-1,1.5,1001,NaN]) assert.throws(()=>callout({}, {width}),RangeError);
  for(const value of [null,3,[],true]) assert.throws(()=>callout(value,{width:30}),TypeError);
  assert.throws(()=>callout({side:'other'},{width:30}),RangeError);
  assert.throws(()=>callout({first:1},{width:30}),TypeError);
  assert.throws(()=>callout({body:'bad'},{width:30}),TypeError);
  assert.throws(()=>callout({body:['\x1b[31m']},{width:30,measure}),TypeError);
  assert.throws(()=>subtitle({body:[{spans:[span('wide')],width:1}]},{width:20,measure}),RangeError);
  assert.throws(()=>timestampLeader({cells:-1},{width:20}),RangeError);
});

test('callout: public geometry follows short, long, measured and empty bodies', async () => {
  const { calloutGeometry } = await import('./callout.mjs');
  for (let width=1;width<=160;width++) for (const side of ['left','right']) for (const body of [[],['short'],['much longer synthetic text'],[rich('日本 é 👩‍💻')]]) {
    const input={side,body,readout:'09:41'}, options={width,measure};
    const bounds=calloutGeometry(input,options), lines=callout(input,options);
    assert.equal(bounds.rows,lines.length);assert.ok(lines.length>=3);
    assert.ok(bounds.left>=0&&bounds.left<=bounds.right&&bounds.right<width);
    for (const region of [bounds.textRegion,bounds.readoutRegion,bounds.timestampRegion,bounds.plotGutter]) assert.ok(region.left>=0&&region.left+region.cols<=width);
  }
  assert.equal(callout({body:[]},{width:40}).length,3);
});

test('subtitle: reveal uses full-line centering, marker uses floor(W/2), head is grapheme-safe', async () => {
  const { subtitleGeometry } = await import('./callout.mjs');
  for (const width of [20,21,40]) for (const body of [['fixture'],[rich('日é👩‍💻')],['first','second']]) {
    const full=subtitle({body},{width,measure});
    for (let revealed=0;revealed<=12;revealed++) {
      const input={body,revealed}, options={width,measure};
      const lines=subtitle(input,options);geometry(lines,width,measure);
      const {head}=subtitleGeometry(input,options);
      if(head) {
        // All visible graphemes occupy their settled cells, never re-centered prefixes.
        const row=plain(lines[head.row]), settled=plain(full[head.row]);
        assert.equal(row.length-row.trimStart().length, settled.length-settled.trimStart().length);
      }
    }
    assert.equal(plain(subtitle({body:[],marker:'▼'},{width,measure})[0]).indexOf('▼'),Math.floor(width/2));
    assert.ok(full.length);
  }
  const body=['abcdef'];
  assert.equal(plain(subtitle({body,revealed:1},{width:20})[0]).indexOf('a'),7);
  assert.equal(plain(subtitle({body,revealed:3},{width:20})[0]).indexOf('a'),7);
  assert.deepEqual(subtitleGeometry({body,revealed:3},{width:20}),{head:{row:0,col:9}});
  assert.throws(()=>subtitle({body,revealed:-1},{width:20}),RangeError);
});
