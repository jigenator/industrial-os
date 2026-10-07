# Agent guide

Purpose: build a curated, terminal-only design system optimized for Herdr. Product scope lives in [the mission](docs/mission.md).

## Critical engineering rules

- Keep polished elements here; leave experiments, source catalogs, recordings, and discovery reports outside the repository. See [mission](docs/mission.md).
- Render all elements and demos as terminal text and terminal-native styling, never HTML/CSS/canvas/images. Herdr is the reference environment; verify behavior there before claiming support. See [design](docs/design.md).
- The only runtime is the unreleased native example hosts, the showcase and the storybook: plain Node.js 22 ES modules, standard library only. Do not invent an installed framework, package, released API, or runtime/Herdr check that has not run. See [architecture](docs/architecture.md).
- Keep displayed values truthful, render within the supplied cell budget, and preserve input/focus behavior. Color and animation cannot be the only carriers of meaning. See [design](docs/design.md).
- Do not copy third-party assets or code without checking rights and retaining required notices. Do not publish private paths, data, credentials, or internal artifact links. See [conventions](docs/conventions.md).

## Read for the task

Scan the supporting-document map and read every document whose condition applies before changing that area. Follow relevant sections and any scoped instructions; do not load unrelated manuals.

| Task | Route |
| --- | --- |
| Add or refine an element | Design, architecture, conventions, then contributing |
| Add or refine a motion | Design, the motions guide, architecture, conventions, then contributing |
| Change a storybook story or a terminal host | The examples guide, design, architecture, then contributing |
| Change a public contract or dependency | Architecture, conventions, then contributing |
| Change product scope or the default visual language | Mission and design |
| Change guidance or validation | The relevant canonical guide, this map, then contributing |

## Where work belongs

Canonical rules belong in the guides below. Each element owns one folder under `elements/`, with its contract, code, and checks together. Shared cell and palette behavior lives in `foundation/`. Reusable, I/O-free motion primitives live in `motions/`. Composed specimens, the storybook, and their terminal hosts live in `examples/`. Follow the placement rules in architecture. Do not create empty packages or speculative adapters.

## Implement and verify

Trace existing callers before changing shared behavior. Follow the engineering conventions rather than reproducing a conflicting pattern. Use the validation sequence in contributing and report passed, failed, skipped, and not-run checks separately.

## Supporting documents

Keep one direct link, purpose, and concrete reading condition for every supporting guidance document, including future element specifications, scoped instructions, and decisions. Add rows when documents are added.

| Document | Purpose | Read when |
| --- | --- | --- |
| [README.md](README.md) | User orientation and release status | Changing public usage or onboarding |
| [CLAUDE.md](CLAUDE.md) | Runtime import of this guide | Checking agent entry points |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Setup and validation | Making or verifying any change |
| [docs/mission.md](docs/mission.md) | Product scope and constraints | Choosing features or changing scope |
| [docs/conventions.md](docs/conventions.md) | Engineering rules | Writing or reviewing code and technical guidance |
| [docs/architecture.md](docs/architecture.md) | Placement, boundaries, and evolution | Adding elements or changing dependencies/contracts |
| [docs/design.md](docs/design.md) | Visual language, interactions, and acceptance | Changing anything human-facing |
| [foundation/README.md](foundation/README.md) | Line model, text/glyph contract, palette source, color output | Changing shared rendering, text handling, glyphs, or colors |
| [elements/label-plate/README.md](elements/label-plate/README.md) | Label plate contract | Using or changing label plates |
| [elements/numbered-panel/README.md](elements/numbered-panel/README.md) | Numbered panel contract | Using or changing panels |
| [elements/gauge/README.md](elements/gauge/README.md) | Gauge contract and truthfulness rules | Using or changing gauges |
| [elements/status-row/README.md](elements/status-row/README.md) | Status row contract and states | Using or changing status rows |
| [motions/README.md](motions/README.md) | Motion contract, parameters, motion-off, host timing, and extension rules | Using, adding, or changing a motion |
| [examples/README.md](examples/README.md) | Storybook keys, reuse examples, host seam, and how to add stories | Using the storybook or showcase, adding a story, or changing a host |
