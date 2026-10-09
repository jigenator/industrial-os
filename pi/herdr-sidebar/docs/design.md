# Design

This extension decides what text each sidebar row carries; [the Herdr design](../../../herdr/docs/design.md) decides how Herdr draws it: layout B, the colors, the width lock and the scrollbar finding. The exact values are in [the token contract](token-contract.md). This guide covers what the text means to the person watching, within the [shared language](../../../docs/design.md).

## What each row tells you

| Row | Reads as | Meaning |
| --- | --- | --- |
| 1 | `◐ WRK · release · 2h33m` | State, Herdr SPACE name, goal time (Active basename while SPACE is unknown). The goal time counts while the goal is active and stands still otherwise |
| 2 | `02AU · ━━━━━━━━─── 67% · CMP×18` | Active units, context used toward compaction, compactions on this branch |
| 3 | `ACT · feat/sidebar* · #42` | Active branch (`*` has changes) or directory; open pull request (`#?` when the lookup is unavailable) |
| 4 | `MDL · opus-5.5/hi` | Model and thinking level |
| 5 | `SH · npm test · 12s` | What the agent does now and for how long |

Row 5 shows at most one of three things. While a question waits for you, `ASK` and the question over up to three rows, with `(+N)` when more questions follow. While the agent works, its phase: `WAI` waiting for the model, `THK` thinking, `WRT` writing, or the tool (`RD` `ED` `WR` `SH` `WB` `AG`, `TL` for others) with its file, command, query or agent. When the agent or its subagents finished and you have not seen the pane yet, `RDY · finished` and the time since they finished.

## States

The state code always carries the state in text and shape, so color is never the only cue.

| Code | Shape | When |
| --- | --- | --- |
| `QNS` | `×` | A question is pending, whatever Herdr reports |
| `BLK` | `×` | Herdr reports the agent blocked for another reason |
| `WRK` | `◐` | Herdr reports the main agent working, whether or not subagents run |
| `SUB` | `◐` | Subagents run (units ≥ 1) while the main agent is not working: Herdr reports idle, done or unknown |
| `DNE` | `✓` | Finished and not yet seen: Herdr reports the main agent done, or the subagents finished while you were not looking at the pane |
| `IDL` | `○` | Herdr reports idle |
| `UNK` | `·` | Herdr's status is unknown or not yet read, including while the connection is down |

The table is in precedence order: the first state that applies is shown. Herdr tracks only Pi's main (root) agent, so it would show `IDL` while subagents run and never mark their finish as done; `SUB` and the sidebar's own `DNE` fill those gaps without changing Herdr's state, notifications or attention sorting. Herdr's own done state, finished notification, attention sorting and `agent.wait` follow the root agent alone: they fire when the root agent goes idle even while subagents still run and the sidebar shows `SUB`, and nothing in Herdr fires when the subagents finish and the sidebar shows `DNE`. Herdr 0.9.3 ignores another source's state reports while its Pi hook owns the pane, so an extension cannot change this; turn Herdr's notifications off if that early signal is unwanted. The pane counts as seen when its tab is the active tab of Herdr's focused workspace, as Herdr's own rule has it; subagents that finish while you look at the pane go straight to `IDL`, and looking at it later clears `DNE`. Herdr's own `done` still clears only when Herdr marks the pane seen.

A pending question also raises Herdr's blocked state through `herdr:blocked`, so Herdr's attention sorting, notifications and waits treat it like any blocked agent.

## Truthfulness

| Value | Unknown shows | Never shows |
| --- | --- | --- |
| Active units | `??AU` | `00AU` |
| Context | `─────────── --%` | an empty or full bar |
| Compactions | `CMP×??` | `CMP×00` |
| PR | `#?` when the lookup is unavailable; nothing before it is looked up | a missing PR |
| Branch changes | no `*` when dirtiness is unknown; Herdr draws it like clean | `*` |
| Everything else | the row or value is left out | a placeholder |

In IDL and UNK, known context is decorative grey, not zone-coloured; its shape and used percentage remain unchanged. WRK, SUB, QNS, BLK and DNE retain the zone colours. Unknown context stays `--%` in every state.

Without the signals-collector the sidebar shows row 1 (including SPACE when known) and row 2's unknowns only. `99%` context means 99% or more used; `99AU` and `CMP×99` mean 99 or more.

## Access decay

Only ACT and MDL fade through the grey stages defined in
[the token contract](token-contract.md#act--mdl-access-decay): d0 before
one hour, d1 from one hour, d2 from four hours and d3 from one day since
last access. Access means visible in the focused workspace's active tab,
or row 1 showing WRK/SUB. This is not time since the last snapshot or
last tool call. Access refreshes while either holds; QNS/BLK alone do not
count. Unknown visibility/status stays d0 instead of guessing old.

All ACT/MDL text, including the dirty branch's `*`, stays unchanged;
the dirty branch's amber fades too. Rows 1, 2 and 5+ are unaffected.
[The Herdr color ladder](../../../herdr/docs/design.md#access-decay)
sets the grey roles; Herdr's ` · ` remains theme overlay0.
Age is memory only: `/reload`, Pi restart or session replacement
starts d0, and no historical age is recovered.

## Timing

Values change when the snapshot, Herdr's status, announced workspace label or pane visibility changes, usually within a fraction of a second. Connected lifecycle events trigger reads immediately; only an automatic SPACE label changed without an event waits for the 20-second renewal refresh. Durations follow pi-goal's format (`45s`, `12m`, `2h33m`); they tick each second under a minute and each minute after that. Duration-only diffs follow those changes; TTL renewals and decay-key changes are independent. The existing unref'd render timeout also schedules the next exact decay boundary (subject to the one-second render floor and transport/backoff). The 20-second renewal refreshes ongoing access even if inputs have not changed; leaving an accessed state captures that transition's time. No extra polling timer is added; shutdown clears the timeout. Nothing in the rows animates.

## Accessibility and limits

The rows are plain text in single-cell glyphs as measured by Pi TUI, padded with U+2800 so Herdr's trimming cannot shift the columns. Terminals that draw `◐`, `━` or `─` at ambiguous width, or fonts without U+2800, are unverified. Pi panes without this extension show no Industrial OS rows; other agents retain their own rows. No interactive check in Herdr has been recorded for this extension; the geometry was verified live with a throwaway script on 2026-10-08.
