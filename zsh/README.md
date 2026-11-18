# Industrial OS zsh prompt

An Acid / Black [oh-my-posh](https://ohmyposh.dev) prompt for zsh 5.9 in a truecolor terminal. Automated checks pass against oh-my-posh 29.10, and the operator has used it in a live terminal; resizing and contrast have not been checked.

## Install

Requires oh-my-posh 29.10 or later on `PATH`. In `~/.zshrc`, after any oh-my-zsh load and instead of any other prompt theme, using this checkout's absolute path:

```zsh
eval "$(oh-my-posh init zsh --config /path/to/industrial-os/zsh/industrial-os.omp.json)"
```

If oh-my-zsh is loaded too, set `ZSH_THEME=""` so it draws no prompt of its own. Start a new shell. To uninstall, remove the `--config` argument (or the line) and start a new shell.

## What it shows

Left: SSH user@host (remote sessions only), a root marker, the full path, Git (upstream icon, branch, ahead/behind, `clean`/`modified` with file counts) and the input mark, with `✕ <code>` after a failed command. Right: the clock, plus a Node, Go or Python icon when the folder has their project files. Prompts you have already run shrink to the folder name; multi-line input continues after a grey `››`. [Design](docs/design.md) has every state.

## Preview and limits

From the repository root, `zsh -f zsh/examples/states.zsh` prints every state using temporary repositories. See [contributing](CONTRIBUTING.md#specimen) for the machine-readable output and exact checks.

Paths wrap naturally; no truncation or animation. Git status is fetched by oh-my-posh synchronously and may delay large repositories. Truecolor, the illustrated Unicode glyphs and a Nerd Font (upstream and language icons) are required; no ASCII/256-color fallback is claimed. The prompt does not set the terminal background: use a black terminal theme.

[Design](docs/design.md) defines states/layout; [architecture](docs/architecture.md) owns seams; [conventions](docs/conventions.md) and [agent guide](AGENTS.md) route changes. No project license has been selected.
