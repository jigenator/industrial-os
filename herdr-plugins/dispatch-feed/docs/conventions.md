# Conventions

The [root conventions](../../../docs/conventions.md) apply. Bun 1.4.4 runs strict
TypeScript directly; exact development pins and the generated `bun.lock` live
here. No runtime dependency, Effect, build bundle or copied collector DTO exists.
The plugin's decoder is a deliberately local consumer contract, not an export of
the engine's internal model. Keep new consumed fields validated at that boundary.

Pure rendering takes state, dimensions and time; controller owns state; terminal
and transport own effects and cleanup. Use existing exported design-system pieces
before adding local layout code. Never copy literal colors into this plugin.
Printable ASCII display follows foundation; structural glyphs are curated there.

Test observable behavior and failures, not private component structure. Fake
socket tests and PTY scripts must override every inherited service target. Tests
never spawn the actual `open` helper or access a clipboard. Keep screenshots,
HTML visual harnesses, private wire data and scratch notes outside the repository.
No lint suppressions, unsafe any or broader dependencies are needed.

Checks and honest evidence belong in [contributing](../CONTRIBUTING.md). There is
no CI, Windows/Linux support, published license or universal terminal claim.
