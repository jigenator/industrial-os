# Industrial OS Herdr configuration

Industrial OS for the Herdr desktop app (herdr-app): the Acid / Black theme, [themes/acid-black.json](themes/acid-black.json), the Industrial OS sidebar, a mod, [mods/industrial-os](mods/industrial-os/main.js), drawn from [parts](docs/parts.md) that its [storybook](#storybook) shows alone, and shown by its layout, [layouts/industrial-os.json](layouts/industrial-os.json), which also holds [Lunalee's column](#lunalee-column) and frames every pane with the [droid-plate pane header](#droid-plate-pane-header), [mods/droid-plate](mods/droid-plate/main.js), and the [Pi Reloader](#pi-reloader) window, [mods/pi-reloader](mods/pi-reloader/main.js). The experience is in [the design](docs/design.md).

Status: the theme was installed and checked live on 2026-11-12. The redesigned sidebar passes its Node tests and `herdr-app check`, was looked at with live data in a floating probe window, and was installed as the layout's sidebar on 2026-11-18, where its three blocks drew without errors; hover, clicks and the rail have not been checked there. See the [record](CONTRIBUTING.md#sidebar-redesign). The droid-plate pane header passes its Node tests and `herdr-app check`; its live looks are in its [record](CONTRIBUTING.md#droid-plate-pane-header).

The herdr-tui configuration this project used to hold (the agents and Spaces sidebar fragments, their parser check) and the herdr-tui Spaces plugin have been removed; their histories are in [contributing](CONTRIBUTING.md#verification-records).

## Sidebar

One mod, `industrial-os`, in place of Herdr's sidebar header, its spaces and agents lists and its footer:

- **The crate plate** at the top: this computer's name, droids running and spaces, with a window onto the map that keeps the focused pane under its crosshair. Under it, `SETTINGS` and `ADD MACHINE`.
- **ACTION REQUIRED**: the panes with a question, a block or work finished unseen, most urgent first. Click one to focus it.
- **Missions**: a band per space with its map window, a title per tab, and every pane as two rows: state, name and age, then subagents and context used. The focused pane opens to show its branch, PR, model, goal and question. Click a pane to focus it, a band to shut or open the space, `+` for a new tab.
- **Agents**: the same panes in one list, what is active first.
- **The map**: one map of every space, tab and pane; each window looks onto it.
- **Search** at the bottom is a hint with the picker's key; a click opens the picker too. The grip on the right edge folds the sidebar to a rail of one lamp per pane.

What every value means is in [the design](docs/design.md#sidebar). A Pi's readings come from Pi's signals-collector, which publishes its snapshot as the `io.signals.v1` label on its own terminal in Herdr desktop; without it a Pi shows Herdr's status only.

### Install

The app reads mods and layouts from `~/.config/herdr-app` (or `$HERDR_APP_HOME`). Copy both in, then switch to the layout:

```sh
cp -R mods/industrial-os mods/droid-plate ~/.config/herdr-app/mods/
cp layouts/industrial-os.json ~/.config/herdr-app/layouts/
herdr-app do layout.switch '{"name":"industrial-os"}'
```

`ctrl-shift-l` (`layout.switch`) cycles back to `main`; `ctrl-alt-shift-escape` always returns to `main`. Run `herdr-app status` to see errors from the mod or layout.

To fold and unfold the sidebar from the keyboard, bind a key to the mod's `fold` command in `~/.config/herdr-app/keys.json`, for example `"cmd-\\": "industrial-os.fold"`; the hide grip then shows that key. The sidebar's other key plates show whatever is bound to `tab.new` and `mod.open:picker`.

The mod writes its drawings (glows, dot grids, the map) as SVG files into `~/.config/herdr-app/mods/industrial-os/.gen/`, a few megabytes, and empties that folder itself when it grows past 1500 files. It is safe to delete. The sidebar wants the `JetBrainsMono NFM` font for its heavy weights and falls back to the app's font without it.

The layout is the shipped `main` layout of Herdr app 0.1.15 with zero terminal padding, flat panes (square corners, no border or focus outline) under the 130 px [droid-plate](#droid-plate-pane-header) header in place of the shipped `pane` header, the sidebar widened to 300 px, its header (now 130 px), two lists and footer (now 46 px) replaced by `industrial-os` blocks, and [Lunalee's column](#lunalee-column) added on the right. It does not follow later changes to `main`; compare it with the shipped file after an app update. Copy only the `mods/industrial-os` and `mods/droid-plate` folders, whole, with `parts/` and `marks/`: `mods/package.json` is for the Node tests, and so is `stand-in/`. `gpui-kit.d.ts` and `jsconfig.json` in the folder, if present, were written by `herdr-app check` for editors; the app writes its own.

### Storybook

The mod carries a storybook: a window with every part of the sidebar alone, in each of its states (19 pages, from the state marks to the fold), on invented data. Nothing in it reads your panes or runs a command.

- Bind a key to the mod's `storybook` command in `~/.config/herdr-app/keys.json`, for example `"cmd-alt-s": "industrial-os.storybook"`, or run `herdr-app do industrial-os.storybook`. The `industrial-os` layout must be shown: its sidebar opens the window.
- Pick a page in the index, or bind keys to `industrial-os.story-next` and `industrial-os.story-prev`. Drag the window by its header; `CLOSE` closes it, and so does switching layout. Running the command again opens it afresh where it was left.
- A layout block can show it too: `{ "mod": "industrial-os", "props": { "part": "storybook" } }`.

It has been looked at only in an isolated second Herdr, with commands sent by `herdr-app do`: not with a real key press or pointer, and not in the installed app. See the [record](CONTRIBUTING.md#sidebar-parts-and-storybook) and [how the parts are organized](docs/parts.md).

### Lunalee column

The layout ends in one full-height, fixed-width column on the window's right edge, always present: `sidebar | work | lunalee`. It belongs to Lunalee, the desktop secretary (a separate repository). The layout is Industrial OS's; Lunalee's own install supplies what runs in it: the `lunalee` mod, in a 1 px `lunalee-host` block at the top that draws nothing, and the terminal named `lunalee-chat`, in the `lunalee-chat` block below. The column is 580 px wide, about 67 terminal columns at font 14 and zoom 1; drag its left edge between 420 and 900 px.

Without Lunalee installed, the column is still there: a blank 1 px block and a blank terminal slot.

Herdr behaviours to know:

- **When the `lunalee-chat` terminal ends, Herdr deletes its block from the installed layout file**, within about a second, or when the layout is next shown. Copy the layout in again to restore it: `cp layouts/industrial-os.json ~/.config/herdr-app/layouts/`. A copied file keeps your dragged sizes and shown panels, which live in `layouts/.state/`.
- **Never use `layout.set`** on this layout: it rewrites the file and deletes those `.state` clicks.
- **A terminal started after the layout was built is not attached** until its block is hidden and shown again: `herdr-app do layout.hide '{"id":"lunalee-chat"}'`, then `herdr-app do layout.show '{"id":"lunalee-chat"}'`. Switching away from the layout and back also works.

### Limitations

- Not yet looked at in the installed sidebar: the macOS window buttons over the plate, the rail at 76 px, hover, clicks and the crosshair following ACTION REQUIRED across blocks.
- Subagents show as a count and one spinner each: Pi publishes no per-subagent state.
- The map, the ground's light and the glows cost CPU (see the [record](CONTRIBUTING.md#sidebar-redesign)), and keep moving while another app is in front.
- A drawing appears a moment after the text it belongs to, the first time that text is shown.
- Unseen-finished state and space activity are kept in the mod's `localStorage`, on this screen only. Space activity starts when the mod first sees a space, so quiet ages count from installation, not from the space's real history.
- Spaces keep Herdr's order: quiet spaces are not moved to the bottom, and worktree spaces are not nested.
- Commits behind (ahead is read but not shown) are read with `git` from each space's first terminal's folder, on that space's machine, at once for a new place and every 30 seconds while the window is in front.

## Droid-plate pane header

One mod, `droid-plate`, draws a unit plate over every pane of the shown tab, from the design system: who is in the pane on six rows, and what it is doing on a strip under it.

- **Pi** (a pane whose agent app is `pi`, with the `io.signals.v1` label): `DRD-FA03`, its serial and barcode from the session ID, `⟁ PI AGENT DROID`, `HALDENN DYNAMICS` and the acid peak. The strip shows Pi's key hints when idle; `■ BASH <target> 00:42  esc steer` (or `THINKING`, `WRITING`) while it works; a `▲ NEEDS YOU` chip and the question; `● DONE  SETTLED 15:02` when it finished while you were away. Before the label arrives, `▶ STARTING pi` on the terminal plate for 3 s, then `DRD-????`.
- **Another agent** (Claude Code, Codex): `AGT-CLAUDE` (or plain `AGT` when the name does not fit), its folder, a barcode from the terminal, `EXTERNAL AGENT`. Strip: `○ READY`, `■ WORKING 03:12`, `▲ NEEDS YOU`, `● DONE`.
- **A terminal**: `TERM-ZSH` from the shell, its folder and branch. Strip: `○ READY`, `▶ RUNNING npm run dev 00:12:41` (the full command, looked up once per program change with `hc get`), and `○ READY  PI EXITED 15:04` after Pi hands back, until the next command.

The bay at the strip's right end has `[|]` split right, `[-]` split down, `[^]` zoom (`[v]` while zoomed) and `[x]` close, the shipped pane header's commands. Click elsewhere on the header to focus the pane; drag panes with Herdr's own grip, which appears at the top edge. The focused pane's plate is lit aluminium; the others are dark graphite with their status lamps still lit, rising to standby while the pointer is over them; every plate is dark while the window is in the background. What each state means, the motions and their rates are in [the design](docs/design.md#pane-plate).

Under the plate, Pi's [droid header](../pi/droid-header/README.md) shows only its ledger: the mod sets the label `io.droid-plate.v1=1` on its pane's terminal while it draws there, and the header reads it at session start. Set Pi's `quietStartup` to `true` (the [recommended settings](../pi/README.md#recommended-settings)) so the ledger starts right under the plate.

### Install

It comes with the layout: copy `mods/droid-plate` with `mods/industrial-os`, as in the [sidebar install](#install). The folder is self-contained: `mods/droid-plate/ds/` is a byte-for-byte copy of the design-system files it draws with. After changing the design system, regenerate it with `node herdr/scripts/sync-design-system.mjs` from the checkout root before copying; `node --test` in `herdr/` fails while the copy differs. The plate's text is in the terminal's font (Herdr's JetBrains Mono unless the settings name another); block elements, lines and the peak's triangles are drawn as shapes, so no Nerd Font is needed.

### Limits

- Seen in a running app at one width and display scale (198 columns at 2x): the grid, the shapes and the peak clear of Herdr's grip. The motions, hover and the keys are checked only by the Node tests and `herdr-app check`.
- The peak sits right of Herdr's drag grip (28 px, top centre on hover) and needs 80 columns; narrower droid plates have none (see [the design](docs/design.md#pane-plate)).
- Lighting changes and the hand-back wipe are Herdr-native transitions; the CRT boot, the serial roll, the latch and the ghost redraw the pane every 40–50 ms while they play, and nothing redraws otherwise but a clock's second.
- Over 256 columns the plate's middle is widened plain ground, and past about 418 columns the droid has no peak.
- The plate is the header's width over the terminal's cell width, both measured in the app; the part of a cell left over at the right takes the row's last color. For its first frames, before layout reports them, it draws the terminal's columns at `font_size × 0.6`.
- Whether Herdr redraws a pane header when the window gains or loses focus is not documented; a 500 ms check per pane covers it.
- Label writes are serialized and retried at most three times; a terminal `hc` never acknowledges stays as it was. A crashed or force-quit app can leave `io.droid-plate.v1=1` on a terminal, and a Pi started there before the app runs again shows only its ledger. Whether Herdr calls the mod's `close()` on a layout switch is not verified; if it does not, a Pi started after switching away shows only its ledger too.
- Herdr's pane header height is one value for the layout: plain shells get the same 130 px as Pi.
- No reduced-motion setting: the motions always play.

## Pi Reloader

A window that reloads or restarts every Pi agent Herdr reports as idle or done, without touching an unsent draft. Its Pi side is the [reloader-guard](../pi/reloader-guard/README.md) extension, which must be loaded in every Pi it acts on.

Status: contract version 2. Its tests and `herdr-app check` pass, and a live run on three throwaway Pis in Herdr desktop reloaded and restarted the idle and done ones and skipped the draft and busy ones, with focus never moving. See the [record](CONTRIBUTING.md#pi-reloader).

- **Reload all Pi** asks each idle or done Pi's guard to run Pi's own reload and waits until the new runtime's guard answers.
- **Reset all Pi** restarts them: each guard quits its Pi, and once the terminal's shell is back in front the window types `pi --session '<the same session file>'` into that shell, then waits until the resumed Pi answers on the same session.
- Both act on every candidate at once and never move focus. A Pi that read idle still reads idle afterwards, and one that read done still reads done: neither action runs a prompt, so Herdr's read state is unchanged.
- **Skipped, never touched:** a Pi that is working or blocked, has queued messages or an **unsent draft** (never submitted, cleared or copied); a protected terminal (an agent without a pane of its own, any terminal a layout block shows, Lunalee's `lunalee-chat`); Pi on another machine. Reset also skips a Pi whose terminal would end with it: Pi is the terminal's own program, or its shell is not sh, bash, zsh, dash or ksh. Nothing is ever killed.
- **Failures, also untouched:** no guard or an unresponsive one, a session that changed between the check and the action, and, for reset, a Pi with no session file yet. Neither action types a slash command or falls back to terminal input.
- The window lists the candidates and, after a run, completed, skipped and failed counts with one line per Pi and its reason.

### Install

1. Load the [guard](../pi/reloader-guard/README.md#install) in Pi, and `/reload` each running Pi once with an empty editor. Install the mod and the guard together: each reads only its own contract version.
2. Copy the mod: `cp -R mods/pi-reloader ~/.config/herdr-app/mods/`.
3. Merge [keys/pi-reloader.json](keys/pi-reloader.json) into `~/.config/herdr-app/keys.json` by hand: it binds `cmd-alt-r` to `mod.open:pi-reloader` in `global`. Ask before replacing a key already in use, and pick another if so. Editing keys.json makes the whole file yours; see the app's `AGENTS.md`, Keys.
4. Run `herdr-app check ~/.config/herdr-app/mods/pi-reloader` and `herdr-app status`; both must report no error.

Press the key, or run `herdr-app do mod.open --name pi-reloader`; the same again closes it.

### Limits

- **Don't switch layout during a run.** A layout switch closes the window and stops the run; a Pi already quit then stays at its shell prompt, its session file intact (`pi --session <file>` resumes it).
- A reset runs `pi` from the shell's `PATH` with `--session`, not the Pi's original arguments: flags such as `-e` or `--model` are not repeated (a shell function or alias named `pi` is used).
- Scope is this computer and Herdr's agents; sub-agents without a pane are not listed.
- For an isolated live check, a copy of the mod under another name can add `"props": { "only": ["t40", "t41"] }` to its `mod.json` overlay: it then acts only on those addresses and says so. The shipped `mod.json` has none.

## Theme

[themes/acid-black.json](themes/acid-black.json) is the Acid / Black theme for the Herdr desktop app (herdr-app). It replaces the herdr-tui `theme.toml` fragment. Panels get the roles herdr-tui used: a black field for canvas and chrome, white focus and solid buttons with black ink, surface rows, ghost borders, acid working, critical blocked, white done and decorative idle. Terminals keep the colors they had under herdr-tui: Ghostty's Terminal Basic Dark ANSI palette, cursor and selection, on a black background. What each color is for is in [the design](docs/design.md#theme).

1. Copy it into the app's home: `cp themes/acid-black.json ~/.config/herdr-app/themes/`.
2. Select it in the app's theme menu, or set `"theme": "acid-black"` in `~/.config/herdr-app/settings.json`. A layout's own `theme` and the theme picker take precedence over settings.json; Herdr's `main` layout and the `industrial-os` layout set none.
3. Run `herdr-app status` and check that it reports no `settings.error`.

The theme colors every layout that does not set its own theme, including every mod that uses `theme()` colors, such as the Industrial OS sidebar.

### Theme limitations

- Colors are truecolor values; other color depths are untested.
- The theme does not recolor programs inside panes or the host terminal.
- Acid also means working, and the signal orange is close in hue to critical red; see [the design's trade-offs](docs/design.md#theme-trade-offs).

## Guides

- [Agent guide](AGENTS.md): rules and routes for this project.
- [Contributing](CONTRIBUTING.md): commands, checks and verification records.
- [Architecture](docs/architecture.md), [conventions](docs/conventions.md), [parts and the storybook](docs/parts.md) and [design](docs/design.md).
