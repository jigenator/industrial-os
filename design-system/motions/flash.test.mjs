import test from 'node:test';
import assert from 'node:assert/strict';
import { lineWidth, paint, span } from '../foundation/cells.mjs';
import { SIGNAL_COLORS } from '../foundation/signal-colors.mjs';
import { labelPlate } from '../elements/label-plate/label-plate.mjs';
import { gauge } from '../elements/gauge/gauge.mjs';
import { statusRow } from '../elements/status-row/status-row.mjs';
import { flash, flashDuration, FLASH_DEFAULTS, FLASH_PRESETS } from './flash.mjs';

const plain = (lines) => lines.map((l) => paint(l, 'none'));
const color = (lines) => lines.map((l) => paint(l, 'truecolor'));
const strip = (lines) => color(lines).map((l) => l.replace(/\x1b\[[0-9;]*m/g, ''));
const cellsOf = (line) => line.flatMap((s) => [...s.text].map((ch) => ({ ch, fg: s.style.fg ?? 'secondary', bg: s.style.bg ?? 'field', bold: s.style.bold ?? false })));
const looks = (line) => cellsOf(line).map((c) => `${c.fg}/${c.bg}${c.bold ? '!' : ''}`);
const row = (text, style = {}) => [span(text, style)];
function specimen(width) {
  return [
    [...labelPlate('BAY 04', { tone: 'accent', maxWidth: width })],
    [...labelPlate('FAULT', { tone: 'critical', maxWidth: width })],
    ...gauge({ label: 'FILL', value: 42.5 }, { width }),
    ...statusRow({ label: 'FEED', value: 'retries', status: 'warning' }, { width }),
    ...statusRow({ label: 'PARSE', value: 'failed', status: 'error' }, { width }),
  ];
}
// claude-interrupt's live plate (index.ts:81): black bold lettering on acid, then a blank gap.
const PLATE = [[span('DIRECTIVE UPDATED ', { fg: 'field', bg: 'accent', bold: true }), span(' ')]];
const presetAt = (lines, preset, time, o = {}) => flash(lines, { time, ...FLASH_PRESETS[preset], ...o });

test('flash: motion-off returns the input and needs no time', () => {
  const lines = specimen(48);
  for (const off of [{ animate: false }, { animate: false, time: 90, stateCells: true }]) {
    const out = flash(lines, off);
    assert.deepEqual(color(out), color(lines));
    assert.notEqual(out, lines);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(FLASH_DEFAULTS)), { step: 80, pattern: ['fill', 'outline'], stateCells: false });
  assert.deepEqual({ ...FLASH_PRESETS.interrupt, pattern: [...FLASH_PRESETS.interrupt.pattern] }, { step: 80, pattern: ['fill', 'outline'] });
  assert.equal(flashDuration(), 160);
  assert.equal(flashDuration(FLASH_PRESETS.threshold), 300);
  assert.equal(flashDuration(FLASH_PRESETS.polarity), 100);
  assert.equal(flashDuration(FLASH_PRESETS.tag), 350);
});

test('flash: claude-interrupt plate, 0-79 filled, 80-159 outline, then filled (index.ts:55-58, 108)', () => {
  const filled = [...Array(18).fill('field/accent!'), 'secondary/field'];
  const outline = [...Array(18).fill('accent/field!'), 'secondary/field'];
  for (const [time, want] of [[0, filled], [79, filled], [80, outline], [159, outline], [160, filled], [3000, filled]]) {
    assert.deepEqual(looks(flash(PLATE, { time })[0]), want, `t=${time}`);
    assert.deepEqual(plain(flash(PLATE, { time })), plain(PLATE), 'the label stays readable');
  }
  // A label plate's half-block edges are already unfilled and keep their look.
  const plate = [labelPlate('BAY 04', { tone: 'accent' })];
  assert.deepEqual(looks(flash(plate, { time: 80 })[0]), ['accent/field', ...Array(8).fill('accent/field!'), 'accent/field']);
});

test('flash: threshold preset, white on ticks 1, 3 and 5 (footer.ts:365, 721-723, 1417-1428)', () => {
  // A lit gauge cell and the 70% mark: footer.ts:1427 lights `█` white; 1428 draws `┃` black on white.
  const lines = [[span('█', { fg: 'accent', bg: 'accent' }), span('┃', { fg: 'warning', bg: SIGNAL_COLORS.warningZone, bold: true })]];
  const white = ['primary/accent', 'field/primary!'];
  const settled = ['accent/accent', `warning/${SIGNAL_COLORS.warningZone}!`];
  for (let k = 0; k < 8; k++) {
    const want = k < 6 && (6 - k) % 2 === 1 ? white : settled;
    for (const time of [k * 50, k * 50 + 49]) assert.deepEqual(looks(presetAt(lines, 'threshold', time, { stateCells: true })[0]), want, `t=${time}`);
  }
  // Exempt by default: only the lit cell flashes.
  assert.deepEqual(looks(presetAt(lines, 'threshold', 50)[0]), ['primary/accent', settled[1]]);
});

