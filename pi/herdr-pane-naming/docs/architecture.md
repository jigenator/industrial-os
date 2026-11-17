# Architecture

## Modules and dependencies

| Module | Owns | Dependencies |
| --- | --- | --- |
| `index.ts` | Pi registration, preferences, event scope, activity cooldown, epoch cancellation, failure entries and the terminal title write | Node crypto/fs/path, Pi host API, pi-typesafe auth, `models.ts` |
| `models.ts` | Jev question/client, title-model selection and generation, title/PR parsing, safe errors and abortable deadlines | Pi context types and pi-typesafe |
| `test/naming.test.ts` | Pure and lifecycle regressions with injected models, a mocked `setTitle` and TypeSafe fetch | Node test runner, local modules and pi-typesafe |
| `test/pi-load.mjs` | Real installed loader and inert-mode/startup checks | Existing global Pi; isolated temporary agent directory |

No extension imports another extension or the design system. `pi-typesafe` is declared here for local development and at the root for Pi git installs; see [the dependency decision](../../../docs/decisions/pane-naming-root-dependency.md). Pi supplies its own host peers. This extension does not register the `/typesafe` command; that belongs to the separately loaded pi-typesafe extension.

## Event flow

- Requires `HC_TERMINAL_ID`, which Herdr Desktop sets in each of its terminals,
  `ctx.mode === "tui"`, and no `PI_SUBAGENT_CHILD=1`. RPC, print, JSON, and
  subagent child sessions do nothing, so children never fight their parent over
  the shared terminal. herdr-tui's `HERDR_ENV`/`HERDR_PANE_ID` are not read.
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
  `new_task` call the title model; `uncertain` leaves the name alone, while `keep` can re-render the existing title only to add a PR confirmed during the check.

`session_start` restores the latest branch user text and saved preferences and forgets the last written title, but never calls a model or writes a title. `name` resolves a title model, takes the last written title as the current name, asks Jev, and generates a title only for update/new-task decisions. `render` writes the title when it differs from the last one written. See [design](design.md#pr-numbers) for allowed/confirmed PR handling.

## Critical invariants

- The only write is Pi's `ctx.ui.setTitle(title)`, which writes OSC 0 to Pi's
  own stdout with control characters replaced. Herdr Desktop shows that title
  as the pane name (`panes()[i].title` and `terminals()[i].title` are "what the
  program set"; there is no terminal rename command). No command is run, and
  nothing takes a target: the write reaches only this Pi's own terminal, never one
  chosen by a model, a command argument or focus.
- The current name is the title this runtime last wrote, never read back from
  Herdr: Pi rewrites its own title on every session start, reload and `/name`,
  and that title is not task text. `session_start` forgets it.
- Titles are validated plain text (no control or invisible characters, no
  leading hyphen, no stray PR references). Titles over 55 characters are trimmed
  to the last whole word that fits.
- A new delivered message, a changed assistant snapshot, navigation, shutdown,
  `off`, a model change, and agent cancellation invalidate pending model results.
  The write is synchronous, after `current` is rechecked. Shutdown waits for
  nothing.
- An unchanged title causes no write. Failures never block user input, inject
  prompts, or ask the main model to recover.

`current` fences work by enabled state, runtime context, epoch and agent signal. `cancel` clears queued activity, aborts model work and drops stale PR call tracking. Branch navigation re-anchors the user request; session shutdown disables new work.

The [README](../README.md#commands) owns preference semantics and the [privacy section](../README.md#data-sharing-and-cost) owns payload/cost bounds. Diagnostics persist only safe metadata, never request/title/provider payloads. The tests cover the command-free, target-free write, deadlines, malformed replies, late results, command saves and cancellation.

## Evolution and limits

Pi's own title shows after a session start, reload or `/name` until the next changed name; reading the live title back (`hc get`) would let a `keep` restore it, at the cost of a command per check. Model relevance remains a judgment, not a GitHub lookup. Keep validation/cancellation at these boundaries if modules are split later; do not add another naming owner.
