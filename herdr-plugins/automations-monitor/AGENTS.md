# Agent guide

Follow the [root](../../AGENTS.md) and [plugin group](../AGENTS.md) guides.

## Critical rules

- Observe only. The program runs exactly `tatsu automations pipelines --json` and `tatsu automations schedules --json`, one at a time, bounded, with stderr discarded, and never writes files or calls Herdr. A new command or write needs a new decision.
- Never invent data on the live path. Unknown is `?` or `--:--`, never zero; stale and failed reads say so; [design](docs/design.md#truthfulness) holds the wording.
- No local path, ID or raw CLI text on screen: decode only the fields in the [data contract](docs/architecture.md#data-contract), and redact error messages.
- The terminal is restored and every `tatsu` process group is gone on every exit path. `bun test/pty-check.ts` proves it; run it after touching `terminal.ts`, `app.ts`, `reader.ts` or the entry.
- Colours come only from the design system (`src/theme.ts`); no colour value is written in this project. Import the design system only through exported subpaths.
- Visual components come from the design system: views place its elements and draw only plain text themselves. A part that is missing or draws differently is added or extended in `design-system/` first, then used here; see [the rule](../../docs/conventions.md#design-system-components).
- A change that should leave the screen alone, such as a refactor or a design-system move, keeps every golden frame: `bun test/golden/golden.ts compare <base-ref> <out-dir>` reports 0 differences ([golden frames](CONTRIBUTING.md#golden-frames)).
- The stack (Bun, TypeScript 7.0.2, Effect 4.0.6, no bundle) is fixed by the [stack decision](../../docs/decisions/automations-monitor-stack.md). Tests never touch live Herdr or the real `tatsu`.

## Read for the task

| Task | Route |
| --- | --- |
| Anything a user sees: states, layout, keys, colour, wording | [Design](docs/design.md) |
| The CLI contract, polling, terminal lifecycle or modules | [Architecture](docs/architecture.md) |
| TypeScript, Effect, dependencies or checks | [Conventions](docs/conventions.md), [contributing](CONTRIBUTING.md) |
| Scope | [Mission](docs/mission.md) |
| Why Bun and Effect | [Stack decision](../../docs/decisions/automations-monitor-stack.md) |

## Placement

`src/reader.ts` owns all process I/O and `src/contract.ts` the schemas; `src/poller.ts` owns timing of reads; `src/terminal.ts` owns the terminal; `src/app.ts` owns the loop. `src/model.ts` derives states, `src/ui.ts` owns state transitions, and `src/view/` places design-system parts and text on the canvas. `bin/automations-monitor.sh` is the Herdr seam and `bin/automations-monitor.ts` the entry. Tests and the PTY check are in `test/`; invented data and the fake `tatsu` in `fixtures/`.
