# Contributing

This guide covers the workflow for every change in the repository. Each package documents its own toolchain, commands, validation sequence, and verification records:

- [Design system](design-system/CONTRIBUTING.md): Node.js 22 setup, the storybook and showcase hosts, the fast loop, the full validation sequence, and the native Herdr verification records.

The planned Pi and Herdr packages will add their own when they move in. From the repository root, `node --test` runs every package's `*.test.mjs` checks.

## Making a change

Read the applicable routes in [AGENTS.md](AGENTS.md) and in the scoped guide of the package you change. Trace the relevant contract and callers, then make the smallest correct change. For nontrivial behavior, include a focused runnable check at the lowest useful layer. Test native boundaries separately from appearance. Validate with the sequence in that package's contributing guide, then the [repository-wide checks](#repository-wide-checks).

## Repository-wide checks

Run these from the repository root after the package's own validation sequence, for every change.

| Order | Command or review | Prerequisites/effects | Coverage |
| --- | --- | --- | --- |
| 1 | Open every changed local Markdown link | Text/Markdown reader; read-only | Targets and relevant sections exist |
| 2 | Compare guidance files with the root AGENTS supporting-documents table | Read-only | Direct link, purpose, and reading condition for every guide |
| 3 | Verify the root and `design-system/` CLAUDE.md each contain exactly `@AGENTS.md` plus one newline | Read-only byte comparison | Single instruction source |
| 4 | Read the changed documents as a new contributor | Read-only | Correct placement, actionable rules, honest current/proposed boundaries |
| 5 | Review the exact files intended for publication | Read-only | No private material, unlicensed copied assets, scratch reports, or generated clutter |

Render Mermaid diagrams with an existing local or target documentation renderer when available. Report rendering as **not run** if none is available; do not install a renderer or upload private drafts solely for validation.

A required check that is skipped does not count as a pass.

## Refactoring

Separate structural changes from behavior changes. Preserve contracts with checks, update callers together, and remove obsolete paths rather than leaving unrequested compatibility wrappers.

## Review checks

- Is the element polished enough to belong here?
- Are dependency direction, public behavior, failure paths, and focus/state handling clear?
- Are width, glyph, color, and motion claims supported by the stated checks?
- Does each abstraction or dependency serve a current need? Is there a simpler correct choice?
- Is each rule maintained in one place, with task-specific routes to deeper guidance?
- Are publication rights and any license notices accounted for?

## Keeping docs accurate

Update conventions when repository-wide engineering rules change. Update a package's architecture when its boundaries change, its design when its experience changes, and its contributing guide when its commands change. Update the AGENTS supporting-document map whenever guidance is added, moved, or removed. Commit and publish only with the maintainer's authorization.
