# Contributing

Follow the [repository workflow](../../CONTRIBUTING.md) as well as this package's checks.

## Toolchain and setup

Use Node.js 22.19 or newer; the integrated baseline was checked with Node 22.23.0, Pi 1.0.2, Git 2.50.1, and `gh` 2.93.0 on macOS. USG consumes configurable v1 usage snapshots; no installed quota CLI or live source is needed or used by display tests. Pi supplies the two peer packages declared in `package.json`; the footer also imports the root-linked design-system package. Run `npm install` once at the repository root (not this extension folder) before checks or local-path loading. Do not add an extension-local dependency or lockfile for this link.

Tests that exercise Pi need the installed host root. From `pi/status-bar/`:

```sh
export PI_HOST_ROOT="$(npm root -g)/@earendil-works/pi-coding-agent"
test -f "$PI_HOST_ROOT/dist/index.js"
```

This only discovers an existing global installation. Do not run an installer to make a test silently pass. Composition fixtures create disposable repositories under the operating-system temp directory, isolate Git identity/configuration, and use a fake `gh` and a fake `codexbar`; they do not use a live GitHub account, CodexBar, provider account or network. The fakes are POSIX `sh` scripts that need `/bin/sh`, `/bin/sleep`, `/bin/cat` and `/usr/bin/grep`.

The consumed design-system subpaths ship colocated `.d.mts` declarations. `test/design-system-types.ts` is a compile-only contract specimen (not a new standalone project typecheck). It is optional and borrows claude-interrupt's compiler, so it needs claude-interrupt's `npm ci` first. From the repository root:

```sh
./pi/claude-interrupt/node_modules/.bin/tsc --noEmit --strict --module NodeNext --moduleResolution NodeNext --target ES2022 pi/status-bar/test/design-system-types.ts
```

This checks only the public-subpath specimen, not the footer/extension project; no new compiler dependency or build gate is declared.

## Fast loop

Collection/parser/cache changes follow [signals-collector contributing](../signals-collector/CONTRIBUTING.md). For snapshot discovery/absence/load order, run `node --experimental-strip-types --test test/signals.test.ts` after host setup.

For renderer changes after setting `PI_HOST_ROOT`:

```sh
PI_HOST_ROOT="$PI_HOST_ROOT" node --experimental-strip-types --test test/footer*.test.ts
```

`test/footer.test.ts` alone runs only its first shard; the glob runs every shard in parallel processes.

These focused commands do not cover extension lifecycle, package loading, session restoration, or every other module.

## Full validation sequence

Source: `package.json` and the test files under `test/`.

| Order | Directory | Command | Prerequisites/effects | Coverage |
| --- | --- | --- | --- | --- |
| 1 | `pi/status-bar/` | `export PI_HOST_ROOT="$(npm root -g)/@earendil-works/pi-coding-agent"` | Existing global Pi; reads npm's global root | Locates host-provided peers |
| 2 | `pi/status-bar/` | `test -f "$PI_HOST_ROOT/dist/index.js"` | No writes | Fails clearly when the host prerequisite is absent |
| 3 | `pi/status-bar/` | `PI_HOST_ROOT="$PI_HOST_ROOT" npm test` | Creates/removes temp Git/session fixtures; fake `gh` and `codexbar`; no live network | All renderer, package-loader/display lifecycle, snapshot consumer/load-order and parity tests |
| 4 | `pi/status-bar/` | `printf '' \| pi --mode rpc --no-extensions --extension .` | Installed Pi; no model call; model-pattern warnings are expected and harmless because other extensions, including model providers, are off. Outside TUI mode neither display nor collector does collection I/O | Package discovery and extension loading through the installed `pi` command; success exits 0, a throwing extension exits 1 |

