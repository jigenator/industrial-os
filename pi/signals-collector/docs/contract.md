# Signals collector contract v1

Status: current. Section 1 preserves the frozen 2026-10-08 handoff; section 2 replaces the CodexBar cache with configured source-collector sources (2026-10-31, a compatible v1 widening); section 3 adds shared PR lookup; `visible` is an additive v1 snapshot field. Herdr token/blocked-event/configuration sections belong to other projects. This collector is also the data source for future in-session panels and dashboards.

## 1. Snapshot contract v1 (owned by `pi/signals-collector`)

Transport: Pi's in-process `pi.events` bus. Only validated GitHub PR lookups (section 3) cross sessions through a private cache; usage (section 2) is read from the local source-collector engine; snapshots and local Git inspection remain session-owned.

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
  usage: UsageSnapshot;              // configured source-collector usage sources (section 2)
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

While known hidden, stop the 15s Git interval and defer tool-end/Active-selection inspection and PR lookup; abort pending Git/PR work. Selection still validates and records the path. Usage polling stops; a request already in flight may finish and publish. Root, phase, AU, context, questions, goals, model and all other lifecycle signals continue. On false → true/null, immediately inspect the latest Active path (including PR freshness), poll usage at once, and resume the Git interval. Asynchronous inspection results publish when ready, not as fabricated fresh data in the visibility snapshot.

Limits: server focus follows the last client that navigated when several Herdr clients exist. Detached clients and minimized terminal windows still count as visible. The Herdr sidebar's Git token for a hidden pane is stale until shown again. Visible but unfocused split panes intentionally keep animating. This is server layout visibility, not operating-system window visibility.

## 2. Usage via source-collector (owned by `pi/signals-collector`)

Provider usage is collected by ordinary [source-collector](../../../source-collector/README.md) sources, one per provider, configured privately. This collector only reads the sources a user lists; nothing here is provider-specific. The [decision](../../../docs/decisions/usage-via-source-collector.md) explains why.

### Configuration

The Pi setting `industrialOs.usageSources`, read with `pi.getSettings()` at each session start and `session_tree` restore, is an ordered array of 1–256 source-collector source ids (`^[a-z0-9][a-z0-9_-]{0,63}$`). Order is display order; a repeated id keeps its first position. Absent, not an array, empty, longer than 256 or containing any invalid entry means no usage polling and `usage = { installed: null, providers: [] }` (row hidden). Pi merges global and project settings; a project array replaces the global one. A change applies at the next session start, for example `/reload`.

```json
{ "industrialOs": { "usageSources": ["usage-gpt", "usage-cld", "usage-kmi"] } }
```

Verified against installed Pi 1.4.0: its settings schema allows additional top-level properties, settings files are not validated, and `getSettings()` returns a merged copy that keeps this key.

### Transport and timing

The socket is `feed.sock` in source-collector's runtime directory, resolved exactly as source-collector's own `paths()` does: `SOURCE_COLLECTOR_HOME`, default `~/Library/Application Support/source-collector`; a leading `~/` and a relative value resolve from `HOME` (else the OS home directory), an absolute value is used as is. Each poll opens one connection, writes one newline-delimited JSON-RPC 2.0 request and reads one newline-terminated reply:

```json
{ "jsonrpc": "2.0", "id": 1, "method": "get", "params": { "sources": ["usage-gpt", "usage-cld", "usage-kmi"] } }
```

A reply line over 1 MiB, a 5 s timeout, a missing or refused socket, a closed connection, a JSON-RPC error, a mismatched `id` or a result that is not a v1 snapshot (`v: 1` with `sources` and `items` arrays) makes the engine unreachable for that poll. There is no retry before the next poll and no other source-collector RPC. Polls run immediately at session start and when the pane is shown again (false → true/null). While the pane is not known hidden, the next poll is timed from the reply: 5 s after the earliest `nextAt` among the configured sources, 10 s when one has no `nextAt` (it is running), ignoring disabled, planned and misconfigured sources; clamped to 10 s–5 min, and 60 s after an unreachable engine or after 12 consecutive polls that saw a running source (a draining engine or stuck command). One request is outstanding at a time. Hidden panes do not poll. Non-TUI sessions do nothing. Replacement and shutdown abort the request in flight and suppress its result. The engine fetches each source on its own schedule (`every`, default 5 minutes); a poll reads only its stored state.

### Usage item convention

One source per provider. Its `tag` is the column tag and its `color` a usage color token such as `usage.gpt`, `usage.cld` or `usage.kmi` (the design system resolves tokens; an absent or unknown token is neutral); `label` is free text. Its transform emits SourceOutput `{ v: 1, items: [item] }` with exactly one item:

- `key`: `"usage"`; `title`: any text; `since`: the provider's reported sample time (ISO with timezone) when valid, else the fetch time.
- `facts`, all optional, absent meaning not reported:
  - `updatedAt`: ISO string, the provider's reported sample time.
  - For window `h5` (300 minutes) and `wk` (10080 minutes): `h5`/`wk` is `true` when the provider reported that window; `h5Used`/`wkUsed` is the used percent, only when finite; `h5ResetsAt`/`wkResetsAt` is an ISO string, only when known.
