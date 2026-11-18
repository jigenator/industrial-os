# The Pi Reloader: a Herdr desktop window and a Pi guard

Status: current, version 2. Date: 2026-11-17. The placement, a herdr-app window mod plus a Pi extension inside Industrial OS, was decided by the maintainer. Version 2 is the maintainer's requested rewrite onto Herdr desktop's own tools; the channel and dropping any read marking were chosen within that brief, on the live evidence below. Offline tests, `herdr-app check` and an isolated live run implement and check it; see the [Herdr record](../../herdr/CONTRIBUTING.md#pi-reloader).

## Choice

Two Industrial OS projects that share only [the guard contract](../../pi/reloader-guard/docs/contract.md):

- `herdr/mods/industrial-os/reloader/`, the window of the one Industrial OS mod, with Node-tested pure rules, opened from a key bound to `mod.open:industrial-os` (until 2026-11-18 a mod of its own, `herdr/mods/pi-reloader/`, on `mod.open:pi-reloader`; [why one mod](herdr-combined-mod.md));
- `pi/reloader-guard/`, a Pi extension, active only in the TUI inside a Herdr desktop terminal (`HC_TERMINAL_ID`).

**Channel.** The guard listens on a loopback TCP port and publishes `{ v: 2, port, token }` as the herdr-core label `io.pi-reloader.v2` on its own terminal. The mod reads it from `terminals()` and `hc get`, and sends one JSON line over gpui-kit's `net.connect` carrying the per-runtime token; one line comes back on the same connection.

**Rules.** Act only on Pi agents Herdr reports idle or done, in their own pane on this computer. Never a protected terminal: no pane of its own, shown by a layout block, `lunalee-chat`, or another machine. Skip busy, queued, draft and changed-session Pis; the guard rechecks right before Pi's own `reload()` or `shutdown()`. Never type a slash command or any text into Pi. Fail closed when the guard is missing or silent. Never kill anything. Report completed, skipped and failed counts with a reason for each Pi. Reload and Reset both run on every candidate at once and wait for every attempt.

**Restart.** Pi 1.5.2 has no restart API. Reset asks the guard to quit Pi and waits until herdr-core shows the root shell back in front with no agent status. It then types one shell line into that shell with `hc send`: `pi --session '<the same session file>'`. It acts only when the root program is sh, bash, zsh, dash or ksh and Pi one of its jobs, so quitting never ends the terminal.

**Read state.** The Reloader leaves Herdr's idle and done alone. herdr-core counts a `turn` per terminal; Herdr shows an agent `done` while the undocumented label `herdr.seen` is below that turn. The turn advances only when a prompt runs. A reload or a quit and resume runs no prompt, so a Pi that was idle stays idle and one that was done stays done, with no visit and no label.

## Why

- **The loopback port is the simplest channel that keeps the guarantees.** A label request channel works: `hc events --terminal <t> --json` pushes a `labels` event on every label change. But every idle Pi would then keep an `hc events` child running and restart it whenever herdr-core restarts. That child wakes on every change to its terminal, including each `io.signals.v1` write. The guard would also have to deduplicate requests, ignore a request label left from an earlier runtime, and reply by label, and the mod would poll for that reply. The listener costs nothing while idle and needs herdr-core only to publish. A reply arrives on the request's own connection, so a stale reply cannot pass as a fresh one, and a replacement runtime is recognised by its new token.
- **The trust boundary is the same either way.** Only processes of the same user can read herdr-core labels (`hc get`) or write them (`hc label`). That includes agent sessions, so any of them could read the token or write a request label. Neither channel can tell Herdr's window from another process of the user. The token keeps other users and stale runtimes out.
- **The token alone identifies the runtime.** The guard checks it; the mod confirms a reload by a new token that answers. A process id, parent id and terminal in the label and wire added no protection the token does not give, so version 2 drops them, along with the foreground-process check that needed them.
- **There is no seen state to restore.** Live, a reload and a reset left the core `turn` unchanged: a restarted idle Pi read `idle` in `herdr-app ls` and a done one stayed `done`, while focus never moved. Moving focus, or writing `herdr.seen=<turn>`, would only rewrite what is already there. A turn that does advance after a resume is new work, and `done` is the honest state for it.
- **Restarting from the shell** is the only restart that keeps the terminal, its pane and its place in the layout, and needs no new Pi API.
- **`hc wait` does not fit the waits.** It waits for an agent to stop working; the Pis here are already settled, and the root shell has no status. The mod polls `hc get` every 250 ms, only while it acts.

## Alternatives

- **A request label watched with `hc events`:** rejected above. Revisit if herdr-core gains per-terminal requests or private values, or if mods gain a push stream.
- **Marking restarted Pis read with `hc label <t> herdr.seen=<turn>`, or visiting them with `agent.focus`:** neither changes anything, because the turn does not move. Version 1 visited restarted idle Pis and restored focus; removed.
- **Typing `/reload` or `/quit` into Pi with `hc send`:** breaks the draft rule and the no-slash-command rule. From an agent terminal, `hc send` wraps the text as `<hc from="tN">…</hc>`, which reaches the model as a prompt.
- **`hc kill` and a new terminal for reset:** ends the terminal and its pane. Rejected.
- **Repeating Pi's original arguments on restart:** they may include a first prompt, which would be sent again. Rejected for a bare `pi --session`.

## Consequences and revisit

- Version 2 changes the label and the wire, so the mod and the guard are installed together. Until a running Pi reloads with the new guard, the new mod shows it as `NO GUARD` and leaves it alone. A version 1 label left on a terminal is inert.
- A Pi started from a layout block, as a terminal's own program, under fish, or on another machine is never restarted. Revisit if Pi gains a restart API.
- `herdr.seen` and `turn` are undocumented; this record depends on them only to explain why nothing is marked. If Herdr ever shows a restarted Pi as done, `hc label <t> herdr.seen=<turn from hc get>` marks it read without moving focus.
- The run lives in the window's task: a layout switch stops it, possibly leaving a quit Pi at its shell prompt with its session intact.
