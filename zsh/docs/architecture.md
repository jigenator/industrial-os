# Architecture

`industrial-os.zsh-theme` is the public entry point: source directly or through oh-my-zsh's theme loader. It needs zsh 5.9 and Git for repository information. No build, manifest, runtime package, network, file write, or import from another project. Node checks alone import the design-system palette by its exported package name.

## Flow and invariants

- `_ios_precmd` captures `$?` first, collects data and renders.
- `_ios_collect` reads PWD/HOME and synchronous Git discovery, branch/revision, and status. No optional locks or fsmonitor command; status semantics match the collector as described in [design](design.md#states).
- `_ios_escape` replaces controls/bidi overrides and doubles percent signs. `_ios_render` lays out the escaped snapshot plus exit status. `PROMPT` holds only a reference to the rendered variable: zsh's nonrecursive expansion prevents directory/ref text becoming shell code even with `prompt_subst` enabled. Never interpolate the rendered text directly into PROMPT.
- The precmd hook uses `add-zsh-hook`, retaining other hooks and avoiding duplicate registrations on re-source. The theme sets `PROMPT` and enables `prompt_subst`/`prompt_percent`, disabling `prompt_bang`.

## Evidence and evolution

`test/render.test.mjs` drives real zsh and isolated Git repositories. `examples/states.zsh` uses the real collector/renderer and faults only Git status through an isolated executable wrapper for the unavailable state. Fixed commit identity/date keep the detached SHA deterministic.

The only shared-code exception is mirrored palette roles because zsh cannot import JavaScript; see the root [adoption gap](../../docs/conventions.md#adoption-gaps). Keep runtime changes here, specimen changes in `examples/`, and checks in `test/`. If synchronous status proves slow on measured repositories, revisit async collection; do not add it speculatively.
