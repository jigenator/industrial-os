# Source collector uses Bun, Effect 4 and TypeScript 7

Status: current. Date: 2026-10-23.

## Choice

The independent [source-collector project](../../source-collector/README.md) uses
Bun 1.4.4, Effect 4.0.6 with its matching Bun platform and SQLite packages, and
TypeScript 7.1.0-beta through Effect-patched tsgo 0.56.0. It owns its Bun lockfile,
checks and dependencies. Existing Node and Rust projects do not change runtime,
and nothing new is installed at the repository root.

Bun runs TypeScript directly and provides bun:sqlite and UUIDv7 without another
native SQLite addon. Effect owns schemas, typed errors, scoped processes, clocks,
schedules, SQL migrations, RPC, CLI and platform I/O rather than parallel custom
plumbing. TypeScript's native checker plus Effect diagnostics, oxlint and oxfmt
provide the project's checks. Exact commands live in its contributing guide.

The service, execution, exclusion and bounded-log rules were adapted from the
local tatsu-cli automations implementation with the maintainer's explicit approval
to port generic engine code into this public repository. Company process,
configuration, pipeline logic, identities and private paths were not ported.
Native job-target probing and inlined migration SQL retain the earlier real-host
fixes without its account-specific installation machinery.

## Alternatives

- Node with a native SQLite addon and hand-written lifecycle/protocol code:
  workable, but adds installation and duplicated cleanup/framing for this project.
- Reuse another project's source: violates project isolation and couples unrelated
  release/runtime boundaries.
- Float Effect or beta-tool versions: permits unstable APIs to change silently.

## Consequences and revisit

Effect's process, RPC, CLI, SQL and platform modules are unstable. Pin all direct
dependencies exactly, verify APIs against installed version-matching declarations,
upgrade the Effect packages together deliberately, and rerun process-group,
migration, TestClock and raw JSON-RPC tests. Commit the generated Bun lockfile.
No version or advisory check is inferred from another project's installation.

This runtime exception applies only to this project, not a new repository-wide
stack. Revisit it if a pinned API cannot meet a real contract safely or Bun's
platform support blocks a required host. A changed toolchain needs a reviewed
migration and its own evidence; beta versions are not a compatibility guarantee.
