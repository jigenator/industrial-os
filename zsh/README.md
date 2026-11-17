# Industrial OS zsh prompt

A minimal Acid / Black prompt for zsh 5.9 in a truecolor terminal. Automated checks pass; live Herdr and a real oh-my-zsh load have not been checked.

## Install

From the repository root, link the theme into oh-my-zsh's custom themes directory:

```sh
mkdir -p "${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes"
ln -s "$PWD/zsh/industrial-os.zsh-theme" "${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/industrial-os.zsh-theme"
```

In `~/.zshrc`, before loading oh-my-zsh:

```zsh
ZSH_THEME="industrial-os"
```

Start a new shell.

Without oh-my-zsh, source `zsh/industrial-os.zsh-theme` from this checkout in plain zsh. No runtime Node dependency or plugin is needed; Git is optional. Do not load another prompt theme alongside it. To uninstall, remove the source/theme selection and symlink, then start a new shell.

## Preview and limits

From the repository root, `zsh -f zsh/examples/states.zsh` prints every state using temporary repositories. See [contributing](CONTRIBUTING.md#specimen) for the machine-readable output and exact checks.

Paths wrap naturally; no truncation, animation, SSH/host, virtualenv, or runtime-version segments. Git status is synchronous and may delay large repositories. Truecolor and the illustrated Unicode glyphs are required; no ASCII/256-color fallback is claimed. The prompt does not set the terminal background: use a black terminal theme.

[Design](docs/design.md) defines states/layout; [architecture](docs/architecture.md) owns seams; [conventions](docs/conventions.md) and [agent guide](AGENTS.md) route changes. No project license has been selected.
