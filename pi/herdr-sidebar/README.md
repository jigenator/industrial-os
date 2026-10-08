# Pi Herdr Sidebar

A Pi extension that fills Herdr's agents sidebar with this Pi session's state: one block of rows per agent pane, in the Acid / Black layout "B" that the [Herdr configuration](../../herdr/README.md) draws. A working session looks like this, with Herdr's colors omitted:

```text
 ◐ WRK  · release        ·  2h33m
   02AU · ━━━━━━━━─── 67% · CMP×18
   ACT  · feat/sidebar*   ·    #42
   MDL  · opus-5.5/hi
   SH   · npm test        ·    12s
```

- **Row 1:** the agent state (`QNS` while a question waits for you, `BLK`, `WRK`, `SUB` while subagents run and the main agent does not, `DNE` when it or its subagents finished unseen, `IDL`, `UNK`), the Herdr SPACE name (workspace label; Active folder basename while unknown) and, with a [pi-goal](https://www.npmjs.com/package/@narumitw/pi-goal) goal, its time.
- **Row 2:** active units (`AU`), the context used toward compaction as a bar and percentage, and the compaction count (`CMP`).
- **Row 3:** the Active branch, with `*` when it has changes, or its directory; an open pull request's number.
- **Row 4:** the model and thinking level.
- **Row 5:** what the agent is doing now and for how long, the pending question over up to three rows, or `RDY · finished` with the time since it finished.

Unknown values show as unknown (`??AU`, `--%`, `CMP×??`), never as zero. The exact tokens, widths and rules are in the [token contract](docs/token-contract.md); the experience is in the [design](docs/design.md).

The extension only displays. It reads the snapshot that the separate signals-collector extension publishes inside Pi, and Herdr's own agent status and SPACE label for its pane; it runs no Git, GitHub or CodexBar command and reads no session file. It also reports the question wait to Herdr's blocked state, which rpiv's ask-user-question did before.

## Install

It needs Pi, Node.js 22.19 or newer, and Herdr with the [sidebar configuration](../../herdr/README.md) merged into Herdr's config. Tested with Herdr 0.9.3. For collected values beyond Herdr state/SPACE it needs the signals-collector extension, in either load order. Without the configuration Herdr ignores the tokens; without the collector the sidebar shows the state row, SPACE name when available, and unknown values.

This package lives in the [Industrial OS](../../README.md) monorepo. Install it from git with this entry in the `packages` array of Pi's `settings.json`; see [installing the Pi extensions](../README.md#install) for the source, filter and updates:

```json
{ "source": "git:github.com/jigenator/industrial-os", "extensions": ["pi/herdr-sidebar/src/extension.ts"] }
```

To load it for one Pi invocation without installing it, from `pi/herdr-sidebar/`:

```sh
pi -e .
```

It reports only from Pi's interactive terminal mode inside a Herdr pane (`HERDR_ENV=1`, `HERDR_PANE_ID` and an absolute `HERDR_SOCKET_PATH`). Print, JSON and RPC runs, including subagent child processes, report nothing.

**Remove rpiv ask-user-question's Herdr reporting when you install this.** Both emit `herdr:blocked` for the same question, so with both active the blocked state is counted twice.

## Limitations

- Pi panes without this extension show no Industrial OS rows. The configuration scopes layout B to Pi; other agents keep their configured/default rows.
- Herdr renames a workspace without a custom name from its Git state without telling extensions, so that automatic SPACE name can lag by up to 20 seconds; custom names update at once.
- Herdr keeps token values for 60 seconds after the last report. When Pi exits without its shutdown clear, for example after a crash, the rows remain until then.
- A wall clock that steps backwards makes Herdr ignore the sidebar's reports until it catches up; see [architecture](docs/architecture.md#reporting-to-herdr).
- A multi-request full report can be half-applied for up to one retry interval and self-heals with the next successful full report. Failure retries use exponential backoff with jitter from 5 to 60 seconds.
- Data egress: the first line of bash commands and tool paths are sent to Herdr's in-memory pane tokens as `ev_act` (bounded and sanitized for display). Avoid sensitive command/path content when using this display.
- Herdr tracks only Pi's main agent. `SUB` and the subagents-finished `DNE` are this sidebar's own display and do not change Herdr's state, notifications or attention sorting. Herdr's own done state, finished notification, attention sorting and `agent.wait` follow the root agent alone: they fire when the root agent goes idle even while subagents still run and the sidebar shows `SUB`, and nothing in Herdr fires when the subagents finish and the sidebar shows `DNE`. Herdr 0.9.3 ignores another source's state reports while its Pi hook owns the pane, so an extension cannot change this; turn Herdr's notifications off if that early signal is unwanted. Whether you have seen the pane follows Herdr's focused workspace and its active tab; Herdr's knowledge of whether the terminal window itself has focus is not available to extensions, so subagents finishing in the active tab of an unfocused window go straight to `IDL`. See [architecture](docs/architecture.md#seen-and-the-subagents-finished-flag).
- No interactive check in Pi and Herdr has been recorded; see [contributing](CONTRIBUTING.md#verification-records).

## Project guides

- [Agent guide](AGENTS.md): task routes and critical constraints.
- [Contributing](CONTRIBUTING.md): setup, checks and verification records.
