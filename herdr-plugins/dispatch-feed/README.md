# Dispatch feed

A terminal task dashboard in a Herdr split or tab, backed by the local
[source collector](../../source-collector/README.md). Five ordered source units,
plan counts, an eight-hour week strip and a selectable triage queue. No rail,
portrait, tape, simulated activity or built-in account adapters.

## Run

Requires macOS, Bun 1.4.4 on Herdr's PATH, a truecolor terminal with one-cell ambiguous/braille
characters, and Herdr 0.9.3 or later. From the checkout root run `npm install`
once to link the design system. Then, from this directory:

```sh
bun install --frozen-lockfile
bun bin/dispatch-feed.ts
bun bin/dispatch-feed.ts --plain --read-only
bun bin/dispatch-feed.ts --sources todo,reviews
```

`SOURCE_COLLECTOR_HOME` selects the engine directory (default
`~/Library/Application Support/source-collector`); the socket is `feed.sock`.
`--plain` always uses **get only** and exits after one snapshot; `--read-only`
disables every mutation, including look and refresh, in the interactive pane.
`--motion-off` or `NO_MOTION=1` settles all decoration immediately. Press `m`
to toggle motion and `b` for the ambient field.

`--sources a,b,c` selects which engine sources to include; otherwise
`DISPATCH_FEED_SOURCES` supplies the list. Entries are comma-separated, trimmed,
and empty entries dropped. The flag wins even when empty. No list, or an empty
list, reads all sources as before. Both interactive and `--plain` reads are scoped,
including plan counts and week activity; unknown ids are omitted by the engine.
This does not restrict collection or other RPCs: look and refresh remain global.

Installation is an operator action, never part of tests. Build/setup must already
have run before `herdr plugin link`; link builds nothing. The manifest declares
frozen Bun installation; the root design-system link is a separate prerequisite.
The `open` action opens a right split; `open-tab` opens a tab. Plugin id:
`industrial-os.dispatch-feed`.

## Keys

| Key                          | Action                                                                     |
| ---------------------------- | -------------------------------------------------------------------------- |
| j/k, arrows, PageDown/PageUp | Move selection; click selects, hover brightens source brackets             |
| Enter                        | Open selected http/https URL using macOS `open`, argv only                 |
| t / i / l                    | Plan today / inbox / later                                                 |
| p                            | Toggle pin                                                                 |
| h                            | Toggle handled (undo when handled)                                         |
| x                            | To-do done / reopen, only when the source declares that capability         |
| a                            | Add a one-line to-do; Enter submits, Esc cancels; failed input is retained |
| Tab / 0–5                    | Cycle / choose included source in snapshot order; 0 is all included        |
| s                            | Cycle type / priority / age sort                                           |
| b / m                        | Ambient / motion toggle                                                    |
| r                            | Request refresh                                                            |
| ?                            | Key help                                                                   |
| q / Esc / Ctrl-C             | Quit (Esc first cancels to-do input)                                       |

All mutations use `act` with actor `you`, except `r` which uses `refresh`.
Acknowledgements trigger an immediate refetch; failures never optimistically
change data. A lost mutation reply says outcome unknown; it is **not replayed**.

## Limits and privacy

No persistence in the pane. The engine owns triage, source health and history.
Bracketed paste into the draft is literal text: line breaks/tabs become spaces,
and submission still requires Enter after the paste. A to-do done today, from
any writer, stays in its place dimmed and marked `[done]` until local midnight,
when the engine drops it; it survives pane and engine restarts. `x` reopens it;
reopen before other triage actions. `a` adds to the selected item's checklist, or
to the only included checklist; with several and the selection in none of them,
it says it can't choose. The chosen list is always named to the engine. Handled items remain
selectable with `[handled]` so `h` can undo.

Focus reporting is requested. If the host supplies no focus events, the first
key or click is the look fallback. Fresh items at that moment stay marked new
until a reported blur; without blur reports, that hold lasts until pane exit.
There is no invented focus detector. Unknown counts show `?`, not zero. Offline
keeps last-good data dimmed, explicitly says offline, and retries every five
seconds. A source's auth, error, configuration, disabled, loading, planned and
stale states have separate text cues.

External display text shows as itself, measured in terminal cells: accents,
curly quotes, dashes, CJK and emoji keep their columns aligned and clip on whole
characters. Control and bidi characters show as `?`. Width follows Bun's
`stringWidth`; a terminal that draws an emoji or ambiguous-width character
differently may misalign that row. No screen-reader or contrast certification is claimed. Small panes
keep the list; below 24 columns or 8 rows they show a resize/quit diagnostic.
This application reads private titles from a local socket: screenshots/logs of
real data must stay outside the public repository. It writes no data files and
logs no titles, paths, identities or raw errors. No license has been selected.

[Agent guide](AGENTS.md) · [Contributing](CONTRIBUTING.md) ·
[Architecture](docs/architecture.md) · [Conventions](docs/conventions.md) ·
[Design](docs/design.md) · [Mission](docs/mission.md)
