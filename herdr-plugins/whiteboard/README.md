# Industrial OS Whiteboard

A Herdr 0.9.3+ plugin: a mouse-driven whiteboard with sticky notes, free text and connecting arrows, drawn in Acid / Black with [ratatui](https://ratatui.rs). It opens in a split beside the pane you are in, or in its own tab, and each workspace has its own board.

Rust and Cargo build it; it has no Node runtime. Linux and macOS only. Why a Herdr plugin here may use another runtime is recorded in [the decision](../../docs/decisions/herdr-plugin-runtimes.md).

## Install

Follow the [plugin install guide](../README.md#install) with this directory. `herdr plugin install` runs the manifest's `cargo build --release --locked`, so it needs a Rust toolchain on the PATH. `herdr plugin link` builds nothing: build first.

```sh
cd herdr-plugins/whiteboard && cargo build --release --locked
herdr plugin link .
```

If the binary is missing, the pane says how to build it and waits for Enter.

## Open a board

| Action | Opens the board |
| --- | --- |
| `industrial-os.whiteboard.open` | In a split to the right of the focused pane |
| `industrial-os.whiteboard.open-tab` | In a new tab |

```sh
herdr plugin action invoke industrial-os.whiteboard.open
herdr plugin action invoke industrial-os.whiteboard.open-tab
```

Opening the pane directly uses the manifest's default, a split of the focused pane; `--placement` and `--direction` override it:

```sh
herdr plugin pane open --plugin industrial-os.whiteboard --entrypoint board --placement split --direction down
```

The board is a normal Herdr pane once open: resize, move, zoom or swap it like any other, and it redraws at its new size. To bind keys, add this to Herdr's `config.toml`. Both keys are free in Herdr 0.9.3's defaults, where `prefix+w` is the workspace picker; check your own bindings first.

```toml
[[keys.command]]
key = "prefix+i"
type = "plugin_action"
command = "industrial-os.whiteboard.open"
description = "whiteboard beside this pane"

[[keys.command]]
key = "prefix+shift+i"
type = "plugin_action"
command = "industrial-os.whiteboard.open-tab"
description = "whiteboard in a new tab"
```

Outside Herdr, run `target/release/whiteboard [board.json]`; it defaults to `./whiteboard.json`.

## Use

| Action | Mouse | Keyboard |
| --- | --- | --- |
| New sticky note | `+ NOTE` | `n` (at the mouse, else the middle of the view) |
| New free text | double-click empty space, or `+ TEXT` | `t` |
| Select an item or arrow | click an item (brings it to the front), or an uncovered arrow cell | `Tab` / `Shift+Tab`: items in drawing order, then arrows |
| Move | drag the item's interior | arrows |
| Connect with an arrow | drag a note's border onto another item; elsewhere cancels | select an item, `a`, `Tab` / `Shift+Tab` choose target, `Enter` connect/remove, `Esc` cancel |
| Remove an arrow | select it, then `DELETE` | select it, then `Del` / `Backspace`; `Esc` deselects |
| Resize a note | drag its `◢` corner | `Shift`+arrows |
| Edit | double-click the item | `Enter` or `e`; `Esc` finishes |
| Color | click a swatch | `1`–`5` |
| Delete | `DELETE` | `Del` / `Backspace` |
| Pan | drag empty space, right- or middle-drag, scroll | arrows with nothing selected |
| Save | `SAVE` | `Ctrl+S` |
| Quit, saving first | `QUIT` | `q` or `Ctrl+C`; `Ctrl+Q` quits without saving |

While editing, the cursor starts at the end; insertions happen at the cursor.

| Editing action | Keys |
| --- | --- |
| Logical-line start / end | `Ctrl+A` / `Ctrl+E`, or `Home` / `End` |
| Character back / forward | `Ctrl+B` / `Ctrl+F`, or `←` / `→` |
| Word back / forward (alphanumeric) | `Alt+B` / `Alt+F`, or `Alt+←` / `Alt+→` |
| Drawn row up / down (wrapped in notes) | `↑` / `↓`, keeping the column where possible |
| Cut to logical-line end / start | `Ctrl+K` / `Ctrl+U`; `Ctrl+K` at line end cuts the newline |
| Cut previous word | `Ctrl+W` (whitespace-delimited), `Alt+Backspace` (alphanumeric) |
| Cut next word / insert last cut | `Alt+D` / `Ctrl+Y` |
| Delete character after / before | `Ctrl+D` or `Delete` / `Ctrl+H` or `Backspace` |
| Insert newline / two spaces | `Enter` / `Tab` |

`Ctrl+C`, `Ctrl+S` and `Ctrl+Q` keep their global meanings in every mode.

Quitting closes the board's pane and leaves the others. If a save fails, the board stays open and says why.

## Storage

Inside Herdr, a board is `$HERDR_PLUGIN_STATE_DIR/boards/<session>/<workspace-id>.json`. `<session>` is a hash of the Herdr socket path, because plugin state is shared by every named Herdr session. The files are plain JSON on your machine; nothing is sent anywhere. Uninstalling the plugin does not delete them.

## Limits

- Needs a terminal with 24-bit color and SGR mouse reporting.
- Positions snap to whole cells. No undo, system clipboard (`Ctrl+Y` uses only the session's internal cut buffer), mouse cursor placement or freehand drawing.
- Host keybindings take precedence. Inside Herdr, use `←` instead of `Ctrl+B` unless its default `Ctrl+B` prefix is changed.
- Alt shortcuts need the terminal to send Option/Alt as Meta; macOS terminals often need this setting enabled.
- Arrows follow their items but are hidden while the items overlap.
- Two panes on the same workspace share one file. A save that would overwrite another pane's newer save is refused once; saving again overwrites it.
- A board follows its Herdr workspace ID, such as `w2`. IDs survive session restore, but Herdr can give a closed workspace's ID to a new one, which then opens the old board.
- Wide characters are measured with `unicode-width`, which can disagree with some terminals.

## Guides

[AGENTS](AGENTS.md), [contributing](CONTRIBUTING.md), [architecture](docs/architecture.md), [conventions](docs/conventions.md), [design](docs/design.md), [mission](docs/mission.md).
