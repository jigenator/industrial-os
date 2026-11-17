# Conventions

Follow [repository conventions](../../docs/conventions.md). Runtime code is zsh, checked on 5.9; tests use Node 22's standard library and Git. Functions localize shell behavior with `emulate -L zsh`. Private names use `_ios_`; sourcing the theme is the public interface. No dependency or build step is needed for the theme.

Keep palette literals once in `_ios_colors`, keyed by design-system role. `test/palette.test.mjs` checks both role/value equality and absence of other hex literals.

Validate display data at collection, not by evaluating it. No `eval`, recursive expansion flags, raw terminal escapes in user text, or direct interpolation of untrusted text into prompt source. Preserve Unicode other than controls and bidi overrides. Git failures must never produce `clean`. Keep Git reads synchronous/read-only, with `--no-optional-locks`.

Checks create and remove their own temporary repositories and disable user/global Git configuration and hooks. Never test by changing a person's repository or shell configuration. Automated ANSI evidence does not prove Herdr font alignment, resizing or a real oh-my-zsh startup; record these separately in [contributing](../CONTRIBUTING.md).
