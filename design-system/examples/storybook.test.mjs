import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { composeStorybook, initialState, press } from './storybook-layout.mjs';
import { STORIES } from './storybook-stories.mjs';
import { FRAME_MS, main, renderSnapshot, runLive } from './storybook.mjs';

const SCRIPT = fileURLToPath(new URL('./storybook.mjs', import.meta.url));
const ENTER = '\x1b[?1049h\x1b[?25l\x1b[?1006h\x1b[?1000h';
const RESTORE = '\x1b[?1000l\x1b[?1006l\x1b[0m\x1b[?25h\x1b[?1049l';

function fakeTerminal({ columns = 120, rows = 40 } = {}) {
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
    this.emit('written');
    return true;
  } });
  const proc = Object.assign(new EventEmitter(), { stderr: { text: '', write(s) {
    this.text += s;
  } } });
  return { input, output, proc };
}

// Manual clock: time moves only when a check says so, and timers fire only through tick().
function fakeClock() {
  const timers = new Map();
  let next = 1;
  return {
    t: 0,
    timers,
    created: 0,
    now() {
      return this.t;
    },
    setInterval(fn, ms) {
      this.created++;
      timers.set(next, { fn, ms });
      return next++;
    },
    clearInterval(id) {
      timers.delete(id);
    },
    tick(ms) {
      this.t += ms;
      for (const { fn } of [...timers.values()]) fn();
    },
  };
}

function live({ columns, rows, color = 'truecolor' } = {}) {
  const t = fakeTerminal({ columns, rows });
  const clock = fakeClock();
  const done = runLive({ ...t, color, clock });
  const keys = (...ks) => ks.forEach((k) => t.input.emit('data', k));
  const since = (mark) => stripVTControlCharacters(t.output.written.slice(mark));
  // Node's decoder holds a lone Esc briefly to tell it from an escape sequence; wait for its redraw.
  const nextWrite = () => new Promise((resolve) => t.output.once('written', resolve));
  return { ...t, clock, done, keys, since, nextWrite };
}

function assertRestored({ input, output, proc, clock }) {
  assert.ok(output.written.startsWith(ENTER));
  assert.ok(output.written.endsWith(RESTORE));
  assert.equal(input.isRaw, false);
  assert.equal(input.paused, true);
  assert.equal(input.listenerCount('data'), 0);
  assert.equal(output.listenerCount('resize'), 0);
  for (const event of ['SIGINT', 'SIGTERM', 'SIGHUP', 'exit']) assert.equal(proc.listenerCount(event), 0, event);
  if (clock) assert.equal(clock.timers.size, 0, 'no timer left running');
}

test('the frame timer stays at or under 15 fps', () => {
  assert.ok(Number.isInteger(FRAME_MS));
  assert.ok(1000 / FRAME_MS <= 15);
});

test('every quit path restores the terminal and clears a playing preview timer', async () => {
  const triggers = [
    [(s) => s.keys('q'), 0],
    [(s) => s.keys('Q'), 0],
    [(s) => s.keys('\x1b'), 0],
    [(s) => s.keys('\x03'), 130],
    [(s) => s.proc.emit('SIGINT', 'SIGINT'), 130],
    [(s) => s.proc.emit('SIGTERM', 'SIGTERM'), 143],
    [(s) => s.proc.emit('SIGHUP', 'SIGHUP'), 129],
  ];
  for (const [trigger, code] of triggers) {
    const s = live();
    assert.equal(s.input.isRaw, true);
    s.keys('5', 'p'); // scan, playing
    assert.equal(s.clock.timers.size, 1);
    trigger(s);
    assert.equal(await s.done, code);
    assertRestored(s);
  }
});

