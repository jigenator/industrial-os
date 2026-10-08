# Industrial OS

Industrial OS turns the [Pi](https://github.com/earendil-works/pi) coding agent and the [Herdr](https://github.com/herdrdev/herdr) terminal into an industrial-style control surface for managing agents. This monorepo holds everything that shapes that setup: the visual language, the user experience, and the tools built on them.

**Acid / Black** is the default: black fields, acid-green emphasis, clear white readouts, and restrained instrument-like detail. Every element and demo renders as terminal-ready text with terminal-native styling: no HTML, CSS, canvas, image-based presentation, or browser-only effects. The repository holds polished, maintained work, not a collection of experiments.

## Status

Three projects are here. They share code only through the private design-system package, which both Pi extensions import by name: claude-interrupt for its transcript marker, and status-bar for its footer elements:

- [design-system](design-system/README.md): the terminal design system, a reference kit of elements, motions, a storybook, and a showcase. Plain Node.js, no dependencies. It is the private package `@industrial-os/design-system`, which the repository's projects can import by name; it is never published.
- [pi/claude-interrupt](pi/claude-interrupt/README.md): a Pi extension that aborts the current response on Esc and continues with your queued text, marking the continuation with an animated plate.
- [pi/status-bar](pi/status-bar/README.md): a Pi extension that replaces the footer with a framed Acid / Black instrument panel showing the agent-reported active project, where Pi's tools run, context use, model, and other extensions' statuses. It is the first implementation of the style.

Herdr tooling still lives in separate repositories and is planned to move in.

## Layout

Each top-level folder, and each folder under `pi/`, is its own project with its own language, toolchain, checks, and guides. The root holds only what they share.

```text
industrial-os/
├── design-system/            terminal design system and its guides
├── pi/                       Pi extensions, each its own project
│   ├── claude-interrupt/     interrupt-and-continue with the DIRECTIVE UPDATED marker
│   └── status-bar/           the Acid / Black footer for the agent-reported active project
├── docs/
│   ├── mission.md            product scope and constraints
│   ├── design.md             the shared visual and interaction language
│   ├── conventions.md        repository-wide engineering rules
│   ├── architecture.md       project map, dependency direction, where new projects go
│   └── decisions/            consequential choices and why
├── README.md                 this overview
├── AGENTS.md                 repository-wide agent rules and the map of every guide
├── CLAUDE.md                 imports AGENTS.md
├── CONTRIBUTING.md           workflow, repository-wide checks, adding a project
├── package.json              lists the Pi extensions for Pi's git install and links the design-system package
├── package-lock.json         npm's lockfile for that manifest
└── .gitignore
```

Planned, not yet created: `herdr/` for Herdr configuration. It gets its folder and guides when its first maintained content moves in.

In a checkout, run `npm install` once at the root to link the design-system package into `node_modules/`; see [contributing](CONTRIBUTING.md#setup).

## Start here

- [Design system](design-system/README.md) and [Pi extensions](pi/README.md): status, run or install commands, and their guides.
- [Mission](docs/mission.md): goals and scope.
- [Design](docs/design.md): the visual language every project follows.
- [Architecture](docs/architecture.md): how the projects relate and where the next one goes.
- [Conventions](docs/conventions.md): repository-wide engineering rules.
- [Contributing](CONTRIBUTING.md): workflow, with links to each project's commands and checks.
- [Agent guide](AGENTS.md): task-specific engineering guidance.

## Licensing

A project license has not been selected. Public visibility alone does not grant a reuse license. The exception is [claude-interrupt](pi/claude-interrupt/README.md), which keeps the MIT license in its [LICENSE](pi/claude-interrupt/LICENSE) from before it moved here. [status-bar](pi/status-bar/README.md) had no license before it moved here and has none now.
