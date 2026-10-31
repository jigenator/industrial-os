# Contributing

Follow the [root workflow](../../CONTRIBUTING.md). Commands below run from `pi/signals-collector/`.

## Setup

Node.js 22.19+, an **existing** installed Pi (validated baseline 1.0.4), Git and POSIX fixture utilities are required. Tests use Node's built-in runner/type stripping and resolve Pi peers through the host, with no local dependency install/lockfile. No live source-collector engine, gh, provider account or network is used; fake executables, a fake source-collector socket (`SOURCE_COLLECTOR_HOME` always set to a fixture), temp XDG and Git identity/config isolate fixtures. Do not install a missing host to claim a pass. A displayed status-bar also needs the root install linking the design system; this collector itself does not import it.

## Full validation sequence

| Order | Command | Effects/coverage |
| --- | --- | --- |
| 1 | `export PI_HOST_ROOT="$(npm root -g)/@earendil-works/pi-coding-agent"` | Discover existing host peers |
| 2 | `test -f "$PI_HOST_ROOT/dist/index.js"` | Host prerequisite, read-only |
| 3 | `PI_HOST_ROOT="$PI_HOST_ROOT" npm test` | Source-named policy/parser/domain/cache and real-host transport/lifecycle/selection tests; isolated temporary repositories/fake executables, fake source-collector and Herdr sockets, PR cache multiple processes/locks; no live providers |
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

### Final-review corrections

2026-10-08, macOS, Node 22.23.0 and installed Pi 1.0.4: host prerequisite passed; `npm test` **48/48 passed**, no skipped/cancelled tests. New regressions cover non-TUI Active details/restoration, streaming-delta sampling suppression, and a second collector waking on an aborted holder's lock removal. Isolated checkout RPC load: **exit 0**, expected disabled-provider warnings only. Root links/anchors, guide inventory, exact CLAUDE entrypoints and whitespace checks passed. Interactive Pi/Herdr and live providers: **not run**.

### Own lock release

2026-10-08, macOS, Node 22.23.0 and installed Pi 1.0.4: host prerequisite passed; `npm test` **49/49 passed** in three consecutive runs, no skipped/cancelled tests. The new regression makes the cache rename fail and requires no further CodexBar round within 1.5 s of the collector releasing its own lock; before the fix it saw 24 and 27 calls instead of 3. Isolated RPC load with a temporary `PI_CODING_AGENT_DIR` and cache: **exit 0**. status-bar consumer suite: **135/135 passed**. Interactive Pi/Herdr and live providers: **not run**.

### Shared GitHub PR lookup

2026-10-30, macOS, Node 22.23.4 and existing installed Pi 1.4.0:

