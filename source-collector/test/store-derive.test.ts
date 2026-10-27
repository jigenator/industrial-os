import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { SqlClient } from "effect/sql";
import { openStore, schemaUp, schemaDown, type Store } from "../src/store.ts";
import { derive, localMidnight, shippedBucket, week } from "../src/derive.ts";
import { type Item, type SourceStatus } from "../src/contract.ts";
const at = "2026-10-23T12:00:00Z";
const output = { v: 1 as const, items: [{ key: "one", title: "One", since: at }] };
function db<A, E, R>(f: (store: Store) => Effect.Effect<A, E, R>) {
  return Effect.scoped(
    Effect.gen(function* () {
      const store = yield* openStore;
      return yield* f(store);
    }),
  ).pipe(Effect.provide(SqliteClient.layer({ filename: ":memory:" })));
}
test("Migrator up/down: exact tables/indexes and reopen; unknown/new schema refused", async () => {
  await Effect.runPromise(
    db((store) =>
      Effect.gen(function* () {
        const reopened = yield* openStore;
        expect((yield* reopened.meta()).rev).toBe(0);
        for (const sql of schemaDown) yield* store.sql.unsafe(sql);
        for (const sql of schemaUp) yield* store.sql.unsafe(sql);
        yield* openStore;
        yield* store.sql`CREATE TABLE foreign_table (id TEXT)`;
        expect((yield* openStore.pipe(Effect.result))._tag).toBe("Failure");
      }),
    ),
  );
  await Effect.runPromise(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`PRAGMA user_version=99`;
      expect((yield* openStore.pipe(Effect.result))._tag).toBe("Failure");
    }).pipe(Effect.provide(SqliteClient.layer({ filename: ":memory:" }))),
  );
});
test("item diff arrived/changed/gone/shipped, replay dedupe and transaction rollback", async () => {
  await Effect.runPromise(
    db((store) =>
      Effect.gen(function* () {
        yield* store.apply("todo", "checklist", output, at);
        yield* store.apply(
          "todo",
          "checklist",
          { v: 1, items: [], shipped: [{ key: "one", at }] },
          at,
        );
        yield* store.apply(
          "todo",
          "checklist",
          { v: 1, items: [], shipped: [{ key: "one", at }] },
          at,
        );
        const events = yield* store.ledger("2000");
        expect(events.map((e) => e.type)).toEqual(["arrived", "gone", "shipped"]);
        expect(yield* store.items()).toHaveLength(0);
        const rev = (yield* store.meta()).rev;
        yield* store.sql`CREATE TRIGGER reject_ledger BEFORE INSERT ON ledger BEGIN SELECT RAISE(ABORT,'test rejection'); END`;
        expect((yield* store.apply("fake", "command", output, at).pipe(Effect.result))._tag).toBe(
          "Failure",
        );
        expect(yield* store.items()).toHaveLength(0);
        expect((yield* store.meta()).rev).toBe(rev);
      }),
    ),
  );
});
test("active-run uniqueness, last-50 retention and interrupted startup", async () => {
  await Effect.runPromise(
    db((store) =>
      Effect.gen(function* () {
        yield* store.startRun("first", "fake", at);
        expect((yield* store.startRun("second", "fake", at).pipe(Effect.result))._tag).toBe(
          "Failure",
        );
        yield* store.interrupt();
        for (let i = 0; i < 55; i++) {
          const id = String(i).padStart(3, "0");
          yield* store.startRun(id, "fake", at);
          yield* store.finishRun(id, "fake", at, "ok");
        }
        expect(yield* store.sql`SELECT * FROM run WHERE source_id='fake'`).toHaveLength(50);
      }),
    ),
  );
});
test("overlays, look cursor and actor ledger are committed together", async () => {
  await Effect.runPromise(
    db((store) =>
      Effect.gen(function* () {
        yield* store.apply("fake", "command", output, at);
        yield* store.act(
          { do: "pin", key: "fake:one", pinned: true, actor: "agent", agent: "session" },
          at,
        );
        yield* store.act({ do: "look", actor: "you" }, at);
        expect((yield* store.overlays()).get("fake:one")?.pinned).toBe(true);
        expect((yield* store.meta()).lastLookAt).toBe(at);
        expect((yield* store.ledger("2000")).find((e) => e.type === "pin")?.actor).toBe("agent");
      }),
    ),
  );
});
const item: Item = {
  key: "one",
  source: "fake",
  kind: "item",
  title: "One",
  since: "2026-10-20T12:00:00Z",
  seenAt: at,
};
const status = (state: SourceStatus["state"]): SourceStatus => ({
  id: "fake",
  label: "Fake",
  tag: "F",
  order: 0,
  state,
  writable: [],
});
test("derived staleness, clamp, fresh cursor, waiting override, handled counts and unknown != zero", () => {
  const input = {
    now: Date.parse(at),
    rev: 1,
    lastLookAt: "2026-10-19T00:00:00Z",
    staleLimitMs: 3 * 86400000,
    sources: [status("stale")],
    items: [item],
    overlays: new Map(),
    ledger: [],
    waiting: new Map([["fake", true]]),
  };
  const s = derive(input);
  expect(s.items[0].derived).toEqual({
    ageMs: 3 * 86400000,
    remaining: 0,
    stale: true,
    fresh: true,
    waiting: true,
    done: false,
  });
  expect(s.counts.bySource.fake?.total).toBe(1);
  expect(derive({ ...input, items: [{ ...item, waiting: false }] }).items[0].derived.waiting).toBe(
    false,
  );
  for (const state of ["auth", "error", "planned", "config_error", "loading", "disabled"] as const)
    expect(derive({ ...input, sources: [status(state)] }).counts.bySource.fake).toBeNull();
  const handled = derive({
    ...input,
    overlays: new Map([["fake:one", { plan: "today" as const, pinned: false, handledAt: at }]]),
  });
  expect(handled.items).toHaveLength(1);
  expect(handled.counts.plan.today).toBe(0);
  expect(handled.counts.bySource.fake?.total).toBe(0);
  expect(derive({ ...input, now: Date.parse(item.since) - 1 }).items[0].derived.remaining).toBe(1);
});
test("week uses 21 local-midnight-aligned 8-hour blocks and D5", () => {
  const event = { id: "1", at, type: "shipped", actor: "agent", sourceType: "checklist" };
  expect(shippedBucket(event)).toBe("you");
  expect(shippedBucket({ ...event, sourceType: "command", kind: "pr_merge" })).toBe("agents");
  // A merged PR is rarely a current item, so a command source's declared actor decides.
  expect(shippedBucket({ ...event, sourceType: "command" })).toBe("agents");
  expect(shippedBucket({ ...event, sourceType: "command", actor: "you" })).toBe("you");
  expect(shippedBucket({ ...event, sourceType: "command", actor: "unknown" })).toBeUndefined();
  const now = new Date(2026, 9, 23, 12).getTime();
  const nowIso = new Date(now).toISOString();
  const previous = new Date(now);
  previous.setDate(previous.getDate() - 7);
  const w = week(now, [
    { ...event, at: nowIso },
    { ...event, id: "2", at: previous.toISOString() },
    { ...event, id: "3", at: nowIso, sourceType: "command", kind: "pr_merge" },
  ]);
  expect(w.blocks).toHaveLength(21);
  expect(new Date(w.blocks[0].start).getHours()).toBe(0);
  expect(w.blocks.at(-1)?.future).toBe(true);
  expect(w.total).toEqual({ you: 1, agents: 1 });
  expect(w.lastWeekSoFar).toEqual({ you: 1, agents: 0 });
});

