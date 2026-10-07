# Agent guide

Purpose: maintain best-effort Claude-style interrupt-and-continue for queued text in Pi; see [mission](docs/mission.md). This project owns its standards and toolchain within the monorepo. Follow the [root guide](../../AGENTS.md) and [Pi guide](../AGENTS.md) as well.

## Critical engineering rules

- Host-provided Pi packages belong in `peerDependencies` with `"*"`, never `dependencies`. Verify APIs against the documentation and types of the Pi version in use. See [dependency rules](docs/conventions.md#module-and-dependency-rules); check the manifest and real-loader tests.
- Never block streaming, input or focus. Keep rendering pure and dispose extension-owned timers and listeners. See [state and I/O](docs/conventions.md#state-io-and-migrations); check cleanup and real TUI routing tests.
- Marker output must be truthful and excluded from model context: append it only at confirmed continuation start, not ordinary start or failed preflight. See [architecture invariants](docs/architecture.md#critical-invariants); check persistence and context-exclusion tests.
- This package does not import the design system yet; moving onto it is its own change, following the [migration requirements](../../docs/decisions/in-repo-design-system-package.md#migrating-an-extension), including types for `tsc`. Until then, the marker's color constants mirror the design system's palette and must match it; change the design system first. See [dependencies and generated output](docs/conventions.md#dependencies-and-generated-output).

## Read for the task

Scan the supporting-documents map and read every document whose condition applies before changing that area. Use the relevant route; do not load unrelated manuals.

| Task | Read before changing |
| --- | --- |
| Queue, Escape or lifecycle behavior | [Architecture](docs/architecture.md#representative-flows), [conventions](docs/conventions.md), then [Contributing](CONTRIBUTING.md) |
| Marker output or interaction | Also [design](docs/design.md) and [root design](../../docs/design.md) |
| Pi version or packaging | [README compatibility](README.md#compatibility), [dependency rules](docs/conventions.md#module-and-dependency-rules), `package.json`, then [Contributing](CONTRIBUTING.md) |
| Product scope | [Package mission](docs/mission.md) and [root mission](../../docs/mission.md) |
| Guidance or validation | Relevant canonical guide, this map, [root conventions](../../docs/conventions.md), then [Contributing](CONTRIBUTING.md) |

## Where work belongs

| Change | Start here | Boundary |
| --- | --- | --- |
| Queue observation, replay, key ownership, session lifecycle | `createClaudeInterrupt` in `src/index.ts` | Public Pi APIs only; preserve draft and unsupported-input recovery |
| Marker layout, palette or frame rendering | `renderMarker` in `src/index.ts` | Explicit time and width; no clock or lifecycle effects |
| Behavior/renderer regression | `test/extension.test.ts` | Deterministic harness and real Pi Theme |
| Pi loader, input routing or persistence contract | `test/extension-runner.test.ts` | Real loader/runner and isolated terminal/session bridge |
| Project rules or experience | Relevant `docs/` guide | Commands and evidence belong in CONTRIBUTING; README stays user-facing |

## Implement and verify

Trace callers before changing shared behavior. Follow [conventions](docs/conventions.md), not an unreviewed neighboring pattern. Use the [full validation sequence](CONTRIBUTING.md#full-validation-sequence) and report passed, failed, skipped and not-run checks separately. Do not equate isolated integration tests or the RPC load check with interactive Pi/Herdr verification.

## Supporting documents

Keep one direct link, purpose and concrete reading condition for every package guide and shared guide used here.

| Document | Purpose | Read when |
| --- | --- | --- |
| [README.md](README.md) | User purpose, install, limitations and compatibility | Using the extension or changing public usage |
| [AGENTS.md](AGENTS.md) | Project rules and reading routes | Starting work in this project or changing guidance |
| [CLAUDE.md](CLAUDE.md) | Runtime import of this guide | Checking agent entry points |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Toolchain, validation, coverage and records | Making or verifying any change |
| [docs/architecture.md](docs/architecture.md) | Modules, flows, contracts, invariants and limits | Tracing behavior or changing lifecycle/dependencies |
| [docs/conventions.md](docs/conventions.md) | Package engineering rules and gaps | Writing or reviewing code or technical guidance |
| [docs/mission.md](docs/mission.md) | Goals, non-goals and constraints | Choosing features or changing scope |
| [docs/design.md](docs/design.md) | Interaction, marker, accessibility and states | Changing human-facing behavior |
| [Root README](../../README.md) | Monorepo orientation and layout | Changing installation or repository placement |
| [Root AGENTS](../../AGENTS.md) | Shared rules and repository guidance map | Working in this repository |
| [Root CONTRIBUTING](../../CONTRIBUTING.md) | Shared workflow and repository checks | Making or verifying any change |
| [Root conventions](../../docs/conventions.md) | Repository-wide engineering rules | Writing or reviewing code and technical guidance |
| [Root mission](../../docs/mission.md) | Monorepo intent and constraints | Choosing scope or changing project placement |
| [Root design](../../docs/design.md) | Shared terminal experience and visual language | Changing human-facing output or interaction |
| [Pi AGENTS](../AGENTS.md) | Pi project placement and shared constraints | Working under `pi/` |
| [Pi CONTRIBUTING](../CONTRIBUTING.md) | Cross-project contribution routing | Changing project placement or contribution routes |
