import { expect, test } from "bun:test";
import { Effect } from "effect";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { SqlClient } from "effect/sql";
import { openStore, schemaUp, schemaDown, type Store } from "../src/store.ts";
import { derive, shippedBucket, week } from "../src/derive.ts";
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
