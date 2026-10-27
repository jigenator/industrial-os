import test from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS, lineWidth, paint, span } from '../../foundation/cells.mjs';
import { BOARD_INKS } from '../../foundation/signal-colors.mjs';
import { crossNow, laneAxis, laneRun, laneScale, laneTrack } from './time-lane.mjs';

const H = 3_600_000;
const AXIS = { past: 3 * H, future: H };
const plain = (line) => paint(line, 'none');
const styleAt = (line, x) => { for (const s of line) { const n = [...s.text].length; if (x < n) return s.style; x -= n; } };

test('the scale maps time to whole columns, rounding to nearest, with NOW where the past ends', () => {
  const s = laneScale(AXIS, { width: 41 });
  assert.equal(s.now, 30);
  assert.deepEqual([-3, -2, -1, 0, 1].map((h) => s.col(h * H)), [0, 10, 20, 30, 40]);
  assert.equal(s.col(-0.25 * H), 28); // 27.5 rounds up
  assert.equal(laneScale(AXIS, { width: 1 }).now, 0);
  assert.throws(() => laneScale({ past: 0, future: H }, { width: 10 }), RangeError);
  assert.throws(() => laneScale(AXIS, { width: 0 }), RangeError);
  assert.throws(() => laneScale(AXIS, { width: 10 }).col(Number.NaN), RangeError);
});

test('the axis ruler has hour ticks, quarter marks, an acid NOW junction and hour labels as placed pieces', () => {
  const { ruler, labels } = laneAxis(AXIS, { width: 41 });
  assert.equal(plain(ruler), '┬──┴─┴──┴─┬──┴─┴──┴─┬──┴─┴──┴─┼──┴─┴──┴─┬');
  assert.deepEqual(styleAt(ruler, 1), { fg: 'structural' });
  assert.deepEqual(styleAt(ruler, 3), { fg: BOARD_INKS.faint });
  assert.deepEqual(styleAt(ruler, 10), { fg: 'structural' });
  assert.deepEqual(styleAt(ruler, 30), { fg: 'accent' });
  assert.deepEqual(labels.map((l) => [l.at, plain(l.line), l.line[0].style]), [
    [-1, '-3H', { fg: 'decorative' }], [9, '-2H', { fg: 'decorative' }], [19, '-1H', { fg: 'decorative' }],
    [29, 'NOW', { fg: 'primary', bold: true }], [38, '+1H', { fg: 'decorative' }],
  ]);
  for (let width = 1; width <= 160; width++) {
    const axis = laneAxis(AXIS, { width });
    assert.equal(lineWidth(axis.ruler), width);
    for (const l of axis.labels) assert.ok(l.at >= -2 && l.at + lineWidth(l.line) <= width, `${width}: ${l.at}`);
  }
});

test('a lane track is solid in the past, dotted in the future and dashed or hatched since the source went quiet', () => {
  assert.equal(plain(laneTrack({ now: 8 }, { width: 12 })), '───────── · ');
  assert.equal(plain(laneTrack({ now: 8 }, { width: 12, origin: 1 })), '─────────· ·');
  assert.equal(plain(laneTrack({ now: 8, since: 4 }, { width: 12 })), '─────┄┄┄┄ · ');
  const hatched = laneTrack({ now: 8, since: 4, after: 'hatched' }, { width: 12 });
  assert.equal(plain(hatched), '─────╱╱╱╱ · ');
  assert.deepEqual(styleAt(hatched, 5), { fg: BOARD_INKS.hatch });
  assert.deepEqual(styleAt(hatched, 0), { fg: BOARD_INKS.faint });
  assert.deepEqual(styleAt(hatched, 9), {});
  assert.deepEqual(styleAt(hatched, 10), { fg: BOARD_INKS.faint });
  assert.throws(() => laneTrack({ now: 1, after: 'dotted' }, { width: 4 }), RangeError);
  assert.throws(() => laneTrack({ now: 1.5 }, { width: 4 }), RangeError);
});

test('a finished run is a grey bar, ending in its miss mark', () => {
  const failed = laneRun({ from: 2, to: 5, outcome: 'failed' }, { width: 12 });
  assert.equal(failed.span, null);
  assert.deepEqual(failed.pieces.map((p) => [p.at, plain(p.line)]), [[2, '   ✕']]);
  assert.deepEqual(failed.pieces[0].line[0].style, { bg: BOARD_INKS.base });
  assert.deepEqual(failed.pieces[0].line.at(-1).style, { fg: 'critical', bg: BOARD_INKS.base, bold: true });
  assert.equal(plain(laneRun({ from: -4, to: 1, outcome: 'succeeded' }, { width: 12 }).pieces[0].line), '  ');
  assert.equal(laneRun({ from: -4, to: -1, outcome: 'failed' }, { width: 12 }), null);
});

