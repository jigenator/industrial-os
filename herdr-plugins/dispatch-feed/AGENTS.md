# Agent guide

Follow the [root](../../AGENTS.md) and [plugin group](../AGENTS.md) guides.

- Never use live Herdr or mutate a live engine during development. Tests use
  temporary fake Unix sockets. Use `--read-only` for separately authorized real
  data inspection; it forbids act, look and refresh at the transport boundary.
- Import design-system exported subpaths by package name only; no collector
  source imports. Colors, reusable elements and motions belong to the system.
- Unknown is never zero. Do not discard the last good snapshot on socket failure
  or replay a mutation with an unknown outcome. Preserve failed to-do input.
- Keep terminal restoration, bounded timers and cancellation in `terminal.ts`
  and `transport.ts`; rendering is pure. Every mouse action needs a keyboard path.
- The decode exception is bounded to 600 ms; full health/error messages stay
  outside it. Motion off settles immediately with no animation timer.

## Routes

| Task                                   | Read                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Any code or validation                 | [Contributing](CONTRIBUTING.md), [conventions](docs/conventions.md)                                     |
| Wire, state, lifecycle, packaging      | [Architecture](docs/architecture.md), the [collector contract](../../source-collector/docs/contract.md) |
| Layout, input, motion or source states | [Design](docs/design.md), [README](README.md)                                                           |
| Scope                                  | [Mission](docs/mission.md)                                                                              |
