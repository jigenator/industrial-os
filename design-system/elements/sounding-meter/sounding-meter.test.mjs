import test from 'node:test';
import assert from 'node:assert/strict';
import { lineWidth, paint, span, textSlot } from '../../foundation/cells.mjs';
import { soundingMeter } from './sounding-meter.mjs';

test('sounding-meter bounds every state at widths 1–160 and preserves plain/color geometry', () => {
  for(let width=1;width<=160;width++) for(const line of [soundingMeter({}, {maxWidth:width})]) {
    assert.ok(lineWidth(line)<=width);
    assert.equal(paint(line,'truecolor').replace(/\x1b\[[0-9;]*m/g,''),paint(line,'none'));
    for(const item of line) assert.equal(typeof item.text,'string');
  }
});
test('sounding-meter rests at the left, clipping decoration only', () => {
  assert.equal(paint(soundingMeter(),'none'),'⡧⠤⠤⠤⠤⠤');
  assert.deepEqual(soundingMeter({}, {maxWidth:0}),[]);
  assert.throws(()=>soundingMeter({}, {maxWidth:1.5}),RangeError);
});
