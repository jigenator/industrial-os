# Industrial OS Herdr configuration

Industrial OS for the Herdr desktop app (herdr-app): the Acid / Black theme, [themes/acid-black.json](themes/acid-black.json), and the Industrial OS sidebar, a mod, [mods/industrial-os](mods/industrial-os/main.js), shown by its layout, [layouts/industrial-os.json](layouts/industrial-os.json). The experience is in [the design](docs/design.md).

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

The layout is the shipped `main` layout of Herdr app 0.1.15 with the sidebar's two lists replaced by the one `industrial-os` block. It does not follow later changes to `main`; compare it with the shipped file after an app update. Copy only the `mods/industrial-os` folder: `mods/package.json` is for the Node tests. `gpui-kit.d.ts` and `jsconfig.json` in the folder, if present, were written by `herdr-app check` for editors; the app writes its own.

### Limitations

- Visual design is deferred: plain text, theme colors only, no design-system elements, no rail form when the sidebar is collapsed (the text is cut instead).
- Unseen-finished state, access ages and space activity are kept in the mod's `localStorage`, on this screen only. Space activity starts when the mod first sees a space, so quiet ages count from installation, not from the space's real history.
- Spaces keep Herdr's order: quiet spaces are not moved to the bottom, and worktree spaces are not nested.
- Ahead/behind is read with `git` from each space's first terminal's folder, on that space's machine, at once for a new place and every 30 seconds while the window is in front.

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
