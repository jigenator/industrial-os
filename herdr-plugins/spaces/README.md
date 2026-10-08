# Industrial OS Spaces

A Herdr 0.9.3+ plugin: one long-running Node 22 process per Herdr socket reports
space pane/agent counts, Pi agent units, names and quiet ages. It moves quiet
worktree groups or single spaces below active units without continually
undoing manual drags. The [Herdr fragment](../../herdr/spaces.toml) owns styling;
the [token contract](docs/token-contract.md) owns values and geometry.

No dependencies, npm install or build step. Linux and macOS Unix sockets only.
No live installation or interactive rendering was verified.

## Install and config

Follow the [plugin install guide](../README.md#install), then the
[fragment merge instructions](../../herdr/README.md#spaces). Install the plugin
before using the fragment: it intentionally has no built-in `workspace` name.
Node 22 must be on the environment PATH from which Herdr starts hooks.

Optional `config.json` in `HERDR_PLUGIN_CONFIG_DIR`:

```json
{"sort": true}
```

`sort` defaults to true. Missing, invalid, oversized or unknown config fields
use defaults with a sanitized diagnostic. Config is read once per daemon
start. Set `sort: false` to retain the user's order entirely. Number keys follow
Herdr position, so enabling sort changes their targets when quiet units move.

Manifest hooks run `node bin/spaces.mjs ensure`. It exits quickly, starting a
detached `run` if needed; hooks on `pane.created` and `workspace.created` also
repair a stopped reporter. The optional plugin `status` action returns only
whether its socket's recorded PID is alive. No restart action is shipped.

## Operations and privacy

State resides only in `HERDR_PLUGIN_STATE_DIR`, partitioned by a hash of
`HERDR_SOCKET_PATH`. A `.lock` directory holds a PID marker; `.history.json`
holds stable workspace IDs, activity/last-seen timestamps and the sorting
signature; `.health.json` holds state and aggregate request/failure counters;
`.log` holds sanitized lifecycle codes and counters, capped near 256 KiB.
Files are mode 0600, newly created directories 0700. No labels, cwd, pane
payloads, credentials or context environment are persisted in these files.
Labels travel only into Herdr's local in-memory workspace tokens.

Absent history entries expire after 30 days during a successful reconciliation.
History and health remain on disk while stopped. For deletion, an operator must
stop the reporter first (SIGTERM to the verified PID), then remove its socket's
state files. Plugin uninstall alone does not remove owned state. Do not delete
a live lock or trust an arbitrary PID file for signaling. No removal was run
against installed state during development.

Health is a local snapshot, not an HTTP service: `connecting`, `connected`,
`disconnected` or `stopped`, updated after reconciliation. PID plus socket hash
correlates local logs and health. `status` is a liveness hint, not proof of
successful reporting; inspect health's timestamp and failure counters as well.

## Limits

- Quiet means at least 48 hours without observed activity. First-seen spaces
  start at now. Events while disconnected are not reconstructed; working,
  blocked and focused spaces refresh activity on the next authoritative read.
- A quiet space sends only panes, stale name and age. It collapses to one row
  unless Herdr's built-in `git_status` has ahead/behind counts, which retain a
  second git-only row. Indented worktree children suppress git details in Herdr.
- Counts/age expire within 120 seconds after the last successful renewal;
  names have no TTL and freeze if the daemon stops. Herdr does not persist
  workspace tokens across restarts; startup re-sends them.
- Unicode width is an explicit stdlib approximation, not terminal/font detection;
  [the contract](docs/token-contract.md#text-and-width) states its limits.
- A rejected/slow read publishes nothing new. Requests time out at one second;
  persistent failures can let TTL values expire. Names/count batches are not
  transactional across requests. A backwards wall clock can make Herdr ignore
  reports until the previous sequence is passed.
- Dead PID locks recover automatically. PID reuse conservatively treats an
  unrelated live PID as a live reporter; malformed/foreign lock contents fail
  closed and require operator inspection. No automatic killing is performed.
- Private local storage is trusted to be operator-owned; this is not a sandbox
  against another process with the same user's filesystem/socket access.

## Guides

[Agent guide](AGENTS.md), [contributing](CONTRIBUTING.md),
[architecture](docs/architecture.md), [conventions](docs/conventions.md),
[design](docs/design.md), [mission](docs/mission.md),
[token contract](docs/token-contract.md).
