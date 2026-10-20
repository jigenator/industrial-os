# pi-image-preview

A [Pi](https://pi.dev) extension for images you paste or drop into Pi's editor. A path to an image becomes a short `[image N]` label and shows a small preview above the editor. When you submit, Pi gets the image itself, attached to the message, and the message text keeps a path to a copy saved beside the session.

Status: new, unpublished. Offline tests run against the pinned Pi 1.3.0 host and an isolated installed-Pi load check passes; rendering in an interactive Pi or Herdr terminal has **not** been checked. See [verification records](CONTRIBUTING.md#verification-records).

## Install

Use one filtered settings entry for industrial-os, as described in [Pi installation](../README.md#install):

```json
{
  "source": "git:github.com/jigenator/industrial-os",
  "extensions": ["pi/image-preview/src/index.ts"]
}
```

Merge this path into an existing industrial-os entry rather than adding a second source. For development use `pi install <industrial-os checkout>/pi/image-preview`. The extension needs only the host Pi packages; it does not import the design system.

## What it does

In Pi's interactive TUI, the editor is checked five times a second. An image path is any absolute or `~/` path to an existing PNG, JPEG, GIF or WebP file of at most 20 MB. That covers Pi's own Ctrl+V image paste (`…/pi-clipboard-<id>.png`), copied files, Finder drag-and-drop with `\ `-escaped spaces or quotes, and typed paths. Relative paths are not treated as images.

1. **Cache.** The file is copied by content hash to `<session dir>/<session file name>.images/<hash>.<ext>`, so the image outlives a temporary clipboard file and identical images are stored once. A session without a file (`--no-session`) uses the original path.
2. **Label.** The path in the draft becomes `[image N]`. N counts up for the whole Pi process and is never reused, so a recalled history entry with an old label still resolves until Pi exits.
3. **Preview.** Each image in the draft, labelled or not, is listed above the editor with its label, file name and size, followed by a thumbnail on terminals that can show images. The list disappears when the draft no longer holds any.
4. **Submit.** Each known label becomes its cached path, quoted if it contains whitespace, and the image is attached to the message. Image paths that were never relabelled are cached, rewritten and attached the same way. Images already attached by Pi or another extension are kept first. If you switched sessions, the image is copied into the current session's folder first.

The draft is left as typed in these cases:

- A bash draft (`!…`) or a slash command (`/name …`) keeps real paths, and labels already in it are turned back into paths, so a label never reaches the shell or a command. A draft that merely starts with an absolute path, such as a clipboard paste into an empty editor, is an ordinary message.
- After a large paste that Pi collapses into a `[paste #N …]` marker, the draft is not rewritten until the editor is emptied. Rewriting it would expand the marker for good. The preview and the attachment on submit still work, and the path stays visible.
- A file over 20 MB is not labelled, previewed or attached; a single warning says so. A label whose image can no longer be read, because its copy and source are gone or changed, is sent as its last known path without an attachment, with a warning.
- An `[image N]` this Pi process never assigned is plain text.

Only interactive submissions in the TUI are changed. RPC, print-mode and extension-sent messages are left alone.

## Storage and privacy

Images are copied into Pi's session folder next to the session's `.jsonl` file and kept there. Pi does not delete this `.images` folder when a session is deleted. A folder can also exist for a session that never got a message, because images are cached while you type. Attached images go to the main model provider with your message, as an image you attached any other way would. Pi resizes them first and may charge input tokens for them.

## Limitations

- Relabelling moves the editor cursor to the end of the draft, and Ctrl+- (undo) returns the path text.
- Large pastes made by another extension or by a right-click paste are not seen, so a collapsed paste from those sources can still be expanded by a rewrite.
- Previews follow the terminal's image support as Pi detects it; Pi's `/settings` option for hiding images does not apply to them. Herdr reports itself to Pi as Kitty-capable; this preview has not been checked in Herdr.
- Literal text such as `[image 3]` is replaced on submit if this process assigned label 3.

## Guides

- [Agent guide](AGENTS.md): rules and task routes.
- [Contributing](CONTRIBUTING.md): setup, exact checks and verification records.
- [Architecture](docs/architecture.md): modules, flows, state and host seams.
- [Conventions](docs/conventions.md): engineering rules and adoption gaps.
- [Design](docs/design.md): labels, preview layout, states and limits.
- [Mission](docs/mission.md): scope and non-goals.
