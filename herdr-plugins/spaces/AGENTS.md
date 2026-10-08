# Agent guide

Follow the [root](../../AGENTS.md) and [plugin group](../AGENTS.md) guides.

## Critical rules

- [Token contract](docs/token-contract.md) is canonical. Change it first and
  trace `src/model.mjs`, `src/reporter.mjs` and `herdr/spaces.toml` together.
- Only complete, validated, generation-current workspace/pane reads may publish.
  `workspace.metadata_updated` is neither subscribed nor activity.
- Never treat a failed report as accepted. Names have no TTL; counts and age
  have TTL. Use the one stable source and monotonic clock-based sequence.
- Never plan to move the focused unit in a current snapshot; recheck the event
  epoch before dispatch (the unavoidable focus race is documented in architecture); preserve non-quiet user order. Reorder only on
  quiet-set/order changes and at most once a minute, in one atomic block move.
- All tests use fake sockets/temp directories. Never install/link/enable a
  plugin, modify live config or mutate a live server during verification.

## Read for the task

| Task | Route |
| --- | --- |
| Tokens, text or quietness | [Contract](docs/token-contract.md), [design](docs/design.md), [mission](docs/mission.md) |
| Protocol, history, locks, lifecycle or ordering | [Architecture](docs/architecture.md), [conventions](docs/conventions.md), Herdr source matching the supported version |
| Any change or verification | [Contributing](CONTRIBUTING.md), then repository-wide checks |

## Placement

`src/model.mjs` is pure; `transport.mjs` owns bounded wire operations;
`reporter.mjs` owns accepted state/seq/backoff; `state.mjs` owns local persistence,
locks and diagnostics; `daemon.mjs` owns lifecycle/reconciliation; `bin/spaces.mjs`
is the CLI/ensure seam. Tests belong in `test/`. No code from Pi is imported.
