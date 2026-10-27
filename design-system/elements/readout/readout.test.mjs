import test from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS, lineWidth, paint, span } from '../../foundation/cells.mjs';
import { BOARD_INKS } from '../../foundation/signal-colors.mjs';
import { numeralLines, textGrid } from '../pixel-numeral/pixel-numeral.mjs';
import { phaseSteps, readoutBlock, readoutLine, slotStrip, splitBar } from './readout.mjs';

const plain = (line) => paint(line, 'none');
const plainLines = (lines) => lines.map(plain);
const ACTIVE = {
  number: 1, label: 'ACTIVE RUNS', value: '04', ink: 'primary',
  unit: [{ text: '/', ink: 'decorative' }, { text: '12', ink: 'secondary' }, { text: 'SLOTS', ink: 'decorative' }],
};

test('a readout block is a numbered label, a short heavy rule, a tall numeral with its unit, and a sub-line', () => {
  const lines = readoutBlock({ ...ACTIVE, sub: { text: 'QUEUE · EVERY 2M', ink: 'decorative' } }, { width: 27, measure: (t) => [...t].length });
  assert.deepEqual(plainLines(lines), [
    '01 ACTIVE RUNS             ',
    '━━━────────────────────────',
    '▄▀▀▄ █  █                  ',
    '█  █ █  █                  ',
    '█  █ ▀▀▀█                  ',
    '█  █    █                  ',
    ' ▀▀     ▀  / 12 SLOTS      ',
    'QUEUE · EVERY 2M           ',
  ]);
  assert.deepEqual(lines[0].slice(0, 3), [span('01', { fg: 'decorative' }), span(' '), span('ACTIVE RUNS', { fg: 'primary', bold: true })]);
  assert.deepEqual(lines[1].slice(0, 2), [span('━━━', { fg: 'primary', bg: 'default' }), span('─'.repeat(24), { fg: BOARD_INKS.faint, bg: 'default' })]);
  assert.deepEqual(lines.slice(2, 7).map((l) => l.slice(0, 9)), numeralLines(textGrid('04', { ink: 'primary', face: 'tall' }), { width: 9 }).map((l) => l.slice(0, 9)));
  const unit = lines[6].filter((s) => s.text.trim());
  assert.deepEqual(unit.slice(-3), [span('/', { fg: 'decorative' }), span('12', { fg: 'secondary', bold: true }), span('SLOTS', { fg: 'decorative' })]);
});

test('a caller strip replaces the sub-line; an unknown value is a grey ?, never zero', () => {
  const lines = readoutBlock({ ...ACTIVE, strip: slotStrip({ busy: ['#95b8d1'], slots: 3 }) }, { width: 27 });
  assert.equal(plain(lines[7]), '█▁▁' + ' '.repeat(24));
  const unknown = readoutBlock({ number: 4, label: 'ALERTS', value: '?', ink: 'structural' }, { width: 27 });
  assert.equal(plain(unknown[2]).trim(), '▄▀▀▄');
  assert.equal(unknown[2][0].style.fg, 'structural');
});

test('a value too wide for the block falls back to its exact text, and every width is exact', () => {
  assert.equal(plain(readoutBlock({ ...ACTIVE, value: '--:--' }, { width: 10 })[2]), '--:--     ');
  // The value is drawn in the tall face: a character outside TALL_FONT is a caller error, even where the text fallback would fit.
  for (const value of ['1.5', 'A', '12%', '']) assert.throws(() => readoutBlock({ ...ACTIVE, value }, { width: 27 }), RangeError, value);
  for (let width = 1; width <= 160; width++) {
    const lines = readoutBlock({ ...ACTIVE, sub: { text: 'NOT SCHEDULED', ink: 'decorative' } }, { width });
    assert.equal(lines.length, 8);
    for (const line of lines) {
      assert.equal(lineWidth(line), width);
      for (const ch of plain(line)) assert.ok(/[\x20-\x7e]/.test(ch) || GLYPHS.includes(ch), ch);
    }
  }
});

test('the one-line form keeps the parts in order with a dot between readouts, cut at the width', () => {
  const readouts = [
    [{ text: 'ACTIVE', ink: 'decorative' }, { text: '04/12', ink: 'primary' }],
    [{ text: '3H', ink: 'decorative' }, { text: '06', ink: 'primary' }],
  ];
  const line = readoutLine(readouts, { width: 30 });
  assert.equal(plain(line), 'ACTIVE 04/12  ·  3H 06        ');
  assert.deepEqual(line.slice(0, 3), [span('ACTIVE', { fg: 'decorative' }), span(' '), span('04/12', { fg: 'primary', bold: true })]);
  assert.deepEqual(line.find((s) => s.text === '·'), span('·', { fg: 'structural' }));
  assert.equal(plain(readoutLine(readouts, { width: 16 })), 'ACTIVE 04/12  · ');
  assert.equal(plain(readoutLine(readouts, { width: 10 })), 'ACTIVE 04…');
  for (let width = 1; width <= 80; width++) assert.equal(lineWidth(readoutLine(readouts, { width })), width);
});

