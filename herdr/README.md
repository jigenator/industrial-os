# Industrial OS Herdr configuration

Herdr configuration that belongs to Industrial OS. Today it is one fragment, [sidebar.toml](sidebar.toml): the [Herdr](https://github.com/herdrdev/herdr) agents-sidebar rows that draw the tokens the [herdr-sidebar](../pi/herdr-sidebar/README.md) Pi extension reports, in Acid / Black layout "B", with the theme colors and the width lock that layout needs. The experience is in [the design](docs/design.md).

Status: checked by its own test and by Herdr 0.9.3's config parser; no interactive check of this file in a running Herdr has been recorded. The layout was verified live on 2026-10-08 with an equivalent spike configuration.

## Install

Herdr has no config includes, so merge the fragment into your own config by hand. Herdr reads `~/.config/herdr/config.toml` unless `HERDR_CONFIG_PATH` names another file.

1. Back up your config.
2. Copy the keys under `[theme.custom]` and `[ui]` into the tables of the same names in your config, adding a table you do not have. TOML rejects a table defined twice, so do not paste a second `[ui]` header. `[theme.custom]` overrides the colors of whichever theme `[theme] name` selects.
3. Replace any `[ui.sidebar.agents]` table you have with the fragment's. Its `rows` replace Herdr's default agent rows.
4. Check the result without touching the running server:

   ```sh
   herdr config check
   ```

   It prints `config: ok` and exits 0. Point `HERDR_CONFIG_PATH` at a copy to check it before you replace your config.
5. Apply it to the running Herdr with `herdr server reload-config`, or `reload config` in Herdr's global menu, which also reloads the client's local presentation settings.

Then run Pi with the herdr-sidebar extension, and the signals-collector extension for values beyond the state row, in a Herdr pane.

## Limitations

- Agent panes that do not run the herdr-sidebar extension, such as other agents than Pi, show no rows: the fragment replaces Herdr's default agent rows and reports no fallback.
- The layout assumes exactly 36 columns; the width lock keeps the sidebar at that width. Collapsed and mobile sidebars keep Herdr's compact layouts.
- Colors are truecolor values; other color depths are untested.

## Guides

- [Agent guide](AGENTS.md): rules and routes for this project.
- [Contributing](CONTRIBUTING.md): commands, checks and verification records.
- [Architecture](docs/architecture.md), [conventions](docs/conventions.md) and [design](docs/design.md).
