import packageInfo from "../package.json";
import {
  Clock,
  Deferred,
  Effect,
  FileSystem,
  Schedule,
  Stream,
  Scope,
  Fiber,
  Logger,
} from "effect";
import { RpcServer, RpcSerialization } from "effect/rpc";
import { SocketServer } from "effect/socket";
import { BunSocketServer } from "@effect/platform-bun";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { dirname, join, resolve } from "node:path";
import { Api, CollectorError, fail, type SourceStatus, type Act } from "./contract.ts";
import { loadCatalog, type Catalog, type Entry } from "./config.ts";
import { Store, openStore } from "./store.ts";
import { derive } from "./derive.ts";
import { makeScheduler } from "./scheduler.ts";
import { runCommand } from "./command.ts";
import {
  checklistIO,
  checklistPath,
  readChecklist,
  checklistOutput,
  checklistDone,
  editChecklist,
  type ChecklistRead,
} from "./checklist.ts";
import { instance, regularFile } from "./instance.ts";
import { runLog, collectorLog } from "./logs.ts";
import { boundedServer } from "./socket-limits.ts";

const safe = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.catchCause((cause) => {
      const error = cause.reasons.find((r) => r._tag === "Fail");
      return Effect.fail(
        error && error._tag === "Fail" && error.error instanceof CollectorError
          ? error.error
          : fail("io", "Local operation failed"),
      );
    }),
  );
