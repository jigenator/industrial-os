# Contributing

Follow the [repository workflow](../CONTRIBUTING.md) as well as this project's checks.

## Toolchain and setup

The maintained content is a herdr-app mod in plain JavaScript, a layout and a theme in JSON. The checks use Node.js 22 with its standard library and the design-system package; there is no dependency or lockfile in this project, and `mods/package.json` only marks the mod's files as ES modules for Node. Run `npm install` once at the repository root so `@industrial-os/design-system` resolves; see [setup](../CONTRIBUTING.md#setup). `herdr-app check` needs an installed Herdr desktop app; it was run with herdr-app 0.1.15.

## Validation sequence

| Order | Directory | Command | Prerequisites/effects | Coverage |
| --- | --- | --- | --- | --- |
| 1 | `herdr/` | `node --test` | Root install; reads the mod's pure modules, `layouts/industrial-os.json`, `test/fixtures/` and `themes/acid-black.json`; no writes | Label parsing and stale labels; every state, unknowns, caps, decay, the finished rule, space aggregation and quiet ages; the layout differs from shipped `main` only in the sidebar block and the frozen Lunalee column; the mod's imports; desktop theme values |
| 2 | `herdr/` | `herdr-app check mods/industrial-os` | Installed herdr-app; loads the mod once with empty in-memory state, in a hidden window; changes nothing in the running app. It writes `gpui-kit.d.ts` and `jsconfig.json` into the mod folder for editors; Git ignores them | The mod loads and its initial description materializes: prints `check passed: mods/industrial-os`, exit 0. Only the empty state renders |
| 3 | Herdr app | Manual, by an operator: install as in the [README](README.md#install), switch to the layout, and watch Pi agents with the signals publication and other agents | Changes the live app's files and layout | Populated rendering, every state, clicks, agent order, ahead/behind, live clocks, the look |

Then follow the [repository-wide checks](../CONTRIBUTING.md#repository-wide-checks). Record every check as passed, failed, skipped or not run. Step 2 proves the mod loads, not how populated rows look or behave.

The theme has its own manual step: install as in the [README](README.md#theme), then `herdr-app status` must show no `settings.error`, and `herdr-app shot` shows the sidebar, tab bar, a terminal and an agent's status in the theme. Changes the live app configuration.

## Making a change

Change the source first: a color in the design system, a label field in [the snapshot contract](../pi/signals-collector/docs/contract.md). Then change the pure module and its test, then `main.js` if what is drawn changes, update [the design](docs/design.md), and run the sequence.

## Verification records

Record each run with its date, app version and results.

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
