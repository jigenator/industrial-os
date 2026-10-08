# Contributing

Follow the [repository workflow](../../CONTRIBUTING.md) as well as this package's checks.

## Toolchain and setup

Use Node.js 22.19 or newer and an installed Pi; checked with Node 22.23.0 and Pi 1.0.4 on macOS. The Herdr API it uses was read in the Herdr 0.9.3 source and socket documentation; see [architecture](docs/architecture.md#reporting-to-herdr). The extension declares Pi's packages as peers and has no dependencies, development dependencies or lockfile; like status-bar, its tests run against the globally installed Pi. It does not import the design system, so its own checks do not need the root install.

Tests that load source or Pi need the installed host root. From `pi/herdr-sidebar/`:

```sh
export PI_HOST_ROOT="$(npm root -g)/@earendil-works/pi-coding-agent"
test -f "$PI_HOST_ROOT/dist/index.js"
```

This only discovers an existing global installation. Do not run an installer to make a test pass. The tests start a fake Herdr server on a temporary Unix socket and set `HERDR_ENV`, `HERDR_PANE_ID` and `HERDR_SOCKET_PATH` to it for each case, so they never reach a live Herdr even when run inside one. They need a POSIX system with Unix sockets.

## Fast loop

From `pi/herdr-sidebar/` after setting `PI_HOST_ROOT`:

```sh
node --experimental-strip-types --test test/tokens.test.ts
```

This checks the token builder and snapshot validation against the [token contract](docs/token-contract.md). It does not cover the socket client, the sender or the lifecycle.

## Full validation sequence

Source: `package.json` and the files under `test/`.

| Order | Directory | Command | Prerequisites/effects | Coverage |
| --- | --- | --- | --- | --- |
| 1 | `pi/herdr-sidebar/` | `export PI_HOST_ROOT="$(npm root -g)/@earendil-works/pi-coding-agent"` | Existing global Pi; reads npm's global root | Locates host-provided peers |
| 2 | `pi/herdr-sidebar/` | `test -f "$PI_HOST_ROOT/dist/index.js"` | No writes | Fails clearly when the host is absent |
| 3 | `pi/herdr-sidebar/` | `PI_HOST_ROOT="$PI_HOST_ROOT" npm test` | Creates and removes temporary sockets, fake collector extensions and isolated Git/cache fixtures with fake gh/CodexBar; no network | Token contract, snapshot validation, socket client, sender, workspace-label subscriptions, and real Pi loader/lifecycle/composition in both collector/sidebar load orders against the fake Herdr server |
| 4 | `pi/herdr-sidebar/` | `printf '' \| pi --mode rpc --no-extensions --extension .` | Installed Pi; no model call; model-pattern warnings are expected because other extensions are off. In RPC mode the extension reports nothing, even inside Herdr | Package discovery and loading through the installed `pi` command; success exits 0, a throwing extension exits 1 |
| 5 | Herdr pane | Manual: run Pi with this extension and signals-collector in a Herdr pane whose config has the [sidebar rows](../../herdr/README.md) | Installed Pi, Herdr (tested with 0.9.3) and the merged configuration; changes the live sidebar | Rows, colors, alignment with and without the scrollbar, state changes, question rows, shutdown clear |

Then follow the [repository-wide checks](../../CONTRIBUTING.md#repository-wide-checks). Record every check as passed, failed, skipped or not run. A missing host is a failed prerequisite. The RPC load check is not interactive verification, and the fake Herdr server is not Herdr. There is no type check, formatter, linter or build.

## Making a change

1. Change the [token contract](docs/token-contract.md) first when a token's meaning changes, then `src/tokens.ts` and `test/tokens.test.ts`, then the rows in `herdr/sidebar.toml` and that project's check.
2. Put Herdr protocol details in `src/herdr-client.ts`, report composition in `src/sender.ts`, and Pi lifecycle in `src/extension.ts`.
3. Model a new Herdr behavior in `test/fake-herdr.ts` from the Herdr source of the version in use, and cite it there.
4. Run the focused test while iterating and the full sequence before handoff.

## Review checks

- Does every displayed value stay truthful: unknown shown as unknown, a failed report never recorded as accepted?
- Can anything report outside TUI mode, outside Herdr, or after shutdown?
- Does `herdr:blocked` stay balanced on every path, including session replacement?
- Are sockets and timers bounded, unref'd and disposed?
- Does the change keep the one source and the clock-based sequence?

## Verification records

Record each run with its date, Node, Pi and Herdr versions and results, keeping automated, Pi-load and interactive evidence separate.

2026-10-08, macOS, Node 22.23.0, installed Pi 1.0.4, Herdr 0.9.3 source read:

- `npm test` (steps 1–3): **43 of 43 tests passed**, in three consecutive runs.
- Non-interactive Pi load check (step 4): **exit 0**, with the expected model-pattern warnings only. A throwing-extension control exited 1 in the same session.
- Simulated git install: the tracked and new files copied to a temporary directory without `.git` or `node_modules`, root `npm install --omit=dev --legacy-peer-deps` (0 vulnerabilities), then installed Pi in RPC mode loaded herdr-sidebar, status-bar and claude-interrupt from the copy: **exit 0**, no load error. Real `pi install git:` **not run** (no push).
- Interactive Pi/Herdr check (step 5): **not run**. No live Herdr behavior is claimed; the live spike that verified the geometry used a throwaway script, not this extension.
- At that initial verification the signals-collector extension did not exist on the branch; snapshots came from a fake collector. The merged-branch composition verification below supersedes that limitation.

### Merged-branch final-review corrections

2026-10-08, macOS, Node 22.23.0 and installed Pi 1.0.4; Herdr 0.9.3 source/API shapes verified offline:

- Host prerequisite and `npm test`: **55/55 passed**, no skipped/cancelled tests. `test/signals.test.ts` loads both real packages in both orders, samples real parsed quota/context and drives tool/question/settlement lifecycle into fake Herdr tokens. No mismatch in the existing snapshot reader was exposed; unused usage fields remain ignored.
- Sender regressions cover exponential jittered backoff, update/renewal gating, full-report reset and persistent second-batch rejection. Token tests cover bidi controls/U+2800, used-context zones/cap, SPACE title/fallback, IDL/UNK uncoloured bars and README limitations. Fake-server loader/client tests cover rename/update/reconnect, stale reads and cross-workspace pane-ID changes.
- Isolated non-interactive checkout RPC load: **exit 0**, expected disabled-provider model-pattern warnings only. Herdr configuration tests: **5/5 passed**; parser on a temporary copy: **`config: ok`, exit 0**. These are not live Herdr rendering evidence.
- Root local links/anchors, guide inventory, exact CLAUDE entrypoints, whitespace and publication/import reviews passed. Both touched architecture diagrams render with existing grok-mermaid 0.2.3, non-null art and no warnings.
- Interactive Pi/Herdr, live providers, Windows and real git installation: **not run**. No push or live configuration change. Intermediate composition fixture failures (incomplete fake PR data and fitted finished-text expectation) and the old bar expectations were corrected before the passing full runs; Mermaid edge-label syntax was normalized for the existing renderer.

### SUB state, subagents-finished DNE and watch fixes

2026-10-08, macOS, Node 22.23.0 and installed Pi 1.0.4; Herdr 0.9.3 source (`v0.9.3`) and socket API documentation read for seen, focus events and automatic labels:

- Host prerequisite and `npm test`: **70/70 passed** in three consecutive runs, no skipped/cancelled tests. New regressions cover the row-1 precedence (QNS, BLK, WRK, SUB, DNE, IDL/UNK), the flag's pure transition, the own-DNE `RDY · finished` age, and against the fake Herdr server: WRK beating SUB; SUB under idle, done, unknown and after reconnect; units 1→0 while unseen giving DNE, cleared by `tab.focused`, `workspace.focused` or `pane.focused`; 1→0 while seen going straight to IDL; work and rising units clearing the flag; question and blocked winning; reconnect re-resolving visibility; the renewal refresh of an unannounced label; same-id pane moves without resubscribing; and retried read timeouts. Mutation checks: removing the same-id move branch or the read retry made its regression fail.
- Two earlier failures were expectation changes, not regressions: the composition tests expected `bar_idle` where idle Herdr with 3 units now shows SUB with the zone bar, and the 02AU row test relied on a fixture default of 2 units, now 0 so idle/done/unknown fixtures do not read as SUB.
- Non-interactive Pi load check (step 4) with a temporary `PI_CODING_AGENT_DIR` and cache: **exit 0**.
- status-bar `npm test` against the changed collector: **135/135 passed**.
- Interactive Pi/Herdr: **not run** for this change; no live Herdr behavior of SUB, the seen approximation or the label refresh is claimed. No push or live configuration change.
