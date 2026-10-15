# Design

The [shared visual language](../../../docs/design.md) applied to a whiteboard pane. Colors are Acid / Black roles and selected design-system signal colors mirrored in `src/palette.rs`.

```text
 WHITEBOARD    + NOTE   + TEXT   [■] ■  ■  ■  ■  ■  ■  ■    DELETE    SAVE    QUIT
·     ·     ·     ·     ·     ·     ·     ·     ·     ·     ·     ·
  ╭──────────────────────╮      ┏━━━━━━━━━━━━━━━━━━━━━━┓
  │ship the plugin       │      ┃review the palette    ┃
  │                      │─────▶┃                      ┃
  ╰──────────────────────╯      ┗━━━━━━━━━━━━━━━━━━━━━━◢
·     ·     ·  free text here  ·     ·     ·     ·     ·
 MOVE  drag or arrows to move · drag ◢ or Shift+arrows to resize · …  UNSAVED
```

## Layout and color

| Part | Look | Role |
| --- | --- | --- |
| Toolbar | `WHITEBOARD` plate, then buttons. When not everything fits, the plate goes first, then the buttons that do not fit; nothing overlaps | Plate: field on accent. Bar: secondary on surface. Buttons: primary on structural |
| Board | Black field with a dot every 6 columns and 3 rows, anchored to the board so panning shows | Field; dots structural |
| Note | Rounded border, word-wrapped text, a one-cell shadow | Paper is the note's color; ink follows the swatch table below; unselected border secondary on purple/blue, structural otherwise; shadow surface |
| Arrow | Elbow lines, shared junctions and arrowheads beneath items; [routing and clearance](architecture.md#flows) | Secondary on field; selection is heavy and drawn over other arrows |
| Selected note | Heavy border and a `◢` resize handle | Shape, not color, marks selection |
| Free text | Regular-weight text in the item's color; Markdown adds emphasis | Selected: surface background |
| Status line | Mode plate, hints, and a worded state plate on the right | See states |

Swatches are labels a person chooses, not states: a critical-colored note means nothing to the app. The selected swatch is bracketed, `[■]`. Values are mirrored only in `palette.rs`, checked against the design-system package's `foundation/palette` and `foundation/signal-colors` exports.

| Key | Paper / free-text ink | Note ink |
| --- | --- | --- |
| 1–5 | Accent, warning, critical, primary, secondary (Acid / Black roles, in that order) | Field |
| 6 | Purple (`SIGNAL_COLORS.violet`) | Primary |
| 7 | Blue (`SIGNAL_COLORS.cobalt`) | Primary |
| 8 | Hot pink (`SIGNAL_COLORS.pink`) | Field |

Free text retains the chosen swatch as ink, including purple and blue. Known contrast limit: violet on field is about **2.8:1**, cobalt about **3.3:1** (about 2.3:1 and 2.7:1 on the selected surface). These free-text pairs are not claimed readable or contrast-certified.

An overflowing note has a `░` track and `█` thumb on its right border, using the contrasting note ink on its paper. The corner `◢` remains the resize handle. A fitting note has no scrollbar. Free text never scrolls.

## Markdown display

Both notes and free text render the [supported Markdown subset](../README.md#markdown) unless being edited, when they show the raw source and the existing insertion cursor. Parsing is per logical line; the source is never rewritten. Rendered lines never exceed their raw line's cell width. Notes wrap the rendered spans at word boundaries, hard-breaking long words by cell width, within their stored width and height. Free text splits only at newlines; its hit rectangle, selection background and connector routing use rendered dimensions, switching to raw dimensions during editing. Existing note growth to fit the raw insertion row is unchanged.

Bold uses the terminal's bold modifier; italic uses italic; strike uses crossed-out; links use underline; headings use bold plus underline; code uses reverse video. The quote marker is dimmed. Note styles retain their swatch ink on the paper color and free text retains item-color ink on the field (surface when selected), with code reversing those colors. Checkboxes and links are display only.

## States

| State | Shown as |
| --- | --- |
| Empty | `empty board · double-click to write · n for a sticky note`, centred, secondary |
| Ready | `BOARD` plate and the board's hints |
| Selected | `MOVE` plate, heavy border; hints include moving, resizing and connecting |
| Editing | Accent `EDIT` plate and the terminal cursor at the insertion point, including wrapped rows and wide characters |
| Text selection | Accent background with field ink on raw source; a floating formatting bar and `SELECT` hints |
| Format pending | `FORMAT` plate with the Ctrl+T action-letter hint; Esc cancels only the pending command |
| Hint | A worded secondary plate until the next key, paste, mouse press or vertical wheel input; release and motion retain it, without changing source or selection |
| Copied | `COPIED` plate until the next key, paste, press or vertical wheel input; means the internal buffer was set and an OSC 52 request sent, not system clipboard acknowledgement or subprocess success |
| Connecting | `ARROW` plate, preview and heavy target border; release on an item to connect, or `Tab` choose target, `Enter` connect/remove, `Esc` cancel |
| Selected arrow | `ARROW` plate, heavy line; `Del remove · Tab next · Esc` |
| Unsaved | Warning `UNSAVED` plate |
| Saved | Decorative `SAVED` plate until the next change |
| Error | Critical `ERROR <reason>` plate until the next successful save. A failed save keeps the pane open; quitting then says `Ctrl+Q quits without saving` |
| Load failure | The terminal is not taken over: the message is printed, the file is left untouched, and the pane waits for Enter |
| Not built | The launcher prints the build command and waits for Enter |

## Interaction

The full mouse and keyboard table is in the [README](../README.md#use). Every mouse action has a keyboard path. Terminals report single clicks only, so a double-click is two clicks on the same cell within 400 ms. A new item opens under the mouse, or in the middle of the view when the mouse is outside the board. Clicking an item brings it to the front; `Tab` selects items in drawing order, then arrows, without reordering. Note interiors move when not editing; borders start connectors, except the resize corner. Text can be a connector target; the keyboard can connect from either kind. An empty text item is removed when editing ends.

Entering editing by double-click or keyboard starts the cursor at the raw source's end. While editing, a left press inside that same item places the cursor on the clicked raw drawn row and cell without starting a move drag; dragging extends a byte-boundary selection from there. A plain click clears the previous selection. Shift+Left/Right/Up/Down/Home/End extend from the cursor, with Up/Down using the same drawn-row mapping. Unshifted motion clears the selection. Past a row's text goes to that row's end; below the last drawn row goes to the source end. The second cell of a wide character chooses its starting byte boundary. At a hard wrap, the row-end byte boundary is drawn at the next row's start, as with keyboard insertion. Note borders and the resize handle retain their existing behavior, including while editing. Clicking outside the edited item finishes editing, except the formatting bar. Keyboard character, line, word and drawn-row motion remain available as listed in the README.

### Selection and formatting

Selection exists only while editing raw source; wrapping and wide glyphs use the cursor's existing byte/cell mapping. Mouse release copies a non-empty selection; keyboard selection never copies automatically. `COPY` or `Ctrl+T` then `c` copies either kind to the session cut buffer (`Ctrl+Y`) and requests both the terminal clipboard with OSC 52 and a local helper, without blocking editing. [Clipboard behavior and helper order](../README.md#clipboard) define the system boundary: the internal buffer is always available, but `COPIED` is not acknowledgement that a system clipboard received the text.

The one-row bar floats immediately above the selection's first drawn row, below when that is at the canvas top, clamped inside the canvas. It is drawn over the board and its click regions take precedence over drags or leaving editing. Whole buttons that cannot fit are dropped on tiny canvases; every action retains its key.

| Bar button | Ctrl+T then | Effect |
| --- | --- | --- |
| COPY | c | Copy, keeping selection |
| B | b | Toggle `**` bold |
| I | i | Toggle `*` italic |
| S | s | Toggle `~~` strike |
| Code (backtick) | backtick | Toggle single-backtick code |
| LINK | l | Wrap as `[selection](url)` and select `url`; an already selected full link or its label unwraps |
| H | h | Toggle `# ` on the selected logical lines |
| - | - | Toggle `- ` on the selected logical lines |
| [ ] | x | Toggle `- [ ] ` on the selected logical lines |

Bold, italic, strike and code act per logical line within the selection, skipping empty lines. If every non-empty selected line is wrapped by the markers (inside or immediately adjacent to its selected range), they unwrap; otherwise only unwrapped lines gain markers. Italic uses the parity of adjacent asterisk runs, preserving bold when toggling italic. A line counts as wrapped only when its content has no further occurrence of the requested marker; italic ignores paired `**` runs in that check. If any unwrapped selected line already contains the requested marker, the entire action is a no-op with `selection contains existing formatting markers`, preserving source and selection rather than merging or rewrapping separate spans. LINK requires a selection on one line: a selection spanning a newline is unchanged and kept selected, with the Hint plate `link needs a selection on one line`. Single-line link toggles retain their existing behavior. The resulting source stays selected, except a new link selects its URL placeholder. Line actions expand to whole logical lines, excluding a final line when the original selection ends at that line's start. Prefix actions also skip empty lines, remove prefixes only when every non-empty selected line already has the target form, and otherwise add only where missing. Heading recognizes any `# ` through `###### ` prefix. Bullet converts a checkbox line to a plain `- ` bullet, and checkbox converts a plain bullet to `- [ ] `; existing checked tasks remain checked in mixed selections. Typing, Enter, Tab, paste and character deletion replace/delete the selection; readline cuts keep their old behavior after clearing selection. There is no underline action. Esc cancels a pending Ctrl+T without leaving editing.

### Scrolling notes

Wheel over an overflowing note scrolls its drawn rows (raw during editing, rendered otherwise), rather than the board. Elsewhere wheel pans as before. Clicking the scrollbar track pages by its inner height; dragging the thumb scrolls proportionally and does not start a connector. PageUp/PageDown scroll a selected note outside editing. The offset is transient and clamped to the current content and size; it is never saved. Editing still grows the note with `fit_height`; when overflow remains (for example at the height cap), scrolling follows the insertion cursor so it remains inside the border. Click-to-cursor adds the current scroll offset.

The board opens in a split to the right of the focused pane by default, or in a new tab, so it can sit beside agents. Clicking another pane moves focus there, as usual in Herdr; clicking back into the board focuses it and the click also acts on the board. The pane captures the mouse while it runs, as its interaction contract; Herdr's own keys and chrome are unaffected. There is no motion. Initial toolbar clicks, typing, dragging, double-clicks and split-pane focus were checked through a Herdr 0.9.3 client; connector and readline evidence separates automated checks from the isolated Herdr-client check; see [contributing](../CONTRIBUTING.md#verification-records).

## Narrow and small terminals

A split pane is often narrow. The toolbar drops the title plate first, then buttons that do not fit, and hints are clipped; every action keeps its key. The board redraws at its new size whenever Herdr resizes the pane. Items outside the view are clipped at the board's edge, cell by cell, and wide characters that would straddle the edge are not drawn. A terminal of one row still renders without failing.
