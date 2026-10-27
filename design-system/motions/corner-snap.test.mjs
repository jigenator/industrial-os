import test from 'node:test';
import assert from 'node:assert/strict';
import {paint} from '../foundation/cells.mjs';
import {inputFrame} from '../elements/input-frame/input-frame.mjs';
import {cornerSnap,cornerSnapSettling} from './corner-snap.mjs';
const text=lines=>lines.map(line=>paint(line,'none'));
test('corner snap holds spread after 40 ms, returns home on leave/off, keeps focused/form label and body',()=>{
  assert.equal(cornerSnapSettling(),40);
  for(const state of ['hover','focused','form']) {
    const home=inputFrame({state},{width:40,bodyRows:3}),before=structuredClone(home);
    assert.deepEqual(text(cornerSnap(home,{time:0})),text(home));
    const spread=cornerSnap(home,{time:40});
    assert.equal(text(spread)[0].slice(0,2),'┌╴');
    assert.deepEqual(text(cornerSnap(home,{time:1e9})),text(spread));
    assert.deepEqual(text(cornerSnap(home,{animate:false})),text(home));
    assert.deepEqual(text(spread).slice(2,5),text(home).slice(2,5));
    assert.ok(text(spread)[1].includes('INPUT'));
    assert.deepEqual(home,before);
  }
});

test('only hover corners latch acid; focused bone and form critical ink persist', async () => {
  const { SURFACE_PALETTE: P } = await import('../foundation/surface-palette.mjs');
  for (const [state, fg] of [['hover','accent'],['focused',P.bone],['form','critical']]) {
    const home = inputFrame({state},{width:40});
    for (const time of [0,39]) {
      const frame = cornerSnap(home,{time});
      const corners = frame.flat().filter(s => /[┌┐└┘╴╶]/u.test(s.text));
      assert.equal(corners.length,8);
      assert.ok(corners.every(s => s.style.fg===fg));
    }
    const spread = cornerSnap(home,{time:40}).flat().filter(s => /[┌┐└┘╴╶]/u.test(s.text));
    const settled = state==='hover'?'primary':fg;
    assert.ok(spread.every(s => s.style.fg===settled));
  }
});

test('heavy corners: a type-unit frame with reserved gutters snaps its four heavy pairs; light stays the default', async () => {
  const { typeUnit } = await import('../elements/type-unit/type-unit.mjs');
  const { fitLine, span } = await import('../foundation/cells.mjs');
  const unit = typeUnit({ label: 'UNIT', state: 'planned' }, { width: 37 });
  const home = [fitLine([], 40), ...unit.map(line => fitLine([span(' '), ...line], 40)), fitLine([], 40)], before = structuredClone(home);
  assert.deepEqual(text(cornerSnap(home, { time: 40 })), text(home));
  const spread = text(cornerSnap(home, { time: 40, corners: 'heavy' }));
  assert.equal(spread[0], '┏━' + ' '.repeat(35) + '━┓ ');
  assert.equal(spread.at(-1), '┗━' + ' '.repeat(35) + '━┛ ');
  assert.equal(spread[1].slice(0, 6), '    UN');
  assert.deepEqual(spread.slice(2, -2), text(home).slice(2, -2));
  assert.deepEqual(text(cornerSnap(home, { time: 0, corners: 'heavy' })), text(home));
  assert.deepEqual(text(cornerSnap(home, { animate: false, corners: 'heavy' })), text(home));
  assert.deepEqual(home, before);
  for (const corners of ['', 'Heavy', '__proto__', 1]) assert.throws(() => cornerSnap(home, { time: 40, corners }), RangeError);
});
