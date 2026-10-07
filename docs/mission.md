# Mission

## Users and problem

Industrial OS is for people designing and building terminal interfaces optimized for Herdr. It gives them a coherent visual and interaction language without requiring them to recreate a different panel, gauge, or state convention for every screen.

The desired experience is an instrument that is clear and useful—not decoration pretending to be operational data.

## Goals and non-goals

### Goals

- Curate polished, reusable terminal elements, with Herdr as the primary target.
- Establish Acid / Black as the default visual direction.
- Deliver a reference kit first: clear specifications, useful specimens, and a terminal storybook that people and agents can browse, before committing to a general-purpose framework.
- Make element behavior, constraints, and supported terminal conditions explicit.
- Keep implementation choices small enough to evolve with real consumers.

An element is ready when it meets the acceptance criteria in [design](design.md), not merely when its screenshot looks finished.

### Non-goals

- Archiving explorations, source catalogs, recordings, private evidence, or historical artifact versions.
- Building a terminal emulator, operating system, application shell, or broad widget framework.
- Shipping browser-rendered elements or demos, including HTML, CSS, canvas, or image-based presentation.
- Installing integrations into users' applications as part of defining the system.

## Constraints

Terminal-only is a hard constraint, not a delivery priority. Every element and demo must be terminal-ready text, using terminal-native color/style and cell-based layout. No browser presentation layer or browser-only effect may be required.

Optimize and verify the system in Herdr. The tested version, terminal capabilities, and input behavior are bounded by the [native verification baseline](../CONTRIBUTING.md#native-verification-baseline); no performance baseline or universal compatibility is claimed. Other terminals are not the initial optimization target.

The repository is public. Include only material cleared for publication and preserve required third-party attribution. The native showcase and storybook use plain Node.js ES modules with no dependencies. They are the smallest working hosts for refining and browsing the elements and motions, not a framework or a published package. No open-source license, framework, or support matrix is selected yet.

Keep exploration outside this repository. Bring an element here once its design is settled enough to maintain as part of the system.
