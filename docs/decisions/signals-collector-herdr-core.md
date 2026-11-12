# The signals collector publishes to herdr-core labels

Status: current. Date: 2026-11-12; approved. Extends [session signals have one collection owner](session-signals-collection.md): the collector's snapshot now also reaches Herdr desktop, and the background-task count and `/flag` move into the collector. Source and offline tests implement this decision; a real `hc`, a live herdr-core and interactive Pi in Herdr desktop are not verified by them.

## Choice

Inside a Herdr desktop terminal (herdr-app with herdr-core, CLI `hc`), `pi/signals-collector` publishes each pushed snapshot, without `usage`, as the string label `io.signals.v1` on its own terminal (`$HC_TERMINAL_ID`) by running `hc label`. Only Pi's interactive TUI sessions with a non-empty `HC_TERMINAL_ID` publish; calls are coalesced latest-wins, one in flight, at most one started per second, skipped when identical to the last success, and the label is cleared on shutdown. [Contract section 4](../../pi/signals-collector/docs/contract.md#4-herdr-desktop-publication-iosignalsv1) is canonical for the gate, value, rate, shutdown and consumer rules.

Two signals that herdr-tui's sidebar reporter used to own move into the collector as additive v1 snapshot fields: `backgroundTasks`, the running count from pi-background-tasks' public EventBus status request, with its validation, stale-answer handling, one startup retry and a 20-second re-query; and `flag`, the `/flag` reminder, saved with the unchanged `industrial-os:herdr-sidebar:flag` entry type so existing sessions restore, and now available in any TUI session rather than only inside herdr-tui. The [contract](../../pi/signals-collector/docs/contract.md#background-tasks-and-the-manual-flag) defines both.

The herdr-tui reporter, `pi/herdr-sidebar`, is deleted: its token report, its `herdr:blocked` emission and its herdr-tui socket client go with it.

## Why

- **One producer.** Every per-session value a Herdr desktop mod shows already exists in the collector's snapshot. Publishing that snapshot keeps one collection owner instead of a second reporter that re-derives and re-validates the same signals.
- **herdr-core is already the shared store.** Its labels are live to every mod through `terminals()` and to any program through `hc get`, `hc ls` and `hc events --json`, which streams changes. Mods and TUIs get the same data with no new service, socket protocol or daemon of ours.
- **Its own terminal is the right key.** A label set on `$HC_TERMINAL_ID` is scoped to the pane Pi runs in, disappears with that terminal, and lets consumers judge staleness from Herdr's own liveness and agent status.
- **The moved signals are per session.** A background-task count and a session flag belong to the session's collector, not to a display, so a desktop mod and any later display read them from one place.

## Alternatives

- **Keep herdr-sidebar and port it to herdr-core:** a second producer duplicating collector state, timers and validation for one display. Rejected.
- **A new local service or socket for mods:** another lifecycle, install and protocol when herdr-core already stores and streams per-terminal values. Rejected.
- **Have the mod read Pi's session files or event bus:** neither is reachable from a Herdr desktop mod, and session files are Pi's private format. Rejected.
- **Include `usage` in the label:** usage is machine-wide, the same in every session; repeating it on every terminal adds size and churn. Rejected.

## Consequences and revisit

- herdr-tui no longer receives Industrial OS sidebar tokens, and Herdr's Pi bridge in herdr-tui no longer gets question-blocked state from `herdr:blocked`: a pending `ask_user_question` no longer shows as blocked there. The question remains in the snapshot (`question`) for any consumer.
- The background-task count is null (unknown) without the producer, and `/bg`, `/fusion`, UI and EventBus starts can take up to the 20-second re-query to appear, as before.
- **Privacy.** A label is readable by any local process that can reach herdr-core, and the published snapshot includes Launch and Active paths, model ids, question text and phase targets. The collector writes it only to the same machine's herdr-core through `hc` and sends it nowhere else. The value is bounded by the snapshot contract.
- A crashed Pi leaves its last label until the terminal ends; consumers treat a label on a terminal that is not live, or whose agent `app` is not `pi`, as stale. On shutdown an in-flight write is killed and the clear has a 1-second timeout, so a write herdr-core had already received can briefly land after the clear; the next instance's following publish replaces it.
- Revisit if herdr-core gains a structured per-terminal data API, if a consumer needs `usage` per terminal, or if the label size or one-second rate stops fitting a consumer.
