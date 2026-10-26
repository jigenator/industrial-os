# Architecture

Status: current. Evidence: the source and tests in this directory, the manifest as accepted by `herdr plugin link` on Herdr 0.9.5, Tatsu's published `automations-pipelines.v2.json` and `automations-schedules.v2.json` schemas, and the locked Effect 4.0.6 and Bun 1.4.4. The stack is recorded in the [stack decision](../../../docs/decisions/automations-monitor-stack.md).

## Modules

| Module | Owns | Depends on |
| --- | --- | --- |
| `herdr-plugin.toml` | The `bun install --frozen-lockfile` build, the `monitor` pane (a split by default) and the `open` and `open-tab` actions | Herdr 0.9.3+ plugin manifest |
| `bin/automations-monitor.sh` | `pane`: check for Bun and installed dependencies, run the monitor, and keep any error on screen until Enter. `open`, `open-tab`: ask Herdr to open the pane in a split or a tab | POSIX `sh`, `HERDR_BIN_PATH` |
| `bin/automations-monitor.ts` | Arguments, the layers, `BunRuntime.runMain`, the exit status and the redacted error report; `--frame` mode | `app`, `reader`, `terminal`, `@effect/platform-bun` |
| `src/app.ts` | The live loop: merges terminal events, poll events and frame ticks, folds them through `ui`, and writes the rows that changed | `terminal`, `poller`, `ui`, `view/frame` |
| `src/terminal.ts` | The scoped `Terminal` service: raw mode, alternate screen, SGR mouse, input parsing, resize, signal and error handlers, restoration | Node `process` streams in Bun |
| `src/poller.ts` | Polling as a `Stream`: one read cycle at a time, the interval after each cycle, refresh requests | `reader` |
| `src/reader.ts` | The `TatsuReader` service: the two fixed argvs, bounds, process-group teardown, classification of every reply | `contract`, `redact`, `effect/process` |
| `src/contract.ts` | Effect Schemas for the fields shown, and the error envelope | `effect` |
| `src/redact.ts` | Redaction of the one free-text value, an error message | — |
| `src/model.ts` | Pure derivation: pipeline and schedule states, groups, lanes, cadence, events, alerts, ages | `contract` |
| `src/ui.ts` | `AppState` and its pure transitions for poll results, keys, clicks and the wheel | `model`, `poller`, `reader` types |
| `src/theme.ts` | Colour roles, category colours and the lamp cadence, all from the design system | `@industrial-os/design-system` |
| `src/canvas.ts` | A cell grid with text, rules, numerals and hit regions, emitted as design-system lines | `@industrial-os/design-system` |
| `src/view/*.ts` | Pure drawing: `frame` (header, machine row, footer, failures), `layout`, `list` (scrolling), `pipelines`, `schedules`, `modal`, `parts` | `canvas`, `model`, `theme`, `ui` types |
| `fixtures/` | Invented replies and the fake `tatsu` with its scenarios | — |

Runtime dependencies are `effect` and `@effect/platform-bun`, both exactly 4.0.6; development dependencies are `typescript` 7.0.2 and `@types/bun` 1.4.4. All are locked in `bun.lock`. `@industrial-os/design-system` is not in the manifest: Bun resolves it from the repository root's `node_modules`, which the root `npm install` links, and it is imported only through exported subpaths. All six consumed subpaths ship colocated `.d.mts` declarations in the design system, including `foundation/industrialos-colors`; no local ambient shim or `allowJs` is needed.

## Flows

**Opening.** `open` runs `herdr plugin pane open --plugin industrial-os.automations-monitor --entrypoint monitor --placement split --direction right --focus`; `open-tab` passes `--placement tab`. Herdr starts `sh bin/automations-monitor.sh pane` from the plugin directory. The launcher runs `bun bin/automations-monitor.ts` (not `exec`, so it can hold an error on screen); Bun runs the TypeScript directly.

**Startup.** `runMain` provides the reader layer (the Bun child-process spawner with its file-system and path layers) and the scoped terminal layer. Acquiring the terminal installs `SIGHUP`, `SIGTERM`, `SIGINT`, `uncaughtException` and `unhandledRejection` handlers, enters the alternate screen, hides the cursor, enables SGR mouse reporting and raw mode, and starts reading input.

**The loop.** Three streams merge into one: terminal events, poll events, and ticks timed to the next visible change (the next lamp edge while something blinks, else the next second). Each event folds through `ui.update` or `ui.applyPoll`; the frame is rendered from the state and the pane size, and only the rows that differ from the last frame are written. The frame also settles the scroll position, which goes back into the state. `R` offers to the refresh queue.

