# Architecture

## Modules and dependencies

TypeScript ESM under `src/`, run by Pi's loader and by Node type stripping in tests. It imports Node `fs/promises`, `os` and `path`, and host packages only: `@earendil-works/pi-coding-agent` (`resizeImage`, `convertToPng`, `detectSupportedImageMimeTypeFromFile`, types) and `@earendil-works/pi-tui` (`Image`, `renderImage`, `allocateImageId`, `getCapabilities`, `truncateToWidth`, `visibleWidth`, types). It imports no other extension and not the design system.

| Module | Owns | Tests |
| --- | --- | --- |
| `src/paths.ts` | Finding image-path tokens: endings, candidate starts, quotes, `\` escapes, `~/`, and the search bounds | `test/paths.test.ts` |
| `src/image.ts` | Whether a path is a regular, size-capped file of a supported sniffed type; reading it within the cap | `test/image.test.ts` |
| `src/preview.ts` | Thumbnails and the above-editor widget component | `test/preview.test.ts` |
| `src/index.ts` | Pi wiring: session lifecycle, editor polling and the widget | `test/extension.test.ts` (Pi's real loader and `ExtensionRunner`, with a fake `ctx.ui`) |

## Flow

`session_start` in TUI mode stops any earlier watch and starts one for the session. Every 200 ms it reads `ctx.ui.getEditorText()`; when the text differs from the text the last scan started from, it runs one serialized scan, and a change during a scan queues one more.

A scan lists the bounded candidate paths in the text (`listCandidatePaths`) and checks each with `inspectImage`. If the editor text changed meanwhile, it scans again without showing anything. Otherwise `matchImagePaths` picks, per image ending, the nearest start that named an image, and the distinct images in reading order become the widget's entries. No entries removes the widget. Thumbnails are made asynchronously for the first eight images, from bytes read within the size cap, and refresh the widget when ready.

`session_shutdown`, or the next `session_start`, stops the timer and removes the widget; work finishing after that touches no UI.

## State

Per watch only: the poll timer, the last scanned text with its images, up to 16 thumbnails keyed by path, size and modification time, and the widget. Nothing is written to disk, settings or the session, and nothing outlives the session.

## Host seams

| Seam | Dependency and risk | Check |
| --- | --- | --- |
| No editor-change event | Polling `getEditorText()`, which returns the text with collapsed pastes expanded | Integration tests |
| Widget | `setWidget(key, factory, { placement: "aboveEditor" })`; the factory receives the TUI for re-render requests | Integration tests with a fake widget host |
| Images | `resizeImage` (a Photon worker with an in-process fallback), `convertToPng` for Kitty, which accepts only PNG. With Kitty, `renderImage` with `moveCursor: false` gives each thumbnail a placement that leaves the cursor in place, and a cursor-forward between placements puts several on one row; Pi's renderer reads only a row's first Kitty command. Regular mode deletes a changed row's images by that first ID, so each later placement deletes its old copy before redrawing, and the widget writes deletes through `tui.terminal.write` for thumbnails that leave the row and, in `dispose()` (which Pi calls when the widget is removed), for all of them. Fullscreen mode caches and crops only the first; the others are re-sent on redraw and are not cropped. Other protocols use the shared `Image` component, one per row | `test/preview.test.ts` runs the pinned host resizer |
| Capabilities | `getCapabilities().images` decides whether thumbnails are made. Pi does not expose its `showImages` setting to widgets | Preview tests set capabilities explicitly |

No host logic is copied.

## Critical invariants

- The editor and submissions are never changed: no editor writes, terminal-input listener or `input` handler.
- No exception reaches Pi; failures leave no preview.
- Candidate search is linear in the text, with at most 256 candidates.
- One watch per session; its timer and widget end with the session.

## Evolution

Replace polling if Pi adds an editor-change event. A preview setting or design-system plates for the caption would each be a separate change.
