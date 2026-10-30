# Signals collector contract v1

Status: current. Sections 1–2 preserve the frozen 2026-10-08 handoff; section 3 adds shared PR lookup; `visible` is an additive v1 snapshot field. Herdr token/blocked-event/configuration sections belong to other projects. This collector is also the data source for future in-session panels and dashboards.

## 1. Snapshot contract v1 (owned by `pi/signals-collector`)

Transport: Pi's in-process `pi.events` bus. Only parsed CodexBar quota (section 2) and validated GitHub PR lookups (section 3) cross sessions through private caches; snapshots and local Git inspection remain session-owned.

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
  visible: boolean | null;           // Herdr on-screen state; null = unknown (fail open)
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

### Pane visibility and deferred inspection

`visible` is true when this pane's tab is the active tab of Herdr's focused workspace and either the tab is not zoomed or this pane is its `focused_pane_id`. It is false for another workspace/tab or another zoomed pane. Unfocused splits that remain on screen are visible. Missing `HERDR_ENV=1`, `HERDR_PANE_ID` or `HERDR_SOCKET_PATH`, a disconnected socket or a failed read gives null. Consumers treat null (and an absent field from older v1 collectors) exactly like true.

The TUI session owns an event subscription, not a visibility poll. Subscribe before resolving `pane.get`, `workspace.get` and, for an active tab, `pane.layout`; resolve again after reconnect and visibility-changing events. A failed read disconnects, reports unknown and retries through bounded reconnect backoff. Concurrent events invalidate in-flight reads; disposal cancels sockets/timers and fences results. Changes use the normal coalesced snapshot push.

While known hidden, stop the 15s Git interval and defer tool-end/Active-selection inspection and PR lookup; abort pending Git/PR work. Selection still validates and records the path. Usage timer/watch wakes do not start refresh rounds, but cache-file reloads continue; a round already fetching may finish under its existing lock. Root, phase, AU, context, questions, goals, model and all other lifecycle signals continue. On false → true/null, immediately inspect the latest Active path (including PR freshness), refresh stale usage under the same lock rules, and resume the Git interval. Asynchronous inspection results publish when ready, not as fabricated fresh data in the visibility snapshot.

Limits: server focus follows the last client that navigated when several Herdr clients exist. Detached clients and minimized terminal windows still count as visible. The Herdr sidebar's Git token for a hidden pane is stale until shown again. Visible but unfocused split panes intentionally keep animating. This is server layout visibility, not operating-system window visibility.

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

A directory-watch notification that the lock was removed wakes only a contender, a collector whose last attempt found another collector's lock: it re-reads the cache and, if it is still stale, schedules an exclusive-lock attempt with the ordinary 0–249 ms jitter. This wakes contenders when a disposed/aborted holder releases without writing. A collector's own release never wakes it, however late its notification arrives, so a failed cache write keeps the five-minute retry. Missed notifications or watch failures still rely on the bounded timer/stale-lock recovery described below.

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

## 3. Shared GitHub PR lookup

Interactive collectors share `$XDG_CACHE_HOME/industrial-os/signals-collector/pr/cache.json` (default cache root `~/.cache`). Local Git/worktree inspection, Active, synchronous request/ready, and session/selection cancellation stay per session. `PullRequestInfo` is unchanged. A shared hit carries its original receipt time into the session cache: neither reading nor restoring extends the 60-second TTL. Expired/future-dated entries are not published as fresh.

The version-1 file is `{ version: 1, entries: [{ key, at, value }] }`, at most 128 entries and 1MiB on read. Keys are SHA-256 over default auth-context metadata, lower-case GitHub repository identity and exact branch; no token or hash of a token is computed or persisted. Entries contain only epoch receipt time and validated `open` (positive safe integer number and canonical GitHub PR URL bounded to 400 characters), `none`, or enumerated `unavailable` reason. Reads and writes whitelist fields; raw gh responses, diagnostics, accounts and credential contents never persist. Expired entries are dropped and oldest insertion entries evicted under the lock. There is no migration from any earlier PR file; invalid/version-mismatched files are ignored and atomically replaced after a coordinated refresh. Deleting the `pr` directory with collectors stopped removes all retained PR data.

Auth isolation follows [gh's environment contract](https://cli.github.com/manual/gh_help_environment): `GH_TOKEN` precedes `GITHUB_TOKEN`; `GH_CONFIG_DIR` precedes `XDG_CONFIG_HOME/gh`, then the platform default. Presence (even empty) of any `GH_TOKEN`, `GITHUB_TOKEN`, `GH_CONFIG_DIR`, `XDG_CONFIG_HOME`, or `APPDATA` override bypasses **all** shared reads/writes and uses the existing session-local 60s behavior. Thus those processes do not consolidate calls, even for identical overrides. Default-context keys include HOME and only filesystem metadata (device/inode/size/mtime/ctime) of default gh config/hosts files to invalidate after account/config changes, without reading credentials. Metadata is hashed with the key, not persisted as paths. This is same-user local caching, not protection from malicious processes running as that user. Default credential/keychain changes invisible to config metadata may take the normal 60s TTL to appear.

Application cache directories are checked for symlinks/ownership and secured to 0700; files are exclusively created 0600 and atomically renamed. Cache reads refuse symlinks, nonregular files, wrong ownership/mode and oversized data. `refresh.lock` is a global exclusive `wx` lock, deliberately serializing different keys too. A winner rechecks freshness under lock before invoking the existing bounded 10s gh API command ([explicit GET/raw fields](https://cli.github.com/manual/gh_api)). Losers retry only lock/cache access with 50–99ms unref'd abortable backoff for at most 12s, then return unavailable; they never fall back to uncoordinated gh. Cache/permission/write failures remain unavailable, not absent. Successful/failure lookup results are shared for 60s; cache infrastructure failures retain per-session retry caching only.

Locks older than 30s (above the 10s command budget plus write/cleanup margin) may be removed after inode/mtime recheck, followed by another exclusive `wx` attempt. As with quota, simultaneous stale takers have a narrow accepted extra-fetch race because stat/unlink is not atomic; ordinary fresh-lock contention has one winner. A paused holder or clock jump can look stale. Waiters remain bounded even when a crash has not yet reached the stale threshold; a subsequent refresh recovers automatically. Disposal/Active/session change abort waiting/gh, releases an owned lock and suppresses pending writes before rename; an already committed atomic cache entry may remain useful to other sessions, but stale work never publishes to the replaced session. There is no watcher, daemon, background polling loop or unbounded retry queue for PRs.
