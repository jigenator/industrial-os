import { type Snapshot, type Item, type Overlay, type SourceStatus } from "./contract.ts";
import { type Ledger } from "./store.ts";

/** D5 is a display placeholder, not an assertion about the event's actual actor. */
export function shippedBucket(event: Ledger): "you" | "agents" | undefined {
  if (event.sourceType === "checklist") return "you";
  if (event.kind === "pr_merge" || event.actor === "agent") return "agents";
  if (event.actor === "you") return "you";
  return undefined;
}
const iso = (n: number) => new Date(n).toISOString();
/** The most recent local midnight at or before t, in the process time zone like the week strip. */
export function localMidnight(t: number): number {
  const day = new Date(t);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}
/**
 * A checklist shipment reopened later the same local day no longer counts while the to-do is not
 * done again. `done` holds composite keys of items currently done.
 */
export function week(
  now: number,
  ledger: ReadonlyArray<Ledger>,
  done: ReadonlySet<string> = new Set(),
): Snapshot["week"] {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - 6);
  const boundaries: number[] = [];
  for (let day = 0; day < 7; day++)
    for (let h = 0; h < 24; h += 8) {
      const at = new Date(from);
      at.setDate(at.getDate() + day);
      at.setHours(h);
      boundaries.push(at.getTime());
    }
  const blocks = boundaries.map((start) => ({
    start: iso(start),
    you: 0,
    agents: 0,
    future: start > now,
  }));
  const total = { you: 0, agents: 0 },
    lastWeekSoFar = { you: 0, agents: 0 };
  const previousStart = new Date(from);
  previousStart.setDate(previousStart.getDate() - 7);
  const previousEnd = new Date(now);
  previousEnd.setDate(previousEnd.getDate() - 7);
  const reopened = ledger.filter((e) => e.type === "reopened");
  const undone = (event: Ledger, at: number) =>
    event.sourceType === "checklist" &&
    !done.has(`${event.source}:${event.key}`) &&
    reopened.some(
      (r) =>
        r.source === event.source &&
        r.key === event.key &&
        Date.parse(r.at) >= at &&
        localMidnight(Date.parse(r.at)) === localMidnight(at),
    );
  for (const event of ledger) {
    if (event.type !== "shipped") continue;
    const bucket = shippedBucket(event),
      at = Date.parse(event.at);
    if (!bucket || undone(event, at)) continue;
    if (at >= previousStart.getTime() && at <= previousEnd.getTime()) lastWeekSoFar[bucket]++;
    if (at < from.getTime() || at > now) continue;
    total[bucket]++;
    const index = boundaries.findLastIndex((b) => b <= at);
    if (index >= 0) blocks[index][bucket]++;
  }
  return { from: from.toISOString(), to: iso(now), blocks, total, lastWeekSoFar };
}
export function derive(input: {
  now: number;
  rev: number;
  lastLookAt?: string;
  staleLimitMs: number;
  sources: ReadonlyArray<SourceStatus>;
  items: ReadonlyArray<Item>;
  overlays: Map<string, Overlay>;
  ledger: ReadonlyArray<Ledger>;
  waiting: Map<string, boolean>;
}): Snapshot {
  const bySource: Record<
    string,
    { total: number; waiting: number; fresh: number; oldestSince?: string } | null
  > = {};
  for (const source of input.sources)
    bySource[source.id] =
      source.state === "ok" || source.state === "stale" ? { total: 0, waiting: 0, fresh: 0 } : null;
  const plan = { today: 0, inbox: 0, later: 0 };
  // A done to-do stays visible until the next local midnight after it was done, never counted.
  const midnight = localMidnight(input.now);
  const visible = input.items.filter(
    (item) => item.doneAt === undefined || Date.parse(item.doneAt) >= midnight,
  );
  const items = visible.map((item) => {
    const overlay = input.overlays.get(`${item.source}:${item.key}`) ?? {
      plan: "inbox" as const,
      pinned: false,
    };
    const ageMs = Math.max(0, input.now - Date.parse(item.since));
    const done = item.doneAt !== undefined;
    const derived = {
      ageMs,
      remaining: Math.max(0, Math.min(1, 1 - ageMs / input.staleLimitMs)),
      stale: !done && ageMs >= input.staleLimitMs,
      fresh:
        input.lastLookAt !== undefined && Date.parse(item.since) > Date.parse(input.lastLookAt),
      waiting: item.waiting ?? input.waiting.get(item.source) ?? false,
      done,
    };
    if (!overlay.handledAt && !done) {
      const count = bySource[item.source];
      if (count) {
        count.total++;
        count.waiting += Number(derived.waiting);
        count.fresh += Number(derived.fresh);
        if (!count.oldestSince || Date.parse(item.since) < Date.parse(count.oldestSince))
          count.oldestSince = item.since;
        plan[overlay.plan]++;
      }
    }
    return { ...item, overlay, derived };
  });
  return {
    v: 1,
    rev: input.rev,
    at: iso(input.now),
    ...(input.lastLookAt ? { lastLookAt: input.lastLookAt } : {}),
    staleLimitMs: input.staleLimitMs,
    sources: input.sources,
    items,
    counts: { plan, bySource },
    week: week(
      input.now,
      input.ledger,
      new Set(input.items.filter((i) => i.doneAt).map((i) => `${i.source}:${i.key}`)),
    ),
    alerts: [],
  };
}
