import test from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS, lineWidth, resolveStyle } from '../../foundation/cells.mjs';
import { PLATE_LIGHTING, SURFACE_PALETTE } from '../../foundation/surface-palette.mjs';
import { frostAt, hintSegments, statusStrip, STRIP_SPACING } from './status-strip.mjs';

// The approved sticky droid plate mockup (revision 7): the strip's cells at 48–99 columns and every lighting level were
// compared with this element; see CONTRIBUTING.md. These are its texts.
const KEYS = [{ glyph: '|' }, { glyph: '-' }, { glyph: '^' }, { glyph: 'x' }];
const HINTS = hintSegments([['esc', 'steer'], ['ctrl+c', 'clear'], ['/', 'commands'], ['!', 'bash']]);
const text = (strip) => strip.line.map((s) => s.text).join('');
const cellsOf = (line) => line.flatMap((s) => [...s.text].map((ch) => ({ ch, ...resolveStyle(s.style) })));

test('hints pack from column 2 with a 3-cell gap, tighten to 2/2 and 2/1, then drop whole from the right', () => {
  const rows = Object.fromEntries([99, 72, 68, 64, 60, 56, 48, 40].map((width) => [width, statusStrip(HINTS, { width, keys: KEYS })]));
  assert.equal(text(rows[99]), '  esc steer   ctrl+c clear   / commands   ! bash' + ' '.repeat(33) + '  [|][-][^][x]    ');
  assert.equal(text(rows[64]), '  esc steer  ctrl+c clear  / commands  ! bash   [|][-][^][x]    ');
  assert.equal(text(rows[48]), '  esc steer   ctrl+c clear      [|][-][^][x]    ');
  // The mockup's narrowing table: hints dropped, gap and clear cells per width.
  const table = { 99: [0, 3, 3], 72: [0, 3, 3], 68: [0, 2, 2], 64: [0, 2, 1], 60: [1, 3, 3], 56: [1, 2, 1], 48: [2, 3, 3], 40: [3, 3, 3] };
  for (const [width, [dropped, gap, clear]] of Object.entries(table)) assert.deepEqual([rows[width].dropped, rows[width].gap, rows[width].clear], [dropped, gap, clear], width);
});

test('the bay always ends on W − 3 and its keys are clickable cells; text never reaches it', () => {
  for (let width = 21; width <= 200; width++) {
    const strip = statusStrip([...HINTS, { kind: 'text', text: 'x'.repeat(300), clip: true }], { width, keys: KEYS });
    assert.equal(lineWidth(strip.line), width);
    assert.equal(strip.keys[0].hitCol, width - 18);
    assert.equal(strip.keys.at(-1).hitCol + strip.keys.at(-1).hitLen - 1, width - 3);
    const cells = cellsOf(strip.line);
    assert.ok(cells.slice(width - 18 - strip.clear, width - 18).every((c) => c.ch === ' '), `${width}`);
    for (const c of cells) assert.ok(/^[\x20-\x7e]$/.test(c.ch) || GLYPHS.includes(c.ch));
  }
  // No keys: no bay, and text runs to two cells from the margin.
  assert.deepEqual(statusStrip(HINTS, { width: 99 }).keys, []);
});

test('states: status lamps, the needs-you chip, fields, clocks; long text is cut with …', () => {
  const ready = statusStrip([{ kind: 'status', glyph: '○', word: 'READY', tone: 'ready' }], { width: 99, keys: KEYS });
  assert.deepEqual(ready.status, { col: 2, len: 7 });
  const run = statusStrip([{ kind: 'status', glyph: '▶', word: 'RUNNING', tone: 'accent' }, { kind: 'text', text: 'npm run dev -- --port 4765 --host 0.0.0.0 --open --strict', clip: true }, { kind: 'clock', text: '00:12:41' }], { width: 64, keys: KEYS });
  assert.equal(text(run).slice(0, 45), '  ▶ RUNNING  npm run dev -- --port…  00:12:41');
  const ask = statusStrip([{ kind: 'chip', glyph: '▲', word: 'NEEDS YOU' }, { kind: 'text', text: 'Which one?', clip: true }], { width: 99, keys: KEYS });
  const cells = cellsOf(ask.line);
  assert.equal(text(ask).slice(2, 15), ' ▲ NEEDS YOU ');
  assert.ok(cells.slice(2, 15).every((c) => c.fg === '#000000' && c.bg === resolveStyle({ bg: 'critical' }).bg && c.bold));
  assert.deepEqual(ask.status, { col: 2, len: 13 });
  const done = statusStrip([{ kind: 'status', glyph: '●', word: 'DONE', tone: 'primary' }, { kind: 'field', label: 'SETTLED', value: '15:02', drop: 5 }, ...HINTS.slice(1)], { width: 99, keys: KEYS });
  assert.equal(text(done).slice(0, 24), '  ● DONE   SETTLED 15:02');
  // Caller text is shown as printable ASCII.
  assert.equal(text(statusStrip([{ kind: 'text', text: 'a\u001b[31mb' }], { width: 40 })).slice(2, 9), 'a?[31mb');
});

