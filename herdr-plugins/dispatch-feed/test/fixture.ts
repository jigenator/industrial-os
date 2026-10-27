import type { Snapshot } from "../src/snapshot.ts";
export function fixture(): Snapshot {
  const now = Date.parse("2026-10-23T14:00:00Z"),
    start = now - 6 * 86400000 - 6 * 3600000;
  const sources = [
    {
      id: "reviews",
      label: "Pull requests",
      tag: "PR",
      color: "type.pr",
      order: 0,
      state: "ok" as const,
      writable: [],
    },
    {
      id: "scratch",
      label: "To-do",
      tag: "TODO",
      color: "type.todo",
      order: 1,
      state: "ok" as const,
      writable: ["todo.add", "todo.done", "todo.reopen"],
    },
    {
      id: "issues",
      label: "Linear pings",
      tag: "LIN",
      color: "type.linear",
      order: 2,
      state: "planned" as const,
      writable: [],
    },
    {
      id: "messages",
      label: "Messages",
      tag: "MSG",
      color: "type.msg",
      order: 3,
      state: "planned" as const,
      writable: [],
    },
    {
      id: "mail",
      label: "Important email",
      tag: "EML",
      color: "type.email",
      order: 4,
      state: "planned" as const,
      writable: [],
    },
  ];
  const titles = [
    "Review retry policy",
    "Context gauge rounding",
    "Check release notes",
    "Update install guide",
    "Handle parser edge case",
    "Document stale source state",
    "Organize fixture notes",
    "Verify terminal restoration",
    "Test short viewport",
    "Review activity totals",
  ];
  const items = titles.map((title, i) => ({
    key: `item-${i}`,
    source: i < 6 ? "reviews" : "scratch",
    title,
    kind: i < 6 ? "review" : "todo",
    since: new Date(now - (i + 1) * 4 * 3600000).toISOString(),
    seenAt: new Date(now - 1000).toISOString(),
    who: i % 2 ? "you" : "reviewer",
    where: "example/project",
    status: i < 6 ? "Review requested" : "Open",
    ref: `EX-${i + 1}`,
    url: "https://example.com/items/1",
    overlay: { plan: (["today", "inbox", "later"] as const)[i % 3], pinned: i === 4 },
    derived: {
      ageMs: (i + 1) * 4 * 3600000,
      remaining: 1 - ((i + 1) * 4) / 72,
      stale: false,
      fresh: i % 3 === 0,
      waiting: i === 0 || i === 2,
    },
  }));
  const blocks = Array.from({ length: 21 }, (_, i) => ({
    start: new Date(start + i * 28800000).toISOString(),
    you: i > 19 ? 0 : i % 4,
    agents: i > 19 ? 0 : i % 7,
    future: i > 19,
  }));
  return {
    v: 1,
    rev: 3,
    at: new Date(now).toISOString(),
    staleLimitMs: 3 * 86400000,
    sources,
    items,
    counts: {
      plan: { today: 4, inbox: 3, later: 3 },
      bySource: {
        reviews: { total: 6, waiting: 2, fresh: 2 },
        scratch: { total: 4, waiting: 0, fresh: 2 },
        issues: null,
        messages: null,
        mail: null,
      },
    },
    week: { blocks, total: { you: 28, agents: 57 }, lastWeekSoFar: { you: 34, agents: 65 } },
    alerts: [],
  };
}
