# Architecture

One collector per TUI session, independent of footer/component lifetime. No UI or extension-to-extension imports. Consumers see only the [v1 event contract](contract.md). The [collection ownership decision](../../../docs/decisions/session-signals-collection.md) explains the boundary.

## Module map

| Module | Owns | Dependencies/check |
| --- | --- | --- |
| `src/extension.ts` | Lifecycle, session identity, immutable request/push snapshots, coalescing, Active restoration/tool, 15s local refresh and 60s per-repository/branch PR TTL | Public Pi/TypeBox + modules below; `test/extension.test.ts` real installed loader/runner/session/bus |
| `src/workspace.ts` | Existing path/Git/worktree/remote/PR unions and read-only inspection, moved unchanged from status-bar | Node filesystem/path/child process; original `test/workspace.test.ts` moved unchanged |
| `src/usage.ts` | Provider list, original bounded CodexBar invocation/parser and usage unions; sample DTOs | Node child process; original `test/usage.test.ts` moved unchanged |
| `src/usage-cache.ts` | Machine-wide cache whitelist, atomic mode-0600 writes, exclusive/stale locks, fs.watch reload, one five-minute+jitter timer | Node fs/path/os/crypto, usage; `test/usage-cache.test.ts` fake executables/temp XDG/multiple processes |
| `src/activity.ts` | Public pi-subagents v1 ping/status/ready validation, native total and optional-owner timeout | Public Pi events, crypto; real-loader integration tests |
| `src/context.ts` | Pi settings → reserve and percentage policy | Host types only; `test/context.test.ts` policy/parity vectors |
| `src/snapshot.ts` | Wire DTO/channels, whitelisted tool targets/questions, validated private goal record | Types + pure validators; `test/snapshot.test.ts` |

## Session and publish flow

On session_start or session_tree, dispose the previous owner, restore Launch and latest successful selected-branch `set_active_project` details, start unknown local/PR/usage/fleet state, sample host/branch data, subscribe to synchronous request, start activity/shared quota/local refresh and emit ready. Non-TUI restores activate nothing. Sequence increases per extension instance across replacements; snapshots/replies are consumer-owned structured copies. A change schedules at most one push for the remaining 100ms budget since the last push, not a resetting debounce. The pending push resamples after other boundary handlers, and publishes only a changed sequence. No request handler, async result or push can act for an obsolete session ID.

Active selection validates path relative to Launch, canonicalizes a checkout root, aborts prior inspection/PR work, clears pending local state and refreshes. Details remain `{ version: 1, path }`; invalid/aborted calls preserve Active. Restores follow branch/new/resume/fork/reload exactly as before. Selection never changes cwd/tool execution/instructions/resources. Git and PR remain **per session**, not a daemon/shared repository cache; missing/failure states retain the old unions.

Activity is mechanically moved from status-bar: compatible same-session public ping then untargeted status, authoritative safe total (not entries), one request outstanding, 2s timeout, 5s after completion and 1s minimum between coalesced lifecycle/tool/ready starts. Disposal detaches requests; the owner cannot be cancelled by this protocol.

## New host signals

Root is always `!ctx.isIdle()`; only agent_settled stamps the last settlement. Agent/turn start means waiting, assistant thinking/text/toolcall start changes phase, tool execution sets the actual tool/whitelisted bounded target, completion resumes another executing tool or waiting. Same phase/target preserves its start timestamp. Idle phase is null. Pending validated ask_user_question calls are keyed by toolCallId so an unrelated completion cannot clear them; matching completion or settlement/restore clears them. Completed/cancelled tools share completion cleanup. Model/thinking/context are sampled at observed boundaries, including message deltas, model/thinking selection and input; snapshots contain raw model provider/id and thinking level.

CMP is recounted from persisted compaction entries on the selected branch, never incremented from events. Goal takes the latest selected-branch private `goal-state` entry and validates the inspected pi-goal 0.54.10 shape; clearing/completion/unrecognised record gives null. No invented goal event or polling: idle command-only changes can wait until another observed boundary.

## Context parity exception

Collector alone resolves Pi settings (model override, base reserve, default 16384; disabled/invalid → null). Snapshot percentage uses budget `window − reserve` for `0 <= reserve < window`, with `min(100, tokens / budget × 100)`; otherwise host percentage capped at 100. Null tokens/percentage are unknown; host context window falls back to model window when usable.

Status-bar is explicitly allowed to keep its existing **pure** renderer arithmetic against live host tokens/window and collector reserve to preserve exact renderer contracts. No settings lookup remains there. Identical parity vectors in both projects cover no reserve, reserve ≥ window, null tokens and over-budget → 100. Any policy change updates both arithmetic implementations/tests, without cross-project imports.

## Shared quota flow and limits

The [contract](contract.md#2-shared-codexbar-cache-owned-by-pisignals-collector) is canonical for location/wire fields. Startup reads and watches the directory. When five minutes old, one unref'd timer with 0–249ms jitter tries `usage.lock` using wx; one ordinary winner fetches three providers, others wait for fs.watch or stale-lock backoff. Re-read freshness under lock. Atomic temporary-file/rename writes only parsed allowed fields at mode 0600. Failure stamps round freshness but retains old successful per-provider data; ENOENT hides the row. Disposal aborts fetches and suppresses callbacks/writes still pending before the rename boundary.

Stale takeover rechecks inode/mtime before unlink/exclusive retry, with the approved possible extra fetch under simultaneous stale takers. Watch/cache/permission failures remain unknown or retain last known data; no uncontrolled calls or extra polling timer. Files use a 1MiB read limit; installed boolean, providers and numbers are validated and copied through the persistence whitelist. The shared cache is the **only** cross-session data. No daemon, renderer, registry or Herdr transport lives here. A dashboard outside Pi's session is the daemon revisit condition.
