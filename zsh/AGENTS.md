# Agent guide

Purpose: the Acid / Black shell prompt. Supplements the [root guide](../AGENTS.md).

## Rules and routes

- Start with [architecture](docs/architecture.md) for hooks, collection or rendering; [design](docs/design.md) for visible behavior; [conventions](docs/conventions.md) for code/security. Validate with [contributing](CONTRIBUTING.md), then the root checks.
- Keep all runtime code in `industrial-os.zsh-theme`. Git is read-only with `--no-optional-locks`; no installs or user configuration writes from theme/tests.
- Prompt text is untrusted: collect, sanitize controls/bidi, escape `%`, and expand only through the nonrecursive prompt variable reference. Keep injection tests using real zsh with `prompt_subst`.
- Mirror only design-system roles; update palette/render tests with changes. Do not add async work or extra segments without approval.

## Placement

`test/palette.test.mjs` checks the package by exported name. `test/render.test.mjs` checks state/layout/security through zsh. `examples/states.zsh` supplies deterministic real-repository specimens. Install instructions live only in [README](README.md); exact commands and evidence in contributing. `CLAUDE.md` imports this guide.
