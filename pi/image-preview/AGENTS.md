# Agent guide

Purpose: preview image files whose paths are in Pi's editor, above the editor. This project supplements the [root guide](../../AGENTS.md) and [Pi guide](../AGENTS.md); user usage is in [README](README.md).

## Critical engineering rules

- Only read the editor. Never call `setEditorText`, `pasteToEditor` or `setEditorComponent`, listen to terminal input, or register an `input` handler. Check: `test/extension.test.ts` asserts none is called or registered.
- Failures degrade to no preview; nothing throws into Pi, and nothing runs outside the TUI. Check: the integration tests.
- Treat paths and files as untrusted: content-sniffed type, size cap before reading, bounded candidate search. Check: `test/image.test.ts`, `test/paths.test.ts`.
- Tests stay offline in temporary directories; never touch real sessions, settings or `~/.pi`.

## Read for the task

| Task | Read before changing |
| --- | --- |
| Code or tests | [Architecture](docs/architecture.md), [conventions](docs/conventions.md), then [validation](CONTRIBUTING.md#full-validation-sequence) |
| Human-facing behavior | Also [design](docs/design.md) and [root design](../../docs/design.md) |
| Packaging or host compatibility | [Contributing](CONTRIBUTING.md), architecture host seams, then [Pi guide](../AGENTS.md) |
| Scope | [Mission](docs/mission.md) and [root mission](../../docs/mission.md) |
| Guidance | Relevant canonical document, then [root checks](../../CONTRIBUTING.md#repository-wide-checks) |

## Where work belongs

| Change | Start here | Boundary |
| --- | --- | --- |
| Which text counts as an image path | `src/paths.ts` | Pure; absolute and `~/` paths only; linear, with an exact candidate cap |
| Which file counts as an image, and reading it | `src/image.ts` | Regular files, size cap, sniffed type |
| Preview layout and thumbnails | `src/preview.ts` | Pi theme tokens; bounded rows |
| Lifecycle, polling and widget calls | `src/index.ts` | TUI only; cleared on `session_shutdown` and session restart |
| Host versions or check wiring | `package.json`, `package-lock.json`, `tsconfig.json` | Host peers at runtime; pinned development host |

## Implement and verify

Use the [full validation sequence](CONTRIBUTING.md#full-validation-sequence), then [root checks](../../CONTRIBUTING.md#repository-wide-checks). Keep automated, installed-Pi load and interactive evidence separate; a missing prerequisite is not a pass.

## Supporting documents

| Document | Purpose | Read when |
| --- | --- | --- |
| [README.md](README.md) | Purpose, status, install, behavior and limits | Using the extension or changing public usage |
| [AGENTS.md](AGENTS.md) | Project rules and routes | Starting work here or changing guidance |
| [CLAUDE.md](CLAUDE.md) | Runtime import of this guide | Checking instruction entrypoints |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Toolchain, exact checks and evidence | Making or verifying any change |
| [docs/architecture.md](docs/architecture.md) | Modules, flow, state, host seams and invariants | Changing behavior, state, I/O or dependencies |
| [docs/conventions.md](docs/conventions.md) | Engineering rules and adoption gaps | Writing or reviewing code |
| [docs/design.md](docs/design.md) | Preview layout, states and colors | Changing anything human-facing |
| [docs/mission.md](docs/mission.md) | Goals, non-goals and constraints | Choosing or changing scope |
