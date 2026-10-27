# Source collector

One local engine per user fetches configured sources, validates their output,
keeps last-known items in SQLite, and serves full snapshots to polling clients.
It has no dashboard and no built-in account adapters.

Status: v1 source implementation. Offline tests and an isolated foreground smoke
are recorded in [contributing](CONTRIBUTING.md). No service has been installed or
qualified against live accounts.

## Run

Requires Bun 1.4.4; jq is needed only for jq transforms. From this directory:

```sh
bun install --frozen-lockfile
bun bin/source-collector.ts --help
bun bin/source-collector.ts check examples/sources/fake
```

The bin entry is `source-collector`; running it through Bun needs no global
installation. Follow the [isolated example](CONTRIBUTING.md#foreground-smoke)
before writing private configs. `run` stays in the foreground; `get`, `status`,
`refresh`, `todo`, `plan`, `pin`, `handled`, `look`, `action`, `enable` and
`disable` use its Unix socket. Absent engines are
errors, never empty snapshots.

Config lives in `~/.config/source-collector/`, overridden by
`SOURCE_COLLECTOR_CONFIG`. Runtime data lives in
`~/Library/Application Support/source-collector/`, overridden by
`SOURCE_COLLECTOR_HOME`. Roots resolve relative to the config directory;
checklist paths resolve relative to their source directory. Both also accept
absolute paths and `~/`.

`service install/start/stop/uninstall/status` manages an optional macOS launchd
user agent. Install never starts it. Installation binds the current absolute
Bun executable and CLI entry: keep that checkout and its dependencies in place.
Stop before moving/updating it. Do not use a temporary checkout for installation.
Service operations are opt-in; none are needed for foreground use.

## Agents

Read the full v1 snapshot with `source-collector get`, or use
`source-collector get --items` for one compact v1 JSON object per item. Each line
contains key, source, source state, plan, pinned, handled, done and title. A
to-do done today stays listed with `done: true` until local midnight, so it can be
reopened; it is not counted. Stale means last-known data, not a successful fresh
observation; use full `get` for timestamps and source errors. An empty successful
item listing prints no lines.

In full `get` output an item with `source: "fake"` and `key: "demo"` is addressed
as `fake:demo`. Always pass the entire composite key, quoted when it contains spaces;
`get --items` constructs it for you. For example (after starting an isolated engine):

```sh
source-collector get --items
source-collector plan fake:demo today --agent review-session
source-collector pin fake:demo --agent review-session
source-collector pin fake:demo --off --agent review-session
source-collector handled fake:demo --agent review-session
source-collector handled fake:demo --undo --agent review-session
source-collector look --agent review-session
source-collector action fake:demo open --agent review-session
source-collector todo add 'Write the summary' --source todo --agent review-session
```

The action example requires an `open` action configured on that source; available
names are in `get`'s source `writable` list. `todo add` writes to the only checklist
unless `--source <id>` names one; with several checklists, name it. Plan accepts
only today, inbox or later. Handled hides an item from counts, not from the
snapshot. Look sets the shared last-look cursor. Each mutation prints
`{ "rev": number }` JSON, not a fresh snapshot; read again to see the resulting
state. `--agent` alone records actor
agent; an optional session follows it (or use `--agent=review-session`). Without
this flag, actor is you. These operations share the existing exit codes:
0 success, 1 operational failure (including no engine), 2 invalid input/config/output,
8 contention. An uncertain mutation outcome must be reconciled before retrying;
never blindly replay arbitrary source actions or todo adds.

## Privacy and operations

Configs and data stay local. Nothing company-specific belongs in this repository;
examples contain fake data only. Commands are trusted programs, not sandboxed.
Never put secrets in configs or command output. Use a command's own sign-in or a
local credential wrapper. The engine passes only HOME, PATH, configured env and
source/run identifiers, not its whole inherited environment.

SQLite stores items, overlays, source health, run results and actor/session ledger
records. Item and ledger history have no automatic expiry. Per-source run history
and capped stderr logs retain 50 runs. The engine also writes structured lifecycle
logs to `log/collector.log` under the runtime directory: 256 KiB per file, with
three rotated files (`collector.log.1` newest through `.3` oldest). Logging appends
across restarts and preserves foreground diagnostics on stderr. No launchd plist
changes or service reinstall are needed for the log destination. Structured lifecycle logs contain codes and
source/run correlation IDs, not stdout, argv, env or actor identities. Stderr's
first line may become a local error message: commands must redact it. `check`
explicitly prints transformed output to the invoking terminal; treat that output
as private too.

To delete data, stop the engine, back up if needed, and remove its runtime directory
and SQLite sidecars together. Removing a source config stops collection but keeps
history. Uninstall preserves data. Never replace SQLite files while running.
Socket access is trusted same-user IPC, not authentication against another process
under your user ID. Actor/session values are caller-reported, not authenticated
identities. Source actions may have external effects; a lost reply can mean
an action applied. Do not retry blindly. Checklist rename and SQLite are not one
transaction; see [architecture](docs/architecture.md#failure-boundaries).

No project reuse license has been selected; public visibility is not a license.

## Guides

[Agent guide](AGENTS.md) · [Contributing](CONTRIBUTING.md) ·
[Mission](docs/mission.md) · [Architecture](docs/architecture.md) ·
[Conventions](docs/conventions.md) · [Design](docs/design.md) ·
[Contract](docs/contract.md)
