import test from 'node:test';
import assert from 'node:assert/strict';
import { span } from '../foundation/cells.mjs';
import { bankLevels, bankOf, bankSchedule, bankSwitch, bankSwitchDuration, BANK_SWITCH_DEFAULTS } from './bank-switch.mjs';

test('four banks, 30 ms apart, 40 ms each: 130 ms, left to right', () => {
  assert.deepEqual(BANK_SWITCH_DEFAULTS, { banks: 4, stagger: 30, fade: 40, from: 0, to: 1 });
  assert.ok(Object.isFrozen(BANK_SWITCH_DEFAULTS));
  assert.equal(bankSwitchDuration(), 130);
  assert.deepEqual(bankLevels({ time: 0 }), [0, 0, 0, 0]);
  assert.deepEqual(bankLevels({ time: 20 }), [0.5, 0, 0, 0]);
  assert.deepEqual(bankLevels({ time: 50 }), [1, 0.5, 0, 0]);
  assert.deepEqual(bankLevels({ time: 130 }), [1, 1, 1, 1]);
  assert.deepEqual(bankLevels({ time: 0, animate: false }), [1, 1, 1, 1]);
  // Interrupted: a second change restarts every bank from where it was.
  const mid = bankLevels({ time: 50 });
  assert.deepEqual(bankLevels({ time: 0, from: mid, to: 0 }), mid);
  assert.deepEqual(bankLevels({ time: 20, from: mid, to: 0 }), [0.5, 0.5, 0, 0]);
  assert.deepEqual(bankLevels({ time: 50, from: mid, to: 0 }), [0, 0.25, 0, 0]);
  assert.deepEqual(bankLevels({ time: 130, from: mid, to: 0 }), [0, 0, 0, 0]);
});

test('banks split the columns as the mockup did, and the schedule covers each column once', () => {
  for (const width of [1, 3, 4, 48, 64, 99, 199]) {
    const schedule = bankSchedule(width);
    assert.equal(schedule.reduce((n, b) => n + b.cols, 0), width);
    for (const b of schedule) for (let x = b.left; x < b.left + b.cols; x++) assert.equal(bankOf(x, width), b.bank);
    for (let x = 0; x < width; x++) assert.equal(bankOf(x, width), Math.min(3, Math.floor((x * 4) / width)));
    assert.deepEqual(schedule.map((b) => [b.delay, b.duration]), schedule.map((b) => [b.bank * 30, 40]));
  }
});

test('bankSwitch composes the two blocks per bank: colors mixed, the nearer glyph shown', () => {
  const dark = [[span('aaaaaaaa', { fg: '#000000', bg: '#000000' })]], lit = [[span('bbbbbbbb', { fg: '#ffffff', bg: '#ffffff' })]];
  const text = (lines) => lines[0].map((s) => s.text).join('');
  assert.equal(text(bankSwitch(dark, lit, { time: 0 })), 'aaaaaaaa');
  assert.equal(text(bankSwitch(dark, lit, { time: 50 })), 'bbbbaaaa');
  assert.equal(text(bankSwitch(dark, lit, { time: 130 })), 'bbbbbbbb');
  assert.deepEqual(bankSwitch(dark, lit, { time: 20 })[0][0].style, { fg: '#808080', bg: '#808080' });
  assert.throws(() => bankSwitch(dark, [[span('b')]], { time: 0 }), RangeError);
  assert.throws(() => bankLevels({ time: 0, from: [0, 1] }), RangeError);
  assert.throws(() => bankLevels({ time: -1 }), RangeError);
  assert.throws(() => bankSchedule(0), RangeError);
});
