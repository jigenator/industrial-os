# Contributing

Follow the [repository workflow](../../CONTRIBUTING.md) and [project guide](AGENTS.md).

## Toolchain and setup

Use Node.js 22.19+ and npm. The source is TypeScript ESM, run by Pi's loader and by Node type stripping in tests. TypeScript 5.9 checks `src/` and `test/` with strict NodeNext, no emit and `skipLibCheck`. The Pi development packages (`pi-coding-agent`, `pi-tui`) are pinned to **1.3.0**, the installed host version. No formatter, linter or build is declared.

Pi supplies the runtime peers. The extension has no runtime dependency and does not use the design system, so its own checks need only the install below. Loading the whole monorepo also follows [root setup](../../CONTRIBUTING.md#setup).

## Full validation sequence

Run from `pi/image-preview/`:

```sh
npm ci
npm run check
```

`check` runs `npm run typecheck` (`tsc --noEmit`), then `npm test` (`node --test test/*.test.ts`). Tests write only to temporary directories. `test/extension.test.ts` loads `src/index.ts` through the pinned host's real loader with a temporary agent directory and drives Pi's `ExtensionRunner`, with a fake `ctx.ui` and widget host. `test/preview.test.ts` runs the pinned host's image resizer. No test calls a model or the network, or touches `~/.pi`.

Then check that the existing installed Pi loads the extension, from an empty temporary directory with a temporary agent directory:

```sh
echo '{"type":"get_commands","id":"1"}' | PI_CODING_AGENT_DIR=<temp agent dir> pi -e <checkout>/pi/image-preview/src/index.ts --mode rpc
```

It passes when it exits 0 with a `"success":true` response and nothing on stderr. The extension registers no commands, so the reply lists only built-in ones. A load failure exits 1 and prints `Failed to load extension`. The command makes no model call and changes no settings. For the whole-monorepo entry, use the local-clone install in [Pi contributing](../CONTRIBUTING.md#shared-toolchain-facts).

Finish with the [repository-wide checks](../../CONTRIBUTING.md#repository-wide-checks). Report automated, installed-Pi load and interactive evidence separately.

Interactive validation is separate. In a disposable Pi session in a Kitty-capable terminal and in Herdr, check Ctrl+V of a screenshot, a copied file whose path contains spaces, drag-and-drop, a typed `~/` path, the caption and thumbnail size, the preview's removal when the path is deleted and on `/new`, terminal resizing, and that the draft and the submitted message are unchanged.

## Review and documentation

Trace text → `paths.ts` → `image.ts` → `index.ts` → `preview.ts` before changing shared behavior. On a host upgrade, bump the development pins together and reread the [host seams](docs/architecture.md#host-seams). Update user behavior and limits in the README, flow and seams in architecture, presentation in design and engineering gaps in conventions; map any new guide here and at the root.

## Verification records

2026-10-21, deleting side-by-side thumbnails, macOS, Node 22.23.0, Pi 1.3.0 regular mode. David saw thumbnails stay on screen after Up recalled a message without image paths; Pi's main-screen renderer deletes a changed row's Kitty images by the ID in the row's first command only (`tui-main-screen.js` `parseKittyImageHeader`).

- `npm ci`, then `npm run check`: strict typecheck clean, **33/33 tests**. The two new preview tests (first command on the row is a placement while the first preview loads; deletes for dropped thumbnails and on `dispose`, idempotent) failed with the source change stashed, and pass with it.
- Interactive Herdr check of the fix: **not run**.

2026-10-20, side-by-side row and doubled size, macOS, Node 22.23.0, npm 10.9.8, installed Pi 1.3.0.

- `npm ci`, then `npm run check`: strict typecheck clean, **31/31 tests**. New preview tests cover captions sharing one row above two Kitty placements on one image row (`C=1` plus a cursor-forward), the 12-row budget, `+N more` when previews pass the right edge, all five shown on a wide row, and one preview always shown on narrow rows; the stacked layout keeps its own limit of three.
- Installed-Pi load check above: exit 0, `"success":true`, empty stderr.
- Interactive: the previous stacked version was confirmed by David in Pi inside Herdr on 2026-10-20 with a test PNG and Ctrl+V screenshots. The side-by-side row has **not** been seen in a terminal yet.

2026-10-20, preview-only version, macOS, Node 22.23.0, npm 10.9.8, installed Pi 1.3.0. Earlier records on this branch described the removed labelling, caching and attachment behavior and were replaced.

- `npm install` after dropping the unused `pi-ai` development pin and peer updated the lockfile; `npm ci` then installed 119 packages with **0 vulnerabilities** and one deprecation warning for `node-domexception`, from the host's dependency tree.
- `npm run check`: passed three consecutive times. Strict typecheck clean, then **29/29 tests**, 0 failed, skipped or cancelled. They cover:
  - path detection: plain, `\ `-escaped, quoted, `~/`, unescaped spaces only when the file exists, punctuation, non-image extensions, relative paths, missing files, adversarial text, and the exact 256-candidate cap over distinct paths, which the previous parser exceeded (259)
  - image files: sniffed type, missing files, directories, non-image content, the size cap, and a file that grows past the cap or vanishes before reading
  - widget: caption-only, `+N more`, narrow widths and control characters, the Kitty thumbnail row budget, the real host resizer and the byte cap after PNG conversion
  - integration: preview, update and clear; no editor write, paste, editor replacement, terminal-input listener, notification or `input` handler, and `input` returns `continue`; missing, fake and oversized files ignored; RPC mode inert; shutdown cleanup; a session restart replacing the watch. Injecting a `setEditorText` call or an `input` handler made these tests fail.
- Installed-Pi load check above from an empty temporary directory: exit 0, `"success":true`, empty stderr. As a control, the same command on a temporary extension importing a missing module exited 1 with `Failed to load extension`.
- Whole-monorepo local install: `pi install <worktree>` into a temporary agent directory exited 0. The RPC `get_commands` then exited 0 with `"success":true` and empty stderr, and listed `footer-motion`, `flag`, `pane-naming` and `recap` from the checkout.
- Interactive Pi and Herdr rendering, real clipboard and drag-and-drop input, a pushed git-source install and other platforms: **not run**.

### Simplification pass

The full branch diff against `4e23fea` was reviewed after the preview-only rewrite. Removed: the label registry, session `.images` cache and hash checks (`store.ts`), the draft rewrite, paste-collapse and key-class rules (`draft.ts`), the submit transform and attachments (`submit.ts`), the terminal-input listener, Enter-time restore and `input` handler, all notifications, `countCandidatePaths`, `formatPath`, the per-session path cache, the real-`Editor` test harness and the `pi-ai` dependency. Kept: polling, because Pi has no editor-change event; the bounded parser, because unescaped paths with spaces need several candidate starts; content sniffing, which also supplies the resizer's MIME type; and thumbnails rather than original images, to bound the Kitty data re-sent on repaint. No settings, commands or flags exist, and no host logic is copied.
