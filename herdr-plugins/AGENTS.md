# Agent guide

Herdr plugin group. Follow the [root guide](../AGENTS.md) and the owning
plugin's guide: [Spaces](spaces/AGENTS.md), [Whiteboard](whiteboard/AGENTS.md),
[Dispatch feed](dispatch-feed/AGENTS.md) or [Automations Monitor](automations-monitor/AGENTS.md).

## Shared rules

- Each plugin owns its runtime, manifest and checks. The default is plain
  Node 22 ES modules, standard library only, with no build. Another runtime
  declares its build in `[[build]]`, locks its dependencies and documents its
  toolchain, as the [runtime decision](../docs/decisions/herdr-plugin-runtimes.md)
  requires; `plugin link` builds nothing. The Automations Monitor's Bun and
  Effect stack is its own [decision](../docs/decisions/automations-monitor-stack.md).
- Colors are design-system values. A plugin that cannot import the package
  mirrors them in one file and checks them against it with a Node test.
- Visual components come from the design system, extended there first when
  one is missing or differs; a plugin that cannot import it mirrors the
  reference in one place. See [the rule](../docs/conventions.md#design-system-components).
- Tests use temporary state and fake Unix sockets, never live Herdr. Parser
  checks use `HERDR_CONFIG_PATH` on a worktree file or temporary copy.
- Startup/event hooks must return promptly: detach a daemon with no inherited
  stdio, unref it, and use an atomic, socket-keyed lock. Herdr waits for hook
  pipe EOF and limits in-flight commands to 32.
- Plugin state/config are global across named Herdr sessions: partition state
  by socket identity. No resource labels, paths, context payloads or secrets
  in logs. Bound diagnostics, requests, retries and shutdown.
- Do not import another project's source. Cross-project values travel through
  documented host protocols, not relative imports.

## Routes

Read the plugin's README, AGENTS, CONTRIBUTING and applicable architecture,
conventions, design, mission and token contract before changing its surface.
Installation belongs to an explicitly authorized operator, not a test suite.
