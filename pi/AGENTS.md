# Pi agent guide

Purpose: Pi extensions that bring the Industrial OS visual and interaction language into the Pi coding agent. This guide supplements the [root agent guide](../AGENTS.md); follow both.

## Critical engineering rules

- Each extension is a standalone Pi package: its own folder, `package.json` with an explicit `pi` manifest, dependencies, checks, README, and license. Do not add a shared root package, workspace, or `node_modules` without a current need.
- Declare the packages Pi supplies to extensions (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, `@earendil-works/pi-ai`, `@earendil-works/pi-agent-core`, `typebox`) as `peerDependencies` with a `"*"` range, never as `dependencies`. Verify Pi APIs against the documentation and types of the Pi version in use; packaging rules are in Pi's `docs/packages.md`.
- Human-facing output follows the [design-system design](../design-system/docs/design.md): terminal text, Acid / Black palette roles, truthful values, and color or animation never the only carrier of meaning. Never block streaming, input, or focus.
- Report automated checks, Pi load checks, and interactive checks in Pi and Herdr as separate evidence. Do not claim interactive or Herdr behavior that has not been checked.

## Read for the task

Conventions are the repository-wide [conventions](../docs/conventions.md); contributing is [CONTRIBUTING.md](CONTRIBUTING.md).

| Task | Route |
| --- | --- |
| Change an extension's behavior | Its README, the design-system design if human-facing, conventions, then contributing |
| Change a Pi dependency or supported Pi version | The extension's README and `package.json`, conventions, then contributing |
| Move in or add an extension | This guide, conventions, contributing, then the root README layout and AGENTS map |

## Where work belongs

Each extension owns one folder, `pi/<name>/`, named without the `pi-` prefix; its package keeps its published name. It holds `src/`, its checks in `test/`, `README.md` with its behavior, limits, and compatibility, `package.json`, its lockfile, and `LICENSE` if it has one.

Extensions do not import design-system code yet. `claude-interrupt` repeats the Acid / Black values from [the palette](../design-system/foundation/palette.mjs) in its own source; keep them in step. Sharing code needs a decision on how an installed extension reaches the design system, which has no stable API.

## Implement and verify

Use the [Pi validation sequence](CONTRIBUTING.md#validation-sequence). Commands run from the extension's folder.
