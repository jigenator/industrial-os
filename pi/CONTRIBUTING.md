# Contributing to the Pi extensions

What every Pi extension in this folder shares, and how to bring one in. Each extension's own contributing guide holds its exact commands, validation sequence, and verification records: [claude-interrupt](claude-interrupt/CONTRIBUTING.md) and [status-bar](status-bar/CONTRIBUTING.md). The workflow for every change, including review and publication, is in the [root contributing guide](../CONTRIBUTING.md).

## Shared toolchain facts

Pi loads an extension from its own folder and supplies the host packages listed in [the Pi guide](AGENTS.md#critical-engineering-rules); the extension's development dependencies pin the Pi version its tests compile and run against. status-bar is the exception: it has no development dependencies or lockfile and its tests run against the globally installed Pi, a gap recorded in [its conventions](status-bar/docs/conventions.md#adoption-gaps). Node.js 22.18 and newer strips TypeScript types by default, so an extension's `test/*.test.ts` files run under Node's test runner directly. Running `node --test` from the repository root discovers those files, which need each extension's own setup; it is not a repository check.

The root `package.json` declares every extension's entry point in `pi.extensions`, so Pi can install the extensions from git; see [installing](README.md#install). Its one dependency, `file:design-system`, links the design-system package, and its lockfile records that link; it has no workspaces or scripts. Pi 1.0.4's git install, as read in its source, runs `npm install --omit=dev --legacy-peer-deps` in the clone root, so a git install creates the link itself. A local-path install runs nothing, so run the root `npm install` in [setup](../CONTRIBUTING.md#setup) once in a checkout. An extension still declares only the host's peer packages in its own manifest; it never lists the design-system package. To check the git install without touching your own Pi settings, push the branch and run, from an empty temporary directory with a temporary agent directory:

```sh
PI_CODING_AGENT_DIR=<temp agent dir> pi install git:github.com/jigenator/industrial-os@<branch>
echo '{"type":"get_commands","id":"1"}' | PI_CODING_AGENT_DIR=<temp agent dir> pi --mode rpc
```

The install succeeds, the RPC run exits 0 without a load error, and the reply lists commands the extensions register with their source as the git package. It makes no model call. This check has not been run since the root dependency was added; the clean-clone check of the link is recorded in [the design-system contributing guide](../design-system/CONTRIBUTING.md#package-verification).

## Moving an extension in

Bring the extension's history with it:

1. In a temporary clone of its repository, rewrite every path under `pi/<name>/`.
2. Merge that branch into a monorepo branch with `git merge --allow-unrelated-histories`, and merge the pull request with a merge commit, not a squash, or the history is lost.
3. Add its entry point to `pi.extensions` in the root `package.json`, change its README's install instructions to the filtered git entry in [installing](README.md#install), and change its `package.json` `repository` to this repository with a `directory` field.
4. Give it the [project document set](../docs/architecture.md#contracts-between-the-root-and-a-project), converting its existing guides rather than keeping parallel copies.
5. Add it to the [root README layout](../README.md#layout), [this folder's README](README.md), and every one of its guides to the [root map](../AGENTS.md#supporting-documents).
6. Point the installed copy at the new path, confirm Pi loads it, then archive the old repository with a pointer in its README.

claude-interrupt was moved this way in pull request #4, and status-bar the same way in the pull request that added `pi/status-bar/`.
