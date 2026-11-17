# Design

The guard has almost nothing to show; the Pi Reloader experience is the mod's, in [the Herdr design](../../../herdr/docs/design.md#pi-reloader).

## Guarantees a person relies on

- An unsent draft, including whitespace, stays exactly where it was, with its cursor. Pi is not reloaded or quit while it is there.
- A Pi that is working, has queued messages or is answering another reloader request is left alone.
- Nothing is typed into Pi: no slash command, no text, no key.

## What it shows

One warning, only when the guard cannot start in a Herdr desktop terminal (the listener or `hc label` failed): `Pi Reloader guard unavailable: <reason>`, through Pi's own notification. The mod then reports this Pi as having no guard. Nothing is shown in other modes or outside Herdr desktop.

A reload or quit the mod asks for looks exactly like Pi's own `/reload` or exit.
