# Industrial OS Pi extensions

Pi extensions that carry the Industrial OS visual and interaction language into the [Pi](https://github.com/earendil-works/pi) coding agent. They follow the repository's [design](../docs/design.md). Each extension is its own project with its own README, guides, checks, and license.

## Extensions

- [claude-interrupt](claude-interrupt/README.md): press Esc while Pi works and it aborts the response and continues with your queued text, marking the continuation with an animated **DIRECTIVE UPDATED** plate.
- [signals-collector](signals-collector/README.md): one TUI session signal source for displays, including a machine-wide private parsed quota cache; owns the display-only Active tool, never a renderer.
- [status-bar](status-bar/README.md): replaces Pi's footer with a framed Acid / Black instrument panel that shows the agent-reported active project and branch, where Pi's tools run, context use, model, and other extensions' statuses. It is the first implementation of the style.
- [herdr-sidebar](herdr-sidebar/README.md): reports this session's state, project, context, model and current activity to Herdr's agents sidebar, drawn by the rows in [herdr/](../herdr/README.md).
- [herdr-pane-naming](herdr-pane-naming/README.md): names only its own inherited Herdr pane from delivered user text and assistant activity, using TypeSafe/Jev and a title model; main TUI only.
- [session-recap](session-recap/README.md): UI-only brief away recaps and manual detailed active-branch recaps through a separate model; TUI only.
- [image-preview](image-preview/README.md): previews image files whose paths are in the editor, above the editor, without changing the draft or the message; TUI only.
- [droid-header](droid-header/README.md): replaces Pi's startup header with the Acid / Black droid details panel: this session's droid ID, model, Herdr pane, project and branch, and a manifest of what Pi's settings load; TUI only.
- [theme](theme/README.md): the `industrial-os` Pi theme, Acid / Black neutrals with a bone editor border; a theme file, not an extension.

None of the extensions is published to npm.

## Install

The repository root holds a `package.json` whose `pi.extensions` lists every extension's entry point, so Pi can install them from git. It also links the in-repo design system and installs pane naming's pi-typesafe dependency under [a specific exception](../docs/decisions/pane-naming-root-dependency.md); Pi's git install runs `npm install --omit=dev --legacy-peer-deps` in the clone root. Root `.npmrc` keeps ordinary checkout setup from installing duplicate host peers too. Pi identifies a git package by its repository URL, so use one settings entry for this repository and select the extensions you want with its `extensions` filter, in the `packages` array of Pi's `settings.json`:

```json
{
  "source": "git:github.com/jigenator/industrial-os",
  "extensions": ["pi/claude-interrupt/src/index.ts", "pi/signals-collector/src/extension.ts", "pi/status-bar/src/extension.ts"]
}
```

Omit `extensions` to load every extension, or list a subset. The root `pi.themes` also provides the [Pi theme](theme/README.md); an `extensions` filter does not hide it, `"themes": []` does. Without a ref the entry follows `main`; `pi update --extensions` pulls it. `pi install git:github.com/jigenator/industrial-os` adds the unfiltered entry. Each extension's README names its entry point and any load-order needs. Include signals-collector when selecting status-bar for collected data; either order works, but a display without it truthfully shows unknown.

For development, install an extension from a local checkout instead, `pi install <industrial-os checkout>/pi/<name>`; Pi loads it from that path without copying it and installs nothing. The rendering extensions, claude-interrupt, status-bar and droid-header, import the design-system package; run `npm install` once at the checkout root first so the package is linked. Pane naming also needs that root setup for pi-typesafe; see [setup](../CONTRIBUTING.md#setup). Pi identifies a local package by its path and a git package by its URL, so configuring one extension from both sources loads it twice; use one.

## Recommended settings

[settings.json](settings.json) is the canonical set of Pi settings for Industrial OS, as one fragment to merge into Pi's own `settings.json` (`~/.pi/agent/settings.json` for every project). A setup script should apply this file rather than copy values from the READMEs. It holds:

- `packages`: the single industrial-os git entry, selecting every extension in the root manifest.
- `theme`: the [Pi theme](theme/README.md).
- `quietStartup`: what [droid-header](droid-header/README.md#install) needs to replace Pi's startup listing.
- `steeringMode` and `followUpMode`: `all`, so the next turn takes every queued steering or follow-up message, not one per turn (Pi's default is `one-at-a-time`).

Pi has no settings includes, so merge by hand:

1. Back up your `settings.json`.
2. Set the top-level keys from the fragment.
3. In `packages`, replace any existing `git:github.com/jigenator/industrial-os` entry with the fragment's entry. Do not add a second entry, and do not remove other packages. To load fewer extensions, delete paths from its `extensions` list.
4. Run `/reload` or restart Pi.

Check the fragment from the repository root with `node --test pi/settings.test.mjs`. The check compares the package entry with the root manifest, the theme with the theme file, and the values with those Pi 1.4.0 documents. When an extension is added, add its entry point here as well as to the root `package.json`.

## Guides

- [Pi agent guide](AGENTS.md): the rules every extension shares.
- [Contributing](CONTRIBUTING.md): shared toolchain facts and how to move an extension in.
