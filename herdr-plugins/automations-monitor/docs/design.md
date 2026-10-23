# Design

The automations monitor is a terminal port of the approved mockup (v5): a dark-field, read-only dashboard of this machine's Tatsu pipelines and schedules on one time axis. It follows the [shared visual language](../../../docs/design.md); this document records what it shows, what each mark means and where it departs from the mockup.

## Layout

The approved design is a 160×51 cell grid. Every frame is exactly the pane's size, at any size:

| Rows from the top | Content |
| --- | --- |
| 0–1 | `■ AUTOMATIONS`, the two screen tabs with their counts (`?` until read), then the clock, the read status and `OBSERVE ONLY`; the right side shortens before it overlaps the tabs |
| Machine row | This machine's name, the runner chip, `RECORDED` or `NO RECORD` when the runner was not observed live, the machine's slots, any service environment drift, and on the right a `LAST KNOWN` or `STALE` banner |
| Readouts | Four numbered readouts with 5-row numerals when the pane has 40 rows and room for four 27-column readouts; otherwise one line of `LABEL value` pairs |
| List | Its heading, the time axis, the grouped list, then the position row: `a–b OF n`, the scroll hint, the filter chips and a legend |
| Last two | A rule and the footer: every key with its label, and `NEXT READ` or `READING` on the right |

The event log is a 35-column column at the right. It opens only when the list keeps at least 70 columns beside it; otherwise `L` is labelled `LOG: NARROW` and nothing narrows. Blocks and schedule rows have a full form and a compact form, chosen so lanes keep at least 40 columns. Below 60×16 the pane shows one line, `AUTOMATIONS 59x16: TOO SMALL` (or `WxH TOO SMALL` when even that does not fit), and nothing else.

## States

A pipeline is in exactly one group, in this order:

| Group | When | Chip and reason |
| --- | --- | --- |
| RUNNING | It has a live run (claiming through finalizing) and the runner reports live | `RUNNING`, or `VERIFYING` when every live run is verifying; `n BUSY` or `n VERIFYING`. Oldest live run first |
| NEEDS ATTENTION | Enabled, with an invalid or missing definition | `INVALID` / `DEFINITION INVALID`, `NO DEF` / `DEFINITION MISSING` |
| IDLE | Enabled, valid, nothing live | `IDLE` with `NO LIVE RUNS`, or the runner's blocked reason in amber, such as `QUEUE-LABEL-MISSING` |
| NOT REPORTING | Enabled and valid, but the runner is stopped or unreachable | `BLOCKED` / `RUNNER STOPPED`, `NO REPORT` / `LAST KNOWN` |
| OFF | Disabled | `OFF` with `DISABLED` or `NO DEFINITION` |

A failed last run is not a state. It shows as `✕` in the block's results and at the end of its bar, and the pipeline stays in its group. The `ATTENTION` filter shows definition problems only; `LIVE` shows running pipelines only.

