# Contributing to the design system

The design system's toolchain, commands, checks, and verification records. The workflow for every change in the repository, including review and publication, is in the [root contributing guide](../CONTRIBUTING.md).

## Toolchain and setup

Run every command in the design-system guides from this `design-system/` folder (`cd design-system` from the repository root). Paths in those commands, and the contract and module paths the storybook displays, are relative to it.

You need Git, a UTF-8 editor, and Node.js 22. The showcase, storybook, and motions were built and checked on v22.23.0. Code is plain ES modules (`.mjs`) using only the Node standard library. `package.json` names the private package `@industrial-os/design-system` and declares its `exports` map; it has no dependencies or scripts. There is no dependency installation, build step, formatter, type checker, or CI gate. Do not add one without a current need. This folder's checks need no install: `package.test.mjs` imports the package by its own name, which Node resolves from this folder's `package.json`. Other projects reach the package through the root `npm install` in [setup](../CONTRIBUTING.md#setup).

Herdr is the primary target. The baseline below is specific to Herdr 0.9.3 and Node v22.23.0, not a universal terminal compatibility claim. Verify version-specific Node contracts against the [matching documentation](https://nodejs.org/docs/v22.23.0/api/) before relying on them.

### Running the hosts

Both hosts take the same options. Keys and the reuse guide are in [examples](examples/README.md).

| Command | Effect |
| --- | --- |
| `node examples/storybook.mjs` | Storybook when stdin and stdout are terminals: alternate screen, hidden cursor, raw keys. Browse stories with `j`/`k`, arrows, or Tab, and jump to a section with `1`–`3`; states, examples, or color views with `h`/`l`; page with Space/`b`. Motion previews play automatically when selected, redrawn at the motion's own step, and one-shots replay 1.5 s after completing; `p`/`r` pause or resume and replay, and `o` turns motion off for the whole storybook and on again. `?` lists every key. Left-click complete visible index labels, variants, and footer actions; keyboard fallback remains. `q`, Esc, or Ctrl-C quit. |
| `node examples/showcase.mjs` | Showcase live view: the first four elements on one screen. Redraws only on resize or scrolling. `j`/`k`, arrow keys, PgUp/PgDn, and Space scroll. `q`, Esc, or Ctrl-C quit. |
| `node examples/<host>.mjs --plain` | One snapshot without escape sequences, at the terminal width (80 when piped). The storybook snapshot is its first story with motion off, at full height. |
| `node examples/<host>.mjs --plain --columns 48 --rows 20` | Snapshot at an explicit size (1–1000 each) |
| `node examples/<host>.mjs --color --columns 120` | 24-bit color snapshot, even when piped |
| `node examples/<host>.mjs --help` | Options |

When output is not a terminal, each host prints one snapshot and exits. Color is used only when Node reports 24-bit support, or with `--color`. `NO_COLOR` suppresses automatic color unless overridden by Node's `FORCE_COLOR` setting, but does not disable live cursor/screen controls; use `--plain` for an escape-free snapshot. Explicit `--color` overrides `NO_COLOR`. Invalid options exit with status 2. The live views exit 0 on `q`/Esc, 130 on Ctrl-C or SIGINT, 143 on SIGTERM, and 129 on SIGHUP. In the storybook, Esc first closes the key list if it is open. Each exit disables the storybook's 1000/1006 mouse reporting and restores the cursor, style, screen, and terminal mode, and stops any playing preview's timer.

## Fast loop

From `design-system/`:

```sh
node --test
git diff --check
git diff --cached --check
git status --short
```

These commands are read-only. `node --test` finds every `*.test.mjs` beside the code it checks, and finishes in about ten seconds. It covers layout at every width from 1 to 160, short heights, boundary and invalid inputs, plain/color equivalence, deterministic motion frames, storybook navigation, index scrolling, and playback, executable usage text, CLI snapshot and argument behavior, and live-view mode restoration and timer cleanup through stand-in terminal streams and a manual clock. `package.test.mjs` checks that the package is private ESM with no dependencies, that every export names an existing module that is not a test, an example, or `motions/frame.mjs`, that the exports cover every foundation module, element, and motion primitive, and that each export loads by package name as the same module as its file while `motions/frame` is refused. A new module without an `exports` entry fails it, so add the entry in the same change. For a focused run, pass explicit file paths, such as `node --test elements/lamp/lamp.test.mjs`. Diff checks cover unstaged and staged tracked changes, not new untracked file contents, link correctness, design quality, or runtime behavior. Review newly created files explicitly.

## Full validation sequence

Source: the actual repository inventory and Git state; no application manifest or CI exists.

| Order | Directory | Command or review | Prerequisites/effects | Coverage |
| --- | --- | --- | --- | --- |
| 1 | `design-system/` | Fast-loop commands above | Node 22 and Git; read-only | Unit, contract, and CLI checks; whitespace in diffs; changed-file inventory |
| 2 | `design-system/` | `node examples/showcase.mjs --plain --columns N` for 120, 100, 80, 48, 40, and 23; `node examples/storybook.mjs --plain --columns N --rows 24` for 120, 80, 48, 24, and 12 | Node 22; prints only | Human review of the composition at normal, compact, and fallback widths |
| 3 | A new, unoccupied Herdr pane | `node examples/showcase.mjs`; resize; scroll; quit with `q`, then Ctrl-C. `node examples/storybook.mjs`; browse every story and state, including through the scrolled index and the section keys; check that each motion autoplays on selection and each one-shot replays after its pause; pause, resume, and replay each motion, and toggle motion off and on with `o` across story changes, checking the shown `MS FRAMES` interval; resize while playing; click every visible control class (including paging, help/close, and quit); check ignored clicks and press/release; quit with `q`, Esc, and Ctrl-C during playback | Herdr; interactive | Actual appearance, glyph widths, color, motion, resize, input, and restoration. The only evidence for Herdr support. |

Then run the [repository-wide checks](../CONTRIBUTING.md#repository-wide-checks) from the repository root.

The automated suite does not drive a real terminal. Report a real-PTY or Herdr run separately, with what it covered. When you add an executable element, document its setup, fast check, full tests, prerequisites, and side effects here. A required check that is skipped does not count as a pass.

## Native verification baseline

This baseline covers the first four elements and the **showcase only**. It predates the other elements, the motions, and the storybook and is not evidence for them; see [storybook verification status](#storybook-verification-status).

Checked on macOS with Node v22.23.0 and Herdr 0.9.3 (protocol 22), `TERM=xterm-256color`, and `COLORTERM=truecolor`:

- All 44 automated checks of that pre-publication development version passed, including fragmented keys, control-safe text, prototype-key rejection, and large finite gauge readings.
- Actual Herdr text readback matches composed frames at 139×37, 140×18, and 140×30, including a scrolled short viewport. All nine palette RGB values survive ANSI readback. Curated-glyph ruler rows retain their rails without soft wrapping.
- Plain snapshots at 120, 100, 80, 48, 40, 24, 23, and 1 columns match in Herdr with an 18-row budget. These are explicit-width snapshots, not physical narrow-pane resize tests.
- Real Herdr arrow scrolling, height resize/repaint, `q`, and Ctrl-C were exercised. Full terminal settings matched before and after both exits and snapshot runs. A fragmented-key scroll assertion was inconclusive after a concurrent layout resize; the new layout was left intact.
- Eleven isolated real-PTY scenarios pass: resize/scroll/quit, Ctrl-C, SIGTERM, TTY `--plain`, tiny plain/live output, fragmented arrows, `NO_COLOR`, Esc, SIGINT, and SIGHUP. These are automated input, not physical keyboard tests.

This establishes a bounded native baseline, not physical-pixel/contrast, screen-reader, performance, every-font, or every-terminal certification. Private captures and harnesses are not shipped. Repeat native checks after relevant changes; unit tests alone do not preserve host compatibility.

Consequential Node contracts were checked against v22.23.0 [TTY](https://nodejs.org/docs/v22.23.0/api/tty.html), [process](https://nodejs.org/docs/v22.23.0/api/process.html), [keypress emission](https://nodejs.org/docs/v22.23.0/api/readline.html#readlineemitkeypresseventsstream-interface), and [PassThrough](https://nodejs.org/docs/v22.23.0/api/stream.html#class-streampassthrough) documentation. Key-event `sequence` details are verified against [that version's official implementation](https://github.com/nodejs/node/blob/v22.23.0/lib/internal/readline/utils.js), since the public emitter documentation does not specify the full event payload. Node decodes fragmented keys and briefly delays standalone Esc to distinguish it from an escape sequence; the showcase has no redraw timer.

### Storybook verification status

**Current version: automated checks only.** The second element set (instrument frame, count plate, mode plate, state chip, lamp, pixel numeral, segment meter, thread rail, transcript marker), the label plate's slab form and bright tone, the gauge's zones and tick-free scale, the sixteen newer motions, the MARKER TIMELINE and SIGNAL COLORS stories, and the storybook's scrolling index, section keys, and step-rate playback (intervals from 40 to 400 ms) have **no native Herdr or real-PTY verification**. The storybook's autoplay, one-shot replay pause, and storybook-wide `o` motion setting are also unverified natively. All 354 automated checks pass (`node --test`, Node v22.23.0), including the four package checks; they cover every story at widths 1–160, executable usage text for every element and motion example, each example's plain-playback flag against its frames, finite previews completing at their duration helpers, autoplay on selection, the replay pause and the motion setting, the marker timeline against its README, and timer cleanup with a manual clock. The records below are for earlier versions and do not cover any of this.

Checked on macOS with Node v22.23.0 and Herdr 0.9.3 (protocol 22). Keyboard-only baseline, from a pre-publication development version:

- All 103 automated checks of that version passed, including executable motion usage examples, complete-message preservation, completed-reveal resizing, the documented host sketch, and timer cleanup.
- Isolated real-PTY automation, outside Herdr, exercised browsing, fragmented arrows, resize, the key list and Esc, `NO_COLOR`, a 1×1 terminal, TTY `--plain`, and quitting with `q`, Esc, Ctrl-C, SIGINT, SIGTERM, and SIGHUP during playback. Terminal settings matched before and after. A playing preview redrew at no more than 15 frames a second, and nothing redrew while motion was off, paused, or complete. The showcase still started and quit through the shared host.

- An independent rerun passed 28 real-PTY assertions covering the scenarios above. These are separate from the native Herdr checks below.
- At 139×30 in Herdr, all 28 component states and motion examples were browsed with native keys. Thirty static text captures, including a paged detail view, match the pure layout. All nine palette RGB values appear in native ANSI readback.
- Herdr arrow and Tab/Shift-Tab navigation, detail paging, help/Escape, scan/pulse play-pause-replay-off, and both reveals playing to completion were exercised. Scan/pulse specimen styling changed in the native captures; essential readings and complete warning/error messages remained present during reveals.
- Quitting during playback with `q`, Esc, and Ctrl-C returned the expected codes and identical full `stty` settings.

Input was automated, not physical keyboard use. Storybook resizing, tiny dimensions, fragmented keys, and `NO_COLOR` were tested in isolated PTYs, not by changing Herdr's layout or color environment in this round of checks. No physical-pixel contrast, screen-reader, every-font, or performance certification is claimed. Private harnesses and captures are not shipped.

Mouse support, from a later pre-publication development version, checked on the same versions:

- All **118 automated checks of that version passed**, including every visible click class versus keyboard transitions, label boundaries and inert cells at widths 1–160, fragmented/coalesced and malformed/overlong reports, ignored buttons/modifiers/releases, rapid Esc-plus-report recovery, stale geometry, opt-in reporting, and exit/failure cleanup.
- The independent rerun passes **52 real-PTY assertions**, including click controls, fragmented reports, keyboard recovery, ignored input, and full terminal restoration on click quit, `q`, Esc, Ctrl-C, SIGINT, SIGTERM, and SIGHUP. Separately, 1,792 snapshot frames remain exactly equal to the pre-mouse baseline, including spans and styles.
- In Herdr at the observed 139×30 and 140×30 sizes, injected SGR reports selected all 28 variants. **31 static text captures** match the pure layout. Footer navigation, paging, help/close, scan/pulse play-pause-replay-off, reveal completion, fragmented input, and ignored reports were exercised. A rapid Esc followed by an ignored mouse report closed help without changing stories.
- Click quit, Esc, and Ctrl-C during playback returned the expected codes and identical full `stty` settings. Native terminal mode queries after each exit confirmed both 1000 and 1006 were reset.

These Herdr checks use **automated terminal mouse-report input**, not a physical pointer or execution of client-side hit testing. Herdr 0.9.3's [client forwarding](https://github.com/herdrdev/herdr/blob/v0.9.3/src/client/shell/mouse.rs#L2205) and [server encoding](https://github.com/herdrdev/herdr/blob/v0.9.3/src/server/pane_input.rs#L226) were inspected separately in versioned source. No layout, focus, or input-routing configuration was changed. Physical-pointer testing remains a verification gap.

Colors story, first published version, checked on the same versions. These records **predate the current COLORS page**, which renamed the collection to IndustrialOS colors, changed color ids, names, and roles, removed the earlier per-color labels and notes, and shortened the title notice; it is now story 34 of 35, after the second element set and the newer motions. **None of the real-PTY or Herdr checks below has been re-run against the current page.** Its current automated coverage is part of the current-version paragraph above.

- Story 8, COLORS, added static views of 22 colors and their five-step shade ramps. All 141 automated checks of that version passed. Its new checks covered FOUNDATION placement, the per-color and derived labels then shown, every color and ramp step, swatch SGR, plain fallback, widths 1–160, paging, keyboard/click equivalence, and no playback timer.
- Separate checks covered 252 color-view dimension/mode combinations, including 1×1 and 1000×1000. Another 840 comparisons preserved original-story cells and styles after normalizing the changed story count/key range and excluding the intentionally changed wide sidebar. This is not exhaustive frame equivalence: the index gains FOUNDATION, its height threshold becomes 15 rows, and one key-list line changes.
- The 52-assertion real-PTY mouse regression passed again. Additional Colors PTY checks exercised both views, paging through every base and all 110 ramp RGB values, idle and p/r/o without redraws, help/Esc, resize to 12×4 and 1×1, `NO_COLOR`, and q/Esc/Ctrl-C with full terminal restoration.
- In actual Herdr at 139×30, injected SGR reports selected all 30 variants/views. **47 static text captures** matched the pure layout, including every Colors page. All 22 then-current names, the base hex values, and all 110 ramp RGB values appeared in text/ANSI readback. Footer navigation, help, paging, existing motion controls, ignored/fragmented reports, rapid Esc recovery, and switching from playback to COLORS were exercised.
- Click quit, Esc, and Ctrl-C returned the expected codes, preserved full `stty` settings, and left both 1000/1006 modes reset by native terminal query. No pane focus, layout, or input-routing setting was changed.

The Colors native checks used injected terminal reports, not physical-pointer/client hit testing. Tiny dimensions, resizing, and `NO_COLOR` were exercised in isolated PTYs rather than by changing Herdr's layout or environment. RGB readback is not a physical-display or contrast certification.

The protocol requirements, scope, and tiny-size keyboard fallback are in [examples](examples/README.md#left-clicks). SGR event splitting and coalesced Esc prefixes were checked against the installed Node v22.23.0 decoder and its [official implementation](https://github.com/nodejs/node/blob/v22.23.0/lib/internal/readline/utils.js), not inferred from the public keypress API alone. Repeat native interaction checks after relevant changes.

The playback timer relies on v22.23.0 [`setInterval()`/`clearInterval()`](https://nodejs.org/docs/v22.23.0/api/timers.html#setintervalcallback-delay-args): fractional delays are truncated, so continuous previews use 67 ms (stepped previews use their own whole-millisecond step), and an active interval keeps the process alive until cleared. Playback time comes from [`performance.now()`](https://nodejs.org/docs/v22.23.0/api/perf_hooks.html#performancenow), called on the `performance` object as that version requires.

## Package verification

Checked on 2026-10-07 on macOS with Node v22.23.0 and Pi 1.0.4, when the package and the root `file:` dependency were added. Automated and Pi-load evidence only:

- `node --test` from `design-system/`: 354 of 354 checks passed, including the four in `package.test.mjs`.
- In a clean `git clone` of the branch, `npm install --omit=dev --legacy-peer-deps` at the root, the command Pi's git install runs, created `node_modules/@industrial-os/design-system` as a symlink to `design-system/`. A module under `pi/claude-interrupt/src` in that clone imported `@industrial-os/design-system/elements/transcript-marker` by name.
- A scratch probe extension under `pi/` in that clone imported `foundation/palette` and `elements/label-plate` by package name and loaded with `printf '' | pi --mode rpc --no-extensions --extension ./index.ts`, exiting 0. A control importing a subpath not in the exports map exited 1 with "Package subpath ... is not defined by exports". The probe is not shipped.

Neither extension imported the package, so this does not cover a migrated extension. `pi install git:` itself, an interactive Pi session, and Herdr were not checked.

Consumed exported subpaths ship colocated `.d.mts` declarations. Their extension-local compile-only specimens use the existing claude-interrupt compiler; this adds no design-system typecheck toolchain/dependency or generated output. Keep declarations aligned with runtime APIs and extend the specimens for current consumers.

## Port regression verification (2026-10-07)

Node 22.23.0, macOS: all 387 DS checks passed (368 pre-existing after slice-1, 19 additive status-bar checks); independent default API corpus against origin/main passed 2,334 comparisons. Both migrated extensions passed their suites and recorded golden/RPC/copied-state root-install checks; see their contributing guides. These are not real `pi install git:` or interactive/Herdr checks. Consumed declarations passed strict NodeNext checking with the existing claude-interrupt compiler; no new dependency or standalone DS typecheck gate.

## Making a change

Follow the [repository workflow](../CONTRIBUTING.md#making-a-change) and the routes in this folder's [AGENTS.md](AGENTS.md). All elements and demos must be terminal-ready text, without a browser presentation layer; verify appearance, resizing, input, and repaint behavior in Herdr.
