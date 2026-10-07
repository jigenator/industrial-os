# Agent guide

Purpose: build the monorepo for Pi and Herdr visualization, user experience, and tooling, starting with its curated, terminal-only design system optimized for Herdr. Product scope lives in [the mission](docs/mission.md).

This guide holds the rules for the whole repository. Each package has a scoped guide that supplements it; follow both when working inside a package.

## Critical engineering rules

- Do not copy third-party assets or code without checking rights and retaining required notices. Do not publish private paths, data, credentials, or internal artifact links. See [conventions](docs/conventions.md).
- Do not invent an installed framework, package, released API, or runtime/Herdr check that has not run. Claim only what the stated checks support. See [conventions](docs/conventions.md).
- Trace existing callers before changing shared behavior, and keep each rule, command, and value in one canonical place. See [conventions](docs/conventions.md).

## Read for the task

Scan the supporting-document map and read every document whose condition applies before changing that area. Follow relevant sections and any scoped instructions; do not load unrelated manuals.

| Task | Route |
| --- | --- |
| Work in the design system | [The design-system agent guide](design-system/AGENTS.md) and its routes |
| Change product scope or the default visual language | Mission and the design-system design |
| Change a repository-wide engineering rule | Conventions, this map, then contributing |
| Change guidance or validation | The relevant canonical guide, this map, then contributing |

## Where work belongs

Canonical rules belong in the guides below. Repository-wide guidance lives at the root and in `docs/`; package-specific guidance lives in its package.

- `design-system/`: the terminal design system—elements, foundation, motions, and examples—with its scoped guide, design, architecture, and contributing guide. Its placement rules are in [its agent guide](design-system/AGENTS.md#where-work-belongs).
- `pi/` (planned): Pi extensions and Pi configuration.
- `herdr/` (planned): Herdr configuration.

The planned folders do not exist yet. Their rules, placement, and checks get written when their first maintained content moves in. Do not create empty packages or speculative adapters.

## Implement and verify

Follow the engineering conventions rather than reproducing a conflicting pattern. Use the validation sequence in the changed package's contributing guide, routed from [CONTRIBUTING.md](CONTRIBUTING.md), and report passed, failed, skipped, and not-run checks separately.

## Supporting documents

Keep one direct link, purpose, and concrete reading condition for every supporting guidance document in the repository, including package guides, future element specifications, scoped instructions, and decisions. Add rows when documents are added.

| Document | Purpose | Read when |
| --- | --- | --- |
| [README.md](README.md) | Monorepo overview, layout, and licensing | Changing public usage, onboarding, or the repository layout |
| [CLAUDE.md](CLAUDE.md) | Runtime import of this guide | Checking agent entry points |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Repository-wide workflow and routes to package validation | Making or verifying any change |
| [docs/mission.md](docs/mission.md) | Product scope and constraints | Choosing features or changing scope |
| [docs/conventions.md](docs/conventions.md) | Repository-wide engineering rules | Writing or reviewing code and technical guidance |
| [design-system/README.md](design-system/README.md) | Design-system orientation, run commands, and status | Using the design system or changing its onboarding |
| [design-system/AGENTS.md](design-system/AGENTS.md) | Design-system rules, task routes, and placement | Working anywhere in `design-system/` |
| [design-system/CLAUDE.md](design-system/CLAUDE.md) | Runtime import of the design-system guide | Checking agent entry points |
| [design-system/CONTRIBUTING.md](design-system/CONTRIBUTING.md) | Design-system setup, commands, validation, and verification records | Making or verifying a design-system change |
| [design-system/docs/architecture.md](design-system/docs/architecture.md) | Design-system placement, boundaries, engineering rules, and evolution | Adding elements or changing design-system dependencies/contracts |
| [design-system/docs/design.md](design-system/docs/design.md) | Visual language, interactions, and acceptance | Changing anything human-facing |
| [design-system/foundation/README.md](design-system/foundation/README.md) | Line model, text/glyph contract, palette source, color output | Changing shared rendering, text handling, glyphs, or colors |
| [design-system/elements/label-plate/README.md](design-system/elements/label-plate/README.md) | Label plate contract | Using or changing label plates |
| [design-system/elements/numbered-panel/README.md](design-system/elements/numbered-panel/README.md) | Numbered panel contract | Using or changing panels |
| [design-system/elements/gauge/README.md](design-system/elements/gauge/README.md) | Gauge contract and truthfulness rules | Using or changing gauges |
| [design-system/elements/status-row/README.md](design-system/elements/status-row/README.md) | Status row contract and states | Using or changing status rows |
| [design-system/motions/README.md](design-system/motions/README.md) | Motion contract, parameters, motion-off, host timing, and extension rules | Using, adding, or changing a motion |
| [design-system/examples/README.md](design-system/examples/README.md) | Storybook keys, reuse examples, host seam, and how to add stories | Using the storybook or showcase, adding a story, or changing a host |
