# Industrial OS Automations Monitor

A Herdr 0.9.3+ plugin: a read-only terminal dashboard of this machine's Tatsu automation pipelines and schedules, in Acid / Black. It shows which pipelines are running which issues now, three hours of finished runs on one time axis, what needs attention, and when schedules last ran and run next. It opens in a split beside the pane you are in, or in its own tab.

It only reads: it runs `tatsu automations pipelines --json` and `tatsu automations schedules --json`, nothing else, and never changes Tatsu, Herdr or a file.

Status: built and checked against an invented fake `tatsu`, rendered at five sizes, run in an isolated Herdr 0.9.5 and read against this machine's real CLI; not yet installed in a live Herdr session. See the [verification records](CONTRIBUTING.md#verification-records).

## Requirements

- [Bun](https://bun.sh) 1.4.4 on Herdr's `PATH`. Bun runs the TypeScript sources directly; there is no build output. Linux and macOS only.
- `tatsu` on Herdr's `PATH`, or its absolute path in `AUTOMATIONS_MONITOR_TATSU`.
- A checkout of this repository with the root `npm install` done: the monitor imports `@industrial-os/design-system`, which Bun resolves from the root `node_modules`. It is not in this plugin's manifest.

Why this plugin uses Bun and Effect is recorded in [the stack decision](../../docs/decisions/automations-monitor-stack.md).

## Install

Review the manifest and source first, then follow the [plugin install guide](../README.md#install) with this directory. `herdr plugin link` builds nothing, so install the locked dependencies first:

```sh
npm install                                   # at the repository root, once
cd herdr-plugins/automations-monitor && bun install --frozen-lockfile
herdr plugin link .
```

`herdr plugin install` runs the manifest's `bun install --frozen-lockfile` itself, but a GitHub install has no repository root, so the design-system package would be missing; use a linked checkout. If Bun or the dependencies are missing, the pane says what to do and waits for Enter; so does any other failure.

## Open the monitor

| Action | Opens the monitor |
| --- | --- |
| `industrial-os.automations-monitor.open` | In a split to the right of the focused pane |
| `industrial-os.automations-monitor.open-tab` | In a new tab |

```sh
herdr plugin action invoke industrial-os.automations-monitor.open
herdr plugin action invoke industrial-os.automations-monitor.open-tab
```

To bind keys, add `[[keys.command]]` entries with `type = "plugin_action"` and these commands to Herdr's `config.toml`, after checking your own bindings. Outside Herdr, run `bun bin/automations-monitor.ts` in a terminal.

## Use

Screen 1, PIPELINES, has four readouts (active runs, finished in three hours, next poll, alerts) and one block per pipeline, grouped RUNNING, NEEDS ATTENTION, IDLE, NOT REPORTING and OFF, each with its recent results, slots, state and one lane per slot from three hours ago to an hour ahead. Screen 2, SCHEDULES, lists cadence, state, last and next run on the same axis, with the event log. [Design](docs/design.md) explains every mark.

| Key | Action |
| --- | --- |
| `1` `2` | Pipelines, schedules |
| `↑` `↓` | Select |
| `PgUp` `PgDn` `Space`, wheel | Scroll |
| `Enter`, click | Open the selected pipeline's runs; `Esc` closes |
| `F` | Filter: all, needs attention, live |
| `L` | Event log |
| `M` | Motion on or off |
| `R` | Read now |
| `Q` | Quit |

The monitor reads every 10 seconds, one command at a time. The header shows how old the data is; after a failed read the last good data stays on screen, labelled.

## Privacy and limits

- Only the fields listed in the [data contract](docs/architecture.md#data-contract) are decoded. Paths, run IDs, log references and descriptions are never read, so they never reach the screen; error messages are redacted.
- This machine only. The CLI does not report a per-pipeline dispatch time, which slot a run used, or schedule fire history, so the monitor shows the next queue poll instead, packs lanes by time, and draws only each schedule's last, active and next run.
- Each read is bounded by 8 seconds and 4 MiB; a slow or runaway `tatsu` is stopped with its whole process group.
- Panes smaller than 60×16 show only a short notice.
- Not tested on Linux, in terminals other than xterm.js and Herdr's client, or over a long run.

## Development

Commands, checks and evidence are in [CONTRIBUTING](CONTRIBUTING.md).
