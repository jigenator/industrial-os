# pi-droid-header

A [Pi](https://pi.dev) extension that replaces Pi's startup header with the Industrial OS droid details panel: this session's droid ID, model, Pi version, Herdr pane, start time and project, and a manifest of the context files, skills, prompts and extensions Pi's settings load. Everything shown is real; what is not known shows as `--`.

Status: new, unpublished. Offline tests run against the globally installed Pi 1.4.0, the installed-Pi load check passes, and a scripted terminal run of the installed Pi outside Herdr drew it without errors. Nobody has yet looked at it in an interactive Pi or Herdr session. See [verification records](CONTRIBUTING.md#verification-records).

## Install

Use one filtered settings entry for industrial-os, as described in [Pi installation](../README.md#install):

```json
{
  "source": "git:github.com/jigenator/industrial-os",
  "extensions": ["pi/droid-header/src/extension.ts"]
}
```

Merge this path into an existing industrial-os entry rather than adding a second source. For development use `pi install <industrial-os checkout>/pi/droid-header` after the root `npm install` in [setup](../../CONTRIBUTING.md#setup), which links the design system the header takes its colors and numerals from.

Then set Pi's `quietStartup` to `"header"` in `settings.json`:

```json
{ "quietStartup": "header" }
```

| `quietStartup` | What Pi 1.4.0 shows at startup with this extension |
| --- | --- |
| unset or `false` (Pi's default) | This header, then Pi's own `[Context]`, `[Skills]`, `[Prompts]` and `[Extensions]` listing, which repeats the manifest |
| `"header"` (recommended) | This header with a blank row above and below it; Pi's listing is hidden, and only its warnings and errors still show |
| `true` | This header as well, because it replaces Pi's empty placeholder, but without the blank rows; the listing is hidden too |

Starting Pi with `--verbose` shows Pi's listing whatever the setting.

## What it shows

In Pi's interactive TUI only; in RPC, JSON and print modes it does nothing.

| Field | Value |
| --- | --- |
| `DRD-C0DE` and the large unit number | The last four hex digits of the session ID; the same session keeps its ID |
| `SES-` | The first eight hex digits of the session ID |
| `02 COR` | The model and thinking level when the session started |
| `03 FRM`, `PI-` | Pi's version |
| `04 SCT`, `PNE-` | Herdr's workspace and tab, and its pane, from `HERDR_WORKSPACE_ID`, `HERDR_TAB_ID` and `HERDR_PANE_ID`; `--` outside Herdr |
| `05 MOD`, `06 SKL` | How many extensions and skills the manifest lists |
| `DEPLOYED` | The local time this Pi process started or opened the session; a `/reload` keeps it |
| `ASSIGNMENT` | The working folder's name and its Git branch (or short commit when detached), read from `.git/HEAD` without running Git; just the folder outside a repository |
| `MANIFEST` | Context files in Pi's load order; skills as Pi loads them, the prompts Pi has loaded, and the extensions Pi's settings enable, alphabetically; `MANIFEST UNAVAILABLE` and the reason when it cannot be built, such as `SETTINGS UNREADABLE` and the file |
| Key hints | Interrupt and clear with the keys Pi has bound, then `/` commands and `!` bash |

A fresh, empty session plays a 2.9-second intro: the frame draws, values decode, the manifest prints. Your first keystroke, a submitted message or an agent start settles it at once, and keystrokes are never taken from the editor. Resumed, forked and reloaded sessions show the settled header straight away. Set `NO_MOTION` to any non-empty value to turn the intro off. The layout and rates are in [design](docs/design.md).

The extension adds no commands, keys, settings or files, and makes no network or model calls.

## Limitations

- The manifest is rebuilt from Pi's settings with Pi's own loaders, once per session start, just after the header is first drawn. Skills are the ones Pi's skill loader accepts, with their frontmatter names and Pi's handling of duplicates. Prompts are the ones Pi has already loaded. Extensions are the ones Pi's settings enable, not proof that each loaded: loading them would run their code. Resources added or removed with command-line flags (`-e`, `--no-extensions`, `--skill` and similar), by another extension at run time, or by another extension during startup, may not be reflected.
- The header never starts a process, such as npm or Git, and never installs anything: it gives Pi an empty npm command, which Pi's own guard rejects before any process starts. Missing packages are left out. So are npm extensions installed the old way, in npm's global folder rather than under `~/.pi/agent/npm`: Pi finds those by running `npm root -g`, and loads them, but the manifest does not list them.
- When a settings file Pi reads cannot be parsed, the manifest shows as unavailable rather than listing what Pi could load without it.
- Project-scope skills, prompts and extensions are left out when the project is not trusted, as Pi leaves them out. Context files are listed regardless, because Pi loads them regardless.
- `02 COR` is the model at session start; the footer shows the live model after a switch.
- The header is drawn in the design system's Acid / Black colors rather than the Pi theme's, so it does not follow a light theme.
- The intro flashes the lamp about six times a second for 1.5 seconds and has no photosensitivity check; see [design](docs/design.md#motion).

The extension has no license yet; see the [repository's license note](../../docs/architecture.md#evolution-and-known-limits).

## Guides

- [Agent guide](AGENTS.md): rules and task routes.
- [Contributing](CONTRIBUTING.md): setup, exact checks and verification records.
- [Architecture](docs/architecture.md): modules, flow and host seams.
- [Conventions](docs/conventions.md): engineering rules and adoption gaps.
- [Design](docs/design.md): layouts, values, states, motion and colors.
- [Mission](docs/mission.md): scope and non-goals.
