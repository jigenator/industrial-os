# Engineering conventions

The [repository-wide conventions](../../../docs/conventions.md) apply. This guide adds only this project's TypeScript and Pi-extension rules; it is not a second repository rulebook.

## Project profile

The package is ESM TypeScript with one source module, `src/index.ts`, and Node test-runner checks under `test/`. Node type stripping runs the tests; it does not type-check them. `tsc --noEmit` is the only type check, configured with strict NodeNext resolution in `tsconfig.json`. Pi loads the explicit manifest entry. Exact toolchain and commands live in [Contributing](../CONTRIBUTING.md).

Scope reviewed: base revision `bb1ba4a` on 2026-10-07, all package source/tests, manifest, TypeScript configuration and README. The source already separates pure rendering from lifecycle effects within one module. The README needed conversion into canonical guides; no application refactor was performed. Live provider behavior, interactive Pi/Herdr and untested Pi versions remain unknown.

## Engineering principles

These are package applications of the shared principles, not additional global rules.

| Rule | Real example/path | Reason | Check |
| --- | --- | --- | --- |
| Progressive disclosure: route queue and marker tasks separately | [AGENTS](../AGENTS.md) routes an Escape fix to architecture, a visual change also to design | Keep critical constraints visible without requiring unrelated manuals | Review both routes and supporting-document links |
| YAGNI: add no dependency, setting or adapter without a current requirement | `src/index.ts` uses direct Pi callbacks and Node `randomUUID` | There is no current need for an input framework or shared UI package | Review the concrete need and simpler existing alternative for each addition |
| KISS: use public Pi/TUI facilities instead of replacement parsers or renderer classes | `matchesKey`, `isKeyRelease`, `isKeyRepeat`, `theme.style`, `truncateToWidth` | The host owns terminal protocol and color conversion | Review imports; retain real TUI routing and color-mode tests |
| Single source of truth: share matching behavior, not parallel copies | One `renderMarker` serves live and saved entries; `ordered` defines replay order | History and live display must not drift | Review callers; run saved-marker and ordered-replay checks |

## Module and dependency rules

| Rule | Real example/path | Reason | Check |
| --- | --- | --- | --- |
| Use public host imports; keep Pi-supplied packages as `"*"` peers, never runtime dependencies | `package.json` declares `@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui` as peers; development copies are pinned | Avoid bundling a competing host runtime; wildcard peers are not proof of compatibility | Review manifest and the version's Pi `docs/packages.md`, extension docs and public types; run real-loader and installed-host checks |
| Import the design system only by package name through an exported subpath, never by a relative path or an unexported module, and introduce no cycles | `src/index.ts` imports only Node and Pi packages; it does not import the design system yet | The exports map is the design system's only contract with other projects, and an installed extension reaches it only through the root install | Review import graph; moving onto the package is its own change, with the [migration requirements](../../../docs/decisions/in-repo-design-system-package.md#migrating-an-extension) |

Pi uses the default export. Named `createClaudeInterrupt` and `renderMarker` exports support regression tests, not a promised cross-project library API. Keep queue/lifecycle internals private.

## Placement and naming

**Rule:** keep cohesive behavior in the existing source module and explicit checks under `test/`; name a new module for a real responsibility, not `utils` or `helpers`. **Example:** `test/extension-runner.test.ts` names the Pi integration boundary. **Reason:** source and its regressions remain discoverable without speculative folders. **Check:** review each new file's owner and callers before extraction.

## Functions, APIs, and abstractions

**Rule:** separate pure frame rendering from lifecycle state even while they share a file. **Example:** `renderMarker(theme, width, outputPad, elapsed?)` returns a clipped string; `createClaudeInterrupt` owns clocks, queues, UUIDs, timers and Pi calls. **Reason:** every frame and saved entry can be tested without a running agent. **Check:** renderer tests repeat identical inputs and enumerate widths/frames; review that no clock, session read or I/O enters `renderMarker`.

**Rule:** keep colors as named constants and style roles, not inline literals scattered through handlers. **Example:** `acid`, `black`, `bone`, `grey`, `darkGrey`, `livePlate`, `recordPlate` in `src/index.ts`. **Reason:** appearance changes remain local and do not alter queue behavior. **Check:** decoded-cell tests cover dark/light and truecolor/256-color output; the exact palette and timeline are canonical in [design](design.md).

## Types and validation

**Rule:** make lifecycle phase and delivery semantics explicit, and keep runtime guards at Pi event boundaries. **Example:** `Delivery`, `PendingText`, `PendingQueues` and `InterruptState` distinguish delivery kind, image presence and aborting/starting; replay matching checks source, text and absence of images. **Reason:** type stripping cannot establish runtime event identity or lossless replay. **Check:** strict type check plus attachment, replay-duplication and abort-race tests. Do not weaken those guards when simplifying the state machine.

## Errors and diagnostics

