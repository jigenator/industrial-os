# Industrial OS

A terminal-only design system for precise, industrial interfaces, optimized for Herdr. **Acid / Black** is the default: black fields, acid-green emphasis, clear white readouts, and restrained instrument-like detail.

This repository holds polished, reusable elements—not a collection of experiments. Every element and demo renders as terminal-ready text with terminal-native styling: no HTML, CSS, canvas, image-based presentation, or browser-only effects.

## Status

The four selected elements are implemented: numbered panels, label plates, gauges, and status rows. Three reusable motions decorate their output: scan, pulse, and reveal. A terminal storybook browses each element by state and each motion by example, with play, pause, and replay, and shows a reference page of IndustrialOS colors with derived shade ramps; a native showcase composes all four elements on one screen. Everything uses plain Node.js 22 ES modules with no dependencies. Nothing is released yet: there is no package, installation command, or stable API.

The showcase and storybook have bounded native checks in Herdr 0.9.3, alongside automated and isolated real-PTY checks. See the [showcase baseline](CONTRIBUTING.md#native-verification-baseline) and [storybook verification scope](CONTRIBUTING.md#storybook-verification-status); these are not universal terminal or accessibility certifications.

From the repository root, in a terminal with 24-bit color:

```sh
node examples/storybook.mjs          # browse elements, motions, and colors; ? lists keys, q quits
node examples/showcase.mjs           # all four elements on one screen; q quits
node examples/showcase.mjs --plain   # one plain-text snapshot
```

All element and motion values are labeled demonstration fixtures, and motion previews are labeled demonstration playback, not machine telemetry. Colors are labeled reference values. See [Contributing](CONTRIBUTING.md) for options and checks.

## Start here

- [Design](docs/design.md): visual language, interaction rules, and the bar for a polished element.
- [Mission](docs/mission.md): goals and scope.
- [Architecture](docs/architecture.md): current contents, element placement, and boundaries.
- Element contracts: [label plate](elements/label-plate/README.md), [numbered panel](elements/numbered-panel/README.md), [gauge](elements/gauge/README.md), [status row](elements/status-row/README.md), and their shared [foundation](foundation/README.md), which also holds the IndustrialOS colors.
- [Motions](motions/README.md): scan, pulse, and reveal, with parameters and motion-off behavior.
- [Storybook and examples](examples/README.md): keys, reuse examples, and how to add a story.
- [Contributing](CONTRIBUTING.md): editing and verification.
- [Agent guide](AGENTS.md): task-specific engineering guidance.

## Licensing

A project license has not been selected. Public visibility alone does not grant a reuse license.
