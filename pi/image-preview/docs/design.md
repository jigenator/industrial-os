# Design

The extension should feel like Pi already understood the image: the draft stays short and readable, and the picture you are about to send is visible before you send it. It adds no keys, focus or modes. The user-facing behavior and its exceptions are in the [README](../README.md#what-it-does); this page owns presentation.

## Labels

A label is the literal text `[image N]` in the draft. It matches the preview caption exactly, so the two can be matched by text alone. Numbers come from one counter for the whole Pi process. The same image content keeps its number, and a number is never given to different content. A label is replaced only by a whole-draft rewrite through Pi's `setEditorText`, which moves the cursor to the end of the draft. That is an accepted limitation; undo returns the path, and the returned path then stays as typed.

## Preview widget

One widget sits above the editor (`aboveEditor`), with rows indented one cell like Pi's own widget text:

```text
 [image 1] pi-clipboard-0b9e….png · 412 KB
 ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
 ▒▒ thumbnail ▒▒▒▒▒   at most 6 rows, 40 columns
 ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
 drag-drop.jpg · 1.2 MB
 +2 more
```

- **Caption:** the label in Pi's theme `accent`, then the file name and size in `muted`. An unlabelled path (bash or command draft, collapsed paste, kept after undo or recall) has no label. The caption carries every meaning on its own; the picture and colors only support it. Control characters in file names show as `?`, and captions are truncated to the width.
- **Thumbnail:** Pi's `Image` component on a downscaled copy (at most 480 px, then 320 or 200 px if needed to stay under 256 KB of image data after any PNG conversion) at no more than 6 rows by 40 columns. Pi re-sends an image when its rows move, so a small thumbnail keeps that cheap.
- **Limit:** the first 3 distinct images in draft order are shown, then one `+N more` line. An image appearing twice is listed once.
- **Absent:** when the draft holds no image, the widget is removed rather than left empty.

## States

| State | Shown |
| --- | --- |
| Ready | Caption and thumbnail |
| Working | Caption ending `· loading preview` while the thumbnail is made |
| Unsupported terminal | Caption only; it is the text form of the preview |
| Error | Caption ending `· no preview` when the thumbnail cannot be made; submit still attaches the image |
| Too large | No caption, no label; one `warning` notification per file, while typing or on submit: `image-preview: <name> is over 20 MB; left as text, not attached` |
| Not cached | No caption, no label; one `warning` per file when its session copy cannot be written: `image-preview: <name> could not be saved to the session folder; left as text, not attached` |
| Kept after undo or recall | Caption without a label; the path stays in the draft and is attached on submit |
| Unreadable on submit | One `warning` per label: `image-preview: [image N] could not be read; sent as its path without the image` |
| Unsaved on submit | One `warning` per label attached from an earlier copy: `image-preview: [image N] could not be saved to this session's folder; sent with its earlier path` |

No motion is used. Failures never reach Pi as errors; they leave the path text as typed.

## Colors and Herdr

The caption uses Pi theme tokens rather than Acid / Black roles, like the other imported text-first extensions; the gap is recorded in [conventions](conventions.md#adoption-gaps). Pi treats Herdr (`TERM_PROGRAM=herdr`) as a Kitty-graphics terminal, but neither the thumbnail, its cleanup when the widget goes away, nor the caption's contrast has been checked in Herdr or any interactive terminal.
