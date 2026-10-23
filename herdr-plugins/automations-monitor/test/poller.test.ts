// Polling against the fake `tatsu`: one read in flight, the interval measured after each read, and refresh
// requests during a read satisfied by that read rather than queued.
import { describe, expect, test } from 'bun:test';
import { Effect, Fiber, Queue, Result, Stream } from 'effect';
import { pollEvents, type PollEvent } from '../src/poller.ts';
import { readerLayer } from '../src/reader.ts';
import { FAKE, fakeLog, platform, use } from './support.ts';

const reads = (cycles: number, intervalMs: number, spamRefreshMs: number | null) =>
  Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const refresh = yield* Queue.unbounded<void>();
    if (spamRefreshMs !== null) yield* Effect.forkScoped(Effect.forever(Queue.offer(refresh, undefined).pipe(Effect.andThen(Effect.sleep(spamRefreshMs)))));
    const events = yield* Stream.runCollect(pollEvents(refresh, intervalMs).pipe(Stream.filter((e) => e._tag === 'Read'), Stream.take(cycles)));
    return Array.from(events) as Extract<PollEvent, { _tag: 'Read' }>[];
  })).pipe(Effect.provide(readerLayer({ command: FAKE })), Effect.provide(platform)));

describe('poller', () => {
  test('never overlaps reads, even with refresh requested constantly', async () => {
    const log = fakeLog();
    use('floor', log.file, 120);
    const events = await reads(4, 60_000, 15);
    const calls = log.calls().sort((a, b) => a.started! - b.started!);
    // Refreshes made during a read are satisfied by it: two calls per cycle, no extra queued cycles.
    expect(calls.length).toBe(8);
    for (let i = 1; i < calls.length; i++) expect(calls[i]!.started!).toBeGreaterThanOrEqual(calls[i - 1]!.ended!);
    expect(calls.map((c) => c.argv![1])).toEqual(['pipelines', 'schedules', 'pipelines', 'schedules', 'pipelines', 'schedules', 'pipelines', 'schedules']);
    expect(events.every((e) => Result.isSuccess(e.pipelines) && Result.isSuccess(e.schedules))).toBe(true);
  });

  test('waits the interval after each read finishes, not from its start', async () => {
    const log = fakeLog();
    use('floor', log.file, 150);
    const events = await reads(3, 250, null);
    const calls = log.calls().sort((a, b) => a.started! - b.started!);
    for (const i of [2, 4]) expect(calls[i]!.started! - calls[i - 1]!.ended!).toBeGreaterThanOrEqual(240);
    for (const e of events) expect(e.nextAt - e.at).toBe(250);
  });

  test('a refresh while idle reads at once', async () => {
    const log = fakeLog();
    use('floor', log.file);
    const started = Date.now();
    await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const refresh = yield* Queue.unbounded<void>();
      const fiber = yield* Effect.forkScoped(Stream.runCollect(pollEvents(refresh, 60_000).pipe(Stream.filter((e) => e._tag === 'Read'), Stream.take(2))));
      while (log.calls().length < 2) yield* Effect.sleep(10);
      yield* Effect.sleep(50);
      yield* Queue.offer(refresh, undefined);
      yield* Fiber.join(fiber);
    })).pipe(Effect.provide(readerLayer({ command: FAKE })), Effect.provide(platform)));
    expect(log.calls().length).toBe(4);
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  test('a failed read is reported per command and polling continues', async () => {
    use('schedules-error', fakeLog().file);
    const events = await reads(2, 10, null);
    for (const e of events) {
      expect(Result.isSuccess(e.pipelines)).toBe(true);
      expect(Result.isFailure(e.schedules) && e.schedules.failure.kind).toBe('error-envelope');
    }
  });
});
