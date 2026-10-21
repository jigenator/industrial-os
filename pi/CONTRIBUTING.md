# Contributing to the Pi extensions

What every Pi extension in this folder shares, and how to bring one in. Each extension's own contributing guide holds its exact commands, validation sequence, and verification records: [claude-interrupt](claude-interrupt/CONTRIBUTING.md), [signals-collector](signals-collector/CONTRIBUTING.md), [status-bar](status-bar/CONTRIBUTING.md), [herdr-sidebar](herdr-sidebar/CONTRIBUTING.md), [herdr-pane-naming](herdr-pane-naming/CONTRIBUTING.md), [session-recap](session-recap/CONTRIBUTING.md) and [image-preview](image-preview/CONTRIBUTING.md), and the Pi theme's in [theme](theme/CONTRIBUTING.md). The workflow for every change, including review and publication, is in the [root contributing guide](../CONTRIBUTING.md).

## Shared toolchain facts

Pi loads an extension from its own folder and supplies the host packages listed in [the Pi guide](AGENTS.md#critical-engineering-rules); the extension's development dependencies pin the Pi version its tests compile and run against. status-bar and signals-collector are exceptions: they have no development dependencies or lockfile and their tests run against the globally installed Pi, gaps recorded in [status-bar conventions](status-bar/docs/conventions.md#adoption-gaps) and [collector conventions](signals-collector/docs/conventions.md#checks-and-gaps). Node.js 22.18 and newer strips TypeScript types by default, so an extension's `test/*.test.ts` files run under Node's test runner directly. Running `node --test` from the repository root discovers those files, which need each extension's own setup; it is not a repository check.

The root `package.json` declares every extension's entry point in `pi.extensions`, so Pi can install the extensions from git; see [installing](README.md#install). Its two dependencies are `file:design-system` and pane naming's `pi-typesafe: ^0.9.1`; the [named exception](../docs/decisions/pane-naming-root-dependency.md) explains why the latter stays in both manifests. Root `.npmrc` sets `legacy-peer-deps=true` to prevent plain npm setup from installing host peers/typebox; no workspaces or scripts are added. Pi 1.2.0's git install, as read in its source, runs `npm install --omit=dev --legacy-peer-deps` in the clone root, so a git install supplies both dependencies itself, never subfolder dependencies. A local-path install runs nothing, so run the root `npm install` in [setup](../CONTRIBUTING.md#setup) once in a checkout. Host packages remain peers, never bundled runtime dependencies. No extension lists the design-system package in its manifest; pane naming alone also declares pi-typesafe. To check the git install without touching your own Pi settings, push the branch and run, from an empty temporary directory with a temporary agent directory:

```sh
PI_CODING_AGENT_DIR=<temp agent dir> pi install git:github.com/jigenator/industrial-os@<branch>
echo '{"type":"get_commands","id":"1"}' | PI_CODING_AGENT_DIR=<temp agent dir> pi --mode rpc
```

The install succeeds, the RPC run exits 0 without a load error, and the reply lists commands the extensions register with their source as the git package. It makes no model call. A pushed git-source check has not been run for this move; the local-clone equivalent is recorded [below](#move-verification), and the clean-clone check of the link is recorded in [the design-system contributing guide](../design-system/CONTRIBUTING.md#package-verification).

## Moving an extension in

Bring the extension's history with it:

1. In a temporary clone of its repository, rewrite every path under `pi/<name>/`.
2. Merge that branch into a monorepo branch with `git merge --allow-unrelated-histories`, and merge the pull request with a merge commit, not a squash, or the history is lost.
3. Add its entry point to `pi.extensions` in the root `package.json`, change its README's install instructions to the filtered git entry in [installing](README.md#install), and change its `package.json` `repository` to this repository with a `directory` field.
4. Give it the [project document set](../docs/architecture.md#contracts-between-the-root-and-a-project), converting its existing guides rather than keeping parallel copies.
5. Add it to the [root README layout](../README.md#layout), [this folder's README](README.md), and every one of its guides to the [root map](../AGENTS.md#supporting-documents).
6. Point the installed copy at the new path, confirm Pi loads it, then archive the old repository with a pointer in its README.

claude-interrupt was moved this way in pull request #4, and status-bar the same way in the pull request that added `pi/status-bar/`. herdr-pane-naming and session-recap also arrived through path-rewritten full-history merges, followed by packaging and guide commits; no imported history was squashed or rewritten after those merges.

## Move verification

2026-10-19, macOS, Node 22.23.0, npm 10.9.8, installed Pi 1.2.0:

- Documented root `npm install`: passed, three packages added, zero audit vulnerabilities. `npm ls --depth=0` lists only the design-system link and pi-typesafe 0.9.1; its SDK is 0.6.0. Both required paths exist. `ls node_modules/@earendil-works` and `ls node_modules/typebox` report no such directory; explicit filesystem and lockfile-package-entry assertions passed. The lockfile retains only peer metadata, not installed host/typebox packages.
- Diagnostic `npm ls --omit=dev --all`: exited 1 (ELSPROBLEMS) for pi-typesafe's intentionally unmet typebox peer; optional pre-1.0 Pi peers are also shown unmet. This is expected under peer suppression, not a failed setup. No duplicate host was installed to silence it.
- Extension-local checks: pane naming **61/61** plus real installed-host loader passed; recap strict project typecheck plus **122/122** passed on its pinned development host. Detailed records: [pane naming](herdr-pane-naming/CONTRIBUTING.md#verification-records), [recap](session-recap/CONTRIBUTING.md#verification-records).

- Clean local branch clone at `65d2b1c`: `git clone --no-hardlinks --branch chore/move-in-pane-naming-session-recap <checkout> <temp clone>`, then `npm install --omit=dev --legacy-peer-deps` in the clone: passed (three packages added, zero audit vulnerabilities). Root inventory, link and lockfile assertions passed again; a recursive root-node_modules package-name scan found no Pi/typebox packages. No extension-local installs were performed in the clone.
- From an empty temporary cwd, with a separate temporary `PI_CODING_AGENT_DIR`, `pi install <temp clone>` exited 0. `echo '{"type":"get_commands","id":"1"}' | PI_CODING_AGENT_DIR=<temp agent> pi --mode rpc` exited 0 with `"success":true` and commands `pane-naming`, `recap`, `footer-motion`, `flag` sourced from the clone (plus builtin commands). No extension-load errors or model calls. Recap lifecycle emitted owned-UI cleanup requests even in RPC; no recap generation or preference I/O occurred. All temporary clone/agent/cwd directories were removed.
- Repository checks 1–6: local Markdown links/anchors passed; all 119 supporting guides mapped once (root AGENTS is the map itself); all 13 CLAUDE entrypoints exact; branch/staged whitespace checks passed; new-contributor route/install/boundary review passed; exact publication filenames/content reviewed, with no private absolute paths, credentials, node_modules or scratch files committed. Both extensions' source, tests, local lockfiles and recap LICENSE/CHANGELOG are byte-identical to the imported merge. No palette values changed. The dependency diagram rendered using existing grok-mermaid 0.2.3 without warnings; no browser/interactive rendering claim.
- Interactive Pi/Herdr, live TypeSafe/title/recap providers, pushed git-source installation and other platforms: **not run**. No push, live configuration change, global install or old-repository edit was performed.

### Simplification pass

Reviewed the full branch diff against `origin/main`, including imported runtime/test code, lockfiles and guides. Kept runtime/test/local-lockfile contents unchanged rather than refactoring during the move. The entire new runtime-install mechanism is one root dependency plus one `.npmrc` line; no workspace, wrapper, setup script, vendoring or host copies. Restored pane naming's original compact manifest formatting instead of unrelated reformatting. Moved event/safeguard details into architecture, label/retention/focus details into design, and checks into contributing rather than leaving parallel README sections; usage/privacy and provenance remain in README. Corrected keep's confirmed-PR exception, distinguished non-TUI recap UI cleanup from generation, and labelled inherited Herdr source evidence rather than claiming a new live check. No extra features, options, adapters or source cleanups were needed.
