# Industrial OS Whiteboard

A Herdr 0.9.3+ plugin: a mouse-driven whiteboard with sticky notes and free text, drawn in Acid / Black with [ratatui](https://ratatui.rs). It opens in a split beside the pane you are in, or in its own tab, and each workspace has its own board.

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

The board is a normal Herdr pane once open: resize, move, zoom or swap it like any other, and it redraws at its new size. To bind keys, add this to Herdr's `config.toml`:

```toml
[[keys.command]]
key = "prefix+w"
type = "plugin_action"
command = "industrial-os.whiteboard.open"
description = "whiteboard beside this pane"

[[keys.command]]
key = "prefix+W"
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
| Select | click an item (brings it to the front) | `Tab` / `Shift+Tab` |
| Move | drag the item | arrows |
| Resize a note | drag its `◢` corner | `Shift`+arrows |
| Edit | double-click the item | `Enter` or `e`; `Esc` finishes |
| Color | click a swatch | `1`–`5` |
| Delete | `DELETE` | `Del` / `Backspace` |
| Pan | drag empty space, right- or middle-drag, scroll | arrows with nothing selected |
| Save | `SAVE` | `Ctrl+S` |
| Quit, saving first | `QUIT` | `q` or `Ctrl+C`; `Ctrl+Q` quits without saving |

Quitting closes the board's pane and leaves the others. If a save fails, the board stays open and says why.

## Storage

Inside Herdr, a board is `$HERDR_PLUGIN_STATE_DIR/boards/<session>/<workspace-id>.json`. `<session>` is a hash of the Herdr socket path, because plugin state is shared by every named Herdr session. The files are plain JSON on your machine; nothing is sent anywhere. Uninstalling the plugin does not delete them.

## Limits

- Needs a terminal with 24-bit color and SGR mouse reporting.
- Positions snap to whole cells. Text is edited only at its end: no cursor movement, undo, clipboard or drawing.
- Two panes on the same workspace share one file. A save that would overwrite another pane's newer save is refused once; saving again overwrites it.
- A board follows its Herdr workspace ID, such as `w2`. IDs survive session restore, but Herdr can give a closed workspace's ID to a new one, which then opens the old board.
- Wide characters are measured with `unicode-width`, which can disagree with some terminals.

## Guides

[AGENTS](AGENTS.md), [contributing](CONTRIBUTING.md), [architecture](docs/architecture.md), [conventions](docs/conventions.md), [design](docs/design.md), [mission](docs/mission.md).
