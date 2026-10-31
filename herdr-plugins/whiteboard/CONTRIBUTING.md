# Contributing

Follow the [root workflow](../../CONTRIBUTING.md). Toolchain: Rust stable with Cargo (checked with 1.97.1), Node 22 for the palette check, Python 3 for the PTY check. Run the root `npm install` once so the palette check can import the design-system package. No live Herdr server or installed plugin is needed.

## Validation sequence

| Order | Directory | Command or check | Effects and coverage |
| --- | --- | --- | --- |
| 1 | `herdr-plugins/whiteboard/` | `cargo test --locked` | Wrapping, wide characters, sizes, hit tests, board paths, load errors, atomic save, synthetic mouse and key input, save conflicts and failures, rendering and clipping through `TestBackend`. Writes only to the temporary directory |
| 2 | `herdr-plugins/whiteboard/` | `cargo clippy --all-targets --locked` | No warnings |
| 3 | `herdr-plugins/whiteboard/` | `node --test` | `palette.rs` matches the exported design-system `foundation/palette` and selected `foundation/signal-colors`; no color is written elsewhere |
| 4 | `herdr-plugins/whiteboard/` | `cargo build --release --locked && python3 test/pty_smoke.py` | The built binary through `bin/whiteboard.sh pane` in a pseudo-terminal, with Herdr variables pointing at a temporary directory: mouse capture and bracketed paste on and off, empty state, toolbar click, typing, bracketed and line-feed pastes, drag, double-click, keyboard move, OSC 52 plus a temporary-file clipboard override (never the real clipboard), the per-workspace board file, and reopening it |
| 5 | Root | [Repository-wide checks](../../CONTRIBUTING.md#repository-wide-checks) | Links, guide map, entry points, whitespace, publication review |
| 6 | Isolated Herdr | [Isolated Herdr check](#isolated-herdr-check) | Manifest, the three actions, split, tab and modal panes, mouse and focus through a Herdr client, resize, storage, reopen |
| 7 | Live Herdr | Interactive use in the operator's own session | Requires the operator to link or install the plugin; not a development check |

### Isolated Herdr check

Use a throwaway Herdr that shares nothing with a live session, as in the [Spaces procedure](../spaces/CONTRIBUTING.md#throwaway-server-check): run every `herdr` command under `env -i` with a temporary `HOME`, `XDG_CONFIG_HOME`, `XDG_STATE_HOME` and an explicit `HERDR_SOCKET_PATH` in a short directory. Record checksums of the live `config.toml` and `plugins.json` first.

Clipboard checks must never touch the operator's clipboard. Use a temporary-file writer as `WHITEBOARD_CLIPBOARD_CMD`; explicitly inject it into a temporary copy of the manifest's pane command (for example `[/usr/bin/env, WHITEBOARD_CLIPBOARD_CMD=<temp-writer>, sh, bin/whiteboard.sh, pane]`, with each value quoted in TOML). This guarantees the override even if Herdr filters inherited environment variables. Copy the launcher and point its release binary at the worktree build, then link only that temporary plugin. Do not change the source manifest or live installation.

1. Start `herdr server`, `herdr plugin link` this directory, then `herdr workspace create`.
2. `herdr plugin action invoke industrial-os.whiteboard.open`; `herdr pane layout` shows a `Whiteboard` pane split to the right in the current tab, and `herdr pane read` shows the empty board. `open-tab` adds a new tab instead. `open-modal` leaves `herdr pane layout` unchanged and the attached client draws the board in a popup; `q` there saves `<workspace-id>.json`, not `default.json`.
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

### Markdown display and mouse edit cursor

2026-10-15, macOS, rustc 1.97.1, Node 22.23.0, Python 3.14.5. Automated checks only; no Herdr server was contacted.

**Passed**

- `cargo test --locked`: **61 passed**, 0 failed. Twelve added tests cover the Markdown subset, nested styles, escapes, unmatched markers, snake_case, literal code, wide characters and width budgets; styled note wrapping; rendered/raw text geometry and unchanged JSON; mouse cursor placement across raw, wrapped and wide rows, past row ends and below the final row; no move drag; unchanged border/handle behavior; end-of-source double-click entry; and glyphs, modifiers and raw editing through `TestBackend`. The existing 100,000-character regression now also measures rendered display rows under its 200 ms debug bound; a separate long unmatched-input parser test passes.
- `cargo clippy --all-targets --locked`: no warnings.
- `node --test`: **2/2 passed**. The documented root `npm install` linked the design-system package; root manifests are unchanged.
- `cargo build --release --locked && python3 test/pty_smoke.py`: `PTY SMOKE OK`. This is the existing launcher/input/persistence regression, not a Herdr check of Markdown or cursor placement.
- Repository-wide checks: all local links and anchors in changed Markdown documents, the guidance inventory/map and exact `CLAUDE.md` entrypoints passed; `git diff --check` and `git diff --cached --check` passed. Contributor reading and publication review found no private material, dependency/palette changes or generated files in the diff; nothing staged.
- Simplification pass against `origin/main`: reused word-wrap ranges and one raw cell-to-byte mapping; removed redundant delimiter metadata. Reran steps 1–4 successfully afterward.

**Failed, then fixed:** the first unit run exposed an existing test expectation that omitted the new transient edit flag; updated it. A new mouse test initially clicked outside the raw text rectangle rather than past a short row inside it; corrected its coordinate. Clippy initially reported a collapsible `if`; collapsed it. The first palette run lacked the root package link; the documented setup above fixed it without manifest changes. Independent review then found `foo___bar___baz` rendering `bar` as bold italic and `____` rendering as an empty line, both confirmed with a throwaway parser test; intraword underscore runs and empty pairs (including empty code) now stay literal, pinned in the literals test, and steps 1–4 passed again with the same counts.

**Not run:** isolated or live Herdr, plugin installation/linking, manual terminal/font/Option-as-Meta checks, Linux. Earlier Herdr records do not verify these new interactions. No commit, push or PR was made.

### Pasting line breaks

2026-10-15, macOS, rustc 1.97.1, Node 22.23.0, Python 3.14.5, Herdr 0.9.3. Pasting multi-line text into a note lost its line breaks: a raw line feed arrives as `Ctrl+J`, which editing ignored, and a bracketed paste was dropped entirely. The board now enables bracketed paste, inserts pasted text at the cursor with `\r\n` and `\r` as newlines, tabs as two spaces and other control characters removed, and treats `Ctrl+J` as a newline. A paste outside editing changes nothing.

**Passed**

- Before the fix, the release binary in a pseudo-terminal saved `a\nb\n\nc` typed with line feeds as `abc` and as `""` when bracketed; with carriage returns it kept the breaks. After the fix all three saved `a\nb\n\nc`.
- `cargo test --locked`: **62 passed**, 0 failed. New: paste at a mid-text cursor normalizes line endings, tabs and control characters, grows the note, and `Ctrl+J` inserts a newline; a paste outside editing changes nothing.
- `cargo clippy --all-targets --locked`: no warnings; `node --test`: **2/2 passed** after the documented root `npm install`.
- `cargo build --release --locked && python3 test/pty_smoke.py`: `PTY SMOKE OK`, now also checking bracketed paste is enabled and disabled on exit and that a bracketed paste and a raw line feed keep their breaks.
- Isolated Herdr 0.9.3 with an attached 160×40 client: the board's bracketed-paste request reached the client's terminal, and a bracketed paste of a heading, blank line, numbered item and two bullets saved with every line break. Live `config.toml` and `plugins.json` checksums were unchanged.

**Failed, then fixed:** the first new unit test checked note growth on a text item, which has no stored height; it now uses a note. The first PTY paste put `Ctrl+E` inside the bracketed paste, where it is pasted content, not a key; it now precedes the paste.

**Not run:** the operator's live session and terminal, Linux. The spaces in the operator's report were not reproduced; the line-feed and bracketed-paste losses were.

### Selection, formatting, scrolling and eight swatches

2026-10-15, macOS, rustc 1.97.1, Node 22.23.0, Python 3.14.5, Herdr 0.9.3.

**Passed — automated**

- `cargo test --locked`: **76 passed**, 0 failed. Fourteen added regressions cover mouse and Shift selection on wrapped/wide source, selection replacement, UTF-8 base64/OSC 52 and cut-buffer yank, every format action and inside/outside toggles, multi-line prefixes, Ctrl+T dispatch/cancel, bar placement/hits, wheel/page/track/thumb scrolling, cursor-follow/click mapping and drawing with offsets, transient JSON, scrollbar/connector/resize precedence, eight color keys, contrasting note inks and unchanged free-text swatch inks. Existing narrow-toolbar and 100,000-character linear tests pass.
- `cargo clippy --all-targets --locked`: no warnings; `node --test`: **2/2 passed**, comparing roles plus violet/cobalt/pink through the exported signal-colors subpath. Root `npm install` supplied the package link; root manifests are unchanged.
- `cargo build --release --locked && python3 test/pty_smoke.py`: `PTY SMOKE OK`. The extended standalone PTY test drags over `hello`, sees the exact OSC 52 payload and floating bar, clicks B, and verifies `**hello** note` in saved JSON; existing paste, connector, movement and reopening checks still pass. This proves emission by the pane, not system clipboard receipt.
- Offline repository checks: changed local Markdown links/anchors, guide inventory/map, exact `CLAUDE.md` entrypoints, `git diff --check` and `git diff --cached --check`. Publication review found only whiteboard source/tests/docs, no generated files or private content; nothing staged.

**Passed — isolated Herdr client**

- Every Herdr command ran with `env -i`, temporary HOME/XDG directories and an explicit temporary socket. Linked only into this throwaway server. Through an attached 220×45 client, dragged a raw selection, saw `COPY`/`SELECT`, clicked B on the floating bar, pasted eight lines, finished editing and shrank the note. Wheel over the overflowing note changed the first visible content from `hello copy` to `line2`, without moving the note. Saving retained `**hello** copy` plus every line, the same position and a height of 3, with no scroll field in JSON.
- Stopped the isolated server and deleted its temporary state; live `config.toml` and `plugins.json` checksums were unchanged.

**Failed / limits**

- OSC 52 forwarding: **not forwarded** by Herdr 0.9.3 in the attached-client output, despite the standalone PTY's verified emission. The internal cut buffer works; the system clipboard depends on the host/terminal. At this checkpoint no workaround, host change or clipboard subprocess had been added; the approved local-helper follow-up is recorded below.
- Fixed during development: a toolbar test still expected QUIT at 60 columns after adding three swatches; updated for the existing dropping rule. A test inspected a wide glyph's continuation cell, which ratatui's test backend resets; it now checks the styled glyph's leading cell. Clippy's test-loop warning was fixed. Palette setup initially lacked the root package link; the documented install fixed it. The first isolated harness used an unsupported `--pane` read flag and then expected a track glyph with a one-cell track (entirely thumb); corrected the harness. An initial client cleanup waited on SIGTERM and timed out; subsequent harnesses killed only their own client and the server was explicitly stopped.

**Simplification pass**

Reviewed the full diff against `origin/main`: reused the raw cursor/range mapping and existing button hit list, stored only one selection anchor and one skipped scroll field, kept clipboard I/O in main, and added no dependencies, caches or persistent format state. Follow-up tightened selection clearing on non-bar clicks, retained selection for ignored keys, cancelled pending Ctrl+T on bar clicks, kept same-text replacement cursor placement correct and gave selected newlines a visible cell. Review also pinned full-link toggle recognition so selecting multiple links never discards trailing source. Kept formatting helpers private, formatted only new blocks, and used the note ink for both scrollbar glyphs so the track remains readable on violet/cobalt. Reran automated and offline checks afterward; the isolated host check predates these small input/UI/toggle follow-ups.

**Not run:** the operator's live session, installation, Linux, physical terminal/font/Option-as-Meta checks or system clipboard acknowledgement. No commit, push or PR was made. Root `AGENTS.md` already states the generic palette-file rule, not an Acid-only restriction, so it did not need editing.


### Local clipboard helper follow-up

2026-10-15, same macOS/Rust/Node/Python toolchain and Herdr 0.9.3 as above. Approved because Herdr does not forward OSC 52. Copy now keeps raw UTF-8 in App's outbox; main sends OSC 52 and starts a best-effort local helper on a detached worker. The helper/override and status contract is in [README](README.md#clipboard).

**Passed — automated**

- `cargo test --locked`: **81 passed**, 0 failed. The App copy tests now verify raw UTF-8 requests rather than encoded sequences; main tests cover base64, platform helper order/arguments, an executable-only override, missing-command fallback, the then-current nonzero-exit policy (superseded by the review fixes below), a missing override with no fallback, exact UTF-8 through stdin with EOF, and a payload larger than a pipe whose reader waits for a release file. All process tests use injected fake commands, never real clipboard helpers.
- `cargo clippy --all-targets --locked`: no warnings; `node --test`: **2/2 passed**.
- `cargo build --release --locked && python3 test/pty_smoke.py`: `PTY SMOKE OK`. The smoke sets an executable temporary-file writer override, checks the selected `hello` bytes in that file and the exact OSC 52 request, and sees `COPIED`. Existing formatting, paste, connector and persistence checks pass. No test accesses the real clipboard.
- Offline repository checks and simplification rerun: changed local Markdown links/anchors, full root guide-map inventory, exact CLAUDE entrypoints, both whitespace checks and unchanged root manifests. Only whiteboard files changed; nothing staged.

**Passed — isolated Herdr client**

- Every command used `env -i`, temporary HOME/XDG directories and an explicit temporary socket. Linked a temporary plugin copy whose pane command explicitly injects the fake clipboard executable and whose binary points to the worktree release build. Through an attached 220×45 client, drag-selection wrote exactly `hello` to its temporary file; Shift+Home then Ctrl+T/c wrote `hello 日本` intact. The selection/bar and `COPIED` plate remained visible.
- Killed only the throwaway client, stopped the isolated server, deleted temporary state, and confirmed the live `config.toml` and `plugins.json` SHA-256 checksums were unchanged.

**Failed, then fixed:** the fresh Herdr client's input initially did not reach the board after dismissing onboarding, matching the prior focus discrepancy; reattaching the isolated client resolved it. The harness always cleaned up its server/state and used the explicit fake override, including failed attempts. No implementation validation failures occurred.

**Simplification pass:** kept the existing raw-text outbox type, moved base64 to its I/O owner, used `std::process::Command` directly for helper selection, and ran spawn/write/close/wait in one worker. No asynchronous acknowledgement channel, new status enum, shell parsing, dependency or clipboard abstraction. `COPIED` is set only after OSC output succeeds and never hides a save error. Reran the full automated and offline checks afterward.

**Not run:** actual `pbcopy`, `wl-copy` or `xclip`, the operator's clipboard/live Herdr, Linux or physical-terminal checks. OSC 52 forwarding remains the previously recorded Herdr limit; the new isolated check proves subprocess delivery to the fake sink, not an OS clipboard acknowledgement. This checkpoint had no helper deadline; the review fixes below supersede that limit. No commit, push, PR or live installation.


### Review fixes

2026-10-15, same automated toolchain as the clipboard follow-up. Independent review findings were reproduced before production fixes.

**Passed**

- `cargo test --locked`: **91 passed**, 0 failed. Ten new review regressions cover the stale scrollbar index panic and wrong-note variant, removed-target safety, italic/bold marker parity, checkbox/heading and mixed-prefix toggles, line-local inline formatting with empty/mixed/partially selected end lines, multi-line link rejection/hint, dark-paper borders, clipboard nonzero-exit failover and timeout of a helper that never reads a pipe-sized payload. The timeout test also probes the helper PID after return to check kill/reap. Existing performance, paste, UTF-8, override-isolation and rendering regressions remain green.
- `cargo clippy --all-targets --locked`: no warnings; `node --test`: **2/2 passed**; `cargo build --release --locked && python3 test/pty_smoke.py`: `PTY SMOKE OK`, using only the fake clipboard executable.
- Changed Markdown links/anchors, guide map/entrypoints and both whitespace checks passed. The toolbar mockup now has eight swatches; Storage no longer repeats clipboard behavior. Measured the unchanged free-text contrast from palette constants and recorded the limit only in [design](docs/design.md#layout-and-color), without claiming those inks readable.
- Re-review nits: all five new regressions failed first (real LINK bar release and separate bold/italic/strike/code spans), then passed after shared hint clearing and conservative multi-span no-op handling; nested bold inside italic remains supported. Clipboard quit/order limits are documented in architecture. Final full rerun: **96 Rust tests**, clean Clippy, **2 Node tests**, release/PTY smoke and offline checks passed.

**Failed, then fixed**

- The first nine `review_` tests all failed before production changes: scrollbar panic/wrong target, italic stripping bold, checkbox prefix stripping, markers across newlines, multi-line links, structural borders on dark paper, missing nonzero-exit fallback and a blocked-stdin helper taking about 3.01 s instead of timing out. The additional partial-end-line marker test also failed before its fix; the line-local test then caught a blank-only no-op unnecessarily marking the board dirty, which was fixed before the final rerun. The five-swatch mockup and repeated Storage sentence were confirmed by read-only checks.
- Audited every other Drag variant: none holds an item index. Updated superseded helper tests/docs to the approved timeout-and-fallback policy; explicit overrides still cannot reach real clipboard tools.

**Simplification pass:** reviewed the full diff against `origin/main`; reused byte ranges and one small prefix classifier rather than a Markdown re-parser. Kept timeout policy in main and documented the test-override descendant exception in architecture. Removed the duplicate nonzero-exit test setup, and kept blank-only formatting a no-op. No crate, persistent state or palette values added; free-text ink unchanged. Skipped the requested render re-parse optimization because the performance regression passes. Reran all affected automated/offline checks afterward.

**Not run:** a new isolated/live Herdr check for these review fixes, real clipboard utilities, Linux or physical-terminal checks. Earlier isolated fake-clipboard evidence remains separate. No commit, push, PR, live install or real clipboard write.

### Modal action

2026-10-31, macOS, rustc 1.97.1, Herdr 0.9.5. Added the `open-modal` action and `board-modal` popup entrypoint (90% × 90%). A popup gets no `HERDR_WORKSPACE_ID`, so `board_path` now falls back to `workspace_id` in `HERDR_PLUGIN_CONTEXT_JSON`.

**Passed**

- `cargo test --locked`: **96 passed**, 0 failed, with context-JSON and malformed-context cases added to the board-path test. `cargo clippy --all-targets --locked`: no warnings; `node --test`: **2/2 passed**; release build and `python3 test/pty_smoke.py`: `PTY SMOKE OK`.
- Isolated Herdr 0.9.5 (temporary copy with a pane command that also wrote its environment to a file): `plugin link` accepted `placement = "popup"` with percentage sizes and listed all three actions. With a client attached, `open-modal` exited 0 and the client drew the board while `pane layout` still showed one pane. The popup's environment had `HERDR_PLUGIN_CONTEXT_JSON` with `workspace_id` but no `HERDR_WORKSPACE_ID`. Typing `n`, text, `Esc`, `q` closed the popup and saved `boards/<hash>/w1.json`; `open` then showed the same note in a split. Live `config.toml` and `plugins.json` checksums were unchanged.

**Failed, then fixed:** the first isolated run showed the popup opening the `default` board because `HERDR_WORKSPACE_ID` was missing.

**Not run:** mouse input inside the popup, Herdr 0.9.3 (the manifest minimum; its docs describe popup placement), Linux, live install.