test('lighting: dark puts the strip on the surface and dims hints and READY; status lamps and the chip stay lit', () => {
  const segs = [{ kind: 'status', glyph: '■', word: 'WORKING', tone: 'accent' }, { kind: 'clock', text: '03:12' }, { kind: 'hint', key: 'esc', action: 'steer' }];
  const at = (strip, x) => cellsOf(strip.line)[x];
  const lit = statusStrip(segs, { width: 99, keys: KEYS }), dark = statusStrip(segs, { width: 99, keys: KEYS, lighting: 'dark' });
  const standby = statusStrip(segs, { width: 99, keys: KEYS, lighting: 'standby' });
  assert.equal(text(lit), text(dark));
  assert.equal(at(lit, 0).bg, frostAt(0, 99));
  assert.equal(at(dark, 0).bg, PLATE_LIGHTING.dark.strip);
  assert.equal(at(standby, 0).bg, frostAt(0, 99));
  for (const strip of [lit, dark, standby]) assert.equal(at(strip, 4).fg, resolveStyle({ fg: 'accent' }).fg);
  assert.equal(at(dark, 14).fg, PLATE_LIGHTING.dark.action); // the clock
  assert.equal(at(dark, 22).fg, PLATE_LIGHTING.dark.key); // esc
  assert.equal(at(lit, 22).fg, '#ffffff');
  const ready = [{ kind: 'status', glyph: '○', word: 'READY', tone: 'ready' }];
  assert.equal(at(statusStrip(ready, { width: 60 }), 2).fg, SURFACE_PALETTE.frostLamp);
  assert.equal(at(statusStrip(ready, { width: 60, lighting: 'standby' }), 2).fg, PLATE_LIGHTING.standby.ready);
  const chip = statusStrip([{ kind: 'chip', glyph: '▲', word: 'NEEDS YOU' }], { width: 60, lighting: 'dark' });
  assert.equal(at(chip, 3).bg, resolveStyle({ bg: 'critical' }).bg);
});

test('every width 1–160 returns exactly that many cells of printable glyphs, with or without the bay', () => {
  const segments = [{ kind: 'status', glyph: '■', word: 'BASH', tone: 'accent' }, { kind: 'text', text: 'npm test -- --watch=false', clip: true }, { kind: 'clock', text: '00:42', drop: 1 }, ...HINTS];
  for (let width = 1; width <= 160; width++) for (const keys of [[], KEYS]) {
    const strip = statusStrip(segments, { width, keys });
    assert.equal(lineWidth(strip.line), width, `width ${width}`);
    assert.ok([...text(strip)].every((ch) => ch === ' ' || GLYPHS.includes(ch) || /[\x21-\x7e]/.test(ch)), `width ${width}`);
    if (width < 4) assert.deepEqual(strip.shown, [], `width ${width}: no room past the margin`);
  }
});

test('invalid segments and options throw', () => {
  for (const bad of [null, { kind: 'x' }, { kind: 'hint', key: '' , action: 'a' }, { kind: 'text' }]) assert.throws(() => statusStrip([bad], { width: 40 }), TypeError);
  assert.throws(() => statusStrip([{ kind: 'status', glyph: '○', word: 'A', tone: 'red' }], { width: 40 }), RangeError);
  assert.throws(() => statusStrip([{ kind: 'text', text: 'a', drop: 1.5 }], { width: 40 }), RangeError);
  assert.throws(() => statusStrip([], { width: 40, lighting: 'off' }), RangeError);
  assert.throws(() => statusStrip([], { width: 0 }), RangeError);
  assert.throws(() => statusStrip('x', { width: 40 }), TypeError);
  assert.deepEqual(STRIP_SPACING, [[3, 3], [2, 2], [2, 1]]);
});
