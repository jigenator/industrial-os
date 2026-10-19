# Design

The experience is a short description of current work in the actual Herdr pane label, without asking the main agent to rename it. Within the [shared terminal language](../../../docs/design.md), this extension owns text only: Herdr draws the label, and Pi draws command/status notifications. It uses no design-system elements or Acid / Black roles; that adoption gap is recorded in [conventions](conventions.md#adoption-gaps).

## Labels you set yourself

Automation owns the label. An existing label (from an earlier session or typed by
hand) is replaced at the next `update`/`new_task` decision, and renaming the pane
by hand does not pause naming. Use `/pane-naming off` to keep a label of your own.
Herdr has no conditional rename, so a manual rename racing an already-issued write
is simply overwritten.

## PR numbers

The title model may select only PRs from an allowed list: explicit `PR #123` or
`PR 123` references and GitHub pull-request URLs in the current user request,
plus, for an `update`, the PRs already in the pane's `PR #… ·` prefix. A
`new_task` never inherits old PRs. Code adds the `PR #123 ·` prefix and removes
redundant references to the same PRs from the title. Choosing which mentioned PR
is relevant remains a model judgment, not a GitHub existence check.

A successful, direct, single-line `gh pr create …` bash call whose entire text
result is one GitHub PR URL adds that PR to the current title without a model
call. Pipelines, wrappers, alternate hosts, JSON output, and other PR tools are
deliberately not parsed. Up to four PRs are shown.

## States and feedback

An uncertain decision leaves the label alone; keep can add a newly confirmed PR to the existing title without a title call; identical labels avoid a write. A changed title is plain text, normally at most 55 Unicode code points, with a total label cap of 80 including its PR prefix. This is a character bound, not a terminal-cell width guarantee; Herdr owns truncation. No animation or custom keyboard/focus handling is added.

On/off/status/cooldown/model use Pi notifications. Failure leaves the old label and naming enabled, with stage, elapsed time and a safe reason rather than success-shaped text; [diagnostics](../README.md#diagnosing-failures) defines the user contract. Text, not color, carries that feedback. Counts are request attempts, not proof of a renamed pane or provider success.

Live Herdr appearance, glyph widths, keyboard use and accessibility have not been verified for this move; see [contributing](../CONTRIBUTING.md#verification-records).