Then follow the [repository-wide checks](../../CONTRIBUTING.md#repository-wide-checks). Record every check as passed, failed, skipped, or not run. A missing host is a failed prerequisite, not a passing or skipped integrated suite. The RPC load check is not interactive terminal verification. There is currently no established formatter, linter, standalone typecheck, or build command; do not claim one ran.

## Making a change

1. Trace the current flow in [the architecture guide](docs/architecture.md).
2. Put pure display semantics in `src/footer.ts`, local snapshot DTO/discovery in `src/signals.ts`, and display lifecycle/observation in `src/extension.ts`. Collection belongs in signals-collector, not here.
3. Add the lowest-layer regression test that reproduces the issue. Add `test/extension.test.ts` coverage when a change crosses the real Pi loader or session boundary.
4. Run the focused test while iterating and the full sequence before handoff.

Preserve the public workspace result unions and truthful failure states. Never turn a timeout, malformed response, missing executable, or cancellation into “clean” or “no open PR.”

## Refactoring

Keep structural and semantic changes separate when practical. Preserve behavior with tests before moving code, migrate callers through the existing exported seam, and remove obsolete paths rather than maintaining aliases. Do not create a provider registry, background service, or generic utility module without a current requirement that the existing module split cannot satisfy.

## Review checks

- Dependency direction is `extension -> signals` and `extension -> footer`; footer imports local signal types only plus exported design-system subpaths. No collector imports or collection I/O.
- Untrusted paths, Git names, remote data, and extension statuses remain terminal-safe and width-bounded.
- No subprocess, cache/persistence or settings-reserve lookup remains here. Missing collector displays unknown, never zero/clean.
- Display observers/listeners and repaint/motion timers are disposed; stale callbacks cannot overwrite a newer session/component.
- New behavior has deterministic coverage and no live GitHub or CodexBar dependency.
- YAGNI: every abstraction/dependency serves a current requirement. KISS: compare it with a direct function or existing host API. Single source of truth: shared semantics stay in one module and commands stay here. Progressive disclosure: update the relevant guide and `AGENTS.md` map without making unrelated docs mandatory.

## Keeping docs accurate

Update `docs/conventions.md` when an engineering rule changes, `docs/architecture.md` when modules/contracts or flows change, this file when commands/prerequisites change, and `docs/design.md` when the footer experience changes. Add a decision record only for a consequential trade-off, and add every supporting guide to the `AGENTS.md` map and the [root map](../../AGENTS.md#supporting-documents).

## Verification records

The toolchain baseline above was recorded before the package moved into the monorepo. Record each run with its date, Node and Pi versions, and results, keeping the automated suite, the Pi load check and interactive Pi/Herdr checks separate.

2026-10-07, after the move, on macOS with Node 22.23.0 and installed Pi 1.0.4:

- `npm test` (steps 1–3): **157 of 157 tests passed** in five runs. One further run failed in test 18's cleanup hook (`ENOTEMPTY` removing a `pi-footer-integration-*` temp folder, apparently a late write by the fake `git` racing the removal) with all assertions passing; no source or test changed in the move, so this is an intermittent fixture-cleanup failure inherited from the old repository.
- Non-interactive Pi load check (step 4): **exit 0**. A throwing-extension control exited 1 in the same session.
- Interactive Pi/Herdr check: **not run**.

2026-10-07, background-tasks entry, on macOS with Node 22.23.0 and installed Pi 1.0.4:

- `npm test` (steps 1–3): **170 of 170 tests passed**.
- Non-interactive Pi load check (step 4): **exit 0**, with only the expected model-pattern warnings.
- Interactive Pi/Herdr check and a live pi-background-tasks producer: **not run**.

### Design-system port verification

2026-10-07, macOS, Node 22.23.0 and installed Pi 1.0.4:

- Original status-bar suite unchanged: `npm test` **170/170 passed**, and the final renderer-focused run **119/119 passed**. No cleanup flake in these runs. After review, `test/footer-colors.test.ts` was added (every design-system role and signal color maps to a footer hue): **171/171 passed**.
- Non-interactive checkout RPC load: **exit 0**, expected disabled-provider model-pattern warnings only.
- Design system: `node --test` **387/387 passed** (368 pre-existing checks plus 19 additive piece/option checks); storybook/showcase tests included. Existing assertions were not weakened.
- claude-interrupt regression: `npm run check` strict tsc plus **34/34 passed**; original/migrated marker golden **604,072 comparisons, zero differences**.
- Frozen original-suite footer oracle: **206,630 calls, zero differences**, including **115,024 raw renderFooter outputs** and state/frame/scheduling/parser calls. Supplementary separate-original comparisons: **227,062, zero differences**, covering invalid/fractional/>1000 widths, extra/coerced seeds, 90-second motion sequences, permissive hand frames/counts, Unicode/SGR and extreme finite clocks in truecolor/256color. Independent default DS corpus against origin/main: **2,334 comparisons, zero differences**. These finite corpora do not prove unbounded input equivalence.
- Compile-only public-subpath declaration specimen passed using the existing claude-interrupt compiler and the command above, without `--skipLibCheck`; the same command with all 27 design-system `.d.mts` files added also exited 0. No standalone status-bar project typecheck is claimed.
- Simulated git installation: copied tracked working-state files plus new untracked files to a fresh outside-repository directory without `.git`/`node_modules`; root `npm install --omit=dev --legacy-peer-deps` passed (one linked package, zero vulnerabilities). Installed Pi loaded both copied extensions by path, **exit 0** without extension-load errors. Copy removed. Real `pi install git:` **not run** (no push authorized).
- `git diff --check`, staged diff check, new-file whitespace, local guide links/anchors, instruction entrypoints and exported-subpath/no-copied-color review passed; index empty. Pre-existing slice-1 changes preserved.
- Bounded microbenchmark (one combined fixture, five widths, three rounds of 3,000 calls per renderer): original **234–249 µs/call**, port **322–333 µs/call**, same byte counts. The port adds about 35% by median (31–41% per round) in this case; no cache/worker or full-host repaint-performance claim.
- Interactive Pi/Herdr, live providers/fleet/GitHub, subjective glyph/color fidelity, Windows and Mermaid rendering **not run**. Legacy host state-hiding effects remain documented compatibility exceptions, not new DS policy.

### Context cap at 100%

2026-10-08, macOS, Node 22.23.0 and installed Pi 1.0.4: the CTX numeral and tone now stop at 100.0 when context passes the compaction budget; the readout keeps the true tokens.

- `npm test` (steps 1–3): **171/171 passed**, with the over-budget context assertions updated to the cap.
- Non-interactive checkout RPC load (step 4): **exit 0**.
- Interactive Pi/Herdr check: **not run**.

### Signals collector consumer split

2026-10-08, macOS, Node 22.23.0 and installed Pi 1.0.4:

- Host prerequisite and `npm test`: **135/135 passed**, no skipped/cancelled tests. The existing renderer/color/shard tests are unchanged; collection/parser tests moved to their owner. New identical context vectors and snapshot consumer tests cover absence/deferred replies, version/session/sequence filtering, both actual Pi package load orders, replacement discovery and exact rendered bytes at five widths.
- `src/footer.ts` differs only in two type-import paths; all renderer/motion arithmetic and behavior are unchanged. Collector owns settings/reserve, with the documented pure live-host arithmetic exception.
- Isolated non-interactive CLI load: **exit 0**; actual collector/display combined RPC load also **exit 0**. Neither non-TUI component collects data.
- Collector tests: **44/44 passed**, separately recorded in its contributing guide. Root checks passed; index is empty after the scoped local commits.
- Interactive Pi/Herdr, live producers/providers, Windows and a real git install: **not run**. No push/live configuration change. Iteration failures were fixture setup/assertion errors corrected before these complete passing runs.

Final consumer re-run on the same toolchain: **135/135 passed**; collector follow-up **45/45 passed**. The current module/event diagram rendered with existing grok-mermaid 0.2.3 without warnings (automated documentation rendering only); the root manifest CLI RPC load exited 0 in an isolated temporary agent/cache directory.

### Final-review absence correction

2026-10-08, macOS, Node 22.23.0 and installed Pi 1.0.4: host prerequisite passed; `npm test` **135/135 passed**, no skipped/cancelled tests. The real-loader regression now distinguishes absent collector (`no collector`, never pending) from present-but-not-inspected (`Git pending`) in both load orders. Isolated checkout RPC load: **exit 0**, expected disabled-provider warnings only. Root links/anchors, guide inventory, exact CLAUDE entrypoints and whitespace checks passed. Interactive Pi/Herdr: **not run**.

### Off-screen footer freeze

2026-10-31, macOS, Node 22.23.4 and existing Pi 1.4.0:

- npm's global prefix lacked Pi; the existing executable's host was used explicitly through `PI_HOST_ROOT` as recorded in [collector verification](../signals-collector/CONTRIBUTING.md#off-screen-visibility-freeze). The host prerequisite and `npm test` passed: **138/138**, no failed/skipped/cancelled tests. Created only the standard ignored root design-system symlink (`node_modules/@industrial-os/design-system` → `../../design-system`) with supervisor approval; no packages installed.
- Real-loader tests check all adapter repaint sources while hidden, no decoration/countdown timers rearmed, identical cached lines/no snapshot reads, settled resize/first uncached render, current first-visible host/status/usage values, one resume repaint without boot/PNYTL/USG replay, motion-off resume and unknown fail-open. Snapshot tests retain compatibility with old v1 collectors. Collector suite: **68/68 passed**.
- Isolated RPC package load with temporary agent/cache roots and `HERDR_ENV=0`: **exit 0**. Root links/anchors, mapped-guide inventory, exact CLAUDE entrypoints, whitespace and import/publication self-review passed; index empty.
- Simplification reviewed the full diff against merge base `00ea975`, including surrounding observer/timer/render callers and new tests. One guarded request callback covers every repaint source; cached lines are component-local; existing stop/resume motion preserves the Ponytail budget. No renderer, design-system or status-provider behavior changed.
- Interactive Pi/Herdr, live producers/providers, Windows, optional compile-only declaration specimen and Mermaid rendering: **not run** (no renderer on PATH; diagram unchanged). No live reload, installation, commit or push. Independent final review remains parent-owned.

### Configurable usage columns (2026-10-31)

macOS, Node v22.23.4, existing Pi 1.4.0. Only the design-system and display slice changed; collection/configuration rollout remains separate.

- **Passed:** root `npm install` (zero vulnerabilities), `npm ls --depth=0`, linked-package checks and the root no-host-packages/lockfile boundary assertion. No extension-local install or dependency added.
- **Failed prerequisite:** the documented npm-global-root host probe found no Pi at that prefix. **Passed** using the existing executable's actual host through explicit `PI_HOST_ROOT`; no host installed to satisfy it.
- **Passed:** `PI_HOST_ROOT="$PI_HOST_ROOT" npm test` **147/147**, no failed/skipped/cancelled checks. Configurable order/arbitrary slash and prototype ids, raw metadata consumption, sanitization and Unicode/four-cell tags, color resolution, one-slot placeholders, reported shapes, widths 1–280 at every boot tick, fill/edge/burn, real-loader freeze/resume and all other existing behavior are covered. GPT/CLD/KMI data snapshots and data-motion expectations remain unchanged with their source tags/tokens supplied. Earlier iteration failures were expected old-shape assertions and a corrected test-routing edit, not outstanding failures.
- **Passed:** `printf '' | pi --mode rpc --no-extensions --extension .` with isolated temporary agent/cache roots and `HERDR_ENV=0`: exit 0. Noninteractive package load only; no live Pi/Herdr session, provider call or configuration change.
- **Passed:** design-system **651/651** and required plain CLI snapshots; root changed-link/anchor, guidance inventory, exact CLAUDE entrypoints, staged/unstaged whitespace, import/color ownership and publication review. No new guide or root-map change needed.
- **Not run:** optional compile-only declaration specimen (existing compiler absent), Mermaid rendering (no renderer on PATH; diagram unchanged), Windows and live sources. No standalone typecheck/lint/build command exists.
- **Skipped:** interactive Pi/Herdr, per the explicit no-live boundary. No subjective glyph/color/motion or screen-reader acceptance is claimed.
- Rules chosen: one anonymous eight-cell slot for pending/failed-without-data/none; reported windows alone in 5H/WK order; shapes may repack. Keep the existing **27-tick/1350 ms** boot bound independent of column count, settling all content at its cutoff.
- Full-diff simplification: removed the provider/shape registry and duplicate renderer wire type, reused generic design-system parts and imported tokens, removed obsolete spill reservation, and constructed arbitrary-id fill maps once with `Object.fromEntries` plus own-property reads instead of quadratic repeated copies or a new registry. Existing motion/timer ownership, motion-off and hidden-pane behavior stay intact.

C4 integration follow-up, same date/toolchain: the real-collector composition test now requires `{ installed: null, providers: [] }` for absent `industrialOs.usageSources`, rather than the old CodexBar-missing `false`. Remaining `installed: false` test values are synthetic legacy-v1 fixtures, not real-collector expectations. A full `PI_HOST_ROOT="$PI_HOST_ROOT" npm test` rerun passed **146/147**, with the sole failure at this new assertion (`false !== null`) because this slice intentionally retains the old collector. The parent will run combined suites after integrating the collector slice; no compatibility allowance weakens the new assertion. Whitespace and scoped diff review passed. The earlier 147/147 record predates this contract-alignment assertion.
