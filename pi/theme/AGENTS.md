# Agent guide

Purpose: the `industrial-os` Pi theme, one JSON file whose colors all come from the design system. This project supplements the [root guide](../../AGENTS.md) and [Pi guide](../AGENTS.md); usage is in the [README](README.md).

## Critical engineering rules

- Every color is a design-system value in `vars`, named after its design-system key; tokens name variables, never literal colors. A color the design system lacks is added there first, as `PI_CHROME` was for `bone`. Check: `test/theme.test.mjs`.
- The theme must stay valid for Pi's schema; Pi's RPC mode does not load themes, so an invalid file shows only in the check or in an interactive start. Check: `test/theme.test.mjs` runs Pi's own validator and loader.
- Acid marks highlights only, and warning and critical keep their roles. Changing which tokens use them is a design change. Check: the pinned token tests.

## Read for the task

| Task | Read before changing |
| --- | --- |
| A token's color | [Design](docs/design.md), [root design](../../docs/design.md#acid--black), then [contributing](CONTRIBUTING.md) |
| A new color | [The color decision](../../docs/decisions/in-repo-design-system-package.md) and the [foundation guide](../../design-system/foundation/README.md#pi-chrome-colors) first |
| The check or a Pi upgrade | [Architecture](docs/architecture.md), [conventions](docs/conventions.md), then contributing |

## Where work belongs

| Change | Start here | Boundary |
| --- | --- | --- |
| Colors of Pi's interface | `industrial-os.json` | Design-system values only, by variable |
| How the theme is checked | `test/theme.test.mjs` | Design system by package name; Pi through `PI_HOST_ROOT` |
| Packaging | `package.json` here and `pi.themes` in the root `package.json` | No runtime dependency |

## Implement and verify

Use the [validation sequence](CONTRIBUTING.md#full-validation-sequence), then the [repository-wide checks](../../CONTRIBUTING.md#repository-wide-checks). Keep automated and interactive evidence separate.

## Supporting documents

| Document | Purpose | Read when |
| --- | --- | --- |
| [README.md](README.md) | Purpose, install and limits | Using the theme or changing its public usage |
| [AGENTS.md](AGENTS.md) | Project rules and routes | Starting work here |
| [CLAUDE.md](CLAUDE.md) | Runtime import of this guide | Checking instruction entry points |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Commands, checks and evidence | Making or verifying any change |
| [docs/architecture.md](docs/architecture.md) | Files, dependencies, host seams and invariants | Changing the check, packaging or Pi version |
| [docs/conventions.md](docs/conventions.md) | Engineering rules and gaps | Writing or reviewing the theme or its check |
| [docs/design.md](docs/design.md) | What each part of Pi gets, and contrast | Changing any color |
