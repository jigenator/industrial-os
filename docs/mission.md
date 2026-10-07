# Mission

## Users and problem

Industrial OS is for people designing and building native terminal interfaces. It gives them a coherent visual and interaction language without requiring them to recreate a different panel, gauge, or state convention for every screen.

The desired experience is an instrument that is clear and useful—not decoration pretending to be operational data.

## Goals and non-goals

### Goals

- Curate polished, reusable terminal elements.
- Establish Acid / Black as the default visual direction.
- Deliver a reference kit first: clear specifications and useful specimens before committing to a general-purpose framework.
- Make element behavior, constraints, and supported terminal conditions explicit.
- Keep implementation choices small enough to evolve with real consumers.

An element is ready when it meets the acceptance criteria in [design](design.md), not merely when its screenshot looks finished.

### Non-goals

- Archiving explorations, source catalogs, recordings, private evidence, or historical artifact versions.
- Building a terminal emulator, operating system, application shell, or broad widget framework.
- Shipping a web component library in the first release.
- Installing integrations into users' applications as part of defining the system.

## Constraints

Native terminals come first. Browser illustrations can explain a design but cannot establish native interaction support.

The repository is public. Include only material cleared for publication and preserve required third-party attribution. No open-source license, implementation language, framework, or support matrix is selected yet.

Keep exploration outside this repository. Bring an element here once its design is settled enough to maintain as part of the system.
