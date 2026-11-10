import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
import { createDecoder } from '../src/input.mjs';
import { clean, display, editText, inputText, graphemes, caretAt } from '../src/text.mjs';
import { createHost } from '../src/host.mjs';
import { createState, focusField, selectSlide, chatAim } from '../src/model.mjs';
import { createScheduler } from '../src/scheduler.mjs';
import { createController } from '../src/controller.mjs';
import { render, plainFrame } from '../src/render.mjs';
import { connect, settle } from './fake-ai.mjs';
// No timer is real in lifecycle checks, including the lone-Esc decoder delay.
function clock() {
  let seq = 0;
  const timers = new Map();
  return {
    setTimeout(fn) {
      const id = ++seq;
      timers.set(id, fn);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    get size() {
      return timers.size;
    },
  };
}
test('text boundary strips terminal/bidi injection; unsupported graphemes one ?, whole-grapheme cursor/delete', () => {
  const source = 'e\u0301😀';
  assert.equal(graphemes(source).length, 2);
  assert.equal(display(source), '??');
  assert.equal(source, 'e\u0301😀');
  assert.equal(editText(source, 2, 'backspace').text, 'e\u0301');
  assert.equal(editText(source, 1, 'delete').text, 'e\u0301');
  assert.equal(editText(source, 1, 'backspace').text, '😀');
  assert.equal(display('\x1b[31m\x00hello\u202e'), '[31mhello');
  assert.ok(!/\x1b|\u202e/.test(clean('\x1b[2J\u202e')));
  const lines = 'first\nsecond';
  assert.equal(editText(lines, 9, 'up').cursor, 3);
  assert.equal(editText(lines, 3, 'down').cursor, 9);
});
test('incremental input, arrows, paste is literal, escape is bounded, terminal replies consumed', () => {
  const d = createDecoder();
  assert.deepEqual(d.feed('\x1b['), []);
  assert.deepEqual(d.feed('A'), [{ key: 'up' }]);
  assert.deepEqual(d.feed('\x1b[3~'), [{ key: 'delete' }]);
  assert.deepEqual(d.feed('\x1b[Z'), [{ key: 'shift-tab' }]);
  // Typed text beyond ASCII arrives whole, one character at a time; C1 controls are dropped. Boxes then keep
  // only what they can measure: ASCII and the curated one-cell glyphs.
  assert.equal(inputText('a·b—é😀\tc'), 'a·b—c');
  assert.deepEqual(
    d.feed('·é😀\x85').map((e) => e.text),
    ['·', 'é', '😀'],
  );
  assert.deepEqual(d.feed('\x1b'), []);
  assert.equal(d.waitingEscape, true);
  assert.deepEqual(d.flushEscape(), [{ key: 'escape' }]);
  assert.deepEqual(d.feed('\x1b_Gi=1;OK\x1b\\'), []);
  assert.deepEqual(d.feed('\x1b]52;c;secret\x07'), []);
  assert.deepEqual(d.feed('\x1b[200~qvm'), []);
  assert.deepEqual(d.feed('012?\n\x1b[201~'), [{ key: 'paste', text: 'qvm012?\n' }]);
  assert.deepEqual(d.feed('\x03\x07\x0f\x13'), [
    { key: 'ctrl-c' },
    { key: 'ctrl-g' },
    { key: 'ctrl-o' },
    { key: 'ctrl-s' },
  ]);
});
test('prompt cap rejects without losing draft; input over cap rejected atomically; blank send no job', () => {
  const s = createState(),
    jobs = createScheduler(s),
    c = createController(s, jobs);
  connect(s, jobs);
  c.handle({ key: 'ctrl-g' });
  c.handle({ key: 'paste', text: 'x'.repeat(4001) });
  c.handle({ key: 'enter' });
  assert.equal(s.chatDraft.length, 4001);
  assert.equal(s.chat.length, 0);
  assert.match(s.notice, /4000/);
  const before = s.chatDraft;
  c.handle({ key: 'paste', text: 'y'.repeat(20000) });
  assert.equal(s.chatDraft, before);
  s.chatDraft = '  ';
  c.handle({ key: 'enter' });
  assert.equal(s.jobs.length, 0);
  jobs.dispose();
  assert.equal(jobs.running, 0);
});
test('every focusable content field captures send-time target and composer restores exact origin', async () => {
  const s = createState(),
    jobs = createScheduler(s),
    c = createController(s, jobs);
  connect(s, jobs);
  selectSlide(s, 'S-6');
  for (const field of ['title', 'purpose', 'imageDesc', 'afterDesc', 'beforeCap', 'afterCap', 'notes']) {
    focusField(s, field);
    s.choice = 2;
    c.handle({ key: 'ctrl-g' });
    assert.equal(chatAim(s).field, field);
    s.chatDraft = field;
    c.handle({ key: 'enter' });
    assert.equal(s.jobs.at(-1).field, field);
    c.handle({ key: 'ctrl-g' });
    assert.equal(s.control, field);
    assert.equal(s.choice, 2);
  }
  const stamps = s.chat.filter((x) => x.role === 'You').map((x) => x.stamp);
  selectSlide(s, 'S-3');
  assert.deepEqual(chatAim(s), { slideId: 'S-3' });
  assert.deepEqual(
    s.chat.filter((x) => x.role === 'You').map((x) => x.stamp),
    stamps,
  );
  jobs.dispose();
  await settle();
  assert.equal(jobs.running, 0);
});
test('host teardown idempotent: pending jobs + queued Esc timer, stream/signal handlers, raw mode', () => {
  const timer = clock(),
    input = new EventEmitter(),
    output = new EventEmitter(),
    signals = new EventEmitter();
  Object.assign(input, {
    isTTY: true,
    isRaw: false,
    setRawMode(v) {
      this.isRaw = v;
    },
    resume() {},
    pause() {},
  });
  Object.assign(output, { isTTY: true, columns: 100, rows: 40, write() {} });
  const host = createHost({ input, output, signals, clock: timer, env: {}, mode: 'text' });
  host.start();
  connect(host.state, host.scheduler);
  focusField(host.state, 'content');
  host.scheduler.send('job');
  assert.equal(host.scheduler.running, 1);
  input.emit('data', Buffer.from('\x1b'));
  assert.equal(timer.size, 1);
  host.stop();
  host.stop();
  assert.equal(timer.size, 0);
  assert.equal(host.scheduler.running, 0);
  assert.equal(input.isRaw, false);
  assert.equal(input.listenerCount('data'), 0);
  assert.equal(output.listenerCount('resize'), 0);
  for (const name of ['SIGINT', 'SIGTERM', 'SIGHUP', 'uncaughtException', 'unhandledRejection'])
    assert.equal(signals.listenerCount(name), 0);
});
test(
  'real PTY smoke: keyboard edit/chat/help/quit, resize diagnostic, forced PNG pair, ' + 'signals, mode restoration',
  () => {
    const result = execFileSync('python3', ['lesson-maker/test/pty-smoke.py'], {
      encoding: 'utf8',
      timeout: 30000,
      cwd: root,
    });
    const summary = JSON.parse(result);
    assert.equal(summary.runs, 6);
    assert.equal(summary.restored, true);
    assert.equal(summary.pair, true);
    assert.equal(summary.ixonDisabled, true);
  },
);

test('editing keys: readline Ctrl keys, Option and Ctrl word moves, Cmd arrows, word and line deletes', () => {
  const keys = (bytes) =>
    createDecoder()
      .feed(bytes)
      .map((e) => e.key);
  assert.deepEqual(keys('\x01\x05\x02\x06\x04\x0b\x15\x17'), [
    'home',
    'end',
    'left',
    'right',
    'delete',
    'kill-end',
    'kill-start',
    'word-backspace',
  ]);
  // Option as Meta, then xterm modified arrows: Option and Ctrl by word, Cmd to the line's ends, Shift ignored.
  assert.deepEqual(keys('\x1bb\x1bf\x1bd\x1b\x7f'), ['word-left', 'word-right', 'word-delete', 'word-backspace']);
  assert.deepEqual(keys('\x1b[1;3D\x1b[1;5C\x1b[1;9D\x1b[1;9C\x1b[1;2D'), [
    'word-left',
    'word-right',
    'home',
    'end',
    'left',
  ]);
  const t = 'one two  three\nfour five',
    at = (cursor, key) => editText(t, cursor, key);
  assert.equal(at(9, 'word-left').cursor, 4);
  assert.equal(at(3, 'word-right').cursor, 7);
  assert.equal(at(9, 'word-backspace').text, 'one three\nfour five');
  assert.equal(at(4, 'word-delete').text, 'one   three\nfour five');
  assert.equal(at(4, 'kill-end').text, 'one \nfour five');
  assert.equal(at(14, 'kill-end').text, 'one two  threefour five');
  assert.deepEqual(at(8, 'kill-start'), { text: ' three\nfour five', cursor: 0 });
  assert.equal(at(20, 'home').cursor, 15);
});

test('caretAt maps a clicked row and column to the caret index the drawing would show there', () => {
  const t = 'one two three four\nfive';
  // Width 9 wraps to: "one two" / "three" / "four" / "five".
  assert.equal(caretAt(t, 9, 0, 4), 4);
  assert.equal(caretAt(t, 9, 1, 2), 'one two '.length + 2);
  assert.equal(caretAt(t, 9, 1, 30), 'one two three'.length);
  assert.equal(caretAt(t, 9, 3, 0), t.indexOf('five'));
  assert.equal(caretAt(t, 9, 9, 0), t.length);
});

test('Shift-Enter: kitty keyboard keys decode, and a new line goes into the chat draft and boxes', () => {
  const d = createDecoder();
  // Disambiguate mode: Shift-Enter, Esc, Ctrl and Option letters arrive as CSI u; legacy keys still work.
  assert.deepEqual(d.feed('\x1b[13;2u\x1b[27u\x1b[103;5u\x1b[99;5u\x1b[98;3u\x1b[9;2u\r\n\x1b\r'), [
    { key: 'newline' },
    { key: 'escape' },
    { key: 'ctrl-g' },
    { key: 'ctrl-c' },
    { key: 'word-left' },
    { key: 'shift-tab' },
    { key: 'enter' },
    { key: 'newline' },
    { key: 'newline' },
  ]);
  const s = createState(),
    c = createController(s, createScheduler(s));
  c.handle({ key: 'ctrl-g' });
  for (const text of 'one') c.handle({ key: 'text', text });
  c.handle({ key: 'newline' });
  for (const text of 'two') c.handle({ key: 'text', text });
  assert.equal(s.chatDraft, 'one\ntwo');
  // The composer shows the two lines and keeps the caret on the second.
  const f = render(s, 196, 50),
    rows = plainFrame(f).split('\n');
  assert.ok(rows.some((row) => /┃ one +┃/.test(row)) && rows.some((row) => /┃ two +┃/.test(row)));
  assert.equal(
    f.lines[f.cursor.y]
      .slice(f.cursor.x - 3, f.cursor.x)
      .map((cell) => cell.text)
      .join(''),
    'two',
  );
  // In a box Shift-Enter is a new line too.
  c.handle({ key: 'ctrl-g' });
  c.handle({ key: 'tab' });
  c.handle({ key: 'newline' });
  assert.equal(s.edit.text.at(-1), '\n');
});

test('Up/Down move by wrapped rows in a box and the message, keeping the column; past the ends to start or end', () => {
  const text = 'alpha beta gamma delta\nepsilon';
  // At width 11 the rows are "alpha beta", "gamma delta", "epsilon".
  let cursor = 3;
  ({ cursor } = editText(text, cursor, 'down', '', 11));
  assert.equal(cursor, 'alpha beta '.length + 3);
  ({ cursor } = editText(text, cursor, 'down', '', 11));
  assert.equal(cursor, 'alpha beta gamma delta\n'.length + 3);
  assert.equal(editText(text, cursor, 'down', '', 11).cursor, graphemes(text).length);
  ({ cursor } = editText(text, cursor, 'up', '', 11));
  assert.equal(cursor, 'alpha beta '.length + 3);
  assert.equal(editText(text, 3, 'up', '', 11).cursor, 0);
  // Without a width, the old line-by-line moves stay.
  assert.equal(editText(text, 3, 'down').cursor, 'alpha beta gamma delta\n'.length + 3);
});

test('Shift on arrows, Home, End and Option-arrows marks the key as extending the highlight', () => {
  const d = createDecoder();
  assert.deepEqual(d.feed('\x1b[1;2D\x1b[1;2B\x1b[1;2H\x1b[1;4C\x1b[D'), [
    { key: 'left', shift: true },
    { key: 'down', shift: true },
    { key: 'home', shift: true },
    { key: 'word-right', shift: true },
    { key: 'left' },
  ]);
});
