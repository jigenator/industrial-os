# Architecture

Status: current. Evidence: the full source and tests in this directory, the manifest as accepted by `herdr plugin link` on Herdr 0.9.3, and the [Herdr 0.9.3 plugin documentation](https://raw.githubusercontent.com/herdrdev/herdr/v0.9.3/docs/next/website/src/content/docs/plugins.mdx).

## Modules

| Module | Owns | Depends on |
| --- | --- | --- |
| `herdr-plugin.toml` | The `cargo build` step, the `board` pane (a split by default) and the `open` and `open-tab` actions | Herdr 0.9.3 plugin manifest |
| `bin/whiteboard.sh` | `pane`: run the binary, or print how to build it. `open` and `open-tab`: ask Herdr to open the pane in a split or a tab | POSIX `sh`, `HERDR_BIN_PATH` |
| `src/main.rs` | Board path, load, terminal setup and restore (raw mode, alternate screen, mouse capture), the event loop, failure messages | `board`, `app`, `ui`, ratatui's crossterm |
| `src/app.rs` | `App`: selection, editing, drags, double-click timing, buttons, saving and quitting | `board`, crossterm event types |
| `src/board.rs` | `Item` and `Board`, word wrap, hit tests, JSON load and atomic save, `board_path` | serde, `unicode-width` |
| `src/ui.rs` | Drawing the toolbar, board and status line into a ratatui frame; records the canvas and button regions it drew | `app`, `board`, `palette`, ratatui |
| `src/palette.rs` | The nine Acid / Black colors, mirrored from the design system | ratatui `Color` |

Dependencies point down the table; nothing imports `main.rs`, and `ui.rs` never calls I/O. Crates: `ratatui` 0.30 (with its default crossterm backend), `serde`, `serde_json`, `unicode-width`; versions are locked in `Cargo.lock`. No code from another project is imported. The design system reaches this project only as values that `test/palette.test.mjs` compares.

## Flows

**Opening.** The `open` action runs `herdr plugin pane open --plugin industrial-os.whiteboard --entrypoint board --placement split --direction right --focus`; `open-tab` passes `--placement tab` instead. The manifest's own placement is `split`, for a direct `pane open` without one. Herdr starts `sh bin/whiteboard.sh pane` in the new pane, from the plugin directory, with `HERDR_PLUGIN_STATE_DIR`, `HERDR_SOCKET_PATH` and `HERDR_WORKSPACE_ID` set. The script `exec`s `target/release/whiteboard`.

**Board path.** `board_path` takes the first of: a path argument; `$HERDR_PLUGIN_STATE_DIR/boards/<fnv1a64(HERDR_SOCKET_PATH)>/<workspace-id>.json`, with every character outside `[A-Za-z0-9_-]` replaced by `_` and `default` for a missing value; or `./whiteboard.json`. The socket hash partitions boards by Herdr session, because Herdr shares one plugin state directory across sessions.

**Loading.** A missing file is an empty board. A file that cannot be read or parsed stops the program before it takes over the terminal; it is never overwritten.

**Input.** Each crossterm event goes to `App::handle`. Mouse coordinates are screen cells; `App` converts them to board cells with the camera and the canvas rectangle that the last render recorded, so hit tests match what is on screen. Left press on a button runs it; on an item it selects and raises it and starts a move, or a resize on the `◢` cell; on empty space it starts a pan. A second press on the same cell within 400 ms is a double-click. Other buttons always pan.

**Saving.** `Board::save` creates the directory, writes `<name>.json.tmp` and renames it over the board. `App` remembers the file's modification time from its last load or save. If the file changed since then, the first save is refused with an error, and a second save overwrites. Quitting saves first and stays open if that fails.

**Exit.** Mouse capture is disabled and the terminal restored on a normal exit, on an error, and from the panic hook. Herdr closes the board's pane when the process exits; a tab placement closes with it.

## Invariants

| Must remain true | Where | Check |
| --- | --- | --- |
| Colors are the design-system values, written only in `palette.rs` | `src/palette.rs` | `node --test` |
| A failed load never becomes an empty board that is later saved | `main.rs`, `Board::load` | `corrupt_board_is_an_error_not_an_empty_board` |
| A failed or refused save is never shown as saved, and quitting does not discard it | `App::save`, `App::request_quit` | `failed_save_keeps_the_pane_open`, `save_refuses_once_when_another_pane_saved_first` |
| Every mouse action has a keyboard path | `App::key` | `keyboard_selects_moves_and_resizes_without_a_mouse`, `keys_add_recolor_and_delete` |
| Drawing never writes outside the frame, at any size | `ui::put`, `ui::intersect` | `tiny_terminals_render_without_panicking`, clipping tests |
| The terminal is restored on every exit path | `main.rs` | `test/pty_smoke.py` checks mouse capture is disabled |

## Evolution and limits

Text is edited only at its end, and there is no undo. One file per workspace is the unit of storage; there is no lock, only the modification-time check. Workspace IDs can be reused by Herdr, so a new workspace can inherit a closed workspace's board. Revisit the storage key if Herdr gains a stable workspace identity that is never reused.
