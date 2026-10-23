# Source collection has one local per-user engine

Status: current. Date: 2026-10-23. Source and offline verification implement this
choice; live source and service qualification remain separate.

## Choice

[source-collector](../../source-collector/README.md) is a top-level, independent
project. One foreground process per user owns scheduled command/checklist reads,
transforms, SQLite state, triage and derived values. Clients request full v1
snapshots over a private Unix socket; nothing is pushed. A launchd user agent is
optional and installation never activates it.

The engine is generic. Queries, routines, credentials and real source definitions
stay in local private config roots, not this public repository. Examples are fake.
No company/account adapters or dashboard ship with the engine.

The [session-signals decision](session-signals-collection.md) deferred a daemon
until a concrete cross-session external consumer existed. A later Herdr task
screen and other independent polling clients now provide that case. This engine
collects configured external task sources; it does not move Pi's session signals
or parsed quota cache out of their existing owner.

## Alternatives

- Fetch in every screen: duplicates subprocesses, timing, storage and policy.
- Push streams: adds subscriptions and reconnection state before a consumer needs
  them. Full local snapshots keep clients simple.
- Embed private adapters/config: couples a reusable engine to company process and
  exposes data that does not belong in a public repository.
- Add a services group: unnecessary extra nesting; repository projects own their
  top-level directory unless they are Pi extensions or Herdr plugins.

## Consequences and revisit

The engine adds process/socket/store lifecycle, explicit health and an installation
boundary. Last-known data survives restart as stale; unknown counts remain null.
Commands are trusted same-user programs, not sandboxed. File replacement, external
actions and SQLite are not one transaction; lost replies can have unknown outcomes.
Retention and deletion are in the [project README](../../source-collector/README.md#privacy-and-operations).

Revisit push transport, remote access, adapter packaging or changed ownership only
for a concrete consumer requirement. Such changes must version changed meanings
rather than reinterpret the [v1 contract](../../source-collector/docs/contract.md).
