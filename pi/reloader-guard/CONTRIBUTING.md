# Contributing

Follow the [repository workflow](../../CONTRIBUTING.md) and the [project guide](AGENTS.md).

## Toolchain and setup

Node.js 22.19+ (type stripping) and an installed Pi for the load check. No development dependency, lockfile, build or type check ([gap](docs/conventions.md#adoption-gaps)); the tests import host types only, so they need no Pi. The guard imports nothing from the root install.

## Validation sequence

| Order | Directory | Command | Effects | Coverage |
| --- | --- | --- | --- | --- |
| 1 | `pi/reloader-guard/` | `npm test` (`node --test test/*.test.ts`) | Opens loopback listeners and one temporary file; no network, Pi, `hc` or Herdr | The label, ready/draft/busy probes without the draft text, every version, token, action and session refusal, reload and quit through the internal command, a draft typed after dispatch, the swallowed input, the TUI and terminal gates, an unwritten session, a failed publication |
| 2 | an empty temporary directory | `echo '{"type":"get_commands","id":"1"}' \| PI_CODING_AGENT_DIR=<temp agent dir> pi --mode rpc --no-extensions -e <checkout>/pi/reloader-guard/src/extension.ts` | Pi writes first-run files into the temporary agent folder; no model call | Loads in the installed Pi: exit 0, `"success":true`, `pi-reloader-guard-control` with source `extension`, nothing on stderr |

Then the [repository-wide checks](../../CONTRIBUTING.md#repository-wide-checks). The live check of the guard with the mod in Herdr desktop is recorded with the mod in [the Herdr contributing guide](../../herdr/CONTRIBUTING.md#pi-reloader); it changes the running app and needs the operator's permission.

## Making a change

A protocol change starts in [the contract](docs/contract.md), then this extension and `herdr/mods/pi-reloader/reloader.js` with both test files. Keep every new refusal path covered by a test that shows no action was taken.

## Verification records

### Contract version 2

2026-11-17, macOS, Node 22.23.4 (Volta), installed Pi 1.5.2, hc 0.1.20:

- Step 1: **11/11 passed**, 0 failed, skipped or cancelled.
- Step 2: exit 0, `"success":true`, the one extension command `pi-reloader-guard-control` with source `extension`, stderr empty.
- Live, with three throwaway Pis started with `--no-extensions -e <this file> --no-tools` in a throwaway Herdr desktop space: see [the Herdr record](../../herdr/CONTRIBUTING.md#pi-reloader). Each published `io.pi-reloader.v2` with a port and token, answered probes, reloaded (new token) and quit for a resume.
- Not run: a type check, the publishing-failure warning in a running Pi, and installation from the git package.
