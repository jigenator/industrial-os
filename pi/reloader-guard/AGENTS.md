# Agent guide

Purpose: the draft guard that the Herdr desktop Pi Reloader mod talks to. This project supplements the [root guide](../../AGENTS.md) and the [Pi guide](../AGENTS.md); usage is in the [README](README.md).

## Critical engineering rules

- Never write to the editor, type into a terminal, or send the draft text anywhere. Probes report only `ready`, `draft` or `busy`. Check: `test/extension.test.ts`.
- Act only on a request whose token and session match, and recheck idle, queue and editor inside the dispatched command, with no await between that check and Pi's `reload()` or `shutdown()`. Check: `test/extension.test.ts`.
- The wire protocol and label are [the contract](docs/contract.md), shared with `herdr/mods/industrial-os/reloader/reloader.js`. Change the contract first, then both sides and their tests in one change.
- TUI only, and only with `HC_TERMINAL_ID`; listen on loopback only; no I/O other than the listener and `hc label` on its own terminal. Check: `test/extension.test.ts`.
- Tests never touch a real Pi, `hc` or Herdr: they use a stub Pi and a fake `hc`.

## Read for the task

| Task | Read before changing |
| --- | --- |
| Code or tests | [Architecture](docs/architecture.md), [conventions](docs/conventions.md), then [contributing](CONTRIBUTING.md) |
| The protocol or label | [Contract](docs/contract.md), then the mod's [architecture](../../herdr/docs/architecture.md) |
| What a person sees | [Design](docs/design.md) and the [mod's design](../../herdr/docs/design.md#pi-reloader) |
| Why it works this way | [The decision](../../docs/decisions/pi-reloader-desktop.md) |

## Where work belongs

| Change | Start here | Boundary |
| --- | --- | --- |
| The guard: listener, label, validation, dispatch | `src/extension.ts` | Pi's public extension API and Node's standard library; host peer only |
| Its checks | `test/extension.test.ts` | Stub Pi, fake `hc`, the real loopback listener |
| The reload or reset sequence, the overlay | `herdr/mods/industrial-os/reloader/` | Not here; see [the Herdr guide](../../herdr/AGENTS.md) |

## Implement and verify

Use the [validation sequence](CONTRIBUTING.md#validation-sequence), then the [repository-wide checks](../../CONTRIBUTING.md#repository-wide-checks). Keep automated, Pi-load and live Herdr evidence separate.

## Supporting documents

| Document | Purpose | Read when |
| --- | --- | --- |
| [README.md](README.md) | Purpose, install, privacy and limits | Using the guard or changing its install |
| [AGENTS.md](AGENTS.md) | Rules and routes | Working here |
| [CLAUDE.md](CLAUDE.md) | Runtime import of this guide | Checking entry points |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Commands, validation and records | Making or verifying a change |
| [docs/architecture.md](docs/architecture.md) | Flow, state, host seams and invariants | Changing behavior or dependencies |
| [docs/contract.md](docs/contract.md) | The label and wire protocol | Changing anything the mod reads or sends |
| [docs/conventions.md](docs/conventions.md) | Engineering rules and gaps | Writing or reviewing code |
| [docs/design.md](docs/design.md) | What a person sees from the guard | Changing a message or a guarantee |
