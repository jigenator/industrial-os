import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { colorMode, runTerminal, sizeOption } from './terminal-host.mjs';

function fakeTerminal() {
  const input = Object.assign(new EventEmitter(), {
    isRaw: false,
    paused: true,
    setRawMode(mode) {
      this.isRaw = mode;
    },
    resume() {
      this.paused = false;
    },
    pause() {
      this.paused = true;
    },
  });
  const output = Object.assign(new EventEmitter(), { columns: 10, rows: 2, written: '', write(s) {
    this.written += s;
  } });
  const proc = Object.assign(new EventEmitter(), { stderr: { text: '', write(s) {
    this.text += s;
  } } });
  return { input, output, proc };
}

const restored = ({ input, output, proc }) => {
  assert.ok(output.written.endsWith('\x1b[0m\x1b[?25h\x1b[?1049l'));
  assert.equal(input.isRaw, false);
  assert.equal(input.listenerCount('data'), 0);
  assert.equal(output.listenerCount('resize'), 0);
  for (const event of ['SIGINT', 'SIGTERM', 'SIGHUP', 'exit']) assert.equal(proc.listenerCount(event), 0, event);
};

test('size and color options', () => {
  assert.equal(sizeOption(undefined, 'rows'), undefined);
  assert.equal(sizeOption('1000', 'rows'), 1000);
  for (const bad of ['0', '1001', '-1', '1e3', '2.5', ' 8', '']) assert.throws(() => sizeOption(bad, 'rows'), RangeError, bad);
  const tty = (depth) => ({ isTTY: true, getColorDepth: () => depth });
  assert.equal(colorMode({}, tty(24)), 'truecolor');
  assert.equal(colorMode({}, tty(8)), 'none');
  assert.equal(colorMode({}, { isTTY: false }), 'none');
  assert.equal(colorMode({ plain: true }, tty(24)), 'none');
  assert.equal(colorMode({ color: true }, { isTTY: false }), 'truecolor');
});

test('host keys reach the caller, Ctrl-C always quits 130, and onStop runs once before restoring', async () => {
  const t = fakeTerminal();
  const seen = [];
  let stops = 0;
  const done = runTerminal({
    ...t,
    color: 'none',
    name: 'check',
    render: ({ columns }) => [[{ text: 'x'.repeat(columns), style: {} }]],
    onKey: (key, host) => {
      seen.push(key);
      if (key === 'r') host.redraw();
    },
    onStop: () => {
      stops++;
      assert.equal(t.input.isRaw, true, 'onStop runs before modes are restored');
    },
  });
  assert.match(t.output.written, /\x1b\[1;1Hxxxxxxxxxx\x1b\[2;1H {10}/);
  t.input.emit('data', 'ar\x1b[A');
  assert.deepEqual(seen, ['a', 'r', '\x1b[A']);
  t.input.emit('data', '\x03');
  assert.equal(await done, 130);
  t.proc.emit('SIGTERM', 'SIGTERM'); // already finished: ignored
  assert.equal(stops, 1);
  restored(t);
});

test('a throwing key handler or onStop still restores the terminal and exits 1', async () => {
  for (const fail of ['key', 'stop', 'guard']) {
    const t = fakeTerminal();
    let host;
    const done = runTerminal({
      ...t,
      color: 'none',
      name: 'check',
      render: () => [],
      onKey: (key, h) => {
        host = h;
        if (fail === 'key') throw new Error('key failure');
        if (fail === 'guard') h.guard(() => { throw new Error('guard failure'); })();
        else h.quit(0);
      },
      onStop: () => {
        if (fail === 'stop') throw new Error('stop failure');
      },
    });
    t.input.emit('data', 'k');
    assert.equal(await done, 1, fail);
    restored(t);
    assert.match(t.proc.stderr.text, new RegExp(`^check: Error: ${fail} failure`));
    host.redraw(); // after finishing, drawing is a no-op
    assert.ok(t.output.written.endsWith('\x1b[0m\x1b[?25h\x1b[?1049l'));
  }
});

test('mouse modes are opt-in, enable only 1000/1006, and restore on every cleanup path', async () => {
  const modes = '\x1b[?1006h\x1b[?1000h';
  const off = '\x1b[?1000l\x1b[?1006l';
  for (const scenario of ['key', 'click', 'ctrl-c', 'SIGINT', 'SIGTERM', 'SIGHUP', 'exit', 'render', 'handler', 'stop', 'setup']) {
    const t = fakeTerminal();
    if (scenario === 'setup') t.input.setRawMode = () => { throw new Error('setup failure'); };
    const done = runTerminal({
      ...t, color: 'none', name: 'mouse-check',
      render: () => { if (scenario === 'render') throw new Error('render failure'); return []; },
      onKey: (_key, host) => host.quit(0),
      onClick: (_point, host) => { if (scenario === 'handler') throw new Error('handler failure'); host.quit(0); },
      onStop: () => { if (scenario === 'stop') throw new Error('stop failure'); },
    });
    if (['click', 'handler', 'stop'].includes(scenario)) t.input.emit('data', '\x1b[<0;1;1M');
    else if (scenario === 'key') t.input.emit('data', 'q');
    else if (scenario === 'ctrl-c') t.input.emit('data', '\x03');
    else if (['SIGINT', 'SIGTERM', 'SIGHUP'].includes(scenario)) t.proc.emit(scenario, scenario);
    else if (scenario === 'exit') t.proc.emit('exit', 0);
    const code = await done;
    assert.equal(code, { 'ctrl-c': 130, SIGINT: 130, SIGTERM: 143, SIGHUP: 129, render: 1, handler: 1, stop: 1, setup: 1 }[scenario] ?? 0, scenario);
    assert.ok(t.output.written.includes(modes), scenario);
    assert.ok(t.output.written.endsWith(off + '\x1b[0m\x1b[?25h\x1b[?1049l'), scenario);
    assert.doesNotMatch(t.output.written, /\x1b\[\?(1002|1003|1016)h/);
    restored(t);
  }
  const t = fakeTerminal();
  const done = runTerminal({ ...t, color: 'none', name: 'keyboard-only', render: () => [], onKey: (_, host) => host.quit(0) });
  t.input.emit('data', 'q');
  assert.equal(await done, 0);
  assert.doesNotMatch(t.output.written, /\x1b\[\?100[06][hl]/, 'showcase/default does not change mouse modes');
});

test('mouse is bounded by the current viewport and coalesced input stops after quit', async () => {
  const t = fakeTerminal();
  let clicks = 0;
  let keys = 0;
  const done = runTerminal({ ...t, color: 'none', name: 'mouse-check', render: () => [], onKey: () => keys++, onClick: (_point, host) => { clicks++; host.quit(0); } });
  t.input.emit('data', '\x1b[<0;11;1M\x1b[<0;1;3M');
  assert.equal(clicks, 0);
  t.input.emit('data', '\x1b[<0;1;1M5p\x1b[<0;1;1M');
  assert.equal(await done, 0);
  assert.equal(clicks, 1);
  assert.equal(keys, 0, 'nothing in the same chunk runs after quit');
  restored(t);
});
