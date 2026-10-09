# Industrial OS Herdr configuration

Herdr configuration that belongs to Industrial OS. The agents fragment is [sidebar.toml](sidebar.toml): the [Herdr](https://github.com/herdrdev/herdr) Pi agents-sidebar rows that draw the tokens the [herdr-sidebar](../pi/herdr-sidebar/README.md) Pi extension reports, in Acid / Black layout "B", with the theme colors and the width lock that layout needs. [spaces.toml](spaces.toml) adds the Spaces rows, and [theme.toml](theme.toml) the rest of Herdr's chrome colors. The experience is in [the design](docs/design.md).

Status: checked by its own test and by Herdr 0.9.3's config parser; no interactive check of this file in a running Herdr has been recorded. The layout was verified live on 2026-10-08 with an equivalent spike configuration.

ACT and MDL alone fade after 1 hour, 4 hours and 1 day without access.
Access means visible in the focused workspace's active tab or row 1 showing
WRK/SUB; unknown visibility/status stays fresh. The dirty branch fades too,
but text, widths and all other rows stay unchanged. Age is memory only and
resets on `/reload` or Pi restart. See [the design](docs/design.md).
Update the reporter and the complete Pi row override together; an old fragment
cannot render the new stage keys.

## Install

Herdr has no config includes, so merge the fragment into your own config by hand. Herdr reads `~/.config/herdr/config.toml` unless `HERDR_CONFIG_PATH` names another file.

1. Back up your config.
2. Copy the keys under `[theme.custom]` and `[ui]` into the tables of the same names in your config, adding a table you do not have. TOML rejects a table defined twice, so do not paste a second `[ui]` header. `[theme.custom]` overrides the colors of whichever theme `[theme] name` selects.
3. Merge `row_gap = 1` into `[ui.sidebar.agents]` (spacing is panel-wide, for all agents). Merge the fragment's `pi` array into `[ui.sidebar.agents.rows_by_agent]`, replacing only an existing `pi` override. Leave any existing `rows` and other agent overrides alone: agents without an override keep those rows or Herdr's defaults. Do not paste duplicate table headers.
4. Check the result without touching the running server:

   ```sh
   herdr config check
   ```

   It prints `config: ok` and exits 0. Point `HERDR_CONFIG_PATH` at a copy to check it before you replace your config.
5. Apply it to the running Herdr with `herdr server reload-config`, or `reload config` in Herdr's global menu, which also reloads the client's local presentation settings.

Then run Pi with the herdr-sidebar extension, and the signals-collector extension for values beyond the state row, in a Herdr pane.

## Spaces

[spaces.toml](spaces.toml) adds the Spaces panel for the
[Spaces plugin](../herdr-plugins/spaces/README.md), in the same 36-column sidebar.

1. Install/link the plugin with Node 22 on Herdr's PATH before merging this
   fragment. It intentionally does not use the built-in `workspace` token:
   without the plugin, workspace names are absent. It was exercised in an
   isolated throwaway Herdr only; no live installation was run.
2. Merge its five color keys into your **existing** `[theme.custom]` table;
   TOML rejects a second `[theme.custom]`. Preserve the agents fragment's
   background/selection keys. The state colors affect other Herdr chrome too;
   see [the design](docs/design.md#spaces-theme-scope).
3. Merge `rows` into `[ui.sidebar.spaces]`, replacing only that panel's rows.
   Keep the agents fragment's `[ui]` width lock at 36, or set the three width
   keys to 36 yourself. `spaces.toml` is standalone-valid but does not duplicate
   the width keys. Preserve unrelated tables and do not paste duplicate headers.
4. Check a temporary copy with `HERDR_CONFIG_PATH=<copy> herdr config check`
   before an operator applies the merge. No live config/server changes were
   performed in development.

Quiet spaces send only panes, stale name and age, so their second row drops
unless Herdr has ahead/behind counts, when a second git-only row remains.
Sorting defaults on; number keys follow position. The plugin owns configuration
and state; its [README](../herdr-plugins/spaces/README.md) explains disabling
sort (reloaded each tick), disable/stop, startup repair, health, deletion and
TTL/name freeze behavior. Workspace custom keys use the `sp_` namespace because
Herdr shares keys across reporters; update this fragment with the plugin. Old
unprefixed frozen keys are not cleared automatically and are no longer rendered.

## Theme

[theme.toml](theme.toml) is the "Acid & Orange" chrome theme: the 11 `[theme.custom]` keys the agents and Spaces fragments leave unset. Together the three fragments set each of Herdr 0.9.3's 19 theme keys once, so no color of the base theme remains: white focus and selection, a black field, acid detail and signal-orange secondary chrome. What each key colors is in [the design](docs/design.md#theme).

1. Back up your config.
2. Merge the 11 keys into your **existing** `[theme.custom]` table, beside the agents and Spaces fragments' keys; TOML rejects a second `[theme.custom]`. Do not change a key another fragment sets.
3. Leave `[theme] name` and `auto_switch` as they are in your config; this fragment does not set them. With every key set, the name no longer changes any color. With `auto_switch` on, `[theme.custom.light]` or `[theme.custom.dark]` keys could still override these.
4. Check a temporary copy with `HERDR_CONFIG_PATH=<copy> herdr config check` before replacing your config. It prints `config: ok` and exits 0; a misspelled key prints `unknown config key` and exits 1.
5. Reload with `herdr server reload-config`, or `reload config` in Herdr's global menu.

The theme keys are global: they color every panel, dialog, menu and bar, not one panel. Its checks are automated tests and Herdr's parser; it has been merged into a live config and reloaded without diagnostics, but its rendering has not been checked by an agent.

## Limitations

- Pi panes without herdr-sidebar show no Industrial OS rows. Other agents keep their configured/default rows; layout B overrides only canonical agent ID `pi`.
- `row_gap = 1` applies to the entire agents panel, including non-Pi agents.
- The layout assumes exactly 36 columns; the width lock keeps the sidebar at that width. Collapsed and mobile sidebars keep Herdr's compact layouts.
- Colors are truecolor values; other color depths are untested.
- Herdr computes pane text selection itself from the terminal background, or from `panel_bg` when the terminal reports none (about `#474747` on black either way); no theme key sets it directly. The theme does not recolor programs inside panes or the host terminal.
- `panel_bg` must stay dark: Herdr draws it as the text on white, acid and red controls.
- Acid also means working, and the signal orange is close in hue to critical red; see [the design's trade-offs](docs/design.md#theme-trade-offs).

## Guides

- [Agent guide](AGENTS.md): rules and routes for this project.
- [Contributing](CONTRIBUTING.md): commands, checks and verification records.
- [Architecture](docs/architecture.md), [conventions](docs/conventions.md) and [design](docs/design.md).
