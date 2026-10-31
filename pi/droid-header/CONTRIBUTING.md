# Contributing

Follow the [repository workflow](../../CONTRIBUTING.md) and [project guide](AGENTS.md).

## Toolchain and setup

Use Node.js 22.19+ and npm. The source is TypeScript ESM, run by Pi's loader and by Node type stripping in tests. There is no development dependency, lockfile, build, formatter, linter or standalone typecheck; see [adoption gaps](docs/conventions.md#adoption-gaps). Pi supplies the two peers; the design system comes from the root link, so run `npm install` once at the repository root (not here) as in [root setup](../../CONTRIBUTING.md#setup).

Tests that touch Pi need the installed host: the package that holds the `pi` command the load check runs. From `pi/droid-header/`:

```sh
export PI_HOST_ROOT="$(realpath "$(command -v pi)" | sed 's|/dist/.*||')"
test -f "$PI_HOST_ROOT/dist/index.js"
```

This only finds an existing installation; never install a host to make a test pass. A missing host is a failed prerequisite, not a skipped test. `$(npm root -g)/@earendil-works/pi-coding-agent`, which status-bar documents, works only when `pi` was installed under the current npm's global prefix; with a version manager such as Volta it can name a folder without Pi.

## Full validation sequence

| Order | Directory | Command | Effects | Coverage |
| --- | --- | --- | --- | --- |
| 1 | `pi/droid-header/` | `export PI_HOST_ROOT=…` and `test -f` above | Resolves the `pi` command | The host prerequisite |
| 2 | `pi/droid-header/` | `PI_HOST_ROOT="$PI_HOST_ROOT" npm test` | Temporary folders, and one child Node process it bounds at 10 s; no network or model | `node --test test/*.test.ts`: the 104- and 64-column goldens, the 40–55 and minimal layouts, width sweeps 1–300, states, the CRT boot intro (purity, settled end, stagger cap, settled failure rows, late manifest), value rules and the Escape hint, branch reading, the manifest through the installed Pi's loaders in temporary folders with every `child_process` function made to throw, and the extension's lifecycle with a manual clock |
| 3 | an empty temporary directory | `echo '{"type":"get_commands","id":"1"}' \| PI_CODING_AGENT_DIR=<temp agent dir> pi --mode rpc --no-extensions -e <checkout>/pi/droid-header/src/extension.ts` | Pi writes its first-run files into the temporary agent folder; no model call | Loading through the installed `pi`. It passes when it exits 0 with `"success":true` and nothing on stderr; the extension registers no commands, so the list is empty. A throwing extension exits 1 with `Failed to load extension` |

