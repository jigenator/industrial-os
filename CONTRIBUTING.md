# Contributing

This guide covers the workflow for every change and the checks that apply to the whole repository. Every project owns its toolchain, commands, validation sequence, and verification records in its own contributing guide:

| Project | Toolchain | Contributing guide |
| --- | --- | --- |
| `source-collector/` | Bun 1.4.4, Effect 4, TypeScript 7.1 beta, oxlint/oxfmt; isolated Unix socket tests | [source-collector/CONTRIBUTING.md](source-collector/CONTRIBUTING.md) |
| `design-system/` | Node.js 22, standard library; its own checks need no install step | [design-system/CONTRIBUTING.md](design-system/CONTRIBUTING.md) |
| `pi/claude-interrupt/` | Node.js 22, npm, TypeScript, an installed Pi for the load check | [pi/claude-interrupt/CONTRIBUTING.md](pi/claude-interrupt/CONTRIBUTING.md) |
| `pi/signals-collector/` | Node.js 22 type stripping, installed Pi; offline cache/contract tests | [pi/signals-collector/CONTRIBUTING.md](pi/signals-collector/CONTRIBUTING.md) |
| `pi/status-bar/` | Node.js 22, npm, TypeScript run by type stripping, the globally installed Pi for its tests and the load check | [pi/status-bar/CONTRIBUTING.md](pi/status-bar/CONTRIBUTING.md) |
| `pi/herdr-sidebar/` | Node.js 22, npm, TypeScript run by type stripping, the globally installed Pi for its tests and the load check | [pi/herdr-sidebar/CONTRIBUTING.md](pi/herdr-sidebar/CONTRIBUTING.md) |
| `pi/herdr-pane-naming/` | Node.js 22.19+, npm, installed Pi loader; mocked CLI/services | [pi/herdr-pane-naming/CONTRIBUTING.md](pi/herdr-pane-naming/CONTRIBUTING.md) |
| `pi/session-recap/` | Node.js 22.19+, npm, TypeScript; pinned offline Pi host probes | [pi/session-recap/CONTRIBUTING.md](pi/session-recap/CONTRIBUTING.md) |
| `pi/image-preview/` | Node.js 22.19+, npm, strict TypeScript; pinned Pi 1.3.0 loader tests, an installed Pi for the load check | [pi/image-preview/CONTRIBUTING.md](pi/image-preview/CONTRIBUTING.md) |
| `pi/droid-header/` | Node.js 22.19+, TypeScript run by type stripping, the root install, the globally installed Pi for its tests and the load check | [pi/droid-header/CONTRIBUTING.md](pi/droid-header/CONTRIBUTING.md) |
| `pi/theme/` | JSON; Node.js 22.19+ for its check, the root install and an installed Pi | [pi/theme/CONTRIBUTING.md](pi/theme/CONTRIBUTING.md) |
| `herdr-plugins/dispatch-feed/` | Bun 1.4.4, strict TypeScript, oxlint/oxfmt, fake socket and PTY checks | [herdr-plugins/dispatch-feed/CONTRIBUTING.md](herdr-plugins/dispatch-feed/CONTRIBUTING.md) |
| `herdr-plugins/spaces/` | Node.js 22 standard library; fake Unix socket tests | [herdr-plugins/spaces/CONTRIBUTING.md](herdr-plugins/spaces/CONTRIBUTING.md) |
| `herdr/` | TOML; Node.js 22 for its check; an installed Herdr for the parser check | [herdr/CONTRIBUTING.md](herdr/CONTRIBUTING.md) |

