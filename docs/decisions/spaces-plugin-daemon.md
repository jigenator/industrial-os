# Spaces reporting belongs to one plugin daemon

Status: accepted for Industrial OS Spaces, targeting Herdr 0.9.3.

## Decision

A plain Node 22 Herdr plugin owns one long-running daemon per socket, with
short `ensure` startup/event hooks, a socket-keyed instance lock and private
activity history. It consumes existing Pi AU tokens over the Herdr socket;
no Pi source, collector ownership or extension behavior changes.

## Why

Space counts and quiet worktree ordering span panes, including non-Pi agents.
One event subscription and periodic reconciliation provide a single writer,
TTL renewal and durable ages even when Pi is not present. Herdr plugin command
runtime pipes stdout/stderr and waits for EOF with no timeout, with 32 commands
in flight. A long-running hook would occupy a slot forever: detach with ignored
stdio and unref, then let only the lock winner hold the subscription.

Plugin directories/state are global across named sessions. The instance lock,
history and diagnostics must therefore be partitioned by socket-path hash,
not plugin ID alone. Public workspace IDs survive persisted session restore;
use them rather than mutable labels or positions for history.

## Alternatives

- One Pi reporter per pane duplicates subscriptions and writers, misses spaces
  without Pi, and expands a display-only extension's ownership.
- One process per event repeatedly cold-starts, loses subscription/activity
  continuity and cannot independently renew TTL.
- Herdr core changes add maintained upstream UI/policy surface; the existing
  plugin/socket/config interfaces suffice, with one documented host behavior:
  quiet spaces with git divergence retain a second git-only row.

## Consequences and revisit

This is trusted local code with reorder authority, not a sandbox. Counts/ages
expire on failure while no-TTL names freeze. Local logs/health and tests own
lifecycle, locks, retries and shutdown; operators explicitly install and merge
configuration. Atomic rename does not guarantee power-loss durability; PID
reuse can conservatively prevent startup. Revisit if Herdr supplies managed
plugin daemons/locks, a session-generation identity, or conditional row gating.
Full behavior/limits live in the [plugin architecture](../../herdr-plugins/spaces/docs/architecture.md)
and [token contract](../../herdr-plugins/spaces/docs/token-contract.md).
