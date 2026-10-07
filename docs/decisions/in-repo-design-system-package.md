# The design system is an in-repo package and owns the colors

Status: current.
Date/evidence: 2026-10-07, decided by the maintainer when `design-system/package.json` and the root `file:` dependency were added. Verification is recorded in [the design-system contributing guide](../../design-system/CONTRIBUTING.md#package-verification).
Supersedes / superseded by: supersedes [the Pi extensions' colors take precedence](extension-colors-take-precedence.md) in full, and [standalone packages](standalone-packages.md) in part: the root `package.json` now carries one dependency, and the root install is a shared step.

## Problem

The design system models the Pi extensions' elements, motions, and colors, but nothing could import it. It had no manifest, and a Pi extension loaded from its own folder could not reach code outside that folder. Every shared color was copied by hand in four places, and an extension that wanted a design-system element could only copy it. Without a package, the other projects here had no supported way to use the design system.

## Choice and alternatives

**Chosen: a private package, consumed by name inside this repository only.**

- `design-system/package.json` names the package `@industrial-os/design-system`. It is `private`, ESM, and has no dependencies and no `main`. An explicit `exports` map lists every foundation module, element, and motion primitive as `./foundation/<name>`, `./elements/<name>`, or `./motions/<name>`. Tests, `examples/`, and the internal `motions/frame.mjs` seam are not exported. The package is never published. Consumers outside this repository are out of scope.
- The root `package.json` lists it as a `file:design-system` dependency beside the `pi` manifest, and its lockfile records the link. `npm install` at the root links `node_modules/@industrial-os/design-system` to `design-system/`, so any project in the checkout resolves it by name.
- Any project may import `@industrial-os/design-system` by package name, through an exported subpath. That is the one exception to the rule that projects never import each other's code. The full rule is in [conventions](../conventions.md#module-and-dependency-rules).
- **The design system owns the colors.** `design-system/foundation/palette.mjs` is the source of the nine Acid / Black roles, and `design-system/foundation/signal-colors.mjs` is the source of status-bar's other product colors. Until an extension migrates, its color constants mirror those values and must match them. Changing a color means changing the design system first, then every extension that still mirrors it, each in its own commit. Status-bar computed some of its mixes with a different rounding rule. `mixOver()` returns those values exactly, so the design system matches status-bar's current mixes.
- **This change adds the package only.** Neither extension imports the package yet, and their code is unchanged. Moving an extension onto it is a later, separate change.

Pi 1.0.4's git install, as read in its source, clones the repository and runs `npm install --omit=dev --legacy-peer-deps` in the clone root when a `package.json` exists. It also reinstalls missing root `dependencies`. A git install therefore links the package with no extra step. A local-path install (`pi install <checkout>/pi/<name>`) installs nothing, so developers run `npm install` once at the checkout root.

**Rejected: npm workspaces.** Workspaces would give one install for every Node project, but they hoist each project's dependencies into a shared `node_modules`. That changes how an extension's own dependencies resolve, presumes Node for projects that may not use it, and adds a root toolchain. A single `file:` dependency links the one package that is shared and changes nothing else.

**Rejected: publishing to a registry.** The package exists only for this repository's projects. Publishing would add a release process, versioning across projects, and a public API commitment that no current consumer needs.

**Rejected: copying design-system code into each extension.** Copying keeps each extension self-contained, but it multiplies the hand-kept copies that this decision removes, and every refinement would need to be copied again.

**Not adopted for now: an automated palette check.** A test could compare the extensions' constants with the design system; it has not been added. Migrating each extension to import its colors removes the copies such a test would guard. Until then, a review comparison is the check.

**Rejected, from the superseded record: the extensions as the color authority.** That rule held while nothing could import the design system. Once the design system is importable, making it the source lets every project read the same values instead of copying them.

## Consequences and verification

- The root `package.json` lists the extensions in `pi.extensions` and has the one `file:` dependency. It still has no workspaces and no scripts, and there is still no repository-wide command. Each project keeps its own checks; see [standalone packages](standalone-packages.md). The root install is the only shared step.
- The design system stays standard-library-only and imports nothing from another project. Its elements and motions own no I/O. It remains a reference kit, now installable by name; nothing imports it yet.
- A new foundation module, element, or motion primitive needs an `exports` entry. `design-system/package.test.mjs` fails until it has one, and fails if an export names a test, an example, or `motions/frame.mjs`.
- Each Pi extension's manifest still declares only the host's peer packages. It reaches the design system through the root install, not through its own dependencies.
- Color check: compare each extension's constants with `design-system/foundation/palette.mjs` and `signal-colors.mjs`, using [design](../design.md#acid--black) to map a constant to its role. No automated comparison exists.
- Automated and Pi-load verification are recorded in [the design-system contributing guide](../../design-system/CONTRIBUTING.md#package-verification). No interactive Pi or Herdr check has run against the package.

## Migrating an extension

Moving an extension onto the package is a separate change for each extension. It needs:

- imports of `@industrial-os/design-system/<group>/<name>` subpaths only, never a relative path into `design-system/` and never an unexported module;
- its color constants replaced by imports from `foundation/palette` and `foundation/signal-colors`, and its row in the review comparison retired;
- its own tests and load check run from a checkout where the root `npm install` has run, with that setup step added to its contributing guide;
- for claude-interrupt, a way for `tsc --noEmit` to type the imported `.mjs` modules, such as type declarations or `allowJs` with `checkJs`, because the design system ships no types;
- for status-bar, whose guide says not to install dependencies for its checks, an exception for the root install;
- an isolated git install check, as in [the Pi contributing guide](../../pi/CONTRIBUTING.md#shared-toolchain-facts), showing that the installed extension loads with the linked package.

## Revisit when

An extension migrates and the review comparison no longer covers it, a project outside Node needs the design system, or a consumer outside this repository is proposed. A Pi release that stops installing root dependencies on a git install would also need a revisit.