There is no root test command, script, or workspace. The root `package.json` lists the Pi extensions' entry points and the Pi theme for Pi's git install, see [installing the Pi extensions](pi/README.md#install), and two runtime dependencies: the linked design-system package and pane naming's specific [pi-typesafe exception](docs/decisions/pane-naming-root-dependency.md). Running `node --test` from the root discovers the extensions' TypeScript tests, which need each extension's own setup; it is not a repository check. See [standalone packages](docs/decisions/standalone-packages.md) and [the in-repo design-system package](docs/decisions/in-repo-design-system-package.md).

## Setup

After cloning, run once from the repository root:

```sh
npm install
```

It links `node_modules/@industrial-os/design-system` to `design-system/` and installs `pi-typesafe` for pane naming. The committed root `.npmrc` sets `legacy-peer-deps=true`: do not remove or override it, because pi-typesafe's pre-1.0 Pi peers and typebox must not be installed alongside the host. See [the dependency decision](docs/decisions/pane-naming-root-dependency.md). It is the only shared setup step, and it is needed by projects importing the design system or pi-typesafe, including extensions loaded from this checkout. Pi's git install runs the equivalent itself. Run it again after a change to the root `package.json`. Each project's own setup is in its contributing guide.

Check the root boundary after setup (not inside an extension's dev install):

```sh
npm ls --depth=0
ls -ld node_modules/pi-typesafe node_modules/@industrial-os/design-system
test ! -e node_modules/@earendil-works && test ! -e node_modules/typebox
node --input-type=module - <<'JS'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { packages } = JSON.parse(readFileSync('package-lock.json', 'utf8'));
assert.deepEqual(Object.keys(packages).filter(path =>
  path.includes('node_modules/@earendil-works/') || /(^|\/)node_modules\/typebox$/.test(path)), []);
console.log('PASS: no host package entries in root lockfile');
JS
```

Peer declarations can remain in lockfile metadata; no installed package entries may exist. Recursive `npm ls --all` reports the intentionally unmet typebox peer, not a failed install.

## Making a change

Read the applicable routes in [AGENTS.md](AGENTS.md) and in the guide of the project you change. Trace the relevant contract and callers, make the smallest correct change, and add a focused runnable check at the lowest useful layer for nontrivial behavior. Test host boundaries separately from appearance. Validate with the project's sequence, then the [repository-wide checks](#repository-wide-checks).

A change that spans projects, such as a palette value, is several changes: the design doc where a role changes, the design system, then each extension that still mirrors the value, each in its own commit with its own checks. See [architecture](docs/architecture.md#representative-flows).

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
| 7 | If a color changed, confirm the migrated extensions still import it rather than copy it, and compare any extension that has not migrated with `design-system/foundation/palette.mjs` and `signal-colors.mjs` | No extension holds a stale copy of a design-system color; see [the decision](docs/decisions/in-repo-design-system-package.md) |

Render Mermaid diagrams with an existing local or target documentation renderer when available. Report rendering as **not run** if none is available; do not install a renderer or upload private drafts solely for validation.

A required check that is skipped does not count as a pass.

## Adding or moving in a project

A project is a top-level folder, or a folder under `pi/` for a Pi extension or `herdr-plugins/` for a Herdr plugin, that owns its language, manifest, dependencies, checks, guides, and license. Before it lands:

1. Give it the document set in [architecture](docs/architecture.md#contracts-between-the-root-and-a-project).
2. Add every one of its guides to the [root map](AGENTS.md#supporting-documents) and the folder to the [root README layout](README.md#layout).
3. If it is a Pi extension, follow [moving an extension in](pi/CONTRIBUTING.md#moving-an-extension-in) so its history survives and its install instructions point here.
4. If it imports the design system, import it only by package name and add the root install to its setup; see [the package decision](docs/decisions/in-repo-design-system-package.md#migrating-an-extension).
5. Draw its visual components with the design system, adding or extending elements there first; see [the rule](docs/conventions.md#design-system-components).
6. Record any consequential choice under `docs/decisions/` and map it.

Do not create a folder, placeholder guides, or adapters for a project before its first maintained content exists.

## Refactoring

Separate structural changes from behavior changes. Preserve contracts with checks, update callers together, and remove obsolete paths rather than leaving unrequested compatibility wrappers. A move within or between projects keeps history: use `git mv` within a project and a history-preserving merge between repositories.

## Review checks

- Does the change stay inside one project, or is each project's part its own commit with its own checks?
- Does any import cross a project root, other than `@industrial-os/design-system` by package name through an exported subpath? Does any guide duplicate a rule that has a canonical home?
- Are dependency direction, public behavior, failure paths, and focus/state handling clear?
- Are width, glyph, color, motion, and host claims supported by the stated checks, with automated, load, and interactive evidence kept separate?
- Does each abstraction, dependency, or root mechanism serve a current need? Is there a simpler correct choice?
- Are publication rights and license notices accounted for?

## Keeping docs accurate

Update the root conventions when a repository-wide rule changes, the root architecture when a project is added, moved, or changes what it depends on, and the design doc when the shared experience changes. Update a project's guides when its boundaries, experience, or commands change. Update the AGENTS supporting-document map whenever guidance is added, moved, or removed. Commit and publish only with the maintainer's authorization.
