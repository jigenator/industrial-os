import test from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS, lineWidth, paint } from '../../foundation/cells.mjs';
import { BOARD_INKS } from '../../foundation/signal-colors.mjs';
import { sectionHead } from './section-head.mjs';

const plain = (input, options) => paint(sectionHead(input, options), 'none');

test('a section head is a square mark, a bold title, a count and a faint rule to the edge', () => {
  const line = sectionHead({ title: 'PIPELINES', count: '09' }, { width: 30 });
  assert.equal(paint(line, 'none'), '■ PIPELINES  09  ─────────────');
  assert.deepEqual(line, [
    { text: '■', style: { fg: 'primary' } }, { text: ' ', style: {} },
    { text: 'PIPELINES', style: { fg: 'primary', bold: true } }, { text: '  ', style: {} },
    { text: '09', style: { fg: 'decorative' } }, { text: '  ', style: {} },
    { text: '─────────────', style: { fg: BOARD_INKS.faint } },
  ]);
});

test('a group head takes its state color on the mark; a head without a count has no count gap', () => {
  assert.deepEqual(sectionHead({ title: 'RUNNING', count: '04', mark: 'accent' }, { width: 20 })[0], { text: '■', style: { fg: 'accent' } });
  assert.equal(plain({ title: 'RECENT RUNS' }, { width: 20 }), '■ RECENT RUNS  ─────');
  assert.equal(plain({ title: 'AUTOMATIONS' }, { width: 13 }), '■ AUTOMATIONS');
  assert.equal(plain({ title: 'AUTOMATIONS' }, { width: 15 }), '■ AUTOMATIONS  ');
});

test('narrow heads keep the mark, cut the title with an ellipsis and drop a count that does not fit', () => {
  assert.equal(plain({ title: 'EVENT LOG', count: 'PIPELINES' }, { width: 16 }), '■ EVENT LOG  ───');
  assert.equal(plain({ title: 'EVENT LOG', count: '12' }, { width: 8 }), '■ EVENT…');
  assert.equal(plain({ title: 'EVENT LOG' }, { width: 1 }), '■');
  for (let width = 1; width <= 160; width++) for (const input of [{ title: 'SCHEDULES', count: '07' }, { title: '' }, { title: 'A VERY LONG SECTION TITLE', count: '123' }]) {
    const line = sectionHead(input, { width });
    assert.equal(lineWidth(line), width);
    assert.equal(paint(line, 'truecolor').replace(/\x1b\[[0-9;]*m/g, ''), paint(line, 'none'));
    for (const ch of paint(line, 'none')) assert.ok(/[\x20-\x7e]/.test(ch) || GLYPHS.includes(ch), ch);
  }
});

test('measured titles keep the caller text; plain strings stay printable ASCII', () => {
  const measure = (t) => [...t].length;
  assert.equal(plain({ title: 'FINISHED · 3H' }, { width: 16, measure }), '■ FINISHED · 3H ');
  assert.equal(plain({ title: 'FINISHED · 3H' }, { width: 16 }), '■ FINISHED ? 3H ');
});

test('invalid heads throw', () => {
  assert.throws(() => sectionHead({ title: 'X' }, { width: 0 }), RangeError);
  assert.throws(() => sectionHead({ title: 3 }, { width: 10 }), TypeError);
  assert.throws(() => sectionHead({ title: 'X', count: 3 }, { width: 10 }), TypeError);
  assert.throws(() => sectionHead({ title: 'X', mark: 'acid' }, { width: 10 }), TypeError);
  assert.throws(() => sectionHead(null, { width: 10 }), TypeError);
});

test('ellipsis always marks a title cut to one cell', () => {
  assert.equal(paint(sectionHead({ title: 'EVENTS' }, { width: 3 }), 'none'), '■ E');
  assert.equal(paint(sectionHead({ title: 'EVENTS' }, { width: 3, ellipsis: 'always' }), 'none'), '■ …');
});
