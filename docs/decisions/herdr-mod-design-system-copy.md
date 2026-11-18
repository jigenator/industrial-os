# A Herdr desktop mod carries a generated copy of the design system

Status: current. Date: 2026-11-17; approved by the maintainer with the droid-plate pane header, then a mod of its own. Since 2026-11-18 the pane header is the `plate/` folder of the one `industrial-os` mod ([decision](herdr-combined-mod.md)) and `ds/` is that mod's; the choice is unchanged. Adds one exception to the [module and dependency rule](../conventions.md#module-and-dependency-rules); the [package decision](in-repo-design-system-package.md) is otherwise unchanged.

## Problem

The approved sticky droid plate is a Herdr desktop pane header drawn from the design system's unit plate, status strip, keycap bay and motions. The design-system-first rule says a project imports those elements and never redraws them. A herdr-app mod, though, can import only `gpui-kit`, `gpui-base`, `herdr` (and `net`) and files inside its own folder, and the folder is copied into `~/.config/herdr-app/mods/` as it is (`~/.config/herdr-app/AGENTS.md`, "Mods"). It cannot resolve `@industrial-os/design-system` or a path outside the folder.

## Choice

The mod keeps a `ds/` folder that is a byte-for-byte copy of exactly the design-system files its pure modules import, plus everything those import, in the design system's own tree (`ds/elements/unit-plate/unit-plate.mjs`, …). Its pure modules import `ds/` paths (`../ds/…` from `plate/`); the files that draw import only the app's modules and the mod's own files, never `ds/`.

- `herdr/scripts/sync-design-system.mjs` (Node standard library) computes the import closure of every import that lands in a mod's `ds/`, from any folder of the mod, and rewrites `ds/`; `--check` reports missing, extra and changed files.
- `herdr/test/droid-plate.test.mjs` fails while `ds/` differs from the design system by a byte, or holds a file outside the closure.
- `ds/` is never edited. A change starts in `design-system/`, with its tests, README and story, then the sync, then the mod.
- Only design-system files that are already standard library only and free of host I/O are copied; the design system's own rule already guarantees that.

## Alternatives

- **Redraw the plate in the mod.** It would keep the import rule, but break the design-system-first rule and drift from the Pi droid header, which draws the same plate.
- **A bundler step that inlines the package.** It would produce one file, but adds a build tool and a dependency to a project that has none, and the output would be harder to compare with the source than a byte copy.
- **Symlink `ds/` to `design-system/`.** herdr-app copies or reads the folder in place; a symlink would break when the folder is copied, and Git would carry the link, not the files.
- **Install the mod from the repository path.** herdr-app loads mods only from its own configuration folder.

## Consequences

The repository holds a second copy of the design-system files the mod imports (22 on 2026-11-19) under `herdr/mods/industrial-os/ds/`; a design-system change that touches them makes `herdr/` tests fail until the sync runs, in the same change. Reviewers see the copied diff twice. The copy is this repository's own code, so it needs no notice. Since 2026-11-19 the sidebar's vocabulary comes through `ds/` too, and the same script writes the vocabulary's drawn marks into `marks/`: the older second script, `sync-vocabulary.mjs`, and its copy `vocabulary.js` are gone, so this is the mod's only generated copy.

## Revisit when

herdr-app lets a mod import a package or a path outside its folder, the design system gains a single-file build, or a second mod's copy grows large enough that review of the copied diff becomes a burden.
