# Design

You see the picture a path in the draft refers to before you send it, and nothing else changes: no keys, focus, modes, notifications or edits to the draft. Behavior and limits are in the [README](../README.md#what-it-does); this page owns presentation.

## Preview widget

One widget sits above the editor (`aboveEditor`), with rows indented one cell like Pi's own widget text:

```text
 pi-clipboard-0b9e….png · 412 KB  drag-drop.jpg · 1.2 MB  +2 more
 ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
 ▒▒ thumbnail ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  ▒▒ thumbnail ▒▒▒▒▒▒▒▒▒   each at most 12 rows, 80 columns
 ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
```

- **Caption:** the file name and size in Pi's theme `muted`. It carries every meaning on its own; the picture only supports it. Control characters in file names show as `?`, and captions are truncated to the width.
- **Thumbnail:** a downscaled copy (at most 640 px, then 480 or 320 px if needed to stay under 256 KB of image data after any PNG conversion) at no more than 12 rows by 80 columns. Pi re-sends an image when its rows move, so a small thumbnail keeps that cheap.
- **Row (Kitty graphics):** captions share the first row and thumbnails the rows below, each preview in a cell as wide as its thumbnail, or its caption up to 24 columns, with 2 columns between cells. Each thumbnail is a separate Kitty placement that leaves the cursor in place; the row moves right past the cell to place the next. Previews are added in draft order, at most 8, while the next still fits with room for `+N more`; the first is always shown.
- **Stacked (other terminals):** Pi's `Image` component, one caption and thumbnail under another, at most 3, then one `+N more` line.
- **Duplicates:** an image named twice is listed once.
- **Absent:** when the draft names no image, the widget is removed rather than left empty.

## States

| State | Shown |
| --- | --- |
| Ready | Caption and thumbnail |
| Working | Caption ending `· loading preview` while the thumbnail is made |
| No image protocol | Caption only; it is the text form of the preview |
| Error | Caption ending `· no preview` when the thumbnail cannot be made |
| Missing, not an image, or over 20 MB | Nothing; the path is ordinary text |

No motion is used.

## Colors and Herdr

The caption uses Pi theme tokens rather than Acid / Black roles, like the other imported text-first extensions; the gap is recorded in [conventions](conventions.md#adoption-gaps). Pi treats Herdr (`TERM_PROGRAM=herdr`) as a Kitty-graphics terminal, but neither the thumbnail, its cleanup when the widget goes away, nor the caption's contrast has been checked in Herdr or any interactive terminal.
