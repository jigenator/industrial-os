# Engineering conventions

The [root conventions](../../../docs/conventions.md) and [plugin group rules](../../AGENTS.md) apply. The stack is fixed by the [stack decision](../../../docs/decisions/automations-monitor-stack.md).

## Rules

- TypeScript run directly by Bun 1.4.4, with no bundle or emit. `tsc --noEmit` (TypeScript 7.0.2) passes under the strict options in `tsconfig.json`; `skipLibCheck` stays on because Effect 4.0.6's declarations reference a DOM-only type.
- Dependencies are exact versions in `package.json`, locked in `bun.lock`, installed with `bun install --frozen-lockfile`. Add one only for a current need, after reading its documentation for the locked version.
- Effect structures the program: Schema for decoding, `effect/process` for the reads, `Stream` and `Queue` for polling, `Context.Service` and `Layer` for the reader and terminal, `Scope` for teardown, `BunRuntime.runMain` as the entry. Pure modules (`model`, `ui`, `view/*`, `canvas`) stay plain functions with no Effect, clock or I/O.
- Import the design system only by package name through an exported subpath. A subpath without declarations gets a minimal declaration in `types/`, removed once the package ships one.
- No colour value is written anywhere in the project, tests and fixtures included; `test/source.test.ts` rejects one.
- Time reaches the pure code as an argument (`now`, and motion time `t`); only `app.ts` and the reader read a clock.
- Everything is drawn through `Canvas`, which keeps printable ASCII, the design system's one-cell `GLYPHS` and the few glyphs listed once in `EXTRA_GLYPHS`, and finishes each row with the design system's `fitLine`.
- Error messages are redacted before they are stored. Never log or print stdout, stderr, paths or data from the CLI.
- Tests use the fake `tatsu` and temporary directories, never the real CLI, the terminal of the test runner, or Herdr.

## Known gaps

No license has been selected, no CI, no Linux or Windows run. The design system has no declaration for `foundation/industrialos-colors`. Bun's `process.stdin` cannot watch `/dev/tty` itself on macOS (the PTY check passes the device by name); Herdr gives the pane a terminal device directly. Cell widths follow the design system's contract, not a terminal-width oracle. No soak or memory measurement exists.