function sourceStatus(entry: Entry, previous?: SourceStatus): SourceStatus {
  const c = entry.config;
  return {
    id: entry.id,
    label: c?.label ?? entry.id,
    tag: c?.tag ?? "?",
    order: c?.order ?? 0,
    ...(c?.color ? { color: c.color } : {}),
    state: entry.error ? "config_error" : c?.planned ? "planned" : previous ? "stale" : "loading",
    ...(entry.error ? { error: { code: "config_error", message: entry.error } } : {}),
    writable:
      c?.type === "checklist"
        ? ["todo.add", "todo.done", "todo.reopen"]
        : Object.keys(c?.actions ?? {}),
    ...(previous?.okAt ? { okAt: previous.okAt } : {}),
  };
}
export const makeEngine = (options: { runtime: string; config: string }) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const scope = yield* Scope.Scope;
    const watchers = new Map<string, { path: string; fiber: Fiber.Fiber<void> }>();
    const store: Store = yield* openStore;
    yield* fs.chmod(join(options.runtime, "state.sqlite"), 0o600);
    yield* store.interrupt();
    let catalog: Catalog = yield* loadCatalog(options.config);
    const entries = new Map<string, Entry>();
    const checklists = new Map<string, ChecklistRead>();
    const statuses = new Map<string, SourceStatus>();
    const stopping = yield* Deferred.make<void, CollectorError>();
    let draining = false,
      runs = 0,
      failures = 0;
    const persist = (id: string, patch: Partial<SourceStatus>) =>
      Effect.gen(function* () {
        const current = statuses.get(id);
        if (!current) return;
        const next = {
          ...current,
          ...patch,
          ...(["disabled", "planned", "config_error"].includes(current.state)
            ? { state: current.state }
            : {}),
        };
        yield* store.putSource(next, entries.get(id)?.digest ?? "missing");
        statuses.set(id, next);
      });
    const runSource = (id: string) =>
      Effect.gen(function* () {
        const entry = entries.get(id),
          config = entry?.config;
        if (!entry || !config) return;
        const runId = Bun.randomUUIDv7(),
          at = new Date(yield* Clock.currentTimeMillis).toISOString();
        runs++;
        const log = yield* Effect.try({
          try: () => runLog(options.runtime, id, runId),
          catch: () => fail("io", "Cannot open run log"),
        });
        yield* store.startRun(runId, id, at);
        const previousChecklist =
          config.type === "checklist"
            ? (checklists.get(id) ?? {
                text: "",
                stamp: "",
                // After a restart the stored rows stand in for the last read; done rows stay done.
                todos: (yield* store.items())
                  .filter((i) => i.source === id)
                  .map(({ key, title, since, who, where, doneAt }) => ({
                    key,
                    title,
                    since,
                    who,
                    where,
                    done: doneAt !== undefined,
                    line: -1,
                  })),
              })
            : undefined;
        const operation =
          config.type === "command"
            ? runCommand(config, entry.folder, runId, undefined, (text) => log.append(text)).pipe(
                Effect.map((r) => ({ output: r.output, done: [] })),
              )
            : checklistIO(() => {
                const path = checklistPath(config.path, entry.folder),
                  read = readChecklist(path);
                const output = checklistOutput(read, previousChecklist);
                checklists.set(id, read);
                return { output, done: checklistDone(read) };
              });
        const result = yield* safe(
          operation.pipe(
            Effect.ensuring(
              Effect.try({
                try: () => log.close(),
                catch: () => fail("io", "Cannot write run log"),
              }).pipe(Effect.orDie),
            ),
          ),
        ).pipe(Effect.result);
        const end = new Date(yield* Clock.currentTimeMillis).toISOString();
        if (entries.get(id)?.digest !== entry.digest) {
          yield* store.finishRun(runId, id, end, "config_changed");
          return;
        }
        if (result._tag === "Success") {
          yield* store.sql.withTransaction(
            Effect.gen(function* () {
              const { output, done } = result.success;
              yield* store.apply(id, config.type, output, end, undefined, done);
              yield* persist(id, {
                state: output.status === "auth" ? "auth" : "ok",
                checkedAt: end,
                ...(output.status === "auth"
                  ? {
                      error: {
                        code: "auth",
                        message: output.message ?? "Sign in required",
                      },
                    }
                  : { okAt: end, error: undefined }),
              });
              yield* store.finishRun(runId, id, end, "ok");
            }),
          );
          yield* Effect.logInfo("run complete").pipe(
            Effect.annotateLogs({ source: id, run: runId, outcome: "ok" }),
          );
        } else {
          failures++;
          yield* store.sql.withTransaction(
            Effect.gen(function* () {
              yield* persist(id, {
                state: "stale",
                checkedAt: end,
                error: { code: result.failure.code, message: result.failure.message },
              });
              yield* store.finishRun(runId, id, end, result.failure.code);
            }),
          );
          yield* Effect.logWarning("run failed").pipe(
            Effect.annotateLogs({ source: id, run: runId, code: result.failure.code }),
          );
          return yield* Effect.fail(result.failure);
        }
      });
    const scheduler = yield* makeScheduler(
      (config) =>
        runSource(config.id).pipe(
          Effect.catchCause((cause) => {
            const reason = cause.reasons.find((r) => r._tag === "Fail");
            if (reason?._tag === "Fail" && reason.error instanceof CollectorError)
              return Effect.fail(reason.error);
            return Effect.logError("state operation failed; draining").pipe(
              Effect.annotateLogs("source", config.id),
              Effect.andThen(
                Effect.sync(() => {
                  draining = true;
                  Deferred.doneUnsafe(stopping, Effect.fail(fail("io", "State operation failed")));
                }),
              ),
              Effect.andThen(Effect.fail(fail("io", "State operation failed"))),
            );
          }),
        ),
      catalog.concurrency,
    );
    const reconcile = (next: Catalog) =>
      Effect.gen(function* () {
        catalog = next;
        const stored = yield* store.sources();
        const present = new Set(next.entries.map((e) => e.id));
        for (const id of entries.keys())
          if (!present.has(id)) {
            entries.delete(id);
            statuses.delete(id);
          }
        for (const e of next.entries) {
          const old = entries.get(e.id),
            previous = stored.find((s) => s.id === e.id);
          entries.set(e.id, e);
          if (
            old?.digest === e.digest &&
            statuses.has(e.id) &&
            (statuses.get(e.id)!.state === "disabled") === !!previous?.disabled
          )
            continue;
          const status: SourceStatus = {
            ...sourceStatus(e, previous?.status),
            ...(previous?.disabled ? { state: "disabled" as const } : {}),
          };
          statuses.set(e.id, status);
          yield* store.putSource(status, e.digest);
        }
        scheduler.configure(
          next.entries
            .filter((e) => e.config && statuses.get(e.id)?.state !== "disabled")
            .map((e) => e.config!),
          next.concurrency,
        );
        const wanted = new Map<string, string>();
        for (const e of next.entries)
          if (
            e.config?.type === "checklist" &&
            !e.config.planned &&
            statuses.get(e.id)?.state !== "disabled"
          )
            wanted.set(e.id, checklistPath(e.config.path, e.folder));
        for (const [id, watch] of watchers)
          if (wanted.get(id) !== watch.path || watch.fiber.pollUnsafe()) {
            yield* Fiber.interrupt(watch.fiber);
            watchers.delete(id);
          }
        for (const [id, path] of wanted)
          if (!watchers.has(id)) {
            const fiber = yield* fs.watch(dirname(path)).pipe(
              Stream.runForEach((event) =>
                resolve(dirname(path), event.path) === path
                  ? scheduler.refresh(id).pipe(Effect.catch(() => Effect.void))
                  : Effect.void,
              ),
              Effect.catch(() => Effect.void),
              Effect.forkIn(scope),
            );
            watchers.set(id, { path, fiber });
          }
      });
    yield* reconcile(catalog);
    const reload = loadCatalog(options.config).pipe(
      Effect.flatMap(reconcile),
      Effect.catch(() => Effect.logWarning("config reload failed; keeping last valid catalog")),
    );
    const refreshChecklist = Effect.gen(function* () {
      for (const e of entries.values())
        if (
          e.config?.type === "checklist" &&
          statuses.get(e.id)?.state !== "disabled" &&
          !e.config.planned
        )
          yield* scheduler.refresh(e.id).pipe(Effect.catch(() => Effect.void));
    });
    const act = (input: Act) =>
      Effect.gen(function* () {
        if (draining) return yield* Effect.fail(fail("contention", "Engine draining"));
        const now = new Date(yield* Clock.currentTimeMillis).toISOString();
        if (["plan", "pin", "handled", "look"].includes(input.do))
          return { rev: yield* store.act(input, now) };
        const item = input.key
          ? (yield* store.items(true)).find((i) => `${i.source}:${i.key}` === input.key)
          : undefined;
        const candidates = [...entries.values()].filter(
          (e) => e.config?.type === "checklist" && statuses.get(e.id)?.state !== "disabled",
        );
        // todo.add resolves an explicit source first, then the key's source, then the only checklist.
        const named = input.source === undefined ? undefined : entries.get(input.source);
        if (
          input.source !== undefined &&
          (named?.config?.type !== "checklist" ||
            named.config.planned ||
            statuses.get(named.id)?.state === "disabled")
        )
          return yield* Effect.fail(fail("invalid_input", "Source is not an available checklist"));
        const entry = named
          ? named
          : item
            ? entries.get(item.source)
            : candidates.length === 1
              ? candidates[0]
              : undefined;
        if (!entry?.config || statuses.get(entry.id)?.state === "disabled")
          return yield* Effect.fail(fail("not_found", "Select an available source item"));
        yield* scheduler.withSlot(
          entry.id,
          Effect.gen(function* () {
            const config = entry.config!;
            if (input.do === "action") {
              const run = Bun.randomUUIDv7();
              const log = yield* Effect.try({
                try: () => runLog(options.runtime, entry.id, run),
                catch: () => fail("io", "Cannot open action log"),
              });
              yield* store.startRun(run, entry.id, now);
              const result = yield* safe(
                runCommand(
                  config,
                  entry.folder,
                  run,
                  { name: input.action!, key: item!.key },
                  (text) => log.append(text),
                ).pipe(
                  Effect.ensuring(
                    Effect.try({
                      try: () => log.close(),
                      catch: () => fail("io", "Cannot write action log"),
                    }).pipe(Effect.orDie),
                  ),
                ),
              ).pipe(Effect.result);
              yield* store.finishRun(
                run,
                entry.id,
                new Date(yield* Clock.currentTimeMillis).toISOString(),
                result._tag === "Success" ? "ok" : result.failure.code,
              );
              yield* store.sql.withTransaction(
                Effect.gen(function* () {
                  yield* store.event({
                    at: now,
                    type: input.do,
                    source: entry.id,
                    key: input.key,
                    actor: input.actor,
                    agent: input.agent,
                  });
                  yield* store.bump();
                }),
              );
              if (result._tag === "Failure") return yield* Effect.fail(result.failure);
            } else {
              if (
                config.type !== "checklist" ||
                !["todo.add", "todo.done", "todo.reopen"].includes(input.do)
              )
                return yield* Effect.fail(fail("invalid_input", "Not a checklist action"));
              const path = checklistPath(config.path, entry.folder);
              const previous =
                checklists.get(entry.id) ?? (yield* checklistIO(() => readChecklist(path)));
              const read = yield* checklistIO(() =>
                editChecklist(path, previous, {
                  ...input,
                  do: input.do as "todo.add" | "todo.done" | "todo.reopen",
                  key: item?.key,
                }),
              );
              const output = checklistOutput(read, previous);
              const done = checklistDone(read);
              // File rename and SQLite cannot be atomic across stores. A later read repairs items after a crash.
              yield* store.sql.withTransaction(
                Effect.gen(function* () {
                  yield* store.apply(entry.id, "checklist", output, now, input.actor, done);
                  yield* store.event({
                    at: now,
                    type: input.do,
                    source: entry.id,
                    key: input.key,
                    actor: input.actor,
                    agent: input.agent,
                  });
                }),
              );
              checklists.set(entry.id, read);
            }
          }),
        );
        if (input.do === "action")
          yield* scheduler.refresh(entry.id).pipe(Effect.catch(() => Effect.void));
        return { rev: (yield* store.meta()).rev };
      });
    const beginDrain = () => {
      draining = true;
      scheduler.stop();
    };
    const stop = Effect.gen(function* () {
      beginDrain();
      yield* Deferred.succeed(stopping, undefined);
    });
    const handlers = yield* Api.toHandlers({
      get: () =>
        safe(
          Effect.gen(function* () {
            yield* scheduler.watch;
            return yield* store.sql.withTransaction(
              Effect.gen(function* () {
                const now = yield* Clock.currentTimeMillis,
                  meta = yield* store.meta();
                const sources = (yield* store.sources())
                  .filter((s) => entries.has(s.id))
                  .map((s) => s.status)
                  .map((s) => ({ ...s, nextAt: scheduler.nextAt(s.id, now) }))
                  .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
                const items = (yield* store.items()).filter((i) => entries.has(i.source));
                return derive({
                  now,
                  ...meta,
                  staleLimitMs: catalog.staleLimitMs,
                  sources,
                  items,
                  overlays: yield* store.overlays(),
                  ledger: yield* store.ledger(new Date(now - 15 * 86400000).toISOString()),
                  waiting: new Map(
                    [...entries.values()].map((e) => [e.id, e.config?.waiting ?? false]),
                  ),
                });
              }),
            );
          }),
        ),
      act: (input) => safe(act(input)),
      refresh: ({ source }) => safe(scheduler.refresh(source)),
      status: () =>
        Effect.succeed({
          engine: draining ? ("draining" as const) : ("running" as const),
          pid: process.pid,
          active: scheduler.active(),
          runs,
          failures,
          sources: [...statuses.values()],
        }),
      version: () => Effect.succeed({ v: 1 as const, version: packageInfo.version }),
      setEnabled: ({ source, enabled, actor }) =>
        safe(
          Effect.gen(function* () {
            const rev = yield* store.enabled(
              source,
              enabled,
              actor,
              new Date(yield* Clock.currentTimeMillis).toISOString(),
            );
            statuses.delete(source);
            yield* reconcile(catalog);
            return { rev };
          }),
        ),
      stop: () => stop,
    });
    const socketPath = join(options.runtime, "feed.sock");
    if (yield* fs.exists(socketPath)) {
      const stat = yield* fs.stat(socketPath);
      if (stat.type !== "Socket")
        return yield* Effect.fail(fail("io", "Socket path is not a socket"));
      yield* fs.remove(socketPath);
    }
    const socket = yield* BunSocketServer.make({ path: socketPath });
    yield* fs.chmod(socketPath, 0o600);
    const protocol = yield* RpcServer.makeProtocolSocketServer.pipe(
      Effect.provideService(SocketServer.SocketServer, boundedServer(socket)),
      Effect.provideService(
        RpcSerialization.RpcSerialization,
        RpcSerialization.ndJsonRpc({ maxBufferSize: 65536 }),
      ),
    );
    yield* RpcServer.make(Api, { concurrency: 32 }).pipe(
      Effect.provide(handlers),
      Effect.provideService(RpcServer.Protocol, protocol),
      Effect.forkScoped,
    );
    yield* scheduler.loop.pipe(Effect.forkScoped);
    yield* reload.pipe(Effect.repeat(Schedule.spaced("1 second")), Effect.forkScoped);
    yield* refreshChecklist.pipe(Effect.repeat(Schedule.spaced("30 seconds")), Effect.forkScoped);
    return { stopping, stop, scheduler, beginDrain };
  });
