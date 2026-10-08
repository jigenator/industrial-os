# Signals collector contract v1

Status: current. Canonical sections 1–2 of the frozen 2026-10-08 handoff. Herdr token/blocked-event/configuration sections belong to other projects. This collector is also the data source for future in-session panels and dashboards.

## 1. Snapshot contract v1 (owned by `pi/signals-collector`)

Transport: Pi's in-process `pi.events` bus. Nothing crosses sessions except the CodexBar cache (section 2).

| Channel | Direction | Payload |
| --- | --- | --- |
| `signals-collector:v1:snapshot` | collector → consumers, pushed after every change (coalesced, at most one per 100 ms, never delayed more than 100 ms) | `SignalsSnapshot` |
| `signals-collector:v1:request` | consumer → collector | `{ reply(snapshot: SignalsSnapshot): void }`; the collector calls `reply` synchronously with its current snapshot. No call before `emit` returns means no active collector. |
| `signals-collector:v1:ready` | collector → consumers, after session start/restore and after `session_tree` | `{ version: 1, sessionId: string }`; consumers re-request |

The collector is active only in Pi's interactive TUI mode (`ctx.mode === "tui"`), so subagent child processes
(print/JSON/RPC) collect and publish nothing. Consumers validate `version === 1` and the live session ID, ignore
unknown fields, and treat a missing snapshot as unknown, never as zero or clean.

All timestamps are epoch milliseconds from `Date.now()`. The collector never formats durations; consumers format
with their own clock. Free-text fields (`phase.target`, `question.text`) are raw strings bounded to 200 UTF-16 code
units; every consumer sanitizes for its own sink.

```ts
interface SignalsSnapshot {
  version: 1;
  sessionId: string;
  seq: number;                       // strictly increasing per collector instance
  launch: string;                    // Pi's working directory, fixed for the session
  active: string;                    // Active path from set_active_project; defaults to launch
  workspace: WorkspaceInfo | null;   // status-bar's existing union, moved unchanged; null = not inspected yet
  pr: PullRequestInfo | null;        // status-bar's existing union, moved unchanged; null = not looked up yet
  root: { working: boolean; lastSettledAt: number | null }; // working = !ctx.isIdle(); time of the last agent_settled
  phase: Phase | null;               // null whenever root.working is false
  question: { text: string; more: number; since: number } | null;
                                     // a pending ask_user_question call: first question's text, number of further questions
  model: { provider: string; id: string } | null;
  thinking: string | null;           // Pi's thinking level verbatim: off|minimal|low|medium|high|xhigh|max
  context: { tokens: number | null; window: number; reserve: number | null; usedPercent: number | null } | null;
                                     // usedPercent is exactly the value status-bar's CTX gauge displays (scaled to
                                     // window − reserve when the reserve is usable, held at 100), null when unknown
  compactions: number | null;        // CMP, status-bar's existing definition
  units: number | null;              // AU, status-bar's existing definition; null = unknown
  goal: { status: string; usedSeconds: number; activeSince: number | null } | null;
                                     // from pi-goal's latest `goal-state` custom entry on the selected branch
                                     // (data.goal: status, timeUsedSeconds, activeStartedAt); null = no goal, a
                                     // cleared/complete goal, or an unrecognised record. activeSince only when status is "active".
  usage: UsageSnapshot;              // CodexBar data from the shared cache, in status-bar's existing usage shape
}

type Phase =
  | { kind: "waiting"; since: number }   // a model request is in flight and nothing has streamed yet
  | { kind: "thinking"; since: number }
  | { kind: "writing"; since: number }
  | { kind: "tool"; tool: string; target: string | null; since: number }; // Pi tool name and a short display target
```

Phase targets: `read`/`edit`/`write` → the path argument as given; `bash` → the first line of the command;
`web_search` → the query (first query when several); `fetch_content` → the URL (first when several); `subagent` →
the agent name; any other tool → `null`. A phase's `since` is when that phase began.

The `set_active_project` tool moves to the collector with the same name, parameters and persisted result details
(`{ version: 1, path }`), so existing sessions restore unchanged.

Out of scope for v1 (stay in status-bar): Ponytail, Tatsu and background-tasks status observation.

## 2. Shared CodexBar cache (owned by `pi/signals-collector`)

