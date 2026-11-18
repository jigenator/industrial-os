# Architecture

`industrial-os.omp.json` is the public entry point: an oh-my-posh 29.10 config (schema version 4) passed to `oh-my-posh init zsh --config`. oh-my-posh renders every prompt and runs Git; the config holds no shell code. No build, manifest, runtime package or import from another project. Node checks alone import the design-system palette by its exported package name.

## Flow and invariants

- oh-my-posh's zsh init adds its own precmd hook. Each prompt it runs `oh-my-posh print`, which reads the exit code, PWD and Git, then sets `PS1`/`RPROMPT`. On submit it evaluates the transient prompt.
- The `git` segment runs `git status --no-optional-locks --porcelain=2 --branch` with the untracked/submodule modes from [design](design.md#left-prompt). 29.10 fetches status and the upstream icon only when `fetch_status` and `fetch_upstream_icon` are set. Status failure leaves `.HEAD` empty, which the template renders as `status unavailable`.
- Untrusted text: oh-my-posh unsets `prompt_subst` and `prompt_bang`, sets `prompt_percent`, escapes `%` in rendered text and quotes the transient prompt it evaluates. Templates add only literals and segment fields; never build shell syntax in a template.
- oh-my-posh caches the loaded config per shell session (`POSH_SESSION_ID`) under `HOME`, so a changed config needs a new shell, and checks run with a fresh `HOME` and no `POSH_` variables.

## Evidence and evolution

`test/render.test.mjs` drives real zsh, oh-my-posh's own init and isolated Git repositories. `examples/states.zsh` uses `oh-my-posh print primary` and faults only Git status through an isolated executable wrapper for the unavailable state. Fixed commit identity/date keep the detached SHA deterministic.

The only shared-code exception is mirrored palette roles because the JSON cannot import JavaScript; see the root [adoption gap](../../docs/conventions.md#adoption-gaps). Keep the prompt in the config, specimen changes in `examples/`, and checks in `test/`. Option names follow oh-my-posh 29.10; check the installed version's behavior before relying on newer documentation.
