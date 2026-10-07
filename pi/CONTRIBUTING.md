# Contributing to the Pi extensions

What every Pi extension in this folder shares, and how to bring one in. Each extension's own contributing guide holds its exact commands, validation sequence, and verification records: [claude-interrupt](claude-interrupt/CONTRIBUTING.md) and [status-bar](status-bar/CONTRIBUTING.md). The workflow for every change, including review and publication, is in the [root contributing guide](../CONTRIBUTING.md).

## Shared toolchain facts

Pi loads an extension from its own folder and supplies the host packages listed in [the Pi guide](AGENTS.md#critical-engineering-rules); the extension's development dependencies pin the Pi version its tests compile and run against. status-bar is the exception: it has no development dependencies or lockfile and its tests run against the globally installed Pi, a gap recorded in [its conventions](status-bar/docs/conventions.md#adoption-gaps). Node.js 22.18 and newer strips TypeScript types by default, so an extension's `test/*.test.ts` files run under Node's test runner directly. Running `node --test` from the repository root discovers those files, which need each extension's own setup; it is not a repository check.

## Moving an extension in

Bring the extension's history with it:

1. In a temporary clone of its repository, rewrite every path under `pi/<name>/`.
2. Merge that branch into a monorepo branch with `git merge --allow-unrelated-histories`, and merge the pull request with a merge commit, not a squash, or the history is lost.
3. Change its README's install instructions to a local checkout path (Pi's git sources load a repository's root package, and the monorepo has none) and its `package.json` `repository` to this repository with a `directory` field.
4. Give it the [project document set](../docs/architecture.md#contracts-between-the-root-and-a-project), converting its existing guides rather than keeping parallel copies.
5. Add it to the [root README layout](../README.md#layout), [this folder's README](README.md), and every one of its guides to the [root map](../AGENTS.md#supporting-documents).
6. Point the installed copy at the new path, confirm Pi loads it, then archive the old repository with a pointer in its README.

claude-interrupt was moved this way in pull request #4, and status-bar the same way in the pull request that added `pi/status-bar/`.
