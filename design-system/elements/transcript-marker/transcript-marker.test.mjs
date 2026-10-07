import test from 'node:test';
import assert from 'node:assert/strict';
import { stripVTControlCharacters } from 'node:util';
import { GLYPHS, fitLine, lineWidth, paint, span } from '../../foundation/cells.mjs';
import {
  MARKER_BAR_OFFSETS, MARKER_BARS, MARKER_PLATES, MARKER_SPAN, MARKER_TIMELINE, markerBars, markerPlate, transcriptMarker,
} from './transcript-marker.mjs';

const text = (line) => paint(line, 'none');
const allowed = (s) => [...s].every((c) => (c >= ' ' && c <= '~') || GLYPHS.includes(c));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Per-cell classes, as pi/claude-interrupt/test/extension.test.ts names them: L live plate, O transparent acid,
// R record plate, G grey ghost bar, B blank.
const classes = (line) => line.flatMap((s) => [...s.text].map((ch) => {
  if (same(s.style, MARKER_PLATES.live)) return 'L';
  if (same(s.style, MARKER_PLATES.outline) || same(s.style, MARKER_BARS.lit.style)) return 'O';
  if (same(s.style, MARKER_PLATES.record)) return 'R';
  if (same(s.style, MARKER_BARS.ghost.style)) return 'G';
  return ch === ' ' && !s.style.bg ? 'B' : '?';
})).join('');

test('static states: live, outline and record plates, bar span, both pads', () => {
  assert.equal(text(markerPlate('live')), ' DIRECTIVE UPDATED ');
  assert.equal(text(markerPlate('live', { outputPad: 0 })), 'DIRECTIVE UPDATED ');
  assert.deepEqual(markerPlate('live')[0].style, { fg: 'field', bg: 'accent', bold: true });
  assert.deepEqual(markerPlate('outline')[0].style, { fg: 'accent', bg: 'field', bold: true });
  assert.deepEqual(markerPlate()[0].style, { fg: 'primary', bg: 'structural', bold: true }, 'record is the default');
  assert.equal(text(markerBars()), '││ │ │  │  │   │');
  assert.equal(lineWidth(markerBars('ghost')), MARKER_SPAN);
  assert.equal(text(markerBars('off')), ' '.repeat(16));
  assert.equal(classes(markerBars(['ghost', 'lit', 'off', 'lit', 'lit', 'off', 'ghost'])), 'GOBBBOBBOBBBBBBG');
  assert.deepEqual([...text(markerBars())].flatMap((c, i) => (c === '│' ? [i] : [])), MARKER_BAR_OFFSETS);
});

test('the settled row matches the extension: record plate, no bars, outputPad blank cells at the end', () => {
  // extension.test.ts at width 40, outputPad 1: 39 cells of ` DIRECTIVE UPDATED ` and blanks, plate cells R.
  const [row] = transcriptMarker({}, { width: 40 });
  assert.equal(text(row), ' DIRECTIVE UPDATED '.padEnd(40));
  assert.equal(classes(row), 'R'.repeat(19) + 'B'.repeat(21));
  const [flush] = transcriptMarker({ outputPad: 0 }, { width: 40 });
  assert.equal(classes(flush), 'R'.repeat(18) + 'B'.repeat(22));
  // extension-runner.test.ts: row(400) is ` DIRECTIVE UPDATED  ││ │ │  │  │   │`.
  assert.equal(text(transcriptMarker({ plate: 'live', bars: 'lit' }, { width: 80 })[0]).trimEnd(), ' DIRECTIVE UPDATED  ││ │ │  │  │   │');
});

// A host's composition of the static pieces at elapsed m, following the README timeline. It stands in for the
// flash, ping and wipe motions; it is written from the README, not from the extension's renderer.
function frameAt(m, outputPad, width) {
  const T = MARKER_TIMELINE;
  const plateText = text(markerPlate('live', { outputPad }));
  const n = plateText.length;
  const recorded = m >= T.window ? n : m < T.settleWipe ? 0
    : Math.min(n, Math.ceil(((Math.floor(m / T.plateStep) * T.plateStep - T.settleWipe + T.plateStep) * n) / (T.window - T.settleWipe)));
  const head = m >= T.flashOff && m < T.flashOn ? 'outline' : 'live';
  const ping = m >= T.pingLaunch + T.pingRepeatAfter ? m - T.pingRepeatAfter : m;
  const t = Math.floor(ping / T.barFrame) * T.barFrame;
  const bars = MARKER_BAR_OFFSETS.map((_, i) => {
    const ghostAt = T.ghostAt + i * T.pingStagger;
    return t < T.pingLaunch + i * T.pingStagger || t >= ghostAt + T.ghostFor ? 'off' : t < ghostAt ? 'lit' : 'ghost';
  });
  const plate = [span(plateText.slice(0, n - recorded), MARKER_PLATES[head]), span(plateText.slice(n - recorded), MARKER_PLATES.record)].filter((s) => s.text);
  return fitLine(fitLine([...plate, span(' '), ...markerBars(bars)], Math.max(0, width - outputPad)), width);
}

