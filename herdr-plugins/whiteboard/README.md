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
| Move | drag the item's interior when not editing | arrows |
| Connect with an arrow | drag a note's border onto another item; elsewhere cancels | select an item, `a`, `Tab` / `Shift+Tab` choose target, `Enter` connect/remove, `Esc` cancel |
| Remove an arrow | select it, then `DELETE` | select it, then `Del` / `Backspace`; `Esc` deselects |
| Resize a note | drag its `◢` corner | `Shift`+arrows |
| Edit | double-click the item | `Enter` or `e`; `Esc` finishes |
| Place edit cursor | left-click inside the item being edited | arrows or the editing keys below |
| Select raw text (editing only) | press and drag inside the edited item | `Shift`+arrows / `Shift+Home` / `Shift+End` |
| Copy selection | release a selection drag, or floating `COPY` | `Ctrl+T`, then `c` |
| Format selection | floating formatting bar | `Ctrl+T`, then an action key below |
| Scroll overflowing note text | wheel over it, click its scrollbar track or drag its thumb | select note outside editing, `PageUp` / `PageDown` |
| Color | click a swatch | `1`–`8`; [swatches and inks](docs/design.md#layout-and-color) |
| Delete | `DELETE` | `Del` / `Backspace` |
| Pan | drag empty space, right- or middle-drag, scroll | arrows with nothing selected |
| Save | `SAVE` | `Ctrl+S` |
| Quit, saving first | `QUIT` | `q` or `Ctrl+C`; `Ctrl+Q` quits without saving |

Editing starts at the end and shows raw Markdown source; insertions happen at the cursor. Clicking inside the edited item places the cursor without moving the item; dragging selects raw source, and clicking outside finishes editing (except the formatting bar). Note borders and resize handles keep their usual actions. See [cursor placement details](docs/design.md#interaction).

| Editing action | Keys |
| --- | --- |
| Extend raw-source selection | `Shift+←/→/↑/↓/Home/End`; unshifted motion or a plain click clears it |
| Copy / bold / italic / strike / code | `Ctrl+T`, then `c` / `b` / `i` / `s` / backtick |
| Link / heading / bullet / checkbox | `Ctrl+T`, then `l` / `h` / `-` / `x`; `Esc` cancels the pending command |
| Logical-line start / end | `Ctrl+A` / `Ctrl+E`, or `Home` / `End` |
| Character back / forward | `Ctrl+B` / `Ctrl+F`, or `←` / `→` |
| Word back / forward (alphanumeric) | `Alt+B` / `Alt+F`, or `Alt+←` / `Alt+→` |
| Drawn row up / down (wrapped in notes) | `↑` / `↓`, keeping the column where possible |
| Cut to logical-line end / start | `Ctrl+K` / `Ctrl+U`; `Ctrl+K` at line end cuts the newline |
| Cut previous word | `Ctrl+W` (whitespace-delimited), `Alt+Backspace` (alphanumeric) |
| Cut next word / insert last cut | `Alt+D` / `Ctrl+Y` |
| Delete character after / before | `Ctrl+D` or `Delete` / `Ctrl+H` or `Backspace` |
| Insert newline / two spaces | `Enter` or `Ctrl+J` / `Tab` |
| Paste at the cursor, keeping line breaks | the terminal's paste |

Typing, Enter, paste and character deletion replace/delete selected source. Formatting toggles the source markers and keeps the result selected; a new link selects its `url` placeholder. See [formatting details](docs/design.md#selection-and-formatting). `Ctrl+C`, `Ctrl+S` and `Ctrl+Q` keep their global meanings in every mode.

Quitting closes the board's pane and leaves the others. If a save fails, the board stays open and says why.

## Markdown

Notes and free text render this line-local subset when not being edited:

- Headings: `# ` through `###### `.
- Bullets: `- `, `* `, `+ ` → `• `; ordered lists: `1. ` or `1) ` keep the number. Leading indentation on list items is preserved.
- Tasks: `- [ ] ` → `☐ `; `- [x] ` or `- [X] ` → `☑ `. Display only, not clickable.
- Quotes: `> ` → `│ `.
- Inline: `**bold**` / `__bold__`, `*italic*` / `_italic_`, single-backtick code, `~~strike~~`, and `[text](url)` (underlined text, hidden URL).

Inline styles can nest, including bold in links and italic in bold. Code keeps its contents literal. Backslash escapes punctuation; unmatched markers and underscores inside words such as `snake_case` stay literal. This is not full CommonMark: no multiline constructs, fenced code, images or nested link destinations. Links are display only. [Display and wrapping](docs/design.md#markdown-display) do not change the stored source.

## Clipboard

Copy always sets the session cut buffer (`Ctrl+Y`), sends an OSC 52 request to the terminal, and tries a local clipboard helper. On macOS the helper order is `pbcopy`, then `wl-copy`, then `xclip -selection clipboard`; on Linux it is `wl-copy`, then `xclip -selection clipboard`. Missing, failed and timed-out commands are skipped; the first helper that accepts stdin and exits successfully wins. Text is written as UTF-8 to stdin and stdin is closed. Helpers run off the input/render thread with stdout/stderr suppressed; missing helpers, failed writes or nonzero exits do not interrupt editing.

`COPIED` confirms the internal buffer and a sent OSC 52 request, **not** system clipboard acknowledgement or helper success. The system clipboard needs a working local helper or OSC 52 forwarding/permission. Herdr 0.9.3 did not forward OSC 52 in the isolated check, so the local helper is needed there. Each helper has about two seconds, including stdin delivery; on timeout it is killed and reaped before trying the next. Clipboard work cannot stall input or drawing.

For test isolation, `WHITEBOARD_CLIPBOARD_CMD` replaces the entire helper list with one executable path. It is invoked directly, with no arguments or shell parsing, and receives text on stdin. A missing or failing override never falls back to real clipboard helpers. All clipboard tests use a temporary-file writer, never the operator's clipboard.

## Storage

Inside Herdr, a board is `$HERDR_PLUGIN_STATE_DIR/boards/<session>/<workspace-id>.json`. `<session>` is a hash of the Herdr socket path, because plugin state is shared by every named Herdr session. The files are plain JSON on your machine; there is no network service. Uninstalling the plugin does not delete them.

## Limits

- Needs a terminal with 24-bit color and SGR mouse reporting.
- Positions snap to whole cells. No undo or freehand drawing.
- Text selection exists only while editing raw source. The [system clipboard](#clipboard) needs an available local helper or host/terminal OSC 52 support; `COPIED` is not a clipboard acknowledgement.
- Host keybindings take precedence. Inside Herdr, use `←` instead of `Ctrl+B` unless its default `Ctrl+B` prefix is changed.
- Alt shortcuts need the terminal to send Option/Alt as Meta; macOS terminals often need this setting enabled.
- Arrows follow their items but are hidden while the items overlap.
- Two panes on the same workspace share one file. A save that would overwrite another pane's newer save is refused once; saving again overwrites it.
- A board follows its Herdr workspace ID, such as `w2`. IDs survive session restore, but Herdr can give a closed workspace's ID to a new one, which then opens the old board.
- Wide characters are measured with `unicode-width`, which can disagree with some terminals.

## Guides

[AGENTS](AGENTS.md), [contributing](CONTRIBUTING.md), [architecture](docs/architecture.md), [conventions](docs/conventions.md), [design](docs/design.md), [mission](docs/mission.md).
