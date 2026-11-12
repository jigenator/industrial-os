# Agent guide

Purpose: Industrial OS in the Herdr desktop app: the Acid / Black theme and the Industrial OS sidebar, a mod and its layout; see [README.md](README.md). This project owns its standards and toolchain within the monorepo. Follow the [root guide](../AGENTS.md) as well.

## Critical engineering rules

- The mod imports only inside its folder: `gpui-kit`, `gpui-base` and `herdr` in `main.js`, otherwise `./name.js`. Rules live in pure modules with no host import. Check: `test/industrial-os-layout.test.mjs`.
- Unknown is never zero, and a label counts only on a live terminal whose agent `app` is `pi`, with `version` 1. The label is the frozen `io.signals.v1` publication of the [signals-collector snapshot](../pi/signals-collector/docs/contract.md); change it there first. Check: `test/industrial-os.test.mjs`.
- Every color is a `theme()` name in the mod, or a design-system value in a theme file; the design system owns the values. Check: `test/app-theme.test.mjs` imports `@industrial-os/design-system/foundation/palette` and `signal-colors` by package name.
- Never change the running app to check this project: no installing, `herdr-app do`, `layout.*` or `mod.*` commands. `herdr-app check` and the tests only read. Commands are in [CONTRIBUTING.md](CONTRIBUTING.md).
- The layout is Herdr's shipped `main` with two changes, the sidebar lists and Lunalee's column; keep it that way, and record the shipped copy it follows in `test/fixtures/`. The column's ids, size and terminal name are a frozen contract with Lunalee; Lunalee's install supplies its mod and terminal, never this project. Check: `test/industrial-os-layout.test.mjs`.

## Read for the task

| Task | Read before changing |
| --- | --- |
| A sidebar value, rule or state | [Design](docs/design.md#sidebar), the [snapshot contract](../pi/signals-collector/docs/contract.md), then [contributing](CONTRIBUTING.md) |
| How the sidebar looks | [Design](docs/design.md), [root design](../docs/design.md) and [the design-system rule](../docs/conventions.md#design-system-components); the visual design is deferred, a decision for the operator |
| The layout or a Herdr app update | [Architecture](docs/architecture.md), `~/.config/herdr-app/AGENTS.md` (Layouts, Mods) and `herdr.d.ts` |
| A palette value | [Root design](../docs/design.md#acid--black) and [the package decision](../docs/decisions/in-repo-design-system-package.md); the design system changes first |
| A new mod, layout or theme | [Architecture](docs/architecture.md#where-the-next-change-belongs) and [conventions](docs/conventions.md) |

## Where work belongs

| Change | Start here | Boundary |
| --- | --- | --- |
| What a sidebar value means | `mods/industrial-os/` pure modules (`signals.js`, `agent.js`, `spaces.js`, `format.js`, `model.js`) | No `gpui-kit` or `herdr` imports; Node-tested |
| How the sidebar draws, reads Herdr or runs commands | `mods/industrial-os/main.js` | herdr-app's `gpui-kit`, `gpui-base` and `herdr` modules; `theme()` colors |
| The sidebar's place in the window, and Lunalee's column | `layouts/industrial-os.json` | Shipped `main` with only the sidebar lists replaced and the `lunalee` column added; the column's contents come from Lunalee's install |
| The Herdr desktop theme | `themes/acid-black.json` | herdr-app's theme file format; design-system colors, including `HERDR_TERMINAL`; [theme design](docs/design.md#theme) |
| Checks | `test/` | Node's test runner; reads files, imports only the mod's pure modules and the design-system package |
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
| [docs/design.md](docs/design.md) | What the sidebar shows and means; the chrome theme | Changing anything a user sees in the sidebar or Herdr's chrome colors |
| [Snapshot contract](../pi/signals-collector/docs/contract.md) | The snapshot fields the label carries | Changing what the sidebar reads |
| [Root AGENTS](../AGENTS.md) | Shared rules and the repository guidance map | Working in this repository |