test('a live run is hatched until verified, solid after, labelled on its fill and headed at NOW', () => {
  const run = laneRun({ from: 3, to: 9, verified: 5, live: true, label: '42', fill: '#95b8d1', ink: 'field', head: true, lit: true }, { width: 12 });
  assert.deepEqual(run.span, [3, 9]);
  assert.deepEqual(run.pieces.map((p) => [p.at, plain(p.line)]), [[3, '▒▒    '], [5, '42'], [9, ' ']]);
  assert.deepEqual(run.pieces[0].line[0].style, { fg: '#95b8d1', bg: 'field' });
  assert.deepEqual(run.pieces[0].line.at(-1).style, { bg: '#95b8d1' });
  assert.deepEqual(run.pieces[1].line[0].style, { fg: 'field', bg: '#95b8d1', bold: true });
  assert.deepEqual(run.pieces[2].line[0].style, { bg: 'accent' });
  assert.deepEqual(laneRun({ from: 3, to: 9, live: true, label: '42', fill: '#95b8d1', ink: 'field', head: true, lit: false }, { width: 12 }).pieces.at(-1).line[0].style, { bg: '#95b8d1' });
});

test('a short live bar puts its label to the left; verifying hatches all of it; last known is grey with no head', () => {
  const short = laneRun({ from: 7, to: 9, live: true, label: '1234', fill: '#95b8d1', ink: 'field', head: true }, { width: 12 });
  assert.deepEqual(short.pieces.map((p) => [p.at, plain(p.line)]), [[7, '  '], [2, '1234'], [9, ' ']]);
  assert.deepEqual(short.pieces[1].line[0].style, { fg: 'secondary', bold: true });
  const verifying = laneRun({ from: 2, to: 9, verifying: true, live: true, label: '7', fill: '#95b8d1', ink: 'field', head: true }, { width: 12 });
  assert.equal(plain(verifying.pieces[0].line), '▒▒▒▒▒▒▒');
  const known = laneRun({ from: 2, to: 9, live: true, label: '7', fill: 'decorative', ink: 'field' }, { width: 12 });
  assert.deepEqual(known.span, [2, 9]);
  assert.deepEqual(known.pieces.map((p) => [p.at, plain(p.line)]), [[2, '        '], [2, '7']]);
});

test('NOW crosses track, gaps and blank cells on the field, never a bar, mark or selection', () => {
  for (const text of [' ', '─', '·', '┄']) assert.deepEqual(crossNow({ text, style: {} }), { text: '│', style: { fg: 'accent' } });
  assert.deepEqual(crossNow({ text: '─', style: { bg: '#000000' } }), { text: '│', style: { fg: 'accent' } });
  assert.equal(crossNow({ text: ' ', style: { bg: BOARD_INKS.selection } }), null);
  assert.equal(crossNow({ text: '▒', style: {} }), null);
  assert.deepEqual(crossNow({ text: ' ', style: { bg: BOARD_INKS.selection } }, { quiet: true }), { text: '│', style: { fg: BOARD_INKS.faint } });
  assert.equal(crossNow({ text: '─', style: {} }, { quiet: true }), null);
});

test('a run wholly outside the lane draws nothing; one that crosses an edge is cut to the lane', () => {
  const width = 12;
  const kinds = [
    { live: false, outcome: 'succeeded' }, { live: false, outcome: 'failed' },
    { live: true, label: '42', fill: 'accent', ink: 'field' }, { live: true, label: '42', fill: 'accent', ink: 'field', head: true },
    { live: true, verifying: true, label: '42', fill: 'accent', ink: 'field', head: true },
  ];
  for (const kind of kinds) {
    // Starts past the right edge, as a start recorded ahead of the local clock can.
    for (const [from, to] of [[width, width], [width + 3, width + 9], [width, 100000]]) {
      assert.equal(laneRun({ from, to, ...kind }, { width }), null, `${JSON.stringify(kind)} ${from}..${to}`);
    }
    // Wholly before the lane.
    for (const [from, to] of [[-9, -1], [-100000, -2]]) assert.equal(laneRun({ from, to, ...kind }, { width }), null, `${JSON.stringify(kind)} ${from}..${to}`);
    // Crossing either edge, or both: cut to the lane, every piece inside it.
    for (const [from, to] of [[-5, 4], [6, width + 6], [-5, width + 6], [width - 1, width + 4]]) {
      const run = laneRun({ from, to, ...kind }, { width });
      assert.ok(run, `${JSON.stringify(kind)} ${from}..${to}`);
      for (const p of run.pieces) assert.ok(p.at >= 0 && p.at + lineWidth(p.line) <= width, `${JSON.stringify(kind)} ${from}..${to}: ${p.at}`);
    }
  }
  // Starting on the last column, a headed run is its head there.
  const last = laneRun({ from: width - 1, to: width - 1, live: true, fill: 'accent', ink: 'field', head: true }, { width });
  assert.deepEqual(last.span, [width - 1, width - 1]);
  assert.deepEqual(last.pieces.at(-1), { at: width - 1, line: [span(' ', { bg: 'accent' })] });
});

test('every lane piece uses curated glyphs and stays inside the lane', () => {
  for (let width = 1; width <= 60; width++) {
    const { col, now } = laneScale(AXIS, { width });
    for (const since of [null, 0, now]) for (const after of ['dashed', 'hatched']) {
      const track = laneTrack({ now, since, after }, { width });
      assert.equal(lineWidth(track), width);
      for (const ch of plain(track)) assert.ok(ch === ' ' || GLYPHS.includes(ch));
    }
    const run = laneRun({ from: col(-H), to: now, verified: col(-0.5 * H), live: true, label: '42', fill: 'accent', ink: 'field', head: true }, { width });
    for (const p of run?.pieces ?? []) assert.ok(p.at >= 0 && p.at + lineWidth(p.line) <= width, `${width}: ${p.at}`);
  }
});
