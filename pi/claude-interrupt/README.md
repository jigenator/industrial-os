# pi-claude-interrupt

A minimal [Pi](https://github.com/earendil-works/pi) extension for Claude-style interrupt-and-continue with ordinary queued **text**.

While Pi is working, submit text normally (steering) or with `Alt+Enter` (follow-up), then press `Esc`. The active response aborts and Pi continues on the queued text, steering before follow-ups. Your unsent draft stays in the editor. A one-row **DIRECTIVE UPDATED** marker confirms the continuation and remains in transcript history.

No submitted queue means native Escape behavior. If continuation preflight fails, press Escape again to restore the captured text to the editor. Check the transcript before resubmitting: a slow preflight can still start after recovery.

## Install

This package lives in the [Industrial OS](../../README.md) monorepo. Pi's git sources load a repository's root package, and the monorepo has none, so install from a local checkout:

```sh
pi install <industrial-os checkout>/pi/claude-interrupt
```

Pi loads a local package from that path without copying it or installing its dependencies; this package has no runtime dependencies. Pull the checkout to update it, then restart or reload Pi.

For local development without changing Pi's settings:

```sh
pi --no-extensions --extension .
```

The package has an explicit `pi.extensions` manifest. Pi supplies its extension and TUI APIs.

## Limitations

This is best-effort and text-only. Queued attachments, compaction-time queues and combinations with other input-transforming extensions are unsupported. Completely unobserved queues stay native; mixed observed/unobserved queues cannot be detected reliably. See [engineering limits and recovery](docs/architecture.md#evolution-and-known-limits).

It listens for physical Escape, not a remapped `app.interrupt` binding. There is no reduced-motion setting. See [keyboard and motion behavior](docs/design.md#accessibility-and-platform-behavior) and the [marker specification](docs/design.md#directive-updated-marker).

## Compatibility

Tested against `@earendil-works/pi-coding-agent` **0.99.1** (development dependency) and **1.0.4** (the same test suite run against an installed copy) on Node.js 22. See [verification records](CONTRIBUTING.md#verification-records) for the boundaries of that evidence.

## Guides

- [Agent guide](AGENTS.md): task routes and critical constraints.
- [Contributing](CONTRIBUTING.md): setup, checks, coverage and verification records.
- [Mission](docs/mission.md): scope and non-goals.
- [Architecture](docs/architecture.md): flows, contracts and limits.
- [Conventions](docs/conventions.md): TypeScript and Pi engineering rules.
- [Design](docs/design.md): interaction and marker specification.

License: [MIT](LICENSE).