Then run the [repository-wide checks](../../CONTRIBUTING.md#repository-wide-checks). RPC mode does not draw the header, so step 3 proves loading only. For a design-system change, also run its checks; the goldens here fail if the unit plate, the surface or a consumed color changes.

Interactive validation is separate and is not part of the sequence: in a disposable Pi session inside Herdr, with `quietStartup` set to `"header"`, check the intro on `pi` and `/new`, that typing during it settles at once and keeps the keystroke, `/resume` and `/reload` showing it settled, resizing across 100, 56 and 40 columns, `/new` once claude-interrupt is enabled (the Escape hint turns to `steer` when the manifest arrives), and the colors.

## Making a change

Trace state → `facts.ts` → `header.ts` → `extension.ts` before changing shared behavior. Put a layout or timing change in `header.ts` with a test at the lowest layer that shows it, and update the goldens only for an approved visual change, regenerating them from the [approved reference](docs/design.md#approved-reference) on its own sample state rather than from the header, and keep the hairline ink [deviation](docs/design.md#deviations-from-the-approved-reference) out of the comparison. On a Pi upgrade, reread the [host seams](docs/architecture.md#host-seams). Update user behavior and limits in the README, flow and seams in architecture, presentation and rates in design, and engineering gaps in conventions.

## Verification records

2026-10-27, first version, macOS 27.0.1, Node 22.23.4 (Volta), npm 10.9.9, installed Pi 1.4.0 at `~/.local/lib/node_modules/@earendil-works/pi-coding-agent`, found by step 1; `npm root -g` named Volta's folder, which has no Pi. The design-system additions it uses (`textGrid`, `HEX_FONT`, the heavy junctions and `PI_CHROME.lamp`) landed first, with their own record in [design-system contributing](../../design-system/CONTRIBUTING.md#droid-header-additions-verification-2026-10-27).

- `PI_HOST_ROOT="$PI_HOST_ROOT" npm test`: **28/28 tests**, 0 failed, skipped or cancelled. They cover:
  - the settled frame at 104 columns against the approved mock: every cell's text and foreground and background color, with public-safe manifest names, and barcode cells against the design system's generator
  - every line exactly the width for widths 1–160 across six states (ready, pending, unavailable, empty holds, unknown values outside Herdr and Git, hostile long and wide text) and up to 19 intro times; closed frames in the compact and full layouts; only ASCII, design-system glyphs and sanitized caller text drawn
  - unknown values as `--` and `????`, the failure in critical and never animated, empty holds as `00`; controls, C1 and bidi marks removed; grapheme clipping
  - the layout thresholds, the intro timeline (lamp, plate warm-up, decode, starburst steps, hold flash, hints last, settled at 2.9 s) and a late manifest extending the intro
  - session codes, Herdr codes, model labels and Pi's placeholder model, HEAD parsing, ASSIGNMENT, extension naming on a real-shaped resolution with public names, skills, prompts and context paths
  - branch reading through directories, worktree `.git` files (relative and absolute), detached and broken HEADs, and the 1 KiB cap; the manifest's trust filtering, `"skip"` for missing packages and failure reasons; the installed Pi's real `SettingsManager`, `DefaultPackageManager` and `loadProjectContextFiles` on a temporary agent folder naming an uninstalled npm package
  - the extension through the host's jiti: fresh sessions animating with one 50 ms interval and settling with no timer or listener left; resume, fork, reload, content and `NO_MOTION` settled with none; settling on a keystroke (not consumed), `input` and `agent_start`; disposal on shutdown, replacement and a new session; nothing outside TUI mode; the 5 s manifest timeout and a later answer (superseded: the timeout is gone, see the record below); ANSI lines within every width across the intro
- One-off strict typecheck, not a gate: claude-interrupt's TypeScript 5.9.3 (`strict`, NodeNext, `allowImportingTsExtensions`, `skipLibCheck`) over the four `src/` files with the Pi peers mapped to the installed host's declarations: exit 0.
- Load check, step 3, from an empty temporary directory: exit 0, `"success":true` with an empty command list, empty stderr. The same with `-e <checkout>/pi/droid-header`, loading through the package manifest: exit 0, empty stderr. As a control, a temporary extension that throws exited 1 with `Failed to load extension`.
- Whole-monorepo local install with the new root entry: from an empty temporary directory, `pi install <worktree>` into a temporary agent folder exited 0; the RPC `get_commands` then exited 0 with `"success":true` and empty stderr, listing `flag`, `footer-motion`, `pane-naming` and `recap` from the checkout.
- Scripted terminal run, separate from interactive evidence. A scratch Python driver (not committed) started the installed `pi --no-extensions -e src/extension.ts` in a pseudo-terminal at 104×60 with a temporary agent folder and empty working folder, Herdr variables removed and a truecolor `TERM`. It read the output for 4.5 s, sent Ctrl+C and Ctrl+D, then stopped Pi.
  - Regular and fullscreen modes, motion on and `NO_MOTION=1`, at a fixed size and resized 104 → 60 → 30 → 150 columns during the intro: all eight runs exited 0 and the output never contained Pi's width error; the settled starburst and `escape interrupt · ctrl+c clear · / commands · ! bash` were drawn. With motion on at a fixed size, 22–23 header frames were written, against 1–2 with `NO_MOTION`.
  - The first run found that Pi records a `thinking_level_change` entry before `session_start`, so the intro never played under the initial zero-entries rule. The rule now ignores setting entries, with a test.
  - A key typed 0.9 s into the intro: no intro frame after it, and the settled starburst drawn.
  - `quietStartup` `false` drew Pi's `[Extensions]` listing below the header; `"header"` did not; `true` still drew the header, in both modes.
- Fidelity against the approved mock during development: scratch scripts (not committed) compared every cell of the settled frame at 100, 104, 120 and 140 columns with the mock's output and found no difference outside the barcode, which is seeded differently by design. That was before the `ctrl+o more` hint was dropped; the golden test keeps the 104-column comparison current.
- Interactive Pi and Herdr, a pushed git-source install, 256-color and other terminals, and other platforms: **not run**.

2026-10-27, review fixes, same machine and host. Unreadable settings became a failure; skills come from Pi's skill loader and prompts from Pi's loaded commands; the manifest is built in Pi's process without ever starting a process, Pi's own guard rejecting an empty npm command, after review found that Pi's resolution can block on `npm root -g` and that `DefaultResourceLoader.reload()` reloads settings and installs missing packages (a probe saw it run `npm root -g` and `npm install`); and the real session values in fixtures and frames were replaced with synthetic ones. A worker thread and then a killable child process were tried first and dropped: a worker cannot be stopped while it blocks, and killing a process group by ID after its leader is reaped can hit an unrelated group. An npm command pointing at a path that should not exist was tried next and dropped: such a path can be created by someone else.

- `PI_HOST_ROOT="$PI_HOST_ROOT" npm test`: **30/30 tests**, 0 failed, skipped or cancelled, three runs in a row. New or changed:
  - against the installed Pi with temporary agent and working folders: a skill renamed by frontmatter, one without a description, one with malformed frontmatter and a duplicate name, a project skill only when trusted, Pi's prompt names, and a marker extension that never ran; malformed global settings, and malformed project settings when trusted, as `SETTINGS UNREADABLE`
  - in a child Node process killed after 10 s, with every `child_process` function replaced before Pi loads by one that records the call and throws, and uninstalled npm and git packages configured: no call recorded, nothing installed or cloned, the manifest ready with both packages left out
  - a Pi loader that throws: unavailable with its first line
  - the extension: the build starts on the turn after the first draw with Pi's `prompt` commands, never for a header replaced or shut down first, and a throwing source or Pi call shows as unavailable
  - mutation checks, reverted: without the npm override, and with the earlier `<temp>/pi-droid-header-no-npm/npm` command, the spawn test recorded a `spawnSync` and failed; building before the first draw failed the timing test
  - the golden frame regenerated from the approved mock with the synthetic values
- The one-off strict typecheck above, over the four `src/` files: exit 0.
- The manifest on this machine's own settings, with `trusted` set and prompts taken from Pi's loader, from the main checkout and from this worktree: ready, **2/29/8/27**, skill names identical to Pi's loader; 7–11 ms per build in a warm process and 21 ms for the first build in a fresh one.
- Load check, step 3, both forms: exit 0, `"success":true`, empty stderr.
- One scripted terminal run as above, regular mode, motion on, with a prompt and a skill in the temporary agent folder: exit 0, no width error, 22–23 header frames across two runs, and the header listed `PRM 01 /plan` and `SKL 01 review`, so Pi's commands held the prompt when the build ran.
- The design system's checks after its example and test values changed (at `a9f0df7`): **524/524**.
- Windows, a light theme, interactive Pi in Herdr, and an old-style global npm install: **not run**.

2026-11-01, the approved redesign (branch `feature/droid-header-redesign`), same machine: macOS, Node 22.23.4, installed Pi 1.4.0 found by step 1. The header becomes the unit plate, a frosted hint strip and a ledger on the chat pane's surface, with the CRT boot intro; the design-system additions it uses (`elements/unit-plate`, `motions/crt-boot`, `foundation/barcode`, `aluminiumAt`, `composeSurface`'s `dotClearance` and `dotFloor`, the `R` pixel glyph and `◣ ◥`) landed first in the same branch, with their own [record](../../design-system/CONTRIBUTING.md#droid-header-redesign-additions-2026-11-01).

- **Automated, step 2:** `PI_HOST_ROOT="$PI_HOST_ROOT" npm test`: **38/38 tests**, 0 failed, skipped or cancelled, in about 17 s. They cover:
  - the settled header at 104 and 64 columns against goldens generated by running the approved reference on its own sample state: every cell's text, foreground, background and weight, with the plate's hairline ink the one listed deviation
  - the plate-only layout from 40 to 55 columns, the single settled line below 40, and the thresholds at 100, 56 and 40
  - every line exactly the width at every width 1–300 for several states, and sampled intro times, with no throw; only ASCII, design-system glyphs and measured caller text drawn; unknown values as `--`, `????` and `DRD-????`; controls and bidi marks removed and over-long names clipped with `…`, hostile text through the intro too
  - the intro: the same frame for the same state, width, time and seed; the settled frame at and after `introEnd`; every row starting within 2.1 s however tall the header; `MANIFEST UNAVAILABLE` settled in every intro frame; a manifest arriving mid-intro typing from its arrival, and one arriving after it settled
  - `interruptAction` and `isClaudeInterrupt` (bare and scoped names, a package path, look-alike names rejected); the manifest's `steering` from a local package whose only extension is claude-interrupt, against the installed Pi, without running it
  - the extension through the host's jiti: gating as before, settling on a keystroke, `input` and `agent_start`, the frame-based tick settling at its frame's end, the 8 s backstop for an undrawn header, the Escape hint turning to `steer` with the manifest, and ANSI lines within every width across the intro
- **Automated, outside the sequence:** a one-off strict typecheck, claude-interrupt's TypeScript 5.9.3 from the primary checkout's install (`strict`, NodeNext, `allowImportingTsExtensions`, `skipLibCheck`) over the four `src/` files with the Pi peers mapped to the installed host's declarations: exit 0.
- **Pi load, step 3:** from an empty temporary directory with a temporary agent folder, `get_commands` exited 0 with `"success":true`, an empty command list and empty stderr, both with `-e …/src/extension.ts` and with `-e …/pi/droid-header`. RPC mode does not draw the header.
- **Mockup fidelity, browser only:** a verification page built outside the repository by the operator's mockup tooling (xterm.js 6.0 with its WebGL renderer in headless Chrome) draws the real `settledFrame` and `frameAt`, measured with the installed Pi's `visibleWidth`. Settled at 104 and 64 columns: 0 cells differ from the mockup other than 170 and 110 hairline-ink cells. The intro booted at seed 0, the mockup's own, sampled every 10 ms: 0 differences other than hairline ink (including where a flicker, the refresh bar or a tear carries it) over 245 and 303 frames, ending at 2450 and 3024 ms as the mockup does. With the session's seed (0xBEEF) the intro ends at 2292 ms at 104 columns and 2924 ms at 64. Every settled and played frame passed the width and glyph check. This is a browser rendering, not a terminal.
- **Measured bounds, scratch script:** across 0–200 manifest entries per hold and 40–300 columns, intro ends ran 1.9–3.5 s up to 200 columns and at most 4.3 s at 300 columns; 300 other seeds at 104 and 300 columns stayed within that. A settled render takes about 9 ms and an intro frame about 4 ms at 104 columns.
- **Not run:** interactive Pi and Herdr (the intro in a real terminal, settling on a real keystroke, resize, `/new`, `/reload`, colors and glyphs such as `⟁`, `◢ ◣ ◤ ◥` and the barcode at a real font size); a scripted pseudo-terminal run of the installed Pi; 256-color and light-background terminals; Windows; a pushed git-source install.
