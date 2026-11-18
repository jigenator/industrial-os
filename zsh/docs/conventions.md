# Conventions

Follow [repository conventions](../../docs/conventions.md). The prompt is one oh-my-posh JSON config, checked with oh-my-posh 29.10 and zsh 5.9; tests use Node 22's standard library and Git. The specimen is zsh with `emulate -LR zsh`. No dependency beyond oh-my-posh and no build step.

Keep palette literals once in the config's `palette`, keyed by design-system role, and refer to them as `p:<role>`. `test/palette.test.mjs` checks both role/value equality and absence of other hex literals.

Templates use only literals and segment fields; never assemble shell syntax. Git failures must never produce `clean`. Keep Git status settings explicit (`untracked_modes`, `ignore_submodules`) rather than relying on oh-my-posh defaults.

Checks create and remove their own temporary repositories, run with a fresh `HOME` and no `POSH_`/`GIT_` variables, and disable user/global Git configuration and hooks. Never test by changing a person's repository or shell configuration. Automated ANSI evidence does not prove Herdr font alignment, resizing or a real interactive startup; record these separately in [contributing](../CONTRIBUTING.md).
