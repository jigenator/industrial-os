# Contributing

Follow the [root contributing guide](../../CONTRIBUTING.md) and the [plugin group rules](../AGENTS.md).

## Toolchain and setup

Bun 1.4.4 (it runs the TypeScript directly and provides the PTY for the terminal check), and a repository checkout where the root `npm install` has run, so `@industrial-os/design-system` resolves from the root `node_modules`. The [stack decision](../../docs/decisions/automations-monitor-stack.md) fixes the versions.

```sh
npm install                                   # repository root, once
cd herdr-plugins/automations-monitor
bun install --frozen-lockfile                 # effect, @effect/platform-bun, typescript, @types/bun
```

## Commands

Run from this directory. Everything below uses the fake `tatsu` in `fixtures/fake-tatsu.ts`, never the real CLI.

| Command | What it does |
| --- | --- |
| `./node_modules/.bin/tsc --noEmit -p .` (`bun run typecheck`) | Strict type check of `src`, `bin`, `test`, `fixtures` and `types` with TypeScript 7.0.2 |
| `bun test` | Reader, poller, model, frames, keys and source tests |
| `bun test/pty-check.ts` (`bun run pty-check`) | The live pane in a real pseudo-terminal: raw mode, `stty -g` restored, alternate screen left and cursor shown, and no fake process left, for `q`, SIGTERM, an uncaught error, a defect in the loop, and `q` and SIGTERM during a read that ignores SIGTERM |
| `sh -n bin/automations-monitor.sh`; `sh bin/automations-monitor.sh bad` | Launcher syntax; usage on stderr and exit 2 |
| `AUTOMATIONS_MONITOR_TATSU=$PWD/fixtures/fake-tatsu.ts FAKE_TATSU_SCENARIO=floor bun bin/automations-monitor.ts --frame 160x51 --plain` | One frame to stdout; add `--screen schedules`, `--log`, `--modal`, `--no-motion` or `--time MS`, and drop `--plain` for colour |
| `AUTOMATIONS_MONITOR_TATSU=$PWD/fixtures/fake-tatsu.ts bun bin/automations-monitor.ts` | The live pane against the fake, in your terminal |

Fake scenarios (`FAKE_TATSU_SCENARIO`): `floor` (default), `empty`, `stopped`, `unreachable`, `no-schedules`, `schedules-error`, `error`, `garbage`, `exit`, `unsupported`, `invalid`, `no-lists`, `big`, `stubborn`, `leaves-child`, `orphan-exit` and `hang`. `FAKE_TATSU_LOG` records each call's argv, times and process IDs as JSON lines; `FAKE_TATSU_DELAY_MS` delays the answer.

Reading the real CLI (`bun bin/automations-monitor.ts --frame 160x51` without the override) is read-only, but its output is private: look at it locally and never commit it, its paths, IDs or machine names.

## Validation sequence

