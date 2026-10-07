import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { GLYPHS, lineWidth, paint } from '../foundation/cells.mjs';
import { composeShowcase, viewport } from './showcase-layout.mjs';
import { main, renderSnapshot, runLive } from './showcase.mjs';

const SCRIPT = fileURLToPath(new URL('./showcase.mjs', import.meta.url));
const text = (lines) => lines.map((l) => paint(l, 'none'));
const allowed = (s) => [...s].every((c) => (c >= ' ' && c <= '~') || GLYPHS.includes(c));

test('every width from 1 to 160 composes lines of exactly that width', () => {
  for (let columns = 1; columns <= 160; columns++) {
    for (const line of composeShowcase({ columns })) {
      assert.equal(lineWidth(line), columns, `columns ${columns}`);
      assert.ok(allowed(paint(line, 'none')), `columns ${columns}`);
    }
  }
});

test('normal and compact widths show all four numbered elements and the specimen notice', () => {
  for (const columns of [120, 100, 80, 48, 40]) {
    const all = text(composeShowcase({ columns })).join('\n');
    for (const plate of ['▐01▌ SPECIMEN BAY', '▐02▌ LABEL PLATES', '▐03▌ GAUGES', '▐04▌ STATUS ROWS']) assert.ok(all.includes(plate), `${columns}: ${plate}`);
    assert.match(all, /SPECIMEN VALUES/);
    assert.match(all, /UNKNOWN/);
    assert.match(all, /✕ ERROR/);
  }
  assert.ok(text(composeShowcase({ columns: 100 })).some((l) => l.includes('▐01▌') && l.includes('▐02▌')), 'two columns at 100');
  assert.ok(!text(composeShowcase({ columns: 99 })).some((l) => l.includes('▐01▌') && l.includes('▐02▌')), 'one column at 99');
  assert.match(text(composeShowcase({ columns: 23 })).join('\n'), /NEEDS 24\+ COLUMNS/);
});

test('viewport honors every short height and reports hidden lines', () => {
  const lines = composeShowcase({ columns: 80 });
  for (let rows = 1; rows <= 60; rows++) {
    const view = viewport(lines, { columns: 80, rows, offset: 999 });
    assert.ok(view.lines.length <= rows);
    view.lines.forEach((l) => assert.equal(lineWidth(l), 80));
    if (lines.length > rows) assert.match(paint(view.lines.at(-1), 'none'), rows > 1 ? /LINES \d+-\d+ OF \d+/ : /\d+ LINES/);
    assert.equal(view.offset, view.maxOffset);
  }
  assert.equal(viewport(lines, { columns: 80, rows: 200 }).lines.length, lines.length);
});

test('invalid dimensions are rejected', () => {
  for (const columns of [0, -1, 1.5, Number.NaN, 1001, '80']) assert.throws(() => composeShowcase({ columns }), RangeError, String(columns));
  assert.throws(() => composeShowcase({ columns: 80, rows: 0 }), RangeError);
  assert.throws(() => viewport([], { columns: 80, rows: 0 }), RangeError);
});

