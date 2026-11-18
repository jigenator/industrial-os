# Engineering conventions

The [repository-wide conventions](../../docs/conventions.md) apply. This guide adds only this project's rules.

## Project profile

Herdr desktop app files: mods in plain JavaScript for herdr-app's gpui-kit runtime, a layout and a theme in JSON, checked with Node's test runner and `herdr-app check`. Scope reviewed: the whole project at the revision that added the mod, against Herdr app 0.1.15's documentation in `~/.config/herdr-app`.

## Rules

**A mod imports only inside its folder.** `main.js` may import the app's `gpui-kit`, `gpui-base` and `herdr` (and, for the Pi Reloader's guard socket, `net`; for the sidebar's drawings, `fs/promises`); everything else is a relative `./name.js` in the same folder. No repository paths and no npm packages: the folder is copied into `~/.config/herdr-app/mods/` as it is. Check: `test/industrial-os-layout.test.mjs`, `test/pi-reloader.test.mjs`.

**Rules live in pure modules.** Parsing, state, formats, the finished rule, aggregation, the missions, the map's world and frames, and every SVG drawing are plain modules with no `gpui-kit` or `herdr` import, so Node tests run them. `main.js` keeps only reading Herdr, remembered state, `git` lookups, writing drawings to files, commands and laying elements out. Check: the same test; review.

**Use only what the runtime has.** No `setTimeout`/`setInterval` (use `cx.timer`), no `Intl`, `TextDecoder` or `WebSocket`, no top-level `await`, and never keep a `cx` for later; each callback gets its own. Timers redraw only when something shown changes: the data clock when a shown age would, the mark clock while a moving mark is shown, the map's in its own nested view. Use native `frames` and `loop` for anything that only repeats. Check: the layout test rejects the missing globals; review for the rest.

**Unknown is never zero.** A missing, malformed or stale label value is unknown and shown as unknown (`??`, `--%` or absent), never as `00`, clean or a completion. One operator-chosen exception: the plate's droid count leaves unknown subagents out ([design](design.md#top)). Check: `test/industrial-os.test.mjs`.

**State is never color alone.** Codes, icons and marks (`*`, `●`, `#?`) carry every state; color only adds emphasis.

**Colors are theme names or design-system values.** The sidebar's state colors are `theme()` names, so they follow the selected theme; every other color and opacity is the design system's [sidebar vocabulary](../../design-system/foundation/README.md#sidebar-vocabulary). A mod cannot import a package, so `mods/industrial-os/vocabulary.js` and `marks/*.svg` are committed copies written by `node scripts/sync-vocabulary.mjs`; never edit them. A theme file restates design-system values (JSON cannot import), each checked against the package. A color the design system does not export is added there first. Check: `test/app-theme.test.mjs`, `test/industrial-os-sidebar.test.mjs` (the copies equal the design system); review the mod for hex values.

**Drawings are written to a hidden folder.** herdr-app draws blur, masks and patterns only from SVG files, so the pure modules return SVG documents and `main.js` writes each once to `mods/industrial-os/.gen/`, named by its content. The folder is hidden because saving a visible file in a mod's folder reloads the mod. Never commit it.

**Checks never touch a live Herdr.** Tests read files; `herdr-app check` loads the mod with in-memory state. Installing, `herdr-app do`, `layout.*` and `mod.*` commands change the running app and belong to an operator.

## Adoption gaps

| Gap | Next change | Verification |
| --- | --- | --- |
| The installed sidebar has been seen only at rest: no hover, click, rail, fold key or state change was checked there | Watch every state, the rail and the plate's aim in the live app | Manual; not run |
| The sidebar's values come from the design system, but it draws no design-system element: those are terminal cells | None planned; the mod is the only renderer of the sidebar vocabulary | Review |
| `herdr-app check` renders only the empty state with in-memory data | Keep it, and exercise populated rendering by hand or in the live app | Step 2 in [contributing](../CONTRIBUTING.md#validation-sequence) |
| No license, except `mods/pi-reloader/LICENSE` (MIT, keeping the notice of the code it was adapted from) | Resolve with the repository's open license decision | Review the folder |
| The Pi Reloader draws no design-system elements, like the sidebar | Decide its visual treatment with the sidebar's | Review, `herdr-app check`, live look |
