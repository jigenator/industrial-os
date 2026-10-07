# Standalone packages, no shared workspace

Status: current.
Date/evidence: 2026-10-07, decided by the maintainer when the first Pi extension moved in and the root `node --test` was found to fail in a fresh clone until that extension's `npm ci` had run. Amended 2026-10-07 by the maintainer after status-bar moved in: a manifest-only root `package.json` lets Pi install the extensions from git, as the rpiv-mono repository already does for an extension in a subfolder.
Supersedes / superseded by: none.

## Problem

The repository holds projects with different toolchains: the design system is dependency-free Node ES modules with no manifest, and claude-interrupt is a TypeScript npm package that the Pi host installs from its own folder. More projects are planned, and they may be written in other languages. A root command or manifest would have to presume one toolchain, and a shared `node_modules` would change how the Pi host resolves an extension's dependencies.

## Choice and alternatives

**Chosen:** every project folder is its own project. It owns its language, manifest, lockfile, dependencies, commands, checks, guides, and license. The root holds shared documents: mission, design, conventions, architecture, contributing, the agent map, and decisions. Repository-wide validation is each project's documented sequence followed by the root's read-only checks. There is no root workspace, dependency, script, or shared `node_modules`.

The one root package file is a manifest-only `package.json`, with the lockfile npm generates for it, whose `pi.extensions` lists each Pi extension's entry point. Pi installs a git source by cloning it and loading the root package, so without this file the extensions could only be installed from a local checkout. Users select extensions with the settings entry's `extensions` filter; each extension still loads from its own folder with its own `package.json`.

**Rejected: a root `package.json` with npm workspaces.** It gives one `npm ci` and `npm test` for the Node projects, but it hoists dependencies into a root `node_modules`, which is not how the Pi host installs an extension from a local path, it presumes Node for projects that may not use it, and the design system has no manifest to put in a workspace.

**Rejected: no root manifest, local-checkout installs only.** It kept the root free of package files, but every user had to keep a checkout and pull it by hand, and Pi's git source with `pi update` could not be used.

**Rejected: a root script that runs every project's checks.** Nothing needs it yet. It is the smallest form to add if a CI gate is wanted, and it must call each project's documented commands rather than presume a language.

## Consequences and verification

- Root `node --test` is not a repository command. It discovers the extension's `.ts` tests and fails until `npm ci` has run there. The root contributing guide says so and lists each project's sequence instead.
- Adding a project means adding its document set and its row in the root map. Adding a Pi extension also adds its entry point to the root `package.json`.
- Verification: the root contributing guide's validation table names a directory for every command; no command runs from the root except the read-only checks. The git install is checked with the isolated install in [the Pi contributing guide](../../pi/CONTRIBUTING.md#shared-toolchain-facts).

## Revisit when

A CI gate is added, or two Node projects need the same development dependency at the same version and keep drifting. Either would justify the smallest root script, not a workspace, unless the Pi host's local-path installation rules change.