**Rule:** unsupported input must stay native or produce an explicit warning, never a success-shaped text replay. **Example:** the queued-image guard leaves Escape native; late images return `{ action: "handled" }`, restore text and notify the user. **Reason:** silent attachment loss is not a successful continuation. **Check:** attachment fallback/rejection tests.

**Rule:** show a marker only at confirmed continuation `agent_start`, and keep failed-start recovery visible. **Example:** a fresh Escape in `starting` restores the captured texts without claiming cancellation of delayed host preflight. **Reason:** an attempted restart is not a completed start. **Check:** failed-start tests in both suites and the marker-gating test. There is no general exception translation or automatic retry layer; do not invent one or log message contents for diagnostics.

## State, I/O, and migrations

**Rule:** the extension owns every timer and terminal subscription it creates and clears them on every relevant exit path. **Example:** `clearAnimation`, `disposeAnimation` and `reset` handle completion, fresh Escape, widget disposal and session cleanup; disposal never recursively calls `setWidget`. **Reason:** retired sessions must not redraw or intercept keys. **Check:** cleanup, late-clock and real session-replacement tests. Never block streaming, input or focus with a wait loop or modal animation.

**Rule:** preserve the Pi-owned queue contract rather than pretending the observer is authoritative. **Example:** `ctx.abort()` restores queued text natively, so the extension immediately restores the saved draft and replays only after settlement. **Reason:** queue clearing and input can race. **Check:** draft-preservation, delivery-order, abort-window and re-interrupt tests; known API limits stay documented in [architecture](architecture.md#data-and-contracts).

**Rule:** persist only the history marker through Pi, not transient replay/animation state or model messages. **Example:** `appendEntry` stores `{ id }` and old entries render settled; shutdown retains `outputPad` as plain data for old components. **Reason:** replaying animation on resume or touching a stale runtime is incorrect. **Check:** real SessionManager persistence/model-exclusion and invalidated-runtime tests. There is no separate database or migration mechanism; test saved entries before changing their data contract.

## Tests

**Rule:** use deterministic harness checks for local behavior and Pi's real loader/runner for integration contracts. **Example:** `test/extension.test.ts` uses a real Theme plus mocked time; `test/extension-runner.test.ts` loads `src/index.ts` through Pi and routes input through a real TuiMainScreen with isolated transport. **Reason:** stubs alone cannot prove API compatibility or asynchronous event ordering. **Check:** both suites via [Contributing](../CONTRIBUTING.md#full-validation-sequence); report manual and provider-backed evidence separately. No test calls a provider, and passing isolated integration tests do not certify Herdr.

## Dependencies and generated output

**Rule:** prefer Node and current host facilities; add no dependency without a current need. **Example:** the package has no runtime dependencies and has its own development lockfile. **Reason:** it must remain a standalone project rather than implicitly requiring a monorepo workspace; the design-system package, once imported, comes from the root install, not this manifest. **Check:** review necessity, license and version-matched API before changing the manifest; use the locked setup and validation in Contributing. `node_modules/` is ignored, there is no emitted build output, and lockfile updates must be deliberate rather than edited by hand.

The marker's palette currently mirrors values the design system owns ([decision](../../../docs/decisions/in-repo-design-system-package.md)). The design system's values take precedence: a change starts in `design-system/foundation/palette.mjs`, then these constants follow. The mirror lasts until this package imports its colors; it is not permission to add further copies. See the adoption gap below.

## Performance and growth

**Rule:** keep frame work bounded and measure before adding runtime machinery. **Example:** the lifecycle owns one animation timeout at a time, advances at least one frame per callback, catches up without replaying every missed frame and stops at its fixed window; the renderer clips one row. **Reason:** display decoration must not become background work after settlement. **Check:** deterministic schedule and cleanup tests; profile a representative terminal/queue workload before proposing an optimization. No production performance baseline or unbounded-queue stress result is claimed.

## Adoption gaps

| Gap | Evidence | Next change / revisit condition | Verification |
| --- | --- | --- | --- |
| Palette values mirror the design system by hand | Named constants in this module; no design-system import yet | Import the colors from `@industrial-os/design-system/foundation/palette`, following the [migration requirements](../../../docs/decisions/in-repo-design-system-package.md#migrating-an-extension); `tsc` needs types for the `.mjs` modules | Review comparison against `design-system/foundation/palette.mjs` and decoded-cell tests |
| No interactive Pi/Herdr record for this move | Automated transport is isolated; RPC only loads the package | Run the manual contributing step when the host is available | Manual check: not run |
| No reduced-motion control | No host setting or extension command is read; animation is bounded but always enabled | Decide on a host signal or explicit control when required | Proposed motion-off check: not implemented |
| Existing development dependency audit finding | On 2026-10-07, `npm audit --json` reported one high-severity vulnerable transitive `brace-expansion` under Pi's development package | Review an authorized dependency/lockfile update separately; no automatic audit fix in this documentation change | Rerun audit, type check and both suites after an approved update |
