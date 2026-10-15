# Agent guide

Follow the [root](../../AGENTS.md) and [plugin group](../AGENTS.md) guides.

## Critical rules

- Colors come only from `src/palette.rs`, which mirrors the design system's Acid / Black roles. Change `design-system/foundation/palette.mjs` first, then `palette.rs`; `test/palette.test.mjs` fails on any difference or any color written elsewhere.
- Never overwrite a board that failed to load, and never report a failed save as saved. Errors are worded in the status line, not shown by color alone.
- Every mouse action keeps a keyboard path. Interaction changes update the table in the README and [design](docs/design.md) together.
- Rendering (`src/ui.rs`) is pure: it reads `App` and writes only the frame and the hit regions it drew. File I/O stays in `board.rs` and is called from `app.rs`.
- Tests never touch live Herdr. The isolated Herdr check in [contributing](CONTRIBUTING.md#isolated-herdr-check) is the only Herdr validation; installing into a live session is for the operator.

## Read for the task

| Task | Route |
| --- | --- |
| Input, editing, rendering or states | [Design](docs/design.md), [architecture](docs/architecture.md) |
| Board files, paths or the Herdr entrypoints | [Architecture](docs/architecture.md), the [Herdr plugin docs](https://raw.githubusercontent.com/herdrdev/herdr/v0.9.3/docs/next/website/src/content/docs/plugins.mdx) for the supported version |
| Rust, dependencies or checks | [Conventions](docs/conventions.md), [contributing](CONTRIBUTING.md) |
| Scope | [Mission](docs/mission.md) |

## Placement

`src/board.rs` owns the board model, wrapping, file format and paths; `src/app.rs` owns input and state; `src/ui.rs` owns drawing; `src/palette.rs` owns colors; `src/main.rs` owns the terminal. `bin/whiteboard.sh` is the Herdr seam. Unit tests sit beside their module; `test/` holds the palette and PTY checks.
