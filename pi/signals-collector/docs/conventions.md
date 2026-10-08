# Conventions

Follow [root conventions](../../../docs/conventions.md) and the [Pi guide](../../AGENTS.md). This is TypeScript ESM for Node 22.19+, run by Pi/type stripping; Node standard library and host Pi/TypeBox peers only. No local runtime/development dependencies or lockfile: tests use the existing global host, like status-bar. No license/manifest license field pending the repository decision. No formatter/linter/standalone typecheck/build/CI gate is declared.

## Boundaries

The [architecture](architecture.md) maps cohesive source-named capabilities and tests. Never import another extension or render inside collection. Keep command recipes only in [contributing](../CONTRIBUTING.md), exact wire/cache fields in the [contract](contract.md), and raw external parser behavior in workspace/usage. No generic shared/utils layer or speculative provider registry.

## Types and validation

Preserve discriminated workspace/PR/usage failure unions. Validate external JSON and private goal records at runtime; copy only allowed data, never raw account/identity/stderr. AU requires same-session compatible public RPC and safe nonnegative counts; use the authoritative total, not bounded entries. Unknown remains null, never zero. Tool parameters use TypeBox. Phase/question raw strings are bounded to 200 UTF-16 units, not pre-sanitized for an arbitrary future sink.

## State and I/O

Use explicit argv/cwd, read-only Git (`GIT_OPTIONAL_LOCKS=0`, no lazy fetch), bounded command output/time and cancellation. Missing Git/gh/CodexBar and malformed responses remain truthful failures. Abort manually, only signaling a child with a pid: Node 22.23's execFile signal path can signal pid 0 after ENOENT. Usage timeout settles immediately, SIGTERM then SIGKILL after five seconds if necessary. Never copy raw diagnostics into snapshots.

All async session completions check collector/session/controller/selection ownership. Replacement/shutdown clears timers, watcher, request/ready/reply listeners and aborts subprocesses. No stale publishes; cache refresh is coordinated by exclusive `wx` and atomic rename, never uncoordinated fallback. Re-stat stale lock identity before unlink; the [accepted race](contract.md#compatibility-and-limits) is not a corruption guarantee or atomic compare-and-delete. Watch failures do not add a polling loop. Keep timers unref'd and all inputs/output bounded.

## Checks and gaps

Use source-named lowest-layer tests, then real installed Pi loader/bus/session boundaries. Fixtures use temp isolated Git, fake gh/CodexBar and no network/provider accounts/user Git configuration. Preserve original workspace/usage tests when moving them; presentation tests stay in consumers. Context parity vectors must remain identical to status-bar's approved pure arithmetic seam. Future signal changes update contract/DTO/collection/tests together.

Current gaps: no live fleet/CodexBar/GitHub/goal or interactive Pi/Herdr checks, no Windows qualification, private pi-goal record compatibility and idle command-only refresh delay, possible extra round from simultaneous stale lock takers, no standalone static gate/lockfile/license. Revisit tooling/platform support only with an approved current need; external dashboards may justify a daemon.
