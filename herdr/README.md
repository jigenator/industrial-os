# Industrial OS Herdr configuration

Industrial OS for the Herdr desktop app (herdr-app): the Acid / Black theme, [themes/acid-black.json](themes/acid-black.json), the Industrial OS sidebar, a mod, [mods/industrial-os](mods/industrial-os/main.js), shown by its layout, [layouts/industrial-os.json](layouts/industrial-os.json), which also holds [Lunalee's column](#lunalee-column), and the [Pi Reloader](#pi-reloader) window, [mods/pi-reloader](mods/pi-reloader/main.js). The experience is in [the design](docs/design.md).

Status: the theme was installed and checked live on 2026-11-12. The sidebar passes its Node tests and `herdr-app check`; it has not been installed or looked at in a running app. It shows information as plain text: its visual design is deferred.

The herdr-tui configuration this project used to hold (the agents and Spaces sidebar fragments, their parser check) and the herdr-tui Spaces plugin have been removed; their histories are in [contributing](CONTRIBUTING.md#verification-records).

## Sidebar

One mod, `industrial-os`, in place of Herdr's own spaces and agents lists:

- **Spaces**: one row per space, with its state, panes, agents, Pi units, name, ahead/behind and, when quiet, its idle days. Click a row to show that space.
- **Agents**: one block per Pi agent that publishes the `io.signals.v1` label (state, SPACE, `/flag` dot, goal time; units, context used, compactions; branch or directory and PR; model; question, finished or pane name), and one line for every other agent (Herdr's status, space and title). Click one to focus it. `agent.next` / `agent.prev` follow the list.

What every value means is in [the design](docs/design.md#sidebar). The values come from Pi's signals-collector, which publishes its snapshot as the `io.signals.v1` label on its own terminal in Herdr desktop; without it, Pi agents show as one line.

### Install

The app reads mods and layouts from `~/.config/herdr-app` (or `$HERDR_APP_HOME`). Copy both in, then switch to the layout:

```sh
cp -R mods/industrial-os ~/.config/herdr-app/mods/
cp layouts/industrial-os.json ~/.config/herdr-app/layouts/
herdr-app do layout.switch '{"name":"industrial-os"}'
```

`ctrl-shift-l` (`layout.switch`) cycles back to `main`; `ctrl-alt-shift-escape` always returns to `main`. Run `herdr-app status` to see errors from the mod or layout.

The layout is the shipped `main` layout of Herdr app 0.1.15 with the sidebar widened to 300 px, its header and two lists replaced by `industrial-os` blocks (the header with `props.brand`), and [Lunalee's column](#lunalee-column) added on the right. It does not follow later changes to `main`; compare it with the shipped file after an app update. Copy only the `mods/industrial-os` folder: `mods/package.json` is for the Node tests. `gpui-kit.d.ts` and `jsconfig.json` in the folder, if present, were written by `herdr-app check` for editors; the app writes its own.

### Lunalee column

The layout ends in one full-height, fixed-width column on the window's right edge, always present: `sidebar | work | lunalee`. It belongs to Lunalee, the desktop secretary (a separate repository). The layout is Industrial OS's; Lunalee's own install supplies what runs in it: the `lunalee` mod, in a 1 px `lunalee-host` block at the top that draws nothing, and the terminal named `lunalee-chat`, in the `lunalee-chat` block below. The column is 580 px wide, about 67 terminal columns at font 14 and zoom 1; drag its left edge between 420 and 900 px.

Without Lunalee installed, the column is still there: a blank 1 px block and a blank terminal slot.

Herdr behaviours to know:

- **When the `lunalee-chat` terminal ends, Herdr deletes its block from the installed layout file**, within about a second, or when the layout is next shown. Copy the layout in again to restore it: `cp layouts/industrial-os.json ~/.config/herdr-app/layouts/`. A copied file keeps your dragged sizes and shown panels, which live in `layouts/.state/`.
- **Never use `layout.set`** on this layout: it rewrites the file and deletes those `.state` clicks.
- **A terminal started after the layout was built is not attached** until its block is hidden and shown again: `herdr-app do layout.hide '{"id":"lunalee-chat"}'`, then `herdr-app do layout.show '{"id":"lunalee-chat"}'`. Switching away from the layout and back also works.

### Limitations

- Visual design is deferred: plain text, theme colors only, no design-system elements, no rail form when the sidebar is collapsed (the text is cut instead).
- Unseen-finished state, access ages and space activity are kept in the mod's `localStorage`, on this screen only. Space activity starts when the mod first sees a space, so quiet ages count from installation, not from the space's real history.
- Spaces keep Herdr's order: quiet spaces are not moved to the bottom, and worktree spaces are not nested.
- Ahead/behind is read with `git` from each space's first terminal's folder, on that space's machine, at once for a new place and every 30 seconds while the window is in front.

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
- [Architecture](docs/architecture.md), [conventions](docs/conventions.md) and [design](docs/design.md).
