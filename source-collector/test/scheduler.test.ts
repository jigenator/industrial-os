import { expect, test } from "bun:test";
import { Clock, Deferred, Effect, Fiber, Scope } from "effect";
import { TestClock } from "effect/testing";
import { makeScheduler } from "../src/scheduler.ts";
import { type SourceConfig, fail } from "../src/contract.ts";
const config = (id: string): SourceConfig => ({
  id,
  label: id,
  tag: "T",
  type: "command",
  fetch: ["true"],
  every: "10s",
  idleEvery: "30s",
});
const timed = <A, E>(effect: Effect.Effect<A, E, Scope.Scope | TestClock.TestClock>) =>
  Effect.runPromise(Effect.scoped(effect).pipe(Effect.provide(TestClock.layer())));
// Test programs have no platform requirements; TestClock supplies the tracking scheduler.
test("scheduler watched/idle timing and immediate overdue admission on watch transition", async () => {
  await timed(
    Effect.gen(function* () {
      let runs = 0;
      const scheduler = yield* makeScheduler(() =>
        Effect.sync(() => {
          runs++;
        }),
      );
      scheduler.configure([config("a")], 20);
      yield* scheduler.tick;
      yield* Effect.yieldNow;
      expect(runs).toBe(1);
      yield* TestClock.adjust("11 seconds");
      yield* scheduler.tick;
      expect(runs).toBe(1);
      yield* scheduler.watch();
      yield* Effect.yieldNow;
      expect(runs).toBe(2);
      yield* TestClock.adjust("11 seconds");
      yield* scheduler.tick;
      yield* Effect.yieldNow;
      expect(runs).toBe(3);
      yield* TestClock.adjust("121 seconds");
      yield* scheduler.tick;
      yield* Effect.yieldNow;
      expect(runs).toBe(4);
      yield* TestClock.adjust("11 seconds");
      yield* scheduler.tick;
      expect(runs).toBe(4);
    }),
  );
});
test("scoped watch speeds up only the requested sources; unscoped covers all", async () => {
  await timed(
    Effect.gen(function* () {
      const runs: Record<string, number> = { a: 0, b: 0 };
      const scheduler = yield* makeScheduler((c) =>
        Effect.sync(() => {
          runs[c.id]++;
        }),
      );
      scheduler.configure([config("a"), config("b")], 20);
      yield* scheduler.tick;
      yield* Effect.yieldNow;
      expect(runs).toEqual({ a: 1, b: 1 });
      yield* TestClock.adjust("11 seconds");
      yield* scheduler.watch(["a", "a", "unknown"]);
      yield* Effect.yieldNow;
      expect(runs).toEqual({ a: 2, b: 1 }); // only a is overdue at its watched interval
      expect(Date.parse(scheduler.nextAt("b", 11000)!)).toBe(30000);
      yield* TestClock.adjust("121 seconds");
      yield* scheduler.tick;
      yield* Effect.yieldNow;
      expect(runs).toEqual({ a: 3, b: 2 }); // both idle-due again, a's watch expired
      expect(Date.parse(scheduler.nextAt("a", 132000)!)).toBe(162000);
      yield* scheduler.watch();
      expect(Date.parse(scheduler.nextAt("b", 132000)!)).toBe(142000);
      yield* scheduler.watch(["b"]);
      yield* scheduler.watch(["b"]);
      yield* Effect.yieldNow;
      expect(runs).toEqual({ a: 3, b: 2 }); // re-watching inside an unscoped window adds no run
      scheduler.configure([config("a"), config("b"), config("c")], 20);
      yield* scheduler.tick;
      yield* Effect.yieldNow;
      expect(Date.parse(scheduler.nextAt("c", 132000)!)).toBe(142000); // configured inside an unscoped window
    }),
  );
});
test("scheduler 20-slot ceiling, no overlap and no queued catch-up", async () => {
  await timed(
    Effect.gen(function* () {
      const gate = yield* Deferred.make<void>();
      let runs = 0;
      const scheduler = yield* makeScheduler(() =>
        Effect.sync(() => {
          runs++;
        }).pipe(Effect.andThen(Deferred.await(gate))),
      );
      scheduler.configure(
        Array.from({ length: 21 }, (_, i) => config(`s${i}`)),
        20,
      );
      yield* scheduler.tick;
      yield* Effect.yieldNow;
      expect(scheduler.active()).toBe(20);
      expect(runs).toBe(20);
      yield* scheduler.tick;
      expect(scheduler.active()).toBe(20);
      expect((yield* scheduler.refresh("s0").pipe(Effect.result))._tag).toBe("Failure");
      yield* Deferred.succeed(gate, undefined);
      yield* Effect.yieldNow;
      yield* scheduler.tick;
      yield* Effect.yieldNow;
      expect(runs).toBe(20);
    }),
  );
});
test("failure doubles delay, caps at 15 minutes, success resets; stop admits nothing", async () => {
  await timed(
    Effect.gen(function* () {
      let failRun = true;
      const scheduler = yield* makeScheduler(() =>
        failRun ? Effect.fail(fail("command_failed", "no")) : Effect.void,
      );
      scheduler.configure([config("a")], 20);
      yield* scheduler.watch();
      yield* Effect.yieldNow;
      expect(Date.parse(scheduler.nextAt("a", 0)!)).toBe(20000);
      for (let i = 0; i < 8; i++) {
        yield* scheduler.refresh("a");
        yield* Effect.yieldNow;
      }
      expect(Date.parse(scheduler.nextAt("a", 0)!)).toBe(900000);
      failRun = false;
      yield* scheduler.refresh("a");
      yield* Effect.yieldNow;
      expect(Date.parse(scheduler.nextAt("a", 0)!)).toBe(10000);
      scheduler.stop();
      expect((yield* scheduler.refresh("a").pipe(Effect.result))._tag).toBe("Failure");
      const idle = yield* makeScheduler(() => Effect.fail(fail("command_failed", "no")));
      idle.configure([config("idle")], 20);
      yield* idle.tick;
      yield* Effect.yieldNow;
      expect(Date.parse(idle.nextAt("idle", 0)!)).toBe(60000);
    }),
  );
});
test("Schedule loop runs using TestClock, not wall time", async () => {
  await timed(
    Effect.gen(function* () {
      let calls = 0;
      const s = yield* makeScheduler(() =>
        Effect.sync(() => {
          calls++;
        }),
      );
      s.configure([config("a")], 20);
      const fiber = yield* s.loop.pipe(Effect.forkScoped);
      yield* TestClock.adjust("31 seconds");
      expect(calls).toBe(2);
      yield* Fiber.interrupt(fiber);
      expect(yield* Clock.currentTimeMillis).toBe(31000);
    }),
  );
});
