# Engineering conventions

Follow [root conventions](../../../docs/conventions.md) and the [Pi guide](../../AGENTS.md). TypeScript ESM for Node 22.19+, run by type stripping. Host Pi/TUI packages are `*` peers; like status-bar, the extension has no development dependencies or lockfile and its tests run against the globally installed Pi, found through `PI_HOST_ROOT`. The design system comes from the root install. Commands and evidence are canonical in [contributing](../CONTRIBUTING.md).

## Boundaries and state

- Keep `header.ts` and `facts.ts` pure: inputs in, values out; no Pi import, clock, timer or I/O. The host passes the grapheme measurer, and `extension.ts` alone turns cells into ANSI. Check: their tests build state by hand and use no Pi context.
- Keep all I/O in `sources.ts`, bounded (64 parent folders, 1 KiB per Git file) and resolving to a value. Call only Pi loaders that cannot start a process: resolution with `"skip"` on a settings manager whose npm command is empty, so Pi's guard rejects it before spawning, and which is never reloaded or saved. Do not use `DefaultResourceLoader.reload()` or set `PI_OFFLINE`. Check: `test/sources.test.ts`.
- One `DroidHeader` per session. Every timer and listener is registered with `onSettle` or `onDispose` when it is created, never cleared ad hoc. Check: `test/extension.test.ts` asserts the manual clock holds no timer after settling, shutdown, replacement and a new session.
- Write explicit class fields rather than TypeScript parameter properties, which Node's type stripping rejects.

## Values and text

- Unknown is `--` (`????` digits for a missing session ID), a failure is `MANIFEST UNAVAILABLE` with its first line, and a count is shown only when the manifest is ready. Never turn absence into zero or a default name.
- Treat every string from Pi, settings, Git and the environment as untrusted: controls, C1 and bidi marks become `?`, graphemes are measured by the host, wider than two cells becomes `?`, and overflow ends in `…` on a whole grapheme. Check: the hostile-state sweep in `test/header.test.ts`.
- Name derivations live in `facts.ts` with the rules stated once in [design values](design.md#values). Skill names come from Pi's skill loader and prompt names from Pi's loaded commands, never from paths.

## Colors and motion

- Colors only from `@industrial-os/design-system/foundation/palette` and `signal-colors`, numerals from `elements/pixel-numeral`, seeded randomness from `foundation/seeded`; no hex literal in `src/`. Check: review, and the golden frame's per-cell colors.
- Motion follows the [root motion rules](../../../docs/design.md#motion) and the decode exception there. Rates are constants in `header.ts` and stated in [design](design.md#motion); change both together.
- Frames are pure functions of time; the host only chooses `t`. At most one 50 ms interval, and none once settled.

## Tests

Tests write only to temporary directories, set `PI_CODING_AGENT_DIR` to one before loading the extension, and never touch real sessions, settings or `~/.pi`. `test/header.test.ts` holds the golden frame: the approved mock's settled output at 104 columns with public-safe manifest names, every cell's text and colors, barcode cells checked against the design system's generator. Private names from a real machine never enter fixtures.

## Adoption gaps

| Gap | Evidence | Next change and check |
| --- | --- | --- |
| Decode lives in the extension | `decode` in `src/header.ts` mirrors `decodeGlyph` (`foundation/decode-glyph`) on the unmerged `feature/dispatch-feed` branch: the same scramble set, seeded settle times and 70 ms step. It also keeps a grapheme that `decodeGlyph` rejects (wide or outside ASCII and the design-system glyphs) whole until it settles | After dispatch-feed merges, import its decode for one-cell ASCII and design-system glyphs and delete the local copy; the intro tests must pass unchanged |
| No interactive Pi/Herdr qualification | Offline tests, the RPC load check and a scripted terminal run outside Herdr | An authorized manual check in Pi inside Herdr: intro, settle on typing, resize, `/new`, `/reload`, colors |
| No standalone typecheck, formatter, linter or lockfile | Tests use the global host by design, like status-bar; a one-off strict `tsc` is recorded in contributing | Add only with an approved need |
| No license | No `LICENSE` or manifest license field | The repository's open license decision |
