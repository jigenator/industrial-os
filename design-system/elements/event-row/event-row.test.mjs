import test from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS, lineWidth, paint, span } from '../../foundation/cells.mjs';
import { BOARD_INKS } from '../../foundation/signal-colors.mjs';
import { eventRow } from './event-row.mjs';

const plain = (line) => paint(line, 'none');

test('a log row is time, a state cell, a five-cell verb, the reference and the subject', () => {
  const row = eventRow({ time: '09:41', tone: 'crit', verb: 'FAIL', ref: '1234', text: 'IMPLEMENT' }, { width: 35 });
  assert.equal(plain(row), '09:41 █ FAIL  1234 IMPLEMENT' + ' '.repeat(7));
  assert.deepEqual(row.slice(0, 7), [
    span('09:41', { fg: 'decorative' }), span(' '), span('█', { fg: 'critical' }), span(' '),
    span('FAIL ', { fg: 'critical', bold: true }), span(' '), span('1234', { fg: 'primary' }),
  ]);
  assert.deepEqual(row[8], span('IMPLEMENT', { fg: 'decorative' }));
});

test('only warning and failure verbs take their ink and weight; a row without a reference starts its subject at once', () => {
  const claim = eventRow({ time: '09:41', tone: 'live', verb: 'CLAIM', ref: '7', text: 'DEMO' }, { width: 35 });
  assert.deepEqual(claim[2], span('█', { fg: 'accent' }));
  assert.deepEqual(claim[4], span('CLAIM', { fg: 'secondary' }));
  const lost = eventRow({ time: '09:41', tone: 'warn', verb: 'LOST', text: 'RUNNER STOPPED' }, { width: 35 });
  assert.equal(plain(lost), '09:41 █ LOST  RUNNER STOPPED' + ' '.repeat(7));
  assert.deepEqual(eventRow({ time: '09:41', tone: 'off', verb: 'STOP' }, { width: 20 })[2], span('█', { fg: BOARD_INKS.faint }));
});

test('the detail form is a seconds clock, a bold verb in its state ink and the reference', () => {
  const row = eventRow({ time: '09:41:07', tone: 'live', verb: 'CLAIM', ref: '1234' }, { width: 30, form: 'detail' });
  assert.equal(plain(row), '09:41:07  CLAIM 1234          ');
  assert.deepEqual(row.filter((s) => s.text.trim()), [span('09:41:07', { fg: 'decorative' }), span('CLAIM', { fg: 'accent', bold: true }), span('1234', { fg: 'secondary' })]);
  for (const [tone, fg] of [['crit', 'critical'], ['warn', 'warning'], ['ok', 'secondary'], ['idle', 'secondary']]) {
    assert.equal(eventRow({ time: '09:41:07', tone, verb: 'DONE' }, { width: 30, form: 'detail' }).find((s) => s.text === 'DONE').style.fg, fg);
  }
});

test('narrow rows cut the subject first and keep every width exact', () => {
  assert.equal(plain(eventRow({ time: '09:41', tone: 'ok', verb: 'OK', text: 'QUOTA-REFRESH' }, { width: 20 })), '09:41 █ OK    QUOTA…');
  for (let width = 1; width <= 120; width++) for (const form of ['log', 'detail']) {
    const row = eventRow({ time: form === 'log' ? '09:41' : '09:41:07', tone: 'crit', verb: 'FAIL', ref: 'DEMO-1234', text: 'A LONG SUBJECT LINE' }, { width, form });
    assert.equal(lineWidth(row), width);
    for (const ch of plain(row)) assert.ok(/[\x20-\x7e]/.test(ch) || GLYPHS.includes(ch), ch);
  }
});

test('invalid rows throw', () => {
  assert.throws(() => eventRow({ time: '09:41', tone: 'bad', verb: 'X' }, { width: 20 }), RangeError);
  assert.throws(() => eventRow({ time: '09:41', tone: 'ok', verb: 'X' }, { width: 20, form: 'table' }), RangeError);
  assert.throws(() => eventRow({ time: 941, tone: 'ok', verb: 'X' }, { width: 20 }), TypeError);
  assert.throws(() => eventRow({ time: '09:41', tone: 'ok', verb: 'X' }, { width: 0 }), RangeError);
});

test('ellipsis always marks a subject cut to one cell', () => {
  const event = { time: '09:41', tone: 'ok', verb: 'OK', ref: 'DEMO-1', text: 'QUOTA' };
  assert.equal(plain(eventRow(event, { width: 22 })), '09:41 █ OK    DEMO-1 Q');
  assert.equal(plain(eventRow(event, { width: 22, ellipsis: 'always' })), '09:41 █ OK    DEMO-1 …');
});
