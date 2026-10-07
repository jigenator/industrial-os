# Mission

## Users and problem

Industrial OS is for people who run coding agents with Pi inside Herdr. It turns that workspace into an industrial-style control surface for managing agents, with one coherent visual and interaction language across the design system, Pi extensions, and Herdr tooling, instead of a different panel, gauge, or state convention in every tool.

The repository is a monorepo for that work. Each project in it is its own project with its own language, toolchain, checks, and guides; the root holds only what they share. The terminal design system is the reference kit. The first Pi extension has moved in; pi-status-bar, the first implementation of the style, and Herdr packages maintained in separate repositories are planned to follow.

The desired experience is an instrument that is clear and useful—not decoration pretending to be operational data.

## Goals and non-goals

### Goals

- Keep Pi and Herdr visualization, user experience, and tooling in one repository, built on the shared design system.
- Curate polished, reusable terminal elements, with Herdr as the primary target.
- Establish Acid / Black as the default visual direction.
- Deliver a reference kit first: clear specifications, useful specimens, and a terminal storybook that people and agents can browse, before committing to a general-purpose framework.
- Make element behavior, constraints, and supported terminal conditions explicit.
- Keep implementation choices small enough to evolve with real consumers.

An element is ready when it meets the acceptance criteria in [design](design.md#polished-element-acceptance), not merely when its screenshot looks finished.

### Non-goals

- Archiving explorations, source catalogs, recordings, private evidence, or historical artifact versions.
- Building a terminal emulator, a general-purpose operating system, or a broad widget framework. "OS" names the agent control surface built on Pi and Herdr.
- Shipping browser-rendered elements or demos, including HTML, CSS, canvas, or image-based presentation.

## Constraints

Terminal-only is a hard constraint, not a delivery priority. Every element and demo must be terminal-ready text, using terminal-native color/style and cell-based layout. No browser presentation layer or browser-only effect may be required.

Optimize and verify the system in Herdr. The tested version, terminal capabilities, and input behavior are bounded by the [native verification baseline](../design-system/CONTRIBUTING.md#native-verification-baseline); no performance baseline or universal compatibility is claimed. Other terminals are not the initial optimization target.

The repository is public. Include only material cleared for publication and preserve required third-party attribution. The native showcase and storybook use plain Node.js ES modules with no dependencies. They are the smallest working hosts for refining and browsing the elements and motions, not a framework or a published package. Projects may use different languages and toolchains; each owns its own, and nothing at the root presumes one. Their placement and the document set each must provide are in [architecture](architecture.md). Pi extensions' shared rules are in the [Pi guide](../pi/AGENTS.md). No project-wide open-source license, framework, or support matrix is selected yet; `pi/claude-interrupt` keeps its own MIT license.

Keep exploration outside this repository. Bring an element here once its design is settled enough to maintain as part of the system.
