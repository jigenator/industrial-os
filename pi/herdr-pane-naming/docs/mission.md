# Mission

## Users and problem

People running several Pi sessions in Herdr need pane names that describe the work now, without making the main model spend attention on naming housekeeping. This extension updates its own inherited pane from delivered user requests and visible assistant progress.

## Goals and non-goals

Goals:

- Keep the real pane label useful as a task or work phase changes.
- Use a small Jev judgment before paying for a title, with explicit on/off, cooldown and model controls.
- Keep PR references scoped to current work and reject stale or invalid model results.
- Stay out of Pi's streaming/input path; fail visibly but never ask the main model to repair naming.

Non-goals:

- An agent-callable rename tool, work router, task-difficulty classifier or main-model selector.
- Naming other panes, following the focused pane, changing Herdr status, or collecting sidebar signals.
- A privacy filter, spend guarantee, GitHub existence check or manual-label ownership protocol.

## Constraints

Only main TUI sessions inside Herdr run naming. Herdr CLI writes target only the inherited pane, never model or command input. Two external services receive bounded but potentially sensitive excerpts; installation is not consent to forward secrets. See [data sharing and cost](../README.md#data-sharing-and-cost) before enabling it on sensitive work.
