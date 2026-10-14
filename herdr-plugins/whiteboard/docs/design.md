# Design

The [shared visual language](../../../docs/design.md) applied to a whiteboard pane. Colors are Acid / Black roles mirrored in `src/palette.rs`.

```text
 WHITEBOARD    + NOTE   + TEXT   [■] ■  ■  ■  ■    DELETE    SAVE    QUIT
·     ·     ·     ·     ·     ·     ·     ·     ·     ·     ·     ·
  ╭──────────────────────╮      ┏━━━━━━━━━━━━━━━━━━━━━━┓
  │ship the plugin       │      ┃review the palette    ┃
  │                      │      ┃                      ┃
  ╰──────────────────────╯      ┗━━━━━━━━━━━━━━━━━━━━━━◢
·     ·     ·  free text here  ·     ·     ·     ·     ·
 MOVE  drag or arrows to move · drag ◢ or Shift+arrows to resize · …  UNSAVED
```

## Layout and color

| Part | Look | Role |
| --- | --- | --- |
| Toolbar | `WHITEBOARD` plate, then buttons; buttons that do not fit are dropped, never overlapped | Plate: field on accent. Bar: secondary on surface. Buttons: primary on structural |
| Board | Black field with a dot every 6 columns and 3 rows, anchored to the board so panning shows | Field; dots structural |
| Note | Rounded border, word-wrapped text, a one-cell shadow | Paper is the note's color; ink is field; border structural; shadow surface |
| Selected note | Heavy border and a `◢` resize handle | Shape, not color, marks selection |
| Free text | Bold text in the item's color | Selected: surface background |
| Status line | Mode plate, hints, and a worded state plate on the right | See states |

The five note colors are accent, warning, critical, primary and secondary. They are labels a person chooses, not states: a critical-colored note means nothing to the app. The selected swatch is bracketed, `[■]`.

## States

| State | Shown as |
| --- | --- |
| Empty | `empty board · double-click to write · n for a sticky note`, centred, secondary |
| Ready | `BOARD` plate and the board's hints |
| Selected | `MOVE` plate, heavy border; the hints list the move and resize keys |
| Editing | Accent `EDIT` plate and the terminal cursor at the end of the text |
| Unsaved | Warning `UNSAVED` plate |
| Saved | Decorative `SAVED` plate until the next change |
| Error | Critical `ERROR <reason>` plate until the next successful save. A failed save keeps the pane open; quitting then says `Ctrl+Q quits without saving` |
| Load failure | The terminal is not taken over: the message is printed, the file is left untouched, and the pane waits for Enter |
| Not built | The launcher prints the build command and waits for Enter |

## Interaction

The full mouse and keyboard table is in the [README](../README.md#use). Every mouse action has a keyboard path. Terminals report single clicks only, so a double-click is two clicks on the same cell within 400 ms. A new item opens under the mouse, or in the middle of the view when the mouse is outside the board. Clicking an item brings it to the front; `Tab` selects in drawing order without reordering. An empty text item is removed when editing ends.

The pane captures the mouse while it runs, as its interaction contract; Herdr's own keys and chrome are unaffected. There is no motion. Toolbar clicks, typing, dragging and double-clicks were checked through a Herdr 0.9.3 client; see [contributing](../CONTRIBUTING.md#verification-records).

## Narrow and small terminals

The toolbar drops what does not fit and hints are clipped; every action keeps its key. Items outside the view are clipped at the board's edge, cell by cell, and wide characters that would straddle the edge are not drawn. A terminal of one row still renders without failing.
