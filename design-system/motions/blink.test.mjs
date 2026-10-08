import test from 'node:test';
import assert from 'node:assert/strict';
import { lineWidth, paint, span } from '../foundation/cells.mjs';
import { SIGNAL_COLORS } from '../foundation/signal-colors.mjs';
import { labelPlate } from '../elements/label-plate/label-plate.mjs';
import { gauge } from '../elements/gauge/gauge.mjs';
import { statusRow } from '../elements/status-row/status-row.mjs';
import { blink, BLINK_DEFAULTS, BLINK_PRESETS } from './blink.mjs';

const plain = (lines) => lines.map((l) => paint(l, 'none'));
const color = (lines) => lines.map((l) => paint(l, 'truecolor'));
const strip = (lines) => color(lines).map((l) => l.replace(/\x1b\[[0-9;]*m/g, ''));
const cellsOf = (line) => line.flatMap((s) => [...s.text].map((ch) => ({ ch, fg: s.style.fg ?? 'secondary', bg: s.style.bg ?? 'field', bold: s.style.bold ?? false })));
const row = (text, style = {}) => [span(text, style)];
function specimen(width) {
  return [
    [...labelPlate('BAY 04', { tone: 'accent', maxWidth: width })],
    ...gauge({ label: 'FILL', value: 42.5 }, { width }),
    ...statusRow({ label: 'DOOR', value: 'closed', status: 'success' }, { width }),
    ...statusRow({ label: 'FEED', value: 'retries', status: 'warning' }, { width }),
    ...statusRow({ label: 'PARSE', value: 'failed', status: 'error' }, { width }),
  ];
}
// Thread Rail lamp while working (footer.ts:1329): a blank cell on acid. Off is surface.
const LAMP = [[span(' ', { fg: 'primary', bg: 'accent' }), span(' ROOT ', { fg: 'field', bg: 'accent', bold: true })]];
// PNYTL plate lit (footer.ts:1156-1157): a pink `•` on the white body, beside the black lettering.
const PNYTL = [[span(' ', { fg: 'field', bg: 'primary', bold: true }), span('•', { fg: SIGNAL_COLORS.pink, bg: 'primary', bold: true }), span(' PNYTL // LTE ', { fg: 'field', bg: 'primary', bold: true })]];
const ICON = { left: 1, cols: 1 };

test('blink: motion-off returns the input (the lit frame) and needs no time', () => {
  const lines = specimen(48);
  for (const off of [{ animate: false }, { animate: false, time: 600, ...BLINK_PRESETS.activityLight }]) {
    const out = blink(lines, off);
    assert.deepEqual(color(out), color(lines));
    assert.notEqual(out, lines);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(BLINK_DEFAULTS)), { on: 500, off: 300, offStyle: { fg: 'surface', bg: 'surface' }, offGlyph: null });
});

test('blink: the lamp preset is 500 ms acid / 300 ms dim (footer.ts:776 lampOn, 1329)', () => {
  // lampOn: pulse % 16 < 10 on 50 ms ticks.
  const lamp = (time) => cellsOf(blink(LAMP, { time, region: { cols: 1 }, ...BLINK_PRESETS.lamp })[0])[0].bg;
  for (let tick = 0; tick < 48; tick++) {
    for (const time of [tick * 50, tick * 50 + 49]) assert.equal(lamp(time), tick % 16 < 10 ? 'accent' : 'surface', `t=${time}`);
  }
  assert.deepEqual(cellsOf(blink(LAMP, { time: 600, region: { cols: 1 } })[0]).slice(1).map((c) => c.bg), Array(6).fill('accent'), 'ROOT stays lit');
  assert.deepEqual(plain(blink(LAMP, { time: 600 })), plain(LAMP));
});

test('blink: the activity-light preset toggles every 50 ms, 10 times a second (footer.ts:779 lightOn, 1155-1157)', () => {
  // lightOn: pulse % 2 === 0, lit `•` pink, otherwise the black `⌑` icon.
  const icon = (time) => {
    const c = cellsOf(blink(PNYTL, { time, region: ICON, ...BLINK_PRESETS.activityLight })[0])[1];
    return `${c.ch} ${c.fg} ${c.bg}`;
  };
  for (let tick = 0; tick < 40; tick++) {
    for (const time of [tick * 50, tick * 50 + 49]) assert.equal(icon(time), tick % 2 === 0 ? `• ${SIGNAL_COLORS.pink} primary` : '⌑ field primary', `t=${time}`);
  }
  // Ten lit onsets in any one second.
  let onsets = 0;
  for (let t = 1; t <= 1000; t++) if (icon(t).startsWith('•') && !icon(t - 1).startsWith('•')) onsets++;
  assert.equal(onsets, 10);
  const off = blink(PNYTL, { time: 50, region: ICON, ...BLINK_PRESETS.activityLight });
  assert.equal(plain(off)[0], ' ⌑ PNYTL // LTE ', 'the plate width and lettering never change');
});

