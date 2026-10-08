# Mission

## Users and problem

People running several Pi agents in Herdr watch them from Herdr's agents sidebar. By default it shows each agent's name and state, which says little about which project an agent works in, how much context it has left, whether it waits for an answer, or what it is doing. Switching to each pane to find out costs attention.

Pi Herdr Sidebar puts that state into the sidebar for each Pi pane, in the shared Acid / Black language, without collecting anything itself.

## Goals and non-goals

Goals:

- Show, per Pi pane, the agent state, the Herdr SPACE name and Active branch/directory, the open pull request, active units, the context used, the compaction count, the model and thinking level, the goal time, and what the agent is doing or asking now, as fixed in the [token contract](token-contract.md).
- Stay truthful: unknown values look unknown, never zero, clean or absent.
- Mark a pending question as Herdr's blocked state, so Herdr's attention and wait features see it.
- Never block or slow Pi, and leave nothing behind when Pi exits.

Non-goals:

- Collecting data: Git, GitHub, CodexBar and session history belong to the signals-collector.
- Rendering: the rows, colors and width are Herdr configuration in [herdr/](../../../herdr/README.md).
- Showing agents other than Pi, or changing Herdr's agent state beyond the blocked question wait.
- Settings, commands or interaction of its own.

## Constraints

- Inputs are only the signals-collector snapshot on Pi's event bus and Herdr's own agent status and SPACE label for the pane.
- Reports only from Pi's interactive TUI mode inside a Herdr pane; subagent children and non-interactive runs stay silent.
- Herdr's limits hold: 32 tokens per pane, 16 per request, 80 characters per value, and a 24-cell text area in a 36-column sidebar.
- Runtime dependencies are Node's standard library and Pi's host peers.
