# Mission

Collect each configured local source once for any Industrial OS screen that asks.
Keep source-specific queries and routines private while sharing one generic,
truthful snapshot contract.

## Goals

- One per-user owner for scheduling, source execution, persistence and triage.
- Survive ordinary restarts with last-known data visibly stale.
- Let commands and Markdown checklists share the same item shape.
- Keep polling clients simple, independent and free of collection I/O.

## Non-goals

No dashboard, push subscriptions, account adapters, company workflows, credential
store, remote server, plugin system, prioritisation policy or process sandbox.
This does not replace Pi's session-scoped signals collector.
