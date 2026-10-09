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
- That run's fake server emitted dotted lifecycle event names, unlike Herdr 0.9.3's snake_case envelopes. The lifecycle-event correction below supersedes that protocol evidence, not the pure token/flag checks.

### Lifecycle event wire-name correction

2026-10-08, macOS, Node 22.23.0, installed Pi 1.0.4; Herdr `v0.9.3` source verified offline:

- Source audit: `src/api/schema/events.rs` defines dotted `Subscription` request types, snake_case `EventEnvelope.event` (`EventKind`), and dotted special `SubscriptionEventKind` names. All seven subscribed/compared kinds were checked: `workspace_renamed`, `workspace_updated`, `pane_moved`, `workspace_focused`, `tab_focused`, `pane_focused`, and `pane.agent_status_changed`. Upstream `subscription_socket_tests.rs` asserts `workspace_renamed`; `tests/api_ping.rs` asserts snake_case focus/create events. One client-boundary map normalizes the six lifecycle names to the dotted request names, leaving the special status kind unchanged. Requests, read/reconnect behavior, tokens and the renewal interval are unchanged.
- Fresh-worktree root `npm install`: **passed**, one local package linked, 0 vulnerabilities; no manifest/lockfile change. Host setup `export PI_HOST_ROOT="$(npm root -g)/@earendil-works/pi-coding-agent"` and `test -f "$PI_HOST_ROOT/dist/index.js"`: **passed**; no host installer run.
- Focused `node --experimental-strip-types --test test/herdr-client.test.ts`: **18/18 passed**, 0 failed/skipped/cancelled. New regressions are `snake_case workspace_renamed updates SPACE without a periodic refresh`, `snake_case workspace_updated updates SPACE without a periodic refresh`, `snake_case {workspace_focused,tab_focused,pane_focused} updates visibility without a periodic refresh`, and `snake_case pane_moved handles a {same-ID,cross-workspace} move without a periodic refresh`. The move cases also verify dotted status pushes still work with no extra read. `fake Herdr rejects dotted lifecycle wire events` prevents a fixture regression. Existing real-Pi loader tests now use snake_case focus events too.
- Reversion proof: temporarily restored the entire pre-fix `src/herdr-client.ts` from Git, retaining the corrected fake/tests, then ran `node --experimental-strip-types --test --test-name-pattern='^snake_case ' test/herdr-client.test.ts`: **expected failure**, exit 1, all **7/7 timed out**, 0 passed/skipped/cancelled. Bypassing only normalization produced the same seven failures. Restored the fix before final validation; the same targeted command then **passed 7/7**, exit 0, 0 failed/skipped/cancelled.
- Full `PI_HOST_ROOT="$PI_HOST_ROOT" npm test`: **78/78 passed** in two runs (the final run after restoring the fix), 0 failed/skipped/cancelled; real Pi loader/lifecycle and both real collector/sidebar load orders against fake Herdr are included. Type check, formatter, linter and build: **not run**, none configured (unchanged tooling gap).
- Non-interactive `printf '' | pi --mode rpc --no-extensions --extension .`, with temporary `PI_CODING_AGENT_DIR` and `XDG_CACHE_HOME`: **passed**, exit 0, no output. This is package-load evidence only, not live Pi/Herdr verification.
- Repository-wide local Markdown links/anchors, guidance inventory, exact CLAUDE entrypoints, `git diff --check`, `git diff --cached --check`, new-contributor document review and exact-file publication/import review: **passed**. No new dependency, cross-project production import, private data/path, copied upstream asset or generated file. Color check: **skipped**, no color change. Mermaid rendering: **not run**, diagram unchanged and no renderer found on PATH or in the global npm package list.
- The two transport findings from that inspection are addressed and failure-tested in the [transport-hardening verification](#socket-transport-hardening) below: complete-line bounds and a subscription acknowledgement deadline.
- Live/interactive Pi and Herdr, Windows and later Herdr versions: **not run**. Inherited `HERDR_*` variables were unset for every shell command; fake tests set only their own temporary targets. No live socket, live configuration or global Pi files touched; no push, PR or Linear mutation. Only event-driven update latency changes. Unannounced automatic SPACE labels still depend on the 20-second renewal refresh.

### Socket transport hardening

2026-10-09, macOS, Node 22.23.0, installed Pi 1.0.4; Herdr `v0.9.3` source verified offline (`src/api/server.rs::stream_subscriptions`, `src/api/schema/response.rs`, `src/api/server/subscription_socket_tests.rs`): a matching `subscription_started` precedes events, and rejection is an error reply. No upstream code or assets copied.

- The existing `MAX_LINE` remains **1,048,576 decoded UTF-16 code units**, excluding newline, not bytes. Complete lines are now checked before slicing/parsing as well as incomplete remainders; both the watch and `herdrRequest` drop an oversized connection without accepting its payload. This preserves the existing limit and normal framing rather than introducing a stricter byte-counting contract.
- The watch now reuses **`requestTimeoutMs`, default 1,500 ms**, for connection plus acknowledgement, consistent with its reconciliation requests. Expiry uses the existing unknown/fencing/drop/reconnect path and 250 ms–30 s backoff. The unref'd timer is disposed on ack, rejection/error, close and stop; a timeout's subsequent close cannot schedule a second reconnect.
- New regressions: `watchPaneState drops an oversized complete line in one chunk without delivering it`; `herdrRequest rejects an oversized complete reply in one chunk instead of accepting success`; `watchPaneState times out an unacknowledged subscription, reconnects with backoff and recovers`; and `watchPaneState clears its acknowledgement timer on {ack,error,close,stop}`. Controls also cover oversized incomplete lines and normal/multiple/split/exactly-at-limit lines. The fake socket fixture coalesces decoded delivery for complete oversized lines, since a large Unix-socket write alone would usually fragment and fail to exercise the original bypass. No known state or read is accepted before acknowledgement.
- Reversion proof: temporarily restored the entire original `src/herdr-client.ts` from Git with tests retained. `node --experimental-strip-types --test --test-name-pattern='oversized complete|times out an unacknowledged|clears its acknowledgement' test/herdr-client.test.ts`: **expected exit 1, 7/7 failed**, 0 passed/skipped/cancelled. Restored the fix and repeated: **exit 0, 7/7 passed**, 0 failed/skipped/cancelled. An initial ack-cleanup assertion incorrectly matched a reconciliation timer; tightened it to inspect the sole pending handshake timer before a matching ack, then repeated the full reversion proof above.
- Host discovery `export PI_HOST_ROOT="$(npm root -g)/@earendil-works/pi-coding-agent"` and `test -f "$PI_HOST_ROOT/dist/index.js"`: **passed**, no installation. Focused `node --experimental-strip-types --test test/herdr-client.test.ts`: **27/27 passed**. Full `PI_HOST_ROOT="$PI_HOST_ROOT" npm test` after the final test correction: **87/87 passed in two consecutive runs**, 0 failed/skipped/cancelled. This includes real installed Pi loader/lifecycle and offline collector composition against fake Herdr only.
- Repository-wide local Markdown links/anchors, guidance inventory, exact CLAUDE entrypoints, `git diff --check`, `git diff --cached --check`, new-contributor document review and exact-file publication/import review: **passed**. No new dependency, production cross-project import, private material, copied asset or generated file. Color check: **skipped**, no color change. Mermaid rendering: **not run**, diagram unchanged and no renderer found on PATH or in global npm packages. Type check, formatter, linter and build: **not run**, none configured.
- Separate CLI RPC load check, live/interactive Pi and Herdr, Windows and later Herdr versions: **not run**. No live socket, live/global configuration, push, PR or Linear mutation. Every test/validation shell explicitly unset inherited `HERDR_*`; fake tests supplied only their temporary socket targets. Initial read-only Git/document reconnaissance preceded that unsetting but performed no socket or Herdr operation. Legitimate responses above the preserved client limit remain rejected; no broader Herdr compatibility is claimed.

### ACT / MDL access decay

2026-10-09, macOS, Node 22.23.0, installed Pi 1.0.4; Herdr 0.9.3 source/API checked offline:

- Root `npm install`: **passed**, one existing local design-system package linked, 0 vulnerabilities; no manifest/lockfile change. Host discovery `export PI_HOST_ROOT="$(npm root -g)/@earendil-works/pi-coding-agent"` and `test -f "$PI_HOST_ROOT/dist/index.js"`: **passed**, no host installation.
- Full `PI_HOST_ROOT="$PI_HOST_ROOT" npm test`: **93/93 passed**, 0 failed/skipped/cancelled. Includes real installed Pi loader/lifecycle and both offline collector load orders against fake Herdr, not live Pi/Herdr. New regressions: `access decay boundaries: 59m59s, 1h, 4h, 24h and next boundary`; `access refresh: seen, WRK and SUB continuously refresh; unknown remains d0; QNS/BLK alone do not`; `all eight decay families select one variant with identical text/width; other rows are unchanged`; `the maximal applicable snapshot stores 15 tokens, not the 52-key contract`; `decay transitions clear all old variants before setting new ones within Herdr limits, including full recovery`; `access decay reports each boundary without a snapshot/focus change and clears its timer on shutdown`.
- The fake-Herdr boundary test controls the clock and invokes the exact scheduled callbacks at 1h/4h/24h, proving no snapshot/focus event is needed. It also checks unref/disposal, no late report, fresh visible/WRK intervals, unknown→d0 and session-replacement reset. Sender tests fill the stored map to 32 and exercise d0→d1→d2→d3→d0 and failure/full recovery with ≤16-key requests.
- Mutation proof: disabled only stage key selection and decay-boundary scheduling, retaining exported functions/tests. `node --experimental-strip-types --test --test-name-pattern='^access decay boundaries|^all eight decay|^access decay reports' test/tokens.test.ts test/extension.test.ts`: **expected exit 1, 3/3 failed**, 0 skipped/cancelled. Restored the feature before final passing validation.
- `cd herdr && node --test`: **13/13 passed**. `node check-config.mjs`: temporary sidebar, Spaces and merged copies each **config: ok, exit 0**; invalid control **rejected, exit 1** expected. The initial one-row ACT config was rejected by Herdr's 16-entry configured-row cap; approved split into two mutually exclusive 12-entry rows fixes it. Source proves empty rows are dropped before rendering and row_gap is between pane blocks, not the alternatives.
- Repository-wide changed local links/anchors, 90-document guidance inventory, 10 exact CLAUDE entrypoints, whitespace, new-contributor document review and exact-file publication/import review: **passed**. Colors match exported design-system values. No new dependency, private material, production cross-project import, copied asset or generated file.
- Intermediate failures were resolved: the initial boundary fixture omitted model provider; an unchanged d0 focus assertion did not wait for reconciliation; Herdr checks initially lacked the root-linked package. None remains in the final run.
- Separate CLI Pi load, live/interactive Pi/Herdr, Windows, later Herdr versions and Mermaid rendering: **not run** (diagrams unchanged). Type check, formatter, linter and build: **not run**, none configured. Every shell/test/parser run explicitly unset inherited `HERDR_*`; fake tests supplied only their temporary targets. No live socket/configuration, global Pi files, push, PR or Linear mutation.
- Operator adoption: merge the complete updated Pi row override before loading the updated reporter. Old rows do not render later-stage keys. Age is memory only and resets on reload/restart; transport/backoff and partial multi-request reports retain their existing limitations.
