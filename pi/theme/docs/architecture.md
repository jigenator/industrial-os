# Architecture

## Files and dependencies

| File | Owns | Depends on |
| --- | --- | --- |
| `industrial-os.json` | The theme: `vars` holding design-system values, `colors` mapping each Pi token to a variable, and `export` for HTML exports | Pi's [theme schema](https://pi.dev/schemas/theme.schema.json) |
| `test/theme.test.mjs` | The check | `@industrial-os/design-system/foundation/palette` and `/signal-colors` by package name; Pi's `validateThemeJson` and `loadThemeFromPath` through `PI_HOST_ROOT` |
| `package.json` | The package's own `pi.themes` entry and the test script | Nothing at runtime |

The root `package.json` lists `./pi/theme/industrial-os.json` in `pi.themes`, so the repository's git install provides the theme. JSON cannot import, so the theme restates each value; the check proves each one against the design system, the way `herdr/test/` checks the Herdr TOML.

## Host seams

Pi reads the file when it starts, on `/reload`, and when the theme is selected. Its RPC mode does not load themes. The check imports `dist/modes/interactive/theme/theme-schema.js` and `theme.js` from the installed Pi because Pi 1.3.0 exports neither function from its package root; a Pi upgrade can move them, which fails the check rather than passing it.

Pi uses the `thinking*` tokens for the editor border by thinking level and `bashMode` for it in bash mode. Extensions that draw with literal colors, such as status-bar's footer and claude-interrupt's marker, are unaffected; extensions that use Pi's theme tokens, such as image-preview's caption, take this theme's colors.

## Invariants

| Must remain true | Check |
| --- | --- |
| Pi accepts and builds the theme | Pi's validator and loader in `test/theme.test.mjs` |
| Every color is the design-system value its variable is named after | `test/theme.test.mjs` |
| Tokens name variables only, and no variable is unused | `test/theme.test.mjs` |
