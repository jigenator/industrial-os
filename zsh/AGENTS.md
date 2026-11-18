# Agent guide

Purpose: the Acid / Black shell prompt, an oh-my-posh config. Supplements the [root guide](../AGENTS.md).

## Rules and routes

- Start with [architecture](docs/architecture.md) for oh-my-posh seams; [design](docs/design.md) for visible behavior; [conventions](docs/conventions.md) for config/security. Validate with [contributing](CONTRIBUTING.md), then the root checks.
- Keep the whole prompt in `industrial-os.omp.json`; there is no shell code of its own. No installs or user configuration writes from tests.
- Git and path text is untrusted: rely on oh-my-posh's zsh escaping, never on a template that builds shell syntax, and keep the injection test for the primary and transient prompts.
- Mirror only design-system roles; update palette/render tests with changes. Do not add segments without approval.

## Placement

`test/palette.test.mjs` checks the package by exported name. `test/render.test.mjs` checks state/layout/security through oh-my-posh and real zsh. `examples/states.zsh` supplies deterministic real-repository specimens. Install instructions live only in [README](README.md); exact commands and evidence in contributing. `CLAUDE.md` imports this guide.
