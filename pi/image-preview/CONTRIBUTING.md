# Contributing

Follow the [repository workflow](../../CONTRIBUTING.md) and [project guide](AGENTS.md).

## Toolchain and setup

Use Node.js 22.19+ and npm. The source is TypeScript ESM, run by Pi's loader and by Node type stripping in tests. TypeScript 5.9 checks `src/` and `test/` with strict NodeNext, no emit and `skipLibCheck`. The Pi development packages (`pi-coding-agent`, `pi-tui`, `pi-ai`) are pinned to **1.3.0**, the installed host version. No formatter, linter or build is declared.

Pi supplies the runtime peers. The extension has no runtime dependency and does not use the design system, so its own checks need only the install below. Loading the whole monorepo also follows [root setup](../../CONTRIBUTING.md#setup).

## Full validation sequence

Run from `pi/image-preview/`:

```sh
npm ci
npm run check
```

`check` runs `npm run typecheck` (`tsc --noEmit`), then `npm test` (`node --test test/*.test.ts`). Tests write only to temporary directories. `test/extension.test.ts` loads `src/index.ts` through the pinned host's real loader with a temporary agent directory and drives Pi's `ExtensionRunner` with a scripted editor, widget host and terminal input. `test/preview.test.ts` runs the pinned host's image resizer. No test calls a model or the network, or touches `~/.pi`.

Then check that the existing installed Pi loads the extension, from an empty temporary directory with a temporary agent directory:

```sh
echo '{"type":"get_commands","id":"1"}' | PI_CODING_AGENT_DIR=<temp agent dir> pi -e <checkout>/pi/image-preview/src/index.ts --mode rpc
```

It passes when it exits 0 with a `"success":true` response and nothing on stderr. The extension registers no commands, so the reply lists only built-in ones. A load failure exits 1 and prints `Failed to load extension`. The command makes no model call and changes no settings. For the whole-monorepo entry, use the local-clone install in [Pi contributing](../CONTRIBUTING.md#shared-toolchain-facts).

Finish with the [repository-wide checks](../../CONTRIBUTING.md#repository-wide-checks). Report automated, installed-Pi load and interactive evidence separately.

Interactive validation is separate. In a disposable Pi session in a Kitty-capable terminal and in Herdr, check:

- Ctrl+V of a screenshot, and of a copied file whose path contains spaces
- Finder drag-and-drop
- a typed `~/` path
- the label and caption, and the thumbnail size and its removal when the draft is emptied
- a `!` draft, and a large paste followed by an image
- history recall of a label
- `/new`, then submitting a recalled label
- the attached image reaching the model
- resizing the terminal

## Review and documentation

Trace text → `paths.ts` → `store.ts` → `draft.ts` → `index.ts` → `preview.ts`, and `input` → `submit.ts`, before changing shared behavior. On a host upgrade, bump the three development pins together and reread the [host seams](docs/architecture.md#host-seams), in particular the copied paste-collapse threshold. Update user behavior and limits in the README, flows and seams in architecture, presentation in design and engineering gaps in conventions; map any new guide here and at the root.

## Verification records

2026-10-20 initial version, macOS, Node 22.23.0, npm 10.9.8, installed Pi 1.3.0:

- `npm install` created the lockfile; `npm ci` from it then installed 119 packages with **0 vulnerabilities** and one deprecation warning for `node-domexception`, from the host's dependency tree.
- `npm run check`: passed. Strict typecheck clean, then **49/49 tests**, 0 failed, skipped or cancelled. They cover:
  - path detection: plain, `\ `-escaped, quoted, `~/`, unescaped spaces only when the file exists, punctuation, non-image extensions, relative paths and missing files
  - caching: name, dedupe and labels, no-session fallback, sniffed type, the size cap, and directory or non-image rejection
  - copies: session-switch re-copy and hash-mismatch refusal
  - rewrite rules: relabel; skipping and restoring in bash and commands; a leading absolute path counting as a message; collapsed-paste skip; the collapse threshold
  - submit: labels to paths; attachments with existing images kept first; unlabelled paths; unmapped labels, unreadable labels and too-large paths
  - widget: caption-only, `+N more`, narrow widths and control characters, the Kitty thumbnail row budget, and the real host resizer
  - integration: relabel, preview and clear; the bash draft; collapsed paste; interactive submit; RPC and extension sources untouched; RPC mode inert; no session; cross-session re-copy; shutdown cleanup; one warning for a too-large file
- Installed-Pi load check above from an empty temporary directory: exit 0, `"success":true`, empty stderr. As a control, the same command on a temporary extension importing a missing module exited 1 with `Failed to load extension`. In the installed bundle, `resizeImage`, `convertToPng` and `detectSupportedImageMimeTypeFromFile` are exported functions.
- Whole-monorepo local install: root `npm install` left the root lockfile unchanged, and the [root boundary checks](../../CONTRIBUTING.md#setup) passed. `pi install <worktree>` into a temporary agent directory exited 0. The RPC `get_commands` then exited 0 with empty stderr, listed `footer-motion`, `flag`, `pane-naming` and `recap` from the checkout, and returned no error lines.
- Interactive Pi and Herdr rendering, real clipboard and drag-and-drop input, the model receiving attachments, a pushed git-source install and other platforms: **not run**.

### Simplification pass

The full branch diff against `origin/main` was reviewed. Removed:

- an unused exported extension regex
- an unused `imagesDir` record field; a re-copy is decided by comparing the target path
- the unused size on the too-large result
- an exported test-only watch handle and poll-interval parameter; the watch now returns its stop function
- the eager thumbnail on ingest, so only the first three previews make thumbnails

Kept: polling, because Pi has no editor-change event; content sniffing and hash checks; and thumbnails rather than original images, to bound the Kitty data re-sent on repaint. The design system is not used, Pi theme tokens are, and no settings, commands or flags were added.
