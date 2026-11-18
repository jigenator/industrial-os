# Contributing

Follow the [root workflow](../CONTRIBUTING.md) and [project guide](AGENTS.md).

## Setup and validation

Requires oh-my-posh 29.10, zsh 5.9, Git, and Node.js 22 for standard-library checks. The palette check uses the root-linked design-system package ([root setup](../CONTRIBUTING.md#setup)); the config itself needs no install/build dependency. From the repository root:

```sh
oh-my-posh version
zsh --version
node --version
node -e 'JSON.parse(require("fs").readFileSync("zsh/industrial-os.omp.json", "utf8"))'
zsh -n zsh/examples/states.zsh
(cd zsh && node --test)
```

Palette checks reject role drift and extra hex literals. Render tests check all six specimen states, truecolor, exit capture through oh-my-posh's init hook, dirty semantics (unstaged, staged, untracked, submodule) with counts, ignored files, unborn branches, ahead/behind, the right and secondary prompts, and literal malicious branch/directory names in the primary and transient prompts. Git forbids spaces in refs, so the real malicious ref uses `$(touch${IFS}pwned)`; the malicious directory tests the exact `$(touch pwned)` spelling too. Backticks and `%F{red}` are covered in both.

Manually render in a temporary Git repository, without writing user configuration (from the repository root):

```sh
config="$PWD/zsh/industrial-os.omp.json"
root=$(mktemp -d)
(
  cd "$root" || exit
  GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null git init -q -b main --template=
  env -u POSH_SESSION_ID HOME="$root/.home" CONFIG="$config" zsh -f -c 'for code in 0 42; do print -P -- "$(oh-my-posh print primary --config "$CONFIG" --shell zsh --pwd "$PWD" --status $code)"; done'
)
rm -rf -- "$root"
```

Finish with the [repository-wide checks](../CONTRIBUTING.md#repository-wide-checks). Before claiming real integration, use the README's install procedure with permission and verify a new shell in Herdr: Nerd Font and Unicode glyphs, narrow wrapping, Git states, failure text and the transient prompt. Automated `print -P` output is not that interactive check.

## Specimen

From the repository root:

```sh
zsh -f zsh/examples/states.zsh
zsh -f zsh/examples/states.zsh --machine
```

Both render the real config with `oh-my-posh print primary` against temporary Git repositories and remove them on exit. They do not source shell configuration, use a live oh-my-posh session or change existing repositories. The unavailable state faults only status through a temporary Git wrapper. Commit identity/date are fixed for a deterministic detached SHA.

Default output has labelled `--- <state> / PROMPT ---` sections with real ANSI. Machine output has **six records**, each two UTF-8 NUL-terminated fields: `state`, raw ANSI-expanded `PROMPT`. Prompts retain their trailing input space. Order: `clean`, `modified`, `detached`, `unavailable`, `no-git`, `failed`. There is no JSON/escaping layer; split bytes on NUL.

## Verification record

2026-11-18, macOS, oh-my-posh 29.10.0, zsh 5.9, Apple Git, Node 22:

- Config JSON parse, specimen syntax check and Node tests: **12/12 passed**. Earlier runs found that 29.10 needs `fetch_status`/`fetch_upstream_icon` and that a shell's live oh-my-posh session overrides `--config`; both are handled.
- Both specimen modes: **passed**; machine output has six two-field records.
- Live use: installed with the README procedure; the operator confirmed the primary prompt (with the GitHub upstream icon) and the transient prompt in their terminal. Interactive resizing, contrast and the right prompt: **not checked**. Large-repository latency not benchmarked; no ASCII/256-color fallback tested.
