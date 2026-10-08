# Agent guide

Purpose: own TUI session signals and machine-wide parsed CodexBar quota for independent displays. Follow the [root](../../AGENTS.md) and [Pi](../AGENTS.md) guides.

## Critical rules

- The [v1 contract](docs/contract.md) is canonical. Request replies are synchronous; pushes coalesce without resetting the 100ms budget; ready repairs either load order. Validate live session ownership before all callbacks/publications. Check: real-loader `test/extension.test.ts`.
- Non-TUI collects/publishes nothing. Replacement/shutdown disposes timers, fs.watch, RPC/request listeners and in-flight subprocesses. No stale session work. Check: extension/cache tests.
- Unknown is not zero/clean/absent. Preserve moved workspace/PR/usage unions, validate public fleet/private goal data and keep only allowed quota fields. Check: source-named tests and [conventions](docs/conventions.md).
- No renderer, motion, Ponytail/Tatsu/background-task observer, Herdr token write or imports from another extension. The [architecture](docs/architecture.md) maps ownership.
- Shared quota requires exclusive wx lock/atomic 0600 writes; no fallback uncoordinated calls. The accepted stale-taker race is documented in the [contract](docs/contract.md#compatibility-and-limits), not silently “fixed” by a new protocol.
- Context reserve settings are owned here. The approved duplicate pure percentage arithmetic/parity vectors in status-bar must change together without imports.

## Task routes and placement

| Task | Read/start |
| --- | --- |
| Any code/test | [Architecture](docs/architecture.md), [conventions](docs/conventions.md), [contributing](CONTRIBUTING.md) |
| Snapshot/consumer/compatibility | [Contract](docs/contract.md), `src/snapshot.ts`, matching contract/boundary tests |
| Workspace/PR/Active | `src/workspace.ts`, `src/extension.ts`, [Active decision](docs/decisions/agent-reported-active-workspace.md) |
| Quota/caching | `src/usage.ts`, `src/usage-cache.ts`, contract section 2 |
| Fleet/context/goal/phase/question | Cohesive `activity`/`context`/`snapshot` module and lifecycle integration |
| Human-facing/tool/scope | [Mission](docs/mission.md), [design](docs/design.md), [root design](../../docs/design.md) |
| Packaging/guidance | Pi guide, project contributing, [root ownership decision](../../docs/decisions/session-signals-collection.md) |

Follow the project's validation sequence then the root checks. Automated, Pi-load and interactive evidence are separate; no live configuration installs or provider access to make fixtures pass.

## Supporting documents

| Document | Purpose | Read when |
| --- | --- | --- |
| [README.md](README.md) | Install, consumer guide, limitations | Using/changing the public surface |
| [AGENTS.md](AGENTS.md) | Rules/routes | Working in this project |
| [CLAUDE.md](CLAUDE.md) | Exact runtime instruction import | Checking entrypoints |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Commands, prerequisites, evidence | Implementing/verifying any change |
| [docs/architecture.md](docs/architecture.md) | Modules/state/I/O/parity | Changing collection/contracts/dependencies |
| [docs/conventions.md](docs/conventions.md) | Engineering rules/gaps | Writing/reviewing code |
| [docs/mission.md](docs/mission.md) | Goals/non-goals | Choosing scope |
| [docs/design.md](docs/design.md) | Raw fields/tool/unknown experience | Changing human-facing signals |
| [docs/contract.md](docs/contract.md) | Canonical v1 event/cache contract | Changing signals or a consumer |
| [Active decision](docs/decisions/agent-reported-active-workspace.md) | Agent-declared display-only selection | Changing selection/restoration |
| [Root collection decision](../../docs/decisions/session-signals-collection.md) | Per-session ownership/shared quota | Changing collection boundaries |
