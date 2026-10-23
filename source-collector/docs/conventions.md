# Conventions

Follow the [repository conventions](../../docs/conventions.md). This project uses
Bun 1.4.4, exact-pinned Effect 4 and TypeScript 7, independently of Node projects.
The [runtime decision](../../docs/decisions/bun-effect-runtime.md) owns that choice.

- Verify dependency APIs against installed declarations before use. Upgrade
  Effect/platform/SQL together and rerun raw-wire and process-group tests.
- Use Effect Schema at trust boundaries; strict TypeScript is not validation.
  Errors sent to clients are enumerable CollectorError codes, without causes,
  stack traces, private paths or raw config/output dumps.
- Keep clocks, lifecycle and timers in Effect. Scheduler timing tests use the
  TestClock layer; process escalation tests separately exercise real native time.
- Parameterize SQL. Only reviewed migration statements are passed to unsafe SQL.
  New query patterns need their indexes and failure/rollback tests.
- Use FileSystem for platform reads/watch and Effect ChildProcess for execution.
  Node fs primitives are confined to durable atomic replacement, private file
  inspection, capped log retention and launchd publication where descriptor-level
  operations are needed. bun:sqlite is used directly only for the lifetime lock;
  product state uses the Effect SQL client and Migrator.
- Do not suppress diagnostics to work around an unclear API. Lint and format
  commands are canonical in [contributing](../CONTRIBUTING.md).
- Keep examples fictional and independent of accounts. Tests use temp paths,
  actual local Unix sockets and fake commands; native service effects are mocked.

## Known limits

No live source/account or launchd qualification, load benchmark, automatic
retention for item/ledger history, remote authentication or process sandbox is
claimed. Offline manifests/licenses can be inspected without account access;
no online vulnerability advisory scan was run for this task. Service paths are
bound to the installation checkout. Cross-store and optimistic-file-write limits
are explicit in [architecture](architecture.md#failure-boundaries).
