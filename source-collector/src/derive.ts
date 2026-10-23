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
export function week(now: number, ledger: ReadonlyArray<Ledger>): Snapshot["week"] {
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
  for (const event of ledger) {
    if (event.type !== "shipped") continue;
    const bucket = shippedBucket(event),
      at = Date.parse(event.at);
    if (!bucket) continue;
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
  const items = input.items.map((item) => {
    const overlay = input.overlays.get(`${item.source}:${item.key}`) ?? {
      plan: "inbox" as const,
      pinned: false,
    };
    const ageMs = Math.max(0, input.now - Date.parse(item.since));
    const derived = {
      ageMs,
      remaining: Math.max(0, Math.min(1, 1 - ageMs / input.staleLimitMs)),
      stale: ageMs >= input.staleLimitMs,
      fresh:
        input.lastLookAt !== undefined && Date.parse(item.since) > Date.parse(input.lastLookAt),
      waiting: item.waiting ?? input.waiting.get(item.source) ?? false,
    };
    if (!overlay.handledAt) {
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
    week: week(input.now, input.ledger),
    alerts: [],
  };
}
