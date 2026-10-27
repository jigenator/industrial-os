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

test('a popup frame is a heavy top rule, structural sides and floor, filled with the field', async () => {
  const { popupFrame } = await import('./popup-header.mjs');
  const frame = popupFrame({ height: 4 }, { width: 6 });
  assert.deepEqual(frame.map((l) => paint(l, 'none')), ['━━━━━━', '│    │', '│    │', '──────']);
  assert.deepEqual(frame[0], [span('━━━━━━', { fg: 'primary', bg: 'field' })]);
  assert.deepEqual(frame[1], [span('│', { fg: 'structural', bg: 'field' }), span('    ', { fg: 'secondary', bg: 'field' }), span('│', { fg: 'structural', bg: 'field' })]);
  assert.deepEqual(frame[3], [span('──────', { fg: 'structural', bg: 'field' })]);
  assert.deepEqual(popupFrame({ height: 1 }, { width: 3 }).map((l) => paint(l, 'none')), ['───']);
  for (let width = 1; width <= 60; width++) for (const line of popupFrame({ height: 3 }, { width })) assert.equal(lineWidth(line), width);
  assert.throws(() => popupFrame({ height: 0 }, { width: 6 }), RangeError);
});

test('a popup title bar: a state mark or a filled band, bold title and word, detail, and a right-aligned close', async () => {
  const { popupTitleBar } = await import('./popup-header.mjs');
  const quiet = popupTitleBar({ mark: 'structural', title: 'DOCS-SWEEP', word: 'IDLE', wordInk: 'decorative', detail: 'DEMOMACHINE · 2 SLOTS', meta: 'ESC CLOSE' }, { width: 52, measure: (t) => [...t].length });
  assert.equal(paint(quiet, 'none'), '█ DOCS-SWEEP  IDLE  DEMOMACHINE · 2 SLOTS  ESC CLOSE');
  assert.deepEqual(quiet.filter((s) => s.text.trim()), [
    span('█', { fg: 'structural' }), span('DOCS-SWEEP', { fg: 'primary', bold: true }), span('IDLE', { fg: 'decorative', bold: true }),
    span('DEMOMACHINE · 2 SLOTS', { fg: 'decorative' }), span('ESC CLOSE', { fg: 'decorative' }),
  ]);
  const band = popupTitleBar({ band: { fill: '#95b8d1', ink: 'field' }, title: 'IMPLEMENT', word: 'RUNNING', detail: '3 SLOTS', meta: 'ESC CLOSE' }, { width: 40 });
  assert.equal(paint(band, 'none'), '  IMPLEMENT  RUNNING  3 SLOTS  ESC CLOSE');
  assert.ok(band.every((s) => s.style.bg === '#95b8d1'));
  assert.ok(band.filter((s) => !s.text.trim()).every((s) => s.style.fg === 'secondary'));
  assert.deepEqual(band.filter((s) => s.text.trim()).map((s) => s.style), [
    { fg: 'field', bg: '#95b8d1', bold: true }, { fg: 'field', bg: '#95b8d1', bold: true }, { fg: 'field', bg: '#95b8d1' }, { fg: 'field', bg: '#95b8d1' },
  ]);
  // The close action keeps its place; the title, word and detail yield in that order.
  assert.equal(paint(popupTitleBar({ mark: 'accent', title: 'A-VERY-LONG-PIPELINE', word: 'RUNNING', detail: 'X', meta: 'ESC CLOSE' }, { width: 30 }), 'none'), '█ A-VERY-LONG-PIPE…  ESC CLOSE');
  for (let width = 1; width <= 100; width++) assert.equal(lineWidth(popupTitleBar({ mark: 'accent', title: 'TITLE', word: 'WORD', detail: 'DETAIL', meta: 'ESC CLOSE' }, { width })), width);
  assert.throws(() => popupTitleBar({ title: 'X' }, { width: 20 }), TypeError);
});

test('a popup title bar places wide graphemes by their measured width', async () => {
  const { popupTitleBar } = await import('./popup-header.mjs');
  const wide = (text) => [...text].reduce((n, ch) => n + (/[\u3040-\u9fff]/u.test(ch) ? 2 : 1), 0);
  const bar = popupTitleBar({ mark: 'accent', title: '日本', word: 'RUN', detail: '詳細', meta: '閉じる' }, { width: 30, measure: wide });
  assert.equal(paint(bar, 'none'), '█ 日本  RUN  詳細' + ' '.repeat(7) + '閉じる');
  assert.equal(lineWidth(bar, { measure: wide }), 30);
  assert.deepEqual(bar.at(-1), span('閉じる', { fg: 'decorative' }));
  // Cut parts still end two cells before the close action, which keeps every cell.
  for (let width = 1; width <= 40; width++) {
    const cut = popupTitleBar({ band: { fill: '#95b8d1', ink: 'field' }, title: '日本語のタイトル', word: '実行', detail: '詳細', meta: '閉じる' }, { width, measure: wide });
    assert.equal(lineWidth(cut, { measure: wide }), width, `${width}`);
    if (width >= 6) assert.ok(paint(cut, 'none').endsWith('閉じる'), `${width}`);
    if (width >= 10) assert.ok(paint(cut, 'none').slice(0, -3).endsWith('  '), `${width}`);
  }
});

test('a popup backdrop fades every cell to a quarter over the field and drops bold', async () => {
  const { popupBackdrop, POPUP_BACKDROP } = await import('./popup-header.mjs');
  assert.equal(POPUP_BACKDROP, 0.25);
  assert.deepEqual(popupBackdrop({ fg: 'primary', bg: '#95b8d1', bold: true }), { fg: '#404040', bg: '#252e34', bold: false });
  assert.deepEqual(popupBackdrop({}), { fg: '#343434', bg: '#000000', bold: false });
  assert.throws(() => popupBackdrop({ fg: 'default' }), TypeError);
});

test('ellipsis always marks a title-bar part cut to one cell', async () => {
  const { popupTitleBar } = await import('./popup-header.mjs');
  const bar = (ellipsis) => paint(popupTitleBar({ mark: 'accent', title: 'IMPLEMENT', meta: 'ESC CLOSE' }, { width: 14, ellipsis }), 'none');
  assert.equal(bar(undefined), '█ I  ESC CLOSE');
  assert.equal(bar('always'), '█ …  ESC CLOSE');
});
