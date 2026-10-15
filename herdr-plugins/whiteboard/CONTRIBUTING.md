# Contributing

Follow the [root workflow](../../CONTRIBUTING.md). Toolchain: Rust stable with Cargo (checked with 1.97.1), Node 22 for the palette check, Python 3 for the PTY check. Run the root `npm install` once so the palette check can import the design-system package. No live Herdr server or installed plugin is needed.

## Validation sequence

| Order | Directory | Command or check | Effects and coverage |
| --- | --- | --- | --- |
| 1 | `herdr-plugins/whiteboard/` | `cargo test --locked` | Wrapping, wide characters, sizes, hit tests, board paths, load errors, atomic save, synthetic mouse and key input, save conflicts and failures, rendering and clipping through `TestBackend`. Writes only to the temporary directory |
| 2 | `herdr-plugins/whiteboard/` | `cargo clippy --all-targets --locked` | No warnings |
| 3 | `herdr-plugins/whiteboard/` | `node --test` | `palette.rs` matches `@industrial-os/design-system/foundation/palette`; no color is written elsewhere |
| 4 | `herdr-plugins/whiteboard/` | `cargo build --release --locked && python3 test/pty_smoke.py` | The built binary through `bin/whiteboard.sh pane` in a pseudo-terminal, with Herdr variables pointing at a temporary directory: mouse capture on and off, empty state, toolbar click, typing, drag, double-click, keyboard move, the per-workspace board file, and reopening it |
| 5 | Root | [Repository-wide checks](../../CONTRIBUTING.md#repository-wide-checks) | Links, guide map, entry points, whitespace, publication review |
| 6 | Isolated Herdr | [Isolated Herdr check](#isolated-herdr-check) | Manifest, both actions, split and tab panes, mouse and focus through a Herdr client, resize, storage, reopen |
| 7 | Live Herdr | Interactive use in the operator's own session | Requires the operator to link or install the plugin; not a development check |

### Isolated Herdr check

Use a throwaway Herdr that shares nothing with a live session, as in the [Spaces procedure](../spaces/CONTRIBUTING.md#throwaway-server-check): run every `herdr` command under `env -i` with a temporary `HOME`, `XDG_CONFIG_HOME`, `XDG_STATE_HOME` and an explicit `HERDR_SOCKET_PATH` in a short directory. Record checksums of the live `config.toml` and `plugins.json` first.

1. Start `herdr server`, `herdr plugin link` this directory, then `herdr workspace create`.
2. `herdr plugin action invoke industrial-os.whiteboard.open`; `herdr pane layout` shows a `Whiteboard` pane split to the right in the current tab, and `herdr pane read` shows the empty board. `open-tab` adds a new tab instead.
3. Attach a client (`herdr`) in a pseudo-terminal and press Enter to dismiss the first-run welcome dialog, which otherwise takes the first input. Find the pane's screen origin from the client's output (where it draws `WHITEBOARD`); `herdr pane layout` coordinates exclude the sidebar and tab bar. Send SGR mouse sequences to the client at that offset, and read the result with `herdr pane read --source visible`.
4. Resize the split with `herdr pane resize` and read the pane again while the client is attached; without a client, `pane read` does not reflect the layout width.
5. Press `q`; only the board's pane closes, and the board is under the isolated `XDG_STATE_HOME`. Reopen it and read it back.
6. `herdr server stop`, delete the directory, and compare the live checksums.

## Verification records

### Initial plugin

2026-10-14, macOS, rustc 1.97.1, Node 22.23.0, Python 3.14.5, Herdr 0.9.3.

**Passed**

- `cargo test --locked`: **23 passed**, 0 failed.
- `cargo clippy --all-targets --locked`: no warnings.
- `node --test`: **2/2 passed**. Changing one hex digit in `palette.rs`, and adding `Color::White` to `app.rs`, each made a test fail; both were reverted.
- `python3 test/pty_smoke.py`: `PTY SMOKE OK`.
- `sh bin/whiteboard.sh pane` in a copy without a build printed the build command and exited 1 after Enter; an unknown mode exited 2.
- Isolated Herdr 0.9.3: `plugin link` accepted the manifest and listed the `board` pane and `open` action. The action opened a `Whiteboard` pane in a new tab, which rendered the empty board. Through an attached 140×40 client, with the pane at a 26-column, 1-row offset: a click on `+ NOTE` created a note; slow and burst typing both arrived; a drag moved the note 20 columns and 6 rows; a double-click created free text; `q` saved and closed the tab. The board was at `<state>/herdr/plugins/industrial-os.whiteboard/boards/<hash>/w1.json`, and reopening showed both items. Live `config.toml` and `plugins.json` checksums were unchanged.

**Failed, then fixed during development:** the first isolated attempt sent clicks at pane coordinates without the client's sidebar offset, so nothing was hit; the procedure above now finds the offset.

**Not run:** the operator's live Herdr session; `herdr plugin install` from GitHub, which would run the build step; scroll-wheel and right-drag panning through Herdr; Linux; other terminals and fonts; resize while running.

### Split placement

2026-10-14, macOS, Herdr 0.9.3. The pane now opens as a split by default; `open-tab` keeps the tab. The toolbar drops its title plate before any button.

**Passed**

- `cargo test --locked`: **24 passed** (new: the narrow toolbar keeps its buttons and shows the title again when everything fits). Clippy: no warnings. `node --test`: 2/2. `python3 test/pty_smoke.py`: `PTY SMOKE OK`.
- Isolated Herdr 0.9.3: `plugin link` accepted `placement = "split"` and listed `open` and `open-tab`. `open` split the focused pane 60/60 in the same tab; `open-tab` opened a new tab; a direct `pane open` without a placement split the focused pane. Both actions logged `succeeded`, exit 0.
- Through an attached 160×40 client with the board on the right: a double-click created text and typing reached it; clicking the left pane moved focus there, and clicking back focused the board and acted on it in the same click; `q` closed only the board, leaving the other pane.
- Resizing the split with an attached client redrew the board at 40, 13 and 67 columns.
- Live `config.toml` and `plugins.json` checksums were unchanged.

**Failed, then explained:** a first double-click went to Herdr's first-run welcome dialog in the fresh isolated home; dismissing it is now step 3. In one resize run, a `q` typed through the client did not reach the board although Herdr reported it focused; `herdr pane send-keys` closed it. Not reproduced in the split-focus run, where the client's `q` worked.

**Not run:** the operator's live session, `--direction down`, scroll and right-drag panning through Herdr, Linux.

### Connectors and readline editing

2026-10-15, macOS, rustc 1.97.1, Node 22.23.0, Python 3.14.5. Automated checks only; no Herdr server was contacted.

**Passed**

- `cargo test --locked`: **42 passed**, 0 failed. Includes legacy ids and arrow cleanup, exact routes, bounded routing across distant coordinates, mouse and keyboard connectors, selection and deletion, every editing binding, wrapped/wide cursor placement, layering, heavy selection and small terminals.
- `cargo clippy --all-targets --locked`: no warnings.
- `node --test`: **2/2 passed**.
- `cargo build --release --locked && python3 test/pty_smoke.py`: `PTY SMOKE OK`; the saved JSON contains a border-drag connector between two notes and `hello world` inserted using `Ctrl+A`.
- Repository-wide checks: changed local Markdown links and anchors, guide inventory/map, exact `CLAUDE.md` entrypoints, both whitespace checks, contributor reading and publication review. No palette values or dependencies changed; nothing staged.

**Failed, then fixed during development:** an initial preview test expected a visible arrow while the cursor was still inside its source; corrected to expect no route until outside. Clippy found a redundant test struct update; removed. The palette check initially lacked the root package link; ran the documented `npm install` setup, leaving both root manifests unchanged. The first extended PTY drag pressed a border covered by the other note; separated the notes and used the uncovered source border.

**Not run:** the optional isolated Herdr check, the operator's live session, Linux, other terminals/fonts, manual Option/Alt-as-Meta behavior. Earlier Herdr records above do not verify these new interactions.

### Arrow junction and clearance follow-up

2026-10-15, same toolchain and automated-only scope as the connector record above.

**Passed**

- `cargo test --locked`: **45 passed**, 0 failed. Three added regressions cover direction-union junctions and head precedence, the exact 80×18 repro (then a crossing extension), selected-arrow draw order, real-rectangle middles, the note-to-text L route and gaps consumed by shadows. Existing distant-coordinate and clipping tests still pass.
- `cargo clippy --all-targets --locked`: no warnings; `node --test`: **2/2 passed**.
- `cargo build --release --locked && python3 test/pty_smoke.py`: `PTY SMOKE OK`.
- `git diff --check` and `git diff --cached --check`: passed; nothing staged.

**Failed, then fixed:** no validation failures during this follow-up. The reported overwriting and shadow-classification defects are fixed and pinned by regressions.

**Not run:** new isolated/live Herdr or manual terminal checks by this implementation run; the supervisor's tmux reproduction is separate evidence.

### Isolated Herdr-client connectors and editing

2026-10-15, Herdr 0.9.3. Supervisor-provided end-to-end evidence, captured before the review fixes below; separate from automated test counts. All Herdr commands used `env -i`, temporary HOME/XDG directories and an explicit temporary socket. Client: 220×45, board origin column 125, row 3.

**Passed**

- Through the client, `+ NOTE` created two notes. A border drag showed both free and snapped previews before release, created an arrow, and moving the target rerouted it.
- `a` / `Tab` / `Enter` created the reverse arrow; `Tab` selected it and `Delete` removed it.
- Readline `Ctrl+A`, `ESC-f`, `Ctrl+K`, `Ctrl+E`, `Ctrl+Y` produced `PRE Beta one two`, with the cursor one cell after the text. Herdr intercepted `Ctrl+B` as its default prefix; use `←` unless the prefix is changed.
- `q` saved and closed only the board pane. Saved JSON had ids 1,2 and arrow 1→2; reopening rendered the same board. Resizing redrew at 66 columns; `open-tab` rendered the board in a new tab.
- Live `config.toml` and `plugins.json` checksums were unchanged.

**Failed/unexplained:** after the CLI `open-tab` action, a client `q` closed the earlier split pane while Herdr reported the tab pane focused. This matches the earlier focus-discrepancy note; it is not attributed to these changes.

**Not run:** physical Option-as-Meta, Linux, other terminals, the live session. This implementation run did not repeat the supervisor's isolated-client check.

### Performance and cursor review fixes

2026-10-15, same automated toolchain as above.

**Passed**

- `cargo test --locked`: **48 passed**, 0 failed. Three added tests cover 100,000-character text and note `lines()`/cursor calls under 200 ms in debug with preserved contents, per-character ZWJ/CJK/combining-mark widths, and editing, reopening and corner-resizing exactly-full 8×3 and 24×7 notes with the cursor inside the bottom border.
- `cargo clippy --all-targets --locked`: no warnings; `node --test`: **2/2 passed**.
- `cargo build --release --locked && python3 test/pty_smoke.py`: `PTY SMOKE OK`.
- `git diff --check` and `git diff --cached --check`: passed; nothing staged.

**Failed, then fixed:** no validation failures during this review-fix run. Removed quadratic prefix measurement and reserved the virtual insertion row. Widths now sum `UnicodeWidthChar` cells, matching drawing, as approved during review. An independent re-review found that corner-resizing a note while editing could still put the cursor on the border; resizing now refits the note while editing, and the cursor test fails without that fix. The re-review compared wrapping with the previous implementation over 503,883 ASCII, CJK and combining-mark cases with no differences; loaded control characters such as tabs now wrap at their drawn width of zero.

**Not run:** a fresh isolated-client check after these fixes, live Herdr, Linux or manual terminal/Option-as-Meta checks. The separate client evidence above predates these fixes.

### Bends around other items

2026-10-15, same toolchain. An arrow with one bend now takes the other bend when the usual one would pass under a third item.

**Passed**

- `cargo test --locked`: **49 passed**, 0 failed. New: a three-note layout where the usual bend sits under the first note routes down and in from the side, returns to the usual bend once the note moves away, and keeps the usual bend when both are blocked. One rendering test now expects the clear bend.
- `cargo clippy --all-targets --locked`: no warnings; `node --test`: **2/2 passed**; `cargo build --release --locked && python3 test/pty_smoke.py`: `PTY SMOKE OK`.
- The release binary in a private tmux session drew the operator's reported layout before and after: the bend that had been hidden under a note now runs clear of it.

**Not run:** an isolated or live Herdr check, Linux, other terminals.