// Done to-dos: local civil times, like the week strip, so the midnight rule follows the process zone.
const local = (day: number, hour: number, minute = 0) =>
  new Date(2026, 9, day, hour, minute).getTime();
const isoAt = (t: number) => new Date(t).toISOString();
const todoA = { key: "a", title: "A", since: isoAt(local(20, 9)), kind: "todo" };
const todoB = { key: "b", title: "B", since: isoAt(local(21, 9)), kind: "todo" };
const todoSource: SourceStatus = { ...status("ok"), id: "todo" };
const snapshot = (store: Store, now: number) =>
  Effect.gen(function* () {
    return derive({
      now,
      rev: (yield* store.meta()).rev,
      staleLimitMs: 3 * 86400000,
      sources: [todoSource],
      items: yield* store.items(),
      overlays: yield* store.overlays(),
      ledger: yield* store.ledger("2000"),
      waiting: new Map(),
    });
  });
const open = (items: (typeof todoA)[]) => ({ v: 1 as const, items });
const complete = (key: string, at: number) => ({
  v: 1 as const,
  items: [],
  shipped: [{ key, at: isoAt(at) }],
});
function fileDb<A, E>(
  filename: string,
  f: (store: Store) => Effect.Effect<A, E, SqlClient.SqlClient>,
) {
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        return yield* f(yield* openStore);
      }),
    ).pipe(Effect.provide(SqliteClient.layer({ filename }))),
  );
}
test("done to-do stays flagged and uncounted until local midnight, across a store reopen", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sc-done-")),
    filename = join(dir, "state.sqlite");
  try {
    await fileDb(filename, (store) =>
      Effect.gen(function* () {
        yield* store.apply("todo", "checklist", open([todoA, todoB]), isoAt(local(23, 9)));
        yield* store.apply(
          "todo",
          "checklist",
          { ...complete("a", local(23, 10)), items: [todoB] },
          isoAt(local(23, 10)),
          "you",
          [todoA],
        );
        const s = yield* snapshot(store, local(23, 15));
        const a = s.items.find((i) => i.key === "a")!;
        expect(a.doneAt).toBe(isoAt(local(23, 10)));
        expect(a.derived.done).toBe(true);
        expect(a.derived.stale).toBe(false);
        expect(s.items.find((i) => i.key === "b")?.derived.done).toBe(false);
        expect(s.counts.bySource.todo).toEqual({
          total: 1,
          waiting: 0,
          fresh: 0,
          oldestSince: todoB.since,
        });
        expect(s.counts.plan).toEqual({ today: 0, inbox: 1, later: 0 });
      }),
    );
    // A restarted engine opens the same store: still there, and a plain reread keeps its time.
    await fileDb(filename, (store) =>
      Effect.gen(function* () {
        yield* store.apply("todo", "checklist", open([todoB]), isoAt(local(23, 16)), "unknown", [
          todoA,
        ]);
        expect(
          (yield* snapshot(store, local(23, 23, 59))).items.find((i) => i.key === "a")?.doneAt,
        ).toBe(isoAt(local(23, 10)));
        // At the next local midnight it drops off at request time, whatever rev says.
        const rev = (yield* store.meta()).rev;
        const midnight = yield* snapshot(store, local(24, 0));
        expect(midnight.rev).toBe(rev);
        expect(midnight.items.map((i) => i.key)).toEqual(["b"]);
        expect(localMidnight(local(24, 0))).toBe(local(24, 0));
        // Reopen: open again and counted; the same-day shipment leaves the week strip.
        yield* store.apply("todo", "checklist", open([todoA, todoB]), isoAt(local(23, 17)), "you");
        const reopened = yield* snapshot(store, local(23, 18));
        const a = reopened.items.find((i) => i.key === "a")!;
        expect(a.doneAt).toBeUndefined();
        expect(a.derived.done).toBe(false);
        expect(reopened.counts.bySource.todo?.total).toBe(2);
        expect(reopened.week.total.you).toBe(0);
        const types = (yield* store.ledger("2000")).filter((e) => e.key === "a").map((e) => e.type);
        expect(types).toEqual(["arrived", "changed", "shipped", "reopened"]);
      }),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("a [x] to-do with no shipment never shows", async () => {
  await Effect.runPromise(
    db((store) =>
      Effect.gen(function* () {
        yield* store.apply("todo", "checklist", open([todoB]), isoAt(local(23, 9)), "unknown", [
          todoA,
        ]);
        expect((yield* store.items()).map((i) => i.key)).toEqual(["b"]);
        expect((yield* snapshot(store, local(23, 10))).items.map((i) => i.key)).toEqual(["b"]);
      }),
    ),
  );
});
test("upgrade: gone done rows from the previous engine reappear only when shipped today", async () => {
  await Effect.runPromise(
    db((store) =>
      Effect.gen(function* () {
        // The previous engine stored completions as gone rows plus a shipped event.
        yield* store.apply("todo", "checklist", open([todoA, todoB]), isoAt(local(22, 9)));
        yield* store.apply(
          "todo",
          "checklist",
          { ...complete("b", local(22, 10)), items: [todoA] },
          isoAt(local(22, 10)),
        );
        yield* store.apply("todo", "checklist", complete("a", local(23, 10)), isoAt(local(23, 10)));
        expect(yield* store.items()).toHaveLength(0);
        // The upgraded engine's first read sees both lines still [x].
        yield* store.apply("todo", "checklist", open([]), isoAt(local(23, 11)), "unknown", [
          todoA,
          todoB,
        ]);
        const s = yield* snapshot(store, local(23, 12));
        expect(s.items.map((i) => [i.key, i.doneAt])).toEqual([["a", isoAt(local(23, 10))]]);
        expect(s.counts.bySource.todo?.total).toBe(0);
        expect(s.week.total.you).toBe(2);
      }),
    ),
  );
});
test("redo: done yesterday, reopened and done again today stays visible today", async () => {
  await Effect.runPromise(
    db((store) =>
      Effect.gen(function* () {
        yield* store.apply("todo", "checklist", open([todoA]), isoAt(local(22, 9)));
        yield* store.apply(
          "todo",
          "checklist",
          complete("a", local(22, 10)),
          isoAt(local(22, 10)),
          "you",
          [todoA],
        );
        yield* store.apply("todo", "checklist", open([todoA]), isoAt(local(23, 9)), "you");
        // The second shipment is deduplicated in the ledger; doneAt still takes this completion.
        yield* store.apply(
          "todo",
          "checklist",
          complete("a", local(23, 10)),
          isoAt(local(23, 10)),
          "you",
          [todoA],
        );
        const s = yield* snapshot(store, local(23, 11));
        expect(s.items.map((i) => [i.key, i.doneAt, i.derived.done])).toEqual([
          ["a", isoAt(local(23, 10)), true],
        ]);
        const shipped = (yield* store.ledger("2000")).filter((e) => e.type === "shipped");
        expect(shipped.map((e) => e.at)).toEqual([isoAt(local(22, 10))]);
        // Reopened on a later day: the original shipment still counts.
        expect(s.week.total.you).toBe(1);
      }),
    ),
  );
});
test("week drops a checklist shipment reopened the same local day unless done again", () => {
  const shipped = {
    id: "1",
    at: isoAt(local(23, 10)),
    type: "shipped",
    actor: "you",
    source: "todo",
    key: "a",
    sourceType: "checklist",
  };
  const reopened = { ...shipped, id: "2", type: "reopened", at: isoAt(local(23, 11)) };
  const now = local(23, 12);
  expect(week(now, [shipped]).total.you).toBe(1);
  expect(week(now, [shipped, reopened]).total.you).toBe(0);
  expect(week(now, [shipped, reopened], new Set(["todo:a"])).total.you).toBe(1);
  expect(week(local(24, 12), [shipped, { ...reopened, at: isoAt(local(24, 9)) }]).total.you).toBe(
    1,
  );
});
