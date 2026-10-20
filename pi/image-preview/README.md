# pi-image-preview

A [Pi](https://pi.dev) extension that shows a preview above the editor when the draft holds a path to an image file. It only reads the editor: the draft, what you submit and how Pi sends it stay exactly as Pi makes them.

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

In Pi's interactive TUI the editor text is read five times a second and checked again whenever it changes. An image path is an absolute or `~/` path to an existing regular file of at most 20 MB whose content is PNG, JPEG, GIF or WebP. That covers Pi's Ctrl+V clipboard paths (`…/pi-clipboard-<id>.png`), copied files, drag-and-drop with `\ `-escaped spaces or quotes, and typed paths. Relative paths and URLs are not checked.

Each image in the draft is shown above the editor as its file name and size with a thumbnail of up to 12 rows by 80 columns below it. With Kitty graphics, as in Herdr, the previews sit side by side until the next one would pass the right edge; the rest are counted on a `+N more` line below the thumbnails. Other terminals list at most three, one under another, then `+N more`. The preview disappears when the draft no longer names an image, and when the session ends or is replaced.

The extension adds no commands, keys, settings or files, and makes no network or model calls.

## Limitations

- A preview appears up to 200 ms after the path does. A file that appears or changes on disk while the draft stays the same is not rechecked until the draft changes.
- Thumbnails follow the terminal's image support as Pi detects it. Inside Herdr, Pi detects Kitty graphics; under tmux or in a terminal without an image protocol, only the caption is shown. In Pi's default fullscreen mode, Pi keeps only the first image on a row uploaded to the terminal; the others are re-sent whenever that row is redrawn. Pi's `/settings` option for hiding images does not apply to the preview, because Pi does not expose it to extensions.
- At most 256 candidate paths are checked per draft, in reading order. A path is found only if it is at most 4,096 characters long and has fewer than eight places before it, on its line, where a space, quote or bracket is followed by `/`.

## Guides

- [Agent guide](AGENTS.md): rules and task routes.
- [Contributing](CONTRIBUTING.md): setup, exact checks and verification records.
- [Architecture](docs/architecture.md): modules, flow and host seams.
- [Conventions](docs/conventions.md): engineering rules and adoption gaps.
- [Design](docs/design.md): preview layout and states.
- [Mission](docs/mission.md): scope and non-goals.
