# Agent guide

Purpose: label image paths in Pi's editor, preview them above it, and attach session-cached copies on submit. This project supplements the [root guide](../../AGENTS.md) and [Pi guide](../AGENTS.md); user usage is in [README](README.md).

## Critical engineering rules

- Never replace the editor (`setEditorComponent`), consume terminal input, or block input, streaming or focus. Other extensions swap the editor component; this one works only through `ctx.ui`. See [host seams](docs/architecture.md#host-seams).
- Rewrite the draft only from text read in the same synchronous step. Never relabel in bash or command drafts, and never rewrite while a collapsed paste may be present or right after undo or history recall. Restore paths in bash and command drafts on the submit key. Check `test/draft.test.ts` and `test/extension.test.ts`, which drive pi-tui's real `Editor`.
- Failures degrade to leaving the path text as typed; nothing throws into Pi, and only interactive TUI submissions change. Check the submit and integration tests.
- Attach only hash-verified bytes of supported, size-capped images, and write only into the session's `.images` folder. See [conventions](docs/conventions.md#boundaries-and-state); check `test/store.test.ts`.
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
| Which text counts as an image path | `src/paths.ts` | Pure; absolute and `~/` paths only; linear, with capped candidates |
| Validation, caching, labels, re-copy | `src/store.ts` | Session `.images` folder only; hash-checked |
| Draft rewrite rules, paste-collapse rule, key classes | `src/draft.ts` | Pure; mirrors host editor behavior |
| Submit rewrite and attachments | `src/submit.ts` | Interactive TUI input only |
| Preview layout and thumbnails | `src/preview.ts` | Pi theme tokens; bounded rows |
| Lifecycle, polling, input attribution, Enter-time restore, UI calls | `src/index.ts` | Cleared on `session_shutdown` |
| Host versions or check wiring | `package.json`, `package-lock.json`, `tsconfig.json` | Host peers at runtime; pinned development host |

## Implement and verify

Trace callers before changing shared behavior. Use the [full validation sequence](CONTRIBUTING.md#full-validation-sequence), then [root checks](../../CONTRIBUTING.md#repository-wide-checks). Keep automated, installed-Pi load and interactive evidence separate; a missing prerequisite is not a pass.

## Supporting documents

| Document | Purpose | Read when |
| --- | --- | --- |
| [README.md](README.md) | Purpose, status, install, behavior, storage/privacy and limits | Using the extension or changing public usage |
| [AGENTS.md](AGENTS.md) | Project rules and routes | Starting work here or changing guidance |
| [CLAUDE.md](CLAUDE.md) | Runtime import of this guide | Checking instruction entrypoints |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Toolchain, exact checks and evidence | Making or verifying any change |
| [docs/architecture.md](docs/architecture.md) | Modules, flows, state, host seams and invariants | Changing behavior, state, I/O or dependencies |
| [docs/conventions.md](docs/conventions.md) | Engineering rules and adoption gaps | Writing or reviewing code |
| [docs/design.md](docs/design.md) | Labels, preview layout, states and colors | Changing anything human-facing |
| [docs/mission.md](docs/mission.md) | Goals, non-goals and constraints | Choosing or changing scope |
