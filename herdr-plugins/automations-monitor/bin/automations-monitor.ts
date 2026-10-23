// The automations monitor. With no arguments: the live, full-screen pane (what Herdr runs).
// `--frame COLSxROWS`: one read of both commands, one frame printed to stdout, then exit; for development
// and checks. Frame options: --plain (no color), --no-motion, --time MS (blink phase), --screen schedules,
// --log (event log on), --modal (open the selected pipeline's runs).
import { paint } from '@industrial-os/design-system/foundation/cells';
import { BunChildProcessSpawner, BunFileSystem, BunPath, BunRuntime } from '@effect/platform-bun';
import { Cause, Effect, Exit, Layer, Queue, Stream } from 'effect';
import { AppDefect, runApp } from '../src/app.ts';
import { pollEvents } from '../src/poller.ts';
import { readerLayer } from '../src/reader.ts';
import { redact } from '../src/redact.ts';
import { liveTerminal } from '../src/terminal.ts';
import { applyPoll, initialState } from '../src/ui.ts';
import { renderFrame } from '../src/view/frame.ts';

const USAGE = 'usage: automations-monitor.ts [--no-motion] | --frame COLSxROWS [--plain] [--no-motion] [--time MS] [--screen pipelines|schedules] [--log] [--modal]';

interface Options {
  motion: boolean;
  plain: boolean;
  time: number;
  frame: { cols: number; rows: number } | null;
  screen: 'pipelines' | 'schedules';
  log: boolean | null;
  modal: boolean;
}

function parse(argv: string[]): Options | null {
  const o: Options = { motion: true, plain: false, time: 0, frame: null, screen: 'pipelines', log: null, modal: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!, v = argv[i + 1] ?? '';
    if (a === '--no-motion') o.motion = false;
    else if (a === '--plain') o.plain = true;
    else if (a === '--log') o.log = true;
    else if (a === '--modal') o.modal = true;
    else if (a === '--frame' && /^\d{1,4}x\d{1,4}$/.test(v)) {
      const [cols, rows] = v.split('x').map(Number) as [number, number];
      if (cols < 1 || rows < 1) return null;
      o.frame = { cols, rows };
      i++;
    } else if (a === '--time' && /^\d{1,9}$/.test(v)) {
      o.time = Number(v);
      i++;
    } else if (a === '--screen' && (v === 'pipelines' || v === 'schedules')) {
      o.screen = v;
      i++;
    } else return null;
  }
  const frameOnly = o.plain || o.time !== 0 || o.log !== null || o.modal || o.screen !== 'pipelines';
  return frameOnly && !o.frame ? null : o;
}

const options = parse(process.argv.slice(2));
if (!options) {
  process.stderr.write(USAGE + '\n');
  process.exit(2);
}

const platform = BunChildProcessSpawner.layer.pipe(Layer.provide(Layer.mergeAll(BunFileSystem.layer, BunPath.layer)));
const reader = readerLayer().pipe(Layer.provide(platform));

// One read cycle, one frame.
const frame = (o: Options, size: { cols: number; rows: number }) => Effect.gen(function* () {
  const refresh = yield* Queue.unbounded<void>();
  const events = yield* Stream.runCollect(pollEvents(refresh).pipe(Stream.take(2)));
  let state = initialState(o.motion);
  for (const e of events) state = applyPoll(state, e);
  state = { ...state, ui: { ...state.ui, screen: o.screen, log: o.log, modal: o.modal } };
  const now = Date.now();
  const lines = renderFrame(state, { ...size, now, t: o.time }).lines;
  process.stdout.write(lines.map((l) => paint(l, o.plain ? 'none' : 'truecolor')).join('\n') + '\n');
});

// Exit status: 0 for quitting and for signals, 1 for a failure. The process exits here, after every scope
// has closed, so no read outlives the pane.
const teardown = (exit: Exit.Exit<unknown, unknown>, onExit: (code: number) => void) => {
  const code = Exit.isSuccess(exit) || Cause.hasInterruptsOnly(exit.cause) ? 0 : 1;
  onExit(code);
  process.exit(code);
};

const report = (cause: Cause.Cause<unknown>) => Effect.sync(() => {
  if (Cause.hasInterruptsOnly(cause)) return;
  const error = Cause.squash(cause);
  const inner = error instanceof AppDefect ? error.error : error;
  const message = inner instanceof Error ? inner.message : typeof inner === 'string' ? inner : null;
  process.stderr.write(`automations-monitor: ${redact(message) ?? 'unexpected error'}\n`);
});

const program = options.frame
  ? frame(options, options.frame)
  : Effect.scoped(runApp({ motion: options.motion })).pipe(Effect.provide(liveTerminal));

BunRuntime.runMain(
  program.pipe(Effect.provide(reader), Effect.tapCause(report)),
  { disableErrorReporting: true, teardown },
);
