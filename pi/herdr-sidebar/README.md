# Pi Herdr Sidebar

A Pi extension that fills Herdr's agents sidebar with this Pi session's state: one block of rows per agent pane, in the Acid / Black layout "B" that the [Herdr configuration](../../herdr/README.md) draws. A working session looks like this, with Herdr's colors omitted:

```text
 ◐ WRK  · release        ·  2h33m
   02AU · ━━━━━━━━─── 67% · CMP×18
   ACT  · feat/sidebar*   ·    #42
   MDL  · opus-5.5/hi
   PNE  · Updating sideb… ·    12s
```

- **Row 1:** the agent state (`QNS` while a question waits for you, `BLK`, `WRK`, `SUB` while subagents run and the main agent does not, `RUN` while background tasks run without the main agent or subagents working, `DNE` when it or its off-agent work finished unseen, `IDL`, `UNK`), the Herdr SPACE name (workspace label; Active folder basename while unknown), a red `●` while the session is [flagged](#flag) and, with a [pi-goal](https://www.npmjs.com/package/@narumitw/pi-goal) goal, its time.
- **Row 2:** active units (`AU`), the context used toward compaction as a bar and percentage, and the compaction count (`CMP`).
- **Row 3:** the Active branch, with `*` when it has changes, or its directory; an open pull request's number.
- **Row 4:** the model and thinking level.
- **Row 5:** the Herdr pane name (`PNE`) whenever known, including IDL/UNK, with phase age only while working with a phase; a pending question wins, then `RDY · finished` with the time since it finished. No label means no pane-name row; there is no guessed fallback.

Unknown values show as unknown (`??AU`, `--%`, `CMP×??`), never as zero. The exact tokens, widths and rules are in the [token contract](docs/token-contract.md); the experience is in the [design](docs/design.md).

The extension only displays, apart from the `/flag` reminder below. It reads the snapshot that the separate signals-collector extension publishes inside Pi, the optional pi-background-tasks public EventBus status API, and Herdr's own agent status, SPACE label and pane label for its pane; it runs no Git, GitHub or CodexBar command and reads no session file. It also reports the question wait to Herdr's blocked state, which rpiv's ask-user-question did before.

ACT and MDL alone fade after 1 hour, 4 hours and 1 day without access.
Access means visible in the focused workspace's active tab or row 1 showing
WRK/SUB/RUN; unknown visibility/status stays fresh. The dirty branch fades too,
but text, widths and all other rows stay unchanged. Age is memory only and
resets on `/reload` or Pi restart. See [the design](docs/design.md).
Update the reporter and the complete Pi row override together; an old fragment
cannot render the new stage keys.

## Flag

Type `/flag` in Pi to mark the session with a red dot beside its SPACE name, and `/flag` again to clear it. Pi answers `Flagged` or `Flag cleared`.

```text
 ○ IDL  · rpiv-mono · ●
```

The flag is yours: it stays through focus, visits, work and completion until you clear it, and it does not sort, pin or change Herdr's state. It is saved in the Pi session as a custom entry through Pi's session API, so it returns after `/reload` and when you resume the session, follows `/tree`, and a fork or clone starts with the value at the fork point; a new session starts without it. Pi saves a new session only at its first message, so a flag set before that is lost if Pi exits first. The dot leaves the sidebar when Pi exits. Outside Pi's terminal UI inside Herdr, `/flag` saves nothing and warns where Pi can show a message. See [the design](docs/design.md#the-manual-flag).

## Install

It needs Pi, Node.js 22.19 or newer, and Herdr with the [sidebar configuration](../../herdr/README.md) merged into Herdr's config. Tested with Herdr 0.9.3. For collected values beyond Herdr state/SPACE/pane name it needs the signals-collector extension, in either load order. Without the configuration Herdr ignores the tokens; without the collector the sidebar shows the state row, SPACE and pane names when available, and unknown values.

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
- Herdr renames a workspace without a custom name from its Git state without telling extensions, so that automatic SPACE name can lag by up to 20 seconds. Announced workspace renames, workspace/pane updates, pane moves and focus changes trigger reads immediately on a connected subscription. Herdr 0.9.3 `pane.rename` emits no event, so pane-name changes from it can also lag by up to one 20-second renewal cycle; see [architecture](docs/architecture.md#inputs).
- Herdr keeps token values for 60 seconds after the last report. When Pi exits without its shutdown clear, for example after a crash, the rows remain until then.
- A wall clock that steps backwards makes Herdr ignore the sidebar's reports until it catches up; see [architecture](docs/architecture.md#reporting-to-herdr).
- A multi-request full report can be half-applied for up to one retry interval and self-heals with the next successful full report. Failure retries use exponential backoff with jitter from 5 to 60 seconds.
- Data egress: pane labels are copied to Herdr's in-memory pane tokens as `pane` (bounded and sanitized for display). Phase targets and commands are no longer reported.
- Herdr tracks only Pi's main agent. `SUB`, `RUN` and the unseen-work-finished `DNE` are this sidebar's own display and do not change Herdr's state, notifications or attention sorting. Herdr's own done state, finished notification, attention sorting and `agent.wait` follow the root agent alone: they fire when the root agent goes idle even while off-agent work still runs and the sidebar shows `SUB` or `RUN`, and nothing in Herdr fires when off-agent work finishes and the sidebar shows `DNE`. Herdr 0.9.3 ignores another source's state reports while its Pi hook owns the pane, so an extension cannot change this; turn Herdr's notifications off if that early signal is unwanted. Whether you have seen the pane follows Herdr's focused workspace and its active tab; Herdr's knowledge of whether the terminal window itself has focus is not available to extensions, so off-agent work finishing in the active tab of an unfocused window goes straight to `IDL`. See [architecture](docs/architecture.md#seen-and-the-unseen-work-finished-flag).
- Background-task availability, startup retry, update lag and registry-scope limits are documented in [architecture](docs/architecture.md#inputs); merge the updated g1 RUN color rule with this reporter (53 keys unchanged).
- No interactive check in Pi and Herdr has been recorded; see [contributing](CONTRIBUTING.md#verification-records).

## Project guides

- [Agent guide](AGENTS.md): task routes and critical constraints.
- [Contributing](CONTRIBUTING.md): setup, checks and verification records.
