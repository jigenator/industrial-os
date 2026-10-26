# Industrial OS design system

The terminal-only design system at the foundation of [Industrial OS](../README.md), optimized for Herdr, with **Acid / Black** as its default visual language.

## Status

Twenty-three elements are implemented: the first four (numbered panels, label plates, gauges, and status rows), nine modeled on the Pi extensions' UI (instrument frame, count plate, mode plate, state chip, lamp, pixel numeral, segment meter, thread rail, and transcript marker), and two modeled on herdr-sidebar's layout B (line meter and column block). Twenty-three reusable motions decorate their output, from scan, pulse, and reveal to the extensions' own state, attention, signal, meter, and glitch motions. A terminal storybook browses each element by state and each motion by example, with previews that autoplay at the motion's own rate, pause, replay, and a storybook-wide motion-off setting, and shows reference pages of the IndustrialOS colors and of status-bar's signal colors; a native showcase composes the first four elements on one screen. The foundation also provides pure gradient/dot/fill surface compositing and opt-in host-measured rich text slots. Lamp round poses and state-chip word forms reuse the existing elements. Everything uses plain Node.js 22 ES modules with no dependencies. It is also the private package `@industrial-os/design-system`, for in-repo projects: after the root `npm install` ([setup](../CONTRIBUTING.md#setup)), a project imports an exported subpath such as `@industrial-os/design-system/elements/label-plate`. Lunalee alone is authorised to consume public `industrial-os/design-system/...mjs` root-package paths from a full-SHA git dependency ([decision](../docs/decisions/in-repo-design-system-package.md#lunalee-pinned-public-git-consumption)); this does not change in-repo imports. It is never published, has no stable API, and both Pi extensions consume exported subpaths and import its colors through their own host adapters.

The showcase and an earlier storybook have bounded native checks in Herdr 0.9.3, alongside automated and isolated real-PTY checks. Most newer elements, motions, and stories have automated checks only; the DS-1 surface and new lamp/word forms additionally have bounded Herdr 0.9.5 injected-key readback checks ([record](CONTRIBUTING.md#lunalee-ds-1-foundation-verification-2026-10-27)). See the [showcase baseline](CONTRIBUTING.md#native-verification-baseline) and [storybook verification scope](CONTRIBUTING.md#storybook-verification-status); these are not universal terminal or accessibility certifications.

From this `design-system/` folder, in a terminal with 24-bit color:

```sh
node examples/storybook.mjs          # browse elements, motions, and colors; ? lists keys, q quits
node examples/showcase.mjs           # the first four elements on one screen; q quits
node examples/showcase.mjs --plain   # one plain-text snapshot
```

All element and motion values are labeled demonstration fixtures, and motion previews are labeled demonstration playback, not machine telemetry. Colors are labeled reference values. See [Contributing](CONTRIBUTING.md) for options and checks.

## Survey chrome

The Lunalee chrome families are [tab-rule](elements/tab-rule/README.md), [action-label](elements/action-label/README.md), [popup-header](elements/popup-header/README.md), [notice-row](elements/notice-row/README.md), [scope-meter](elements/scope-meter/README.md), [sounding-meter](elements/sounding-meter/README.md), [feed-bezel](elements/feed-bezel/README.md), [input-frame](elements/input-frame/README.md). Four additional pure motions are scope-trace, sounding-sweep, feed-scan and corner-snap. Existing motion extensions are opt-in; old consumer defaults stay unchanged.

## Start here

- [Design](../docs/design.md): the shared visual language and the bar for a polished element; [this project's design](docs/design.md): its elements, colors, motions, and storybook.
- [Mission](../docs/mission.md): goals and scope.
- [Architecture](docs/architecture.md): current contents, the package exports, element placement, and boundaries.
- [Conventions](../docs/conventions.md): repository-wide engineering rules; [this project's conventions](docs/conventions.md): its stack and rendering rules.
- Element contracts: [numbered panel](elements/numbered-panel/README.md), [instrument frame](elements/instrument-frame/README.md), [label plate](elements/label-plate/README.md), [count plate](elements/count-plate/README.md), [mode plate](elements/mode-plate/README.md), [state chip](elements/state-chip/README.md), [lamp](elements/lamp/README.md), [status row](elements/status-row/README.md), [gauge](elements/gauge/README.md), [pixel numeral](elements/pixel-numeral/README.md), [segment meter](elements/segment-meter/README.md), [thread rail](elements/thread-rail/README.md), [transcript marker](elements/transcript-marker/README.md), [line meter](elements/line-meter/README.md), [column block](elements/column-block/README.md), and their shared [foundation](foundation/README.md), which also holds the IndustrialOS colors, the signal colors, and seeded randomness.
- [Motions](motions/README.md): every motion, with parameters, presets, rates, and motion-off behavior.
- [Storybook and examples](examples/README.md): keys, reuse examples, and how to add a story.
- [Contributing](CONTRIBUTING.md): editing and verification.
- [Agent guide](AGENTS.md): design-system engineering guidance, supplementing the [root agent guide](../AGENTS.md).

Licensing is covered in the [root README](../README.md#licensing).
