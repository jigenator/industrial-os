# Agent guide

Purpose: keep the actual inherited Herdr pane label aligned with current work. This project supplements the [root guide](../../AGENTS.md) and [Pi guide](../AGENTS.md); user usage is in [README](README.md).

## Critical engineering rules

- Preserve the main-TUI/Herdr/subagent gate and inherited-pane/terminal checks; never rename a focused or model-selected pane. Flow and safeguards: [architecture](docs/architecture.md#critical-invariants); check `test/naming.test.ts`.
- Forward only the bounded payload documented in [privacy and cost](README.md#data-sharing-and-cost). Excerpts are not generally redacted; never log their content or raw SDK errors. Check hostile/failure tests and [conventions](docs/conventions.md#trust-and-state-boundaries).
- Preserve epoch/signal cancellation and serialized writes. A stale result cannot rename; off stops this runtime even if its save fails. Check navigation, late-read and atomic-write cases.
- Runtime pi-typesafe is the specific root-install exception, not permission to bundle Pi peers; see [the decision](../../docs/decisions/pane-naming-root-dependency.md). Tests never contact live TypeSafe, providers or Herdr.

## Read for the task

| Task | Read before changing |
| --- | --- |
| Code or tests | [Architecture](docs/architecture.md), [conventions](docs/conventions.md), then [validation](CONTRIBUTING.md#full-validation-sequence) |
| Human-facing behavior | Also [design](docs/design.md) and [root design](../../docs/design.md) |
| Packaging or host compatibility | [Contributing](CONTRIBUTING.md), architecture dependencies, then [Pi guide](../AGENTS.md) |
| Scope | [Mission](docs/mission.md) and [root mission](../../docs/mission.md) |
| Guidance | Relevant canonical document, then [root checks](../../CONTRIBUTING.md#repository-wide-checks) |

## Where work belongs

| Change | Start here | Boundary |
| --- | --- | --- |
| Pi lifecycle, preferences, cooldown or Herdr writes | `index.ts` | Own inherited pane only; serialized CLI writes and epoch/signal fencing |
| Jev classification, title model, PR/title parsing or safe errors | `models.ts` | Untrusted bounded data; model output cannot select a command or pane |
| Regression or installed-host coverage | `test/naming.test.ts`, `test/pi-load.mjs` | Mocked services/CLI, temporary preferences and agent directories |
| Rules, experience or scope | Matching `docs/` guide | Commands and evidence stay in CONTRIBUTING |

## Implement and verify

Trace callers and preserve behavior/validation when refactoring. Use the [full validation sequence](CONTRIBUTING.md#full-validation-sequence), then [root checks](../../CONTRIBUTING.md#repository-wide-checks). Separate automated, installed-Pi load and interactive evidence; a missing prerequisite is not a pass.

## Supporting documents

| Document | Purpose | Read when |
| --- | --- | --- |
| [README.md](README.md) | Purpose, status, install, commands and privacy/limits | Using the extension or changing public usage |
| [AGENTS.md](AGENTS.md) | Project rules and routes | Starting work here or changing guidance |
| [CLAUDE.md](CLAUDE.md) | Runtime import of this guide | Checking instruction entrypoints |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Toolchain, exact checks and evidence | Making or verifying any change |
| [docs/architecture.md](docs/architecture.md) | Modules, dependency direction, flows and invariants | Changing behavior, state, I/O or dependencies |
| [docs/conventions.md](docs/conventions.md) | Engineering rules and adoption gaps | Writing or reviewing code |
| [docs/design.md](docs/design.md) | Presentation, interaction and limits | Changing anything human-facing |
| [docs/mission.md](docs/mission.md) | Goals, non-goals and constraints | Choosing or changing scope |
| [Root AGENTS](../../AGENTS.md) | Shared rules and complete guidance map | Working in this repository |
| [Pi AGENTS](../AGENTS.md) | Extension placement and host boundaries | Working under pi/ |