test('a slot strip shows each busy slot in its color, then free slots as a floor', () => {
  const strip = slotStrip({ busy: ['#95b8d1', '#ff15bd'], slots: 5 });
  assert.equal(plain(strip), '██▁▁▁');
  assert.deepEqual(strip.slice(0, 3), [span('█', { fg: '#95b8d1' }), span('█', { fg: '#ff15bd' }), span('▁▁▁', { fg: 'structural' })]);
  assert.equal(plain(slotStrip({ busy: ['#95b8d1', '#ff15bd'], slots: 5, reporting: false })), '▒▒▁▁▁');
  assert.deepEqual(slotStrip({ busy: ['#95b8d1'], slots: 2, reporting: false })[0].style, { fg: 'decorative' });
  assert.equal(plain(slotStrip({ busy: ['#95b8d1', '#ff15bd'], slots: 5 }, { maxWidth: 3 })), '██▁');
  assert.equal(plain(slotStrip({ busy: ['#95b8d1', '#ff15bd'], slots: null })), '██');
  assert.equal(plain(slotStrip({ busy: [], slots: 0 })), '');
  assert.throws(() => slotStrip({ busy: ['acid'], slots: 1 }), TypeError);
  assert.throws(() => slotStrip({ busy: [], slots: -1 }), RangeError);
});

test('a split bar divides its width between ok, warning and failed by rounded share', () => {
  const bar = splitBar({ ok: 3, warn: 1, fail: 1 }, { width: 10 });
  assert.equal(plain(bar), '▀'.repeat(10));
  assert.deepEqual(bar, [span('▀▀▀▀▀▀', { fg: 'primary' }), span('▀▀', { fg: 'warning' }), span('▀▀', { fg: 'critical' })]);
  assert.deepEqual(splitBar({ ok: 0, warn: 0, fail: 0 }, { width: 4 }), [span('▀▀▀▀', { fg: BOARD_INKS.faint })]);
  assert.throws(() => splitBar({ ok: -1, warn: 0, fail: 0 }, { width: 4 }), RangeError);
});

test('phase steps: done and the lit current step take the ink, later steps stay faint', () => {
  const steps = [{ label: 'CLAIM', detail: '10:00:00' }, { label: 'VERIFY', detail: '10:00:20' }, { label: 'RUN', detail: 'IN PROGRESS' }];
  const lines = phaseSteps({ steps, current: 1, ink: '#95b8d1' }, { width: 32 });
  assert.deepEqual(plainLines(lines), [
    '▄▄▄▄▄▄▄▄▄▄ ▄▄▄▄▄▄▄▄▄▄ ▄▄▄▄▄▄▄▄▄▄',
    'CLAIM      VERIFY     RUN       ',
    '10:00:00   10:00:20   IN PROGRE…',
  ]);
  assert.deepEqual(lines[0].filter((s) => s.text.trim()).map((s) => s.style.fg), ['#95b8d1', '#95b8d1', BOARD_INKS.faint]);
  assert.deepEqual(lines[1].filter((s) => s.text.trim()).map((s) => s.style), [{ fg: 'primary' }, { fg: 'primary', bold: true }, { fg: 'decorative' }]);
  const dim = phaseSteps({ steps, current: 1, ink: '#95b8d1', lit: false }, { width: 32 });
  assert.deepEqual(dim[0].filter((s) => s.text.trim()).map((s) => s.style.fg), ['#95b8d1', BOARD_INKS.faint, BOARD_INKS.faint]);
  for (let width = 1; width <= 80; width++) for (const line of phaseSteps({ steps, current: 2, ink: 'accent' }, { width })) assert.equal(lineWidth(line), width);
  assert.throws(() => phaseSteps({ steps, current: 3, ink: 'accent' }, { width: 32 }), RangeError);
});

test('ellipsis always marks a part cut to one cell', () => {
  const parts = [[{ text: 'ACTIVE', ink: 'decorative' }, { text: '04/12', ink: 'primary' }], [{ text: 'POLL', ink: 'decorative' }]];
  assert.equal(plain(readoutLine(parts, { width: 18 })), 'ACTIVE 04/12  ·  P');
  assert.equal(plain(readoutLine(parts, { width: 18, ellipsis: 'always' })), 'ACTIVE 04/12  ·  …');
  const block = (ellipsis) => readoutBlock({ number: 1, label: 'ON', value: '05', ink: 'primary', unit: [{ text: 'SCHEDULES', ink: 'decorative' }] }, { width: 12, ellipsis });
  assert.equal(plain(block(undefined)[6]), ' ▀▀  ▀▀▀   S');
  assert.equal(plain(block('always')[6]), ' ▀▀  ▀▀▀   …');
  assert.throws(() => readoutLine(parts, { width: 18, ellipsis: 'never' }), RangeError);
});
