# Industrial OS Pi extensions

Pi extensions that carry the Industrial OS visual and interaction language into the [Pi](https://github.com/earendil-works/pi) coding agent. They follow the design system's [visual language](../design-system/docs/design.md).

## Status

One extension is here:

- [claude-interrupt](claude-interrupt/README.md): press Esc while Pi works and it aborts the response and continues with your queued text, marking the continuation with an animated **DIRECTIVE UPDATED** plate. It moved here from `jigenator/pi-claude-interrupt` with its full history.

Other extensions are planned to follow. No Pi configuration lives here yet.

Each extension is its own Pi package, with its own `package.json`, dependencies, checks, and license. None is published to npm. Install one from a local checkout of this repository, as its README describes.

## Start here

- [Agent guide](AGENTS.md): rules and placement for Pi extensions.
- [Contributing](CONTRIBUTING.md): setup, checks, and verification records.
- [Design](../design-system/docs/design.md): the visual language the extensions follow.
