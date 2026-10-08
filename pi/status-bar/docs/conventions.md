# Conventions

Follow [root conventions](../../../docs/conventions.md) and the [Pi guide](../../AGENTS.md). Pi Status Bar is TypeScript ESM for Node 22.19+, with host Pi/TUI peers and the root-linked design system. Tests run via Node type stripping using an existing global host. There is no standalone project typecheck, formatter/linter/build/CI gate or extension-local install/lockfile; the optional public-subpath declaration specimen is not a project typecheck. Commands/evidence are canonical in [contributing](../CONTRIBUTING.md).

## Engineering and module rules

`src/extension.ts` owns display lifecycle/observers/timers, `src/signals.ts` local wire DTOs and event discovery, and `src/footer.ts` pure rendering/decoration. Matching tests live under `test/`. No collection, subprocesses, settings-reserve lookup, persistence or I/O during rendering. Collection lives in [signals-collector](../../signals-collector/docs/architecture.md), accessed **only** through its [event contract](../../signals-collector/docs/contract.md), never an import. No generic utils/shared/service layer or speculative registry.

Use explicit snapshots/results and extract only truly shared semantics. The pure footer retains width admission, Unicode/SGR sanitization and exact paint/reset behavior. Palette and element/motion code use exported `@industrial-os/design-system/<group>/<name>` subpaths; no copied hex/channel constants in source, relative project paths or `motions/frame`. The [rendering seam](architecture.md#design-system-rendering-seam) documents approved host compatibility effects (Tatsu warm-up/USG boot can hide state text), permissive renderer-only count arithmetic, and unchanged DS cue protection. Change the design system first for a shared palette value.

## Types and validation

Unknown is never zero/clean/success: preserve the locally typed workspace/PR/usage wire unions and nullable fields. Validate snapshot version/live session ID and safe sequence; subscribe before synchronous request and re-request on ready. Absence/asynchronous discovery becomes unknown. Ignore additive fields and stale sessions. Dispose both listeners at replacement/shutdown. No provider import or per-render request. The approved pure CTX arithmetic/live-host exception and identical vector table are in [architecture](architecture.md#context-parity-exception); settings policy stays only in collector.

Untrusted terminal text is sanitized and width-bounded by `safeText`/Pi utilities. Known host statuses remain original SGR style through wrapping; any new rendering sink must retain that behavior. Never persist raw external credentials/diagnostics or infer success from absence.

Ponytail consumes only verified bounded status text on key `ponytail`. OFF requires observing an explicit clear, never absence. The narrow public setStatus tap forwards original receiver/arguments/results/errors, detaches reversibly and never overwrites foreign wrappers/stacks across replacements. Shared-UI/load-order assumptions and activation are in [architecture](architecture.md#ponytail-status-integration).

Tatsu consumes validated public v1 snapshots only; no formatter/provider imports/checks/polling. Subscribe before synchronous request; valid checking/completed replaces only the presented raw key, retains the last completed during checking and clears on invalid/inactive/absent. No provider text/detail/reason/SHAs enter state. Session/component/UI guards apply. Background tasks recognize only pinned 2.6.9 text grammar in the pure `backgroundTasks` parser; all unrecognized text remains raw EXT. No missing status means zero/OFF.

## State and performance

Session state is display-only. Replacement/tree/shutdown clears signal/Tatsu/PNYTL observation, animation and repaint timers; stale components cannot dispose replacements. Motion choice persists only within the same session. Decoration uses one unref'd timeout selected by the renderer with 50ms transient granularity, no free-running collection interval or catch-up loop; off settles it without stopping live values. A separate unref'd USG repaint timeout only updates countdown/stale-age text. ROOT is a live isIdle read, not inferred from AU/events. No data I/O or fleet/CodexBar calls happen here.

Existing host serialization avoids an extra ANSI/grapheme truncation scan only for already-fitting rows with known single-cell glyphs; untrusted text remains host-measured. Original bounded render measurements/parity records are in contributing; no new full-host performance/Herdr measurement is claimed. Measure before proposing additional caches/workers/timers.

## Tests

- `test/footer*.test.ts`: preserve original renderer assertions, states, widths, color, motion and sink sanitization. One-line shards distribute width sweeps with `sweepWidths`; new sweeps must be listed in `widthCases`.
- `test/context.test.ts`: identical collector/renderer percentage vectors without cross-project imports.
- `test/extension.test.ts`: actual installed Pi loader/runner for live values, PNYTL/Tatsu/BG/motion/status fallback and display disposal. Producer fixtures use snapshots, not a display-owned collector.
- `test/signals.test.ts`: absent/deferred/mismatched/stale snapshots, ready/disposal and both actual package load orders through Pi's loader, with rendered bytes compared to the existing pure renderer.

Workspace/usage/collection tests moved to their owner's test tree. Fixtures use isolated temp Git/cache/session state, fake executables and no live account/network/configuration. A missing host is a failed prerequisite, not a passing/skipped integrated test. Automated, CLI-load and interactive checks remain separate.

## Adoption gaps

- No standalone static/format/build/CI gate or dependency-pinned host/lockfile. Tests use the global host by design; add tooling only with approved need.
- No license: no LICENSE or manifest license field; repository licensing remains unresolved.
- Interactive Pi/Herdr, subjective glyph/color/motion/ambiguous-wide terminals and Windows are unverified. No live PNYTL/Tatsu/background-task producer/provider qualification is implied by offline fixtures.
- Collector-specific optional fleet/CodexBar/GitHub/private-goal limitations are recorded by [the collector](../../signals-collector/README.md#limits). Agent-reported Active may be stale if its declaration is omitted.
- Legacy state-hiding compatibility effects remain host-owned; any visual/policy correction requires a separately approved change, not weakening DS protections.
