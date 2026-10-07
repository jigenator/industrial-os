# Agent guide

Purpose: maintain a truthful, display-only Pi footer for sessions that move across projects and worktrees; see [README.md](README.md) and [docs/mission.md](docs/mission.md). This project owns its standards and toolchain within the monorepo. Follow the [root guide](../../AGENTS.md) and [Pi guide](../AGENTS.md) as well.

## Critical engineering rules

- Never represent unavailable Git or GitHub data as clean or absent; preserve the discriminated results in `src/workspace.ts`. Usage windows likewise keep pending, failed, stale and unknown distinct from real quota (`src/usage.ts`). Full rule: [conventions — types and validation](docs/conventions.md#types-and-validation). Check: `test/workspace.test.ts` and `test/usage.test.ts`.
- Active is agent-reported display state only. Do not change cwd, wrap tools, reload instructions/resources, or infer switches from incidental reads. Rationale: [agent-reported active workspace](docs/decisions/agent-reported-active-workspace.md). Check: `test/extension.test.ts`.
- Keep local/remote I/O out of render, sanitize untrusted terminal content, retain extension status information (recognized `ponytail` goes to PNYTL; valid active Tatsu v1 status replaces its raw entry in EXT; unrecognized text stays in EXT), and bound every rendered line. Decoration motion only repaints; displayed values are always current. Full flow: [architecture](docs/architecture.md). Check: `test/footer.test.ts` and `test/extension.test.ts`.
- Do not install dependencies to run this project's checks. The tests use the globally installed Pi host for the declared peer packages by design; use the existing host prerequisite and commands in [CONTRIBUTING.md](CONTRIBUTING.md). The missing lockfile and development pin are [recorded gaps](docs/conventions.md#adoption-gaps).
- This extension does not import the design system yet; moving onto it is its own change, following the [migration requirements](../../docs/decisions/in-repo-design-system-package.md#migrating-an-extension). Until then, the footer palette, `C` in `src/footer.ts`, mirrors the design system's colors and must match `design-system/foundation/palette.mjs` and `signal-colors.mjs`; change the design system first. See [the decision](../../docs/decisions/in-repo-design-system-package.md) and the [palette](docs/design.md#palette-and-context-semantics).

## Read for the task

Start here and scan the supporting-documents map. Read every document whose `Read when` condition matches the task; do not load unrelated manuals.

| Task | Read before changing |
| --- | --- |
| Code or test change | Relevant flow in [architecture](docs/architecture.md) → applicable rule in [conventions](docs/conventions.md) → [validation sequence](CONTRIBUTING.md#full-validation-sequence) |
| Human-facing footer change | Also [design](docs/design.md), [mission](docs/mission.md) and [root design](../../docs/design.md) |
| Palette value | [Root design](../../docs/design.md#acid--black), [the color decision](../../docs/decisions/in-repo-design-system-package.md), the design-system change, then [palette](docs/design.md#palette-and-context-semantics) |
| Active selection or persistence | Also [the active-workspace decision](docs/decisions/agent-reported-active-workspace.md) |
| Packaging, Pi version or test-host wiring | [CONTRIBUTING.md](CONTRIBUTING.md), the package boundary in [architecture](docs/architecture.md#system-and-module-map), then the [Pi guide](../AGENTS.md) |
| Product scope | [Mission](docs/mission.md) and [root mission](../../docs/mission.md) |
| Guidance or validation | Relevant canonical guide, this map, [root conventions](../../docs/conventions.md), then [CONTRIBUTING.md](CONTRIBUTING.md) |

## Where work belongs

| Change | Start here | Relevant boundary |
| --- | --- | --- |
| Path, Git, worktree, remote, or PR semantics | `src/workspace.ts` | Node standard library only; no Pi UI/session state |
| CodexBar invocation, provider list, or usage-window parsing | `src/usage.ts` | Node standard library only; no Pi UI/session state |
| Footer content, sanitization, wrapping, palette, or motion frames | `src/footer.ts` | Pure snapshot-and-frame-to-lines rendering; I/O and clocks forbidden |
| Tool/command registration, persistence, polling, cache, animation timer, or lifecycle | `src/extension.ts` | Use public Pi APIs; guard stale work and dispose resources |
| Regression coverage | Matching file in `test/` | Isolated fixtures; real installed loader only at integration boundary |
| Project rules, experience or decisions | Relevant `docs/` guide | Commands and evidence belong in CONTRIBUTING |

## Implement and verify

Trace callers before changing shared behavior. Follow [conventions](docs/conventions.md); identify a nonconforming pattern instead of copying it. Avoid duplicate semantics and abstractions for hypothetical variants. Use the [full validation sequence](CONTRIBUTING.md#full-validation-sequence), then the [repository-wide checks](../../CONTRIBUTING.md#repository-wide-checks), and report passed, failed, skipped, and not-run checks plus missing prerequisites.

## Supporting documents

Keep one direct link, purpose and concrete reading condition for every project guide and shared guide used here.

| Document | Purpose | Read when |
| --- | --- | --- |
| [README.md](README.md) | User purpose, behavior, install, and limitations | Understanding or changing user-facing usage |
| [AGENTS.md](AGENTS.md) | Project rules and reading routes | Starting work in this project or changing guidance |
| [CLAUDE.md](CLAUDE.md) | Exact agent-runtime import of this guide | Checking runtime instruction discovery |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Toolchain, setup, commands, and review workflow | Implementing, testing, or reviewing any change |
| [docs/mission.md](docs/mission.md) | Product goals, non-goals, and constraints | Choosing scope or changing product behavior |
| [docs/conventions.md](docs/conventions.md) | Project engineering rules, examples, checks, and gaps | Writing, refactoring, or reviewing code |
| [docs/architecture.md](docs/architecture.md) | Current modules, contracts, flows, invariants, and limits | Tracing behavior or changing dependencies/state/I/O |
| [docs/design.md](docs/design.md) | Footer experience, palette, visual behavior, accessibility, and UI states | Changing human-facing output or interaction |
| [docs/decisions/agent-reported-active-workspace.md](docs/decisions/agent-reported-active-workspace.md) | Why Active is explicit, agent-reported, and display-only | Changing selection semantics, persistence, or cwd relationship |
| [Root README](../../README.md) | Monorepo orientation and layout | Changing installation or repository placement |
| [Root AGENTS](../../AGENTS.md) | Shared rules and repository guidance map | Working in this repository |
| [Root CONTRIBUTING](../../CONTRIBUTING.md) | Shared workflow and repository checks | Making or verifying any change |
| [Root conventions](../../docs/conventions.md) | Repository-wide engineering rules | Writing or reviewing code and technical guidance |
| [Root mission](../../docs/mission.md) | Monorepo intent and constraints | Choosing scope or changing project placement |
| [Root design](../../docs/design.md) | Shared terminal experience and visual language | Changing human-facing output or interaction |
| [Color and package decision](../../docs/decisions/in-repo-design-system-package.md) | Why the design system owns the colors that `C` mirrors, and what moving onto the package requires | Changing a palette value or importing the design system |
| [Pi AGENTS](../AGENTS.md) | Pi project placement and shared constraints | Working under `pi/` |
| [Pi CONTRIBUTING](../CONTRIBUTING.md) | Shared Pi toolchain facts and contribution routing | Changing project placement, packaging or contribution routes |
