# Contributing

Follow the [repository workflow](../../CONTRIBUTING.md) as well as this package's checks.

## Toolchain and setup

Use Node.js 22.19 or newer and an installed Pi; checked with Node 22.23.0 and Pi 1.0.4 on macOS. The Herdr API it uses was read in the Herdr 0.9.3 source and socket documentation; see [architecture](docs/architecture.md#reporting-to-herdr). The extension declares Pi's packages as peers and has no dependencies, development dependencies or lockfile; like status-bar, its tests run against the globally installed Pi. It does not import the design system, so its own checks do not need the root install.

Tests that load source or Pi need the installed host root. From `pi/herdr-sidebar/`:

```sh
export PI_HOST_ROOT="$(npm root -g)/@earendil-works/pi-coding-agent"
test -f "$PI_HOST_ROOT/dist/index.js"
```

This only discovers an existing global installation. Do not run an installer to make a test pass. The tests start a fake Herdr server on a temporary Unix socket and set `HERDR_ENV`, `HERDR_PANE_ID` and `HERDR_SOCKET_PATH` to it for each case, so they never reach a live Herdr even when run inside one. They need a POSIX system with Unix sockets.

## Fast loop

From `pi/herdr-sidebar/` after setting `PI_HOST_ROOT`:

```sh
node --experimental-strip-types --test test/tokens.test.ts
```

This checks the token builder and snapshot validation against the [token contract](docs/token-contract.md). It does not cover the socket client, the sender or the lifecycle.

## Full validation sequence

Source: `package.json` and the files under `test/`.

| Order | Directory | Command | Prerequisites/effects | Coverage |
| --- | --- | --- | --- | --- |
| 1 | `pi/herdr-sidebar/` | `export PI_HOST_ROOT="$(npm root -g)/@earendil-works/pi-coding-agent"` | Existing global Pi; reads npm's global root | Locates host-provided peers |
| 2 | `pi/herdr-sidebar/` | `test -f "$PI_HOST_ROOT/dist/index.js"` | No writes | Fails clearly when the host is absent |
| 3 | `pi/herdr-sidebar/` | `PI_HOST_ROOT="$PI_HOST_ROOT" npm test` | Creates and removes temporary sockets and a fake collector extension; no network; takes about five seconds | Token contract, snapshot validation, socket client, sender, and the real Pi loader and lifecycle against the fake Herdr server |
| 4 | `pi/herdr-sidebar/` | `printf '' \| pi --mode rpc --no-extensions --extension .` | Installed Pi; no model call; model-pattern warnings are expected because other extensions are off. In RPC mode the extension reports nothing, even inside Herdr | Package discovery and loading through the installed `pi` command; success exits 0, a throwing extension exits 1 |
| 5 | Herdr pane | Manual: run Pi with this extension and signals-collector in a Herdr pane whose config has the [sidebar rows](../../herdr/README.md) | Installed Pi, Herdr 0.9.3 or newer and the merged configuration; changes the live sidebar | Rows, colors, alignment with and without the scrollbar, state changes, question rows, shutdown clear |

Then follow the [repository-wide checks](../../CONTRIBUTING.md#repository-wide-checks). Record every check as passed, failed, skipped or not run. A missing host is a failed prerequisite. The RPC load check is not interactive verification, and the fake Herdr server is not Herdr. There is no type check, formatter, linter or build.

## Making a change

1. Change the [token contract](docs/token-contract.md) first when a token's meaning changes, then `src/tokens.ts` and `test/tokens.test.ts`, then the rows in `herdr/sidebar.toml` and that project's check.
2. Put Herdr protocol details in `src/herdr-client.ts`, report composition in `src/sender.ts`, and Pi lifecycle in `src/extension.ts`.
3. Model a new Herdr behavior in `test/fake-herdr.ts` from the Herdr source of the version in use, and cite it there.
4. Run the focused test while iterating and the full sequence before handoff.

## Review checks

- Does every displayed value stay truthful: unknown shown as unknown, a failed report never recorded as accepted?
- Can anything report outside TUI mode, outside Herdr, or after shutdown?
- Does `herdr:blocked` stay balanced on every path, including session replacement?
- Are sockets and timers bounded, unref'd and disposed?
- Does the change keep the one source and the clock-based sequence?

## Verification records

Record each run with its date, Node, Pi and Herdr versions and results, keeping automated, Pi-load and interactive evidence separate.

2026-10-08, macOS, Node 22.23.0, installed Pi 1.0.4, Herdr 0.9.3 source read:

- `npm test` (steps 1–3): **43 of 43 tests passed**, in three consecutive runs.
- Non-interactive Pi load check (step 4): **exit 0**, with the expected model-pattern warnings only. A throwing-extension control exited 1 in the same session.
- Simulated git install: the tracked and new files copied to a temporary directory without `.git` or `node_modules`, root `npm install --omit=dev --legacy-peer-deps` (0 vulnerabilities), then installed Pi in RPC mode loaded herdr-sidebar, status-bar and claude-interrupt from the copy: **exit 0**, no load error. Real `pi install git:` **not run** (no push).
- Interactive Pi/Herdr check (step 5): **not run**. No live Herdr behavior is claimed; the live spike that verified the geometry used a throwaway script, not this extension.
- The signals-collector extension did not exist on this branch; every snapshot came from a fake collector built to the frozen contract.