- A provider failure makes the fetch command fail; the engine then keeps the previous items as stale.

This collector validates every known fact: a window flag is `true`, `false` or absent; percentages are finite numbers; times are ISO 8601 instants with a timezone of at most 40 characters. Any other value makes the whole item no data. Unknown facts and every other item field are ignored and never copied.

A fake example for a CodexBar provider, in a private config root (`sources/usage-cld/source.json`):

```json
{
  "id": "usage-cld",
  "label": "Claude usage",
  "tag": "CLD",
  "color": "usage.cld",
  "type": "command",
  "fetch": ["codexbar", "usage", "--provider", "claude", "--format", "json", "--json-only"],
  "transform": "usage.jq",
  "every": "5m",
  "timeout": "60s",
  "env": { "NO_COLOR": "1" }
}
```

`usage.jq` beside it identifies windows by length, not position (Kimi reverses them; Codex has no 5-hour window), and copies no identity, credits or other fields. CodexBar exits 1 on a provider failure, which fails the fetch:

```jq
def window($minutes; $key):
  (map(select(.windowMinutes == $minutes)) | first) as $w
  | if $w == null then {}
    else { ($key): true }
      + (if ($w.usedPercent | type) == "number" then { ($key + "Used"): $w.usedPercent } else {} end)
      + (if ($w.resetsAt | type) == "string" then { ($key + "ResetsAt"): $w.resetsAt } else {} end)
    end;
.[0] as $p
| if ($p.usage | type) != "object" or $p.error != null then error("no usage") else . end
| ([$p.usage.primary, $p.usage.secondary, $p.usage.tertiary] | map(objects)) as $windows
| ($p.usage.updatedAt | if type == "string" then . else null end) as $updated
| { v: 1, items: [{
    key: "usage", title: "Usage", since: ($updated // (now | todate)),
    facts: (($windows | window(300; "h5") + window(10080; "wk"))
      + (if $updated then { updatedAt: $updated } else {} end))
  }] }
```

The engine runs commands with only `HOME`, `PATH` and the configured `env`; use an absolute `codexbar` path if its `PATH` lacks one. CodexBar's Claude provider also needs `USER` (verified with CodexBar 0.82.0: without it, it reports no available fetch strategy), so add `"USER": "<login name>"` to `env`. Usage items are ordinary items to other clients: give dispatch-feed an include list that leaves the usage sources out.

### State table

`providers` always holds one entry per configured id, in configured order.

| Condition | `installed` | Provider entry |
| --- | --- | --- |
| No valid setting | `null` | none (`providers: []`) |
| Before any successful reply, including an unreachable engine | `null` | `{ provider }` |
| Successful reply: id absent from `sources` | `true` | `{ provider, failure: "failed" }` |
| Successful reply: status `ok` | `true` | `tag`, `color`, `data` from a valid usage item; no failure |
| Successful reply: status `loading` and no items from that source | `true` | `tag`, `color`; pending: no data, no failure |
| Successful reply: any other status (`stale`, `auth`, `error`, `planned`, `config_error`, `disabled`, or `loading` with items) | `true` | `tag`, `color`, `data` from a valid usage item if one is returned (stale keeps last-known items; auth clears them); `failure: "timeout"` when the status `error.code` is `"timeout"`, else `"failed"` |
| Unreachable after an earlier success | `true` | the previous entry; one with `data` gains `failure: "failed"`, one without is unchanged |

`tag` and `color` are the status's raw strings, copied only when 1–200 characters; consumers sanitize and clip them. `data.fetchedAt` is the source status's `okAt`: the end of the successful run that produced its current items, so it moves only with a new sample. The item's `seenAt` is not used because it stays at the first time the key was seen. Without a valid `okAt` there is no data. `data.updatedAt` is `facts.updatedAt`, else null. No error message, label or other status field is copied.

### Usage wire shape

The widened v1 shape (no consumer clock):

```ts
type UsageSnapshot = { installed: boolean | null; providers: UsageProviderState[] }; // configured order
type UsageProviderState = {
  provider: string;   // source-collector source id
  tag?: string;       // raw source tag
  color?: string;     // raw source color token
  data?: {
    windows: { "5h"?: UsageWindow; wk?: UsageWindow };
    updatedAt: number | null; // provider's reported sample time
    fetchedAt: number;        // the source's okAt
  };
  failure?: "timeout" | "failed";
};
type UsageWindow = { usedPercent: number | null; resetsAt: number | null };
```

`provider` was a fixed `"codex" | "claude" | "kimi"` union and `tag`/`color` are new; this is an approved compatible widening that stays version 1. Footer staleness prefers `updatedAt` to `fetchedAt`. Consumers add their own `now` only at presentation.

The former machine-wide cache, `$XDG_CACHE_HOME/industrial-os/signals-collector/usage.json` with `usage.lock` (default cache root `~/.cache`), is no longer read or written. It may be deleted; the `pr` directory beside it is still in use.