- One cache for the machine: `~/.cache/industrial-os/signals-collector/usage.json` (respect `XDG_CACHE_HOME`),
  mode 0600, written atomically (temporary file then rename). It holds only the whitelisted, parsed fields
  status-bar's `usage.ts` already keeps, plus `fetchedAt`; never raw CodexBar output, account or identity fields.
- A collector reads the cache on start and watches its directory (`fs.watch`) to reload when another session
  writes it. Consumers receive new usage through the normal snapshot push.
- Refresh: one unref'd timer per collector, set for when the cache turns 5 minutes old (plus small jitter). On
  wake it tries an exclusive lock file (`usage.lock`, created with `wx`, holding pid and time). The winner runs the
  existing three provider fetches and writes the cache; others do nothing and wait for the file change. A lock
  older than 3 minutes is stale and may be taken over. No session ever runs CodexBar while a fresh cache exists.
- Failures keep status-bar's existing semantics (last good sample kept per provider, `timeout`/`failed`,
  not-installed hides the row) and are recorded in the cache so other sessions do not retry immediately.

A directory-watch notification that the lock was removed re-reads the cache and, if it is still stale, schedules an exclusive-lock attempt with the ordinary 0–249 ms jitter. This also wakes contenders when a disposed/aborted holder releases without writing. Missed notifications or watch failures still rely on the bounded timer/stale-lock recovery described below.

### Usage wire and file shape

The clarified v1 usage shape (no consumer clock):

```ts
type UsageSnapshot = {
  installed: boolean | null; // null = unknown; false hides the optional row
  providers: UsageProviderState[]; // codex, claude, kimi, in this order
};
type UsageProviderState = {
  provider: "codex" | "claude" | "kimi";
  data?: {
    windows: { "5h"?: UsageWindow; wk?: UsageWindow };
    updatedAt: number | null;
    fetchedAt: number; // receipt time of this successful sample
  };
  failure?: "timeout" | "failed";
};
type UsageWindow = { usedPercent: number | null; resetsAt: number | null };
type UsageCacheFile = UsageSnapshot & { fetchedAt: number };
```

`UsageCacheFile.fetchedAt` is the last completed refresh round, including failures or a missing executable. `data.fetchedAt` remains the last successful provider receipt time when a refresh fails. A persisted file always has a boolean `installed`; `null` is in-memory unknown before a valid cache read/round. `updatedAt` is CodexBar's reported sample time; footer staleness prefers it to `data.fetchedAt`. Consumers add their own `now` only at presentation. No credentials, identities, raw stderr or raw CodexBar records are persisted.

### Compatibility and limits

Consumers subscribe before requesting on start, re-request on every matching ready, validate version and the live session ID, and dispose listeners with their session/UI. No imports from the collector. Ignore unknown additive fields. New optional fields remain v1; removing/renaming a field or changing its meaning requires v2 channels, retaining v1 until consumers migrate.

The collector alone resolves Pi settings into reserve. For exact existing footer parity, the footer retains pure arithmetic against live host tokens/window and collector reserve: usable budget = window − reserve when `0 <= reserve < window`; usedPercent = min(100, tokens / budget × 100). Otherwise use the host percentage, capped at 100; null tokens/percentage stay unknown. Both projects carry the same vector table; policy changes must update both implementations/tests, not import across projects.

Goal records are private pi-goal 0.54.10 compatibility, not a released integration API. Validate the latest selected-branch `goal-state` record; incompatible/malformed/latest-cleared records become null, not fallback to an older goal. Supported statuses are active, paused, blocked, usage_limited and budget_limited. Lifecycle/message/tool/input boundaries resample records; pi-goal has no general public goal-change event. An idle `/goal` command-only change may wait for another observed boundary; no polling/invented channel.

Cache contenders re-stat the stale lock's inode and mtime immediately before unlink, then retry exclusive `wx`. Losing contenders wait/back off. Stat/unlink is not an atomic compare-and-delete: simultaneous stale takers can cause one extra CodexBar round. This accepted residual race does not corrupt the cache because writes are atomic. Fresh-lock/fresh-cache contention has one winner; lock age uses the recorded time (mtime for malformed locks). Watch errors leave the five-minute refresh timer as bounded recovery, not a second polling loop. Jitter is 0–249 ms. Filesystem/lock/write failures do not trigger uncoordinated fetches or success-shaped data.
