# Contributing

This guide covers the workflow for every change and the checks that apply to the whole repository. Every project owns its toolchain, commands, validation sequence, and verification records in its own contributing guide:

| Project | Toolchain | Contributing guide |
| --- | --- | --- |
| `design-system/` | Node.js 22, standard library, no install step | [design-system/CONTRIBUTING.md](design-system/CONTRIBUTING.md) |
| `pi/claude-interrupt/` | Node.js 22, npm, TypeScript, an installed Pi for the load check | [pi/claude-interrupt/CONTRIBUTING.md](pi/claude-interrupt/CONTRIBUTING.md) |

There is no root manifest, install step, or test command. Running `node --test` from the root discovers the extension's TypeScript tests and fails until `npm ci` has run in that project; it is not a repository check. See [the decision](docs/decisions/standalone-packages.md).

## Making a change

Read the applicable routes in [AGENTS.md](AGENTS.md) and in the guide of the project you change. Trace the relevant contract and callers, make the smallest correct change, and add a focused runnable check at the lowest useful layer for nontrivial behavior. Test host boundaries separately from appearance. Validate with the project's sequence, then the [repository-wide checks](#repository-wide-checks).

A change that spans projects, such as a palette value, is several changes: the design doc, then each project in its own commit with its own checks. See [architecture](docs/architecture.md#representative-flows).

## Repository-wide checks

Run these from the repository root after the project's own sequence, for every change. All are read-only.

| Order | Command or review | Coverage |
| --- | --- | --- |
| 1 | Open every changed local Markdown link, including anchors | Targets and sections exist |
| 2 | Compare the guidance inventory with the root AGENTS supporting-documents table | Every guide has a direct link, purpose, and reading condition; no stale rows |
| 3 | Verify that the root CLAUDE.md and every project's CLAUDE.md contain exactly `@AGENTS.md` plus one newline | Single instruction source |
| 4 | `git diff --check` and `git diff --cached --check` | Whitespace errors in tracked changes |
| 5 | Read the changed documents as a new contributor | Correct placement, actionable rules, honest current/proposed boundaries |
| 6 | Review the exact files intended for publication | No private material, unlicensed copied assets, scratch reports, or generated clutter |

Render Mermaid diagrams with an existing local or target documentation renderer when available. Report rendering as **not run** if none is available; do not install a renderer or upload private drafts solely for validation.

A required check that is skipped does not count as a pass.

## Adding or moving in a project

A project is a top-level folder, or a folder under `pi/` for a Pi extension, that owns its language, manifest, dependencies, checks, guides, and license. Before it lands:

1. Give it the document set in [architecture](docs/architecture.md#contracts-between-the-root-and-a-project).
2. Add every one of its guides to the [root map](AGENTS.md#supporting-documents) and the folder to the [root README layout](README.md#layout).
3. If it is a Pi extension, follow [moving an extension in](pi/CONTRIBUTING.md#moving-an-extension-in) so its history survives and its install instructions point here.
4. Record any consequential choice under `docs/decisions/` and map it.

Do not create a folder, placeholder guides, or adapters for a project before its first maintained content exists.

## Refactoring

Separate structural changes from behavior changes. Preserve contracts with checks, update callers together, and remove obsolete paths rather than leaving unrequested compatibility wrappers. A move within or between projects keeps history: use `git mv` within a project and a history-preserving merge between repositories.

## Review checks

- Does the change stay inside one project, or is each project's part its own commit with its own checks?
- Does any import cross a project root? Does any guide duplicate a rule that has a canonical home?
- Are dependency direction, public behavior, failure paths, and focus/state handling clear?
- Are width, glyph, color, motion, and host claims supported by the stated checks, with automated, load, and interactive evidence kept separate?
- Does each abstraction, dependency, or root mechanism serve a current need? Is there a simpler correct choice?
- Are publication rights and license notices accounted for?

## Keeping docs accurate

Update the root conventions when a repository-wide rule changes, the root architecture when a project is added, moved, or changes what it depends on, and the design doc when the shared experience changes. Update a project's guides when its boundaries, experience, or commands change. Update the AGENTS supporting-document map whenever guidance is added, moved, or removed. Commit and publish only with the maintainer's authorization.
