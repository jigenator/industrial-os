// Polling as a Stream: one read cycle at a time (pipelines, then schedules), the next one an interval after
// the previous cycle finished, or at once when a refresh is requested while idle. A refresh requested during
// a read is dropped, never queued. Time comes from Effect's Clock, so tests drive it with TestClock.
import { Effect, Queue, Result, Stream } from 'effect';
import type { PipelinesData, SchedulesData } from './contract.ts';
import { TatsuReader, type ReadFailure } from './reader.ts';

export const POLL_INTERVAL_MS = 10_000;

export type ReadOutcome<A> = Result.Result<A, ReadFailure>;

export type PollEvent =
  | { readonly _tag: 'Reading' }
  | {
    readonly _tag: 'Read';
    readonly at: number;
    readonly nextAt: number;
    readonly pipelines: ReadOutcome<PipelinesData>;
    readonly schedules: ReadOutcome<SchedulesData>;
  };

export const pollEvents = (refresh: Queue.Queue<void>, intervalMs = POLL_INTERVAL_MS): Stream.Stream<PollEvent, never, TatsuReader> =>
  Stream.unwrap(Effect.gen(function* () {
    const reader = yield* TatsuReader;
    const cycle = Stream.concat(
      Stream.succeed<PollEvent>({ _tag: 'Reading' }),
      Stream.fromEffect(Effect.gen(function* () {
        const pipelines = yield* Effect.result(reader.pipelines);
        const schedules = yield* Effect.result(reader.schedules);
        // Requests made while reading are satisfied by this read.
        yield* Queue.clear(refresh);
        const at = yield* Effect.clockWith((clock) => clock.currentTimeMillis);
        return { _tag: 'Read', at, nextAt: at + intervalMs, pipelines, schedules } satisfies PollEvent;
      })),
    );
    const wait = Stream.fromEffectDrain(Effect.raceFirst(Effect.sleep(intervalMs), Queue.take(refresh)));
    return Stream.concat(cycle, Stream.forever(Stream.concat(wait, cycle)));
  }));
