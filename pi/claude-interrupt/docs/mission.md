# Mission

## Users and problem

Pi users who queue a new direction during an active response need a Claude-style interrupt-and-continue action: stop the current response and continue on the submitted text without manually re-entering it.

## Goals and non-goals

Goals:

- Continue on queued text after Escape, preserving Pi's steering-before-follow-up order and the unsent editor draft.
- Keep native Escape available when the extension cannot safely handle the queue.
- Confirm a real continuation with readable transcript feedback that never enters model context or blocks streaming, input or focus.
- Make failure recovery and unsupported cases explicit.

Non-goals:

- Structured-content or attachment replay.
- Access to the compaction-time queue.
- General input transformation or coordination with other input-transforming extensions.
- Replacing Pi's queue system or native abort notice.

## Constraints

Best-effort, text-only behavior through Pi's public APIs. There is no public atomic queue snapshot and abort/requeue operation; the extension observes input and replays it after settlement. Detailed limits belong in [architecture](architecture.md#evolution-and-known-limits). Interactive and Herdr behavior must be verified separately from automated tests and package loading.
