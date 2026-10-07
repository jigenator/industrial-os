# Pi agent guide

Purpose: the Pi extensions that bring the Industrial OS visual and interaction language into the Pi coding agent. Each extension under `pi/` is its own project with its own guides; this guide holds only what every extension shares and supplements the [root guide](../AGENTS.md).

## Critical engineering rules

- Each extension is a standalone Pi package: its own folder, `package.json` with an explicit `pi` manifest, dependencies, lockfile, checks, guides, and license. No shared root package, workspace, or `node_modules`; see [the decision](../docs/decisions/standalone-packages.md).
- Declare the packages Pi supplies to extensions (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, `@earendil-works/pi-ai`, `@earendil-works/pi-agent-core`, `typebox`) as `peerDependencies` with a `"*"` range, never as `dependencies`. Verify Pi APIs against the documentation and types of the Pi version in use; packaging rules are in Pi's `docs/packages.md`.
- Human-facing output follows the [design](../docs/design.md): terminal text, Acid / Black roles, truthful values, and color or animation never the only carrier of meaning. Never block streaming, input, or focus.
- The extensions are the authority for palette values; declare them as named constants in one place per extension. The design system follows; see [the decision](../docs/decisions/extension-colors-take-precedence.md).
- Report automated checks, the Pi load check, and interactive checks in Pi and Herdr as separate evidence. Do not claim interactive or Herdr behavior that has not been checked.

## Read for the task

| Task | Route |
| --- | --- |
| Change an extension | Its `AGENTS.md` and its routes, for example [claude-interrupt](claude-interrupt/AGENTS.md) |
| Change a Pi dependency or supported Pi version | The extension's architecture and `package.json`, the rules above, then its contributing guide |
| Add or move in an extension | [Contributing](CONTRIBUTING.md), the [project document set](../docs/architecture.md#contracts-between-the-root-and-a-project), then the root README layout and map |

## Where work belongs

Each extension owns `pi/<name>/`, named without the `pi-` prefix; its package keeps its published name. It holds `src/`, its checks in `test/`, its manifest and lockfile, `LICENSE` if it has one, `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, and `docs/` with its architecture, and its conventions, mission, and design where it has rules, scope, or an experience of its own.

Extensions do not import design-system code or each other. Sharing code needs a packaging decision; see [architecture](../docs/architecture.md#evolution-and-known-limits).

## Implement and verify

Use the extension's own validation sequence, then the [repository-wide checks](../CONTRIBUTING.md#repository-wide-checks). Commands run from the extension's folder.
