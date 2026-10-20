# Engineering conventions

Follow [root conventions](../../../docs/conventions.md) and the [Pi guide](../../AGENTS.md). TypeScript ESM for Node 22.19+, run by type stripping, with strict no-emit `tsc` over `src/` and `test/`. Host packages are `*` peers, pinned to 1.3.0 only as development dependencies; there is no runtime dependency.

## Boundaries and state

- Keep pure text rules (`paths.ts`, `draft.ts`) free of I/O, and keep Pi lifecycle, timers and UI calls in `index.ts`. Check: the pure modules' tests use no Pi context.
- Treat every path, file name and file as untrusted: sniff the type from content, cap the size before reading, verify the hash before attaching, and sanitize file names for display. Check: `test/store.test.ts`, `test/preview.test.ts`.
- Write only inside the session's `.images` folder, through a temporary name and rename. Keep an existing copy only after checking it against its hash; replace one that differs. Check: `test/store.test.ts`.
- Read and rewrite the editor in one synchronous step; never rewrite from text captured before an `await`. Check: review `scanOnce` and `restoreBeforeSubmit`.
- Never rewrite right after undo or history recall, and never relabel a path they brought back. Check: the undo and history integration tests.
- Never call `setEditorComponent` or consume terminal input. Check: review; the integration harness asserts input is returned unconsumed.
- Keep pure text work linear in the draft length, with capped output. Check: the adversarial tests in `test/paths.test.ts`.
- Every asynchronous path catches its failure and degrades to leaving the text alone; notifications are warnings, once per file or label. Check: too-large and unreadable tests.
- Bound what is retained: paths, thumbnails and preview count have fixed caps, and the registry holds no image bytes.

## Tests

Tests write only to temporary directories and use Pi's real loader with a temporary agent directory, pi-tui's real `Editor` behind `ctx.ui` and a fake widget host. Editor behavior is tested by feeding raw input through the terminal-input listeners and then `Editor.handleInput`, the order Pi uses, not only through string helpers. They make no model or network calls and touch no real settings. Terminal capabilities are set explicitly and reset after each test. Exact commands live in [contributing](../CONTRIBUTING.md).

## Adoption gaps

| Gap | Evidence | Next change and check |
| --- | --- | --- |
| No design-system or Acid / Black adoption | The caption uses Pi theme `accent`/`muted`; no plates or palette imports | A separately approved visual change through exported subpaths, then a host appearance check |
| Copied host internals | The paste-collapse rule mirrors pi-tui 1.3.0 `Editor.handlePaste`; the key classes, listener order and submit expansion were read from host source, not a contract | On a host upgrade, bump the development pins, reread `Editor.handleInput`/`handlePaste`/`setText`/`submitValue`, `TUI.handleTerminalInput` and the keybinding ids, and rerun the suite |
| No interactive Pi/Herdr qualification | Offline tests and an RPC load check only | An authorized manual check in Pi and Herdr: Ctrl+V, drag-and-drop, preview cleanup, resize, recall and submit |
| No formatter or linter | Only `tsc` and tests | Add only for an approved need |
