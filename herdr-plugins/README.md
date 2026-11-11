# Herdr plugins

Independent Herdr plugins for Industrial OS. Each owns its runtime, manifest,
checks and guides; shared rules are in [AGENTS.md](AGENTS.md).

| Plugin | Purpose | Runtime |
| --- | --- | --- |
| [Whiteboard](whiteboard/README.md) | Sticky notes and text on a mouse-driven board, one per workspace, in a split, a tab or a modal | Rust, built with Cargo |
| [Automations Monitor](automations-monitor/README.md) | Read-only dashboard of this machine's Tatsu automation pipelines and schedules, in a split or a tab | Bun 1.4.4 with TypeScript and Effect, dependencies installed from `bun.lock` |
| [Dispatch feed](dispatch-feed/README.md) | Source-collector task dashboard and triage, in a split or tab | Bun 1.4.4, TypeScript, design-system imports |

## Install

Review the manifest and source first: plugins run as your user, with Herdr's
socket authority, not in a sandbox. An operator can link a checkout, for
example:

```sh
herdr plugin link ./herdr-plugins/whiteboard
```

For a published revision, Herdr also supports
`herdr plugin install <owner>/<repo>/herdr-plugins/<plugin> --ref <revision>`.
This is an install description, not verification that a published revision
exists.

Linking runs no build step. Plugins in another runtime, such as
[Whiteboard](whiteboard/README.md#install) and the
[Automations Monitor](automations-monitor/README.md#install), are built or
installed first; installing from GitHub runs their declared build and needs that
toolchain.

The Spaces plugin for herdr-tui has been removed; Spaces information for the
Herdr desktop app is in the [Industrial OS sidebar](../herdr/README.md#sidebar).
