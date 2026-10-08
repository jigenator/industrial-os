# Industrial OS design system

The terminal-only design system at the foundation of [Industrial OS](../README.md), optimized for Herdr, with **Acid / Black** as its default visual language.

## Status

Thirteen elements are implemented: the first four (numbered panels, label plates, gauges, and status rows), and nine modeled on the Pi extensions' UI (instrument frame, count plate, mode plate, state chip, lamp, pixel numeral, segment meter, thread rail, and transcript marker). Nineteen reusable motions decorate their output, from scan, pulse, and reveal to the extensions' own state, attention, signal, meter, and glitch motions. A terminal storybook browses each element by state and each motion by example, with previews that autoplay at the motion's own rate, pause, replay, and a storybook-wide motion-off setting, and shows reference pages of the IndustrialOS colors and of status-bar's signal colors; a native showcase composes the first four elements on one screen. Everything uses plain Node.js 22 ES modules with no dependencies. It is also the private package `@industrial-os/design-system`, for this repository's projects only: after the root `npm install` ([setup](../CONTRIBUTING.md#setup)), a project imports an exported subpath such as `@industrial-os/design-system/elements/label-plate`. It is never published, has no stable API, and both Pi extensions consume exported subpaths and import its colors through their own host adapters.

The showcase and an earlier storybook have bounded native checks in Herdr 0.9.3, alongside automated and isolated real-PTY checks. The newer elements, motions, and stories have automated checks only. See the [showcase baseline](CONTRIBUTING.md#native-verification-baseline) and [storybook verification scope](CONTRIBUTING.md#storybook-verification-status); these are not universal terminal or accessibility certifications.

From this `design-system/` folder, in a terminal with 24-bit color:

```sh
node examples/storybook.mjs          # browse elements, motions, and colors; ? lists keys, q quits
node examples/showcase.mjs           # the first four elements on one screen; q quits
node examples/showcase.mjs --plain   # one plain-text snapshot
```

All element and motion values are labeled demonstration fixtures, and motion previews are labeled demonstration playback, not machine telemetry. Colors are labeled reference values. See [Contributing](CONTRIBUTING.md) for options and checks.

## Start here

- [Design](../docs/design.md): the shared visual language and the bar for a polished element; [this project's design](docs/design.md): its elements, colors, motions, and storybook.
- [Mission](../docs/mission.md): goals and scope.
- [Architecture](docs/architecture.md): current contents, the package exports, element placement, and boundaries.
- [Conventions](../docs/conventions.md): repository-wide engineering rules; [this project's conventions](docs/conventions.md): its stack and rendering rules.
- Element contracts: [numbered panel](elements/numbered-panel/README.md), [instrument frame](elements/instrument-frame/README.md), [label plate](elements/label-plate/README.md), [count plate](elements/count-plate/README.md), [mode plate](elements/mode-plate/README.md), [state chip](elements/state-chip/README.md), [lamp](elements/lamp/README.md), [status row](elements/status-row/README.md), [gauge](elements/gauge/README.md), [pixel numeral](elements/pixel-numeral/README.md), [segment meter](elements/segment-meter/README.md), [thread rail](elements/thread-rail/README.md), [transcript marker](elements/transcript-marker/README.md), and their shared [foundation](foundation/README.md), which also holds the IndustrialOS colors, the signal colors, and seeded randomness.
- [Motions](motions/README.md): every motion, with parameters, presets, rates, and motion-off behavior.
- [Storybook and examples](examples/README.md): keys, reuse examples, and how to add a story.
- [Contributing](CONTRIBUTING.md): editing and verification.
- [Agent guide](AGENTS.md): design-system engineering guidance, supplementing the [root agent guide](../AGENTS.md).

Licensing is covered in the [root README](../README.md#licensing).
