# Engineering conventions

The [repository-wide conventions](../../docs/conventions.md) apply. This guide adds only this project's rules.

## Project profile

Herdr desktop app files: a mod in plain JavaScript for herdr-app's gpui-kit runtime, a layout and a theme in JSON, checked with Node's test runner and `herdr-app check`. Scope reviewed: the whole project at the revision that added the mod, against Herdr app 0.1.15's documentation in `~/.config/herdr-app`.

## Rules

**A mod imports only inside its folder.** `main.js` may import the app's `gpui-kit`, `gpui-base` and `herdr`; everything else is a relative `./name.js` in the same folder. No repository paths and no npm packages: the folder is copied into `~/.config/herdr-app/mods/` as it is. Check: `test/industrial-os-layout.test.mjs`.

**Rules live in pure modules.** Parsing, state, formats, decay, the finished rule and aggregation are plain modules with no `gpui-kit` or `herdr` import, so Node tests run them. `main.js` keeps only reading Herdr, remembered state, `git` lookups, commands and drawing. Check: the same test; review.

**Use only what the runtime has.** No `setTimeout`/`setInterval` (use `cx.timer`), no `Intl`, `TextDecoder` or `WebSocket`, no top-level `await`, and never keep a `cx` for later; each callback gets its own. Timers are for data and redraw only when shown text changes. Check: the layout test rejects the missing globals; review for the rest.

**Unknown is never zero.** A missing, malformed or stale label value is unknown and shown as unknown (`??`, `--%` or absent), never as `00`, clean or a completion. Check: `test/industrial-os.test.mjs`.

**State is never color alone.** Codes, icons and marks (`*`, `●`, `#?`) carry every state; color only adds emphasis.

**Colors are theme names or design-system values.** The mod uses `theme()` names only, so it follows the selected theme. A theme file restates design-system values (JSON cannot import), each checked against the package. A color the design system does not export is added there first. Check: `test/app-theme.test.mjs`; review the mod for hex values.

**Checks never touch a live Herdr.** Tests read files; `herdr-app check` loads the mod with in-memory state. Installing, `herdr-app do`, `layout.*` and `mod.*` commands change the running app and belong to an operator.

## Adoption gaps

| Gap | Next change | Verification |
| --- | --- | --- |
| The sidebar's visual design is deferred, and it draws no design-system elements | Decide the layout and treatment, then bring the design-system elements into the mod folder in a way the rule allows | Review, `herdr-app check`, live look |
| No live record of the sidebar in the app | Install as in the README, switch layout and watch every state | Manual; not run |
| `herdr-app check` renders only the empty state with in-memory data | Keep it, and exercise populated rendering by hand or in the live app | Step 2 in [contributing](../CONTRIBUTING.md#validation-sequence) |
| No license | Resolve with the repository's open license decision | Review the folder |
