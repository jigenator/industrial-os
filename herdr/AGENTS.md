# Agent guide

Purpose: the Herdr configuration that renders Industrial OS in Herdr, today the agents-sidebar fragment for the herdr-sidebar Pi extension; see [README.md](README.md). This project owns its standards and toolchain within the monorepo. Follow the [root guide](../AGENTS.md) as well.

## Critical engineering rules

- Every color is a design-system value; the design system owns them. Change the design system first, then the fragment. Check: `test/sidebar.test.mjs` imports `@industrial-os/design-system/foundation/palette` and `signal-colors` by package name.
- Token names, widths and meanings are owned by [the token contract](../pi/herdr-sidebar/docs/token-contract.md) in pi/herdr-sidebar. Change the contract first, then the fragment. Check: `test/sidebar.test.mjs` reads the contract's key list and requires every key to have exactly one row entry.
- Never modify a live Herdr configuration or server to check this project. `herdr config check` with `HERDR_CONFIG_PATH` on a file in this checkout or a temporary copy only reads it. Commands are in [CONTRIBUTING.md](CONTRIBUTING.md).
- Herdr has no config includes; the fragment is merged by hand and must stay a valid config on its own.

## Read for the task

| Task | Read before changing |
| --- | --- |
| A row, rule, color or the width lock | [Design](docs/design.md), the [token contract](../pi/herdr-sidebar/docs/token-contract.md), [root design](../docs/design.md), then [contributing](CONTRIBUTING.md) |
| A palette value | [Root design](../docs/design.md#acid--black) and [the package decision](../docs/decisions/in-repo-design-system-package.md); the design system changes first |
| A new Herdr configuration file | [Architecture](docs/architecture.md#where-the-next-change-belongs) and [conventions](docs/conventions.md) |
| A Herdr version change | [Contributing](CONTRIBUTING.md), then the Herdr version's configuration reference and source |

## Where work belongs

| Change | Start here | Boundary |
| --- | --- | --- |
| Sidebar rows, rules, theme block, width lock | `sidebar.toml` | Herdr's config schema; design-system colors; contract tokens |
| Checks | `test/` | Node's test runner; reads files, imports only the design-system package |
| Token values or meanings | [pi/herdr-sidebar](../pi/herdr-sidebar/AGENTS.md) | Not here |

## Implement and verify

Use the [validation sequence](CONTRIBUTING.md#validation-sequence), then the [repository-wide checks](../CONTRIBUTING.md#repository-wide-checks). Keep the parser check, automated checks and interactive Herdr evidence separate.

## Supporting documents

| Document | Purpose | Read when |
| --- | --- | --- |
| [README.md](README.md) | Purpose, status, how to merge the fragment, limitations | Using the configuration or changing its install steps |
| [AGENTS.md](AGENTS.md) | Project rules and routes | Starting work in this project |
| [CLAUDE.md](CLAUDE.md) | Runtime import of this guide | Checking agent entry points |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Toolchain, commands, validation and records | Making or verifying any change |
| [docs/architecture.md](docs/architecture.md) | Files, dependencies, flows and invariants | Changing what the configuration depends on or adding a file |
| [docs/conventions.md](docs/conventions.md) | Project rules for configuration files and checks | Writing or reviewing configuration or checks |
| [docs/design.md](docs/design.md) | The sidebar experience: layout B, states, colors, width | Changing anything a user sees in the sidebar |
| [Token contract](../pi/herdr-sidebar/docs/token-contract.md) | Canonical token names, widths and rules | Changing a row's tokens |
| [Root AGENTS](../AGENTS.md) | Shared rules and the repository guidance map | Working in this repository |