test('starts with motion off and no timer; one bounded timer runs only while a preview plays', async () => {
  const s = live();
  assert.equal(s.clock.created, 0);
  assert.match(s.since(0), /> 01 NUMBERED PANEL/);
  s.keys('p', 'r', 'o'); // playback keys on a component do nothing
  assert.equal(s.clock.created, 0);
  s.keys('5');
  assert.match(s.since(0), /▐ DEMO ▌ MOTION OFF {2}stable view, P plays/);
  assert.equal(s.clock.created, 0, 'selecting a motion does not start it');
  s.keys('p');
  assert.deepEqual([...s.clock.timers.values()].map((x) => x.ms), [FRAME_MS]);
  s.keys('p', 'p', 'r', 'r');
  assert.equal(s.clock.timers.size, 1, 'never more than one timer');
  for (const [stop, label] of [['p', 'pause'], ['o', 'motion off'], ['j', 'story change'], ['l', 'example change'], ['?', 'key list']]) {
    s.keys('5', 'r');
    assert.equal(s.clock.timers.size, 1, label);
    s.keys(stop);
    assert.equal(s.clock.timers.size, 0, label);
    if (stop === '?') s.keys('?');
  }
  s.keys('q');
  assert.equal(await s.done, 0);
  assertRestored(s);
});

test('timer ticks redraw with demonstration time; pause holds it; replay restarts it', async () => {
  const s = live();
  s.keys('5', 'p');
  let mark = s.output.written.length;
  s.clock.tick(600);
  s.clock.tick(600);
  assert.match(s.since(mark), /▐ DEMO ▌ PLAYING {2}1\.20 s {2}loop 2\.40 s/);
  s.keys('p');
  assert.match(s.since(mark), /PAUSED {2}1\.20 s/);
  s.clock.t += 5000; // nothing fires while paused
  mark = s.output.written.length;
  s.keys('p');
  s.clock.tick(300);
  assert.match(s.since(mark), /PLAYING {2}1\.50 s/);
  s.keys('r');
  assert.match(s.since(mark), /PLAYING {2}0\.00 s/);
  s.keys('q');
  assert.equal(await s.done, 0);
  assertRestored(s);
});

test('a reveal stops its own timer when it completes', async () => {
  const s = live();
  s.keys('7', 'p');
  assert.equal(s.clock.timers.size, 1);
  for (let i = 0; i < 20 && s.clock.timers.size; i++) s.clock.tick(FRAME_MS);
  assert.equal(s.clock.timers.size, 0);
  assert.match(s.since(0), /COMPLETE {2}0\.72 s of 0\.72 s/);
  s.keys('r');
  assert.equal(s.clock.timers.size, 1, 'replay plays again');
  s.keys('q');
  assert.equal(await s.done, 0);
  assertRestored(s);
});

