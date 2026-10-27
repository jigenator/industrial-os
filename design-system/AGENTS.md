# Design-system agent guide

Purpose: the curated, terminal-only design system optimized for Herdr, at the foundation of Industrial OS. This guide supplements the [root agent guide](../AGENTS.md); follow both.

## Critical engineering rules

- Keep polished elements here; leave experiments, source catalogs, recordings, and discovery reports outside the repository. See [mission](../docs/mission.md).
- Render all elements and demos as terminal text and terminal-native styling, never HTML/CSS/canvas/images. Herdr is the reference environment; verify behavior there before claiming support. See [design](../docs/design.md).
- Plain Node.js 22 ES modules, standard library only, importing nothing from another project. The code runs in the native example hosts, the showcase and the storybook, and as the private package `@industrial-os/design-system`, which in-repo projects import by name; Lunalee alone may use public root-package paths at a full git SHA under the package decision. It is never published, and both Pi extensions consume its exported subpaths through host adapters. See [conventions](docs/conventions.md) and [the package decision](../docs/decisions/in-repo-design-system-package.md).
- Every foundation module, element, and motion primitive has an entry in the `package.json` `exports` map, and nothing else does: no tests, no `examples/`, no `motions/frame.mjs`. `package.test.mjs` fails otherwise. See [architecture](docs/architecture.md#data-and-contracts).
- This project owns the color values. `foundation/palette.mjs` and `foundation/signal-colors.mjs` are their source; `foundation/surface-palette.mjs` owns Lunalee surface colors. Both Pi extensions import their palette/signal values, so a color change lands here first and reaches consumers through the package. See [the decision](../docs/decisions/in-repo-design-system-package.md).
- Consumers extend here: when a project needs a visual component this package lacks, or one that draws differently, the element is added or extended here first, with an option whose default leaves every existing caller unchanged. See the [root rule](../docs/conventions.md#design-system-components).
- Keep displayed values truthful, render within the supplied cell budget, and preserve input/focus behavior. Color and animation cannot be the only carriers of meaning. See [design](../docs/design.md).

## Read for the task

Design is the repository-wide [design](../docs/design.md) plus [this project's](docs/design.md); conventions are the repository-wide [conventions](../docs/conventions.md) plus [this project's](docs/conventions.md); architecture is [docs/architecture.md](docs/architecture.md); contributing is [CONTRIBUTING.md](CONTRIBUTING.md). The other guides are listed in the [root supporting-documents map](../AGENTS.md#supporting-documents).

| Task | Route |
| --- | --- |
| Add or refine an element | Design, architecture, conventions, then contributing |
| Add or refine a motion | Design, the motions guide, architecture, conventions, then contributing |
| Change a storybook story or a terminal host | The examples guide, design, architecture, then contributing |
| Change a public contract, an export, or a dependency | Architecture, conventions, then contributing |
| Change a color value | [Root design](../docs/design.md#acid--black), [the decision](../docs/decisions/in-repo-design-system-package.md), the foundation guide, then each extension that mirrors it |

## Where work belongs

Each element owns one folder under `elements/`, with its contract, code, and checks together. Shared cell and palette behavior lives in `foundation/`. Reusable, I/O-free motion primitives live in `motions/`. Composed specimens, the storybook, and their terminal hosts live in `examples/`. `package.json` holds the package name and the `exports` map, and `package.test.mjs` checks it. Follow the placement rules in architecture.

## Implement and verify

Use the [design-system validation sequence](CONTRIBUTING.md#full-validation-sequence). Commands run from this folder.
