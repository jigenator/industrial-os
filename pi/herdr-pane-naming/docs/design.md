# Design

The experience is a short description of current work as the Herdr Desktop pane name, without asking the main agent to rename it. Herdr Desktop names a terminal pane by the title its program sets, so the name is this Pi's terminal title. Within the [shared terminal language](../../../docs/design.md), this extension owns text only: Herdr draws the name, and Pi draws command/status notifications. It uses no design-system elements or Acid / Black roles; that adoption gap is recorded in [conventions](conventions.md#adoption-gaps).

## Titles others write

Automation owns the title while naming is on. Herdr Desktop has no pane rename of
its own; the only other writer is Pi, which writes `π - <session name> - <folder>`
when a session starts or reloads and after `/name`. Pi's title is replaced at the
next `update`/`new_task` decision, and is never sent to the models as the current
name. A `keep` or `uncertain` decision, or an unchanged title, leaves Pi's title
showing. Use `/pane-naming off` to keep Pi's title.

## PR numbers

The title model may select only PRs from an allowed list: explicit `PR #123` or
`PR 123` references and GitHub pull-request URLs in the current user request,
plus, for an `update`, the PRs already in the `PR #… ·` prefix of the name this extension last wrote. A
`new_task` never inherits old PRs. Code adds the `PR #123 ·` prefix and removes
redundant references to the same PRs from the title. Choosing which mentioned PR
is relevant remains a model judgment, not a GitHub existence check.

A successful, direct, single-line `gh pr create …` bash call whose entire text
result is one GitHub PR URL adds that PR to the current title without a model
call. Pipelines, wrappers, alternate hosts, JSON output, and other PR tools are
deliberately not parsed. Up to four PRs are shown.

## States and feedback

An uncertain decision leaves the name alone; keep can add a newly confirmed PR to the existing title without a title call; an identical name avoids a write. A changed title is plain text, normally at most 55 Unicode code points, with a total name cap of 80 including its PR prefix. This is a character bound, not a terminal-cell width guarantee; Herdr owns truncation. No animation or custom keyboard/focus handling is added.

On/off/status/cooldown/model use Pi notifications. Failure leaves the old name and naming enabled, with stage, elapsed time and a safe reason rather than success-shaped text; [diagnostics](../README.md#diagnosing-failures) defines the user contract. Text, not color, carries that feedback. Counts are request attempts, not proof of a renamed pane or provider success.

In the live check the window sidebar's Agents row showed the name after the space name, truncated with `…`; the pane header showed the program and folder, not the title. Glyph widths, keyboard use and accessibility have not been verified; see [contributing](../CONTRIBUTING.md#verification-records).
