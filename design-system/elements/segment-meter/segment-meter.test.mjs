import test from 'node:test';
import assert from 'node:assert/strict';
import { stripVTControlCharacters } from 'node:util';
import { GLYPHS, fitLine, lineWidth, paint } from '../../foundation/cells.mjs';
import { SIGNAL_COLORS } from '../../foundation/signal-colors.mjs';
import { countdown, litSegments, providerColumn, providerColumnWidth, segmentMeter, staleAge, USAGE_PROVIDERS } from './segment-meter.mjs';
const text = (lines) => lines.map((line) => paint(line, 'none'));
const minute = 60000, day = 1440 * minute;
const window = (usedPercent, resetsAt = 41 * minute) => ({ usedPercent, resetsAt });
const data = (windows, stamp = 0) => ({ windows, updatedAt: stamp, fetchedAt: stamp });

test('extension slice semantics and ghost ink at every boundary', () => {
  // footer.ts:234-237 and 1254-1267: a lit square means SOME quota remains in that 12.5% slice.
  for (const [remaining, lit] of [[0, 0], [0.000001, 1], [0.1, 1], [12.4, 1], [12.5, 1], [12.500000001, 1], [12.6, 2], [87.5, 7], [100, 8]]) {
    assert.equal(litSegments(remaining), lit);
    for (const look of Object.values(USAGE_PROVIDERS)) {
      const line = segmentMeter({ remaining, ink: look.ink });
      assert.equal(paint(line, 'none'), '■■■■■■■■');
      assert.equal(line.filter((s) => s.style.fg === look.ink).length, lit);
      assert.equal(line.filter((s) => s.style.fg === SIGNAL_COLORS.ghost).length, 8 - lit);
    }
  }
  assert.equal(litSegments(25, 4), 1);
});
test('every standalone state, unknown is not zero', () => {
  // footer.ts:1244-1254: pending/failure/none/missing slot/unknown window have distinct glyphs.
  const states = { pending: '········', failure: '????????', unknown: '????????', none: 'none    ', absent: '        ' };
  for (const [state, shown] of Object.entries(states)) assert.equal(paint(segmentMeter({ state }), 'none'), shown);
  assert.notEqual(paint(segmentMeter({ remaining: null }), 'none'), paint(segmentMeter({ remaining: 0 }), 'none'));
  assert.ok(segmentMeter({ state: 'pending' }).every((s) => s.style.fg === 'decorative'));
});
test('exact provider column snapshots: pending, failures, data, partial, unknown and none', () => {
  // footer.ts:1230-1268: 3-cell tag, gap, declared eight-cell slots and aligned text row.
  assert.deepEqual(text(providerColumn({ provider: 'codex' }, { width: 12 })), ['GPT ········', '    pending ']);
  assert.deepEqual(text(providerColumn({ provider: 'claude' }, { width: 21 })), ['CLD ········ ········', '    pending          ']);
  for (const failure of ['timeout', 'failed']) {
    const lines = providerColumn({ provider: 'claude', failure }, { width: 21 });
    assert.deepEqual(text(lines), ['CLD ???????? ????????', `    ${failure}`.padEnd(21)]);
    assert.equal(lines[1].find((s) => s.text === failure).style.fg, 'warning');
  }
  assert.deepEqual(text(providerColumn({ provider: 'claude', data: data({ '5h': window(12.5), wk: window(0, 5 * day + 15 * 60 * minute) }) }, { width: 21, now: 0 })), ['CLD ■■■■■■■■ ■■■■■■■■', '    41m      5d15h   ']);
  assert.deepEqual(text(providerColumn({ provider: 'claude', data: data({ wk: window(0) }) }, { width: 21, now: 0 })), ['CLD          ■■■■■■■■', '             41m     ']);
  assert.deepEqual(text(providerColumn({ provider: 'claude', data: data({ '5h': window(null), wk: window(100, null) }) }, { width: 21, now: 0 })), ['CLD ???????? ■■■■■■■■', '    ?        ?       ']);
  assert.deepEqual(text(providerColumn({ provider: 'claude', data: data({}) }, { width: 21, now: 0 })), ['CLD none             ', '                     ']);
});
test('fixed column widths across provider states; undeclared or long countdown are explicit exceptions', () => {
  for (const provider of Object.keys(USAGE_PROVIDERS)) {
    const expected = provider === 'codex' ? 12 : 21;
    for (const fields of [{}, { failure: 'timeout' }, { data: data({}) }, { data: data({ wk: window(null) }) }, { data: data({ wk: window(50) }), failure: 'failed' }]) {
      assert.equal(providerColumnWidth({ provider, ...fields }, { now: 16 * minute }), expected);
    }
  }
  assert.equal(providerColumnWidth({ provider: 'codex', data: data({ '5h': window(0), wk: window(0) }) }, { now: 0 }), 21);
  assert.equal(providerColumnWidth({ provider: 'codex', data: data({ wk: window(0, 100000000 * day) }) }, { now: 0 }), 14);
  for (const fields of [{}, { failure: 'failed' }, { data: data({}) }]) assert.equal(providerColumnWidth({ provider: 'codex', ...fields }, { segments: 2 }), 11);
});
test('stale tags/ages, exact threshold and last-good data retained after failure', () => {
  const input = { provider: 'claude', data: data({ '5h': window(10), wk: window(20) }) };
  assert.equal(providerColumn(input, { width: 21, now: 15 * minute })[0][0].style.fg, SIGNAL_COLORS.cld);
  const stale = providerColumn(input, { width: 21, now: 16 * minute });
  assert.equal(stale[0][0].style.fg, 'decorative');
  assert.equal(stale[0][0].style.bold, undefined);
  assert.equal(stale[1][0].style.fg, 'warning');
  assert.equal(text(stale)[1].slice(0, 3), '16m');
  const failed = providerColumn({ ...input, failure: 'timeout' }, { width: 21, now: minute });
  assert.equal(text(failed)[1].slice(0, 3), '1m ');
  assert.equal(text(failed)[0], 'CLD ■■■■■■■■ ■■■■■■■■');
  assert.equal(text(providerColumn({ ...input, failure: 'failed' }, { width: 21 }))[1][0], '?');
});
test('countdown exact format table, rounding and reset/unknown boundaries', () => {
  // footer.ts:244-249, design.md USG countdown format table.
  for (const [ms, shown] of [[1, '1m'], [41 * minute, '41m'], [60 * minute - 1, '1h00m'], [243 * minute, '4h03m'], [600 * minute, '10h'], [720 * minute, '12h'], [1440 * minute, '1d0h'], [5 * day + 15 * 60 * minute, '5d15h'], [10 * day, '10d'], [12 * day, '12d']]) assert.equal(countdown(ms, 0), shown);
  assert.equal(countdown(0, 0), 'reset');
  assert.equal(countdown(-1, 0), 'reset');
  assert.equal(countdown(null, 0), '?');
  assert.equal(countdown(1000, undefined), '?');
});
test('stale age exact format table', () => {
  // footer.ts:253-258, design.md USG stale age format table.
  for (const [ms, shown] of [[0, '0m'], [1, '1m'], [16 * minute, '16m'], [59 * minute, '59m'], [59 * minute + 1, '1h'], [5 * 60 * minute, '5h'], [day - 1, '23h'], [day, '1d'], [2 * day, '2d'], [99 * day, '99d'], [100 * day, '99+']]) assert.equal(staleAge(ms), shown);
});
test('generic caller tag/ink/declarations and no clipping below slot width', () => {
  const input = { tag: 'X\x1bY', ink: 'accent', declared: ['wk'] };
  assert.equal(text(providerColumn(input, { width: 12 }))[0], 'X?Y ········');
  const lines = text(providerColumn({ provider: 'codex' }, { width: 1 }));
  assert.equal(lines.filter((_, i) => i % 2 === 0).join(''), 'GPT········');
  assert.equal(lines.filter((_, i) => i % 2 === 1).join('').trim(), 'pending');
});
test('all widths 1–160, providers/states: exact cells, allowed glyphs, plain/color equivalence', () => {
  for (let width = 1; width <= 160; width++) {
    for (const state of ['known', 'unknown', 'pending', 'failure', 'none', 'absent']) {
      const piece = segmentMeter({ state, remaining: state === 'known' ? 12.6 : null }, { maxWidth: width });
      assert.ok(lineWidth(piece) <= width);
      assert.equal(stripVTControlCharacters(paint(fitLine(piece, width), 'truecolor')), paint(fitLine(piece, width), 'none'));
    }
    for (const provider of Object.keys(USAGE_PROVIDERS)) for (const fields of [{}, { failure: 'timeout' }, { failure: 'failed' }, { data: data({}) }, { data: data({ wk: window(0) }) }, { data: data({ '5h': window(null), wk: window(100, 0) }) }, { data: data({ wk: window(75) }), failure: 'failed' }]) {
      for (const line of providerColumn({ provider, ...fields }, { width, now: 16 * minute })) {
        const plain = paint(line, 'none');
        assert.equal(lineWidth(line), width);
        assert.ok([...plain].every((c) => /[\x20-\x7e]/.test(c) || GLYPHS.includes(c)));
        assert.equal(stripVTControlCharacters(paint(line, 'truecolor')), plain);
      }
    }
  }
});
test('invalid input never clamps or silently substitutes success', () => {
  for (const remaining of [-1, 100.1, NaN, Infinity, '5', true]) assert.throws(() => segmentMeter({ remaining }), RangeError);
  for (const segments of [0, 1.5, 1001]) assert.throws(() => segmentMeter({ remaining: 50 }, { segments }), RangeError);
  assert.throws(() => segmentMeter({ state: 'bad' }), RangeError);
  assert.throws(() => segmentMeter({ state: 'known' }), RangeError);
  assert.throws(() => segmentMeter({ ink: 'bad' }), TypeError);
  assert.throws(() => segmentMeter({ remaining: 0 }, { maxWidth: -1 }), RangeError);
  for (const provider of ['bad', '__proto__', 'constructor']) assert.throws(() => providerColumn({ provider }, { width: 20 }), RangeError);
  assert.throws(() => providerColumn({ provider: 'claude', failure: 'raw error' }, { width: 20 }), RangeError);
  for (const usedPercent of [-1, 101, NaN, Infinity, '50', undefined]) assert.throws(() => providerColumn({ provider: 'codex', data: data({ wk: window(usedPercent) }) }, { width: 20 }), RangeError);
  assert.throws(() => providerColumn({ provider: 'codex', data: {} }, { width: 20 }), TypeError);
  assert.throws(() => providerColumn({ provider: 'codex', data: data({ wk: window(0) }, 10) }, { width: 20, now: 0 }), RangeError);
  assert.throws(() => providerColumn({ tag: 'LONG', ink: 'accent', declared: ['wk'] }, { width: 20 }), RangeError);
  assert.throws(() => providerColumn({ tag: 'TAG', ink: 'accent', declared: ['wk', 'wk'] }, { width: 20 }), RangeError);
  for (const n of [NaN, Infinity, '1']) { assert.throws(() => countdown(n, 0), RangeError); assert.throws(() => countdown(1, n), RangeError); }
  assert.throws(() => countdown(1e308, -1e308), RangeError);
  for (const n of [-1, NaN, Infinity, '1']) assert.throws(() => staleAge(n), RangeError);
});
