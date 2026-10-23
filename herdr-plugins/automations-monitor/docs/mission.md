# Mission

Let the person running Tatsu automations on this machine see, at a glance and from a Herdr pane, what the runner is doing: which pipelines are working on which issues right now, what finished and failed in the last three hours, what needs them, and when schedules last ran and run next. It reads only what the Tatsu CLI reports and says plainly when that is unknown, stale or unreadable.

## Non-goals

No control: it never starts, stops, cancels, retries or edits a run, pipeline, schedule or the runner, and it never opens logs, sources or work directories. No other machines, history beyond what the CLI reports, notifications, persistence or export. No light theme.

It is one of the Herdr tools in the [repository mission](../../../docs/mission.md) and follows the shared visual language.
