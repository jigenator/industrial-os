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

Row 5 shows at most one of three things. While a question waits for you, `ASK` and the question over up to three rows, with `(+N)` when more questions follow. While the agent works, its phase: `WAI` waiting for the model, `THK` thinking, `WRT` writing, or the tool (`RD` `ED` `WR` `SH` `WB` `AG`, `TL` for others) with its file, command, query or agent. When Herdr reports the agent done and not yet seen, `RDY · finished` and the time since it finished.

## States

The state code always carries the state in text and shape, so color is never the only cue.

| Code | Shape | When |
| --- | --- | --- |
| `WRK` | `◐` | Herdr reports the agent working |
| `QNS` | `×` | A question is pending, whatever Herdr reports |
| `BLK` | `×` | Herdr reports the agent blocked for another reason |
| `DNE` | `✓` | Herdr reports done: finished and not yet seen |
| `IDL` | `○` | Herdr reports idle |
| `UNK` | `·` | Herdr's status is unknown or not yet read, including while the connection is down |

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

In IDL and UNK, known context is decorative grey, not zone-coloured; its shape and used percentage remain unchanged. WRK, QNS, BLK and DNE retain the zone colours. Unknown context stays `--%` in every state.

Without the signals-collector the sidebar shows row 1 (including SPACE when known) and row 2's unknowns only. `99%` context means 99% or more used; `99AU` and `CMP×99` mean 99 or more.

## Timing

Values change when the snapshot or Herdr's status changes, usually within a fraction of a second. Durations follow pi-goal's format (`45s`, `12m`, `2h33m`); they tick each second under a minute and each minute after that, and the extension sends nothing between those changes. Nothing in the rows animates.

## Accessibility and limits

The rows are plain text in single-cell glyphs as measured by Pi TUI, padded with U+2800 so Herdr's trimming cannot shift the columns. Terminals that draw `◐`, `━` or `─` at ambiguous width, or fonts without U+2800, are unverified. Pi panes without this extension show no Industrial OS rows; other agents retain their own rows. No interactive check in Herdr has been recorded for this extension; the geometry was verified live with a throwaway script on 2026-10-08.