- Host prerequisite passed using the existing installation discovered through the `pi` executable (this shell's `npm root -g` points at a different Node-managed global prefix); `PI_HOST_ROOT` was set explicitly to that existing host. No install or dependency change.
- `PI_HOST_ROOT="$PI_HOST_ROOT" npm test`: **62/62 passed**, no failed/skipped/cancelled tests. Includes independent-process simultaneous same-key single gh invocation, original shared timestamp/expiry, different repository/branch/default HOME/config metadata and explicit auth/config bypasses, positive/negative whitelist and eviction bounds, malformed/oversized files, stale abandoned-lock recovery, abort/timeout/contention deadline, failed atomic rename cleanup, and real-loader selection/session cancellation plus bypass session-local TTL. All gh calls were fixture executables, not live GitHub.
- Isolated `printf '' | pi --mode rpc --no-extensions --extension .` with temporary agent/cache roots: **exit 0**. Non-TUI activation remains collection-free. No live configuration changed.
- Root changed-document links/anchors, supporting-guide inventory, exact CLAUDE entrypoints, whitespace and import/publication review passed. Simplification: one bounded PR file and one global lock, no per-key file registry, watcher, daemon or new dependency; local Git and the existing quota implementation were not changed.
- Interactive Pi/Herdr, live GitHub/auth/keychain behavior, Windows and consumer suites: **not run**. The documented narrow simultaneous-stale-taker extra-fetch race and explicit-override non-sharing are retained limitations, not fresh-lock stampedes or uncoordinated fallbacks.

### Off-screen visibility freeze

2026-10-31, macOS, Node 22.23.4, existing Pi 1.4.0 and Herdr 0.9.5/protocol 22:

- npm's global prefix did not contain Pi (prerequisite failed there); the existing executable identified an already installed host instead. With `PI_HOST_ROOT` set to that host, the prerequisite and `npm test` passed: **68/68**, no failed/skipped/cancelled tests. No packages installed.
- Fake-socket tests cover workspace/tab/zoom visibility, moves (later reads use the new pane ID), ignored other-workspace/tab updates, reconnect/failure unknown, disposal, malformed/oversized input and no polling. Real-loader tests cover hidden Git/PR/usage gating, deferred Active inspection, current lifecycle signals, visible/unknown catch-up and resumed intervals. Quota watch/lock tests remain green. Fixtures disable inherited live Herdr environment except when pointing to fake sockets.
- Isolated RPC package load with temporary agent/cache roots and `HERDR_ENV=0`: **exit 0**. No live Pi reload/configuration or Herdr socket access. Schema inspection was read-only; public source citations are in [architecture](docs/architecture.md#herdr-visibility-flow-and-evidence).
- Consumer suite: **138/138 passed**. Root changed-document links/anchors, mapped-guide inventory, exact CLAUDE entrypoints, whitespace and import/publication self-review passed; index empty.
- Simplification reviewed the full diff against merge base `00ea975`, including new files and surrounding callers. Retained a minimal independent visibility socket client, centralized footer repaint suppression, reused existing stop/resume motion and cache locks; removed mixed acknowledgement/request cancellation bookkeeping. No generic transport package, dependency, provider registry or cross-extension import.
- Interactive Pi/Herdr, live GitHub/CodexBar, Windows and Mermaid rendering: **not run** (no renderer on PATH; diagram unchanged). Independent final review remains a parent-owned gate, not implied by these checks.

### Usage via source-collector

2026-10-31, macOS, Node 22.23.4 and existing installed Pi 1.4.0:

- Settings precheck: Pi 1.4.0's settings schema allows additional top-level properties and settings files are not validated. A probe extension run with `printf '' | pi --mode rpc --no-extensions --extension <probe>` and a temporary `PI_CODING_AGENT_DIR/settings.json` read `pi.getSettings().industrialOs.usageSources` intact (exit 0). No real settings file read or changed.
- npm's global prefix again lacked Pi (prerequisite failed there); `PI_HOST_ROOT` was set to the existing host behind the `pi` executable, where the prerequisite passed. `PI_HOST_ROOT="$PI_HOST_ROOT" npm test`: **63/63 passed** in each of four runs, the last after the final edits, no failed/skipped/cancelled tests. New: the socket path rule, scoped `get` request, error/mismatched/malformed/closed/oversized replies, timeout and abort against a fake socket; the setting, the state table, defensive item validation, unreachable-after-success and the poll lifecycle (immediate, 60s, hidden, show, overlap, dispose) with mock timers; real-loader configured order, session replacement/shutdown fencing and non-TUI no-connection. The CodexBar fetch/cache tests are deleted with their code. Every fixture sets `SOURCE_COLLECTOR_HOME` to a temporary path; no live engine or socket was touched.
- Isolated `printf '' | pi --mode rpc --no-extensions --extension .` with temporary agent, cache and `SOURCE_COLLECTOR_HOME`: **exit 0**.
- The documented jq transform was run with jq 1.7.1 on CodexBar-shaped fixture payloads: Claude, Codex and Kimi each gave one valid item, and an error payload exited non-zero. Not run against live CodexBar or a running engine.
- herdr-sidebar suite after removing its CodexBar composition fixture: **114/114 passed**. status-bar suite, after the root `npm install`: **137/138**; the failure is `test/signals.test.ts`, which still expects `usage.installed === false` and belongs to the footer change.
- Root changed-document links/anchors, decision inventory, exact CLAUDE entrypoints and `git diff --check` passed. Mermaid rendering: **not run**, no diagram changed.
- Interactive Pi/Herdr, a live source-collector engine, live CodexBar and Windows: **not run**.
