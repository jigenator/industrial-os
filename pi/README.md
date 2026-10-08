# Industrial OS Pi extensions

Pi extensions that carry the Industrial OS visual and interaction language into the [Pi](https://github.com/earendil-works/pi) coding agent. They follow the repository's [design](../docs/design.md). Each extension is its own project with its own README, guides, checks, and license.

## Extensions

- [claude-interrupt](claude-interrupt/README.md): press Esc while Pi works and it aborts the response and continues with your queued text, marking the continuation with an animated **DIRECTIVE UPDATED** plate.
- [status-bar](status-bar/README.md): replaces Pi's footer with a framed Acid / Black instrument panel that shows the agent-reported active project and branch, where Pi's tools run, context use, model, and other extensions' statuses. It is the first implementation of the style.
- [herdr-sidebar](herdr-sidebar/README.md): reports this session's state, project, context, model and current activity to Herdr's agents sidebar, drawn by the rows in [herdr/](../herdr/README.md).

No Pi configuration lives here yet.

None of the extensions is published to npm.

## Install

The repository root holds a `package.json` whose `pi.extensions` lists every extension's entry point, so Pi can install them from git. It also links the in-repo design-system package; Pi's git install runs `npm install` in the clone, which creates that link with no extra step. Pi identifies a git package by its repository URL, so use one settings entry for this repository and select the extensions you want with its `extensions` filter, in the `packages` array of Pi's `settings.json`:

```json
{
  "source": "git:github.com/jigenator/industrial-os",
  "extensions": ["pi/claude-interrupt/src/index.ts", "pi/status-bar/src/extension.ts"]
}
```

Omit `extensions` to load every extension, or list a subset. Without a ref the entry follows `main`; `pi update --extensions` pulls it. `pi install git:github.com/jigenator/industrial-os` adds the unfiltered entry. Each extension's README names its entry point and any load-order needs.

For development, install an extension from a local checkout instead, `pi install <industrial-os checkout>/pi/<name>`; Pi loads it from that path without copying it and installs nothing. claude-interrupt and status-bar import the design-system package; run `npm install` once at the checkout root first so the package is linked; see [setup](../CONTRIBUTING.md#setup). Pi identifies a local package by its path and a git package by its URL, so configuring one extension from both sources loads it twice; use one.

## Guides

- [Pi agent guide](AGENTS.md): the rules every extension shares.
- [Contributing](CONTRIBUTING.md): shared toolchain facts and how to move an extension in.
