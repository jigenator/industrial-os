# Design

The [shared visual language](../../../docs/design.md) applied to a whiteboard pane. Colors are Acid / Black roles mirrored in `src/palette.rs`.

```text
 WHITEBOARD    + NOTE   + TEXT   [■] ■  ■  ■  ■    DELETE    SAVE    QUIT
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
| Note | Rounded border, word-wrapped text, a one-cell shadow | Paper is the note's color; ink is field; border structural; shadow surface |
| Arrow | Elbow lines, shared junctions and arrowheads beneath items; [routing and clearance](architecture.md#flows) | Secondary on field; selection is heavy and drawn over other arrows |
| Selected note | Heavy border and a `◢` resize handle | Shape, not color, marks selection |
| Free text | Regular-weight text in the item's color; Markdown adds emphasis | Selected: surface background |
| Status line | Mode plate, hints, and a worded state plate on the right | See states |

The five note colors are accent, warning, critical, primary and secondary. They are labels a person chooses, not states: a critical-colored note means nothing to the app. The selected swatch is bracketed, `[■]`.

## Markdown display

Both notes and free text render the [supported Markdown subset](../README.md#markdown) unless being edited, when they show the raw source and the existing insertion cursor. Parsing is per logical line; the source is never rewritten. Rendered lines never exceed their raw line's cell width. Notes wrap the rendered spans at word boundaries, hard-breaking long words by cell width, within their stored width and height. Free text splits only at newlines; its hit rectangle, selection background and connector routing use rendered dimensions, switching to raw dimensions during editing. Existing note growth to fit the raw insertion row is unchanged.

Bold uses the terminal's bold modifier; italic uses italic; strike uses crossed-out; links use underline; headings use bold plus underline; code uses reverse video. The quote marker is dimmed. Note styles retain field ink on the paper color and free text retains item-color ink on the field (surface when selected), with code reversing those colors. Checkboxes and links are display only.

## States

| State | Shown as |
| --- | --- |
| Empty | `empty board · double-click to write · n for a sticky note`, centred, secondary |
| Ready | `BOARD` plate and the board's hints |
| Selected | `MOVE` plate, heavy border; hints include moving, resizing and connecting |
| Editing | Accent `EDIT` plate and the terminal cursor at the insertion point, including wrapped rows and wide characters |
| Connecting | `ARROW` plate, preview and heavy target border; release on an item to connect, or `Tab` choose target, `Enter` connect/remove, `Esc` cancel |
| Selected arrow | `ARROW` plate, heavy line; `Del remove · Tab next · Esc` |
| Unsaved | Warning `UNSAVED` plate |
| Saved | Decorative `SAVED` plate until the next change |
| Error | Critical `ERROR <reason>` plate until the next successful save. A failed save keeps the pane open; quitting then says `Ctrl+Q quits without saving` |
| Load failure | The terminal is not taken over: the message is printed, the file is left untouched, and the pane waits for Enter |
| Not built | The launcher prints the build command and waits for Enter |

## Interaction

The full mouse and keyboard table is in the [README](../README.md#use). Every mouse action has a keyboard path. Terminals report single clicks only, so a double-click is two clicks on the same cell within 400 ms. A new item opens under the mouse, or in the middle of the view when the mouse is outside the board. Clicking an item brings it to the front; `Tab` selects items in drawing order, then arrows, without reordering. Note interiors move when not editing; borders start connectors, except the resize corner. Text can be a connector target; the keyboard can connect from either kind. An empty text item is removed when editing ends.

Entering editing by double-click or keyboard starts the cursor at the raw source's end. While editing, a left click inside that same item places the cursor on the clicked raw drawn row and cell without starting a move drag. Past a row's text goes to that row's end; below the last drawn row goes to the source end. The second cell of a wide character chooses its starting byte boundary. At a hard wrap, the row-end byte boundary is drawn at the next row's start, as with keyboard insertion. Note borders and the resize handle retain their existing behavior, including while editing. Clicking outside the edited item finishes editing. Keyboard character, line, word and drawn-row motion remain available as listed in the README.

The board opens in a split to the right of the focused pane by default, or in a new tab, so it can sit beside agents. Clicking another pane moves focus there, as usual in Herdr; clicking back into the board focuses it and the click also acts on the board. The pane captures the mouse while it runs, as its interaction contract; Herdr's own keys and chrome are unaffected. There is no motion. Initial toolbar clicks, typing, dragging, double-clicks and split-pane focus were checked through a Herdr 0.9.3 client; connector and readline evidence separates automated checks from the isolated Herdr-client check; see [contributing](../CONTRIBUTING.md#verification-records).

## Narrow and small terminals

A split pane is often narrow. The toolbar drops the title plate first, then buttons that do not fit, and hints are clipped; every action keeps its key. The board redraws at its new size whenever Herdr resizes the pane. Items outside the view are clipped at the board's edge, cell by cell, and wide characters that would straddle the edge are not drawn. A terminal of one row still renders without failing.
