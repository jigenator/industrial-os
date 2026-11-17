# Contributing

Follow the [root workflow](../CONTRIBUTING.md) and [project guide](AGENTS.md).

## Setup and validation

Requires zsh 5.9, Git, and Node.js 22 for standard-library checks. The palette check uses the root-linked design-system package ([root setup](../CONTRIBUTING.md#setup)); the theme itself needs no install/build dependency. From the repository root:

```sh
zsh --version
node --version
zsh -n zsh/industrial-os.zsh-theme
zsh -n zsh/examples/states.zsh
(cd zsh && node --test)
```

Palette checks reject role drift and extra hex literals. Render tests check all six states, truecolor, exit capture, hook deduplication/preservation, dirty semantics (including untracked files and submodules), unborn/ignored state, and literal malicious branch/directory names with `prompt_subst`. Git forbids spaces in refs, so the real malicious ref uses `$(touch${IFS}pwned)`; the malicious directory tests the exact `$(touch pwned)` spelling too. Backticks and `%F{red}` are covered in both.

Manually source in a clean zsh and temporary Git repository, without writing user configuration (from the repository root):

```sh
theme="$PWD/zsh/industrial-os.zsh-theme"
root=$(mktemp -d)
(
  cd "$root" || exit
  GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null git init -q -b main --template=
  THEME="$theme" zsh -f -c 'source "$THEME"; print -P -- "$PROMPT"; fail() { return 42; }; fail || _ios_precmd; print -P -- "$PROMPT"'
)
rm -rf -- "$root"
```

Finish with the [repository-wide checks](../CONTRIBUTING.md#repository-wide-checks). Before claiming real integration, use the README's install procedure with permission and verify an oh-my-zsh startup in Herdr: Unicode glyphs, narrow wrapping, Git states and failure text. Automated `print -P` output is not that interactive check.

## Specimen

From the repository root:

```sh
zsh -f zsh/examples/states.zsh
zsh -f zsh/examples/states.zsh --machine
```

Both use the real theme against temporary Git repositories and remove them on exit. They do not source shell configuration or change existing repositories. The unavailable state faults only status through a temporary Git wrapper. Commit identity/date are fixed for a deterministic detached SHA.

Default output has labelled `--- <state> / PROMPT ---` sections with real ANSI. Machine output has **six records**, each two UTF-8 NUL-terminated fields: `state`, raw ANSI-expanded `PROMPT`. Prompts retain their trailing input space. Order: `clean`, `modified`, `detached`, `unavailable`, `no-git`, `failed`. There is no JSON/escaping layer; split bytes on NUL.

## Verification record

2026-11-17, macOS, zsh 5.9 (arm64-apple-darwin26.0), Apple Git 2.54.0, Node 22.23.4:

- Syntax checks and Node tests: **13/13 passed**, covering the states and boundary/security checks above. An initial test run failed because the simplified injection test did not render its collected snapshot; fixed and rerun successfully.
- Manual direct source using the temporary-repository command above: **passed**, clean and failure ANSI emitted without diagnostics.
- Both specimen modes: **passed**; machine output has six two-field records, deterministic across consecutive runs.
- Root link/instruction inventory, Markdown targets/anchors, whitespace, publication review: **passed**. No staged files. Removed-interface grep: no matches in the project; the sole affected-root-doc match describes the unrelated design-system label-plate contract.
- Live Herdr, actual oh-my-zsh startup, interactive resizing/font/contrast checks: **not run**. No theme installation or user shell configuration changes made. Large-repository latency not benchmarked; no ASCII/256-color fallback tested. Root Mermaid diagram rendering: **not run**, no renderer found on PATH or in root node_modules.
