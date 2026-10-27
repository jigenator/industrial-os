import test from 'node:test';
import assert from 'node:assert/strict';
import { paint, span } from '../../foundation/cells.mjs';
import { BOARD_INKS } from '../../foundation/signal-colors.mjs';
import { scrollRail } from './scroll-rail.mjs';

const column = (lines) => lines.map((l) => paint(l, 'none')).join('');

test('a scroll rail is a faint track with a heavy thumb sized to the visible share', () => {
  const rail = scrollRail({ total: 40, visible: 10, offset: 0 });
  assert.equal(column(rail), '┃┃┃│││││││');
  assert.deepEqual(rail[0], [span('┃', { fg: 'primary' })]);
  assert.deepEqual(rail[9], [span('│', { fg: BOARD_INKS.faint })]);
  assert.equal(column(scrollRail({ total: 40, visible: 10, offset: 30 })), '│││││││┃┃┃');
  assert.equal(column(scrollRail({ total: 20, visible: 10, offset: 5 })), '│││┃┃┃┃┃││');
});

test('nothing to scroll draws no rail; the thumb is never shorter than two cells', () => {
  assert.deepEqual(scrollRail({ total: 10, visible: 10, offset: 0 }), []);
  assert.deepEqual(scrollRail({ total: 0, visible: 10, offset: 0 }), []);
  for (let total = 11; total <= 400; total += 7) for (let offset = 0; offset <= total - 10; offset += 3) {
    const thumb = [...column(scrollRail({ total, visible: 10, offset }))].filter((c) => c === '┃').length;
    assert.ok(thumb >= 2 && thumb <= 10, `${total}/${offset}`);
  }
});

test('invalid rails throw', () => {
  assert.throws(() => scrollRail({ total: 40, visible: 0, offset: 0 }), RangeError);
  assert.throws(() => scrollRail({ total: 40, visible: 10, offset: 31 }), RangeError);
  assert.throws(() => scrollRail({ total: 40.5, visible: 10, offset: 0 }), RangeError);
});
