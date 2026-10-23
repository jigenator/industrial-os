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
is open and `- [x]` (also uppercase X) is done. Duplicate keys are invalid.
The engine watches the file and rereads at least every 30 seconds.

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
actor (you/agent), deduplicated by source/key. PR merge sources use kind pr_merge
for the provisional week attribution rule. A shipment without a known item kind
is stored but does not infer a PR merge. auth clears items; other failures keep
them as stale. planned sources never execute.

## Snapshot

get returns v, rev, at, optional lastLookAt, staleLimitMs, sources, items, counts,
week and alerts. Each item retains its source-local key and adds source, kind
(default item or todo), seenAt, overlay and derived. RPC act keys use the composite
`<source>:<source-local-key>`; clients construct it from those two fields.

Overlay defaults to plan inbox and pinned false; handledAt remains optional.
Derived ageMs is nonnegative elapsed time from since; remaining clamps
1−age/staleLimit; stale means age≥limit; fresh compares since to lastLookAt (false
before a first look); waiting is item.waiting ?? source.waiting ?? false.

SourceStatus carries id/label/tag/order, optional color/okAt/checkedAt/nextAt/error,
state and writable action names. States and shared truthfulness rules live in
[design](design.md). NextAt is advisory admission timing, not a queued promise.
Counts include today/inbox/later and per-source total/waiting/fresh/oldestSince;
per-source counts are null outside ok/stale. Handled items do not contribute.

Week has from/to, 21 local civil eight-hour blocks (start/you/agents/future), total
and lastWeekSoFar. See design for civil-time and D5 semantics. alerts is always [].
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
| get        | {}                                   | Snapshot; watching extends for two minutes                |
| act        | do, actor and operation fields below | {rev}                                                     |
| refresh    | optional source                      | void; background admission, no queue                      |
| status     | {}                                   | engine phase, pid, active/runs/failures, source health    |
| version    | {}                                   | {v:1, version}                                            |
| setEnabled | source, enabled, actor               | {rev}; local overlay, CLI enable/disable                  |
| stop       | {}                                   | void acknowledgement; drain continues before process exit |

The last two methods are additive operational controls needed by the CLI.
Act.do is plan/pin/handled/look/todo.add/todo.done/todo.reopen/action. Actor is
required (you/agent); agent is an optional session identifier. plan/pin require
key and plan/pinned; handled requires key, with undo to clear it; look sets the
shared cursor. todo.add needs text and optional section; with multiple checklists,
a composite key can select its source. done/reopen need the composite key and can
address a stored gone item. action needs key and action name. Successful mutations
append actor ledger rows; shipments record actual actor independently of D5.

CollectorError codes are invalid_input, config_error, conflict, not_found,
contention, engine_not_running, timeout, output_limit, command_failed,
invalid_output, schema_unknown, io and outcome_unknown. Malformed RPC envelopes or
schema-invalid requests are JSON-RPC protocol errors; valid requests receive
schema-declared errors. Causes/stacks are not public error fields. A lost mutation
reply can mean it applied: arbitrary actions/adds are not safe to replay blindly.

CLI client commands never synthesize data when the engine is absent. Exit codes:
0 success, 1 operational, 2 invalid input/config/output, 8 contention. run is
foreground. check and validate are deliberately offline: check executes one
source without engine/store and prints raw size, transformed output and validation
outcome; validate checks configs without fetching. Service commands require macOS;
install never starts and uninstall keeps data. Exact usage comes from --help.
