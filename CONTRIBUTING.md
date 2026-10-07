# Contributing

## Toolchain and setup

The current repository contains Markdown guidance only. Use Git and a UTF-8 text editor. There is no package manifest, dependency installation, native runtime, formatter, or CI gate.

A terminal framework and its version-specific API contracts must be selected and checked before implementing the first executable specimen. Do not add a toolchain merely to edit these documents.

## Fast loop

From the repository root:

```sh
git diff --check
git diff --cached --check
git status --short
```

These commands are read-only. Diff checks cover unstaged and staged tracked changes, not new untracked file contents, link correctness, design quality, or runtime behavior. Review newly created files explicitly.

## Full validation sequence

Source: the actual documentation inventory and Git state; no application manifest or CI exists.

| Order | Directory | Command or review | Prerequisites/effects | Coverage |
| --- | --- | --- | --- | --- |
| 1 | Repository root | Fast-loop commands above | Git; read-only | Whitespace in diffs and changed-file inventory |
| 2 | Repository root | Open every changed local Markdown link | Text/Markdown reader; read-only | Targets and relevant sections exist |
| 3 | Repository root | Compare guidance files with the AGENTS supporting-documents table | Read-only | Direct link, purpose, and reading condition for every guide |
| 4 | Repository root | Verify CLAUDE.md contains exactly `@AGENTS.md` plus one newline | Read-only byte comparison | Single instruction source |
| 5 | Repository root | Read the changed documents as a new contributor | Read-only | Correct placement, actionable rules, honest current/proposed boundaries |
| 6 | Repository root | Review the exact files intended for publication | Read-only | No private material, unlicensed copied assets, scratch reports, or generated clutter |

Render Mermaid diagrams with an existing local or target documentation renderer when available. Report rendering as **not run** if none is available; do not install a renderer or upload private drafts solely for validation.

There are no application tests to run yet. When an executable element is added, document its actual setup, fast check, full tests, prerequisites, and side effects here. Required checks that skip do not establish a pass.

## Making a change

Read the applicable routes in [AGENTS.md](AGENTS.md). Trace the relevant contract and callers, then make the smallest correct change. For nontrivial behavior, include a focused runnable check at the lowest useful layer. Test native boundaries separately from appearance.

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

Update conventions when engineering rules change, architecture when boundaries change, design when experience changes, and this document when commands change. Update the AGENTS supporting-document map whenever guidance is added, moved, or removed. Commit and publish only with the maintainer's authorization.
