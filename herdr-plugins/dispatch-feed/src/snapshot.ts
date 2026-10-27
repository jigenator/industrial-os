import type { SOURCE_STATES } from "@industrial-os/design-system/elements/type-unit";

export type SourceState = keyof typeof SOURCE_STATES;
export type Plan = "today" | "inbox" | "later";
export interface Source {
  id: string;
  label: string;
  tag: string;
  color?: string;
  order: number;
  state: SourceState;
  writable: string[];
}
export interface Item {
  key: string;
  source: string;
  title: string;
  kind: string;
  since: string;
  seenAt: string;
  url?: string;
  who: string;
  where: string;
  status: string;
  ref: string;
  overlay: { plan: Plan; pinned: boolean; handledAt?: string };
  derived: { ageMs: number; remaining: number; stale: boolean; fresh: boolean; waiting: boolean };
}
export interface Count {
  total: number;
  waiting: number;
  fresh: number;
}
export interface WeekBlock {
  start: string;
  you: number;
  agents: number;
  future: boolean;
}
export interface Snapshot {
  v: 1;
  rev: number;
  at: string;
  lastLookAt?: string;
  staleLimitMs: number;
  sources: Source[];
  items: Item[];
  counts: { plan: Record<Plan, number>; bySource: Record<string, Count | null> };
  week: {
    blocks: WeekBlock[];
    total: { you: number; agents: number };
    lastWeekSoFar: { you: number; agents: number };
  };
  alerts: never[];
}
export function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("invalid_reply");
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 4096)
    throw new Error("invalid_reply");
  return value;
}
function optionalText(value: unknown): string | undefined {
  return value === undefined ? undefined : text(value);
}
function iso(value: unknown): string {
  const s = text(value);
  if (!Number.isFinite(Date.parse(s)) || !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(s))
    throw new Error("invalid_reply");
  return s;
}
function num(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    throw new Error("invalid_reply");
  return value;
}
function count(value: unknown): number {
  const n = num(value);
  if (!Number.isSafeInteger(n)) throw new Error("invalid_reply");
  return n;
}
function bool(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("invalid_reply");
  return value;
}
function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error("invalid_reply");
  return value;
}
const states = new Set([
  "ok",
  "stale",
  "auth",
  "error",
  "config_error",
  "disabled",
  "planned",
  "loading",
]);
export const itemId = (item: Pick<Item, "source" | "key">): string => `${item.source}:${item.key}`;
export function decodeSnapshot(value: unknown): Snapshot {
  const s = object(value);
  if (s.v !== 1) throw new Error("schema_unknown");
  const sources = list(s.sources, 256).map((value) => {
    const o = object(value),
      id = text(o.id),
      state = text(o.state);
    if (
      !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(id) ||
      typeof o.order !== "number" ||
      !Number.isSafeInteger(o.order)
    )
      throw new Error("invalid_reply");
    return {
      id,
      label: text(o.label),
      tag: text(o.tag),
      color: optionalText(o.color),
      order: o.order,
      state: states.has(state) ? (state as SourceState) : "unknown",
      writable: list(o.writable, 256).map(text),
    };
  });
  if (new Set(sources.map((s) => s.id)).size !== sources.length) throw new Error("invalid_reply");
  const byId = new Map(sources.map((s) => [s.id, s]));
  const items: Item[] = list(s.items, 20000).map((value) => {
    const o = object(value),
      d = object(o.derived),
      l = object(o.overlay),
      source = text(o.source),
      remaining = num(d.remaining);
    if (!byId.has(source) || remaining > 1 || !["today", "inbox", "later"].includes(String(l.plan)))
      throw new Error("invalid_reply");
    return {
      key: text(o.key),
      source,
      title: text(o.title),
      kind: text(o.kind),
      since: iso(o.since),
      seenAt: iso(o.seenAt),
      url: optionalText(o.url),
      who: optionalText(o.who) ?? "",
      where: optionalText(o.where) ?? "",
      status: optionalText(o.status) ?? "",
      ref: optionalText(o.ref) ?? "",
      overlay: {
        plan: l.plan as Plan,
        pinned: bool(l.pinned),
        handledAt: o.overlay && l.handledAt !== undefined ? iso(l.handledAt) : undefined,
      },
      derived: {
        ageMs: num(d.ageMs),
        remaining,
        stale: bool(d.stale),
        fresh: bool(d.fresh),
        waiting: bool(d.waiting),
      },
    };
  });
  if (new Set(items.map(itemId)).size !== items.length) throw new Error("invalid_reply");
  const counts = object(s.counts),
    plan = object(counts.plan),
    bySource = object(counts.bySource);
  const per: Record<string, Count | null> = Object.create(null);
  for (const source of sources) {
    const raw = Object.hasOwn(bySource, source.id) ? bySource[source.id] : null;
    if (raw === null || !["ok", "stale"].includes(source.state)) {
      per[source.id] = null;
      continue;
    }
    const c = object(raw);
    per[source.id] = { total: count(c.total), waiting: count(c.waiting), fresh: count(c.fresh) };
  }
  const week = object(s.week),
    totals = (v: unknown) => {
      const o = object(v);
      return { you: count(o.you), agents: count(o.agents) };
    };
  const blocks = list(week.blocks, 21).map((v) => {
    const b = object(v);
    return { start: iso(b.start), ...totals(b), future: bool(b.future) };
  });
  if (
    blocks.length !== 21 ||
    blocks.some((b, i) => i > 0 && Date.parse(b.start) <= Date.parse(blocks[i - 1].start))
  )
    throw new Error("invalid_reply");
  if (list(s.alerts, 0).length) throw new Error("schema_unknown");
  const staleLimitMs = num(s.staleLimitMs);
  if (!staleLimitMs) throw new Error("invalid_reply");
  return {
    v: 1,
    rev: count(s.rev),
    at: iso(s.at),
    lastLookAt: s.lastLookAt === undefined ? undefined : iso(s.lastLookAt),
    staleLimitMs,
    sources: sources.sort((a, b) => a.order - b.order),
    items,
    counts: {
      plan: { today: count(plan.today), inbox: count(plan.inbox), later: count(plan.later) },
      bySource: per,
    },
    week: { blocks, total: totals(week.total), lastWeekSoFar: totals(week.lastWeekSoFar) },
    alerts: [],
  };
}
