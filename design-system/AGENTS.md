# Design-system agent guide

Purpose: the curated, terminal-only design system optimized for Herdr, at the foundation of Industrial OS. This guide supplements the [root agent guide](../AGENTS.md); follow both.

## Critical engineering rules

- Keep polished elements here; leave experiments, source catalogs, recordings, and discovery reports outside the repository. See [mission](../docs/mission.md).
- Render all elements and demos as terminal text and terminal-native styling, never HTML/CSS/canvas/images. Herdr is the reference environment; verify behavior there before claiming support. See [design](../docs/design.md).
- The only runtime is the unreleased native example hosts, the showcase and the storybook: plain Node.js 22 ES modules, standard library only. See [architecture](docs/architecture.md).
- Keep displayed values truthful, render within the supplied cell budget, and preserve input/focus behavior. Color and animation cannot be the only carriers of meaning. See [design](../docs/design.md).

## Read for the task

Design is the repository-wide [design](../docs/design.md), architecture is [docs/architecture.md](docs/architecture.md), conventions are the repository-wide [conventions](../docs/conventions.md), and contributing is [CONTRIBUTING.md](CONTRIBUTING.md). The other guides are listed in the [root supporting-documents map](../AGENTS.md#supporting-documents).

| Task | Route |
| --- | --- |
| Add or refine an element | Design, architecture, conventions, then contributing |
| Add or refine a motion | Design, the motions guide, architecture, conventions, then contributing |
| Change a storybook story or a terminal host | The examples guide, design, architecture, then contributing |
| Change a public contract or dependency | Architecture, conventions, then contributing |

## Where work belongs

Each element owns one folder under `elements/`, with its contract, code, and checks together. Shared cell and palette behavior lives in `foundation/`. Reusable, I/O-free motion primitives live in `motions/`. Composed specimens, the storybook, and their terminal hosts live in `examples/`. Follow the placement rules in architecture.

## Implement and verify

Use the [design-system validation sequence](CONTRIBUTING.md#full-validation-sequence). Commands run from this folder.
