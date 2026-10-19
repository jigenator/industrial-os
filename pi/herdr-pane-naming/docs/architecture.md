# Architecture

## Modules and dependencies

| Module | Owns | Dependencies |
| --- | --- | --- |
| `index.ts` | Pi registration, preferences, event scope, activity cooldown, epoch cancellation, failure entries and serialized Herdr CLI writes | Node crypto/fs/path, Pi host API, pi-typesafe auth, `models.ts` |
| `models.ts` | Jev question/client, title-model selection and generation, title/PR parsing, safe errors and abortable deadlines | Pi context types and pi-typesafe |
| `test/naming.test.ts` | Pure and lifecycle regressions with injected models, mocked CLI and TypeSafe fetch | Node test runner, local modules and pi-typesafe |
| `test/pi-load.mjs` | Real installed loader and inert-mode/startup checks | Existing global Pi; isolated temporary agent directory |

No extension imports another extension or the design system. `pi-typesafe` is declared here for local development and at the root for Pi git installs; see [the dependency decision](../../../docs/decisions/pane-naming-root-dependency.md). Pi supplies its own host peers. This extension does not register the `/typesafe` command; that belongs to the separately loaded pi-typesafe extension.

## Event flow

- Requires `HERDR_ENV=1`, an inherited `HERDR_PANE_ID`, `ctx.mode === "tui"`,
  and no `PI_SUBAGENT_CHILD=1`. RPC, print, JSON, and subagent child sessions do
  nothing, so children never fight their parent over the shared pane.
- **Every delivered user message** with text starts a background check when it
  is delivered (`message_start`). Queued steering/follow-ups are checked when
  delivered, not when queued. Images are ignored; only text blocks are used.
- **Assistant activity** also triggers checks: finalized assistant
  `message_end` events with visible progress text or requested tool names can
  reveal a shift from research to debugging or implementation without a new
  prompt. Checks are anchored on the latest user message on the current branch,
  which is recomputed at every session start (startup, reload, resume, new, fork)
  and after `/tree` navigation, so naming continues after a reload or resume
  without another prompt. Custom and extension messages do not end that scope.
- Assistant checks wait until the cooldown after the last Jev check. During the
  cooldown only the latest snapshot is kept; identical consecutive snapshots make
  no call. Tool-only messages reuse the latest visible progress text. Tool
  arguments, results, streaming chunks, thinking, and aborted/error responses do
  not trigger checks. No polling and no per-tool requests.
- Jev returns `keep`, `update`, `new_task`, or `uncertain`. Only `update` and
  `new_task` call the title model; `keep` and `uncertain` leave the name alone.

`session_start` restores the latest branch user text and saved preferences but never calls a model or Herdr. `name` resolves a title model, waits for earlier writes, reads the pane, asks Jev, and generates a title only for update/new-task decisions. `render` serializes another read and optional rename. See [design](design.md#pr-numbers) for allowed/confirmed PR handling.

## Critical invariants

- Renames use `herdr pane get/rename` with argument arrays, never a shell. Model
  output can never choose the executable or the target pane; the target is always
  the inherited `HERDR_PANE_ID`. The first terminal seen for that pane is
  remembered; if the pane ID later reports a different terminal, every rename from
  that process is refused (and reported) rather than touching someone else's pane.
- Titles are validated plain text (no control or invisible characters, no
  leading hyphen, no stray PR references). Titles over 55 characters are trimmed
  to the last whole word that fits.
- A new delivered message, a changed assistant snapshot, navigation, shutdown,
  `off`, a model change, and agent cancellation invalidate pending model results.
  Writes are serialized and rechecked after asynchronous reads. Shutdown waits
  only for an already-issued, time-bounded CLI write.
- Identical names cause no rename. Failures never block user input, inject
  prompts, or ask the main model to recover.

`current` fences work by enabled state, runtime context, epoch and agent signal. `cancel` clears queued activity, aborts model work and drops stale PR call tracking. Branch navigation re-anchors the user request; session shutdown disables new work and awaits only bounded writes. The first observed terminal ID remains pinned across session replacement in the same process.

The [README](../README.md#commands) owns preference semantics and the [privacy section](../README.md#data-sharing-and-cost) owns payload/cost bounds. Diagnostics persist only safe metadata, never request/title/provider payloads. The tests cover wrong-pane/terminal rejection, deadlines, malformed replies, late reads/results, command saves and cancellation.

## Evolution and limits

There is no conditional Herdr rename: an already-issued write can overwrite a simultaneous manual change. Target ownership is inferred from the inherited pane and first observed terminal, not a server lease. Model relevance remains a judgment, not a GitHub lookup. Keep validation/cancellation at these boundaries if modules are split later; do not add another naming owner.
