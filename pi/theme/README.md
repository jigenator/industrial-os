# Industrial OS Pi theme

`industrial-os`, a Pi theme in the Acid / Black language: black field, white and grey text, acid green only as a highlight, and a bone off-white border around the editor. Every color is a design-system value; the [design](docs/design.md) says what each part of Pi gets.

Status: in use with Pi 1.3.0. It is a theme file, not an extension: it changes no behavior, and extensions that draw their own colors, such as [status-bar](../status-bar/README.md), keep them.

## Install

The repository root's `package.json` lists the theme in `pi.themes`, so the same git entry that installs the extensions also provides it; see [installing the Pi extensions](../README.md#install). An `extensions` filter on that entry does not hide the theme, and `"themes": []` would. Then choose **industrial-os** under **Theme** in `/settings`, or set `theme` as in the [recommended settings](../README.md#recommended-settings).

Run `/reload` or restart Pi after `pi update --extensions` pulls a new version: Pi hot-reloads only themes in its own `themes/` folder. To try it for one run from a checkout without installing it:

```sh
pi --theme <checkout>/pi/theme/industrial-os.json --use-theme industrial-os
```

## Limits

- A Pi theme colors the editor's border, not its background, so the editor keeps the black field. A filled editor would need an extension that replaces Pi's editor.
- The border is bone at every thinking level, so it no longer shows the level; status-bar's footer does. It turns acid in bash mode.
- It is a dark theme for truecolor terminals. Pi approximates the colors on 256-color terminals; that has not been checked.
- Faint text uses the design system's decorative grey, which is below 4.5:1 contrast; see [the design](docs/design.md#contrast).

## Guides

[AGENTS](AGENTS.md), [contributing](CONTRIBUTING.md), [architecture](docs/architecture.md), [conventions](docs/conventions.md) and [design](docs/design.md).
