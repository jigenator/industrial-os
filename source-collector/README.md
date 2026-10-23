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
`refresh`, `todo`, `enable` and `disable` use its Unix socket. Absent engines are
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

## Privacy and operations

Configs and data stay local. Nothing company-specific belongs in this repository;
examples contain fake data only. Commands are trusted programs, not sandboxed.
Never put secrets in configs or command output. Use a command's own sign-in or a
local credential wrapper. The engine passes only HOME, PATH, configured env and
source/run identifiers, not its whole inherited environment.

SQLite stores items, overlays, source health, run results and actor/session ledger
records. Item and ledger history have no automatic expiry. Per-source run history
and capped stderr logs retain 50 runs. Structured lifecycle logs contain codes and
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