| Order | Check | Covers |
| --- | --- | --- |
| 1 | `bun install --frozen-lockfile` | The lockfile matches the manifest |
| 2 | `tsc --noEmit` | Types, strict |
| 3 | `bun test` | Decoding and every failure kind against the fake (exact argv; timeout and interrupt killing a process group whose leader and descendant ignore SIGTERM; a descendant left by a leader that exits; too large; error envelope; unsupported; garbage; a missing binary); polling with no overlap and the interval after each read; states, groups and the failed-last-run rule; frame size and glyphs at 200×50, 160×51, 120×40, 80×24, 60×16 and smaller; no path on screen; each failure's wording; motion-off stillness; keys, the modal, clicks and scrolling; no colour literal and only exported design-system imports |
| 4 | `sh -n` and a bad argument on the launcher | Launcher syntax and usage |
| 5 | `bun test/pty-check.ts` | Terminal lifecycle and process teardown in a real PTY |
| 6 | `bun test/golden/golden.ts compare <base-ref> <out-dir>` | Every golden frame byte-identical to the base's; required for a change meant to leave the screen alone. See [Golden frames](#golden-frames) |
| 7 | Rendered frames | `--frame` output for each scenario rendered as PNGs outside the repository and compared with the approved mockup; see [Rendered check](#rendered-check) |
| 8 | Isolated Herdr | [Isolated Herdr check](#isolated-herdr-check) |
| 9 | Live Herdr | Interactive use in the operator's own session; requires the operator to link the plugin; not a development check |

Then the [repository-wide checks](../../CONTRIBUTING.md#repository-wide-checks).

### Golden frames

`test/golden/golden.ts` draws the monitor's `--frame` output, with colour, for 13 fake scenarios. Each is drawn at eight sizes from 200×50 to 30×5, on both screens, with five flag sets (none, `--log`, `--modal`, `--no-motion`, and all three), at `--time 0` and `600` (lamp lit and dim): 2080 frames. The wall clock is frozen by the `test/golden/freeze.ts` preload in both the monitor and the fake (`test/golden/fake-tatsu.sh`), with `TZ=UTC`. No baseline is stored. `compare <base-ref> <out-dir>` draws the base ref from a temporary `git archive` of its monitor and design system into `<out-dir>/base`, then draws this checkout into `<out-dir>/head`. It compares every frame and its stderr byte for byte and exits 1 on any difference. `capture <out-dir> [--ref <ref>]` and `diff <base-dir> <out-dir>` do the two halves separately. Each run spawns Bun about 6,000 times, and takes about two minutes on an Apple-silicon laptop. Keep `<out-dir>` outside the repository, for example under `/tmp`.

The `stubborn`, `leaves-child`, `hang` and `orphan-exit` scenarios are left out. Their reads end only through the reader's timeout or its TERM-to-KILL grace, which the frozen clock stops, and `orphan-exit` would draw the `floor` frame. `bun test` and the PTY check cover them.

### Rendered check

Render `--frame` output (with colour) through xterm.js in headless Chrome, outside the repository, for example under `/tmp/automations-monitor-shots/`: write the ANSI text to an HTML page that loads `@xterm/xterm` installed in that temporary directory, then `chrome --headless=new --screenshot`. Compare with the mockup's `v5`, `v4-modal` and `v3b` shots. Never commit images; a render of the real CLI is private.

### Isolated Herdr check

Use a throwaway Herdr that shares nothing with a live session, as in the [Spaces procedure](../spaces/CONTRIBUTING.md#throwaway-server-check): run every `herdr` command under `env -i` with a temporary `HOME`, `XDG_CONFIG_HOME`, `XDG_STATE_HOME`, an explicit `HERDR_SOCKET_PATH` in a short directory, a `PATH` with Bun and Herdr but not `tatsu`, and `AUTOMATIONS_MONITOR_TATSU` pointing at the fake. Never pass inherited `HERDR_*` variables. Record SHA-256 checksums of the live `config.toml` and `plugins.json` first.

1. Start `herdr server`, `herdr plugin link` this directory, then `herdr workspace create`.
2. Attach a client (`herdr`) in a pseudo-terminal of a known size; dismiss the welcome with Enter and the first-run settings dialog with Esc.
3. `herdr plugin action invoke industrial-os.automations-monitor.open`; `herdr pane layout` shows the split, and `herdr pane read <pane> --source visible` shows the monitor at the pane's size.
4. Through the client, send `m`, `r` and `2`; read the pane for `MOTION OFF`, a fresh read time and the schedules screen.
5. `herdr pane resize --pane <pane> --direction left|right --amount <fraction>` and read the pane at each width.
6. `open-tab`, `herdr tab focus` it, and `q` through the client closes only that tab; focus the first tab and `q` closes the split.
7. `herdr server stop`, check no process remains under the temporary directory, delete it, and compare the live checksums.

## Verification records

### 2026-10-28 · drawn with design-system parts · Bun 1.4.4, TypeScript 7.0.2, Effect 4.0.6, macOS, Herdr 0.9.5

The views now place design-system elements (section head, label plates, board marks, time lane, readout, pixel numerals in the instrument and tall faces, event row, tab and vertical rules, scroll rail, the board popup's frame, title bar and backdrop, phase steps and right-aligned detail rows) through `Canvas.blit`; the local numeral fonts, rules, marks, lanes and colour mixes are gone, and `theme.ts` takes its inks, tones and category colours from the design system.

**Frames — identical.** Before any source change, `--frame` output (with colour) was captured for 13 fake scenarios (`floor`, `empty`, `stopped`, `unreachable`, `no-schedules`, `schedules-error`, `error`, `garbage`, `exit`, `unsupported`, `invalid`, `no-lists`, `big`) at 200×50, 160×51, 120×40, 80×24, 60×16, 59×16, 50×10 and 30×5, on both screens, with no flags, `--log`, `--modal`, `--no-motion` and all three, at `--time 0` and `600` (lamp lit and dim): **2080 frames**, with the wall clock and `Date` frozen by a Bun preload and `TZ=UTC`. Two captures of the unchanged tree were identical. After the change every frame was **byte-identical** (0 differences). `stubborn`, `leaves-child`, `hang` and `orphan-exit` were left out: a frozen clock stops the read timeout, and `orphan-exit` draws the `floor` frame. This harness is now [`test/golden/`](#golden-frames).

**Automated — passed.**

- `bun install --frozen-lockfile`: `Checked 11 installs across 31 packages (no changes)`.
- `tsc --noEmit -p .` (Version 7.0.2): no errors.
- `bun test`: 58 pass, 0 fail, 19,356 expectations, 7 files (two new canvas tests: every `EXTRA_GLYPHS` glyph is a design-system glyph, and `blit` keeps colours a line leaves unset and skips blank unstyled cells).
- `sh -n bin/automations-monitor.sh`: exit 0. `sh bin/automations-monitor.sh bad`: usage, exit 2.
- `bun test/pty-check.ts`: all 6 cases passed, no fake process left.

**Rendered — not re-run.** The frames are byte-identical to those before the change, so their renders are unchanged.

**Isolated Herdr 0.9.5 — passed.** Every command ran under `env -i` with a temporary home, XDG directories and socket, and a `PATH` without `tatsu`. `plugin link` accepted the manifest; `open` split the shell pane and the monitor drew at the pane's size. Through an attached 200×50 client, `m` showed `MOTION OFF`, `2` the schedules, and `r` a fresh read (`READ 0S AGO`). Resizing wider added `OBSERVE ONLY`; resizing to 52 columns drew `AUTOMATIONS 50x47: TOO SMALL`. `open-tab` drew the tall-readout layout at full width. `q` in the split closed only the monitor's pane, leaving the shell, and `q` in the tab closed that tab. `herdr plugin log list` showed both actions succeeded with exit 0 and empty stderr. After `herdr server stop` no process remained under the temporary directory, which was deleted, and the live `config.toml` and `plugins.json` SHA-256 checksums were unchanged.

**Not run:** the real CLI and live Herdr.

**Rebased onto `8d35990` (dispatch feed) — passed.** The design system names the small pixel face `instrument`, so the readout's slot numeral asks for that face (same glyphs). A fresh capture from `origin/main`'s monitor matched the earlier baseline in all 2080 frames, and the rebased monitor's frames differ from it in none. The frozen install made no change, and `tsc` is clean. `bun test` passes 58/58, `sh -n` and the usage exit pass, and `bun test/pty-check.ts` passes 6/6. The isolated Herdr 0.9.5 check repeated steps 1–7 through a 300×50 client: 14 of 14 assertions passed, no process remained, and the live checksums were unchanged.

**Review fixes — passed.** The fixes are:

- Lane columns are clamped just off the lane on the right, as on the left. A run recorded ahead of this clock draws nothing, and a start far enough ahead no longer exceeds the time lane's column bound. A new frames test renders the fixtures 2 hours, 30 days and 2 years behind their clock. It failed before the clamp, with `RangeError: from must be an integer column`.
- The modal backdrop mixes each colour pair once per frame.
- The golden harness is committed as `test/golden/`. Run at `origin/main`, its capture matched the original out-of-repository baseline in all 2080 frames. This checkout then showed 0 differences across 2080 frames.
- `tsc` is clean, and `bun test` passes 59/59. `bun test/pty-check.ts` passes 6/6. The isolated Herdr 0.9.5 check (steps 1–7) passes 14/14 with the live checksums unchanged.

### 2026-10-23 · first version · Bun 1.4.4, TypeScript 7.0.2, Effect 4.0.6, macOS, Herdr 0.9.5

**Automated — passed.**

- `bun install --frozen-lockfile`: `Checked 11 installs across 31 packages (no changes)`.
- `tsc --noEmit -p .` (Version 7.0.2): no errors.
- `bun test`: 54 pass, 0 fail, 19,332 expectations, 6 files.
- `sh -n bin/automations-monitor.sh`: exit 0. `sh bin/automations-monitor.sh bad`: usage on stderr, exit 2. With no Bun on `PATH`, and with a Bun stub exiting 7, the pane printed what was wrong and waited for Enter.
- `bun test/pty-check.ts`: all 6 cases passed. `q` and SIGTERM exited 0 about 26 ms after the stop; an uncaught error and a defect in the loop exited 1 with the redacted message `automations-monitor: check defect at <path>` after the terminal was restored; `q` and SIGTERM during a SIGTERM-ignoring read exited 0 about 1,035 ms after the stop, once the fake's leader and descendant were gone. In every case the terminal was raw while running, `stty -g` matched before and after, the alternate screen was left and the cursor shown.

**Rendered — passed, compared by eye.** 21 frames under `/tmp/automations-monitor-shots/` (not committed): pipelines at 200×50, 160×51 (default, log, modal, motion off), 120×40 and 80×24; schedules at 160×51 and 80×24; the modal at 80×24; a 50×10 notice; stopped, unreachable, empty, no schedules, an error envelope, an unsupported schema, garbage and a schedules-only error; and two renders of this machine's real CLI, which are private. Against the mockup's `v5`, `v4-modal` and `v3b` shots the layout, groups, lanes, bars, NOW line, modal and schedule rows match, apart from the deviations listed in [design](docs/design.md#deviations-from-the-mockup).

**Real CLI — read only.** `--frame 160x51` against this machine's `tatsu` decoded both commands (4 pipelines, 70 runs; 0 schedules) and drew them; nothing was committed from it.

**Isolated Herdr 0.9.5 — passed.** Every command ran under `env -i` with a temporary home, XDG directories and socket. `plugin link` accepted the manifest (pane `monitor`, actions `open` and `open-tab`, the `bun install --frozen-lockfile` build listed). `open` split the shell pane into two 87×49 panes and the monitor drew its compact layout at the pane's width. Through an attached 200×50 client, `m` changed the footer to `MOTION OFF`, `r` started a fresh read (`READ 1S AGO` where the previous read would have been 4 s old), and `2` showed the schedules. Resizing wider redrew it with `OBSERVE ONLY` in the header and `NEXT READ` in the footer; resizing to 50 columns drew `AUTOMATIONS 50x47: TOO SMALL`. `open-tab` drew the tall-readout layout at full width; `q` there closed only that tab, and `q` in the split closed it, leaving the shell pane. `herdr plugin log list` showed both actions succeeded with exit 0 and empty stderr. After `herdr server stop` no fake or monitor process remained, and the live `config.toml` and `plugins.json` SHA-256 checksums were unchanged.

**Failed, then fixed during development:** in the first PTY runs Bun's version-manager shim prompted for trust and the pane's stdin was `/dev/tty`, which Bun cannot watch on macOS; the check now puts Bun's own directory first on `PATH` and passes the terminal by device name. The first teardown test counted a killed descendant that was still a zombie as alive; liveness now excludes zombies. The first `↓` re-selected the already highlighted pipeline. NEXT POLL kept counting down while the runner was unreachable. In the isolated Herdr, the first keys went to the first-run settings dialog.

**Not run:** the operator's live Herdr session (not a development check), `herdr plugin install` from GitHub, Herdr running the `[[build]]` (link builds nothing; the build command was run by hand), Linux, terminals other than xterm.js and Herdr's client, a long-running soak, and a machine with schedules on the real CLI.

### 2026-10-23 · failed schedules follow the pipeline rule · Bun 1.4.4, TypeScript 7.0.2, macOS

A failed last run no longer puts a schedule under NEEDS ATTENTION or raises an alert; only a pause or a definition problem does, and a paused row shows its reason in the NEXT column.

**Passed — automated.** `tsc --noEmit -p .` clean. `bun test`: **55 passed**, 0 failed; the schedule grouping test was updated and one regression added (a failed, unpaused schedule stays ON; a pause caused by a failure is under NEEDS ATTENTION with its reason). `git diff --check` clean.

**Passed — rendered.** `--frame 160x40 --plain --screen schedules` and `--frame 80x24`: `QUOTA-REFRESH` under ON with `✕ 12M AGO`; `CERT-CHECK` under NEEDS ATTENTION as `PAUSED`, with `SCRIPT FAILED` at 160 columns and `SCRIPT FA…` at 80.

**Not run:** the PTY check, the isolated Herdr check (no change to the terminal host, reader or launcher) and a machine with schedules on the real CLI.

### 2026-10-27 · consume the design system's color declarations

After DS-1 added the colocated `foundation/industrialos-colors.d.mts`, the redundant local ambient declaration and its `tsconfig` include were removed; no runtime, manifest or lockfile changed.

**Passed — automated.** Bun 1.4.4, TypeScript 7.0.2, Node v22.23.4, macOS: `bun install --frozen-lockfile`, `./node_modules/.bin/tsc --noEmit -p .`, and `bun test` (**55 passed**, 0 failed, 19,335 expectations across six files). Strict types now resolve the package declaration directly. Whitespace and changed-document links/anchors passed.

**Not run:** PTY, native Herdr, live Tatsu or installation. This declaration-only cleanup changes none of those runtime paths.
