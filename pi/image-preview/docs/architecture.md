# Architecture

## Modules and dependencies

TypeScript ESM under `src/`, run by Pi's loader and by Node type stripping in tests. It imports Node `crypto`, `fs/promises`, `os` and `path`, and host packages only: `@earendil-works/pi-coding-agent` (`resizeImage`, `convertToPng`, `detectSupportedImageMimeTypeFromFile`, types), `@earendil-works/pi-tui` (`Image`, `getCapabilities`, `truncateToWidth`) and a type from `@earendil-works/pi-ai`. It imports no other extension and not the design system.

| Module | Owns | Tests |
| --- | --- | --- |
| `src/paths.ts` | Finding image-path tokens: endings, candidate starts, quotes, `\` escapes, `~/`; message path quoting | `test/paths.test.ts` |
| `src/store.ts` | Process-wide label registry, size/type validation, content hash, session cache path, hash-checked copies and session-switch re-copy | `test/store.test.ts` |
| `src/draft.ts` | Label syntax, Pi's paste-collapse threshold, bash/command detection and the draft rewrite rules | `test/draft.test.ts` |
| `src/submit.ts` | The submit rewrite: cache unlabelled paths, labels to paths, attachments | `test/submit.test.ts` |
| `src/preview.ts` | Thumbnails and the above-editor widget component | `test/preview.test.ts` |
| `src/index.ts` | Pi wiring: session lifecycle, editor polling, terminal-input observation, widget ownership, notifications, the `input` handler | `test/extension.test.ts` (Pi's real loader and `ExtensionRunner`) |

## Flows

**Draft.** `session_start` in TUI mode starts a `watchDraft` for that session. Every 200 ms it compares `ctx.ui.getEditorText()` with the last text it checked; on a change it runs one serialized scan, and a change arriving during a scan queues one more. A scan lists every candidate path in the text (`listCandidatePaths`). For each one that `stat`s as a file it calls `ingestImage`, keyed by size, mtime and session file so an unchanged file is not reread. Ingest validates, hashes, caches and labels the file. The scan then rereads the editor text and, in the same synchronous step, applies `rewriteDraft` and calls `setEditorText`, so keystrokes typed during the asynchronous work are kept. Finally it updates the widget from the labels and accepted paths in the current text. Thumbnails are made asynchronously for the first three images and refresh the widget when ready.

**Submit.** Pi emits `input` before skill and template expansion; extension commands and `!` commands never reach it. For `source: "interactive"` in TUI mode, `prepareSubmission` ingests any image path still in the text and replaces it with its label. It then resolves every known label through `materialize`, which returns hash-verified bytes from the current session's copy, the recorded copy or the source, in that order, copying into the current session's folder when needed. Labels become paths, one `ImageContent` is appended per distinct image after the event's existing images, and `{ action: "transform" }` is returned. Pi then normalizes and resizes the attachments.

## State and persistence

- **Registry:** the label counter, label→record and hash→label maps, and the set of files already warned about live on `globalThis` under `Symbol.for("pi-image-preview.registry")`. They survive `/reload`, which re-evaluates the module, and session replacement, and end with the process. Records hold paths and metadata, never image bytes.
- **Per session:** the watch's path cache (at most 64 paths), thumbnails (at most 16), collapsed-paste flag, poll timer, terminal-input subscription and widget. `session_shutdown` stops the timer, unsubscribes and removes the widget; a scan finishing after that touches no UI.
- **On disk:** `<dirname(session file)>/<session file name without .jsonl>.images/<first 16 hex of SHA-256>.<png|jpg|gif|webp>`, with the extension taken from the sniffed type. Each copy is written to a unique temporary name and renamed, and an existing name is never overwritten. Nothing else is written, and no settings or session entries are created.

## Host seams

| Seam | Dependency and risk | Check |
| --- | --- | --- |
| No editor-change event | Polling `getEditorText()`, which returns text with collapsed pastes expanded | Integration tests drive a scripted editor |
| `setEditorText` | `Editor.setText` moves the cursor to the end, pushes an undo snapshot and clears the collapsed-paste map, so a draft that may hold a collapsed paste is never rewritten | `test/draft.test.ts`, collapsed-paste integration test |
| Collapse threshold | `COLLAPSE_LINES`/`COLLAPSE_CHARS` copy pi-tui 1.3.0 `Editor.handlePaste` (more than 10 lines or 1000 characters); bracketed pastes arrive whole through `onTerminalInput`, observed without consuming. Recheck on host upgrades | `test/draft.test.ts` |
| Editor ownership | Reads and writes go through `ctx.ui`, so they reach whichever editor component is active; the extension never calls `setEditorComponent` | Review |
| Images | `resizeImage` (a Photon worker with an in-process fallback), `convertToPng` for Kitty, which accepts only PNG, and the shared `Image` component. Per the host source, Pi's renderer deletes Kitty images whose rows disappear; that is not tested here | `test/preview.test.ts` runs the pinned host resizer |
| Commands | A draft is a command if its first word is `/name` with no second `/`; Pi sends an unknown `/path…` as a message | `test/draft.test.ts` |

## Critical invariants

- No exception reaches Pi: scans and the `input` handler catch everything and leave the text as typed.
- A rewrite is computed from the editor text read in the same synchronous step that writes it.
- Labels never reach a bash command or slash command draft, and a draft that may hold a collapsed paste is never rewritten.
- An attachment's bytes always match the recorded hash.
- Only interactive TUI submissions are changed.

## Evolution

Replace polling and the copied collapse threshold if Pi adds an editor-change event or a way to read raw editor text. Session-folder cleanup, a preview setting, or design-system plates for the caption would each be a separate change.
