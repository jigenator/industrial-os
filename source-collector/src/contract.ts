import * as S from "effect/Schema";
import { Rpc, RpcGroup } from "effect/rpc";

export const Text = S.String.check(S.isMinLength(1), S.isMaxLength(4096));
export const Id = S.String.check(S.isPattern(/^[a-z0-9][a-z0-9_-]{0,63}$/));
export const Iso = S.String.check(
  S.isPattern(/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/),
  S.makeFilter((s) => Number.isFinite(Date.parse(s))),
);
export const Duration = S.String.check(
  S.isPattern(/^[1-9]\d*(ms|s|m|h|d)$/),
  S.makeFilter((s) => Number.isSafeInteger(durationMs(s))),
);
export function durationMs(s: string): number {
  const m = /^(\d+)(ms|s|m|h|d)$/.exec(s);
  if (!m) return NaN;
  return Number(m[1]) * ({ ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2]] ?? NaN);
}
const PathText = Text.check(S.makeFilter((s) => !s.includes("\0")));
const Argv = S.Array(
  S.String.check(
    S.isMaxLength(4096),
    S.makeFilter((s) => !s.includes("\0")),
  ),
).check(
  S.isMinLength(1),
  S.isMaxLength(256),
  S.makeFilter((a) => a[0].length > 0),
);
const base = {
  id: Id,
  label: Text,
  tag: Text,
  color: S.optional(S.String.check(S.isPattern(/^[a-z][a-z0-9.-]*$/))),
  order: S.optional(S.Number.check(S.isInt())),
  planned: S.optional(S.Boolean),
  every: S.optional(Duration),
  idleEvery: S.optional(Duration),
  timeout: S.optional(Duration),
  waiting: S.optional(S.Boolean),
  env: S.optional(
    S.Record(
      S.String.check(S.isPattern(/^[A-Za-z_][A-Za-z0-9_]*$/)),
      S.String.check(S.makeFilter((s) => !s.includes("\0"))),
    ),
  ),
  actions: S.optional(S.Record(Id, Argv)),
};
export const SourceConfig = S.Union([
  S.Struct({
    ...base,
    type: S.Literal("command"),
    fetch: S.optional(Argv),
    transform: S.optional(S.Union([PathText.check(S.isPattern(/\.jq$/)), Argv])),
  }).check(S.makeFilter((s) => s.planned === true || s.fetch !== undefined)),
  S.Struct({ ...base, type: S.Literal("checklist"), path: PathText }),
]);
export type SourceConfig = typeof SourceConfig.Type;
export const Config = S.Struct({
  roots: S.Array(PathText).check(S.isMaxLength(128)),
  staleLimit: S.optional(Duration),
  concurrency: S.optional(S.Number.check(S.isInt(), S.isBetween({ minimum: 1, maximum: 20 }))),
});
export const OutputItem = S.Struct({
  key: Text,
  title: Text,
  since: Iso,
  kind: S.optional(Text),
  ref: S.optional(Text),
  url: S.optional(Text),
  who: S.optional(Text),
  where: S.optional(Text),
  status: S.optional(Text),
  updatedAt: S.optional(Iso),
  waiting: S.optional(S.Boolean),
  facts: S.optional(S.Record(Text, S.Union([S.String, S.Number, S.Boolean]))),
});
export type OutputItem = typeof OutputItem.Type;
export const SourceOutput = S.Struct({
  v: S.Literal(1),
  status: S.optional(S.Literals(["ok", "auth"])),
  message: S.optional(Text),
  items: S.Array(OutputItem).check(S.isMaxLength(20000)),
  shipped: S.optional(
    S.Array(S.Struct({ key: Text, at: Iso, actor: S.optional(S.Literals(["you", "agent"])) })),
  ),
}).check(S.makeFilter((o) => new Set(o.items.map((i) => i.key)).size === o.items.length));
export type SourceOutput = typeof SourceOutput.Type;
export const Item = S.Struct({ ...OutputItem.fields, source: Id, kind: Text, seenAt: Iso });
export type Item = typeof Item.Type;
export const Plan = S.Literals(["today", "inbox", "later"]);
export const Overlay = S.Struct({ plan: Plan, pinned: S.Boolean, handledAt: S.optional(Iso) });
export type Overlay = typeof Overlay.Type;
export const SourceStatus = S.Struct({
  id: Id,
  label: Text,
  tag: Text,
  color: S.optional(Text),
  order: S.Number,
  state: S.Literals([
    "ok",
    "stale",
    "auth",
    "error",
    "planned",
    "config_error",
    "loading",
    "disabled",
  ]),
  okAt: S.optional(Iso),
  checkedAt: S.optional(Iso),
  nextAt: S.optional(Iso),
  error: S.optional(S.Struct({ code: Text, message: Text })),
  writable: S.Array(Text),
});
export type SourceStatus = typeof SourceStatus.Type;
const totals = { you: S.Number, agents: S.Number };
const Count = S.Struct({
  total: S.Number,
  waiting: S.Number,
  fresh: S.Number,
  oldestSince: S.optional(Iso),
});
export const Snapshot = S.Struct({
  v: S.Literal(1),
  rev: S.Number,
  at: Iso,
  lastLookAt: S.optional(Iso),
  staleLimitMs: S.Number,
  sources: S.Array(SourceStatus),
  items: S.Array(
    S.Struct({
      ...Item.fields,
      overlay: Overlay,
      derived: S.Struct({
        ageMs: S.Number,
        remaining: S.Number,
        stale: S.Boolean,
        fresh: S.Boolean,
        waiting: S.Boolean,
      }),
    }),
  ),
  counts: S.Struct({
    plan: S.Struct({ today: S.Number, inbox: S.Number, later: S.Number }),
    bySource: S.Record(Id, S.NullOr(Count)),
  }),
  week: S.Struct({
    from: Iso,
    to: Iso,
    blocks: S.Array(S.Struct({ start: Iso, ...totals, future: S.Boolean })),
    total: S.Struct(totals),
    lastWeekSoFar: S.Struct(totals),
  }),
  alerts: S.Array(S.Never),
});
export type Snapshot = typeof Snapshot.Type;
export const Actor = S.Literals(["you", "agent"]);
export const Act = S.Struct({
  do: S.Literals([
    "plan",
    "pin",
    "handled",
    "look",
    "todo.add",
    "todo.done",
    "todo.reopen",
    "action",
  ]),
  key: S.optional(Text),
  plan: S.optional(Plan),
  pinned: S.optional(S.Boolean),
  undo: S.optional(S.Boolean),
  text: S.optional(Text),
  section: S.optional(Text),
  action: S.optional(Id),
  actor: Actor,
  agent: S.optional(S.String.check(S.isPattern(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/))),
}).check(
  S.makeFilter((a) => {
    switch (a.do) {
      case "look":
        return true;
      case "todo.add":
        return a.text !== undefined && !/[\r\n]/.test(a.text) && !/[\r\n]/.test(a.section ?? "");
      case "plan":
        return a.key !== undefined && a.plan !== undefined;
      case "pin":
        return a.key !== undefined && a.pinned !== undefined;
      case "action":
        return a.key !== undefined && a.action !== undefined;
      default:
        return a.key !== undefined;
    }
  }),
);
export type Act = typeof Act.Type;
export class CollectorError extends S.TaggedError<CollectorError>()("CollectorError", {
  code: S.Literals([
    "invalid_input",
    "config_error",
    "conflict",
    "not_found",
    "contention",
    "engine_not_running",
    "timeout",
    "output_limit",
    "command_failed",
    "invalid_output",
    "schema_unknown",
    "io",
    "outcome_unknown",
  ]),
  message: S.String,
}) {}
export const fail = (code: CollectorError["code"], message: string) =>
  new CollectorError({ code, message });
export const Health = S.Struct({
  engine: S.Literals(["running", "draining"]),
  pid: S.Number,
  active: S.Number,
  runs: S.Number,
  failures: S.Number,
  sources: S.Array(SourceStatus),
});
export const Api = RpcGroup.make(
  Rpc.make("get", { payload: {}, success: Snapshot, error: CollectorError }),
  Rpc.make("act", { payload: Act, success: S.Struct({ rev: S.Number }), error: CollectorError }),
  Rpc.make("refresh", { payload: { source: S.optional(Id) }, error: CollectorError }),
  Rpc.make("status", { payload: {}, success: Health, error: CollectorError }),
  Rpc.make("version", {
    payload: {},
    success: S.Struct({ v: S.Literal(1), version: Text }),
    error: CollectorError,
  }),
  Rpc.make("setEnabled", {
    payload: { source: Id, enabled: S.Boolean, actor: Actor },
    success: S.Struct({ rev: S.Number }),
    error: CollectorError,
  }),
  Rpc.make("stop", { payload: {}, error: CollectorError }),
);
export const decode = <A>(schema: S.Codec<A, unknown>, value: unknown): A =>
  S.decodeUnknownSync(schema, { onExcessProperty: "error" })(value);
