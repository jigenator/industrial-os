# Architecture

## Modules and dependency direction

| Module                                  | Owns                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| `bin/source-collector.ts`               | Effect CLI, exit codes, terminal diagnostics                                 |
| `src/contract.ts`                       | Config/output/item/overlay/snapshot schemas, tagged errors and RPC group     |
| `src/config.ts`                         | Root discovery, isolated config errors, duplicates and path expansion        |
| `src/scheduler.ts`                      | Clock-based watched/idle admission, backoff, dropped ticks, no overlap       |
| `src/command.ts`                        | Effect ChildProcess, stream caps, fetch, transform and action argv           |
| `src/checklist.ts`                      | Markdown parsing, conflict detection and durable line-preserving replacement |
| `src/store.ts`                          | All state SQL, inlined Migrator up/down definitions, diffs and ledger        |
| `src/derive.ts`                         | Pure request-time ages, counts, week and the single D5 attribution function  |
| `src/instance.ts`                       | Private runtime paths, PID liveness and lifetime SQLite exclusion lock       |
| `src/logs.ts`                           | Capped per-run stderr/last-50 retention and rotated engine lifecycle log     |
| `src/socket.ts`, `src/socket-limits.ts` | Effect RPC client transport and bounded server admission                     |
| `src/service.ts`                        | launchd bytes, owned install, one-shot native mutations and drain            |
| `src/engine.ts`                         | Scoped wiring, reconciliation, health and request handlers                   |

CLI → engine → adapters/store/scheduler → contract. Derivation depends only on
wire types and explicit inputs. Runtime imports are local, Bun/Node builtins and
the pinned Effect packages. There are no cross-project imports.

## Flow and ownership

`run` takes a dedicated `exclusion.sqlite` BEGIN EXCLUSIVE lock, publishes its PID,
then opens state. Unknown/dead/alive are distinct: alive or uncertain PID state
blocks start, as does a held lock. No process hunting or automatic adoption.
SQLite verifies known tables, constraints, indexes and migration history before
migration; an unfamiliar/newer shape is refused. Initial migration SQL is inlined,
not read from a deployment sidecar. WAL and FULL synchronous mode follow validation.
Old active rows become interrupted; stored source statuses become stale before
collection starts.

Config polling reloads every second. Invalid individual definitions become
config_error; duplicate IDs refuse all definitions for that ID. A failed global
reload keeps the last valid catalog and logs a code. Removal stops collection but
keeps disk history; removed sources/items are not returned. Disabled state is a
local SQLite overlay. Planned sources never run.

A scoped Effect Schedule checks admission every 250 ms. Every source has at most
one active job, with 20 total slots by default (configurable 1–20). A missed tick
at capacity is dropped until that source's next interval: no waiting queue,
catch-up or automatic retry. A failure doubles the normal interval, capped at
15 minutes; success resets it. Manual refresh can request an immediate attempt.
`get` extends watching for two minutes and forks overdue work without waiting for
results. An optional get source include list filters statuses, items and ledger
before pure derivation inside the same read transaction, so counts and week share
the projection. Metadata and watching remain global. Config changes fence results
from superseded definitions.

Command fetch and transform share one timeout. Effect owns detached process
groups and SIGTERM → SIGKILL after 10 seconds. stdout is limited to 5 MiB per
stage; stderr is bounded and continues draining. Output validation is success's
last boundary. Per-run logs contain stderr only, capped at 256 KiB; both logs and
finished rows retain 50 runs per source. Structured lifecycle logs carry source,
run and outcome codes. After acquiring the instance lock, runEngine adds a JSON
logger backed by logs.ts alongside the existing foreground logger (stderr in the
CLI). It appends to runtime `log/collector.log`, capped at the same 256 KiB per
file as run logs, rotating before overflow and keeping three older files. Private
0700/0600 paths and regular-file checks also apply to rotated destinations. Logs
persist across restarts; no stdout/config/source payloads or actor identities are
added. No launchd plist keys are needed: the engine owns the destination and cap.
Health exposes active/runs/failures and source states.
There is no metrics HTTP listener or measured latency claim.

Checklist directory watches filter the target filename, survive atomic replacement,
and request a reread; a 30-second fallback also rereads. Config reload disposes
removed/changed watchers and re-establishes closed ones.
Changes are scoped to a line or an insertion, with unique temp files, file fsync,
rename and directory fsync. mtime/size/hash changes cause one reread/retry, then
conflict. Parents are trusted operator-owned paths; leaf symlinks are refused.
Comment-less keys retain their original since value in SQLite across rereads.

## Failure boundaries

Item diff, arrived/changed/gone/reopened/shipped rows and rev are one SQLite
transaction. Shipped deduplication has a unique partial index on source/key;
replaying an observation cannot count the same shipment twice. A done checklist
line keeps its item row with doneAt, so a restart or a repeat completion after a
reopen needs no second shipment; `derive` alone applies the end-of-day rule. Overlay changes, actor ledger
and rev are transactional too. `__engine` is a reserved overlay record for rev and
the shared look cursor; it is not an item overlay.

Checklist replacement, external actions, logs and SQLite cannot share a
transaction. A crash after file replacement or external execution can precede the
ledger write. A reread repairs current items; it cannot prove an unrecorded action
or reconstruct every shipment across downtime. Optimistic checking cannot exclude
a non-cooperating writer racing in the final check-to-rename window. No claim of
cross-writer locking, external exactly-once execution or crash recovery is made.
Explicit done/reopen and overlay sets are naturally repeatable; arbitrary actions
and todo.add must not be blindly replayed after an unknown outcome.

The Unix socket is mode 0600 inside mode 0700 storage. It uses Effect RPC's
NDJSON JSON-RPC serialization. Limits: 64 connections, 32 concurrent RPC handlers,
64 KiB incomplete frames, 1 MiB input/1024 frames/two minutes per connection.
Clients reconnect when a connection ends. Request-scoped CLI calls time out after
15 seconds; an ambiguous result is reported as outcome_unknown, never retried.
Long configured source actions can therefore outlive the CLI wait. Local commands
and same-user clients remain trusted; this is not a security sandbox.

Stop blocks new admissions and drains existing work before releasing socket,
SQLite, PID and lock. Signals and the RPC stop path share that boundary. Source
commands can extend drain to their configured timeout plus escalation. Background
reload/watch fibers are scoped and disposed. A crash leaves active history to be
marked interrupted on next start; no orphan adoption is attempted.

launchd install never starts; start probes only its job target, then bootstraps or
kickstarts once and bounds readiness. Stop uses RPC, not bootout; uninstall refuses
alive/unknown liveness, unloads an owned loaded job, removes its plist and keeps
runtime data. Installation PATH drift is distinct from foreign ownership. Service
lifecycle calls are not serialized against one another. Native failure is not
silently retried or presented as a rolled-back operation.

## Evolution

Keep v1 additive. Changed meanings require a new version alongside it. Future
screens consume the socket, never engine imports. Change the D5 placeholder only
in `shippedBucket`. Schema changes require reviewed migration and stopped-state
backup/rollback instructions; never reset data to upgrade. The initial down
statements in store.ts are tested on disposable databases; they are destructive,
not an operator repair command.
