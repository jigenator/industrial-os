# Agent guide

Follow the [root guide](../AGENTS.md). This is a standalone Bun project, not a Pi
extension or Herdr plugin. No project imports its implementation.

## Critical rules

- [Contract](docs/contract.md) and `src/contract.ts` own v1. Unknown is not zero.
  Schema-decode configs, outputs, RPC inputs and stored JSON at their boundaries.
- One runner owns the store. Acquire the exclusive lock before opening state.
  Never reset an unknown schema or signal a PID from an unverified file.
- Shell-free argv, private runtime files, bounded streams and scoped children.
  Keep the combined fetch/transform timeout and process-group escalation tests.
- Checklist writes preserve other lines and verify mtime/size/hash immediately
  before replacement. Never write a real memory file during tests.
- Every mutation records its actor locally. No raw stdout, secrets, config, argv
  or env in operational logs. `check` is the explicit terminal diagnostic path.
- Tests use only temporary state, fake sources and mocked native service commands.
  Never install a service, invoke real launchctl or touch live account/config data
  as verification.

## Read for the task

| Task                                       | Route                                                                                                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any code or verification                   | [Conventions](docs/conventions.md), [contributing](CONTRIBUTING.md)                                                                                        |
| Config, RPC, storage, scheduler or runners | [Contract](docs/contract.md), [architecture](docs/architecture.md)                                                                                         |
| Snapshot states, counts or attribution     | [Design](docs/design.md), contract, architecture                                                                                                           |
| Scope or runtime changes                   | [Mission](docs/mission.md), [service decision](../docs/decisions/source-collector-service.md), [runtime decision](../docs/decisions/bun-effect-runtime.md) |

## Placement

Contracts stay in `src/contract.ts`; all state SQL stays in `src/store.ts`.
`derive.ts` is pure. `engine.ts` wires ownership and adapters; it owns no new
schema or attribution policy. Tests live in `test/`, fake sources in `examples/`.
