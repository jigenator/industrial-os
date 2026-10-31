# Conventions

Follow [root conventions](../../../docs/conventions.md) and the [Pi guide](../../AGENTS.md). This is TypeScript ESM for Node 22.19+, run by Pi/type stripping; Node standard library and host Pi/TypeBox peers only. No local runtime/development dependencies or lockfile: tests use the existing global host, like status-bar. No license/manifest license field pending the repository decision. No formatter/linter/standalone typecheck/build/CI gate is declared.

## Boundaries

The [architecture](architecture.md) maps cohesive source-named capabilities and tests. Never import another extension or render inside collection. Keep command recipes only in [contributing](../CONTRIBUTING.md), exact wire/cache fields in the [contract](contract.md), and raw external parser behavior in workspace/usage. No generic shared/utils layer or speculative provider registry; usage providers are whatever sources the setting lists.

## Types and validation

Preserve discriminated workspace/PR/usage failure unions. Validate external JSON and private goal records at runtime; copy only allowed data, never raw account/identity/stderr. AU requires same-session compatible public RPC and safe nonnegative counts; use the authoritative total, not bounded entries. Unknown remains null, never zero. Tool parameters use TypeBox. Phase/question raw strings are bounded to 200 UTF-16 units, not pre-sanitized for an arbitrary future sink.

## State and I/O

Use explicit argv/cwd, read-only Git (`GIT_OPTIONAL_LOCKS=0`, no lazy fetch), bounded command output/time and cancellation. Missing Git/gh, an unreachable source-collector engine and malformed responses remain truthful failures. Abort manually, only signaling a child with a pid: Node 22.23's execFile signal path can signal pid 0 after ENOENT. Never copy raw diagnostics, including source-collector error messages, into snapshots.

All async session completions check collector/session/controller/selection ownership. Replacement/shutdown clears timers, watcher, request/ready/reply listeners and aborts subprocesses. No stale publishes. Usage sends only the scoped source-collector `get`, one request at a time, without retry before the next poll. Keep timers unref'd and all inputs/output bounded. PR sharing uses its own bounded file/lock in `pr-cache.ts`; follow [the auth-isolation/bypass and contention contract](contract.md#3-shared-github-pr-lookup), never credential-content fingerprints or token hashes. Keep Git inspection and stale-session publication guards session-local. Visibility must fail open on unknown, never infer hidden from a failed read; follow the [visibility contract](contract.md#pane-visibility-and-deferred-inspection) for gating and the event-driven Herdr boundary.

## Checks and gaps

Use source-named lowest-layer tests, then real installed Pi loader/bus/session boundaries. Fixtures use temp isolated Git, fake gh, a fake source-collector socket (`SOURCE_COLLECTOR_HOME` always points at a fixture) and no network/provider accounts/user Git configuration. Preserve original workspace tests when moving them; presentation tests stay in consumers. Context parity vectors must remain identical to status-bar's approved pure arithmetic seam. Future signal changes update contract/DTO/collection/tests together.

Current gaps: no live fleet/source-collector/GitHub/goal or interactive Pi/Herdr checks, no Windows qualification, private pi-goal record compatibility and idle command-only refresh delay, no standalone static gate/lockfile/license. Revisit tooling/platform support only with an approved current need; external dashboards may justify a daemon.
