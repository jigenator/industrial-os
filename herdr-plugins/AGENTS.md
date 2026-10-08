# Agent guide

Herdr plugin group. Follow the [root guide](../AGENTS.md) and the owning
plugin's guide; [Spaces](spaces/AGENTS.md) is the first maintained plugin.

## Shared rules

- Plain Node 22 ES modules and standard library only; no build or dependency
  installation. Each plugin owns its manifest and `node --test` checks.
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
