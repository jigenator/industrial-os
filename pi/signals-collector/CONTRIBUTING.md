# Contributing

Follow the [root workflow](../../CONTRIBUTING.md). Commands below run from `pi/signals-collector/`.

## Setup

Node.js 22.19+, an **existing** installed Pi (validated baseline 1.0.4), Git and POSIX fixture utilities are required. Tests use Node's built-in runner/type stripping and resolve Pi peers through the host, with no local dependency install/lockfile. No CodexBar/gh/provider account/network is used; fake executables/temp XDG/Git identity/config isolate fixtures. Do not install a missing host to claim a pass. A displayed status-bar also needs the root install linking the design system; this collector itself does not import it.

## Full validation sequence

| Order | Command | Effects/coverage |
| --- | --- | --- |
| 1 | `export PI_HOST_ROOT="$(npm root -g)/@earendil-works/pi-coding-agent"` | Discover existing host peers |
| 2 | `test -f "$PI_HOST_ROOT/dist/index.js"` | Host prerequisite, read-only |
| 3 | `PI_HOST_ROOT="$PI_HOST_ROOT" npm test` | Source-named policy/parser/domain/cache and real-host transport/lifecycle/selection tests; isolated temporary repositories/fake executables, cache watcher/multiple processes/locks; no live providers |
| 4 | `printf '' \| pi --mode rpc --no-extensions --extension .` | Real CLI package/load gate; non-TUI collector does no collection/model call; expected disabled-provider model-pattern warnings; exit 0 required |

Then follow [repository-wide checks](../../CONTRIBUTING.md#repository-wide-checks). Consumer composition/load-order/byte checks and existing renderer tests run in status-bar's own sequence. Use `node --experimental-strip-types --test test/<source>.test.ts` for a focused iteration; Pi-boundary tests still require `PI_HOST_ROOT`. No declared formatter/linter/build/standalone project typecheck. MockTimers/type-stripping experimental warnings are expected on Node 22.

## Review

Trace each signal's boundary from module through snapshot/tests/contract. Confirm no extension-to-extension imports, raw identities/output persisted, render work, uncontrolled retries, stale callbacks, native/user configuration or live network fixtures. Keep settings policy here and parity arithmetic vectors synchronized with the footer. New additive optional fields stay v1; removing/renaming/changing meaning needs versioned channels and a concrete consumer migration.

## Verification records

Record date, installed Node/Pi versions, test counts and exact command results. Keep automated, non-interactive CLI-load and interactive evidence separate; offline goal/fleet fixtures are not live producer qualification. Missing prerequisites/failures are not passes. Interactive Pi/Herdr, Windows, real git installation and live providers are not implied by a loader test.

2026-10-08, macOS, Node 22.23.0 and installed Pi 1.0.4:

- Host prerequisite and `npm test`: **44/44 passed** (no skipped/cancelled tests). Includes original moved workspace/usage tests, context vectors, private-record/target/question validators, real-loader session/publish/selection/phase/fleet tests, independent-process ordinary cache contention, watch reload, stale takeover, failure/timeout/privacy/mode/atomic writes and five-minute freshness.
- Isolated non-interactive CLI load (temporary agent/cache directory): **exit 0**; also loaded both actual packages together in RPC mode, **exit 0**. Non-TUI activation collects nothing. This is not interactive evidence.
- Consumer suite is recorded in status-bar's contributing guide. Root local links/anchors, guide inventory, exact CLAUDE entrypoints, whitespace/publication/import review passed.
- Interactive Pi/Herdr, live GitHub/CodexBar/fleet/pi-goal producers, Windows and a real git install: **not run**. No push or live configuration change.

Follow-up on the same toolchain: **45/45 passed** after adding a wall-clock-jump regression and using a monotonic 100ms push budget (wire timestamps remain Date.now epoch values). Status-bar re-run: **135/135 passed**. Both changed architecture diagrams rendered with existing grok-mermaid 0.2.3, non-null art and no warnings; the root manifest CLI RPC load exited 0 in an isolated temporary agent/cache directory.

Final budget check: **45/45 collector and 135/135 consumer tests passed** after rounding timer deadlines up and rechecking early wakes before publishing; the wall-clock-jump regression now asserts at least 100ms between pushes. This does not claim a hard real-time event-loop latency guarantee.