**Polling.** A cycle runs `pipelines`, then `schedules`, sequentially, so at most one `tatsu` process exists at a time. The next cycle starts `POLL_INTERVAL_MS` (10 s) after the previous one finished, or at once on a refresh while idle; refresh requests made during a read are cleared after it, not queued. Each cycle reports both results separately, so one failing command does not hide the other's data.

**Exit.** `Q` restores the terminal synchronously, then ends the stream; leaving the scope interrupts the read in flight, whose own scope terminates its process group and waits for it. A signal restores at once and asks the loop to quit the same way; `runMain` also interrupts on `SIGINT` and `SIGTERM`. An error thrown outside the fibers restores at once and fails the program with a defect. Only after every scope has closed does the `runMain` teardown exit, with 0 for quitting and signals and 1 for a failure, after writing a redacted one-line message. Restoration is idempotent.

**Frame mode.** `--frame COLSxROWS` reads both commands once, renders one frame at that size to stdout and exits, without touching the terminal; `--plain`, `--no-motion`, `--time`, `--screen`, `--log` and `--modal` choose the frame. Other arguments print the usage and exit 2.

## Data contract

The monitor runs exactly two commands, never through a shell, with stdin closed and stderr discarded:

```
tatsu automations pipelines --json
tatsu automations schedules --json
```

The executable is `$AUTOMATIONS_MONITOR_TATSU` when set and non-empty, else `tatsu` from the pane's `PATH`.

**Bounds.** Each read has an 8 s timeout and a 4 MiB output cap. Each runs as its own process-group leader. On a timeout, the cap, or an interrupt, the group receives `SIGTERM`, then `SIGKILL` after 1 s if any member remains; the read returns only when the group is empty (Effect's spawner waits up to one more second). After a normal exit the group is cleared the same way, so a descendant left behind never outlives its read.

**Classification**, in this order: a reply with an `error` object is an error envelope (code, redacted message, exit code); then a non-zero exit; then a `schema_version` other than 2 is unsupported; then `data` is decoded. A reply that is not a JSON object is unreadable; a decoding failure is unreadable at the first mismatching path, such as `data.runs.3.phase`, never with its value. A missing executable and a refused spawn are their own failures.

**Fields read.** Everything else, including every path, run ID, issue ID, log and source reference, description and diagnostic, is never decoded.

| Command | Fields |
| --- | --- |
| pipelines | `runner.state`, `observation`, `recorded_at`, `problems`, `service.environment_drift`; `machine.name`, `slots`, `active_slots`; `polling.interval_seconds`, `next_poll_at`, `blocked_reasons`; each pipeline's `name`, `scope`, `definition_state.state`, `enabled`, `slots`, `active_slots`, `blocked_reasons`; each run's `pipeline`, `issue_identifier`, `phase`, `outcome`, `reason`, `admitted_at`, `claimed_at`, `verified_at`, `started_at`, `ended_at` |
| schedules | `runner.state` and `observation` when present, `runner.service.environment_drift`; each schedule's `id`, `definition.state`, `enabled`, `pause_reason`, `timing`, `next_scheduled_at`, `active_run.phase`, `admitted_at`, `started_at`, `last_result.outcome`, `reason`, `ended_at` |

Enumerated display words (reasons, problems, drift) decode as bounded identifiers, so a new value within schema 2 is shown rather than failing the read. Times decode from ISO 8601 UTC to epoch milliseconds.

**Data gaps.** The CLI has no per-pipeline dispatch time (NEXT POLL replaces NEXT DISPATCH), no slot identity for runs (lanes are packed by time), no schedule fire history (the strip shows last, active and next only), and its published schedules schema pins only `service` in `runner` (state and observation are read when present).

## Invariants

- Observe only: no command other than the two reads, no file writes, no Herdr calls from the TypeScript program.
- One `tatsu` process at a time, and none outlives its read or the pane.
- The terminal is restored on every exit path: `q`, `Ctrl-C`, `SIGTERM`, `SIGHUP`, an interrupt, and an uncaught error.
- Rendering is pure: state, size, wall clock and motion time in; exactly `rows` lines of exactly `cols` cells out, each glyph single-cell by the design system's text contract.
- No colour value is written in this project; every colour is a design-system value or a mix of one.

## Where the next change belongs

A new field shown on screen starts in `contract.ts` (and the field table above), then `model.ts`, then a view. A new state or group changes `model.ts` and [design](design.md#states) together. Terminal behaviour stays in `terminal.ts`; timing and the loop in `app.ts`; keys in `ui.ts` and the [interaction table](design.md#interaction). A change to the CLI's schema version is a contract change: update the schemas, fixtures and fake together.
