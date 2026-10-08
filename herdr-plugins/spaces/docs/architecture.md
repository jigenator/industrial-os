# Architecture

Evidence: Herdr 0.9.3 source at tag `v0.9.3`: `app/api/plugins/runtime.rs`,
`api/schema/events.rs`, `api/schema/workspaces.rs`, `api/schema/panes.rs`,
`app/api/workspaces.rs`, `app/api_helpers.rs`, `metadata_tokens.rs`,
`client/shell/sidebar.rs`, `ui/sidebar/tokens.rs`, `persist/snapshot.rs`,
`persist/restore.rs`; its plugin/socket/configuration docs. Tests use a local
fake server modeling the verified subset of these shapes, not a live Herdr
session. Initial fake-server subscription/name assumptions were incorrect;
see the correction in [verification records](../CONTRIBUTING.md#review-fix-round).

## Modules and dependencies

| Module | Owns |
| --- | --- |
| `bin/spaces.mjs` | `ensure`, `run`, `status`, `stop`; detached spawn with ignored stdio and minimal env |
| `src/model.mjs` | Pure input validation, tokens, cell widths, activity history and sort plan |
| `src/transport.mjs` | Newline JSON request sockets, subscription, bounds, handshake and reconnect |
| `src/reporter.mjs` | Stable source, sequence, accepted diff/full/clear, TTL and retry deadlines |
| `src/state.mjs` | Socket identity, private storage, atomic writes, instance lock, config and bounded logs |
| `src/daemon.mjs` | Serialized reconciliation, event fencing, timers, persistence, ordering, health and shutdown |
| `herdr-plugin.toml` | Herdr startup/event hooks and status/stop actions |

Imports are Node standard library and sibling modules only. No package.json,
lockfile, build, renderer or dependency installation is needed.

```mermaid
flowchart LR
    Hook["ensure hook"] -->|detached, no pipes| Daemon["one daemon per socket"]
    Daemon -->|subscription + bounded requests| Herdr["Herdr Unix socket"]
    Herdr -->|Pi pane AU tokens| Daemon
    Daemon -->|workspace tokens, move_block| Herdr
    Daemon --> State["socket-keyed local state"]
    Fragment["herdr/spaces.toml"] -.->|manual merge| Herdr
```

## Reconciliation and failure boundaries

Subscribe first to the dotted request kinds in `transport.mjs` (never
metadata_updated or pane-scoped agent_status_changed). Herdr lifecycle events
arrive snake_case; the transport maps them to one dotted internal form. Busy
panes come from `pane.list`; agent changes invalidate through `pane.updated`.
After `subscription_started`, and after a bounded 500 ms event coalescing window,
read `workspace.list` and `pane.list` concurrently. One reconciliation at a time;
each request opens its own socket and waits at most one second. Events are
invalidation, not an unconditional snapshot patch. `pane.updated` requests a
debounced reread without advancing the event epoch; other events advance it.
Discard at most three consecutive event-fenced reads, then publish the latest
validated snapshot with a dirty rerun to prevent TTL starvation. A separate
connection epoch always rejects reads across disconnect/reconnect. The move
fence still requires the original unchanged event epoch. Validate list shapes;
a pane-count mismatch retries both reads once, then skips only inconsistent
workspaces with a distinct
`pane_count_mismatch` diagnostic and leaves their accepted tokens alone. Skip
ordering on any partial read. Apply the bounded event fence once after reads,
then let all workspace reports complete despite events; dirty reruns correct intermediate
values. Advance/persist history, report, and consider ordering. Pane metadata
from any reporter can arrive through `pane.updated` but never counts as activity.

A 30-second periodic tick refreshes ages and full TTL reports, re-reads
`config.json`, and calls `plugin.list` with the plugin ID. A valid absent/disabled
entry stops the daemon on the next tick (plus in-flight bounded requests).
Registry checks run independently of report passes, so later workspaces cannot
delay disable detection. Failed/invalid registry reads log `plugin_read_failed`
and retry; no new report pass or ordering starts until registry validation
succeeds, though in-flight reports can finish. Config errors retain the last
valid setting; absent files restore defaults silently. Invalid errors log `config_invalid` once per bounded error category
(parse, validation, or recognized filesystem errors) per daemon run. Startup
uses defaults until the first valid file. A failed list read publishes nothing;
retry reads from 250 ms up to 30 seconds. Report failures have their separate
5–60 second deadlines, but only future deadlines schedule reconciliation;
past-due skipped workspaces wait for an event/tick. New events/ticks cannot bypass report
backoff. Reads are never attempted on a disconnected subscription. Reconnect
from 250 ms to 30 seconds, with a one-second handshake timeout; exit after two
minutes without a successful subscription. A responsive subscription with
failed reads remains running and records read failures; TTL expiry is truthful.

One subscription plus two concurrent list-read sockets are live on the normal
read path; registry reads add at most one independent bounded socket on each tick;
reports and moves are sequential. Read replies are bounded to 1 MiB per line,
4096 workspaces and 16384 panes; history to 16384 entries and 1 MiB of entries.
Resource-ceiling/IO failures stop that reconciliation and retry, not partial
new display data. Renewal targets 30 seconds with responsive Herdr; a very
large or slow session can miss it, and TTL expiry is preferable to a false
reading. No latency/load benchmark is claimed.

## Lock and persistence

State is partitioned by the first 32 hex characters of SHA-256(socket path).
Single instance uses atomic rename of a populated, unique staging directory
into the socket lock directory. Contenders cannot observe a half-written empty
new lock. The lock primitive requires an explicit liveness predicate; production
supplies only the unique control-endpoint probe, never a PID fallback. A dead
owner is recovered by unlinking only its unique PID marker then nonrecursive
rmdir: a competing reaper cannot remove a new populated
owner directory. Malformed lock contents fail closed. Each contender listens
on a unique
owner control Unix socket before publishing its lock marker. Probe/stop requests
must match that unique marker and return the owner identity; PID existence alone
is never daemon liveness. ENOENT/ECONNREFUSED prove a stale endpoint; timeouts or
invalid replies fail closed for lock recovery/ensure (`status` reports false).
The initial PID-only daemon must be stopped before upgrading; it cannot answer
this protocol. No disk PID is signaled. `stop` requests clean shutdown only through that endpoint.

Endpoints use a 24-hex hashed name under the state directory. Paths above 100
bytes fall back to `/tmp/ios-sp-<uid>/`, a verified uid-owned mode-0700 directory;
no configurable TMPDIR length can exceed Darwin's 104-byte sun_path. Local
state parents may be owner-writable 0755, but never group/other-writable. Socket
files are 0600, removed on shutdown; stale recovery also unlinks only the exact
owner endpoint after ENOENT/ECONNREFUSED. A crash may leave a harmless uniquely
named socket inode until recovery or verified operator cleanup. Local
control sockets bound command size, connections and idle time. This is trusted
same-user IPC, not authentication against another process under that uid.

Atomic files use unique temporary files then rename; mode 0600. This prevents
partial JSON on ordinary interruption but is not fsync/power-loss durability.
History version 1 holds timestamps and persisted sorting signature/last move;
malformed history resets to first-seen now and logs a code. Creation events
refresh known IDs; consumed activity entries and IDs absent from the validated
read are removed from the bounded pending activity set (skipped IDs stay).
Memory-only labels detect differently named ID reappearance
after an absent read. Missed creation across restarts or same-label reuse can
still inherit age; see [identity limits](token-contract.md#activity-and-identity).
Config is read at startup and on every tick using the retention/default policy
above. Storage paths are
operator-owned; leaf symlinks for readable state/config/locks/logs are rejected.
Parents are assumed trusted. No shared store or cross-project code import.
Privacy and deletion are in the [README](../README.md#operations-and-privacy).

## Ordering

Worktree units match Herdr's `workspace_entries`: same `worktree.repo_key`,
at least two members and at least one non-linked member; the first non-linked
parent draws first, children follow user order. A group is quiet only if all
members are quiet. Group age is its most recent member activity. Non-quiet
units retain user order, quiet units sort least quiet first, quietest last;
equal ages break ties by canonical member IDs. All quiet IDs are moved in one
`workspace.move_block` request, omitting the anchor for end insertion. This
operation is atomic in Herdr; the unit focused in the validated snapshot never appears in the block.

Signature tracks quiet-unit membership and quiet order, not non-quiet order
or age text. Store it across daemon restarts. Unchanged signatures do nothing,
even after a manual drag. Changed signatures are held until the minute rate
limit permits a move. Failed moves do not accept the new signature; retry is
rate-limited and reads current state again. A dropped reply can have applied
on the server, but the next read avoids a duplicate move if already ordered.
An immediate pre-dispatch epoch check aborts plans invalidated by events while
diagnostics/persistence yielded. There is no server-side expected-focus/version
precondition: if the user focuses a quiet space between that check and Herdr
applying the move, it can still move to the bottom. Herdr preserves the active
workspace by ID (`app/actions.rs` move_workspace_block), so focus stays on it;
the next recompute marks it active. No undo or race-specific retry is added.
Number shortcuts follow Herdr position.

## Shutdown and observability

SIGTERM/SIGINT, the socket-scoped stop action, absent/disabled plugin, connection
exhaustion or startup failure cancel every timer,
close the subscription and fence work. Await the current bounded request path,
write final health/log codes, release only our lock marker. No token clears:
TTL keys expire, names freeze. Local health has aggregate reads, failures,
moves, reconnects, accepted report counts and timestamp. No resource names,
workspace IDs or payloads enter diagnostics. Connected health writes are guarded
by subscription state, including late registry responses and completed move passes.
Tick/reconciliation health-write failures log at their boundary and retry without
stopping the daemon; health can remain stale during storage failure. Startup
storage failure still aborts startup. No external metrics server.