test('composition metadata cannot inject controls or wide characters', () => {
  for (const mode of ['\x1b[2J', '界', 'toString', 'COLOR', null]) {
    assert.throws(() => composeShowcase({ columns: 120, mode }), RangeError);
  }
  const lines = composeShowcase({ columns: 80 });
  const last = paint(viewport(lines, { columns: 80, rows: 3, hint: '\x1b[2J 界🙂' }).lines.at(-1), 'none');
  assert.match(last, /\?\[2J \?\?/);
  assert.ok(allowed(last));
  assert.doesNotMatch(last, /\x1b/);
});

test('color output has the same cells as plain output; plain output has no escapes', () => {
  for (const columns of [120, 80, 40, 12]) {
    for (const line of composeShowcase({ columns, mode: 'TRUECOLOR' })) {
      assert.equal(stripVTControlCharacters(paint(line, 'truecolor')), paint(line, 'none'));
    }
    assert.match(renderSnapshot({ columns, color: 'truecolor' }), /\x1b\[0;/);
    assert.doesNotMatch(renderSnapshot({ columns, color: 'none' }), /\x1b/);
  }
});

test('CLI prints a snapshot and exits when stdout is not a terminal', () => {
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', timeout: 10_000, env: { ...process.env, NO_COLOR: '' } });
  const piped = run();
  assert.equal(piped.status, 0);
  assert.doesNotMatch(piped.stdout, /\x1b/);
  assert.ok(piped.stdout.split('\n').every((l) => [...l].length <= 80));
  const sized = run('--plain', '--columns', '48', '--rows', '10');
  assert.equal(sized.status, 0);
  assert.equal(sized.stdout.trimEnd().split('\n').length, 10);
  assert.match(run('--color', '--columns', '60').stdout, /\x1b\[0;/);
  for (const bad of [['--columns', '0'], ['--rows', 'x'], ['--columns', '1e3'], ['--plain', '--color'], ['--bogus']]) {
    const r = run(...bad);
    assert.equal(r.status, 2, bad.join(' '));
    assert.match(r.stderr, /Usage:/);
  }
  assert.equal(run('--help').status, 0);
});

test('main rejects an unavailable terminal width instead of guessing', async () => {
  const err = [];
  const io = { stdout: { isTTY: true, columns: 0, getColorDepth: () => 24, write() {} }, stdin: { isTTY: false }, stderr: { write: (s) => err.push(s) } };
  assert.equal(await main([], io), 2);
  assert.match(err.join(''), /terminal width unavailable/);
});

function fakeTerminal({ columns = 80, rows = 24 } = {}) {
  const input = Object.assign(new EventEmitter(), {
    isTTY: true,
    isRaw: false,
    paused: true,
    setRawMode(mode) {
      this.isRaw = mode;
      return this;
    },
    resume() {
      this.paused = false;
    },
    pause() {
      this.paused = true;
    },
  });
  const output = Object.assign(new EventEmitter(), { columns, rows, written: '', write(s) {
    this.written += s;
    return true;
  } });
  const proc = Object.assign(new EventEmitter(), { stderr: { text: '', write(s) {
    this.text += s;
  } } });
  return { input, output, proc };
}

test('--plain is a one-shot snapshot even when both streams are terminals', async () => {
  const t = fakeTerminal();
  Object.assign(t.output, { isTTY: true, getColorDepth: () => 24 });
  const done = main(['--plain'], Object.assign(t.proc, { stdin: t.input, stdout: t.output }));
  // Release an accidentally interactive implementation so the regression fails rather than hangs.
  if (t.input.isRaw) t.input.emit('data', 'q');
  assert.equal(await done, 0);
  assert.doesNotMatch(t.output.written, /\x1b/);
  assert.match(t.output.written, /INDUSTRIAL OS/);
  assert.equal(t.input.paused, true);
  assert.equal(t.input.listenerCount('data'), 0);
});

function assertRestored({ input, output, proc }) {
  assert.ok(output.written.startsWith('\x1b[?1049h\x1b[?25l'));
  assert.ok(output.written.endsWith('\x1b[0m\x1b[?25h\x1b[?1049l'));
  assert.equal(input.isRaw, false);
  assert.equal(input.paused, true);
  assert.equal(input.listenerCount('data'), 0);
  assert.equal(output.listenerCount('resize'), 0);
  for (const event of ['SIGINT', 'SIGTERM', 'SIGHUP', 'exit']) assert.equal(proc.listenerCount(event), 0, event);
}

test('live view enters raw/alternate mode and restores on q, Esc, Ctrl-C, and signals', async () => {
  for (const [trigger, code] of [[(t) => t.input.emit('data', 'q'), 0], [(t) => t.input.emit('data', '\x1b'), 0], [(t) => t.input.emit('data', '\x03'), 130], [(t) => t.proc.emit('SIGTERM', 'SIGTERM'), 143], [(t) => t.proc.emit('SIGHUP', 'SIGHUP'), 129], [(t) => t.proc.emit('SIGINT', 'SIGINT'), 130]]) {
    const t = fakeTerminal();
    const done = runLive({ ...t, color: 'truecolor' });
    assert.equal(t.input.isRaw, true);
    assert.equal(t.input.paused, false);
    trigger(t);
    assert.equal(await done, code);
    assertRestored(t);
  }
});

test('live view redraws only on resize and scroll, within the current size', async () => {
  const t = fakeTerminal({ columns: 80, rows: 12 });
  const done = runLive({ ...t, color: 'none' });
  assert.match(t.output.written, /LINES 1-11 OF \d+/);
  assert.doesNotMatch(t.output.written, /\x1b\[13;1H/); // never addresses a row beyond the terminal
  let mark = t.output.written.length;
  t.input.emit('data', 'k'); // already at top: no redraw
  assert.equal(t.output.written.length, mark);
  t.input.emit('data', 'j\x1b[B');
  assert.match(t.output.written.slice(mark), /LINES 3-13 OF/);
  mark = t.output.written.length;
  Object.assign(t.output, { columns: 120, rows: 40 });
  t.output.emit('resize');
  const frame = t.output.written.slice(mark);
  assert.match(frame, /120x40 PLAIN/);
  assert.match(frame, /\x1b\[40;1H/);
  assert.doesNotMatch(frame, /\x1b\[41;1H/);
  t.input.emit('data', 'q');
  assert.equal(await done, 0);
  assertRestored(t);
});

test('fragmented escape sequences scroll without accidentally quitting', async () => {
  const t = fakeTerminal({ columns: 80, rows: 12 });
  const done = runLive({ ...t, color: 'none' });
  const start = t.output.written.length;
  t.input.emit('data', Buffer.from('\x1b'));
  assert.equal(t.input.isRaw, true);
  t.input.emit('data', Buffer.from('['));
  assert.equal(t.output.written.length, start);
  t.input.emit('data', Buffer.from('B'));
  assert.match(t.output.written.slice(start), /LINES 2-12 OF/);
  for (const byte of ['\x1b', '[', '6', '~']) t.input.emit('data', Buffer.from(byte));
  assert.match(t.output.written.slice(start), /LINES 12-22 OF/);
  t.input.emit('data', 'q');
  assert.equal(await done, 0);
  assertRestored(t);
});

test('live view restores the terminal when drawing fails', async () => {
  const t = fakeTerminal();
  const done = runLive({ ...t, color: 'none' });
  t.output.columns = 0.5; // ignored: not a drawable size
  t.output.emit('resize');
  const write = t.output.write;
  t.output.write = function (s) {
    if (s.includes('\x1b[1;1H')) throw new Error('synthetic write failure');
    return write.call(this, s);
  };
  t.output.columns = 80;
  t.output.emit('resize');
  assert.equal(await done, 1);
  assertRestored(t);
  assert.match(t.proc.stderr.text, /synthetic write failure/);
});

test('process exit restores modes even without a normal quit', () => {
  const t = fakeTerminal();
  runLive({ ...t, color: 'none' });
  t.proc.emit('exit', 0);
  assert.ok(t.output.written.endsWith('\x1b[0m\x1b[?25h\x1b[?1049l'));
  assert.equal(t.input.isRaw, false);
});