test('without color, previews that only change color stay off; a blank reveal can play', async () => {
  const s = live({ color: 'none' });
  assert.doesNotMatch(s.output.written.slice(ENTER.length), /\x1b\[0;/, 'no color SGR');
  s.keys('5', 'p', '6', 'p', '7', 'p');
  assert.equal(s.clock.created, 0);
  assert.match(s.since(0), /without color this motion has nothing to show/);
  s.keys('l', 'p');
  assert.equal(s.clock.timers.size, 1);
  s.keys('q');
  assert.equal(await s.done, 0);
  assertRestored(s);
});

test('keys browse stories and states; Esc closes the key list before it quits', async () => {
  const s = live();
  let mark = s.output.written.length;
  s.keys('j');
  assert.match(s.since(mark), /> 02 LABEL PLATE/);
  s.keys('\x1b[A', '\x1b[A');
  assert.match(s.since(mark), /> 08 COLORS/);
  s.keys('\t');
  assert.match(s.since(mark), /> 01 NUMBERED PANEL/);
  s.keys('\x1b[Z');
  assert.match(s.since(mark), /> 08 COLORS/);
  mark = s.output.written.length;
  s.keys('3', 'l', '\x1b[C');
  assert.match(s.since(mark), /\[FULL\]/);
  s.keys('h');
  assert.match(s.since(mark), /\[ZERO\]/);
  mark = s.output.written.length;
  s.keys('?');
  assert.match(s.since(mark), /KEYS[\s\S]*TAB, SHIFT-TAB/);
  mark = s.output.written.length;
  const closed = s.nextWrite();
  s.keys('\x1b');
  await closed;
  assert.equal(s.input.isRaw, true, 'Esc closed the key list');
  assert.match(s.since(mark), /COMPONENT 3\/8/);
  mark = s.output.written.length;
  s.keys('x', '\x1bj'); // unbound keys and meta keys are ignored
  assert.equal(s.output.written.length, mark);
  s.keys('\x1b');
  assert.equal(await s.done, 0);
  assertRestored(s);
});

test('fragmented escape sequences navigate without quitting', async () => {
  const s = live({ columns: 80, rows: 24 });
  const mark = s.output.written.length;
  s.keys(Buffer.from('\x1b'));
  assert.equal(s.input.isRaw, true);
  s.keys(Buffer.from('['));
  assert.equal(s.output.written.length, mark);
  s.keys(Buffer.from('B'));
  assert.match(s.since(mark), /> 02 LABEL PLATE/);
  for (const byte of ['\x1b', '[', '6', '~']) s.keys(Buffer.from(byte));
  assert.match(s.since(mark), /LINES \d+-\d+ OF/);
  s.keys('q');
  assert.equal(await s.done, 0);
  assertRestored(s);
});

test('paging scrolls the details within the frame; resize redraws at the new size', async () => {
  const s = live({ columns: 60, rows: 12 });
  assert.match(s.since(0), /LINES 1-\d+ OF \d+/);
  assert.doesNotMatch(s.output.written, /\x1b\[13;1H/);
  let mark = s.output.written.length;
  s.keys('b'); // already at the top: no redraw
  assert.equal(s.output.written.length, mark);
  s.keys(' ');
  assert.doesNotMatch(s.since(mark), /LINES 1-/);
  s.keys('\x1b[5~');
  assert.match(s.since(mark), /LINES 1-/);
  mark = s.output.written.length;
  Object.assign(s.output, { columns: 1, rows: 1 });
  s.output.emit('resize');
  assert.equal(s.since(mark), '0');
  mark = s.output.written.length;
  Object.assign(s.output, { columns: 140, rows: 30 });
  s.output.emit('resize');
  const frame = s.output.written.slice(mark);
  assert.match(frame, /140x30 TRUECOLOR/);
  assert.match(frame, /\x1b\[30;1H/);
  assert.doesNotMatch(frame, /\x1b\[31;1H/);
  s.keys('q');
  assert.equal(await s.done, 0);
  assertRestored(s);
});

test('a drawing failure during playback restores the terminal, clears the timer, and exits 1', async () => {
  const s = live();
  s.keys('5', 'p');
  const write = s.output.write;
  s.output.write = function (text) {
    if (text.includes('\x1b[1;1H')) throw new Error('synthetic tick failure');
    return write.call(this, text);
  };
  s.clock.tick(FRAME_MS);
  assert.equal(await s.done, 1);
  assertRestored(s);
  assert.match(s.proc.stderr.text, /^storybook: Error: synthetic tick failure/);
});

test('a drawing failure on start restores the terminal and exits 1', async () => {
  const t = fakeTerminal();
  const write = t.output.write;
  t.output.write = function (text) {
    if (text.includes('\x1b[1;1H')) throw new Error('synthetic start failure');
    return write.call(this, text);
  };
  assert.equal(await runLive({ ...t, color: 'none', clock: fakeClock() }), 1);
  assertRestored(t);
  assert.match(t.proc.stderr.text, /synthetic start failure/);
});

test('playing before any drawable size is known neither draws nor fails', async () => {
  const s = live({ columns: 0, rows: 0 });
  assert.equal(s.output.written, ENTER);
  s.keys('5', 'p');
  s.clock.tick(FRAME_MS);
  assert.equal(s.output.written, ENTER);
  Object.assign(s.output, { columns: 80, rows: 24 });
  s.output.emit('resize');
  assert.match(s.since(0), /PLAYING/);
  s.keys('q');
  assert.equal(await s.done, 0);
  assertRestored(s);
});

test('process exit restores modes and clears a playing timer without a normal quit', () => {
  const s = live();
  s.keys('5', 'p');
  assert.equal(s.clock.timers.size, 1);
  s.proc.emit('exit', 0);
  assertRestored(s);
});

test('--plain is a one-shot snapshot even when both streams are terminals', async () => {
  const t = fakeTerminal();
  Object.assign(t.output, { isTTY: true, getColorDepth: () => 24 });
  const done = main(['--plain'], Object.assign(t.proc, { stdin: t.input, stdout: t.output }));
  if (t.input.isRaw) t.input.emit('data', 'q'); // release an accidentally interactive run
  assert.equal(await done, 0);
  assert.doesNotMatch(t.output.written, /\x1b/);
  assert.match(t.output.written, /SNAPSHOT: RUN IN A TERMINAL TO BROWSE/);
  assert.equal(t.input.listenerCount('data'), 0);
});

test('main rejects an unavailable terminal width instead of guessing', async () => {
  const err = [];
  const io = { stdout: { isTTY: true, columns: 0, getColorDepth: () => 24, write() {} }, stdin: { isTTY: false }, stderr: { write: (s) => err.push(s) } };
  assert.equal(await main([], io), 2);
  assert.match(err.join(''), /storybook: terminal width unavailable/);
});

test('snapshots: full height without rows, exact size with rows, same cells in color', () => {
  const full = renderSnapshot({ columns: 80, color: 'none' });
  assert.match(full, /CONTRACT {2}elements\/numbered-panel\/README\.md/);
  assert.doesNotMatch(full, /LINES \d/);
  const sized = renderSnapshot({ columns: 48, rows: 10, color: 'none' }).trimEnd().split('\n');
  assert.equal(sized.length, 10);
  assert.ok(sized.every((l) => [...l].length <= 48));
  assert.equal(stripVTControlCharacters(renderSnapshot({ columns: 48, rows: 10, color: 'truecolor' })).split('\n').map((l) => l.trimEnd()).join('\n'), sized.join('\n') + '\n');
});

test('CLI prints a snapshot and exits when stdout is not a terminal', () => {
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', timeout: 10_000, env: { ...process.env, NO_COLOR: '' } });
  const piped = run();
  assert.equal(piped.status, 0);
  assert.doesNotMatch(piped.stdout, /\x1b/);
  assert.ok(piped.stdout.split('\n').every((l) => [...l].length <= 80));
  assert.match(piped.stdout, /SNAPSHOT: RUN IN A TERMINAL TO BROWSE/);
  const sized = run('--plain', '--columns', '1', '--rows', '1');
  assert.equal(sized.status, 0);
  assert.equal(sized.stdout, '0\n');
  assert.match(run('--color', '--columns', '60').stdout, /\x1b\[0;/);
  for (const bad of [['--columns', '0'], ['--rows', 'x'], ['--columns', '1e3'], ['--plain', '--color'], ['--story', 'gauge'], ['--list'], ['--json']]) {
    const r = run(...bad);
    assert.equal(r.status, 2, bad.join(' '));
    assert.match(r.stderr, /Usage:/);
  }
  const help = run('--help');
  assert.equal(help.status, 0);
  assert.match(help.stdout, /p plays or pauses a motion preview/);
});


function click(s, state, action, options = {}) {
  const view = composeStorybook(state, { columns: s.output.columns, rows: s.output.rows, mode: 'TRUECOLOR', ...options });
  const target = view.targets.find((t) => t.action === action);
  assert.ok(target, `visible target ${action}`);
  s.keys(`\x1b[<0;${target.column};${target.row}M`, `\x1b[<0;${target.column};${target.row}m`);
  return press(state, action, { ...view, mode: 'TRUECOLOR', now: s.clock.t });
}

test('clicking every story row and variant name matches keyboard browsing exactly', async () => {
  const mouse = live({ columns: 160, rows: 40 });
  const keyboard = live({ columns: 160, rows: 40 });
  let state = initialState();
  for (const [i, story] of STORIES.entries()) {
    let m = mouse.output.written.length;
    let k = keyboard.output.written.length;
    state = click(mouse, state, `story:${i}`);
    keyboard.keys(String(i + 1));
    assert.equal(mouse.output.written.slice(m), keyboard.output.written.slice(k), `story ${i}`);
    for (let variant = 1; variant < story.variants.length; variant++) {
      m = mouse.output.written.length;
      k = keyboard.output.written.length;
      state = click(mouse, state, `variant:${variant}`);
      keyboard.keys('l');
      assert.equal(mouse.output.written.slice(m), keyboard.output.written.slice(k), `${story.id} variant ${variant}`);
    }
  }
  mouse.keys('q');
  keyboard.keys('q');
  assert.equal(await mouse.done, 0);
  assert.equal(await keyboard.done, 0);
  assertRestored(mouse);
  assertRestored(keyboard);
});

test('footer clicks match all keyboard actions, playback timer cleanup, paging, and help/close', async () => {
  const mouse = live({ columns: 160, rows: 24 });
  const keyboard = live({ columns: 160, rows: 24 });
  mouse.keys('5');
  keyboard.keys('5');
  let state = press(initialState(), 'story:4');
  for (const [action, key] of [['play-pause', 'p'], ['play-pause', 'p'], ['replay', 'r'], ['motion-off', 'o'], ['page-down', ' '], ['page-up', 'b'], ['replay', 'r'], ['help', '?'], ['page-down', ' '], ['page-up', 'b'], ['close-help', '?'], ['next-variant', 'l'], ['prev-variant', 'h'], ['next-story', 'j'], ['prev-story', 'k'], ['replay', 'r']]) {
    const m = mouse.output.written.length;
    const k = keyboard.output.written.length;
    state = click(mouse, state, action);
    keyboard.keys(key);
    assert.equal(mouse.output.written.slice(m), keyboard.output.written.slice(k), action);
    assert.equal(mouse.clock.timers.size, keyboard.clock.timers.size, action);
  }
  assert.equal(mouse.clock.timers.size, 1);
  click(mouse, state, 'quit');
  keyboard.keys('q');
  assert.equal(await mouse.done, 0);
  assert.equal(await keyboard.done, 0);
  assertRestored(mouse);
  assertRestored(keyboard);
});

test('rapid Esc plus mouse input closes help or quits without coordinate shortcuts', async () => {
  for (const report of ['\x1b[<2;3;4M', '\x1b[<0;3;4m', '\x1b[Mq12']) {
    const s = live();
    s.keys('?');
    const mark = s.output.written.length;
    s.keys('\x1b' + report);
    assert.match(s.since(mark), /COMPONENT 1\/8/);
    assert.doesNotMatch(s.since(mark), /COMPONENT [234]\/8/);
    assert.equal(s.input.isRaw, true);
    s.keys('q');
    assert.equal(await s.done, 0);
    assertRestored(s);
  }
  for (const count of [1, 2, 3, 4, 5]) {
    const s = live();
    if (count > 1) s.keys('?');
    s.keys('\x1b'.repeat(count) + '\x1b[<0;3;4M5p');
    if (s.input.isRaw) s.keys('q'); // release a broken decoder before the restoration assertion
    assert.equal(await s.done, 0);
    assert.equal(s.clock.created, 0, 'input after Esc quit must not start playback');
    assertRestored(s);
  }
});

test('inert cells, releases, modifiers, offscreen and stale-resize coordinates never activate shortcuts', async () => {
  const s = live({ columns: 160, rows: 24 });
  const view = composeStorybook(initialState(), { columns: 160, rows: 24, mode: 'TRUECOLOR' });
  const row = view.targets.find((t) => t.action === 'story:4');
  let mark = s.output.written.length;
  s.keys('\x1b[<0;100;10M', '\x1b[<0;999;999M'); // content and outside the viewport
  for (const button of [1, 2, 4, 8, 16, 32, 64]) s.keys(`\x1b[<${button};${row.column};${row.row}M`);
  s.keys(`\x1b[<0;${row.column};${row.row}m`);
  assert.equal(s.output.written.length, mark);
  Object.assign(s.output, { columns: 0, rows: 0 });
  s.output.emit('resize');
  s.keys(`\x1b[<0;${row.column};${row.row}M`);
  assert.equal(s.output.written.length, mark, 'invalid viewport has no live targets');
  Object.assign(s.output, { columns: 20, rows: 4 });
  s.output.emit('resize');
  mark = s.output.written.length;
  s.keys(`\x1b[<0;${row.column};${row.row}M`);
  assert.equal(s.output.written.length, mark, 'old sidebar no longer exists');
  Object.assign(s.output, { columns: 160, rows: 24 }); // dimensions changed without a resize event
  s.keys(`\x1b[<0;${row.column};${row.row}M`);
  assert.equal(s.output.written.length, mark, 'unpainted geometry is never live');
  s.output.emit('resize');
  click(s, initialState(), 'story:4');
  assert.match(s.since(mark), /SCAN/);
  s.keys('q');
  assert.equal(await s.done, 0);
  assertRestored(s);
});

test('story 8 COLORS: key 8, views, paging, and footer clicks match the keyboard; it never starts a timer', async () => {
  const mouse = live({ columns: 120, rows: 24 });
  const keyboard = live({ columns: 120, rows: 24 });
  let mark = keyboard.output.written.length;
  keyboard.keys('8');
  for (const shown of [/> 08 COLORS/, /▐08▌ COLORS ─+ FOUNDATION 8\/8/, /VIEW {2}\[PALETTE\] {2}SHADES/]) assert.match(keyboard.since(mark), shown);
  let state = click(mouse, initialState(), 'story:7');
  for (const [action, key] of [['page-down', ' '], ['page-down', ' '], ['page-up', 'b'], ['next-variant', 'l'], ['page-down', ' '], ['variant:0', 'h'], ['help', '?'], ['close-help', '?'], ['next-story', 'j'], ['prev-story', 'k']]) {
    const m = mouse.output.written.length;
    const k = keyboard.output.written.length;
    state = click(mouse, state, action);
    keyboard.keys(key);
    assert.equal(mouse.output.written.slice(m), keyboard.output.written.slice(k), action);
  }
  mark = keyboard.output.written.length;
  keyboard.keys('l');
  assert.match(keyboard.since(mark), /VIEW {3}PALETTE {2}\[SHADES\]/);
  mark = keyboard.output.written.length;
  keyboard.keys('p', 'r', 'o');
  assert.equal(keyboard.output.written.length, mark, 'playback keys do nothing on a color view');
  const view = composeStorybook(press(press(initialState(), 'story:7'), 'next-variant'), { columns: 120, rows: 24, mode: 'TRUECOLOR' });
  assert.ok(!view.targets.some((t) => ['play-pause', 'replay', 'motion-off'].includes(t.action)), 'no playback controls');
  for (const s of [mouse, keyboard]) {
    assert.equal(s.clock.created, 0, 'colors never play');
    s.keys('q');
    assert.equal(await s.done, 0);
    assertRestored(s);
  }
});

test('CLI help and the key list count all eight stories', () => {
  const help = spawnSync(process.execPath, [SCRIPT, '--help'], { encoding: 'utf8', timeout: 10_000 });
  assert.match(help.stdout, /1-8 jump to one/);
  assert.equal(STORIES.length, 8);
});
