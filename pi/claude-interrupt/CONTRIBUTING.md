# Contributing

Follow the [repository workflow](../../CONTRIBUTING.md) as well as this package's checks.

## Toolchain and setup

Use Node.js 22.19 or newer (checked on v22.23.0), npm, and an installed Pi for the load check. This is an ESM TypeScript package: Node strips types for tests, and `tsc --noEmit` is the only static type check. Imported design-system `.mjs` subpaths have colocated `.d.mts` declarations; the compile-only positive/negative contract in `test/design-system-types.ts` also runs through this command. Pi development dependencies are pinned to 0.99.1 in [package.json](package.json); runtime APIs come from the host's peer packages. There is no build, formatter or linter command.

First run `npm install` from the repository root to link `@industrial-os/design-system`. This is required for tests, strict type checking and local-path Pi loading; Pi's git install runs the root installation itself. Then, from `pi/claude-interrupt/`:

```sh
npm ci
```

This installs the lockfile's development dependencies into ignored `node_modules/`; it may access the npm registry. Do not commit that directory. Tests use isolated terminal transport and in-memory sessions, not a live model or provider account.

## Fast loop

From this package folder after setup:

```sh
node --experimental-strip-types --test test/extension.test.ts
```

This checks the queue harness and pure renderer. It does not replace the type check, real-loader integration suite or manual terminal check below.

## Full validation sequence

Source: [package.json](package.json), [tsconfig.json](tsconfig.json), and the two files under `test/`. Run in order after setup. `npm run check` combines steps 1 and 2.

| Order | Directory | Command | Prerequisites/effects | Coverage |
| --- | --- | --- | --- | --- |
| 1 | `pi/claude-interrupt/` | `npm run typecheck` | Development dependencies installed; no emitted files | Strict TypeScript checking of source and tests |
| 2 | `pi/claude-interrupt/` | `npm test` | Development dependencies installed; isolated terminal and in-memory session bridge; no provider call | All unit and real-loader integration tests |
| 3 | `pi/claude-interrupt/` | `printf '' \| pi --mode rpc --no-extensions --extension .` | Installed Pi; no model call; model-pattern warnings are expected and harmless because other extensions, including model providers, are off | Package discovery and extension loading; success exits 0, a throwing extension exits 1 |
| 4 | `pi/claude-interrupt/` | Manual: exercise the extension in interactive Pi inside Herdr | Installed Pi and Herdr; use the isolated development launch in [README](README.md#install); actual continuation may call the selected provider | Real Escape, drafts, continuation, marker timing, resize, focus, scrolling and cleanup |

Then follow the [repository-wide checks](../../CONTRIBUTING.md#repository-wide-checks). Record automated, load, and interactive checks separately as passed, failed, skipped or not run. A skipped required check is not a pass. The RPC load check is not interactive terminal verification.

## Test coverage

Tests use Node's built-in test runner. They cover one and several queued messages, steering/follow-up order, no-queue behavior, repeated Escape, re-interrupting a replay, failed-start recovery, draft preservation, delivery cleanup, abort/settle races, attachment fallback/rejection, and session cleanup. Deterministic animation tests cover all 75 forty-millisecond frames and the exact 3000 ms window, the plate flashes and right-to-left wipe, each bar's launch, grey turn and removal with one change per frame, the cell colors and attributes in every phase (decoded from a real Pi `Theme` in truecolor and 256-color modes, dark and light), fixed bar positions and clipping at widths 0–160, alignment with the native abort notice, late-timer catch-up and clock jumps, press/repeat/release timing, persistent history, saved markers, invisible redraw widgets, and timer cleanup. The integration test loads the real extension through Pi's loader, routes key events through the real `TuiMainScreen` input router with an isolated terminal transport, and dispatches lifecycle/input events through Pi's real asynchronous `ExtensionRunner`, using a real `SessionManager` to verify history persistence and model-context exclusion. Its terminal and local session bridge perform no provider call and do not constitute interactive/provider end-to-end verification.

The unit/harness checks live in [test/extension.test.ts](test/extension.test.ts); the real-loader checks live in [test/extension-runner.test.ts](test/extension-runner.test.ts).

## Making a change

Trace the relevant flow in [architecture](docs/architecture.md) and follow [conventions](docs/conventions.md). Add a focused regression at the lowest owning layer; update the runner test when Pi input ordering, entry persistence or disposal changes. For a Pi upgrade, inspect that version's extension/package documentation and public types, then run both automated and installed-host checks. Do not infer compatibility from type stripping alone.

## Refactoring

Keep structural edits separate from behavioral changes. Preserve the renderer/lifecycle seam, migrate its callers together, and remove obsolete paths rather than adding compatibility aliases. No module extraction or dependency is needed merely to make a diagram larger.

## Review checks

- Are queue ordering, unsupported input and failed-preflight recovery still explicit?
- Does the marker confirm only a real continuation, stay out of model context, and leave streaming, input and focus available?
- Are timer and listener disposal paths covered, including session replacement?
- Are new dependencies or abstractions justified by a current need and compared with the simplest public Pi/Node solution?
- Can a contributor reach the relevant rule and check from the agent guide without reading unrelated manuals?

## Keeping docs accurate

Update architecture for flow/contracts, conventions for engineering rules, design for human-facing behavior, and this guide for commands and evidence. Keep [AGENTS.md](AGENTS.md)'s supporting-documents map complete. Keep exact marker timing in design, not in README or duplicated rulebooks.

## Verification records

On **2026-10-07**, after the move into the monorepo, using **Node v22.23.0** and installed **Pi 1.0.4**:

- `npm run check`: type check passed; **34 of 34 tests passed** against the **Pi 0.99.1 development dependencies**.
- Non-interactive Pi load check: **exit 0**. A throwing-extension control was previously checked to exit 1; it was not rerun for this documentation conversion.
- Interactive Pi/Herdr check: **not run**.

The same suite was also run against installed Pi 1.0.4 earlier in the old repository. That is historical compatibility evidence, not a claim that this package's current locked test run uses 1.0.4.


### Design-system port verification

On **2026-10-07**, using **Node v22.23.0**, locked **Pi 0.99.1** development dependencies and installed **Pi 1.0.4**:

- `npm run check`: strict type check (including positive/negative declaration contracts) passed; **34/34 existing tests passed with their assertions unchanged**.
- Design-system `node --test`, before the later status-bar additions: **368/368 passed**, including 14 added default-color, element, motion and numeric-rejection tests; existing defaults/storybook checks still pass.
- Scratch golden comparison against `git show origin/main:pi/claude-interrupt/src/index.ts`, using the same pinned Pi dependencies: **604,072 byte-identical strings**, zero failures. It covers 469 elapsed samples (every 10 ms from -50 to 3100, every 40 ms grid boundary and adjacent millisecond, plus `undefined`), widths 0–160, both output pads, dark/light appearances and truecolor/256-color modes. The harness and original snapshot live outside the repository, not as shipped code.
- Checkout RPC load: **exit 0**, expected disabled-provider model-pattern warnings only.
- Simulated git installation: copied tracked working-state files plus new untracked source/declarations to a disposable directory outside the repository (without git/node_modules), ran root `npm install --omit=dev --legacy-peer-deps`, then loaded its `pi/claude-interrupt/src/index.ts` with installed Pi RPC: **install exit 0, load exit 0**, no extension load error. The disposable directory was removed.
- `git diff --check` and staged diff check: passed; no staged files.
- Real `pi install git:`, interactive Pi/Herdr, provider continuation, and Mermaid rendering: **not run**. No branch publication or native visual verification is implied by the simulated install or golden strings.
