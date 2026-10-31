import { Clock, Effect, Scope, Schedule } from "effect";
import { durationMs, fail, type SourceConfig } from "./contract.ts";

type Slot = {
  config: SourceConfig;
  active: boolean;
  enabled: boolean;
  finished?: number;
  failures: number;
  watchedUntil?: number;
};
export const makeScheduler = <E, R>(
  run: (config: SourceConfig) => Effect.Effect<void, E, R>,
  limit = 20,
) =>
  Effect.gen(function* () {
    const scope = yield* Scope.Scope;
    const slots = new Map<string, Slot>();
    // An unscoped watch covers every source, including ones configured during its window.
    let allWatchedUntil = 0,
      stopped = false,
      concurrency = limit;
    const watched = (s: Slot, now: number) => now < Math.max(allWatchedUntil, s.watchedUntil ?? 0);
    const interval = (s: Slot, now: number) => {
      const base = durationMs(
        watched(s, now) ? (s.config.every ?? "5m") : (s.config.idleEvery ?? "15m"),
      );
      return s.failures ? Math.min(900000, base * 2 ** Math.min(s.failures, 20)) : base;
    };
    const active = () => [...slots.values()].filter((s) => s.active).length;
    const admit = (s: Slot) =>
      Effect.gen(function* () {
        if (stopped || !s.enabled || s.active || s.config.planned) return false;
        if (active() >= concurrency) return false;
        s.active = true;
        yield* run(s.config).pipe(
          Effect.matchEffect({
            onFailure: () =>
              Effect.sync(() => {
                s.failures++;
              }),
            onSuccess: () =>
              Effect.sync(() => {
                s.failures = 0;
              }),
          }),
          Effect.ensuring(
            Effect.gen(function* () {
              s.finished = yield* Clock.currentTimeMillis;
              s.active = false;
            }),
          ),
          Effect.annotateLogs("source", s.config.id),
          Effect.forkIn(scope),
        );
        return true;
      });
    const tick = Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      for (const slot of slots.values())
        if (
          slot.enabled &&
          !slot.active &&
          !slot.config.planned &&
          (slot.finished === undefined || now >= slot.finished + interval(slot, now))
        ) {
          if (!(yield* admit(slot))) slot.finished = now; // drop a missed tick; no queue or catch-up
        }
    });
    return {
      active,
      tick,
      loop: tick.pipe(Effect.repeat(Schedule.spaced("250 millis")), Effect.asVoid),
      configure(configs: ReadonlyArray<SourceConfig>, limit: number) {
        concurrency = limit;
        const ids = new Set(configs.map((c) => c.id));
        for (const [id, slot] of slots)
          if (!ids.has(id)) {
            slot.enabled = false;
            if (!slot.active) slots.delete(id);
          }
        for (const config of configs) {
          const old = slots.get(config.id);
          if (old) {
            old.config = config;
            old.enabled = true;
          } else slots.set(config.id, { config, active: false, enabled: true, failures: 0 });
        }
      },
      // Watching only the requested sources keeps a scoped reader from speeding up the rest.
      watch: (ids?: Iterable<string>) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis,
            until = now + 120000;
          const targets = ids === undefined
            ? [...slots.values()]
            : [...new Set(ids)].flatMap((id) => slots.get(id) ?? []);
          const idle = targets.some((s) => !watched(s, now));
          if (ids === undefined) allWatchedUntil = until;
          else for (const s of targets) s.watchedUntil = until;
          if (idle) yield* tick;
        }),
      refresh: (source?: string) =>
        Effect.gen(function* () {
          const selected = source
            ? [slots.get(source)].filter((s): s is Slot => s !== undefined)
            : [...slots.values()];
          if (source && !selected.length)
            return yield* Effect.fail(fail("not_found", "Source is unavailable"));
          for (const slot of selected)
            if (!(yield* admit(slot)) && source)
              return yield* Effect.fail(
                fail("contention", "Source active, planned, or all slots occupied"),
              );
        }),
      withSlot: <A, E2, R2>(id: string, work: Effect.Effect<A, E2, R2>) =>
        Effect.suspend<A, E2 | import("./contract.ts").CollectorError, R2>(() => {
          const slot = slots.get(id);
          if (!slot || !slot.enabled || slot.config.planned)
            return Effect.fail(fail("not_found", "Source is unavailable"));
          if (stopped || slot.active || active() >= concurrency)
            return Effect.fail(fail("contention", "Source active or all slots occupied"));
          slot.active = true;
          return work.pipe(
            Effect.ensuring(
              Effect.sync(() => {
                slot.active = false;
              }),
            ),
          );
        }),
      nextAt(id: string, now: number) {
        const s = slots.get(id);
        return !stopped && s && s.enabled && !s.config.planned && !s.active
          ? new Date(s.finished === undefined ? now : s.finished + interval(s, now)).toISOString()
          : undefined;
      },
      stop() {
        stopped = true;
      },
    };
  });