### Compatibility and limits

Consumers subscribe before requesting on start, re-request on every matching ready, validate version and the live session ID, and dispose listeners with their session/UI. No imports from the collector. Ignore unknown additive fields. New optional fields remain v1; removing/renaming a field or changing its meaning requires v2 channels, retaining v1 until consumers migrate.

The collector alone resolves Pi settings into reserve. For exact existing footer parity, the footer retains pure arithmetic against live host tokens/window and collector reserve: usable budget = window − reserve when `0 <= reserve < window`; usedPercent = min(100, tokens / budget × 100). Otherwise use the host percentage, capped at 100; null tokens/percentage stay unknown. Both projects carry the same vector table; policy changes must update both implementations/tests, not import across projects.

Goal records are private pi-goal 0.54.10 compatibility, not a released integration API. Validate the latest selected-branch `goal-state` record; incompatible/malformed/latest-cleared records become null, not fallback to an older goal. Supported statuses are active, paused, blocked, usage_limited and budget_limited. Lifecycle/message/tool/input boundaries resample records; pi-goal has no general public goal-change event. An idle `/goal` command-only change may wait for another observed boundary; no polling/invented channel.

Usage needs a running source-collector engine: when it is not running and has not answered this session, the row stays hidden (`installed: null`), not zero. Each visible session polls on its own. A scoped `get` watches only the usage sources, so while one is visible they run at `every` and the engine's other sources keep their own cadence.

## 3. Shared GitHub PR lookup

Interactive collectors share `$XDG_CACHE_HOME/industrial-os/signals-collector/pr/cache.json` (default cache root `~/.cache`). Local Git/worktree inspection, Active, synchronous request/ready, and session/selection cancellation stay per session. `PullRequestInfo` is unchanged. A shared hit carries its original receipt time into the session cache: neither reading nor restoring extends the 60-second TTL. Expired/future-dated entries are not published as fresh.

The version-1 file is `{ version: 1, entries: [{ key, at, value }] }`, at most 128 entries and 1MiB on read. Keys are SHA-256 over default auth-context metadata, lower-case GitHub repository identity and exact branch; no token or hash of a token is computed or persisted. Entries contain only epoch receipt time and validated `open` (positive safe integer number and canonical GitHub PR URL bounded to 400 characters), `none`, or enumerated `unavailable` reason. Reads and writes whitelist fields; raw gh responses, diagnostics, accounts and credential contents never persist. Expired entries are dropped and oldest insertion entries evicted under the lock. There is no migration from any earlier PR file; invalid/version-mismatched files are ignored and atomically replaced after a coordinated refresh. Deleting the `pr` directory with collectors stopped removes all retained PR data.

Auth isolation follows [gh's environment contract](https://cli.github.com/manual/gh_help_environment): `GH_TOKEN` precedes `GITHUB_TOKEN`; `GH_CONFIG_DIR` precedes `XDG_CONFIG_HOME/gh`, then the platform default. Presence (even empty) of any `GH_TOKEN`, `GITHUB_TOKEN`, `GH_CONFIG_DIR`, `XDG_CONFIG_HOME`, or `APPDATA` override bypasses **all** shared reads/writes and uses the existing session-local 60s behavior. Thus those processes do not consolidate calls, even for identical overrides. Default-context keys include HOME and only filesystem metadata (device/inode/size/mtime/ctime) of default gh config/hosts files to invalidate after account/config changes, without reading credentials. Metadata is hashed with the key, not persisted as paths. This is same-user local caching, not protection from malicious processes running as that user. Default credential/keychain changes invisible to config metadata may take the normal 60s TTL to appear.

Application cache directories are checked for symlinks/ownership and secured to 0700; files are exclusively created 0600 and atomically renamed. Cache reads refuse symlinks, nonregular files, wrong ownership/mode and oversized data. `refresh.lock` is a global exclusive `wx` lock, deliberately serializing different keys too. A winner rechecks freshness under lock before invoking the existing bounded 10s gh API command ([explicit GET/raw fields](https://cli.github.com/manual/gh_api)). Losers retry only lock/cache access with 50–99ms unref'd abortable backoff for at most 12s, then return unavailable; they never fall back to uncoordinated gh. Cache/permission/write failures remain unavailable, not absent. Successful/failure lookup results are shared for 60s; cache infrastructure failures retain per-session retry caching only.

Locks older than 30s (above the 10s command budget plus write/cleanup margin) may be removed after inode/mtime recheck, followed by another exclusive `wx` attempt. Simultaneous stale takers have a narrow accepted extra-fetch race because stat/unlink is not atomic; ordinary fresh-lock contention has one winner. A paused holder or clock jump can look stale. Waiters remain bounded even when a crash has not yet reached the stale threshold; a subsequent refresh recovers automatically. Disposal/Active/session change abort waiting/gh, releases an owned lock and suppresses pending writes before rename; an already committed atomic cache entry may remain useful to other sessions, but stale work never publishes to the replaced session. There is no watcher, daemon, background polling loop or unbounded retry queue for PRs.
