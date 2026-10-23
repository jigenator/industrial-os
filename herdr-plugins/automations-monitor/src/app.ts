// The live pane: terminal events, poll results and frame ticks merged into one stream, folded through the
// pure state transitions, and drawn by writing only the rows that changed. Quitting restores the terminal at
// once; the read in flight is then interrupted and its process group torn down before the app returns.
import { paint } from '@industrial-os/design-system/foundation/cells';
import { Clock, Effect, Queue, Ref, Stream } from 'effect';
import { pollEvents, type PollEvent } from './poller.ts';
import type { TatsuReader } from './reader.ts';
import { Terminal, type TermEvent } from './terminal.ts';
import { toLampEdge } from './theme.ts';
import { applyPoll, initialState, update, type AppState } from './ui.ts';
import { renderFrame, type Frame } from './view/frame.ts';

export class AppDefect extends Error {
  constructor(readonly error: unknown) {
    super(error instanceof Error ? error.message : String(error));
  }
}

type Event = TermEvent | { readonly _tag: 'Poll'; readonly event: PollEvent } | { readonly _tag: 'Tick' };

// Whether anything on screen moves: the blink of a running run's head, a firing schedule, a run's phase.
export function animating(state: AppState): boolean {
  if (!state.ui.motion) return false;
  return Boolean(state.pipelines.value?.runs.some((r) => r.outcome === null && r.phase !== 'terminal') || state.schedules.value?.schedules.some((s) => s.active_run));
}

// Until the next change on screen: the next lamp edge while something blinks, else the next second (ages and
// the clock are shown in seconds).
export function frameDelay(state: AppState, now: number, t: number): number {
  const second = 1000 - (now % 1000);
  if (!animating(state)) return second;
  return Math.max(1, Math.min(second, toLampEdge(t)));
}

export const runApp = (options: { motion: boolean }) => Effect.gen(function* () {
  const term = yield* Terminal;
  const refresh = yield* Queue.unbounded<void>();
  const started = yield* Clock.currentTimeMillis;
  const stateRef = yield* Ref.make(initialState(options.motion));
  let previous: string[] = [];
  let frame: Frame | null = null;

  const draw = (force: boolean) => Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    const { cols, rows } = yield* term.size;
    const state = yield* Ref.get(stateRef);
    frame = renderFrame(state, { cols, rows, now, t: now - started });
    // The frame settles the scroll position (selection kept in view, clamped to the list).
    if (frame.scroll !== state.ui.scroll || state.ui.snap) yield* Ref.set(stateRef, { ...state, ui: { ...state.ui, scroll: frame.scroll, snap: false } });
    const lines = frame.lines.map((l) => paint(l, 'truecolor'));
    let out = force || lines.length !== previous.length ? '\x1b[2J' : '';
    if (out) previous = [];
    lines.forEach((line, i) => {
      if (line !== previous[i]) out += `\x1b[${i + 1};1H${line}`;
    });
    previous = lines;
    if (out) yield* term.write(out);
  });

  const ticks = Stream.fromEffectRepeat(Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    yield* Effect.sleep(frameDelay(yield* Ref.get(stateRef), now, now - started));
    return { _tag: 'Tick' } as const;
  }));
  const events = Stream.mergeAll<Event, never, TatsuReader>([
    term.events,
    pollEvents(refresh).pipe(Stream.map((event): Event => ({ _tag: 'Poll', event }))),
    ticks,
  ], { concurrency: 'unbounded' });

  const handle = (e: Event): Effect.Effect<boolean, AppDefect> => Effect.gen(function* () {
    switch (e._tag) {
      case 'Quit':
        yield* term.restore;
        return false;
      case 'Fatal':
        return yield* Effect.fail(new AppDefect(e.error));
      case 'Tick':
        yield* draw(false);
        return true;
      case 'Resize':
        yield* draw(true);
        return true;
      case 'Poll':
        yield* Ref.update(stateRef, (s) => applyPoll(s, e.event));
        yield* draw(false);
        return true;
      default: {
        if (!frame) return true;
        const { state, effect } = update(yield* Ref.get(stateRef), e, frame);
        yield* Ref.set(stateRef, state);
        if (effect === 'quit') {
          yield* term.restore;
          return false;
        }
        if (effect === 'refresh') yield* Queue.offer(refresh, undefined);
        yield* draw(false);
        return true;
      }
    }
  });

  yield* draw(true);
  yield* Stream.runForEachWhile(events, handle).pipe(Effect.ensuring(term.restore));
});
