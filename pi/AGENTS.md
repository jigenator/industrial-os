# Pi agent guide

Purpose: the Pi extensions that bring the Industrial OS visual and interaction language into the Pi coding agent. Each extension under `pi/` is its own project with its own guides; this guide holds only what every extension shares and supplements the [root guide](../AGENTS.md).

## Critical engineering rules

- Each extension is a standalone Pi package: its own folder, `package.json` with an explicit `pi` manifest, dependencies, lockfile, checks, guides, and license. No shared workspace; root runtime dependencies are limited to the design-system link and the named [pi-typesafe exception](../docs/decisions/pane-naming-root-dependency.md). The root `package.json` lists each extension's entry point so Pi can install from git, and a new extension adds its entry there; its `file:` dependency links the design system, and `pi-typesafe` supplies pane naming at runtime because Pi installs only clone-root dependencies. Root `.npmrc` suppresses peer installation so the host remains the sole Pi/typebox owner. See [standalone packages](../docs/decisions/standalone-packages.md) and [the package decision](../docs/decisions/in-repo-design-system-package.md).
- Declare the packages Pi supplies to extensions (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, `@earendil-works/pi-ai`, `@earendil-works/pi-agent-core`, `typebox`) as `peerDependencies` with a `"*"` range, never as `dependencies`. Verify Pi APIs against the documentation and types of the Pi version in use; packaging rules are in Pi's `docs/packages.md`.
- Human-facing output follows the [design](../docs/design.md): terminal text, Acid / Black roles, truthful values, and color or animation never the only carrier of meaning. Never block streaming, input, or focus.
- Visual components come from the design system; a missing or different one is added or extended there first. See [the rule](../docs/conventions.md#design-system-components).
- The design system owns color values. Until an extension imports them from the package, it declares them as named constants in one place, and they must match the design system's values. Change the design system first, then the extension; see [the decision](../docs/decisions/in-repo-design-system-package.md).
- Report automated checks, the Pi load check, and interactive checks in Pi and Herdr as separate evidence. Do not claim interactive or Herdr behavior that has not been checked.

## Read for the task

| Task | Route |
| --- | --- |
| Change an extension | Its `AGENTS.md` and its routes, for example [claude-interrupt](claude-interrupt/AGENTS.md) or [signals-collector](signals-collector/AGENTS.md) |
| Change a Pi dependency or supported Pi version | The extension's architecture and `package.json`, the rules above, then its contributing guide |
| Import the design system into an extension | [Where work belongs](#where-work-belongs), [the package decision](../docs/decisions/in-repo-design-system-package.md#migrating-an-extension), then the extension's architecture and contributing guide |
| Add or move in an extension | [Contributing](CONTRIBUTING.md), the [project document set](../docs/architecture.md#contracts-between-the-root-and-a-project), then the root README layout and map |

## Where work belongs

Each extension owns `pi/<name>/`, named without the `pi-` prefix; its package keeps its published name. It holds `src/`, its checks in `test/`, its manifest and lockfile, `LICENSE` if it has one, `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, and `docs/` with its architecture, and its conventions, mission, and design where it has rules, scope, or an experience of its own.

`pi/settings.json` is the recommended Pi settings fragment, checked by `pi/settings.test.mjs` and documented in [recommended settings](README.md#recommended-settings). It is the one place for those setting values. A new extension adds its entry point there and to the root `package.json`.

`pi/theme/` is a theme package, not an extension: one JSON file listed in the root `pi.themes`, with the same document set, checks and guides; the peer rules above do not apply because it has no code Pi runs.

Extensions never import each other. An extension may import the design system only as `@industrial-os/design-system/<group>/<name>`, an exported subpath resolved through the root install, never by a relative path into `design-system/`; the full rule is in [conventions](../docs/conventions.md#module-and-dependency-rules). The rendering extensions, claude-interrupt, status-bar and droid-header, import it through exported subpaths and host adapters; signals-collector and herdr-sidebar render no colors and do not import it. herdr-pane-naming, session-recap and image-preview also do not import it; their documented visual adoption gaps remain unchanged. A new migration is its own change, with the requirements in [the decision](../docs/decisions/in-repo-design-system-package.md#migrating-an-extension).

## Implement and verify

Use the extension's own validation sequence, then the [repository-wide checks](../CONTRIBUTING.md#repository-wide-checks). Commands run from the extension's folder.
