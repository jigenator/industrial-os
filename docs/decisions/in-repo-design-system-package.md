# The design system is an in-repo package and owns the colors

Status: current.
Date/evidence: 2026-10-07, decided by the maintainer when `design-system/package.json` and the root `file:` dependency were added. Verification is recorded in [the design-system contributing guide](../../design-system/CONTRIBUTING.md#package-verification).
Supersedes / superseded by: supersedes [the Pi extensions' colors take precedence](extension-colors-take-precedence.md) in full, and [standalone packages](standalone-packages.md) in part: the root install became a shared step. Amended by [pane naming's root dependency](pane-naming-root-dependency.md): the root now carries the design-system link and that specific pi-typesafe exception, with peer suppression.

## Problem

The design system models the Pi extensions' elements, motions, and colors, but nothing could import it. It had no manifest, and a Pi extension loaded from its own folder could not reach code outside that folder. Every shared color was copied by hand in four places, and an extension that wanted a design-system element could only copy it. Without a package, the other projects here had no supported way to use the design system.

## Choice and alternatives

**Chosen: a private package consumed by name in this repository, with the pinned Lunalee exception below.**

- `design-system/package.json` names the package `@industrial-os/design-system`. It is `private`, ESM, and has no dependencies and no `main`. An explicit `exports` map lists every foundation module, element, and motion primitive as `./foundation/<name>`, `./elements/<name>`, or `./motions/<name>`. Tests, `examples/`, and the internal `motions/frame.mjs` seam are not exported. The nested package is never published. The only authorised outside-repository consumer is Lunalee, through the root git package as described below.
- The root `package.json` lists it as a `file:design-system` dependency beside the `pi` manifest, and its lockfile records the link. `npm install` at the root links `node_modules/@industrial-os/design-system` to `design-system/`, so any project in the checkout resolves it by name.
- Any project may import `@industrial-os/design-system` by package name, through an exported subpath. That is the one exception to the rule that projects never import each other's code. The full rule is in [conventions](../conventions.md#module-and-dependency-rules).
- **The design system owns the colors.** `design-system/foundation/surface-palette.mjs` additionally owns Lunalee's survey colors; Lunalee configures fill alpha, while the pure `foundation/surface.mjs` owns gradient, floor and compositing. `design-system/foundation/palette.mjs` is the source of the nine Acid / Black roles, and `design-system/foundation/signal-colors.mjs` is the source of status-bar's other product colors of the Herdr chrome colors (`HERDR_CHROME`) that `herdr/theme.toml` restates, and of the Pi chrome colors (`PI_CHROME`) that `pi/theme/industrial-os.json` restates. Until an extension migrates, its color constants mirror those values and must match them. Changing a color means changing the design system first, then every extension that still mirrors it, each in its own commit. Status-bar computed some of its mixes with a different rounding rule. `mixOver()` returns those values exactly, so the design system matches status-bar's current mixes.
- **This change adds the package only.** Neither extension imports the package yet, and their code is unchanged. Moving an extension onto it is a later, separate change.

Pi 1.0.4's git install, as read in its source, clones the repository and runs `npm install --omit=dev --legacy-peer-deps` in the clone root when a `package.json` exists. It also reinstalls missing root `dependencies`. A git install therefore links the package with no extra step. A local-path install (`pi install <checkout>/pi/<name>`) installs nothing, so developers run `npm install` once at the checkout root.

**Rejected: npm workspaces.** Workspaces would give one install for every Node project, but they hoist each project's dependencies into a shared `node_modules`. That changes how an extension's own dependencies resolve, presumes Node for projects that may not use it, and adds a root toolchain. A single `file:` dependency links the one package that is shared and changes nothing else.

**Rejected: publishing to a registry.** Registry publication is not needed for in-repo projects or the pinned Lunalee consumer. Publishing would add a release process, versioning across projects, and a public API commitment that no current consumer needs.

**Rejected: copying design-system code into each extension.** Copying keeps each extension self-contained, but it multiplies the hand-kept copies that this decision removes, and every refinement would need to be copied again.

**Not adopted for now: an automated palette check.** A test could compare the extensions' constants with the design system; it has not been added. Migrating each extension to import its colors removes the copies such a test would guard. Until then, a review comparison is the check.

**Rejected, from the superseded record: the extensions as the color authority.** That rule held while nothing could import the design system. Once the design system is importable, making it the source lets every project read the same values instead of copying them.

## Consequences and verification

- The root `package.json` lists the extensions in `pi.extensions` and has the `file:` dependency plus the named [pi-typesafe exception](pane-naming-root-dependency.md). It still has no workspaces and no scripts, and there is still no repository-wide command. Each project keeps its own checks; see [standalone packages](standalone-packages.md). The root install is the only shared step.
- The design system stays standard-library-only and imports nothing from another project. Its elements and motions own no I/O. It is installable by name; both extensions now import it, as recorded under [current adoption](#current-adoption).
- A new foundation module, element, or motion primitive needs an `exports` entry. `design-system/package.test.mjs` fails until it has one, and fails if an export names a test, an example, or `motions/frame.mjs`.
- Pi extensions declare host packages as peers. Pane naming additionally declares pi-typesafe, also installed at the root under [its specific exception](pane-naming-root-dependency.md). Extensions reach the design system through the root install, never their own dependency declaration.
- Color check: an extension that has not migrated compares its constants with `design-system/foundation/palette.mjs` and `signal-colors.mjs`, using [design](../design.md#acid--black) to map a constant to its role. No automated comparison exists. Both rendering extensions import their colors, so neither needs it.
- Automated and Pi-load verification are recorded in [the design-system contributing guide](../../design-system/CONTRIBUTING.md#package-verification). No interactive Pi or Herdr check has run against the package.

## Migrating an extension

Moving an extension onto the package is a separate change for each extension. It needs:

- imports of `@industrial-os/design-system/<group>/<name>` subpaths only, never a relative path into `design-system/` and never an unexported module;
- its color constants replaced by imports from `foundation/palette` and `foundation/signal-colors`, and its row in the review comparison retired;
- its own tests and load check run from a checkout where the root `npm install` has run, with that setup step added to its contributing guide;
- for a TypeScript-checked extension such as claude-interrupt, types for the imported `.mjs` modules; the design system now ships colocated `.d.mts` declarations for its consumed subpaths, to be extended as new modules gain TypeScript consumers;
- for status-bar, whose guide says not to install dependencies for its checks, an exception for the root install;
- an isolated git install check, as in [the Pi contributing guide](../../pi/CONTRIBUTING.md#shared-toolchain-facts), showing that the installed extension loads with the linked package.

## Current adoption

The package-only decision above records the original change. Both extensions now consume the package: claude-interrupt uses marker/tokens/motions; status-bar uses footer elements/tokens/scoped motions. Their copied palette comparison rows are retired. Consumed subpaths ship colocated `.d.mts` declarations; claude-interrupt retains its strict project check, while status-bar checks a compile-only public-contract specimen using the existing compiler, not a new standalone project toolchain. A local checkout requires the root install before either extension loads. Their project guides separate automated, golden, RPC and copied-state install evidence from real `pi install git:` and interactive checks, which remain unrun for the current port. Neither migration adds an extension-local design-system dependency. The Rust whiteboard plugin, a project outside Node, mirrors the palette in one file and checks it with a Node test that imports the package by name; see [the runtime decision](herdr-plugin-runtimes.md).

status-bar's exact-parity migration retains legacy Tatsu warm-up and USG row boot as host compatibility effects because they can hide warning/critical content. They do not weaken the design-system state-cue guard or imply a new state-hiding policy. See [status-bar architecture](../../pi/status-bar/docs/architecture.md#design-system-rendering-seam).

## Lunalee: pinned public git consumption

Amended 2026-10-27 by maintainer direction for Lunalee's chat visual pass. This admits one outside-repository consumer; it is not registry publication, a general redistribution licence, or a stable-API promise.

- Lunalee declares `"industrial-os": "github:jigenator/industrial-os#<full-merged-sha>"` in its consuming project's manifest and commits its root Bun lockfile. The SHA is a reviewed, full merged commit, never a branch, tag, abbreviated hash, local `file:` link, or copied source.
- The installed package is this repository's **root**, named `industrial-os`, not the nested `@industrial-os/design-system` package. Lunalee imports physical public module paths, for example `industrial-os/design-system/elements/label-plate/label-plate.mjs`. In-repo projects keep `@industrial-os/design-system/elements/label-plate` unchanged. Root path access bypasses the nested exports map: only targets listed in that map are public. Tests, examples and `motions/frame.mjs` remain private even when physically accessible. `design-system/package.test.mjs` checks root-path resolution of the consumed modules as well as nested exports.
- Every consumed `.mjs` ships a colocated `.d.mts`, including previously untyped modules. No generated declaration/build step or host dependency is added. Strict consumer compile specimens must test actual imports, not ambient `any` shims.
- A root git install distributes the root transitive dependency graph too: currently `@industrial-os/design-system: file:design-system` and `pi-typesafe: ^0.9.1`, plus pi-typesafe's locked dependencies. This does not make those dependencies design-system imports. Review the consumer lockfile, peer suppression, notices, install size and offline behavior; do not remove the root install scheme incidentally. Merely importing a public DS module must neither load Pi extensions nor require a global Pi host. The design system itself remains standard-library-only.
- **Pin update:** review the new merged DS commit, its public contracts, declarations, tests and rights; update the full SHA and consumer lock together. Run imports and strict types for every consumed subpath, consumer regressions and a frozen install from an isolated copied app tree with neither `.git` nor sibling checkouts. Record cold-online, warm-offline and cold-offline outcomes separately: a cold offline fetch must fail visibly, never fall back to an unpinned version. Native host/appearance checks are separate. A DS commit or successful import is not permission to install/restart the live application.
- **Rights:** the maintainer authorises Lunalee's cross-project use of this maintained design-system code and its canonical colors. Public visibility alone grants no general reuse licence. No new project licence is selected here; existing third-party notices and licences remain applicable. Review rights/notices for any added source or asset before distribution; stories use synthetic fixtures, not private transcripts or portrait assets.

## Revisit when

Another outside consumer is proposed; Lunalee needs a stable API, registry release, different package boundary or import path; root dependency/peer behavior, distribution rights or licensing changes; the pinned git install cannot work in an isolated copied app; or a consumed declaration is missing. Also revisit when a new extension mirrors values instead of importing them, a project outside Node needs the design system, or Pi stops installing root dependencies on git install.
