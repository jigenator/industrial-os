# Contributing to the Pi extensions

The Pi extensions' toolchain, commands, checks, and verification records. The workflow for every change in the repository, including review and publication, is in the [root contributing guide](../CONTRIBUTING.md).

## Setup

Run each extension's commands from its folder, for example `cd pi/claude-interrupt`. You need Git, Node.js 22.19 or newer (checked on v22.23.0), npm, and an installed Pi for the load check. Install each extension's development dependencies separately:

```sh
npm ci
```

Development dependencies pin the Pi version the tests compile and run against; the README of each extension states which versions were tested.

From the repository root, `node --test` also runs the extensions' `test/*.test.ts` files, because Node 22.18 and newer strips TypeScript types by default. Those files fail with `ERR_MODULE_NOT_FOUND` until `npm ci` has run in each extension.

## Validation sequence

Run in order from the changed extension's folder, then the [repository-wide checks](../CONTRIBUTING.md#repository-wide-checks).

| Order | Command or review | Prerequisites/effects | Coverage |
| --- | --- | --- | --- |
| 1 | `npm run check` | `npm ci` done; read-only | TypeScript type check, then every test through Node's test runner |
| 2 | `printf '' \| pi --mode rpc --no-extensions --extension .` | Installed Pi; no model call. Model-pattern warnings are expected because other extensions, including model providers, are off | Pi discovers and loads the package; a load failure exits 1 |
| 3 | Use the changed behavior in interactive Pi inside Herdr | Installed Pi and Herdr; manual | Real input, rendering, and timing. Report as **not run** when skipped |

A required check that is skipped does not count as a pass.

## Moving an extension in

Bring the extension's history with it: in a temporary clone of its repository, rewrite every path under `pi/<name>/`, then merge that branch into a monorepo branch with `git merge --allow-unrelated-histories`. Merge the pull request with a merge commit, not a squash, or the history is lost. Then update its README's install instructions and its `package.json` `repository`, and add it to the [root README layout](../README.md#layout), [this folder's README](README.md#status), and the [AGENTS map](../AGENTS.md#supporting-documents).

## Verification records

**claude-interrupt**, after moving in at `pi/claude-interrupt/`, on Node v22.23.0 and Pi 1.0.4:

- `npm run check`: type check passed; 34 of 34 tests passed. The suite runs against Pi 0.99.1 development dependencies.
- Root `node --test`: 173 of 173 passed, including the 34 extension tests.
- Pi load check: exit 0. The same command with an extension that throws on load exits 1.
- Interactive Pi and Herdr: not run for the move. The extension's own README limits what its tests establish.
