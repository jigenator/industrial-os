# Mission

## Users and problem

People returning to one of several Pi sessions need to know what it was doing and where to pick up. A short while-you-were-away recap restores that orientation without adding housekeeping to the main conversation.

## Goals and non-goals

Goals:

- Draft one brief recap on return after meaningful activity, with idle fallback and resume/fork orientation.
- Offer manual brief/detailed recaps and explicit recap-model/onscreen-retention preferences.
- Ground recaps in edited active-branch context and discard stale, cancelled or incomplete results.
- Keep output UI only and make provider data sharing/cost and incomplete-history coverage explicit.

Non-goals:

- Persisting recap text, changing main-model context, creating an audit log or reconstructing abandoned/summary-only history.
- Renaming Herdr panes, collecting shared session signals or changing the main model.
- A focus/visibility authority, a total-token budget, automatic chunking/retry or universal custom-provider support.

## Constraints

Generation, pickers and focus observation run only in Pi TUI mode. Non-TUI lifecycle handlers still clear owned UI, without inference or preference I/O. Pi owns input and rendering. A separate recap provider call can expose sensitive projected session data and incur costs; [privacy and cost](../README.md#model-selection-privacy-and-cost) is part of the usage contract. Preserve the upstream MIT license and attribution in [provenance](../README.md#provenance).
