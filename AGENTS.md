# Agent guide

Purpose: the monorepo for Pi and Herdr visualization, user experience, and tooling, built on one terminal-only visual language. Product scope is in [the mission](docs/mission.md).

This guide holds the rules for the whole repository. Each project is its own project with its own guides; follow the root guides and the project's guides together.

## Critical engineering rules

- No project imports another project's code, and a Pi extension must load from its own folder with the host's peer packages only. Full rule: [conventions](docs/conventions.md#module-and-dependency-rules). Check: review imports; no automated check.
- The Pi extensions are the authority for palette values; the design system mirrors them. Full rule: [decision](docs/decisions/extension-colors-take-precedence.md). Check: review comparison of the extension constants against `design-system/foundation/palette.mjs`.
- Claim only what the stated checks support. Do not invent an installed package, released API, or Herdr check that has not run; keep automated, Pi-load, and interactive evidence separate. Full rule: [conventions](docs/conventions.md#tests).
- Do not publish private paths, data, credentials, or copied assets without rights and notices. Full rule: [conventions](docs/conventions.md#dependencies-and-generated-output).
- Keep each rule, command, and value in one canonical place and trace callers before changing shared behavior. Full rule: [conventions](docs/conventions.md#engineering-principles).

## Read for the task

Scan the supporting-documents map and read every document whose condition applies before changing that area. Follow the project's guide for its routes; do not load the other project's manuals.

| Task | Route |
| --- | --- |
| Work in the design system | [The design-system guide](design-system/AGENTS.md) and its routes |
| Work on a Pi extension | [The Pi guide](pi/AGENTS.md), then the extension's own guide, for example [claude-interrupt](pi/claude-interrupt/AGENTS.md) |
| Change the visual language or a palette value | [Design](docs/design.md), [the color decision](docs/decisions/extension-colors-take-precedence.md), then each affected project's guide |
| Add or move in a project | [Architecture](docs/architecture.md#where-the-next-change-belongs), [contributing](CONTRIBUTING.md#adding-or-moving-in-a-project), then this map |
| Change a repository-wide rule or check | [Conventions](docs/conventions.md), this map, then [contributing](CONTRIBUTING.md) |

## Where work belongs

| Change | Start here | Boundary |
| --- | --- | --- |
| An element, motion, storybook story, or terminal host | `design-system/`; placement in [its architecture](design-system/docs/architecture.md#where-the-next-change-belongs), rules in [its conventions](design-system/docs/conventions.md) | Standard library only; elements and motions never own I/O |
| claude-interrupt behavior or marker | `pi/claude-interrupt/`; placement in [its architecture](pi/claude-interrupt/docs/architecture.md) | Pi peer packages only; never block streaming, input, or focus |
| A new Pi extension | `pi/<name>/` with the [project document set](docs/architecture.md#contracts-between-the-root-and-a-project) | Its own manifest, checks, and license |
| Shared experience or scope | `docs/design.md`, `docs/mission.md` | Then each project separately |
| Herdr configuration | Planned `herdr/`; nothing exists | Do not create it before maintained content exists |

## Implement and verify

Follow the engineering conventions rather than reproducing a conflicting pattern. Use the validation sequence in the changed project's contributing guide, then the [repository-wide checks](CONTRIBUTING.md#repository-wide-checks). Report passed, failed, skipped, and not-run checks separately.

## Supporting documents

Every supporting guidance document is listed here with a direct link, purpose, and reading condition. Keep this map current when guidance is added, moved, or removed.

| Document | Purpose | Read when |
| --- | --- | --- |
| [README.md](README.md) | Monorepo overview, layout, and licensing | Changing public usage, onboarding, or the layout |
| [CLAUDE.md](CLAUDE.md) | Runtime import of this guide | Checking agent entry points |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Workflow, repository-wide checks, and adding a project | Making or verifying any change |
| [docs/mission.md](docs/mission.md) | Product scope and constraints | Choosing features or changing scope |
| [docs/design.md](docs/design.md) | The shared visual and interaction language, states, and acceptance | Changing anything human-facing in any project |
| [docs/conventions.md](docs/conventions.md) | Repository-wide engineering rules and adoption gaps | Writing or reviewing code or technical guidance |
| [docs/architecture.md](docs/architecture.md) | Project map, dependency direction, project contracts, and where new projects go | Adding a project, changing what a project depends on, or tracing a cross-project change |
| [docs/decisions/standalone-packages.md](docs/decisions/standalone-packages.md) | Why there is no root manifest, workspace, or repository command | Proposing a root toolchain or CI |
| [docs/decisions/extension-colors-take-precedence.md](docs/decisions/extension-colors-take-precedence.md) | Why the extensions own palette values and the design system follows | Changing a color anywhere |
| [design-system/README.md](design-system/README.md) | Design-system orientation, run commands, and status | Using the design system or changing its onboarding |
| [design-system/AGENTS.md](design-system/AGENTS.md) | Design-system rules, task routes, and placement | Working anywhere in `design-system/` |
| [design-system/CLAUDE.md](design-system/CLAUDE.md) | Runtime import of the design-system guide | Checking agent entry points |
| [design-system/CONTRIBUTING.md](design-system/CONTRIBUTING.md) | Design-system setup, commands, validation, and verification records | Making or verifying a design-system change |
| [design-system/docs/architecture.md](design-system/docs/architecture.md) | Design-system modules, boundaries, and evolution | Adding elements or changing design-system dependencies or contracts |
| [design-system/docs/conventions.md](design-system/docs/conventions.md) | Design-system stack, text contract, palette mirror, and performance rules | Writing or reviewing design-system code |
| [design-system/docs/design.md](design-system/docs/design.md) | The design system's element set, reference colors, motions, and storybook | Changing anything human-facing in the design system |
| [design-system/foundation/README.md](design-system/foundation/README.md) | Line model, text/glyph contract, palette mirror, color output | Changing shared rendering, text handling, glyphs, or colors |
| [design-system/elements/label-plate/README.md](design-system/elements/label-plate/README.md) | Label plate contract | Using or changing label plates |
| [design-system/elements/numbered-panel/README.md](design-system/elements/numbered-panel/README.md) | Numbered panel contract | Using or changing panels |
| [design-system/elements/gauge/README.md](design-system/elements/gauge/README.md) | Gauge contract and truthfulness rules | Using or changing gauges |
| [design-system/elements/status-row/README.md](design-system/elements/status-row/README.md) | Status row contract and states | Using or changing status rows |
| [design-system/motions/README.md](design-system/motions/README.md) | Motion contract, parameters, motion-off, host timing, and extension rules | Using, adding, or changing a motion |
| [design-system/examples/README.md](design-system/examples/README.md) | Storybook keys, reuse examples, host seam, and how to add stories | Using the storybook or showcase, adding a story, or changing a host |
| [pi/README.md](pi/README.md) | Pi extensions index and status | Using the Pi extensions or adding one |
| [pi/AGENTS.md](pi/AGENTS.md) | Rules every Pi extension shares and the required project set | Working anywhere in `pi/` |
| [pi/CLAUDE.md](pi/CLAUDE.md) | Runtime import of the Pi guide | Checking agent entry points |
| [pi/CONTRIBUTING.md](pi/CONTRIBUTING.md) | Shared Pi toolchain facts and how to move an extension in | Adding or moving in a Pi extension |
| [pi/claude-interrupt/README.md](pi/claude-interrupt/README.md) | claude-interrupt purpose, install, limits, and compatibility | Using claude-interrupt |
| [pi/claude-interrupt/AGENTS.md](pi/claude-interrupt/AGENTS.md) | claude-interrupt rules, routes, and placement | Working anywhere in `pi/claude-interrupt/` |
| [pi/claude-interrupt/CLAUDE.md](pi/claude-interrupt/CLAUDE.md) | Runtime import of the claude-interrupt guide | Checking agent entry points |
| [pi/claude-interrupt/CONTRIBUTING.md](pi/claude-interrupt/CONTRIBUTING.md) | claude-interrupt setup, checks, validation sequence, and verification records | Making or verifying a claude-interrupt change |
| [pi/claude-interrupt/docs/architecture.md](pi/claude-interrupt/docs/architecture.md) | claude-interrupt modules, interrupt and marker flows, invariants, and limits | Changing claude-interrupt behavior or its Pi dependencies |
| [pi/claude-interrupt/docs/conventions.md](pi/claude-interrupt/docs/conventions.md) | claude-interrupt's TypeScript and Pi-extension rules | Writing or reviewing claude-interrupt code |
| [pi/claude-interrupt/docs/mission.md](pi/claude-interrupt/docs/mission.md) | claude-interrupt intent, goals, and non-goals | Choosing or changing what claude-interrupt does |
| [pi/claude-interrupt/docs/design.md](pi/claude-interrupt/docs/design.md) | The interrupt experience and the exact marker specification | Changing anything a claude-interrupt user sees |
