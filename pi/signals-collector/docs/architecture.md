# Architecture

One collector per TUI session, independent of footer/component lifetime. No UI or extension-to-extension imports. Consumers see only the [v1 event contract](contract.md). The [collection ownership decision](../../../docs/decisions/session-signals-collection.md) explains the boundary.

## Module map

| Module | Owns | Dependencies/check |
| --- | --- | --- |
| `src/extension.ts` | Lifecycle, session identity, immutable request/push snapshots, coalescing, Active restoration/tool, 15s local refresh and 60s per-repository/branch PR TTL (including original shared receipt time) | Public Pi/TypeBox + modules below; `test/extension.test.ts` real installed loader/runner/session/bus |
| `src/workspace.ts` | Existing path/Git/worktree/remote/PR unions and read-only inspection, moved unchanged from status-bar | Node filesystem/path/child process; original `test/workspace.test.ts` moved unchanged |
| `src/pr-cache.ts` | Bounded shared PR cache, default-auth isolation/bypass, 60s freshness, exclusive/stale lock and abortable contention | Node stdlib + workspace PR boundary; `test/pr-cache.test.ts` independent processes/fake gh |
| `src/usage.ts` | `industrialOs.usageSources` setting, usage DTOs, the usage-item validator and state table, one visibility-gated poll timed from the engine's `nextAt` | source-collector client; `test/usage.test.ts` settings/table/validation/lifecycle vectors with an injected request and mock timers |
| `src/source-collector.ts` | Socket path resolution and one bounded scoped `get` over newline-delimited JSON-RPC, with a locally described wire shape | Node net/os/path; `test/source-collector.test.ts` fake socket |
| `src/herdr.ts` | Session-owned event-driven Herdr visibility, bounded request sockets/reconnect and zoom resolution | Node net; `test/herdr.test.ts` fake sockets, plus lifecycle gating in extension tests |
| `src/activity.ts` | Public pi-subagents v1 ping/status/ready validation, native total and optional-owner timeout | Public Pi events, crypto; real-loader integration tests |
| `src/context.ts` | Pi settings → reserve and percentage policy | Host types only; `test/context.test.ts` policy/parity vectors |
| `src/snapshot.ts` | Wire DTO/channels, whitelisted tool targets/questions, validated private goal record | Types + pure validators; `test/snapshot.test.ts` |

## Session and publish flow

On session_start or session_tree, dispose the previous owner, restore Launch and latest successful selected-branch `set_active_project` details, start unknown local/PR/usage/fleet state, sample host/branch data, subscribe to synchronous request, start activity/usage polling/local refresh and emit ready. Non-TUI restores activate nothing. Sequence increases per extension instance across replacements; snapshots/replies are consumer-owned structured copies. A change schedules at most one push for the remaining 100ms monotonic budget since the last push, not a resetting debounce; wall-clock jumps cannot bypass the rate limit. Wire timestamps remain epoch milliseconds. The pending push resamples after other boundary handlers, and publishes only a changed sequence. No request handler, async result or push can act for an obsolete session ID.

