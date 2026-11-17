# Contributing

Follow the [repository workflow](../CONTRIBUTING.md) as well as this project's checks.

## Toolchain and setup

The maintained content is three herdr-app mods in plain JavaScript (droid-plate with a generated `ds/` copy of design-system files), a layout, a theme and a keys snippet in JSON. The checks use Node.js 22 with its standard library and the design-system package; there is no dependency or lockfile in this project, and `mods/package.json` only marks the mod's files as ES modules for Node. Run `npm install` once at the repository root so `@industrial-os/design-system` resolves; see [setup](../CONTRIBUTING.md#setup). `herdr-app check` needs an installed Herdr desktop app; it was run with herdr-app 0.1.15.

## Validation sequence

| Order | Directory | Command | Prerequisites/effects | Coverage |
| --- | --- | --- | --- | --- |
| 0 | repository root | `node herdr/scripts/sync-design-system.mjs --check` (after a design-system change, without `--check` to regenerate) | Node 22; reads `design-system/` and `herdr/mods/*/ds/`; writes only without `--check` | droid-plate's `ds/` is byte for byte the design system's files, exactly its import closure |
| 1 | `herdr/` | `node --test` | Root install; reads the mods' pure modules, `layouts/industrial-os.json`, `test/fixtures/` and `themes/acid-black.json`; no writes | Label parsing and stale labels; every state, unknowns, caps, decay, the finished rule, space aggregation and quiet ages; the layout differs from shipped `main` only in the sidebar block and the frozen Lunalee column; the Pi Reloader's selection, protection, guard label and wire checks, and its reload and reset sequences against a simulated herdr-core and guard; the pane plate's units, strips, lighting, rows at 24–200 columns, keys and motion timeline, and `ds/` against the design system; every mod's imports; desktop theme values |
| 2 | `herdr/` | `herdr-app check mods/industrial-os`, `herdr-app check mods/pi-reloader` and `herdr-app check mods/droid-plate` | Installed herdr-app; loads each mod once with empty in-memory state, in a hidden window; changes nothing in the running app. It writes `gpui-kit.d.ts` and `jsconfig.json` into the mod folder for editors; Git ignores them | Each mod loads and its initial description materializes: prints `check passed: mods/<name>`, exit 0. Only the empty state renders |
| 2a | repository root | `node herdr/scripts/check-droid-plate.mjs` | Installed herdr-app; runs `herdr-app check --print-spec` on temporary copies of droid-plate whose `herdr` import returns sample panes; changes nothing in the running app | The plate composes and renders in herdr-app's runtime for thirteen sample states (Pi idle, working, needs you, done and before its label; an agent; a shell, a running command; unfocused, inactive, zoomed, 40 and 198 columns), with the header width and font advance given as 2x samples; fails unless every piece starts on a cell boundary and the bay ends on W − 3; prints the cells as placed and the compose, warm-frame and draw times. Not layout, paint, timers, motion or input |
| 3 | Herdr app | Manual, by an operator: install as in the [README](README.md#install), switch to the layout, and watch Pi agents with the signals publication and other agents, and every pane plate state, lighting level, key and motion | Changes the live app's files and layout | Populated rendering, every state, clicks, agent order, ahead/behind, live clocks, the look |

Then follow the [repository-wide checks](../CONTRIBUTING.md#repository-wide-checks). Record every check as passed, failed, skipped or not run. Step 2 proves the mod loads, not how populated rows look or behave.

The theme has its own manual step: install as in the [README](README.md#theme), then `herdr-app status` must show no `settings.error`, and `herdr-app shot` shows the sidebar, tab bar, a terminal and an agent's status in the theme. Changes the live app configuration.

## Making a change

Change the source first: a color in the design system, a label field in [the snapshot contract](../pi/signals-collector/docs/contract.md). Then change the pure module and its test, then `main.js` if what is drawn changes, update [the design](docs/design.md), and run the sequence.

## Verification records

Record each run with its date, app version and results.

### Droid-plate pane header

2026-11-17, macOS, Node 22.23.4, herdr-app 0.1.16 (`herdr-app check`), branch `feat/sticky-droid-plate`. The approved sticky droid plate (mockup revision 7): the new `mods/droid-plate`, its `ds/` copy and `scripts/sync-design-system.mjs`, the layout's 130 px pane header, and the design-system additions it draws with (their record is in [design-system contributing](../design-system/CONTRIBUTING.md#sticky-droid-plate-additions-2026-11-17)).

- `node herdr/scripts/sync-design-system.mjs --check`: `ds copies match the design system` (20 files then; 21 with `glyph-shapes.mjs`, below).
- `cd herdr && node --test`: **59/59 passed**, 0 failed, skipped or cancelled: the 45 existing checks (the layout check now requires the `droid-plate` header at 130 px) and 14 droid-plate checks.
- `herdr-app check mods/droid-plate`: `check passed: herdr/mods/droid-plate` (empty state: no pane, so it draws nothing).
- `node herdr/scripts/check-droid-plate.mjs`: **all 12 states passed** in herdr-app's runtime; the first compose took 23–73 ms over three runs (in `init` here; in a task in the mod). The rows it printed were read for each state: unit, wordmark, serial, title block, strip and bay as the [design](docs/design.md#pane-plate) states.
- Runtime measurements with `herdr-app check` probes (not the mod): a render interrupted between 50 and 60 ms of work, `init` and a task between 500 and 700 ms; a 99-column plate composed in about 14 ms warm and 28 ms cold, a bank-switch frame in about 10 ms, a CRT boot frame in about 5–9 ms; the runtime has no `Intl` and no `structuredClone`.
- **Not run:** the live app. Install, the plate over real panes, alignment with the terminal's cells and fonts, the lighting levels, hover, keys, every motion, whether window activation redraws a pane header (the 500 ms fallback), whether T2's frames read as interruptible on a fast second click, and whether `close()` clears `io.droid-plate.v1` on a layout switch are all unverified.

### Droid-plate on the cell grid (live)

2026-11-17, macOS, Node 22.23.4, herdr-app 0.1.16, a 5120 × 2820 shot (2x, zoom 1), branch `feat/sticky-droid-plate`. After the operator installed the mod live, two defects showed: every Powerline cell of the peak was a `?` box, and the right title block was cut at the pane's edge, its barcode bars split between rows. Causes, measured in the app with a temporary probe build: the mod looked for a font named `JetBrainsMono NFM`, but `fonts()` lists `JetBrainsMono Nerd Font Mono`, so it drew in Herdr's JetBrains Mono, which has no Powerline glyphs; and it set each row as flowing text, whose glyphs advance 8.406 px while the terminal's cells are 8.5 px, the bar glyphs not filling their cells. Now every piece is placed on the measured grid and those glyphs are shapes (see [architecture](docs/architecture.md#droid-plate)). The operator authorized copying the mod into `~/.config/herdr-app/mods/droid-plate`, `herdr-app shot` and `herdr-app status`, nothing else; the installed copy equals the worktree's at the end.

- Measured: header 1684 px wide, the terminal 198 columns, a 64-character JetBrains Mono 14 probe 538 px (8.406 px), so the cell is ceil(8.406 × 2) ÷ 2 = 8.5 px.
- Live shot, device pixels: the plate starts at x 626; the barcode's last bar and the bay's ground both end at x 3958 = 626 + 196 × 17, the right edge of column W − 3 = 195; the `+` corner sits in column 197; the pane ends at 3994 (198 × 17 + 2, the 1 px remainder in the row's color). The peak is solid acid with straight edges and no `?` boxes; the barcode's bars run unbroken through both rows. `herdr-app status`: no errors.
- `cd herdr && node --test`: **61/61 passed**. `herdr-app check mods/droid-plate`: passed. `node herdr/scripts/check-droid-plate.mjs`: **all 13 states passed**, every piece on the grid and the bay ending on W − 3; at 198 columns the first compose took about 110–125 ms, a warm frame about 22 ms and the draw 7–15 ms in the runtime.
- **Not run:** a narrower pane live (the only shown tab has one pane, and switching was not authorized; narrower widths are covered by the tests and the 64- and 40-column runtime states); other display scales; hover, keys and motions live.

### Droid-plate review fixes and the grip-clear peak (live)

2026-11-17, macOS, Node 22.23.4, herdr-app 0.1.16, 5120 × 2820 shots (2x, zoom 1), branch `feat/sticky-droid-plate`. Fixes for every finding of the independent review, and the peak moved right of Herdr's drag grip. The operator authorized copying the mod into `~/.config/herdr-app/mods/droid-plate`, `herdr-app shot` and `herdr-app status`, with no focus change, tab switch or click; the installed copy equals the worktree's at the end.

- **Findings fixed, each with a regression test in `test/droid-plate.test.mjs` (or the design system's):** Unicode caller text drawn as `?` (unit-plate test, widths 1–160); a missing or malformed label keeps Herdr's WORKING or NEEDS YOU with no phase, question or clock (every Herdr status × four bad labels); label writes through `labels.js` (deferred, rejected and hung `hc`, terminal replacement, bounded retries, `close()` superseding); K4 deferred to the end of the playing motion, on the real `Scheduler` with a fake clock (no zero-delay loop, a fired deadline never re-armed, nothing left running after `stop()`); wide panes (198–4000 columns: 256 composed, the middle widened, every row tiled and the bay and barcode on W − 3); T2, H1 and the reveal native, with only the character-level motions on a timer.
- **Grip:** measured from the operator's screenshot, 56 × 36 device px at 2x, so 28 × 18 px. The peak's first cell is `ceil((W_px / 2 + 14) / cell) + 2`; it needs 80 columns (was 72).
- **Live, device pixels:** the 198-column pane (header x 626–3994, centre 2310, the grip's right edge 2338): the peak spans x 2379–2715, columns 103–122, 2.4 cells past the grip, dark and then lit with Pi working (`■ THINKING 00:17 esc steer`). A shot that caught the operator on a two-pane tab: both 98-column plates have the peak at columns 53–72, 2.06 cells past the grip, one dark and one lit. `herdr-app status`: no errors.
- **Live probe (temporary build, not the mod):** opacity transitions with per-bank delays on elements first drawn at 0, then at 1, animated in order and were not disturbed by redraws every 250 ms; an element that first appears at 1 does not animate; a width transition from a primed value animated.
- **A blank header seen once:** two shots 3 s and about 45 s after one hot reload showed the header's slot empty; a debug build (the same mod, errors drawn as text) then drew normally with no error and no stuck task, and every later shot of the real mod drew. The cause was not found. Render no longer starts the activation poll (the update task does), in case a timer started in render fails there.
- `cd herdr && node --test`: **66/66 passed**. `node herdr/scripts/sync-design-system.mjs --check`: match (21 files). `herdr-app check mods/droid-plate`: passed. `node herdr/scripts/check-droid-plate.mjs`: **all 20 states passed** (new: a 1200-column shell and Pi, a malformed label, a two-layer switch at 99 and 256 columns, a reveal, a CRT boot frame at 198); a cold compose is at most about 280 ms (a 256-column switch), a CRT boot frame 23–42 ms at 198 columns, a draw 7–23 ms.
- **Not run:** a real focus change, hover, hand-back or boot watched live (the motions' timing is from the tests and the probe); other display scales; the label on a layout switch.

### Flat panes

2026-11-17, macOS, Node 22.23.4, herdr-app 0.1.16: the layout's pane radius 0 and no border or focus outline, taken from the operator's installed layout, which has run this way. `cd herdr && node --test`: **45/45 passed**; the layout check now requires them. Not checked: how a person tells the focused pane apart without the outline.

### Sidebar header

2026-11-17, macOS, Node 22.23.4, herdr-app 0.1.16:

- `cd herdr && node --test`: **45/45 passed**, 0 failed, skipped or cancelled: the new droid-count check, and the layout check now requiring the `brand` block to be `industrial-os` with `props.brand` and the sidebar at 300 px.
- Mutations, restored: counting every non-idle agent as working failed 1; leaving subagents out of the droid count failed 1.
- `herdr-app check mods/industrial-os`: **`check passed: mods/industrial-os`, exit 0** (the sidebar; the check passes no props).
- The header, by hand: a temporary copy with `brand` forced on passed `herdr-app check --print-spec`, showing `INDUSTRIAL OS`, `◐00`, `search` and `sidebar-toggle`. The copy was deleted.
- Live, at the operator's request: the installed layout had local edits (terminal padding, pane radius and borders), so only its `brand` block was changed in place, after a backup; the mod's `.js` files were copied in. The first install drew the whole sidebar in the header: a mod's props come from `props()` in `herdr`, not `init`'s argument. Fixed. Then the badge and count overlapped the search button on the macOS width; the badge went to 11 px. `herdr-app status`: `errors: []`. `herdr-app shot`: `INDUSTRIAL OS`, `◐03` in the working color, search and toggle, no overlap, while three agents worked. The `◐` mark was then replaced by the `NN DRD` plate, which covered the search button at 268 px (measured: the sidebar renders at the layout's 268 px; the saved 299 px state does not apply to a non-resizable node). With the sidebar at 300 px in the repository and installed layouts: `05 DRD` matched two working agents plus three units shown in the sidebar, then `07 DRD`, with no overlap. Then, at the operator's request: the badge became `INDUSTRIAL-OS ®` and the count `⟁ NN`. Weight 800 in the sidebar's `JetBrains Mono` drew no heavier than regular; the installed `JetBrainsMono NFM` drew it bold. `⟁ 07 DRD` covered the search button by about 20 px, so `DRD` was dropped: `⟁ 07` fits with search and toggle clear. Only the glyph in that font on this Mac was seen; fallback fonts were not. `⟁` is not in JetBrainsMono NFM (checked with fontTools), so its fallback glyph stayed thin; it is now `mark.svg` (stroke 3 of 24) and the shot shows it as heavy as the digits. `®` was then dropped from the badge at the operator's request: too small at 11 px.
- Not run: clicks, window drag, the rail, and a count of zero in the live app.

### Pi Reloader

Contract version 2, 2026-11-17, macOS, Node 22.23.4, hc 0.1.20, Pi 1.5.2. herdr-app updated itself from 0.1.15 to 0.1.16 at 11:55, minutes before the live run, so the live part ran on 0.1.16. The live part changed the running app and was run with the operator's explicit authorization for this change, against the project rule above.

- `cd herdr && node --test`: **44/44 passed**, 0 failed, skipped or cancelled: 27 existing and 17 Pi Reloader checks.
- `herdr-app check mods/pi-reloader`: **`check passed: mods/pi-reloader`, exit 0**. `--print-spec` shows the empty state (`IDLE OR DONE PI (0)`, `No Pi agent here is idle or done.`).
- Guard checks: [reloader-guard record](../pi/reloader-guard/CONTRIBUTING.md#verification-records).
- **Live, isolated.** One throwaway space `reloader-test` with three tabs, each a zsh running Pi through a shell function `pi() { command pi --no-extensions -e <checkout>/pi/reloader-guard/src/extension.ts --no-tools --no-mcp --no-skills --no-prompt-templates --no-context-files --no-themes --model google/gemini-3.5-flash-lite --session-dir /tmp/reloader-v2/sessions "$@"; }`, so the restart line used the same function. Each Pi was given one harmless first prompt so that its session file existed, which left it `done`; two were then set idle by writing `herdr.seen=<turn>`, the value looking at them writes. Input to the test terminals was sent with `HC_TERMINAL_ID` unset, never a slash command. A copy of the mod was installed as `mods/pi-reloader-test`, identical to this folder except a `mod.json` with `overlay.props.only` set to the three addresses. It was opened with `herdr-app do mod.open --name pi-reloader-test` and driven only with `herdr-app do pi-reloader-test.reload|reset`. Before any action, the window listed only the three test terminals and its `Test scope` line, while the sidebar showed the operator's other Pi agents. Screenshots `01-open.png` to `08-final-reload.png` are kept outside the repository with the handoff.
  - Reload, with one idle Pi, one idle Pi holding the typed draft `draft text do not run`, and one Pi working on a prompt: the idle Pi got a new label token; the draft and the working Pi were skipped; the draft was still on screen. Window: `Reloaded: 1 · Skipped: 2 · Failed: 0`. A second reload with the final code reloaded an idle and a done Pi and skipped the draft.
  - Reset, with the same idle and draft Pis and the third Pi now done: the idle and done Pis were quit, the mod typed `pi --session '<file>'` into each shell, and each resumed Pi (new pid, same session file) answered. The draft was skipped and intact. Window: `Restarted: 2 · Skipped: 1 · Failed: 0`. Run twice; the first build also wrote `herdr.seen=<turn>` for Pis that were idle (an unchanged value), the second is the final code with no marking.
  - Read state: through every reload and reset herdr-core's `turn` stayed 2 on all three terminals. The idle Pi kept `herdr.seen` 2 and read `idle` in `herdr-app ls` after each action; the done Pi kept `herdr.seen` 0 and read `done`. A reload sent straight to the guard showed the same. The window's focused space, tab and pane (`lunalee-chat`) were the same in 70 samples taken every 0.5 s through both resets.
  - Before the right shell function was in place, one test terminal ran a plain `pi` with the operator's extensions and default model for the first prompt, `Reply with the single word ok.` It answered `ok` and used no tool. That terminal was killed, and its session folder `~/.pi/agent/sessions/--private-tmp-reloader-v2-cwd--` (one user and one assistant message) was removed.
  - Cleanup: the window was already closed when cleanup began, with the view moved to the `lunalee` space by something other than the test; the space was closed (`space.close` with `confirmed: true`) and its terminals removed; `mods/pi-reloader-test`, its empty `data/` folder and `/tmp/reloader-v2` were removed; no test Pi process remained, and the count of `~/.pi/agent/sessions` matched. Hashes of `~/.pi/agent/extensions/*`, herdr-app `keys.json`, `settings.json`, `layouts/*.json` and the installed `pi-reloader` mod matched the snapshot taken before the run. Shipped mods and `layouts/.state/industrial-os.json` changed with the app's 0.1.16 update at 11:55. `~/.pi/agent/settings.json` changed at 11:57:00, 24 seconds after the full-extension Pi above started; its extension list is unchanged, and the writer was not confirmed. herdr-app's own `seen.json` lists `pi-reloader-test`.
- Not run: the shipped key binding (the snippet was not merged), clicks and arrow keys (no pointer or OS keys were used), fish or a Pi that is its terminal's own program (simulated), a layout switch during a run, and another machine.
- Correction to the version 1 record: it said a restarted Pi showed `done`. That Pi was already done before its reset. A reset or reload does not advance the turn, so an idle Pi stays idle.

### Lunalee column

2026-11-12, macOS, Node 22.23.4, herdr-app 0.1.15:

- Root `npm install` in the fresh worktree: linked the design-system package, 0 vulnerabilities, no tracked change. Before it, `test/app-theme.test.mjs` failed to resolve the package.
- `cd herdr && node --test`: **27/27 passed**, 0 failed/skipped/cancelled. The layout check now requires the column, as `root`'s third child, to equal the frozen contract, and nothing else to differ from shipped `main`.
- Mutation checks, each restored: the column at 600 px failed 1; the block naming terminal `lunalee` failed 1.
- `herdr-app check mods/industrial-os`: **`check passed: mods/industrial-os`, exit 0**. It does not load the layout.
- `check-config.mjs`: not run; it was removed with the herdr-tui configuration.
- Not run: installing the layout, switching to it and the live look, with and without Lunalee. The Herdr behaviours in the [README](README.md#lunalee-column) were observed by Lunalee's slice-0 check, not here.

### Industrial OS sidebar mod

2026-11-12, macOS, Node 22.23.4, herdr-app 0.1.15, hc 0.1.20:

- `cd herdr && node --test`: **27/27 passed**, 0 failed/skipped/cancelled: 21 mod checks, 3 layout and mod-folder checks, 3 desktop theme checks.
- Mutation checks, each restored: RUN placed before SUB failed 1; an unknown count shown as a number failed 3; the sidebar width changed in the layout failed 1; the label accepted from a non-Pi terminal failed 2.
- `herdr-app check mods/industrial-os`: **`check passed: mods/industrial-os`, exit 0** (the empty state: `SPACES`, `No spaces.`, `AGENTS`, `No agent has reported a status.`).
- Populated rendering, by hand: a throwaway copy of the mod with its `herdr` import pointed at a fake module returning two spaces, a working Pi with every row, a Pi with a question and unknowns, and a blocked Claude agent, passed `herdr-app check --print-spec` with the expected text in every row. The same copy with an invalid builder call failed the check. The copy was deleted.
- Not run: installing the mod or layout, switching layout, the live look, clicks, agent order, ahead/behind lookups, timers and `localStorage` in the running app, and the signals publication itself (another change).

### Acid / Black desktop theme
2026-11-12, macOS, Herdr desktop 0.1.14, herdr-core 0.1.19.

- `cd herdr && node --test`: **18/18**: 11 sidebar, 4 Spaces and 3 new desktop theme checks. Mutation: `working` set to `#c0fe05` failed 1 of 3, restored.
- `cd herdr && node check-config.mjs`: spaces, sidebar and their merge **`config: ok`, exit 0**; the unknown-token copy **rejected, exit 1**.
- `cd design-system && node --test`: **669/669**, including the new `HERDR_TERMINAL` check. With `PI_HOST_ROOT` set to the installed Pi: `pi/theme` **5/5**, `pi/status-bar` `test/footer-colors.test.ts` **1/1**, `pi/droid-header` **39/39**.
- Live, with the operator's permission: copied into `~/.config/herdr-app/themes/`, `"theme": "acid-black"` set in `settings.json` (backed up first). `herdr-app status`: `errors: []`, no `*.error` file. `herdr-app shot`: black sidebar and chrome, the selected space on the surface, the Working header and spinner in acid, a white focus border.
- Not checked: the light appearance (the theme is dark only), other layouts (`terminals`, `win98` set their own themes), and the blocked and done colors on screen.

### herdr-tui configuration (removed)

These records are for the herdr-tui fragments `sidebar.toml` and `spaces.toml`, their parser script `check-config.mjs` and tests, and the herdr-tui Spaces plugin, all since removed with the move to the Herdr desktop app. They are kept as history; links to removed files are plain text.

2026-10-08, macOS, Node 22.23.0, Herdr 0.9.3:

- Step 1, `node --test`: **3 of 3 passed**. Mutation check: a non-palette color and an unknown token each made their test fail.
- Step 2, `herdr config check` on the fragment: **`config: ok`, exit 0**. The same check on copies merged by hand into the live-spike configuration and into Herdr's `--default-config` output, in a temporary directory: **`config: ok`, exit 0** for both. A malformed token entry in a copy was rejected with a parse error, showing the rows are validated.
- Step 3, interactive: **not run** for this file. The spike configuration it was derived from was checked live on 2026-10-08, adding only the `$bar_unk` row entry here.

#### Pi-only layout follow-up

2026-10-08, macOS, Node 22.23.0, installed Herdr 0.9.3:

- `node --test`: **5/5 passed**, no skipped/cancelled tests. Colors/tokens are checked inside `rows_by_agent.pi`; the regression requires no global `rows`, panel-wide `row_gap = 1`, and a decorative-grey non-bold `bar_idle`.
- `HERDR_CONFIG_PATH=<temporary copy of sidebar.toml> herdr config check`: **`config: ok`, exit 0**, read-only. No server contact or live configuration change.
- Root links/anchors, guide inventory, exact CLAUDE entrypoints, whitespace and publication checks passed. The architecture diagram renders with existing grok-mermaid 0.2.3, non-null art and no warnings.
- Interactive rendering/reload: **not run**. Merge only `rows_by_agent.pi` and panel-wide spacing; preserve any existing global `rows` and other agent overrides.

#### SUB state

2026-10-08, macOS, Node 22.23.0, installed Herdr 0.9.3:

- `node --test`: **6/6 passed**. The new check reads the g1 state codes from the token contract and requires WRK and SUB accent, BLK and QNS critical, DNE primary and IDL/UNK decorative; removing the SUB rule made it fail.
- `HERDR_CONFIG_PATH=<temporary copy of sidebar.toml> herdr config check`: **`config: ok`, exit 0**. The same on a temporary copy of `herdr --default-config` with the fragment merged by hand: **`config: ok`, exit 0**. Read-only; no server contact or live configuration change.
- Interactive rendering: **not run** for this change.

#### Spaces validation (the procedure then)

From `herdr/`, run `node --test` for both fragments. The Spaces check reads the
plugin contract's one full-key-list line, tests every custom key exactly once,
every color against design-system exports and global state-icon theme roles.

Then run `node check-config.mjs` from `herdr/`. It invokes installed Herdr 0.9.3's read-only parser, only on temporary copies:

1. `HERDR_CONFIG_PATH=<spaces-copy> herdr config check`.
2. `HERDR_CONFIG_PATH=<sidebar-copy> herdr config check`.
3. `HERDR_CONFIG_PATH=<merged-copy> herdr config check`: merge Spaces color keys
   into sidebar's existing theme.custom, then append ui.sidebar.spaces once.
4. `HERDR_CONFIG_PATH=<invalid-copy> herdr config check`: a malformed row entry
   must be rejected, not treated as a valid merge.

The README then explained installation order and the global theme
scope. Interactive/live Herdr validation is not authorized and is not run.

#### Spaces fragment

2026-10-08, macOS, Node 22.23.0, installed Herdr 0.9.3:

**Passed**

- Root `npm install`: linked the existing design-system package; no tracked
  manifest/lockfile change. This resolved an initial missing-package test run.
- `cd herdr && node --test`: **10/10 passed**, zero skipped/cancelled; six
  existing agents checks and four Spaces palette/key/role/zero-state checks.
- `cd herdr && node check-config.mjs`: invokes exactly
  `HERDR_CONFIG_PATH=<temporary-copy> herdr config check` on each case:
  - `spaces.toml` alone: **`config: ok`, exit 0**.
  - `sidebar.toml` alone: **`config: ok`, exit 0**.
  - Both merged into one theme.custom table: **`config: ok`, exit 0**.
  - Invalid built-in row token: **rejected, exit 1**, expected; diagnostic
    `unknown sidebar token`. This is a successful negative check, not a failure.
- Root links/anchors, guidance inventory, exact CLAUDE imports, whitespace and
  publication review passed. Existing grok-mermaid 0.2.3 rendered changed root,
  Herdr and Spaces diagrams with non-null art and no warnings.

**Failed (resolved):** initial `node --test` before the root install could not
resolve the design-system package. Final required checks have no failures.

**Skipped:** none of the authorized required checks.

**Not run:** interactive/live Herdr, installed plugin invocation, reload,
rendering with/without scrollbar, native navigation/order and other color
depths/fonts. The approved quiet-space git-only second-row exception and the
five theme keys' wider effects were verified from source, not live rendering.

#### Spaces review fixes

2026-10-08, macOS, Node 22.23.0, installed Herdr 0.9.3:

- `cd herdr && node --test`: **10/10 passed**, zero failures/skipped/cancelled;
  Spaces keys now require `sp_` prefixes as well as exact contract membership.
- `cd herdr && node check-config.mjs`: runs only
  `HERDR_CONFIG_PATH=<temporary-copy> herdr config check`:
  Spaces alone, sidebar alone, and one-table merge each **`config: ok`, exit 0**;
  invalid row copy **rejected, exit 1** expected.
- Root links/anchors, guide inventory, exact CLAUDE entrypoints, whitespace and
  manual publication review: **passed**. No live config or server was contacted.
- Live/interactive Herdr and installation/reload: **not run**. Merge `$sp_` keys
  with the updated reporter; old unprefixed frozen tokens are no longer read.
  The plugin's corrected protocol evidence
  replaces the initial fake-server compatibility assumption, not parser evidence.

#### Spaces isolated rendering

2026-10-08: merged agents and Spaces fragments passed `herdr config check` and
ran in an isolated Herdr 0.9.3 server with the Spaces plugin linked; a client
capture replayed in xterm.js matched the design, including quiet rows with the
Spaces scrollbar shown. The run found quiet rows one cell too wide; the plugin
now sizes them for 31 cells (see the
plugin record).
Live session merge and reload: **not run**.

#### ACT / MDL access decay

2026-10-09, macOS, Node 22.23.0, installed Herdr 0.9.3; source checked offline:

- `cd herdr && node --test`: **13/13 passed**, 0 failures/skipped/cancelled. New checks: `ACT and MDL variants follow the complete access-decay color ladder in their original rows`; `Pi layout and every configured row fit Herdr 0.9.3 limits (16 rows, 16 entries)`; `exactly one ACT alternative resolves at every stage, with unchanged text order and no empty-row gap`. Existing exported-color, contract-key, exactly-one-entry and unaffected-state/Spaces checks still pass.
- `cd herdr && node check-config.mjs` runs only read-only `HERDR_CONFIG_PATH=<temporary copy> herdr config check`: sidebar, Spaces and one-table merge each **config: ok, exit 0**; malformed control **rejected, exit 1** expected.
- Initial implementation's single 24-entry ACT row was **rejected**: `sidebar rows may contain at most 16 tokens`. Source `src/config/sidebar.rs` also caps layouts at 16 rows. Approved correction: ACT d0+d1 and d2+d3 alternatives, 12 entries each; MDL eight entries in one row; eight configured Pi rows. `src/ui/sidebar/tokens.rs::agent_rows` drops empty alternatives; `src/client/shell/agent_sidebar.rs` applies row_gap only between AgentRow pane blocks. No extra gap is introduced; this is source/model evidence, not live rendering.
- Mutation proof: changed `dir_d2` from structural to the still-exported secondary color; `node --test --test-name-pattern='^ACT and MDL variants' test/sidebar.test.mjs` **failed 1/1, exit 1** as expected. Restored the ladder before the final **13/13** run.
- Root package setup, changed local links/anchors, guidance inventory, exact CLAUDE entrypoints, `git diff --check`, `git diff --cached --check`, new-contributor and exact-file publication/import/color reviews: **passed**. No new dependency or palette value; production reporter still renders no colors.
- Live/interactive Pi/Herdr, config merge/reload, terminal rendering and Mermaid rendering: **not run**; existing diagrams unchanged. Inherited `HERDR_*` variables were unset before every shell/test/parser run; no live socket/configuration or global Pi files touched. No push, PR or Linear mutation.
- Adoption requires the updated complete Pi row override and reporter together; merge rows first so later-stage keys can render. Memory-only age resets on reload/restart. Existing full-report partial-state/backoff, visibility approximation and untested font/color-depth limitations remain.

#### Acid & Orange theme (herdr-tui, removed)

This record is for the herdr-tui `theme.toml` fragment and `HERDR_CHROME`, both since removed.

2026-10-09, macOS, Node 22.23.0, installed Herdr 0.9.3. Inherited `HERDR_*` variables were unset before every shell, test and parser run.

**Passed**

- `cd design-system && node --test`: **388/388**, 0 failed/skipped/cancelled, including `package.test.mjs` **4/4** and `foundation/*.test.mjs` **21/21**. The new foundation check: `HERDR_CHROME` is frozen lowercase, `signalOrange` equals `SIGNAL_COLORS.cld`, and `mixOver(signalOrange, 0.3)` is `signalOrange30` `#4d1c00`.
- `cd pi/status-bar && node --experimental-strip-types --test test/footer-colors.test.ts` with the global Pi host: **1/1**. `HERDR_CHROME` is kept out of `SIGNAL_COLORS`, whose every value status-bar maps to a footer alias.
- `cd herdr && node --test`: **18/18**, 0 failed/skipped/cancelled; 13 existing sidebar and Spaces checks and 5 new theme checks.
- `cd herdr && node check-config.mjs`: Spaces, sidebar, theme, sidebar+Spaces merge and all-three merge each **`config: ok`, exit 0**; malformed row copy and misspelled theme key copy each **rejected, exit 1**, expected.
- Mutation checks, each restored: a non-exported `overlay1`, a `yellow` duplicated into `theme.toml`, `panel_bg` set to the surface, `blue` removed, and a changed `sidebar_bg` in `sidebar.toml` each failed the theme tests (2, 3, 2, 3 and 1 of 5 failing); `signalOrange30` set to `#4d1b00` failed the foundation check.
- Root changed links and anchors, guidance inventory, exact CLAUDE entrypoints, `git diff --check`, `git diff --cached --check`, new-contributor and publication/private-path reviews. Existing grok-mermaid 0.2.3 rendered the changed root and Herdr diagrams with non-null art and no warnings.

**Failed:** none. **Skipped:** none.

**Live merge:** the same 11 keys were merged by hand into the operator's config; `herdr config check` printed **`config: ok`, exit 0**, and `herdr server reload-config` returned **`applied`** with no diagnostics.

**Not run:** an agent-observed check of the rendered theme, the mobile layout, and other color depths. What each key colors is from Herdr 0.9.3 source, not observation; contrast ratios are computed from the hex values.

#### Pane-name row

2026-10-15, macOS, Node 22.23.0, installed Herdr 0.9.3:

- `node --test`: **19/19 passed**, zero failures/skipped/cancelled. Row 5 uses pane instead of ev_act, with secondary label and decorative gutter, no decay or phase-target entry. The full 52-key contract, palette and native row limits still pass.
- `HERDR_CONFIG_PATH="$PWD/sidebar.toml" herdr config check`: **config: ok, exit 0**. `node check-config.mjs`: Spaces, sidebar, theme and both merges **config: ok**; invalid row and invalid theme controls **rejected as expected**. Only checkout/temporary configs read; no live server mutation.
- Initial `node --test`: **failed**, missing root design-system package link. Supervisor authorized the documented root `npm install` setup exception: one local package linked, zero vulnerabilities, no tracked manifest/lockfile changes. Final checks above pass.
- Changed local links/anchors, guidance inventory, exact CLAUDE imports, both whitespace checks, new-contributor/publication/color review and full-diff simplification **passed**. Palette values unchanged; the new pane entry uses the exported secondary role.
- Live merge/reload, interactive rendering/rename, other fonts/color depths and Mermaid rendering: **not run**. Diagrams unchanged; no renderer on PATH. Update the reporter and complete Pi row override together.

#### Manual flag

2026-10-15, macOS, Node 22.23.0, installed Herdr 0.9.3; every `HERDR_*` variable unset:

- Root `npm install` in the fresh worktree: linked the existing design-system package, 0 vulnerabilities, no tracked change.
- `node --test`: **20/20 passed**, 0 failed/skipped/cancelled. New: `row 1 draws the manual flag in critical red after the SPACE name and before the goal time`, which also requires the contract to define `flag`; the existing contract-key, one-entry-per-key, palette and 16-row/16-entry checks cover the 53-key list and the six-entry row 1. Mutation proof, each restored: a secondary-colored flag and a flag moved after `gt_off` each failed it.
- `HERDR_CONFIG_PATH="$PWD/sidebar.toml" herdr config check`: **config: ok, exit 0**. `node check-config.mjs`: Spaces, sidebar, theme and both merges **config: ok**; invalid row and theme controls **rejected, exit 1**, expected.
- Placement and spacing are from Herdr 0.9.3 source (`src/ui/sidebar/tokens.rs::separator`, `src/ui/sidebar.rs::resolved_token_spans`): ` · ` between custom tokens, full width when the row fits. Live merge/reload and rendering: **not run**. Update the reporter and the Pi row override together; an old fragment does not draw `flag`.

#### RUN state

2026-10-17, macOS, Node 22.23.0, installed Herdr 0.9.3; every `HERDR_*` variable unset:

- `node --test`: **20/20 passed**, 0 failed/skipped/cancelled. The updated contract-state check requires RUN to use the same accent rule as SUB; the 53 keys and native row limits remain unchanged.
- `HERDR_CONFIG_PATH=<temporary copy of sidebar.toml> herdr config check`: **config: ok, exit 0**. Only the temporary file was read; no live Herdr or configuration was contacted or changed.
- Live merge/reload and interactive rendering: **not run**. Reporter verification and review fixes are in the sidebar record.

#### Spaces state icon

2026-10-29, macOS, Node 22.23.4, installed Herdr 0.9.5; every `HERDR_*` variable unset for the parser:

- `node --test`: **20/20 passed**. The Spaces checks now require no `state_icon`, and a leading `$sp_panes` in decorative grey with `◐` accent, `×` critical and `✓` primary rules; the five global state-icon theme keys keep their roles.
- `node check-config.mjs`: Spaces, sidebar, theme and both merges **config: ok, exit 0**; invalid row (now replacing `$sp_panes`) and invalid theme controls **rejected, exit 1**, expected.
- Rendering in an isolated Herdr is in the Spaces record. Live merge/reload: **not run**. Update the plugin and this fragment together: an old fragment draws Herdr's icon before the new `◐ 05PN`, and a new fragment with an old plugin draws no icon.
