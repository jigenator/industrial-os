# Engineering conventions

The [repository-wide conventions](../../docs/conventions.md) apply. This guide adds only this project's rules.

## Project profile

Hand-merged Herdr configuration in TOML, checked with Node's test runner. Scope reviewed: the whole project at the revision that added it, and Herdr 0.9.3's configuration reference and config sources.

## Rules

**Each file is a complete, valid Herdr config by itself.** Herdr has no includes, so a fragment must parse alone and merge by table. Check: `herdr config check` on the file.

**Colors are design-system values with their role in a comment.** TOML cannot import, so a color is restated as its lowercase `#rrggbb` value, and the check proves it is an exported palette or signal color. A color the design system does not export is added there first. Check: `test/sidebar.test.mjs`.

**Tokens come from the contract.** An agents row references only keys in [the token contract](../../pi/herdr-sidebar/docs/token-contract.md), and every key has exactly one entry. Check: `test/sidebar.test.mjs`.

Spaces rows follow [the Spaces contract](../../herdr-plugins/spaces/docs/token-contract.md), checked by `test/spaces.test.mjs`; built-in state_icon/git_status remain host-owned.

**State is never color alone.** A rule may color a token by its text, but the text itself must carry the state, as the contract's codes do.

**Checks never touch a live Herdr.** They read files, and the parser check uses `HERDR_CONFIG_PATH` on a file in the checkout or a temporary copy.

## Adoption gaps

| Gap | Next change | Verification |
| --- | --- | --- |
| No interactive record of this file in Herdr | Merge, reload and watch the states listed in [design](design.md) | Manual; not run |
| The parser check needs an installed Herdr and is not part of `node --test` | Keep it a separate, read-only step | Step 2 in [contributing](../CONTRIBUTING.md#validation-sequence) |
| No license | Resolve with the repository's open license decision | Review the folder |