Active selection validates path relative to Launch, canonicalizes a checkout root, aborts prior inspection/PR work, clears pending local state and refreshes. Details remain `{ version: 1, path }`; invalid/aborted calls preserve Active. In non-TUI modes the tool still resolves/validates relative to Launch and returns these persisted details, but starts no collection. Restores follow branch/new/resume/fork/reload exactly as before. Selection never changes cwd/tool execution/instructions/resources. Git inspection remains **per session**. PR requests go through the shared cache described in [contract section 3](contract.md#3-shared-github-pr-lookup), or the session-only path for explicit auth/config overrides; missing/failure states retain the old unions. Local PR cache hits keep the original shared receipt time, never renewing freshness. Async completion still checks session/controller/repository-branch ownership before publication.

Activity is mechanically moved from status-bar: compatible same-session public ping then untargeted status, authoritative safe total (not entries), one request outstanding, 2s timeout, 5s after completion and 1s minimum between coalesced lifecycle/tool/ready starts. Disposal detaches requests; the owner cannot be cancelled by this protocol.

## New host signals

Root is always `!ctx.isIdle()`; only agent_settled stamps the last settlement. Agent/turn start means waiting, assistant thinking/text/toolcall start changes phase, tool execution sets the actual tool/whitelisted bounded target, completion resumes another executing tool or waiting. Same phase/target preserves its start timestamp. Idle phase is null. Pending validated ask_user_question calls are keyed by toolCallId so an unrelated completion cannot clear them; matching completion or settlement/restore clears them. Completed/cancelled tools share completion cleanup. Model/thinking/context are sampled at observed boundaries, including phase-start messages, model/thinking selection and input; plain streaming deltas do not sample or publish; snapshots contain raw model provider/id and thinking level.

CMP is recounted from persisted compaction entries on the selected branch, never incremented from events. Goal takes the latest selected-branch private `goal-state` entry and validates the inspected pi-goal 0.54.10 shape; clearing/completion/unrecognised record gives null. No invented goal event or polling: idle command-only changes can wait until another observed boundary.

## Context parity exception

Collector alone resolves Pi settings (model override, base reserve, default 16384; disabled/invalid → null). Snapshot percentage uses budget `window − reserve` for `0 <= reserve < window`, with `min(100, tokens / budget × 100)`; otherwise host percentage capped at 100. Null tokens/percentage are unknown; host context window falls back to model window when usable.

Status-bar is explicitly allowed to keep its existing **pure** renderer arithmetic against live host tokens/window and collector reserve to preserve exact renderer contracts. No settings lookup remains there. Identical parity vectors in both projects cover no reserve, reserve ≥ window, null tokens and over-budget → 100. Any policy change updates both arithmetic implementations/tests, without cross-project imports.

## Usage flow and limits

The [contract](contract.md#2-usage-via-source-collector-owned-by-pisignals-collector) is canonical for the setting, socket, item convention and state table. Restore reads the setting once; no valid list means no collector work and a hidden row. Otherwise `collectUsage` polls at once and on show, then, while not known hidden, arms one unref'd timeout from the pure `nextPollDelay` (the contract's `nextAt` rules: 5s after the earliest run, 10s while one runs, at most 5min, 60s when unreachable or after about 2min of running polls). One request is outstanding; a show during it waits for its reply to schedule. Each poll is a fresh connection with a 5s deadline and 1MiB reply bound; any failure is one unreachable poll, never retried before the next timeout. `nextUsage` is pure: it maps the scoped reply, or its absence, and the previous state to the next state, so last-known data survives a stopped engine. Disposal clears the timeout, aborts the request and fences its result; the extension also checks session ownership before publishing.

The wire fields read are described in `usage.ts` from source-collector's documented contract and validated there, not imported. Only the PR lookup cache crosses sessions through files. No daemon, renderer or registry lives here; source-collector is the cross-session engine for usage.

## Herdr visibility flow and evidence

`watchVisibility` starts only for a TUI session with the required Herdr environment. It mirrors the socket approach, not an import, of herdr-sidebar. One long-lived subscription uses separate short-lived RPC connections: Herdr does not answer RPCs on an already subscribed connection. Requests/acknowledgements have a 1.5s deadline, lines a 1MiB bound, and reconnect backs off from 250ms to 30s. Reconciliation coalesces overlapping events and discards invalidated/obsolete reads. Session replacement/shutdown disposes every owned socket/timer. No status reporting/token writes occur here.

The [visibility contract](contract.md#pane-visibility-and-deferred-inspection) owns gating, catch-up and limits. `extension.ts` includes visibility in normal sampling/pushes, pauses Git/PR and calls usage's `setVisible`, which clears the poll timeout and polls again on show; activity and lifecycle sampling never depend on visibility.

Verified read-only against installed **Herdr 0.9.5, protocol 22**, `herdr api schema --json`, and the matching public v0.9.5 source:

- [Subscription names and layout.updated](https://github.com/herdrdev/herdr/blob/v0.9.5/src/api/schema/events.rs#L18-L85); [EventKind snake_case envelopes](https://github.com/herdrdev/herdr/blob/v0.9.5/src/api/schema/events.rs#L192-L220). Subscribe to workspace create/focus/update/close, tab create/focus/close/move, pane create/focus/move/close and layout updates. Workspace updates for another workspace, and layout updates for another tab than the last resolved one, are ignored without reads; with N Pi panes every other event still costs each collector two or three short RPC connections.
- [PaneLayoutSnapshot](https://github.com/herdrdev/herdr/blob/v0.9.5/src/api/schema/panes.rs#L593-L602) and [snapshot construction](https://github.com/herdrdev/herdr/blob/v0.9.5/src/app/api/panes.rs#L2122-L2174): `zoomed` is the tab's zoom flag; `focused_pane_id` comes from that tab's focused layout pane, even when the tab is not active. The ordinary pane rectangles alone do not encode zoom visibility.
- [Zoomed pane rendering](https://github.com/herdrdev/herdr/blob/v0.9.5/src/ui/panes.rs#L387-L417) returns only the focused pane. [Keyboard zoom](https://github.com/herdrdev/herdr/blob/v0.9.5/src/client/shell/actions.rs#L1099-L1102) calls `pane.zoom`; [its handler](https://github.com/herdrdev/herdr/blob/v0.9.5/src/app/api/panes.rs#L1408-L1440) emits a layout update on zoom or focus change; [the envelope](https://github.com/herdrdev/herdr/blob/v0.9.5/src/app/api/panes.rs#L2183-L2187) is `layout_updated`.

This is schema/source and fake-socket evidence, not interactive Pi/Herdr verification.
