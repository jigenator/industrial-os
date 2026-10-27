import { Effect, Schema as S } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import {
  Item,
  Overlay,
  SourceStatus,
  decode,
  fail,
  type SourceOutput,
  type OutputItem,
  type Act,
} from "./contract.ts";

// Inlined so a bundled engine never needs SQL sidecar files.
export const schemaUp = [
  `CREATE TABLE source (id TEXT PRIMARY KEY, status TEXT NOT NULL, config_digest TEXT NOT NULL, disabled INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN (0,1)))`,
  `CREATE TABLE run (run_id TEXT PRIMARY KEY, source_id TEXT NOT NULL, active INTEGER NOT NULL CHECK(active IN (0,1)), record TEXT NOT NULL)`,
  `CREATE INDEX run_history ON run(source_id,run_id)`,
  `CREATE UNIQUE INDEX one_active_run ON run(source_id) WHERE active=1`,
  `CREATE TABLE item (source_id TEXT NOT NULL, key TEXT NOT NULL, record TEXT NOT NULL, seen_at TEXT NOT NULL, gone_at TEXT, PRIMARY KEY(source_id,key))`,
  `CREATE INDEX current_items ON item(source_id,gone_at)`,
  `CREATE TABLE overlay (key TEXT PRIMARY KEY, plan TEXT, pinned INTEGER, handled_at TEXT, record TEXT NOT NULL)`,
  `CREATE TABLE ledger (id TEXT PRIMARY KEY, at TEXT NOT NULL, type TEXT NOT NULL, actor TEXT NOT NULL, source_id TEXT, key TEXT, record TEXT NOT NULL)`,
  `CREATE INDEX ledger_at ON ledger(at)`,
  `CREATE UNIQUE INDEX shipped_once ON ledger(source_id,key) WHERE type='shipped'`,
];
export const schemaDown = [
  "DROP INDEX shipped_once",
  "DROP INDEX ledger_at",
  "DROP TABLE ledger",
  "DROP TABLE overlay",
  "DROP INDEX current_items",
  "DROP TABLE item",
  "DROP INDEX one_active_run",
  "DROP INDEX run_history",
  "DROP TABLE run",
  "DROP TABLE source",
];
const Meta = S.Struct({ rev: S.Number.check(S.isInt()), lastLookAt: S.optional(S.String) });
export const Ledger = S.Struct({
  id: S.String,
  at: S.String,
  type: S.String,
  actor: S.String,
  source: S.optional(S.String),
  key: S.optional(S.String),
  kind: S.optional(S.String),
  sourceType: S.optional(S.String),
  agent: S.optional(S.String),
});
export type Ledger = typeof Ledger.Type;
const normalized = (s: string) => s.replace(/\s+/g, "").toLowerCase();
export const openStore = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const existing = yield* sql<{
    name: string;
    sql: string;
  }>`SELECT name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'`;
  if (existing.length) {
    const allowed = new Set([
      "source",
      "run",
      "item",
      "overlay",
      "ledger",
      "run_history",
      "one_active_run",
      "current_items",
      "ledger_at",
      "shipped_once",
      "effect_sql_migrations",
    ]);
    if (
      existing.some((r) => !allowed.has(r.name)) ||
      !existing.some((r) => r.name === "effect_sql_migrations")
    )
      return yield* Effect.fail(
        fail("schema_unknown", "Unknown database schema; restore a stopped-state backup"),
      );
    const migrations = yield* sql<{
      migration_id: number;
      name: string;
    }>`SELECT migration_id,name FROM effect_sql_migrations`;
    if (
      migrations.length !== 1 ||
      migrations[0].migration_id !== 1 ||
      migrations[0].name !== "initial"
    )
      return yield* Effect.fail(fail("schema_unknown", "Unsupported database version"));
    const actual = existing
      .filter((r) => r.name !== "effect_sql_migrations")
      .map((r) => normalized(r.sql))
      .sort();
    if (JSON.stringify(actual) !== JSON.stringify(schemaUp.map(normalized).sort()))
      return yield* Effect.fail(fail("schema_unknown", "Unknown database constraints"));
  }
  const version = yield* sql<{ user_version: number }>`PRAGMA user_version`;
  if (version[0].user_version !== 0)
    return yield* Effect.fail(fail("schema_unknown", "Unsupported database version"));
  const migration = Effect.gen(function* () {
    for (const statement of schemaUp) yield* sql.unsafe(statement);
  });
  yield* Migrator.make({})({ loader: Migrator.fromRecord({ "1_initial": migration }) });
  yield* sql`PRAGMA journal_mode=WAL`;
  yield* sql`PRAGMA synchronous=FULL`;
  yield* sql`INSERT OR IGNORE INTO overlay(key,record) VALUES('__engine','{"rev":0}')`;
  return new Store(sql);
});
export class Store {
  constructor(readonly sql: SqlClient.SqlClient) {}
  meta = () =>
    Effect.gen({ self: this }, function* () {
      const rows = yield* this.sql<{
        record: string;
      }>`SELECT record FROM overlay WHERE key='__engine'`;
      return decode(Meta, JSON.parse(rows[0].record));
    });
  bump = (look?: string) =>
    Effect.gen({ self: this }, function* () {
      const current = yield* this.meta();
      const meta = { ...current, rev: current.rev + 1, ...(look ? { lastLookAt: look } : {}) };
      yield* this.sql`UPDATE overlay SET record=${JSON.stringify(meta)} WHERE key='__engine'`;
      return meta.rev;
    });
  sources = () =>
    Effect.gen({ self: this }, function* () {
      const rows = yield* this.sql<{
        id: string;
        status: string;
        config_digest: string;
        disabled: number;
      }>`SELECT * FROM source ORDER BY id`;
      return rows.map((r) => ({ ...r, status: decode(SourceStatus, JSON.parse(r.status)) }));
    });
  putSource = (status: SourceStatus, digest: string) =>
    this.sql.withTransaction(
      Effect.gen({ self: this }, function* () {
        const json = JSON.stringify(status);
        const old = yield* this.sql<{
          status: string;
          config_digest: string;
        }>`SELECT status,config_digest FROM source WHERE id=${status.id}`;
        if (old[0]?.status === json && old[0]?.config_digest === digest) return;
        yield* this
          .sql`INSERT INTO source(id,status,config_digest) VALUES(${status.id},${json},${digest}) ON CONFLICT(id) DO UPDATE SET status=excluded.status,config_digest=excluded.config_digest`;
        yield* this.bump();
      }),
    );
  items = (all = false) =>
    Effect.gen({ self: this }, function* () {
      const rows = yield* this.sql<{
        record: string;
      }>`SELECT record FROM item WHERE gone_at IS NULL OR ${all ? 1 : 0}=1 ORDER BY source_id,key`;
      return rows.map((r) => decode(Item, JSON.parse(r.record)));
    });
  overlays = () =>
    Effect.gen({ self: this }, function* () {
      const rows = yield* this.sql<{
        key: string;
        record: string;
      }>`SELECT key,record FROM overlay WHERE key!='__engine'`;
      return new Map(rows.map((r) => [r.key, decode(Overlay, JSON.parse(r.record))]));
    });
  ledger = (from: string) =>
    Effect.gen({ self: this }, function* () {
      const rows = yield* this.sql<{
        record: string;
      }>`SELECT record FROM ledger WHERE at>=${from} ORDER BY at,id`;
      return rows.map((r) => decode(Ledger, JSON.parse(r.record)));
    });
  event = (event: Omit<Ledger, "id">) => {
    const value = { ...event, id: Bun.randomUUIDv7() };
    return this
      .sql`INSERT OR IGNORE INTO ledger VALUES(${value.id},${value.at},${value.type},${value.actor},${value.source ?? null},${value.key ?? null},${JSON.stringify(value)})`;
  };
  /**
   * Stores one observation. For checklists, `done` lists `[x]` lines: each keeps a doneAt from this
   * observation's shipment, else its stored doneAt, else its ledger shipment. Without one it stays gone.
   */
  apply = (
    source: string,
    sourceType: string,
    output: SourceOutput,
    at: string,
    actor = "unknown",
    done: ReadonlyArray<OutputItem> = [],
  ) =>
    this.sql.withTransaction(
      Effect.gen({ self: this }, function* () {
        const oldRows = yield* this.sql<{
          key: string;
          record: string;
          gone_at: string | null;
        }>`SELECT key,record,gone_at FROM item WHERE source_id=${source}`;
        const old = new Map(oldRows.map((r) => [r.key, r]));
        const stored = (key: string) => {
          const row = old.get(key);
          return row ? decode(Item, JSON.parse(row.record)) : undefined;
        };
        const current = output.status === "auth" ? [] : output.items;
        const shippedNow = new Map((output.shipped ?? []).map((s) => [s.key, s.at]));
        let ledgerShipped: Map<string, string> | undefined;
        const rows: { raw: OutputItem; doneAt?: string }[] = current.map((raw) => ({ raw }));
        for (const raw of output.status === "auth" ? [] : done) {
          let doneAt = shippedNow.get(raw.key) ?? stored(raw.key)?.doneAt;
          if (!doneAt) {
            ledgerShipped ??= new Map(
              (yield* this.sql<{
                key: string;
                at: string;
              }>`SELECT key,at FROM ledger WHERE type='shipped' AND source_id=${source}`).map(
                (r) => [r.key, r.at],
              ),
            );
            doneAt = ledgerShipped.get(raw.key);
          }
          if (doneAt) rows.push({ raw, doneAt });
        }
        for (const { raw, doneAt } of rows) {
          const previous = old.get(raw.key);
          const was = stored(raw.key);
          const item: Item = {
            ...raw,
            source,
            kind: raw.kind ?? (sourceType === "checklist" ? "todo" : "item"),
            seenAt: was?.seenAt ?? at,
            since: sourceType === "checklist" ? (was?.since ?? raw.since) : raw.since,
            ...(doneAt ? { doneAt } : {}),
          };
          const json = JSON.stringify(item);
          yield* this
            .sql`INSERT INTO item VALUES(${source},${item.key},${json},${item.seenAt},NULL) ON CONFLICT(source_id,key) DO UPDATE SET record=excluded.record,gone_at=NULL`;
          if (!previous || previous.gone_at)
            yield* this.event({
              at,
              type: "arrived",
              source,
              key: item.key,
              actor,
              kind: item.kind,
              sourceType,
            });
          else if (was?.doneAt && !doneAt)
            // Reopened is not a shipment; week uses it to undo a same-day checklist shipment.
            yield* this.event({
              at,
              type: "reopened",
              source,
              key: item.key,
              actor,
              kind: item.kind,
              sourceType,
            });
          else if (previous.record !== json)
            yield* this.event({
              at,
              type: "changed",
              source,
              key: item.key,
              actor,
              kind: item.kind,
              sourceType,
            });
        }
        const kept = new Set(rows.map((r) => r.raw.key));
        for (const row of oldRows)
          if (!row.gone_at && !kept.has(row.key)) {
            yield* this
              .sql`UPDATE item SET gone_at=${at} WHERE source_id=${source} AND key=${row.key}`;
            yield* this.event({ at, type: "gone", source, key: row.key, actor, sourceType });
          }
        for (const shipped of output.shipped ?? []) {
          const item = rows.find((r) => r.raw.key === shipped.key)?.raw ?? stored(shipped.key);
          yield* this.event({
            at: shipped.at,
            type: "shipped",
            source,
            key: shipped.key,
            actor: shipped.actor ?? actor,
            sourceType,
            kind: item?.kind,
          });
        }
        // Every successful observation updates stored run/source health too.
        yield* this.bump();
      }),
    );
  act = (act: Act, at: string) =>
    this.sql.withTransaction(
      Effect.gen({ self: this }, function* () {
        if (act.do !== "look") {
          const key = act.key!;
          const item = (yield* this.items()).find((i) => `${i.source}:${i.key}` === key);
          if (!item) return yield* Effect.fail(fail("not_found", "Item not found"));
          const overlay = (yield* this.overlays()).get(key) ?? {
            plan: "inbox" as const,
            pinned: false,
          };
          const { handledAt: _handled, ...withoutHandled } = overlay;
          const next: Overlay =
            act.do === "plan"
              ? { ...overlay, plan: act.plan! }
              : act.do === "pin"
                ? { ...overlay, pinned: act.pinned! }
                : act.undo
                  ? withoutHandled
                  : { ...overlay, handledAt: at };
          yield* this
            .sql`INSERT INTO overlay VALUES(${key},${next.plan},${Number(next.pinned)},${next.handledAt ?? null},${JSON.stringify(next)}) ON CONFLICT(key) DO UPDATE SET plan=excluded.plan,pinned=excluded.pinned,handled_at=excluded.handled_at,record=excluded.record`;
        }
        yield* this.event({ at, type: act.do, actor: act.actor, key: act.key, agent: act.agent });
        return yield* this.bump(act.do === "look" ? at : undefined);
      }),
    );
  startRun = (id: string, source: string, at: string) =>
    this.sql`INSERT INTO run VALUES(${id},${source},1,${JSON.stringify({ at })})`;
  finishRun = (id: string, source: string, at: string, result: string) =>
    this.sql.withTransaction(
      Effect.gen({ self: this }, function* () {
        yield* this
          .sql`UPDATE run SET active=0,record=${JSON.stringify({ at, result })} WHERE run_id=${id}`;
        yield* this
          .sql`DELETE FROM run WHERE source_id=${source} AND active=0 AND run_id NOT IN (SELECT run_id FROM run WHERE source_id=${source} ORDER BY run_id DESC LIMIT 50)`;
      }),
    );
  interrupt = () =>
    this.sql`UPDATE run SET active=0,record='{"result":"interrupted"}' WHERE active=1`;
  enabled = (source: string, enabled: boolean, actor: string, at: string) =>
    this.sql.withTransaction(
      Effect.gen({ self: this }, function* () {
        const exists = yield* this.sql`SELECT id FROM source WHERE id=${source}`;
        if (!exists.length) return yield* Effect.fail(fail("not_found", "Source not found"));
        yield* this.sql`UPDATE source SET disabled=${enabled ? 0 : 1} WHERE id=${source}`;
        yield* this.event({ at, type: enabled ? "enable" : "disable", actor, source });
        return yield* this.bump();
      }),
    );
}
