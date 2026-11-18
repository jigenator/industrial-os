# Agent guide

Purpose: Industrial OS in the Herdr desktop app: the Acid / Black theme, the Industrial OS sidebar (a mod and its layout, drawn from shared parts that its storybook shows alone), the droid-plate pane header mod and the Pi Reloader window mod; see [README.md](README.md). This project owns its standards and toolchain within the monorepo. Follow the [root guide](../AGENTS.md) as well.

## Critical engineering rules

- A mod imports only inside its folder: `gpui-kit`, `gpui-base` and `herdr` in the files that draw, which are `main.js` and, in industrial-os, `storybook.js`, `stories.js` and `parts/` (pi-reloader's `main.js` also `net`; industrial-os's `parts/drawings.js` alone also `fs/promises`, to write its drawings), otherwise the mod's own files, and from droid-plate's pure modules its `./ds/…` copy of design-system files. Rules live in pure modules with no host import. `ds/` is never edited by hand: change the design system, then `node herdr/scripts/sync-design-system.mjs` ([decision](../docs/decisions/herdr-mod-design-system-copy.md)). Check: `test/industrial-os-layout.test.mjs`, `test/pi-reloader.test.mjs`, `test/droid-plate.test.mjs`.
- A sidebar part takes its data as arguments and returns elements: it reads no pane, space or agent from Herdr, runs no command, names its elements through `partId`, and has a story for each form it takes ([parts](docs/parts.md), [decision](../docs/decisions/herdr-combined-mod.md)). Check: `test/industrial-os-layout.test.mjs` (a part imports no `main.js`, storybook or sample), `test/industrial-os-parts.test.mjs` (every part has a story and every story draws).
- A mod's render stays well under herdr-app's ~50 ms interrupt: compose design-system output in a task or timer and draw what it left.
- A mod that draws terminal cells places each one at x = col × the measured cell width, never as flowing text, and draws block elements, lines and Powerline triangles as shapes from the design system's `GLYPH_SHAPES`. Check: `test/droid-plate.test.mjs`, `node herdr/scripts/check-droid-plate.mjs`; a live shot.
- A mod animates natively where Herdr can (`.transition`, `.loop`, `.frames`): droid-plate's lighting switches and wipe are opacity and width transitions. A timer draws frames only for a motion that changes characters, at that motion's step and only while it plays, and stops in a copy that is not shown. The sidebar's map and ground light are the exception, positions Herdr cannot express: a 33 ms timer in their own nested views, running always by the operator's choice. Check: `test/droid-plate.test.mjs` (the real `Scheduler` on a fake clock); review of `main.js`.
- The Pi Reloader acts only through each Pi's guard, under [its contract](../pi/reloader-guard/docs/contract.md): never a slash command or other terminal input to Pi, never a kill, nothing on a protected terminal (no pane, a layout block, `lunalee-chat`) or another machine, and the one shell line, `pi --session '<file>'`, only once the root POSIX shell is back in front. It never moves focus. The shipped `mod.json` has no `only` prop. Check: `test/pi-reloader.test.mjs`.
- Unknown is never zero, and a label counts only on a live terminal whose agent `app` is `pi`, with `version` 1. The label is the frozen `io.signals.v1` publication of the [signals-collector snapshot](../pi/signals-collector/docs/contract.md); change it there first. Check: `test/industrial-os.test.mjs`.
- Every color is a `theme()` name or a design-system value; the design system owns the values, and no mod writes a hex value by hand. The Pi Reloader uses `theme()` names only; droid-plate's are carried by the design system's own lines; a theme file restates them; the sidebar's come from its [sidebar vocabulary](../design-system/foundation/README.md#sidebar-vocabulary): `mods/industrial-os/vocabulary.js` and `marks/*.svg` are committed copies, changed only by changing the design system and running `node scripts/sync-vocabulary.mjs`. Check: `test/app-theme.test.mjs` and `test/industrial-os-sidebar.test.mjs` import the package by name.
- Never change the running app to check this project: no installing, `herdr-app do`, `layout.*` or `mod.*` commands. `herdr-app check` and the tests only read. To see a mod drawn, use an [isolated app](CONTRIBUTING.md#isolated-app): a second Herdr with its own home and core, which the running one never sees. The one exception needs the operator's word each time: a [probe window](CONTRIBUTING.md#probe-window), a copy of the mod under another name in a floating window of the running app, deleted afterwards. Commands are in [CONTRIBUTING.md](CONTRIBUTING.md).
- The layout is Herdr's shipped `main` with nine changes, zero terminal padding, the window buttons' place (`traffic_lights`, on the plate's gutter), flat panes (no radius, border or focus outline), the 130 px `droid-plate` pane header, the sidebar width (300 px), the sidebar's three blocks (the header at 130 px, the lists, the footer at 46 px, each an `industrial-os` block) and Lunalee's column; keep it that way, and record the shipped copy it follows in `test/fixtures/`. The column's ids, size and terminal name are a frozen contract with Lunalee; Lunalee's install supplies its mod and terminal, never this project. Check: `test/industrial-os-layout.test.mjs`.

## Read for the task

| Task | Read before changing |
| --- | --- |
| A sidebar part, its story or the storybook | [Parts](docs/parts.md), then [design](docs/design.md#sidebar) for how it looks |
| A sidebar value, rule or state | [Design](docs/design.md#sidebar), the [snapshot contract](../pi/signals-collector/docs/contract.md), then [contributing](CONTRIBUTING.md) |
| How the sidebar looks | [Design](docs/design.md#sidebar), [root design](../docs/design.md) and the design system's [sidebar vocabulary](../design-system/foundation/README.md#sidebar-vocabulary), which changes first |
| The layout or a Herdr app update | [Architecture](docs/architecture.md), `~/.config/herdr-app/AGENTS.md` (Layouts, Mods) and `herdr.d.ts` |
| A palette value | [Root design](../docs/design.md#acid--black) and [the package decision](../docs/decisions/in-repo-design-system-package.md); the design system changes first |
| A new mod, layout or theme | [Architecture](docs/architecture.md#where-the-next-change-belongs) and [conventions](docs/conventions.md) |
| The pane plate: a unit, strip state, lighting, key or motion | [Design](docs/design.md#pane-plate), [architecture](docs/architecture.md#droid-plate), the design system's [unit plate](../design-system/elements/unit-plate/README.md), [status strip](../design-system/elements/status-strip/README.md) and [motions](../design-system/motions/README.md); a look changes in the design system first |
| The Pi Reloader | [Design](docs/design.md#pi-reloader), [architecture](docs/architecture.md#pi-reloader), the [guard contract](../pi/reloader-guard/docs/contract.md) and [the decision](../docs/decisions/pi-reloader-desktop.md) |

## Where work belongs

| Change | Start here | Boundary |
| --- | --- | --- |
| What a sidebar value means | `mods/industrial-os/` pure modules (`signals.js`, `agent.js`, `spaces.js`, `format.js`, `model.js`, `missions.js`, `fold.js` for the fold's timing) | No `gpui-kit` or `herdr` imports; Node-tested |
| The map, or a drawing under the text (halo, dot grid, fade) | `mods/industrial-os/map.js`, `assets.js` | Pure: they return SVG documents and positions; colors from `vocabulary.js` |
| A sidebar color, opacity, status word, designation or state mark | [design-system/foundation/sidebar-vocabulary.mjs](../design-system/foundation/sidebar-vocabulary.mjs), then `node scripts/sync-vocabulary.mjs` | Never edit `vocabulary.js` or `marks/` |
| How one piece of the sidebar is drawn: a pane row, a band, the plate, a key plate | `mods/industrial-os/parts/<part>.js` and its story in `stories.js` | herdr-app's `gpui-kit` and `gpui-base`; data in, elements out; `theme()` state colors passed in; ids through `partId`; drawings through `parts/drawings.js`, the only writer, only into `.gen/` |
| The storybook's window, a story or its invented data | `mods/industrial-os/storybook.js`, `stories.js`, `sample.js` | Reads no space, pane or agent from Herdr; handlers do nothing; `sample.js` is pure |
| Where the parts sit, what the sidebar reads from Herdr, remembers or runs | `mods/industrial-os/main.js` | herdr-app's `gpui-kit`, `gpui-base` and `herdr`; draws nothing a part could |
| The sidebar's place in the window, and Lunalee's column | `layouts/industrial-os.json` | Shipped `main` with only zero terminal padding, the window buttons' place, flat panes under the `droid-plate` header, the sidebar at 300 px, its header, lists and footer replaced, and the `lunalee` column added; the column's contents come from Lunalee's install |
| What a pane plate shows and when it moves | `mods/droid-plate/` pure modules (`model.js`, `signals.js`, `plate.js`, `motion.js`) | No `gpui-kit` or `herdr` imports; design-system code only through `ds/`; Node-tested |
| How the pane plate reads Herdr, labels its terminal, runs commands and draws | `mods/droid-plate/main.js` | herdr-app's `gpui-kit`, `gpui-base` and `herdr`; never composes in render |
| The design-system copy in a mod | `scripts/sync-design-system.mjs`, then `node herdr/scripts/sync-design-system.mjs` | Node's standard library; `ds/` is exactly the import closure, byte for byte |
| What the Pi Reloader decides: candidates, protection, the guard wire, the reload and reset sequences | `mods/pi-reloader/reloader.js` | No host imports; Node-tested against a simulated herdr-core and guard |
| How the Pi Reloader draws, reads Herdr and talks to herdr-core and the guard | `mods/pi-reloader/main.js`; its window size in `mod.json`, its key in `keys/pi-reloader.json` | herdr-app's `gpui-kit`, `gpui-base`, `herdr` and `net`; `theme()` colors |
| The guard's side of the protocol | [pi/reloader-guard](../pi/reloader-guard/AGENTS.md) | Not here |
| The Herdr desktop theme | `themes/acid-black.json` | herdr-app's theme file format; design-system colors, including `HERDR_TERMINAL`; [theme design](docs/design.md#theme) |
| Checks | `test/`, `scripts/check-droid-plate.mjs` | Node's test runner; reads files, imports the mods' pure modules, their `ds/` copies and the design-system package; the sidebar's drawing code only on the stand-in; the check script runs only `herdr-app check` on a temporary copy |
| What Node offers in place of the app's modules | `stand-in/` | Node's standard library; a `gpui-kit` method is added only after finding it in the app's `gpui-kit.d.ts`; it proves a tree, never a look |
| The label's fields or publication | [pi/signals-collector](../pi/signals-collector/AGENTS.md) | Not here |

## Implement and verify

Use the [validation sequence](CONTRIBUTING.md#validation-sequence), then the [repository-wide checks](../CONTRIBUTING.md#repository-wide-checks). Keep automated checks, `herdr-app check` and live app evidence separate.

## Supporting documents

| Document | Purpose | Read when |
| --- | --- | --- |
| [README.md](README.md) | Purpose, status, install of the sidebar and theme, limitations | Using the project or changing its install steps |
| [AGENTS.md](AGENTS.md) | Project rules and routes | Starting work in this project |
| [CLAUDE.md](CLAUDE.md) | Runtime import of this guide | Checking agent entry points |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Toolchain, commands, validation and records | Making or verifying any change |
| [docs/architecture.md](docs/architecture.md) | Files, dependencies, flow and invariants | Changing what the project depends on or adding a file |
| [docs/conventions.md](docs/conventions.md) | Project rules for the mod, layout, theme and checks | Writing or reviewing code or configuration |
| [docs/parts.md](docs/parts.md) | What a sidebar part is, the list of parts, the storybook, the stand-in and how to add a part | Changing or adding a part, a story or the storybook |
| [The combined-mod decision](../docs/decisions/herdr-combined-mod.md) | Why the parts and the storybook live in the one mod, and what moves in next | Adding a mod, sharing code between mods or moving one |
| [docs/design.md](docs/design.md) | What the sidebar and the pane plate show and mean; the chrome theme | Changing anything a user sees in the sidebar or Herdr's chrome colors |
| [Snapshot contract](../pi/signals-collector/docs/contract.md) | The snapshot fields the label carries | Changing what the sidebar reads |
| [Root AGENTS](../AGENTS.md) | Shared rules and the repository guidance map | Working in this repository |