test('blink never touches warning or critical cells, and never swaps a letter or digit', () => {
  const lines = [[span('▲ WARN', { fg: 'warning' }), span('x·9', { fg: 'accent' })]];
  const out = blink(lines, { time: 600, offGlyph: '░', offStyle: { fg: 'decorative', bold: true } })[0];
  assert.equal(paint(out, 'none'), '▲ WARNx░9');
  assert.deepEqual(cellsOf(out).map((c) => c.fg), [...Array(6).fill('warning'), 'decorative', 'decorative', 'decorative']);
});

test('blink frames are deterministic, keep the input, and keep every line at its exact width', () => {
  for (const width of [1, 2, 3, 7, 23, 24, 40, 48, 100, 160]) {
    const lines = specimen(width);
    const before = JSON.stringify(lines);
    for (const preset of [{}, BLINK_PRESETS.activityLight]) {
      for (const time of [0, 49, 50, 499, 500, 799, 800, 99999]) {
        const out = blink(lines, { time, ...preset });
        assert.deepEqual(out, blink(lines, { time, ...preset }));
        out.forEach((line, i) => assert.equal(lineWidth(line), lineWidth(lines[i]), `width ${width} t=${time} line ${i}`));
        assert.deepEqual(strip(out), plain(out));
        if (!preset.offGlyph) assert.deepEqual(plain(out), plain(lines));
      }
    }
    assert.equal(JSON.stringify(lines), before);
  }
});

test('blink rejects invalid options and lines', () => {
  const bad = [[{ on: 0 }, RangeError], [{ off: 0 }, RangeError], [{ on: '50' }, RangeError], [{ off: 60001 }, RangeError],
    [{ offStyle: null }, RangeError], [{ offStyle: 'surface' }, RangeError], [{ offStyle: { bg: 'nope' } }, RangeError], [{ offStyle: { fg: '#fff' } }, RangeError],
    [{ offStyle: { bold: 1 } }, RangeError], [{ offStyle: { underline: true } }, TypeError], [{ offGlyph: 'A' }, RangeError], [{ offGlyph: '⌑⌑' }, RangeError],
    [{ offGlyph: ' ' }, RangeError], [{ region: { left: -1 } }, RangeError], [{ period: 800 }, TypeError]];
  for (const [options, kind] of bad) {
    assert.throws(() => blink([row('x')], { time: 0, ...options }), kind, JSON.stringify(options));
    assert.throws(() => blink([row('x')], { animate: false, ...options }), kind);
  }
  for (const time of [undefined, -1, Number.NaN, Infinity]) assert.throws(() => blink([row('x')], { time }), RangeError);
  for (const lines of [null, 'abc', [null], [[{ text: 5 }]]]) assert.throws(() => blink(lines, { time: 0 }), TypeError);
  assert.deepEqual(blink([], { time: 600 }), []);
});

test('the lamp preset visibly dims the design-system lamp block as well as a blank cell on acid', () => {
  const block = [[span('█', { fg: 'accent', bg: 'accent' })]];
  const dim = cellsOf(blink(block, { time: 600, ...BLINK_PRESETS.lamp })[0])[0];
  assert.equal(dim.fg, 'surface');
  assert.equal(dim.bg, 'surface');
});

test('blink explicitly rejects terminal-default offStyle channels', () => {
  for (const channel of ['fg', 'bg']) assert.throws(() => blink([[span('A')]], { time: 0, offStyle: { [channel]: 'default' } }), TypeError);
});

import { blinkOn } from './blink.mjs';
test('blinkOn projects the exact phase for host scheduling without styles or glyphs', () => {
  assert.deepEqual([0, 499, 500, 799, 800].map((t) => blinkOn(t)), [true, true, false, false, true]);
  assert.deepEqual([0, 50, 100].map((t) => blinkOn(t, BLINK_PRESETS.activityLight)), [true, false, true]);
  assert.throws(() => blinkOn(-1), RangeError);
  assert.throws(() => blinkOn(0, { on: 0 }), RangeError);
});
