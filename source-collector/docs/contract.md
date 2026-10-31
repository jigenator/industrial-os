# Contract v1

[`src/contract.ts`](../src/contract.ts) is the canonical executable schema and
Effect RpcGroup. This document explains its semantics; it is not another DTO
implementation. Changes are additive unless a new version is offered alongside
v1. Everything is local, JSON-only and trusted same-user.

## Config

`config.json` contains roots, optional staleLimit (default 3d) and concurrency
(default 20, range 1–20). Roots may be absolute, begin with `~/`, or resolve
relative to the config directory. Each root contains `sources/<id>/source.json`;
its id must match the folder (lowercase letters/digits, underscore or dash,
1–64 characters). Duplicate IDs across roots are refused, not selected.

A source has id, label, tag, type (command/checklist); optional color (a token
name, not hex), order (default 0), planned, waiting, env and actions. every defaults
to 5m, idleEvery to 15m, timeout to 30s. Durations are positive integer amounts
with ms/s/m/h/d units. Unknown fields and invalid values are rejected. Source
configs must contain no secrets. Invalid individual sources become config_error.
Removing a config stops it; enable/disable is stored locally, not written to it.

Command fetch is a nonempty argv, required unless planned. cwd is its source
folder, stdin is closed, no shell is used, and environment is HOME/PATH plus the
configured env and SOURCE_COLLECTOR_SOURCE_ID/SOURCE_COLLECTOR_RUN_ID. Transform is
optional: a .jq filename uses jq -f, otherwise an argv receives fetch stdout.
Paths resolve from the source folder. Both stages must exit zero and complete
within one combined timeout; stdout is capped at 5 MiB per stage. Timeout sends
SIGTERM to the process group, then SIGKILL after 10 seconds. stderr is capped,
drained and logged; a failure exposes only its first trimmed 200-character line.
Without transform the fetch output is already SourceOutput. Actions map names to
argv. Only an entire `{key}` argv element is substituted with the source-local
key; no interpolation into shell text occurs. Actions share admission and limits.

Checklist path may be absolute, start with `~/`, or be relative to the source
folder. `## heading` supplies where. A directly preceding
`<!-- YYYY-MM-DD HH:MM:SS [session] -->` supplies local since/who and the key
`<timestamp>#<session>`. Without a comment the key is a SHA-256 of heading plus
text; the initial since fallback is file mtime, preserved once stored. `- [ ]`
is open and `- [x]` (also uppercase X) is done. When a key repeats, as when one
writer stamps two items in the same second, each later item gets `#` plus the
first 12 hex digits of that hash, then `#2`, `#3` if still equal.
The engine watches the file and rereads at least every 30 seconds.

A checklist's `[ ]`→`[x]` transition records a shipment; `[x]`→`[ ]` records a
`reopened` ledger event, which is not a shipment. A done line stays a stored item
with `doneAt` when its completion time is known. That time comes from, in order:
the shipment this observation records (on a repeat completion after a reopen the
ledger keeps the first shipment, so this is the observed transition time), the
item's stored `doneAt`, then the ledger's shipped event for that source and key.
With none, as for a line already `[x]` when first seen, the line stays gone and
never shows. After a restart the stored rows stand in for the last read, done rows
as done, so the first reread never fakes a completion.

Todo edits preserve all other lines and newline style. Adds may select an existing
section; absent section means append. Added comments use the agent session when
provided, otherwise a generated UUIDv7. Two adds with the same named session in
one second return conflict before writing, rather than create duplicate keys.
Concurrent mtime/size/hash changes cause one reread/retry, then conflict.

## SourceOutput

The output object has v:1, full current items, optional status (ok/auth), message
and shipped. An item requires key, title, since (ISO with timezone). Optional
fields are kind, ref, url, who, where, status, updatedAt, waiting and facts
(string/number/boolean values). Keys must be unique within one output. Missing
previous items become gone. Shipped entries contain key, ISO at and optional
actor (you/agent), deduplicated by source/key. The provisional week attribution
rule uses that actor, or kind pr_merge when the shipment matches a current item;
see design. auth clears items; other failures keep
them as stale. planned sources never execute.

## Snapshot

get returns v, rev, at, optional lastLookAt, staleLimitMs, sources, items, counts,
week and alerts. Each item retains its source-local key and adds source, kind
(default item or todo), seenAt, overlay and derived, plus optional doneAt (ISO).
RPC act keys use the composite `<source>:<source-local-key>`; clients construct it
from those two fields.

doneAt is present only on a checklist item that is `[x]`. Such an item is returned
only while doneAt is on or after the most recent local midnight of the request
time, in the engine's time zone like the week; then it disappears even if rev has
not moved. rev advances with the next checklist observation after midnight, and
checklists are reread at least every 30 seconds.

Overlay defaults to plan inbox and pinned false; handledAt remains optional.
Derived ageMs is nonnegative elapsed time from since; remaining clamps
1−age/staleLimit; stale means age≥limit; fresh compares since to lastLookAt (false
before a first look); waiting is item.waiting ?? source.waiting ?? false. done is
true exactly when doneAt is present, and a done item is never stale.

