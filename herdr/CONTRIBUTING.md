# Contributing

Follow the [repository workflow](../CONTRIBUTING.md) as well as this project's checks.

## Toolchain and setup

The maintained content is TOML read by Herdr. The checks use Node.js 22 with its standard library and the design-system package; there is no manifest, dependency or lockfile in this project. Run `npm install` once at the repository root so `@industrial-os/design-system` resolves; see [setup](../CONTRIBUTING.md#setup). The parser check needs an installed Herdr; it was run with Herdr 0.9.3.

## Validation sequence

| Order | Directory | Command | Prerequisites/effects | Coverage |
| --- | --- | --- | --- | --- |
| 1 | `herdr/` | `node --test` | Root install; reads `sidebar.toml` and `../pi/herdr-sidebar/docs/token-contract.md`; no writes | Every color is an exported palette or signal color; every token is in the contract's key list and every key has one row entry; width lock, row gap and theme values |
| 2 | `herdr/` | `HERDR_CONFIG_PATH="$PWD/sidebar.toml" herdr config check` | Installed Herdr; reads only that file; contacts no server and writes nothing | Herdr's own parser and validation accept the fragment as a config: prints `config: ok`, exit 0 |
| 3 | Herdr | Manual: merge into a config as in the [README](README.md#install), reload, and watch Pi panes running herdr-sidebar | Changes the live Herdr configuration | Rendering, colors, alignment with and without the scrollbar, every state |

Then follow the [repository-wide checks](../CONTRIBUTING.md#repository-wide-checks). Record every check as passed, failed, skipped or not run. Step 2 proves the file parses and validates, not how it looks.

## Making a change

Change the source first: a color in the design system, a token in [the token contract](../pi/herdr-sidebar/docs/token-contract.md). Then change `sidebar.toml`, keep each color's role comment accurate, update [the design](docs/design.md), and run the sequence.

## Verification records

Record each run with its date, Herdr version and results.

2026-10-08, macOS, Node 22.23.0, Herdr 0.9.3:

- Step 1, `node --test`: **3 of 3 passed**. Mutation check: a non-palette color and an unknown token each made their test fail.
- Step 2, `herdr config check` on the fragment: **`config: ok`, exit 0**. The same check on copies merged by hand into the live-spike configuration and into Herdr's `--default-config` output, in a temporary directory: **`config: ok`, exit 0** for both. A malformed token entry in a copy was rejected with a parse error, showing the rows are validated.
- Step 3, interactive: **not run** for this file. The spike configuration it was derived from was checked live on 2026-10-08, adding only the `$bar_unk` row entry here.

### Pi-only layout follow-up

2026-10-08, macOS, Node 22.23.0, installed Herdr 0.9.3:

- `node --test`: **5/5 passed**, no skipped/cancelled tests. Colors/tokens are checked inside `rows_by_agent.pi`; the regression requires no global `rows`, panel-wide `row_gap = 1`, and a decorative-grey non-bold `bar_idle`.
- `HERDR_CONFIG_PATH=<temporary copy of sidebar.toml> herdr config check`: **`config: ok`, exit 0**, read-only. No server contact or live configuration change.
- Root links/anchors, guide inventory, exact CLAUDE entrypoints, whitespace and publication checks passed. The architecture diagram renders with existing grok-mermaid 0.2.3, non-null art and no warnings.
- Interactive rendering/reload: **not run**. Merge only `rows_by_agent.pi` and panel-wide spacing; preserve any existing global `rows` and other agent overrides.

### SUB state

2026-10-08, macOS, Node 22.23.0, installed Herdr 0.9.3:

- `node --test`: **6/6 passed**. The new check reads the g1 state codes from the token contract and requires WRK and SUB accent, BLK and QNS critical, DNE primary and IDL/UNK decorative; removing the SUB rule made it fail.
- `HERDR_CONFIG_PATH=<temporary copy of sidebar.toml> herdr config check`: **`config: ok`, exit 0**. The same on a temporary copy of `herdr --default-config` with the fragment merged by hand: **`config: ok`, exit 0**. Read-only; no server contact or live configuration change.
- Interactive rendering: **not run** for this change.
