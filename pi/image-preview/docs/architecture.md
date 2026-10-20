# Architecture

## Modules and dependencies

TypeScript ESM under `src/`, run by Pi's loader and by Node type stripping in tests. It imports Node `crypto`, `fs/promises`, `os` and `path`, and host packages only: `@earendil-works/pi-coding-agent` (`resizeImage`, `convertToPng`, `detectSupportedImageMimeTypeFromFile`, types), `@earendil-works/pi-tui` (`Image`, `getCapabilities`, `getKeybindings`, `truncateToWidth`, types) and a type from `@earendil-works/pi-ai`. It imports no other extension and not the design system.

| Module | Owns | Tests |
| --- | --- | --- |
| `src/paths.ts` | Finding image-path tokens: endings, candidate starts, quotes, `\` escapes, `~/`, the search bounds and per-path token counts; message path quoting | `test/paths.test.ts` |
| `src/store.ts` | Process-wide label registry, size/type validation, content hash, session cache path, hash-checked copies that replace a differing copy, cache failures and session-switch re-copy | `test/store.test.ts` |
| `src/draft.ts` | Label syntax, Pi's paste-collapse rule, input key classes, bash/command detection, kept paths after undo or recall, and the draft rewrite rules | `test/draft.test.ts` (collapse rule checked against pi-tui's real `Editor`) |
| `src/submit.ts` | The submit rewrite: cache unlabelled paths, labels to paths, attachments | `test/submit.test.ts` |
| `src/preview.ts` | Thumbnails and the above-editor widget component | `test/preview.test.ts` |
| `src/index.ts` | Pi wiring: session lifecycle, editor polling, terminal-input observation and change attribution, the Enter-time restore, widget ownership, notifications, the `input` handler | `test/extension.test.ts` (Pi's real loader and `ExtensionRunner`, with pi-tui's real `Editor` behind `ctx.ui`) |

## Flows

**Draft.** `session_start` in TUI mode starts a `watchDraft` for that session. It reads the starting draft at once; a non-empty one, as after `/reload`, counts as recalled and as possibly holding a collapsed paste.

- **Attribution.** A non-consuming terminal-input listener sees every raw input before the editor does. It classifies the input with Pi's keybindings (`classifyInput`): undo, history and cursor Up/Down are *recall*, the submit and select-confirm keys are *submit*. A microtask queued by the first input of a synchronous batch runs once the editor has handled the batch and attributes the draft change to it. After a recall change, every path token in the draft is *kept* (`noteDraftChange`), and nothing is rewritten until an ordinary edit. After an ordinary edit, kept tokens that are gone are forgotten. Changes not caused by a key, such as Pi inserting a clipboard image path, are attributed as edits when next read. An emptied draft clears the flags and kept paths. The count of collapsing pastes since the last submit is cleared only by a submit, because undo after emptying can bring a collapsed paste back.
- **Scan.** Every 200 ms the watch compares the draft with the text the last scan started from; on a change it runs one serialized scan, and a change arriving during a scan queues one more. A scan lists the bounded candidate paths in the text (`listCandidatePaths`). For each one that `stat`s as a file it calls `ingestImage`, keyed by size, mtime and session file so an unchanged file is not reread. Ingest validates, hashes, caches and labels the file, or reports a cache failure, which gets no label. The scan then rereads the draft. If it differs from the scanned text, another scan is queued for the new paths. In the same synchronous step it applies `rewriteDraft`, which labels known paths that are not kept, and calls `setEditorText`, so keystrokes typed during the asynchronous work are kept. Finally it updates the widget from the labels and accepted paths in the current text. Thumbnails are made asynchronously for the first three images and refresh the widget when ready.
- **Enter.** When the listener sees a submit key, it reads the draft synchronously. A bash or command draft holding known labels is rewritten with their paths before the listener returns, so the editor submits the restored text.

**Submit.** Pi emits `input` before skill and template expansion; extension commands and `!` commands never reach it, which is why the Enter-time restore exists. For `source: "interactive"` in TUI mode, `prepareSubmission` ingests any image path still in the text and replaces it with its label; a path that is too large or cannot be cached stays as text. It then resolves every known label through `materialize`, which returns hash-verified bytes from the current session's copy, the recorded copy or the source, in that order, copying into the current session's folder when needed; the returned path always holds the returned bytes. Labels become paths, one `ImageContent` is appended per distinct image after the event's existing images, and `{ action: "transform" }` is returned. Warnings for too-large, uncached, unreadable and unsaved images are sent whether or not anything changed. Pi then normalizes and resizes the attachments.

## State and persistence

- **Registry:** the label counter, label→record and hash→label maps, and the set of files already warned about live on `globalThis` under `Symbol.for("pi-image-preview.registry")`. They survive `/reload`, which re-evaluates the module, and session replacement, and end with the process. Records hold paths and metadata, never image bytes.
- **Per session:** the watch's path cache (at most 64 paths), thumbnails (at most 16), draft state (collapsed-paste and recalled flags, kept path counts, collapsing pastes since the last submit), poll timer, terminal-input subscription and widget. `session_shutdown` stops the timer, unsubscribes and removes the widget; a scan finishing after that touches no UI.
- **On disk:** `<dirname(session file)>/<session file name without .jsonl>.images/<first 16 hex of SHA-256>.<png|jpg|gif|webp>`, with the extension taken from the sniffed type. Each copy is written to a unique temporary name and renamed. An existing copy is kept only if its content matches its hash; otherwise it is replaced the same way. Nothing else is written, and no settings or session entries are created.

## Host seams

| Seam | Dependency and risk | Check |
| --- | --- | --- |
| No editor-change event | Polling `getEditorText()`, which returns text with collapsed pastes expanded | Integration tests drive pi-tui's real `Editor` |
| `setEditorText` | `Editor.setText` moves the cursor to the end, cancels completion, pushes an undo snapshot, ends history browsing and clears the collapsed-paste map. So a draft that may hold a collapsed paste is never rewritten, nor one just produced by undo or recall | Undo, history, collapsed-paste and tab-paste integration tests |
| Collapse rule | `isCollapsingPaste` copies pi-tui 1.3.0 `Editor.handleInput` and `handlePaste`: CSI-u decoding, line-ending and tab normalization, control filtering, then more than 10 lines or 1000 characters. The cursor-dependent space before a pasted path is always counted. Bracketed pastes arrive whole through `onTerminalInput`, observed without consuming. Recheck on host upgrades | `test/draft.test.ts` compares it with the real `Editor` |
| Input order and keybindings | pi-tui `TUI.handleTerminalInput` runs every input listener synchronously before the focused component's `handleInput`. `getKeybindings()` returns the manager Pi's interactive mode installs with `setKeybindings`; the installed Pi bundle hands extensions its own pi-tui module. The undo, history, cursor, submit, select-confirm and new-line actions are read from it | Remapped-undo integration test, against the development host's pi-tui; the bundle's module sharing was read from its loader source |
| Submit | `Editor.submitValue` submits the draft expanded with its own paste map. A draft replaced by `setText` with the already expanded text submits the same content, so the Enter-time restore cannot lose a collapsed paste | Bash and command Enter integration test |
| Editor ownership | Reads and writes go through `ctx.ui`, so they reach whichever editor component is active; the extension never calls `setEditorComponent` | Review |
| Images | `resizeImage` (a Photon worker with an in-process fallback), `convertToPng` for Kitty, which accepts only PNG, and the shared `Image` component. Per the host source, Pi's renderer deletes Kitty images whose rows disappear; that is not tested here | `test/preview.test.ts` runs the pinned host resizer |
| Commands | A draft is a command if its first word is `/name` with no second `/` and is not a known image path. Pi trims the draft, runs `!` as bash and built-in or extension commands directly, and sends an unknown `/name…` as a message | `test/draft.test.ts` |

## Critical invariants

- No exception reaches Pi: scans and the `input` handler catch everything and leave the text as typed.
- A rewrite is computed from the editor text read in the same synchronous step that writes it.
- Labels are turned back into paths in a bash or command draft when it is checked and on the submit key; the remaining gaps are in the README limitations.
- A draft that may hold a collapsed paste, or was just produced by undo or recall, is never rewritten by a check, and paths kept after undo or recall are never relabelled.
- An attachment's bytes always match the recorded hash, and a returned copy's path holds those bytes. A path is labelled only when its session copy, where there is a session file, was written and verified.
- Candidate search is bounded: linear in the text, with capped candidates.
- Only interactive TUI submissions are changed.

## Evolution

Replace polling, the copied collapse rule and the key-class attribution if Pi adds an editor-change event with its cause, a way to read raw editor text, or a pre-dispatch hook for bash and commands. Session-folder cleanup, a preview setting, or design-system plates for the caption would each be a separate change.
