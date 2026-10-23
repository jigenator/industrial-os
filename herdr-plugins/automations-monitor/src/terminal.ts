// The terminal as a scoped Effect service: raw mode, the alternate screen, SGR mouse reporting, key and mouse
// parsing, resize, and restoration on every exit path. It is the monitor's own rather than Effect's, for SGR
// mouse reports, a lone Esc as a key, and synchronous restoration from handlers. Restoring is idempotent:
// quitting, a signal or an uncaught error restores the screen at once, before any read is torn down.
import { Context, Effect, Layer, Queue, Stream } from 'effect';
import type { Input, Key } from './ui.ts';

export type TermEvent =
  | Input
  | { readonly _tag: 'Resize' }
  // A hangup or termination signal: quit like `q`.
  | { readonly _tag: 'Quit' }
  // An error thrown outside the app's fibers, already redacted.
  | { readonly _tag: 'Fatal'; readonly error: unknown };

export class Terminal extends Context.Service<Terminal, {
  readonly size: Effect.Effect<{ readonly cols: number; readonly rows: number }>;
  readonly events: Stream.Stream<TermEvent>;
  readonly write: (text: string) => Effect.Effect<void>;
  readonly restore: Effect.Effect<void>;
}>()('automations-monitor/Terminal') {}

const ENTER = '\x1b[?1049h\x1b[?25l\x1b[?1000h\x1b[?1006h\x1b[2J';
const LEAVE = '\x1b[?1006l\x1b[?1000l\x1b[0m\x1b[?25h\x1b[?1049l';

const SIMPLE: Record<string, Key> = {
  q: 'q', Q: 'q', '\x03': 'ctrl-c', '\x04': 'ctrl-d', '\r': 'enter', '\n': 'enter', ' ': 'space',
  '1': '1', '2': '2', f: 'f', F: 'f', l: 'l', L: 'l', m: 'm', M: 'm', r: 'r', R: 'r', j: 'down', k: 'up',
};
const CSI: Record<string, Key> = { A: 'up', B: 'down', '5~': 'pageup', '6~': 'pagedown' };

// Bytes from the terminal in, inputs out. A lone ESC is the Escape key; other escape sequences are arrows,
// page keys or SGR mouse reports (`ESC [ < button ; column ; row M`), and anything else is ignored.
export function parseInput(data: string): Input[] {
  const out: Input[] = [];
  for (let i = 0; i < data.length;) {
    const ch = data[i]!;
    if (ch !== '\x1b') {
      const key = SIMPLE[ch];
      if (key) out.push({ _tag: 'Key', key });
      i += 1;
      continue;
    }
    const next = data[i + 1];
    if (next !== '[' && next !== 'O') {
      out.push({ _tag: 'Key', key: 'escape' });
      i += 1;
      continue;
    }
    const mouse = /^\x1b\[<(\d+);(\d+);(\d+)([Mm])/.exec(data.slice(i));
    if (mouse) {
      const [all, b, x, y, kind] = mouse;
      const button = Number(b);
      if (button === 64 || button === 65) out.push({ _tag: 'Wheel', delta: button === 64 ? -1 : 1 });
      else if ((button & 0b11100011) === 0 && kind === 'M') out.push({ _tag: 'Click', x: Number(x) - 1, y: Number(y) - 1 });
      i += all.length;
      continue;
    }
    const seq = /^\x1b[[O]([\d;]*[A-Za-z~])/.exec(data.slice(i));
    if (seq) {
      const key = CSI[seq[1]!];
      if (key) out.push({ _tag: 'Key', key });
      i += seq[0].length;
      continue;
    }
    i += 2;
  }
  return out;
}

export const liveTerminal = Layer.effect(Terminal, Effect.gen(function* () {
  const stdin = process.stdin, stdout = process.stdout;
  const queue = yield* Queue.unbounded<TermEvent>();
  const push = (e: TermEvent) => void Queue.offerUnsafe(queue, e);
  const write = (text: string) => {
    try {
      stdout.write(text);
    } catch {
      // The pane is gone; nothing to draw on.
    }
  };
  let active = true;
  const onData = (chunk: Buffer | string) => parseInput(String(chunk)).forEach(push);
  const onResize = () => push({ _tag: 'Resize' });
  const restore = () => {
    if (!active) return;
    active = false;
    stdin.off('data', onData);
    stdout.off('resize', onResize);
    try {
      if (stdin.isTTY) stdin.setRawMode(false);
      stdin.pause();
    } catch {
      // Already closed.
    }
    write(LEAVE);
  };
  // Signal and error handlers restore the screen first and then ask the app to stop. They stay installed
  // until the process exits, so a second signal cannot cut the teardown of a read short.
  const onSignal = () => {
    restore();
    push({ _tag: 'Quit' });
  };
  const onFatal = (error: unknown) => {
    restore();
    push({ _tag: 'Fatal', error });
  };
  stdout.on('error', () => {});
  yield* Effect.acquireRelease(
    Effect.sync(() => {
      for (const sig of ['SIGHUP', 'SIGTERM', 'SIGINT'] as const) process.on(sig, onSignal);
      process.on('uncaughtException', onFatal);
      process.on('unhandledRejection', onFatal);
      write(ENTER);
      if (stdin.isTTY) stdin.setRawMode(true);
      stdin.on('data', onData);
      stdin.resume();
      stdout.on('resize', onResize);
    }),
    () => Effect.sync(restore),
  );
  return Terminal.of({
    size: Effect.sync(() => ({ cols: Math.max(1, stdout.columns || 80), rows: Math.max(1, stdout.rows || 24) })),
    events: Stream.fromQueue(queue),
    write: (text) => Effect.sync(() => {
      if (active) write(text);
    }),
    restore: Effect.sync(restore),
  });
}));
