# Industrial OS

Industrial OS turns the [Pi](https://github.com/earendil-works/pi) coding agent and the [Herdr](https://github.com/herdrdev/herdr) terminal into an industrial-style control surface for managing agents. This monorepo holds everything that shapes that setup: the visual language, the user experience, and the tools built on them.

Its foundation is a terminal-only design system optimized for Herdr. **Acid / Black** is the default: black fields, acid-green emphasis, clear white readouts, and restrained instrument-like detail. Every element and demo renders as terminal-ready text with terminal-native styling: no HTML, CSS, canvas, image-based presentation, or browser-only effects. The repository holds polished, maintained work, not a collection of experiments.

## Status

The design system and the first Pi extension are here. Other Pi extensions and Herdr tooling that live in separate repositories are planned to move in; nothing below covers them.

The design system's status, run commands, and verification scope are in its [README](design-system/README.md); the Pi extensions' are in [theirs](pi/README.md).

## Layout

```text
industrial-os/
├── design-system/    terminal design system: elements, foundation, motions, examples, and their guides
├── pi/               Pi extensions, each its own Pi package, and their guides
├── docs/             repository-wide mission and engineering conventions
├── README.md         this overview
├── AGENTS.md         repository-wide agent rules and the map of every guide
├── CLAUDE.md         imports AGENTS.md
├── CONTRIBUTING.md   repository-wide workflow, routing to each package's contributing guide
└── .gitignore
```

Planned, not yet created: `herdr/` for Herdr configuration. It gets its folder and guides when its first maintained content moves in.

## Start here

- [Design system](design-system/README.md): status, run commands, and its guides.
- [Pi extensions](pi/README.md): status, installation, and their guides.
- [Mission](docs/mission.md): goals and scope.
- [Conventions](docs/conventions.md): repository-wide engineering rules.
- [Contributing](CONTRIBUTING.md): workflow, with links to each package's commands and checks.
- [Agent guide](AGENTS.md): task-specific engineering guidance.

## Licensing

A project license has not been selected. Public visibility alone does not grant a reuse license. The exception is [claude-interrupt](pi/claude-interrupt/README.md), which keeps the MIT license in its [LICENSE](pi/claude-interrupt/LICENSE) from before it moved here.
