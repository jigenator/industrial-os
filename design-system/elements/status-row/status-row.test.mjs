import test from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS, lineWidth, paint } from '../../foundation/cells.mjs';
import { STATUS_STATES, statusRow } from './status-row.mjs';

const text = (lines) => lines.map((l) => paint(l, 'none'));
const allowed = (s) => [...s].every((c) => (c >= ' ' && c <= '~') || GLYPHS.includes(c));

test('label, value, and state columns align across every state', () => {
  const lines = Object.keys(STATUS_STATES).map((status) => text(statusRow({ label: status.toUpperCase(), value: 'specimen', status }, { width: 40 }))[0]);
  assert.deepEqual(lines, [
    'NEUTRAL    specimen              ○ INFO ',
    'SUCCESS    specimen              ● OK   ',
    'WARNING    specimen              ▲ WARN ',
    'ERROR      specimen              ✕ ERROR',
    'UNAVAILAB… specimen              ? N/A  ',
  ]);
});

test('states differ by marker and word, not only by color', () => {
  const words = Object.values(STATUS_STATES).map((s) => `${s.marker} ${s.word}`);
  assert.equal(new Set(words).size, words.length);
  assert.equal(new Set(Object.values(STATUS_STATES).map((s) => s.marker)).size, words.length);
});

test('a missing value renders -- rather than an invented one', () => {
  assert.match(text(statusRow({ label: 'LINK', value: null, status: 'unavailable' }, { width: 40 }))[0], /^LINK {7}-- +\? N\/A/);
});

test('narrow rows stack the value under label and state', () => {
  assert.deepEqual(text(statusRow({ label: 'DOOR', value: 'closed', status: 'success' }, { width: 20 })), ['DOOR         ● OK   ', '  closed            ']);
});

test('every width from 1 to 160 stays within budget', () => {
  for (let width = 1; width <= 160; width++) {
    for (const status of Object.keys(STATUS_STATES)) {
      for (const line of statusRow({ label: 'A LONG STATUS LABEL', value: 'a long specimen value text', status }, { width })) {
        assert.equal(lineWidth(line), width);
        assert.ok(allowed(paint(line, 'none')));
      }
    }
  }
});

test('invalid states and injected text are handled', () => {
  for (const status of ['online', 'toString', '__proto__', 'constructor']) {
    assert.throws(() => statusRow({ label: 'X', value: 'v', status }, { width: 40 }), RangeError);
  }
  assert.throws(() => statusRow({ label: 'X', value: 3, status: 'success' }, { width: 40 }), TypeError);
  assert.throws(() => statusRow({ label: 'X', value: 'v', status: 'success' }, { width: 1.5 }), RangeError);
  const [line] = text(statusRow({ label: 'X', value: 'ok\x1b[8m', status: 'success' }, { width: 40 }));
  assert.doesNotMatch(line, /\x1b/);
});
