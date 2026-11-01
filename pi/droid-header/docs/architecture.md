# Architecture

## Modules and dependencies

TypeScript ESM under `src/`, run by Pi's loader and by Node type stripping in tests. It imports Node `fs/promises`, `os` and `path`; the host packages `@earendil-works/pi-coding-agent` (`VERSION`, `keyText`, `getAgentDir`, `SettingsManager`, `DefaultPackageManager`, `loadSkills`, `loadProjectContextFiles`, types) and `@earendil-works/pi-tui` (`rgbColor`, `foregroundAnsi`, `backgroundAnsi`, `visibleWidth`, `truncateToWidth`, types); and the root-linked design system by exported subpath: `foundation/cells` (`resolveStyle`), `foundation/signal-colors`, `foundation/surface` (`composeSurface`), `foundation/surface-palette`, `elements/unit-plate` and `motions/crt-boot`. It imports no other extension.

| Module | Owns | Tests |
| --- | --- | --- |
| `src/header.ts` | The pure render core: `settledFrame(state, width, measure)` lays out the hanging, stacked, plate-only and minimal layouts (the unit plate, the frosted strip and the ledger on the surface) and returns the settled lines with what the intro needs (seed, the plate's paint, the floor's dots, a late manifest's rows); `frameAt(frame, t)` runs the CRT boot at intro time `t`; `introEnd(frame)`, memoized per frame; `renderHeader` composes them. Text sanitizing and grapheme fitting live here | `test/header.test.ts`, including the 104- and 64-column goldens |
| `src/facts.ts` | Pure derivations: session codes, Herdr codes, the MODEL label, `.git/HEAD` parsing, ASSIGNMENT, the clock, extension names, context paths, and the Escape hint's action (`interruptAction`, `isClaudeInterrupt`) | `test/facts.test.ts` |
| `src/sources.ts` | `readBranch` (bounded `.git` reads), and `buildManifest` through the Pi exports it is passed, including whether an enabled extension's path is claude-interrupt (`steering`); both resolve to a value | `test/sources.test.ts`, against the installed Pi, with every `child_process` function made to throw |
| `src/extension.ts` | Pi wiring: session lifecycle, the `DroidHeader` intro clock, its settled frame cached per width, timers, settling and the 8 s backstop, starting the manifest after the first draw, the key hints, and ANSI output (colors and bold) through `paintLine` | `test/extension.test.ts`, the real module through the installed host's jiti with a fake Pi API, a fake TUI and a manual clock |
| `test/host.ts` | Finds the installed Pi through `PI_HOST_ROOT` and aliases the peers to it | Used by the tests |

## Flow

`session_start` drops any earlier header (disposing its timers) and returns at once outside TUI mode. In TUI mode it reads the branch, then builds the state from the session ID, Herdr's environment, `ctx.model` and `pi.getThinkingLevel()`, `VERSION`, the first time this process saw the session, and `keyText`. A generation counter discards a start that a newer one overtook while the branch was being read. It then calls `ctx.ui.setHeader`, whose factory mounts the `DroidHeader` component.

The intro plays only when the start reason is `startup` or `new`, every session entry is a setting entry (Pi records the starting thinking level before `session_start`), and `NO_MOTION` is unset or empty. Then the component's clock starts when Pi mounts it, one 50 ms interval requests renders, and a non-consuming `ctx.ui.onTerminalInput` listener settles on the first keystroke; `input` and `agent_start` settle too. Each tick settles once the time reaches `introEnd` of the frame last drawn, or `INTRO_LIMIT_MS` (8 s) for a header Pi stops drawing. Settling stops the interval and removes the listener, and the frame at `introEnd` is the settled frame. Otherwise the header is settled from the start, with no timer or listener.

The manifest starts as pending. On the turn of the event loop after Pi first draws the header (cancelled if the header is disposed first), it is built in Pi's process, taking 7–11 ms with this machine's settings:

1. `SettingsManager.create(cwd, agentDir, { projectTrusted })`, a manager of our own. Pi records an unreadable settings file instead of throwing (`drainErrors`); any such file makes the manifest unavailable as `SETTINGS UNREADABLE` with its scope and path.
2. `applyOverrides({ npmCommand: [""] })`, in memory only; the manager is never saved or reloaded. Pi finds npm packages installed the old, global way by running `npm root -g` synchronously and without a timeout (`getLegacyGlobalNpmInstallPath`, `getGlobalNpmRoot`, `runCommandSync`). Pi's own guard rejects the empty command before any process starts (`getNpmCommand` throws `Invalid npmCommand`); `getLegacyGlobalNpmInstallPath` catches that, and the package counts as missing. Within `resolve("skip")` that lookup is the only path to the npm command, so the guard cannot fail the resolution; it holds on every platform, as nothing is spawned.
3. `new DefaultPackageManager(…).resolve(async () => "skip")`: the enabled extension candidates and skill paths. `"skip"` never installs, and `resolve()` starts no other process for user and project packages.
4. `loadSkills({ cwd, agentDir, skillPaths, includeDefaults: false })`, the call Pi's resource loader makes: Pi's skill names (frontmatter first), rejections (no description, unparsable frontmatter) and duplicates. `loadProjectContextFiles` for the context files.
5. Prompts are `pi.getCommands()` entries with source `prompt`: what Pi loaded and deduped before `session_start`. Prompts another extension adds through `resources_discover` are merged after `session_start` and may be missed.

`DefaultResourceLoader.reload()` is not used: it reloads settings, dropping the override, and resolves without `onMissing`, so it installs missing packages; only `PI_OFFLINE` stops that. Pi applies project trust. Any throw becomes unavailable with its first line; nothing throws into Pi. A ready manifest that arrives during the intro is recorded with its intro time; its hold rows then type from that time, staggered like the others, extending the intro by as long as they take. The new manifest also refreshes the key hints, so the Escape hint can change to `steer`.

`session_shutdown` disposes the header; Pi also disposes it when another header replaces it and resets it to the built-in header before a reload or session switch (`resetExtensionUI`).

## State

Per header only: the state snapshot, the intro start time, the interval and listener cleanups, the pending manifest start, the settled frame for the last width (cleared by `invalidate` and a new manifest), with its intro end memoized beside it, and the settled painted lines cached by width and color mode. Process-wide, a `Map` on `globalThis` under `Symbol.for("industrial-os.droid-header.deployed")` keeps when each session was first seen, so a reload, which re-imports the module, keeps DEPLOYED; it holds one entry per session the process opens. Nothing is written to disk, settings or the session.

## Host seams

Checked against the Pi 1.4.0 declarations and source:

| Seam | Dependency and risk | Check |
| --- | --- | --- |
| Header | `ctx.ui.setHeader(factory)` (`core/extensions/types.d.ts`); the factory receives `(tui, theme)`. Pi disposes the previous custom header on replacement and resets to the built-in header in `resetExtensionUI`. Pi keeps an empty built-in placeholder when `quietStartup` is `true`, so the custom header shows for every setting (`interactive-mode.js`, `shouldShowStartupHeader`, `setExtensionHeader`) | `test/extension.test.ts`; the scripted terminal run in [contributing](../CONTRIBUTING.md#verification-records) |
| Width | Regular mode throws when a rendered line is wider than the terminal (`pi-tui` `tui-main-screen.js`); `paintLine` truncates as a last guard | Width sweeps in both test files |
| Input | `ctx.ui.onTerminalInput(handler)` returns an unsubscribe; returning `undefined` leaves the key to the editor | `test/extension.test.ts` |
| Key hints | `keyText("app.interrupt")`, `keyText("app.clear")`; outside interactive mode Pi has not installed its app keybindings, and a key it cannot name is left out | `test/extension.test.ts`; the scripted terminal run shows `escape` and `ctrl+c` |
| Manifest | `SettingsManager.create`, `drainErrors` and `applyOverrides`, `DefaultPackageManager.resolve(onMissing)`, `loadSkills`, `loadProjectContextFiles`, all exported from the package root, and `pi.getCommands()`. Pi's package manager runs npm through the settings' `npmCommand`, after its guard rejects an empty one; a Pi change that drops the guard, runs another command on this path, or reloads settings would break the guarantee | `test/sources.test.ts` against the installed Pi, with every `child_process` function made to throw, a marker extension that must not run, and uninstalled npm and git packages |
| Values | `VERSION`, `ctx.model` (Pi's placeholder model has provider and ID `unknown`), `pi.getThinkingLevel()`, `ctx.sessionManager.getSessionId()`/`getEntries()`, `ctx.isProjectTrusted()` | `test/facts.test.ts`, `test/extension.test.ts` |
| Colors | `rgbColor`, `foregroundAnsi`, `backgroundAnsi` with `theme.getColorMode()`, so 256-color terminals get the nearest colors | Review; the goldens check the colors before conversion |

No host logic is copied. `quietStartup` itself is Pi's; the README's recommendation follows `shouldShowStartupDetails` (`interactive-mode.js`).

## Critical invariants

- Every line is exactly the requested width; the core never emits a control character from caller text.
- Unknown is never zero: pending counts are `--`, a failure says `MANIFEST UNAVAILABLE`, and no value is invented.
- The intro is bounded (the CRT boot's own end, at most 5.85 s after its rows start, and the 8 s backstop), never repeats, and settles on input; settled headers own no timer or listener.
- Input is never consumed or delayed, and nothing runs outside TUI mode.
- `buildManifest` and `readBranch` never throw, and neither runs a process: no Git, npm or install.

## Evolution

The manifest could follow CLI flags if Pi exposes the loaded resources to extensions; until then it follows settings. A live CORE value would need a model-change subscription and is the footer's job today.
