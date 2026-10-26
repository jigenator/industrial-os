import test from 'node:test';
import assert from 'node:assert/strict';
import { lineWidth, paint, span, textSlot } from '../../foundation/cells.mjs';
import { scopeMeter } from './scope-meter.mjs';

test('scope-meter bounds every state at widths 1–160 and preserves plain/color geometry', () => {
  for(let width=1;width<=160;width++) for(const line of ['connected','reconnecting','lost'].map(state=>scopeMeter({state},{maxWidth:width}))) {
    assert.ok(lineWidth(line)<=width);
    assert.equal(paint(line,'truecolor').replace(/\x1b\[[0-9;]*m/g,''),paint(line,'none'));
    for(const item of line) assert.equal(typeof item.text,'string');
  }
});
test('scope-meter distinguishes connection states without invented numeric readings', () => {
  assert.equal(paint(scopeMeter(),'none'),'────');
  assert.equal(paint(scopeMeter({state:'lost'}),'none'),'✕⣀⣀⣀');
  assert.throws(()=>scopeMeter({state:'good'}),RangeError);
  assert.throws(()=>scopeMeter({}, {maxWidth:NaN}),RangeError);
});