SourceStatus carries id/label/tag/order, optional color/okAt/checkedAt/nextAt/error,
state and writable action names. States and shared truthfulness rules live in
[design](design.md). NextAt is advisory admission timing, not a queued promise.
Counts include today/inbox/later and per-source total/waiting/fresh/oldestSince;
per-source counts are null outside ok/stale. Handled and done items do not
contribute to plan, total, waiting, fresh or oldestSince.

Week has from/to, 21 local civil eight-hour blocks (start/you/agents/future), total
and lastWeekSoFar. See design for civil-time, D5 and same-day reopen semantics.
alerts is always [].
rev advances only on stored changes, including run/source observations or overlay
changes; not on an otherwise unchanged get. Derived values and at always use now.

## RPC and CLI

Effect RpcGroup over a Unix SocketServer, RpcSerialization.ndJsonRpc. The socket
is feed.sock (0600), in the private runtime directory (0700). For example:

```json
{ "jsonrpc": "2.0", "id": 1, "method": "get", "params": {} }
```

| Method     | Input                                | Result                                                    |
| ---------- | ------------------------------------ | --------------------------------------------------------- |
| get        | { sources?: string[] }               | Snapshot; watching extends two minutes (selected sources) |
| act        | do, actor and operation fields below | {rev}                                                     |
| refresh    | optional source                      | void; background admission, no queue                      |
| status     | {}                                   | engine phase, pid, active/runs/failures, source health    |
| version    | {}                                   | {v:1, version}                                            |
| setEnabled | source, enabled, actor               | {rev}; local overlay, CLI enable/disable                  |
| stop       | {}                                   | void acknowledgement; drain continues before process exit |

`get` without `sources` returns the complete snapshot as before. When present,
`sources` must be an array of 1–256 strings; other values are schema errors.
Duplicates are harmless and unknown ids are silently omitted. The reply contains
only selected source statuses (in normal source order) and their items;
`counts.plan`, `counts.bySource` (selected ids only) and all week values use only
selected sources. `v`, `rev`, `at`, `lastLookAt`, `staleLimitMs` and `alerts` stay
global. A scoped get extends watching (the `every` rather than `idleEvery`
cadence) for two minutes only for its selected, configured sources; an unscoped
get does so for every source. It is a read projection, not an authorization or
collection boundary. For example:

```json
{ "jsonrpc": "2.0", "id": 1, "method": "get", "params": { "sources": ["todo", "fake"] } }
```

The last two methods are additive operational controls needed by the CLI.
Act.do is plan/pin/handled/look/todo.add/todo.done/todo.reopen/action. Actor is
required (you/agent); agent is an optional session identifier. plan/pin require
key and plan/pinned; handled requires key, with undo to clear it; look sets the
shared cursor. todo.add needs text and accepts optional section and source. Its
checklist is source when given, else the source of a composite key, else the only
enabled checklist. A source that is unknown, not a checklist, planned or disabled
is invalid_input; source on any other operation is a schema error. done/reopen
need the composite key and can address a stored gone or done item. action needs
key and action name. Successful mutations append actor ledger rows; shipments
record actual actor independently of D5.

CollectorError codes are invalid_input, config_error, conflict, not_found,
contention, engine_not_running, timeout, output_limit, command_failed,
invalid_output, schema_unknown, io and outcome_unknown. Malformed RPC envelopes or
schema-invalid requests are JSON-RPC protocol errors; valid requests receive
schema-declared errors. Causes/stacks are not public error fields. A lost mutation
reply can mean it applied: arbitrary actions/adds are not safe to replay blindly.

### CLI overlay commands

All overlay commands are thin clients of `act`, printing its `{rev}` JSON result:

| Command                          | Act fields (in addition to actor/session)      |
| -------------------------------- | ---------------------------------------------- |
| `plan <key> today\|inbox\|later` | do plan, key, plan                             |
| `pin <key> [--off]`              | do pin, key, pinned true (false with --off)    |
| `handled <key> [--undo]`         | do handled, key, undo false (true with --undo) |
| `look`                           | do look                                        |
| `action <key> <name>`            | do action, key, action name                    |

Each accepts `--agent [session]` (also `--agent=session`), like todo commands:
actor agent plus the optional session; without it, actor you. Key is exactly
`<source>:<source-local-key>`, not just the item's key field. For example, full
`get` output with `source: "fake"`, `key: "demo"` means `plan fake:demo today`.
Quote the entire composite key when it contains spaces. Actions must already be
configured on the selected source; source `writable` lists available names.
Mutations acknowledge a revision, not a refreshed observation of external state.

`get` still prints the complete v1 Snapshot. `get --items` prints one compact v1
JSON object per item, with composite key, source, state (the source's state),
plan, pinned, handled and done (booleans) and title. JSON escaping keeps titles
and keys on one line without terminal control codes. No items prints no lines on success;
failures never emit an empty success-shaped result. Use full get for health and
observation timestamps; stale items remain last-known, not live observations.

CLI client commands never synthesize data when the engine is absent. Exit codes:
0 success, 1 operational, 2 invalid input/config/output, 8 contention. run is
foreground. check and validate are deliberately offline: check executes one
source without engine/store and prints raw size, transformed output and validation
outcome; validate checks configs without fetching. Service commands require macOS;
install never starts and uninstall keeps data. Exact usage comes from --help.
