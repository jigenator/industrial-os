# Agent guide

Purpose: report this Pi session's state to Herdr's agents sidebar as tokens, display-only; see [README.md](README.md) and [docs/mission.md](docs/mission.md). This project owns its standards and toolchain within the monorepo. Follow the [root guide](../../AGENTS.md) and [Pi guide](../AGENTS.md) as well.

## Critical engineering rules

- Display only. The inputs are the signals-collector snapshot on Pi's event bus and Herdr's agent status for this pane; never run Git, `gh` or CodexBar, read session files, or write anything but Herdr pane tokens and the `herdr:blocked` event. Full rule: [conventions](docs/conventions.md#module-and-dependency-rules). Check: review imports; `test/extension.test.ts`.
- The token contract is canonical in [docs/token-contract.md](docs/token-contract.md). Change it there first, then `src/tokens.ts`, then the rows in [herdr/](../../herdr/README.md). Unknown is never zero or clean. Check: `test/tokens.test.ts` reads the key list from the contract.
- Report only from TUI mode inside Herdr; subagent child processes inherit Herdr's environment and must stay silent. Every socket wait is bounded, failures are swallowed for Pi but recorded as unsynced, never as success; timers are unref'd and disposed. Full rule: [architecture invariants](docs/architecture.md#critical-invariants). Check: `test/extension.test.ts`, `test/sender.test.ts`.
- Every report uses the one source `industrial-os:herdr-sidebar` and a clock-based `seq`; never a per-runtime source. Rationale: [reporting to Herdr](docs/architecture.md#reporting-to-herdr). Check: `test/sender.test.ts`.
- `herdr:blocked` stays balanced: one `true` when a question becomes pending, one `false` when it clears or the runtime ends. Check: `test/extension.test.ts`.
- Tests use a fake Herdr socket server and the globally installed Pi; never the live Herdr. Commands are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Read for the task

Start here and scan the supporting-documents map. Read every document whose `Read when` condition matches the task; do not load unrelated manuals.

| Task | Read before changing |
| --- | --- |
| A token, row rule, width or glyph | [Token contract](docs/token-contract.md), [design](docs/design.md), then the [Herdr design](../../herdr/docs/design.md) |
| Lifecycle, gating, snapshot intake, `herdr:blocked` | [Architecture](docs/architecture.md), [conventions](docs/conventions.md), then [contributing](CONTRIBUTING.md#full-validation-sequence) |
| Herdr socket, sequence, TTL or batching | [Reporting to Herdr](docs/architecture.md#reporting-to-herdr), then the Herdr version's socket API and source |
| Product scope | [Mission](docs/mission.md) and [root mission](../../docs/mission.md) |
| Packaging, Pi version or test-host wiring | [Contributing](CONTRIBUTING.md), then the [Pi guide](../AGENTS.md) |

## Where work belongs

| Change | Start here | Boundary |
| --- | --- | --- |
| Token values and the time they next change | `src/tokens.ts` | Pure: input in, map out; no clock, I/O or Pi state |
| Snapshot validation | `src/snapshot.ts` | Pure; the collector's types are not imported |
| Herdr requests and the agent-status subscription | `src/herdr-client.ts` | Node `net` only; bounded, never throws into Pi |
| Diffing, batching, sequence, TTL and the shutdown clear | `src/sender.ts` | Takes a request function; no Pi state |
| Gating, event-bus intake, `herdr:blocked`, timers, lifecycle | `src/extension.ts` | Public Pi APIs; dispose on every exit |
| Regression coverage | Matching file in `test/` | Fake Herdr server; real installed Pi loader in `test/extension.test.ts` and `test/signals.test.ts` |

## Implement and verify

Trace callers before changing shared behavior. Use the [full validation sequence](CONTRIBUTING.md#full-validation-sequence), then the [repository-wide checks](../../CONTRIBUTING.md#repository-wide-checks). Report automated, Pi-load and interactive Pi/Herdr evidence separately.

## Supporting documents

| Document | Purpose | Read when |
| --- | --- | --- |
| [README.md](README.md) | User purpose, install and limitations | Using the extension or changing public usage |
| [AGENTS.md](AGENTS.md) | Project rules and reading routes | Starting work in this project or changing guidance |
| [CLAUDE.md](CLAUDE.md) | Runtime import of this guide | Checking agent entry points |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Toolchain, commands, validation and records | Making or verifying any change |
| [docs/mission.md](docs/mission.md) | Goals, non-goals and constraints | Choosing scope or changing product behavior |
| [docs/token-contract.md](docs/token-contract.md) | The canonical token contract and geometry | Changing any token, row, width or the key list |
| [docs/architecture.md](docs/architecture.md) | Modules, flows, Herdr reporting, invariants and limits | Tracing behavior or changing lifecycle, I/O or dependencies |
| [docs/conventions.md](docs/conventions.md) | Project engineering rules and adoption gaps | Writing or reviewing code |
| [docs/design.md](docs/design.md) | The sidebar experience from this side: states, truthfulness, timing | Changing anything a user sees |
| [Herdr configuration](../../herdr/README.md) | The rows, colors and width lock that render the tokens | Changing a token the rows reference |
| [Root AGENTS](../../AGENTS.md) | Shared rules and repository guidance map | Working in this repository |
| [Pi AGENTS](../AGENTS.md) | Pi project placement and shared constraints | Working under `pi/` |
