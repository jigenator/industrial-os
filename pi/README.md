# Industrial OS Pi extensions

Pi extensions that carry the Industrial OS visual and interaction language into the [Pi](https://github.com/earendil-works/pi) coding agent. They follow the repository's [design](../docs/design.md). Each extension is its own project with its own README, guides, checks, and license.

## Extensions

- [claude-interrupt](claude-interrupt/README.md): press Esc while Pi works and it aborts the response and continues with your queued text, marking the continuation with an animated **DIRECTIVE UPDATED** plate.
- [status-bar](status-bar/README.md): replaces Pi's footer with a framed Acid / Black instrument panel that shows the agent-reported active project and branch, where Pi's tools run, context use, model, and other extensions' statuses. It is the first implementation of the style.

No Pi configuration lives here yet.

None of the extensions is published to npm. Install one from a local checkout of this repository, as its README describes.

## Guides

- [Pi agent guide](AGENTS.md): the rules every extension shares.
- [Contributing](CONTRIBUTING.md): shared toolchain facts and how to move an extension in.