Schedules group as NEEDS ATTENTION (paused, invalid or missing definition, or last run failed), ON · BY NEXT RUN (on or firing, soonest first), NOT REPORTING (`HELD` while the runner is stopped, `NO REPORT` while unreachable) and OFF. This follows the approved schedules mockup, where a failed last run does need attention; see [Deviations](#deviations-from-the-mockup).

The runner chip reads `RUNNER RUNNING`, `STARTING`, `DRAINING`, `STOPPED` or `UNREACHABLE`, and `RUNNER ?` before anything is read.

## Pipelines

Screen 1 (`1`).

- **Readouts.** `01 ACTIVE RUNS`: live runs over the machine's slots, with one cell per busy slot in its pipeline's colour. `02 FINISHED · 3H`: runs that ended in the last three hours, the failure count, and a bar of succeeded, interrupted or dropped, and failed. `03 NEXT POLL`: the runner's next queue poll from `polling.next_poll_at`, with its interval, a blocked reason, or `RUNNER STOPPED` / `RUNNER NOT REPORTING` (then `--:--`). `04 ALERTS`: the count, the first alert and `+n`. Alerts are definition problems, an unreachable or stopped runner, unread schedules, paused or failed schedules, runner problems, poll blocks and service drift.
- **Blocks.** One per pipeline: the plate with its number in name order, the name, its scope, the newest eight results newest first (`■` succeeded, `✕` failed, `◩` interrupted or dropped, `□` cancelled), the live-run count as a numeral over `/slots`, the state chip with its reason, and one lane per slot, at most six. A pipeline with no slot count shows `?` and one lane.
- **Lanes.** The axis runs from −3h to +1h, with hour ticks and quarter-hour marks, and a NOW line in acid through the list. Runs are packed into lanes by time, because the CLI does not say which slot a run used. The future is dotted. Since a stopped runner's last report the lane is dashed; since an unreachable runner was last heard from it is hatched.
- **Bars.** Finished runs are grey, marked at their end with a red `✕` for a failure or an amber `▪` for anything else that did not succeed. A live run is hatched while claiming or verifying, then solid in its pipeline's colour with the issue number on it, ending in a head at NOW that blinks acid while the run is running. While the runner is not reporting, live runs are last known: grey, with no head.
- **The log** is off by default here; `L` opens it and the lanes narrow.

## Schedules

Screen 2 (`2`). Readouts: `01 NEEDS ATTENTION`, `02 NEXT RUN` (the soonest scheduled run and its schedule), `03 ON` (on, firing or failed, of all), `04 HELD OR OFF`. Rows show the cadence (`EVERY 10M`, `EVERY 1H`, `DAILY 17:00` in local time, `DAILY ×2`), the state word, the last result and its age, and the next run (`IN 5M`, `NOW` while firing, `DUE` when overdue, `—` when none is scheduled). The strip spans −3h to +1h and shows only what the CLI reports: the last run `◆` (`✕` if it failed), the active run in acid, and the next run `◇`. The CLI has no fire history, so nothing else is drawn. The event log is on by default.

With no schedules the list reads `NO SCHEDULES · THE RUNNER LISTS NONE`, which is this machine's state today.

## Run modal

`Enter`, a click on a selected block, or a click on a live bar opens the selected pipeline's runs; `Esc` or a click outside it closes it. Over the dimmed screen it shows a title bar in the pipeline's colour while live (grey otherwise) with the state word, this machine, the scope and the slots, then:

- **Live runs**, `↑ ↓` or a click choosing one, and below them the recent finished runs with their outcome and age. Both columns need a modal at least 80 columns wide; a narrower one shows the selected run only.
- **The selected run**: its issue, a phase chip (`LAST KNOWN` while the runner is not reporting), the elapsed time since claim as a big numeral, phase segments CLAIM, VERIFY and RUN with their times (the current one blinks with motion on), key–values (pipeline, phase, admitted, machine), and this pipeline's latest three events.

With no live run, the selected-run side says `IDLE · NOTHING CLAIMED` or the pipeline's reason. The modal never acts on a run.

## Event log

Newest first, at most what fits, with local time, a verb and the subject. Verbs: `CLAIM` (a run was claimed), `DONE` (succeeded), `FAIL` (failed), `STOP` (cancelled, or the runner stopped), `LOST` (interrupted or dropped, or the runner's last report), and `OK` (a schedule run succeeded). Events come only from timestamps the CLI reports; nothing is inferred.

## Color

Colour means state; words and shapes carry the same meaning. Values come from the design system: the Acid / Black roles, mixes of them over the field, and the seven IndustrialOS category colours (pale blue, magenta, mint, lavender, yellow, steel blue, violet), chosen by the pipeline's place in name order modulo seven.

| Meaning | Colour |
| --- | --- |
| Live work, NOW, the blinking head, the selected tab | Acid accent, and a live bar's pipeline colour |
| Needs attention, failures | Critical red |
| Warnings: interrupted, dropped, blocked, drift, stale, held | Warning amber |
| History, idle, off | Greys from the role set and white mixes |

The plate takes the pipeline's colour while live, red or amber when it needs attention, and grey otherwise. The field is black; there is no light theme.

## Motion

Only live heads, verifying segments in the modal and firing schedules blink, at the design system's lamp timing (lit 500 ms, dim 300 ms). Frames are drawn on lamp edges while something blinks, otherwise once a second for the clock and ages. `M` turns motion off: everything holds lit and the screen is fully still; the footer reads `MOTION OFF`.

## Interaction

| Key | Action |
| --- | --- |
| `1` `2` | Pipelines, schedules (or click a tab) |
| `↑` `↓` (`k` `j`) | Select; the selection is kept in view |
| `PgUp` `PgDn` `Space`, wheel | Scroll; the position row shows `a–b OF n` and a scrollbar shows the window |
| `Enter`, click | Open the run modal (pipelines) |
| `Esc` | Close the modal; does nothing else |
| `F` | Filter: ALL, ATTENTION, LIVE |
| `L` | Event log on or off |
| `M` | Motion on or off |
| `R` | Read now (ignored while a read is in flight) |
| `Q`, `Ctrl-C`, `Ctrl-D` | Quit |

The footer lists the keys; on narrow panes the labels shorten, then all but `QUIT` drop, and the keys stay. Nothing in the monitor changes Tatsu, Herdr or any file.

## Truthfulness

- Unknown is never zero: counts, numerals and times show `?` or `--:--` until read.
- The header shows the age of the screen's last good read (`READ 8S AGO`). After three intervals without a new one it reads `STALE · READ 45S AGO` and the machine row says `STALE`. After a failed read the last good data stays, labelled `LAST KNOWN` with the failure, and the header reads `READ FAILED · LAST OK 1M AGO`.
- With no data, the list area names the failure: `TATSU NOT FOUND` (with what to do), `CANNOT START TATSU`, `READ TIMED OUT`, `OUTPUT TOO LARGE`, `TATSU ERROR <CODE>` with the redacted message and exit code, `TATSU EXITED n`, `UNSUPPORTED SCHEMA`, or `UNREADABLE OUTPUT` with the first mismatching field. Each says it is retrying.
- No local path, run ID, log reference or description is decoded, so none can be shown. The one free-text value, an error message, is redacted: path- and URL-shaped words become `<path>`.
- A runner that is not reporting live keeps its last-known runs grey and stops the NEXT POLL countdown.

## Deviations from the mockup

- **One machine.** The mockup's machine tabs and per-run machine labels are replaced by this machine's row; the CLI reports only this machine.
- **NEXT DISPATCH is NEXT POLL.** The CLI has no per-pipeline dispatch time. The runner's next queue poll is the nearest truthful value.
- **No slot identity.** Lanes are packed by time, and the modal has no `SLOT n` column or SOURCE row; the CLI reports neither.
- **Schedule strip.** Only the last, active and next run are drawn; the mockup's fire history does not exist in the CLI.
- **Large numerals** use a 4-column, 5-row face drawn with half blocks for the readouts and the design system's 3×5 pixel numerals elsewhere, rather than the mockup's canvas font.
- **Footer** lists keys only; the mockup's colour legend sits in the position row instead.