test('flash: polarity preset swaps the CMP pair for two ticks (footer.ts:1327)', () => {
  const cmp = [[span(' CMP 03 ', { fg: 'field', bg: SIGNAL_COLORS.pink, bold: true })]];
  const swapped = Array(8).fill(`${SIGNAL_COLORS.pink}/field!`);
  assert.deepEqual(looks(presetAt(cmp, 'polarity', 0)[0]), swapped);
  assert.deepEqual(looks(presetAt(cmp, 'polarity', 99)[0]), swapped);
  assert.deepEqual(color(presetAt(cmp, 'polarity', 100)), color(cmp));
});

test('flash: tag preset inverts on ticks 1-2 and 5-6 (footer.ts:365, 719, 1320)', () => {
  // TAG_TICKS 8: tagFlash = (8 - k) % 4 >= 2; the flashed tag is black on its tone's ink.
  const tag = [[span('HIGH', { fg: 'accent', bold: true })]];
  for (let k = 0; k < 9; k++) {
    const want = k < 8 && (8 - k) % 4 >= 2 ? 'field/accent!' : 'accent/field!';
    assert.deepEqual(looks(presetAt(tag, 'tag', k * 50 + 25)[0]), Array(4).fill(want), `tick ${k}`);
  }
});

test('flash: warning and critical cells are exempt by default; opted in, every kind keeps their cue', () => {
  const lines = [labelPlate('FAULT', { tone: 'critical' }), [span('▲ WARN', { fg: 'warning', bold: true })], [span('█', { fg: 'critical', bg: 'critical' })]];
  for (const kind of ['outline', 'invert', 'white']) {
    assert.deepEqual(color(flash(lines, { time: 0, pattern: [kind] })), color(lines), kind);
    const out = flash(lines, { time: 0, pattern: [kind], stateCells: true });
    assert.deepEqual(plain(out), plain(lines), kind);
  }
  assert.deepEqual(looks(flash(lines, { time: 0, pattern: ['outline'], stateCells: true })[0]).slice(1, 8), Array(7).fill('critical/field!'));
  assert.deepEqual(looks(flash(lines, { time: 0, pattern: ['invert'], stateCells: true })[1]), Array(6).fill('field/warning!'));
  assert.deepEqual(looks(flash(lines, { time: 0, pattern: ['white'], stateCells: true })[2]), ['primary/critical']);
});

test('flash: a region limits the cells; patterns run in order', () => {
  const lines = [row('abcd', { fg: 'field', bg: 'accent' }), row('efgh', { fg: 'field', bg: 'accent' })];
  const out = flash(lines, { time: 10, pattern: ['invert', 'fill'], step: 20, region: { top: 1, left: 2 } });
  assert.deepEqual(looks(out[0]), Array(4).fill('field/accent'));
  assert.deepEqual(looks(out[1]), ['field/accent', 'field/accent', 'accent/field', 'accent/field']);
  assert.deepEqual(color(flash(lines, { time: 25, pattern: ['invert', 'fill'], step: 20 })), color(lines));
  assert.deepEqual(color(flash(lines, { time: 40, pattern: ['invert', 'fill'], step: 20 })), color(lines));
});

test('flash frames are deterministic, keep the input and characters, and keep every line at its exact width', () => {
  for (const width of [1, 2, 3, 7, 23, 24, 40, 48, 100, 160]) {
    const lines = specimen(width);
    const before = JSON.stringify(lines);
    for (const stateCells of [false, true]) {
      for (const pattern of [['outline'], ['invert'], ['white'], ['fill']]) {
        for (const time of [0, 79, 80]) {
          const out = flash(lines, { time, pattern, stateCells });
          assert.deepEqual(out, flash(lines, { time, pattern, stateCells }));
          out.forEach((line, i) => assert.equal(lineWidth(line), lineWidth(lines[i]), `width ${width} t=${time} line ${i}`));
          assert.deepEqual(plain(out), plain(lines));
          assert.deepEqual(strip(out), plain(out));
        }
      }
    }
    assert.equal(JSON.stringify(lines), before);
  }
});

test('flash rejects invalid options and lines', () => {
  const bad = [[{ step: 0 }, RangeError], [{ step: '80' }, RangeError], [{ step: 60001 }, RangeError], [{ pattern: [] }, RangeError],
    [{ pattern: 'fill' }, RangeError], [{ pattern: ['blink'] }, RangeError], [{ pattern: Array(1001).fill('fill') }, RangeError],
    [{ stateCells: 0 }, TypeError], [{ region: { top: -2 } }, RangeError], [{ region: 1 }, TypeError], [{ duration: 160 }, TypeError]];
  for (const [options, kind] of bad) {
    assert.throws(() => flash([row('x')], { time: 0, ...options }), kind, JSON.stringify(options).slice(0, 60));
    assert.throws(() => flash([row('x')], { animate: false, ...options }), kind);
    assert.throws(() => flashDuration(options), kind);
  }
  for (const time of [undefined, -1, Number.NaN, Infinity]) assert.throws(() => flash([row('x')], { time }), RangeError);
  for (const lines of [null, 'abc', [null], [[{ text: 5 }]]]) assert.throws(() => flash(lines, { time: 0 }), TypeError);
  assert.deepEqual(flash([], { time: 0 }), []);
});
