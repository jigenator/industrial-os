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

test('keycap bay: four 3-cell keys centred on a 16-cell ground, end cells in the end keys\' hit areas', async () => {
  const { keycapBay } = await import('./action-label.mjs');
  const { BAY_INKS } = await import('../../foundation/surface-palette.mjs');
  const KEYS = [{ glyph: '|' }, { glyph: '-' }, { glyph: '^' }, { glyph: 'x' }];
  const cellsOf = (line) => line.flatMap((s) => [...s.text].map((ch) => ({ ch, ...s.style })));
  const bay = keycapBay(KEYS);
  assert.equal(bay.line.map((s) => s.text).join(''), '  [|][-][^][x]  ');
  assert.deepEqual(bay.keys, [
    { col: 2, len: 3, hitCol: 0, hitLen: 5 }, { col: 5, len: 3, hitCol: 5, hitLen: 3 },
    { col: 8, len: 3, hitCol: 8, hitLen: 3 }, { col: 11, len: 3, hitCol: 11, hitLen: 5 },
  ]);
  // The hit areas tile the bay: nothing in it is dead.
  assert.equal(bay.keys.reduce((n, k) => n + k.hitLen, 0), 16);
  for (const level of ['lit', 'standby', 'dark']) {
    const cells = cellsOf(keycapBay(KEYS, { lighting: level }).line), ink = BAY_INKS[level];
    assert.ok(cells.every((c) => c.bg === ink.ground));
    assert.deepEqual(cells.filter((c) => '[]'.includes(c.ch)).map((c) => [c.fg, c.bold]), Array(8).fill([ink.bracket, false]));
    assert.deepEqual(cells.filter((c) => '|-^x'.includes(c.ch)).map((c) => [c.fg, c.bold]), Array(4).fill([ink.glyph, true]));
  }
  const hovered = cellsOf(keycapBay(KEYS, { hover: 0, pressed: 2 }).line);
  assert.deepEqual(hovered.slice(2, 5).map((c) => [c.fg, c.bg]), Array(3).fill([BAY_INKS.hover.glyph, BAY_INKS.hover.ground]));
  assert.deepEqual(hovered.slice(8, 11).map((c) => [c.fg, c.bg]), Array(3).fill([BAY_INKS.pressed.glyph, BAY_INKS.pressed.ground]));
  // Pressed wins over hover on the same key; zoomed swaps the glyph.
  assert.equal(cellsOf(keycapBay(KEYS, { hover: 1, pressed: 1 }).line)[6].bg, BAY_INKS.pressed.ground);
  assert.equal(keycapBay([{ glyph: '|' }, { glyph: '-' }, { glyph: 'v' }, { glyph: 'x' }]).line.map((s) => s.text).join(''), '  [|][-][v][x]  ');
  for (const bad of [[], [{ glyph: 'ab' }], [{ glyph: ' ' }], 'x']) assert.throws(() => keycapBay(bad), TypeError);
  for (const options of [{ width: 11 }, { lighting: 'on' }, { hover: 4 }, { pressed: -1 }]) assert.throws(() => keycapBay(KEYS, options), RangeError);
});
