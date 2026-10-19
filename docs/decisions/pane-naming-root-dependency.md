# Pane naming's runtime dependency is installed at the root

Status: current.
Date/evidence: 2026-10-19, maintainer-approved move of herdr-pane-naming and session-recap. Pi 1.2.0's installed `dist/core/package-manager.js` (`installGit` / `getGitDependencyInstallArgs`) installs dependencies only in the clone root, using `npm install --omit=dev --legacy-peer-deps`.
Amends [standalone packages](standalone-packages.md) and [the in-repo design-system package](in-repo-design-system-package.md) only for the dependency/install boundary below; no workspace or repository-wide command is added.

## Problem

`pi/herdr-pane-naming/index.ts` and `models.ts` import pi-typesafe at runtime. Pi's git installer never installs subfolder dependencies, so retaining it only in that extension's manifest would fail to load from the monorepo. Local-path installs install nothing either.

pi-typesafe 0.9.1 declares Pi coding-agent/TUI peers `>=0.85.1 <1` and typebox `*`, while the installed host is Pi 1.2.0. Plain npm 7+ peer resolution could install a second, incompatible host or fail resolution. Installed extensions must use the host's copies, not a root-installed Pi or typebox.

## Choice and alternatives

- Add **only `pi-typesafe: ^0.9.1`** as a second root dependency, beside `@industrial-os/design-system: file:design-system`. Retain it in pane naming's own manifest for independent development. Its transitive `@typesafe-ai/sdk` is MIT, as is pi-typesafe; pane naming itself remains unlicensed. Session-recap needs only host peers at runtime.
- Commit root `.npmrc` with `legacy-peer-deps=true`, so documented root `npm install` matches Pi's peer policy. Keep it with the root lockfile. It prevents npm from auto-installing those peers; it does **not** prove pi-typesafe's declared host range supports Pi 1.x. Installed-host load tests are separate evidence.
- Root lockfile package entries and root node_modules must contain no `@earendil-works/*` or typebox package. Peer declarations in pi-typesafe's lockfile metadata remain truthful; they are not installed package entries. Recursive `npm ls --all` reports the intentionally unmet typebox peer (ELSPROBLEMS), so use top-level inventory plus explicit package-entry/filesystem assertions for this boundary.
- This is a named exception, not permission to add arbitrary shared dependencies. Projects still do not import other projects except exported design-system subpaths. No host peers become runtime dependencies, and no extension adds its own design-system dependency.

Rejected: workspaces/hoisting, which change every project's resolution; vendoring or rewriting pi-typesafe/extension source, which changes behavior and ownership; documenting only a manual subfolder install, which leaves Pi git installs broken; npm overrides installing a different host, which violates host ownership. A single root npm setting is smaller than a wrapper/setup script and also covers ordinary `npm install`.

## Consequences and verification

Checkout setup is canonical in [root contributing](../../CONTRIBUTING.md#setup). The root install now supplies the linked design system and pane naming's dependency, even if a user filters pane naming out. Subprojects keep their own install/check commands; the root `.npmrc` is not an extension-local toolchain policy.

The [Pi move verification](../../pi/CONTRIBUTING.md#move-verification) records plain root setup, a clean branch clone with Pi's production install arguments, explicit host-package exclusion and isolated local `pi install` plus RPC command discovery. No live models or Herdr panes are used. This local-clone check is not a pushed git-source install or interactive compatibility qualification.

## Revisit when

Pi starts installing subfolder dependencies, pi-typesafe changes runtime/peer requirements, npm changes peer handling, or another root runtime dependency is proposed. Re-run root inventory and installed-host load checks on dependency/host changes; do not widen this exception silently.
