# Engineering conventions

Follow [root conventions](../../../docs/conventions.md) and the [Pi guide](../../AGENTS.md). TypeScript ESM for Node 22.19+, run by type stripping, with strict no-emit `tsc` over `src/` and `test/`. Host packages are `*` peers, pinned to 1.3.0 only as development dependencies; there is no runtime dependency.

## Boundaries and state

- Keep `paths.ts` pure and free of I/O; keep Pi lifecycle, timers and UI calls in `index.ts`. Check: `test/paths.test.ts` uses no Pi context.
- Read the editor only. Check: the integration tests record every editor-changing UI call and assert there is no `input` handler.
- Treat every path, file name and file as untrusted: sniff the type from content, cap the size before reading, and sanitize file names for display. Check: `test/image.test.ts`, `test/preview.test.ts`.
- Keep text work linear in the draft length, with an exact candidate cap. Check: the adversarial and exact-cap tests in `test/paths.test.ts`.
- Every asynchronous path catches its failure and degrades to no preview, without notifications.
- Bound what is retained: thumbnails and preview count have fixed caps.

## Tests

Tests write only to temporary directories and use Pi's real loader with a temporary agent directory, a fake `ctx.ui` and a fake widget host. They make no model or network calls and touch no real settings. Terminal capabilities are set explicitly and reset after each test. Exact commands live in [contributing](../CONTRIBUTING.md).

## Adoption gaps

| Gap | Evidence | Next change and check |
| --- | --- | --- |
| No design-system or Acid / Black adoption | The caption uses Pi theme `muted`; no plates or palette imports | A separately approved visual change through exported subpaths, then a host appearance check |
| No interactive Pi/Herdr qualification | Offline tests and an RPC load check only | An authorized manual check in Pi and Herdr: Ctrl+V, drag-and-drop, preview cleanup and resize |
| No formatter or linter | Only `tsc` and tests | Add only for an approved need |
