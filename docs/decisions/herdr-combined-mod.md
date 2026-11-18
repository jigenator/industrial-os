# The Herdr mods become one mod, with shared parts and a storybook

Status: current. It came in two changes, both in: first the sidebar's parts and the storybook, inside `herdr/mods/industrial-os/`; then the `droid-plate` and `pi-reloader` mods, moved into the same mod as `plate/` and `reloader/`. Date: 2026-11-18; chosen by the maintainer.

## Problem

Everything the sidebar draws was code inside one 979-line `main.js`: nothing could be looked at alone, and no other mod could draw a pane row or a key plate without redrawing it. The maintainer wants each visual part reusable with a contract, a storybook that shows every part in its states, and no copies.

A herdr-app mod can import only the app's own modules and files inside its own folder. Checked with `herdr-app check` on throwaway mods, herdr-app 0.1.16:

- A file two folders deep inside a mod can import `gpui-kit`, `gpui-base` and `herdr`, and the mod's other files.
- A relative path into another mod, a home-relative path, an absolute path and a symlinked folder are each refused: "resolves outside the application directory".
- A bare package name is refused: "an application may otherwise import only its own files". A symlinked `node_modules` entry is refused too.

So two mods cannot share a file, and herdr-app 0.1.16 has no way for one mod to depend on another.

## Choice

**One mod, `industrial-os`, holds everything Industrial OS draws in Herdr desktop, and its parts are shared by plain imports.**

- **Parts** are files in `mods/industrial-os/parts/`. Each imports `gpui-kit` itself, as `main.js` and Herdr's shipped mods do, takes its data as arguments and returns elements. Its contract is the comment above its export. The index is [herdr/docs/parts.md](../../herdr/docs/parts.md).
- **The storybook** is a view of the same mod, chosen by the prop `part: "storybook"`, so it draws the real parts in the real app. The mod opens it as a window itself with `openOverlay`, on the named command `industrial-os.storybook`. One mod may open any number of overlays this way; only `mod.open` is limited to the single window `mod.json` describes (checked in an isolated app: two windows, a dialog and the `mod.json` window open at once).
- **Stories use invented data** (`sample.js`), never the live window, and their handlers do nothing.
- **A stand-in for the app's modules** (`herdr/stand-in/`) lets Node load the drawing code, so tests can require a story for every part and render every story. The refactor itself was checked on it: 1754 rendered trees of a scripted session, equal before and after.

The second change moved the other two mods in, each as one more form of the same mod:

| Piece | Form in the combined mod | Files |
| --- | --- | --- |
| Sidebar | `part: "top"`, the list (no prop) and `part: "bottom"` | `main.js`, the pure modules beside it, `parts/` |
| Pane header (`droid-plate`) | `part: "plate"`, named by the layout's pane frame | `plate/`, with the mod's `ds/` copy |
| Pi Reloader | The `mod.json` window, `part: "reloader"`, on `mod.open:industrial-os`, so its key works in any layout | `reloader/` |
| Storybook | `part: "storybook"`, opened by the mod | `storybook.js`, `stories.js`, `sample.js` |

- **One root view.** Herdr gives a mod one view class (`main.js`'s default export). For `part: "plate"` and `"reloader"` it makes that piece's view with `new` and hands it `init`, `render` and Herdr's `close`; the inner view's timers, tasks, focus and commands run through the root's `cx`. Checked in an isolated app before the move, on herdr-app 0.1.16; Herdr's documents do not promise it.
- **Each piece keeps its folder.** `plate/` and `reloader/` are a `view.js` and pure modules, moved as they were: they import nothing of the sidebar's but the mod's folder name, and no part imports them. They share nothing yet; the point of one mod is that they now can, by a plain import.
- **Commands carry the piece's name.** Every copy of a mod on screen hears every command of that mod, so the Pi Reloader's `reload`, `reset` and `close` became `reloader-reload`, `reloader-reset` and `reloader-close`: a sidebar or pane-header copy can never take one for its own, and nothing else starts a reload.

## Alternatives

- **One source in `herdr/parts/`, copied into each mod by a script, with a byte-equality test** (the [`ds/` pattern](herdr-mod-design-system-copy.md)). It keeps three mods, but the maintainer finds the copies confusing, and every part would exist three times.
- **Parts that take the kit as an argument** instead of importing it. It would let Node load a part without a stand-in, but every call site passes one more thing and no shipped mod is written that way.
- **A storybook as a web page** drawing the stand-in's trees. It runs without Herdr, but shows a browser's rendering, not the app's: fonts, clipping, SVG drawings and native motion are what a storybook is for.
- **Put the parts in the design system.** They are gpui-kit code, and the design system is standard library only with terminal lines as its output; its values already reach the sidebar through the vocabulary.

## Consequences

- `main.js` is about half its size and keeps only reading Herdr, remembered state, commands and placement.
- The import rule changes from "`main.js` alone imports the app" to "the files that draw do": `main.js`, `storybook.js`, `stories.js` and `parts/`. Pure modules stay pure, and one file, `parts/drawings.js`, writes files. `test/industrial-os-layout.test.mjs` checks all of it.
- The storybook ships inside the installed mod: about 450 lines that load with the sidebar and do nothing until shown.
- Saving any file of the installed mod reloads every copy of it: the pane headers restart, and a Pi Reloader run is interrupted (a reset stopped between quitting Pi and resuming it needs `pi --session <file>` by hand). An install is done with no run going.
- The safety checks that were "this mod never opens a socket" and "this mod never writes a file" are now "only `reloader/view.js` imports `net`" and "only `parts/drawings.js` imports `fs/promises`", over every import and re-export in the mod, with `import()` refused.
- `herdr-app check mods/industrial-os` draws only the sidebar's list, since it passes no props. `herdr/scripts/check-droid-plate.mjs` draws the pane header's states and the Pi Reloader's empty window in the app's runtime, on temporary copies whose root is that piece.
- A pane with a plain shell now loads the whole mod for its header, the sidebar's and storybook's code included, unused. The header's own work per frame is unchanged.
- The second change renamed what is installed: the operator's `mods/droid-plate` and `mods/pi-reloader` folders go, the layout's pane header becomes `industrial-os` with `part: "plate"`, and `mod.open:pi-reloader` in `keys.json` becomes `mod.open:industrial-os`, in one step, by the operator ([upgrading](../../herdr/README.md#upgrading-from-three-mods)). The label `io.droid-plate.v1` and the guard's `io.pi-reloader.v2` keep their names: they are contracts with Pi's extensions, not mod names.

## Revisit when

Herdr lets one mod import another's files, or installs shared modules. Then the parts can become their own package and the mods can separate again.
