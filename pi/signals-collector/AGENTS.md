# Agent guide

Purpose: own TUI session signals and usage read from configured source-collector sources for independent displays. Follow the [root](../../AGENTS.md) and [Pi](../AGENTS.md) guides.

## Critical rules

- The [v1 contract](docs/contract.md) is canonical. Request replies are synchronous; pushes coalesce without resetting the 100ms budget; ready repairs either load order. Validate live session ownership before all callbacks/publications. Check: real-loader `test/extension.test.ts`.
- Non-TUI collects/publishes/spawns nothing. Replacement/shutdown disposes timers, fs.watch, RPC/request listeners and in-flight subprocesses. No stale session work. Check: extension/usage/cache/background-tasks tests.
- Unknown is not zero/clean/absent. Preserve moved workspace/PR/usage unions, validate public fleet/private goal data and keep only allowed usage fields. Check: source-named tests and [conventions](docs/conventions.md).
- No renderer, motion, Ponytail/Tatsu observer, herdr-tui token write or imports from another extension. The background-task count is observed here, and the only external write is one herdr-core label, `io.signals.v1`, on the session's own terminal, exactly per [contract section 4](docs/contract.md#4-herdr-desktop-publication-iosignalsv1); tests never run the real `hc`. The [architecture](docs/architecture.md) maps ownership. Check: `test/herdr-core.test.ts`, `test/extension.test.ts`.
- Usage reads only the sources listed in `industrialOs.usageSources`, with one bounded scoped source-collector `get` per poll: no other RPC, no retry, no provider commands or provider names in code. The [contract](docs/contract.md#2-usage-via-source-collector-owned-by-pisignals-collector) holds the convention and state table. Check: `test/usage.test.ts`, `test/source-collector.test.ts`.
- Context reserve settings are owned here. The approved duplicate pure percentage arithmetic/parity vectors in status-bar must change together without imports.

## Task routes and placement

| Task | Read/start |
| --- | --- |
| Any code/test | [Architecture](docs/architecture.md), [conventions](docs/conventions.md), [contributing](CONTRIBUTING.md) |
| Snapshot/consumer/compatibility | [Contract](docs/contract.md), `src/snapshot.ts`, matching contract/boundary tests |
| Herdr pane visibility | `src/herdr.ts`, `src/extension.ts` gating, [contract](docs/contract.md) `visible` field |
| Background tasks or `/flag` | `src/background-tasks.ts`, `src/snapshot.ts` `savedFlag`, `src/extension.ts`, [contract](docs/contract.md#background-tasks-and-the-manual-flag) |
| Herdr desktop label | `src/herdr-core.ts`, `src/extension.ts` push flush and shutdown, [contract section 4](docs/contract.md#4-herdr-desktop-publication-iosignalsv1), [decision](../../docs/decisions/signals-collector-herdr-core.md) |
| Workspace/PR/Active | `src/workspace.ts`, `src/pr-cache.ts`, `src/extension.ts`, [PR sharing contract](docs/contract.md#3-shared-github-pr-lookup), [Active decision](docs/decisions/agent-reported-active-workspace.md) |
| Usage | `src/usage.ts`, `src/source-collector.ts`, contract section 2, [usage decision](../../docs/decisions/usage-via-source-collector.md) |
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
| [Root collection decision](../../docs/decisions/session-signals-collection.md) | Per-session ownership; its quota part is superseded | Changing collection boundaries |
| [Usage decision](../../docs/decisions/usage-via-source-collector.md) | Why usage is configured source-collector sources | Changing usage collection or configuration |
| [herdr-core decision](../../docs/decisions/signals-collector-herdr-core.md) | Why the snapshot is published as a herdr-core label and what moved here | Changing the label, background tasks or `/flag` |