const serveEngine = (options: { runtime: string; config: string }) =>
  Effect.gen(function* () {
    const engine = yield* makeEngine(options);
    yield* Effect.logInfo("engine ready");
    yield* Effect.acquireRelease(
      Effect.sync(() => {
        const context = () => {
          engine.beginDrain();
          Deferred.doneUnsafe(engine.stopping, Effect.void);
        };
        process.on("SIGTERM", context);
        process.on("SIGINT", context);
        return () => {
          process.off("SIGTERM", context);
          process.off("SIGINT", context);
        };
      }),
      (release) => Effect.sync(release),
    );
    yield* Deferred.await(engine.stopping);
    engine.beginDrain();
    yield* Effect.sleep("100 millis"); // allow the stop acknowledgement to flush before closing RPC
    while (engine.scheduler.active()) yield* Effect.sleep("25 millis");
    yield* Effect.logInfo("engine drained");
  });
export const runEngine = (options: { runtime: string; config: string }) =>
  Effect.scoped(
    Effect.gen(function* () {
      yield* instance(options.runtime);
      yield* Effect.try({
        try: () => {
          for (const suffix of ["", "-wal", "-shm"])
            regularFile(join(options.runtime, `state.sqlite${suffix}`));
        },
        catch: () => fail("io", "Unsafe database path"),
      });
      const log = yield* Effect.try({
        try: () => collectorLog(options.runtime),
        catch: () => fail("io", "Cannot open collector log"),
      });
      yield* serveEngine(options).pipe(
        Effect.provide(
          Logger.layer([Logger.formatJson.pipe(Logger.map((line) => log.append(line)))], {
            mergeWithExisting: true,
          }),
        ),
        Effect.provide(
          SqliteClient.layer({
            filename: join(options.runtime, "state.sqlite"),
            busyTimeout: 0,
            disableWAL: true,
          }),
        ),
      );
    }),
  );
