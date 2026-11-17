# Engineering conventions

The [repository-wide conventions](../../../docs/conventions.md) and the [Pi guide](../../AGENTS.md) apply. This adds only this project's rules.

## Project profile

One TypeScript ESM file run by Pi's loader and, in tests, by Node 22.19+ type stripping. Host types come from `import type` only, so tests need no Pi host. Scope reviewed: the whole project at its first version.

## Rules

**Fail closed.** Anything unexpected, a malformed line, a wrong identity, a missing command, a throw inside the command, ends in an `error` reply or a closed socket, never an action and never terminal input.

**One check, then the native call.** The last state check and `ctx.reload()` or `ctx.shutdown()` run in the same synchronous stretch of the command handler.

**The contract is shared.** [docs/contract.md](contract.md) is canonical; this file and the mod's `reloader.js` follow it, and a change lands on both sides with their tests.

**Tests stay offline.** A stub Pi and a fake `hc`; the only socket is the guard's own loopback listener.

## Adoption gaps

| Gap | Next change | Verification |
| --- | --- | --- |
| No type check: there is no development dependency or lockfile, and the host types are not resolved in the repository | Add a pinned development Pi and `tsc --noEmit` if the extension grows | `tsc` |
| No interactive check of the warning shown when publishing fails | Run Pi in Herdr desktop with `hc` missing from `PATH` | Manual |
