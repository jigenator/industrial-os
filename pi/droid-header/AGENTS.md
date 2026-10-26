# Agent guide

Purpose: replace Pi's startup header with the Industrial OS droid details panel and its manifest of loaded resources. This project supplements the [root guide](../../AGENTS.md) and [Pi guide](../AGENTS.md); user usage is in [README](README.md).

## Critical engineering rules

- Show only real values. Unknown is `--` (or `?` digits for a missing session ID), never zero, a guess or a placeholder name; a failed manifest says `MANIFEST UNAVAILABLE` with its reason and never throws. Check: `test/header.test.ts`, `test/facts.test.ts`, `test/sources.test.ts`.
- Every rendered line is exactly the width Pi passes, at every width, state and intro time; Pi stops on a wider line. Check: the width sweeps in `test/header.test.ts` and `test/extension.test.ts`.
- Colors and numerals come only from design-system exported subpaths; no hex value or Pi theme color in source. Check: review `src/header.ts` imports; the golden frame compares every cell's colors with the design system's values.
- `src/header.ts` and `src/facts.ts` stay pure: no Pi, clock, timer or I/O. `src/sources.ts` holds the only I/O. The manifest never runs npm or Git and never installs: it uses Pi's package resolution with `"skip"` for missing packages and an empty npm command, which Pi's own guard rejects before any process starts; never `DefaultResourceLoader.reload()`, which reloads settings and installs. Check: their tests use no Pi context; `test/sources.test.ts` builds the manifest with every `child_process` function made to throw and asserts none was called.
- TUI only; never consume or delay input. Bound the intro and dispose every timer and listener on settle, replacement, reload and shutdown. Check: `test/extension.test.ts` with a manual clock.
- Tests stay offline in temporary directories; never touch real sessions, settings or `~/.pi`.

## Read for the task

| Task | Read before changing |
| --- | --- |
| Code or tests | [Architecture](docs/architecture.md), [conventions](docs/conventions.md), then [validation](CONTRIBUTING.md#full-validation-sequence) |
| Anything a user sees | Also [design](docs/design.md), the [root design](../../docs/design.md) and the design system's [motions](../../design-system/motions/README.md) |
| A color or numeral | The [package decision](../../docs/decisions/in-repo-design-system-package.md); change the design system first |
| Packaging or the Pi version | [Contributing](CONTRIBUTING.md), the [host seams](docs/architecture.md#host-seams), then the [Pi guide](../AGENTS.md) |
| Scope | [Mission](docs/mission.md) and the [root mission](../../docs/mission.md) |
| Guidance | The relevant canonical document, then the [root checks](../../CONTRIBUTING.md#repository-wide-checks) |

## Where work belongs

| Change | Start here | Boundary |
| --- | --- | --- |
| Layout, intro timeline, decode or colors | `src/header.ts` | Pure; state, width and time in, styled cells out; design-system subpaths only |
| How a value is derived or named | `src/facts.ts` | Pure; the rules in [design values](docs/design.md#values) |
| Reading the branch or building the manifest | `src/sources.ts` | Bounded reads; Pi's public exports only; never runs npm or Git, installs or loads extension code; resolves to a value, never throws |
| Lifecycle, timers, settling and ANSI output | `src/extension.ts` | TUI only; one header per session; every timer disposed |
| Host lookup for tests | `test/host.ts` | The globally installed Pi through `PI_HOST_ROOT`; never installs a host |

## Implement and verify

Use the [full validation sequence](CONTRIBUTING.md#full-validation-sequence), then the [root checks](../../CONTRIBUTING.md#repository-wide-checks). Keep automated, installed-Pi load, scripted-terminal and interactive evidence separate; a missing prerequisite is not a pass.

## Supporting documents

| Document | Purpose | Read when |
| --- | --- | --- |
| [README.md](README.md) | Purpose, status, install, `quietStartup`, values and limits | Using the extension or changing public usage |
| [AGENTS.md](AGENTS.md) | Project rules and routes | Starting work here or changing guidance |
| [CLAUDE.md](CLAUDE.md) | Runtime import of this guide | Checking instruction entrypoints |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Toolchain, exact checks and evidence | Making or verifying any change |
| [docs/architecture.md](docs/architecture.md) | Modules, flow, state, host seams and invariants | Changing behavior, state, I/O or dependencies |
| [docs/conventions.md](docs/conventions.md) | Engineering rules and adoption gaps | Writing or reviewing code |
| [docs/design.md](docs/design.md) | Layouts, values, states, motion rates, colors and mock deviations | Changing anything human-facing |
| [docs/mission.md](docs/mission.md) | Goals, non-goals and constraints | Choosing or changing scope |