test('the pieces reproduce the extension timeline exactly (40 columns, outputPad 1)', () => {
  // Literal oracle from pi/claude-interrupt/test/extension.test.ts "marker cells carry the approved Acid/Black
  // colors": each span string lists the 16 bar cells; O acid bar, G grey ghost, B blank.
  const spans = [
    [160, 'OBBBBBBBBBBBBBBB'], [200, 'OOBBBBBBBBBBBBBB'], [240, 'OOBOBBBBBBBBBBBB'], [280, 'OOBOBOBBBBBBBBBB'],
    [320, 'OOBOBOBBOBBBBBBB'], [360, 'OOBOBOBBOBBOBBBB'], [400, 'OOBOBOBBOBBOBBBO'],
    [440, 'GOBOBOBBOBBOBBBO'], [480, 'GGBOBOBBOBBOBBBO'], [520, 'GGBGBOBBOBBOBBBO'], [560, 'BGBGBGBBOBBOBBBO'],
    [600, 'BBBGBGBBGBBOBBBO'], [640, 'BBBBBGBBGBBGBBBO'], [680, 'BBBBBBBBGBBGBBBG'], [720, 'BBBBBBBBBBBGBBBG'],
    [760, 'BBBBBBBBBBBBBBBG'], [800, 'BBBBBBBBBBBBBBBB'], [2000, 'BBBBBBBBBBBBBBBB'],
  ];
  const literal = [
    [0, 'L'.repeat(19) + 'B'.repeat(21)], [79, 'L'.repeat(19) + 'B'.repeat(21)],
    [80, 'O'.repeat(19) + 'B'.repeat(21)], [159, 'O'.repeat(19) + 'B'.repeat(21)],
    ...[...spans, ...spans.filter(([at]) => at <= 800).map(([at, cells]) => [at + 720, cells])].map(([at, cells]) => [at, `${'L'.repeat(19)}B${cells}BBBB`]),
    [2799, 'L'.repeat(19) + 'B'.repeat(21)], [2800, 'L'.repeat(11) + 'R'.repeat(8) + 'B'.repeat(21)],
    [2880, 'L'.repeat(3) + 'R'.repeat(16) + 'B'.repeat(21)], [2960, 'R'.repeat(19) + 'B'.repeat(21)], [3000, 'R'.repeat(19) + 'B'.repeat(21)],
  ];
  for (const [m, expected] of literal) {
    const line = frameAt(m, 1, 40);
    assert.equal(classes(line), expected, `${m} ms`);
    assert.equal(lineWidth(line), 40);
    assert.equal(text(line).slice(0, 19), ' DIRECTIVE UPDATED ', 'the label stays readable in every frame');
  }
  // outputPad 0: an 18-cell plate with the same proportional wipe (extension.test.ts, `flush`).
  assert.equal(classes(frameAt(160, 0, 40)), `${'L'.repeat(18)}BO${'B'.repeat(20)}`);
  assert.equal(classes(frameAt(2800, 0, 40)), `${'L'.repeat(10)}${'R'.repeat(8)}${'B'.repeat(22)}`);
  assert.equal(classes(frameAt(2880, 0, 40)), `${'L'.repeat(3)}${'R'.repeat(15)}${'B'.repeat(22)}`);
  assert.equal(classes(frameAt(2960, 0, 40)), `${'R'.repeat(18)}${'B'.repeat(22)}`);
  assert.equal(paint(frameAt(3000, 1, 40), 'truecolor'), paint(transcriptMarker({}, { width: 40 })[0], 'truecolor'), 'the settled frame is the element default');
});

test('every width from 1 to 160 is one exact row, clipped not wrapped', () => {
  for (let width = 1; width <= 160; width++) {
    for (const outputPad of [0, 1]) {
      for (const plate of Object.keys(MARKER_PLATES)) {
        for (const bars of Object.keys(MARKER_BARS)) {
          const lines = transcriptMarker({ plate, bars, outputPad }, { width });
          assert.equal(lines.length, 1);
          assert.equal(lineWidth(lines[0]), width);
          const plain = text(lines[0]);
          assert.ok(allowed(plain));
          assert.equal(stripVTControlCharacters(paint(lines[0], 'truecolor')), plain);
          assert.equal(plain.slice(width - outputPad), ' '.repeat(outputPad), 'right padding stays blank');
          assert.equal(plain.trimEnd(), `${outputPad ? ' ' : ''}DIRECTIVE UPDATED  ${text(markerBars(bars))}`.slice(0, width - outputPad).trimEnd());
        }
      }
    }
  }
});

test('invalid states and pads throw', () => {
  for (const state of ['flash', 'toString', '__proto__', '', null]) assert.throws(() => markerPlate(state), RangeError, String(state));
  for (const outputPad of [2, -1, '1', true]) assert.throws(() => markerPlate('live', { outputPad }), RangeError);
  assert.throws(() => markerBars('dim'), RangeError);
  assert.throws(() => markerBars(['lit']), TypeError);
  assert.throws(() => markerBars(['lit', 'lit', 'lit', 'lit', 'lit', 'lit', 'on']), RangeError);
  assert.throws(() => transcriptMarker({}, { width: 0 }), RangeError);
  assert.throws(() => transcriptMarker({ plate: 'settled' }, { width: 40 }), RangeError);
});
