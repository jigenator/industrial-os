import test from 'node:test';
import assert from 'node:assert/strict';
import { lineWidth, paint, span } from '../foundation/cells.mjs';
import { soundingMeter } from '../elements/sounding-meter/sounding-meter.mjs';
import { soundingSweep } from './sounding-sweep.mjs';
const plain = lines => lines.map(line => paint(line,'none'));
test('sounding-sweep has a 40-ms dot-column grid and 880-ms round trip', () => {
  const lines=[soundingMeter()];
  assert.deepEqual(plain(soundingSweep(lines,{time:0})),['⡧⠤⠤⠤⠤⠤']);
  assert.deepEqual(plain(soundingSweep(lines,{time:40})),['⣿⠤⠤⠤⠤⠤']);
  assert.equal(plain(soundingSweep(lines,{time:80}))[0][1],'⡧');
  assert.deepEqual(soundingSweep(lines,{time:920}),soundingSweep(lines,{time:40}));
  assert.deepEqual(soundingSweep(lines,{animate:false}),lines);
});
test('sounding-sweep is bounded, immutable, deterministic, state protected', () => {
  for(let width=0;width<=160;width++) {
    const lines=[[...soundingMeter({}, {maxWidth:width}),span('▲ failure',{fg:'warning'})]];
    const before=structuredClone(lines);
    for(const time of [0,39,40,440,840,880,1e9]) {
      const out=soundingSweep(lines,{time});
      assert.deepEqual(out,soundingSweep(lines,{time}));
      assert.equal(lineWidth(out[0]),lineWidth(lines[0]));
      assert.ok(plain(out)[0].endsWith('▲ failure'));
    }
    assert.deepEqual(lines,before);
  }
  assert.throws(()=>soundingSweep([], {time:-1}),RangeError);
  assert.throws(()=>soundingSweep([], {animate:false,region:{left:-1}}),RangeError);
  assert.throws(()=>soundingSweep([], {time:0,tick:80}),TypeError);
});
