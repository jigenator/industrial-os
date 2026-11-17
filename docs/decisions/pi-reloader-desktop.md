# The Pi Reloader moves to Herdr desktop

Status: current. Date: 2026-11-17; the placement, a Herdr desktop mod plus a Pi extension inside Industrial OS, was decided by the maintainer; the channel and restart below were chosen within that brief. Offline tests, `herdr-app check` and one isolated live run implement and check it; see the [Herdr record](../../herdr/CONTRIBUTING.md#pi-reloader).

## Choice

The herdr-tui plugin [jigenator/herdr-pi-reloader](https://github.com/jigenator/herdr-pi-reloader), a Rust popup plus a companion Pi extension, is ported as two Industrial OS projects:

- `herdr/mods/pi-reloader/`, a herdr-app window mod with Node-tested pure rules, opened from a key bound to `mod.open:pi-reloader`;
- `pi/reloader-guard/`, the companion extension adapted for Herdr desktop, gated on `HC_TERMINAL_ID`.

Its behaviours and safety rules are kept: idle or done Pi only; reload through Pi's API, verified by a replacement guard runtime; reset concurrently, wait for every attempt, visit restarted idle Pis in order, restore focus; skip busy, queued, changed-session and draft Pis; never type a slash command; fail closed without a guard; report completed, skipped and failed counts.

**Channel.** The guard listens on a loopback TCP port and publishes `{ port, token, pid, ppid }` as the herdr-core label `io.pi-reloader.v1` on its own terminal, as the signals collector publishes `io.signals.v1`. The mod reads labels from `terminals()` and `hc get`, and talks to the guard with gpui-kit's `net.connect`, one JSON line each way, carrying the per-runtime token. [The contract](../../pi/reloader-guard/docs/contract.md) is canonical.

**Restart.** Pi 1.5.2 has no restart API (`reload()` and `shutdown()` only). A reset asks the guard to quit Pi, waits until herdr-core shows the terminal's root shell back in front with no agent status, and then types one shell line into that shell with `hc send`: `pi --session '<the same session file>'`. It acts only when the root program is sh, bash, zsh, dash or ksh and Pi one of its jobs, so quitting never ends the terminal; nothing is killed. Protected terminals (no pane, a layout block, `lunalee-chat`) and other machines are never candidates.

## Why

- **The fork's channel does not exist in Desktop.** Its plugin found each guard at `/tmp/herdr-pi-reloader-<uid>/<pid>.sock`, keyed by herdr-tui's `HERDR_SOCKET_PATH` and `HERDR_PANE_ID`, which Desktop terminals don't set. herdr-app mods can `exec`, run `hc`, read and write files and open TCP connections (`gpui-kit.d.ts`, module `net`), but not Unix sockets.
- **Labels are already the store mods read.** A label on the guard's own terminal is scoped to it, live in `terminals()`, gone with the terminal, and readable by `hc get` in the same snapshot as status and foreground process. No exec'd client, no file in the mod's folder and no polling of files.
- **The token keeps the old trust boundary.** The Unix socket admitted only the same user through file modes; a loopback port admits anyone, so every request needs the 128-bit token, which only processes that can read the user's herdr-core labels see.
- **Restarting from the shell is what the fork did** (`run_in_pane "pi --session …"` after the shell returned), and it is the only restart that keeps the terminal, its pane and layout place, and needs no new Pi API.

## Alternatives

- **Unix socket plus an exec'd client** (`nc -U`, or a Node script): a process per request, a client file whose path the mod must know, and `nc -U` is not on every Linux. Rejected for the label and TCP.
- **A request file the guard watches:** polling or a watcher in every Pi, and stale files to clean. Rejected.
- **Typing `/reload` or `/quit` into Pi with `hc send`:** violates the draft rule and the no-slash-command rule. Rejected. (The live run showed why: a pasted `/reload` from an agent terminal arrives wrapped in `<hc from=…>` tags and reaches the model as a prompt.)
- **`hc kill` and a new terminal for reset:** ends the terminal and its pane, and would be unsafe for layout-block terminals. Rejected.
- **Repeating Pi's original arguments on restart:** they may include a first prompt, which would be sent again. Kept the fork's bare `pi --session`.

## Consequences and revisit

- The herdr-tui plugin and its extension are no longer needed in Desktop. The old extension is inert there and can coexist until herdr-tui is retired.
- A Pi started from a layout block, as a terminal's own program, under fish, or on another machine is not restarted. Revisit if Pi gains a restart API.
- The token is visible to the user's own processes and to agents that print `hc get` output. Revisit if herdr-core gains per-terminal private values or mods gain Unix sockets.
- The run lives in the window's task: a layout switch stops it, possibly leaving a quit Pi at its shell prompt with its session intact.
