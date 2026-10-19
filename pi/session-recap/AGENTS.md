# Agent guide

Purpose: restore orientation with UI-only brief away recaps and manual detailed recaps. This project supplements the [root guide](../../AGENTS.md) and [Pi guide](../AGENTS.md); user usage is in [README](README.md).

## Critical engineering rules

- Recap text is UI only: never save it, append entries, inject model messages or change Pi's main model. See [architecture](docs/architecture.md#lifecycle-and-persistence); check context/retention/detailed tests.
- Use canonical edited projection, not raw session-file reconstruction. Detailed mode excludes compaction/branch summaries; coverage gaps stay explicit. See [input coverage](docs/architecture.md#recap-input-and-provider-call); check `tests/context.test.mjs`.
- Preserve request/picker cancellation, context fingerprinting and disposal at navigation/shutdown. Never render partial, failed or stale output; check lifecycle/projection/response tests.
- Settings writes preserve the other field and refuse invalid/unreadable files. Provider errors expose only safe codes. See [conventions](docs/conventions.md#boundaries-and-state); check global-model/truncated-response tests.
- Keep `tests/isolate-agent-dir.mjs` loaded before tests; no real credentials, transcripts, settings or inference. Private host-layout probes are evidence only for the pinned host; see [adoption gaps](docs/conventions.md#adoption-gaps).

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
| Projection, model selection, settings, lifecycle or rendering | `index.ts` | Edited active branch; separate recap call; no generated text in saved history |
| Regression and pinned host UI probes | `tests/` | Temporary agent directory and mocked inference only |
| Pinned host versions or check wiring | `package.json`, `package-lock.json`, `tsconfig.json` | Host peers at runtime; pinned development packages for tests |
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
| [CHANGELOG.md](CHANGELOG.md) | Imported release history and fork changes | Tracing behavior or provenance |
