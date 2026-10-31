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

These commands are read-only. `node --test` finds every `*.test.mjs` beside the code it checks, and finishes in about ten seconds. It covers layout at every width from 1 to 160, short heights, boundary and invalid inputs, plain/color equivalence, deterministic motion frames, storybook navigation, index scrolling, and playback, executable usage text, CLI snapshot and argument behavior, and live-view mode restoration and timer cleanup through stand-in terminal streams and a manual clock. `package.test.mjs` checks that the package is private ESM with no dependencies, that every export names an existing module that is not a test, an example, or `motions/frame.mjs`, that the exports cover every foundation module, element, and motion primitive, and that each export loads by package name as the same module as its file while `motions/frame` is refused. It also verifies declarations for Lunalee's planned consumed subpaths and resolves their public physical paths through a disposable root-package symlink (not a git-install test). A new module without an `exports` entry fails it, so add the entry in the same change. For a focused run, pass explicit file paths, such as `node --test elements/lamp/lamp.test.mjs`. Diff checks cover unstaged and staged tracked changes, not new untracked file contents, link correctness, design quality, or runtime behavior. Review newly created files explicitly.

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

**Pre-DS-1 catalog baseline: automated checks only.** The second element set (instrument frame, count plate, mode plate, state chip, lamp, pixel numeral, segment meter, thread rail, transcript marker), the herdr-sidebar-modeled [line meter](elements/line-meter/README.md) and [column block](elements/column-block/README.md), the label plate's slab form and bright tone, the gauge's zones and tick-free scale, the sixteen newer motions, the MARKER TIMELINE and SIGNAL COLORS stories, and the storybook's scrolling index, section keys, and step-rate playback (intervals from 40 to 400 ms) have **no native Herdr or real-PTY verification**. The storybook's autoplay, one-shot replay pause, and storybook-wide `o` motion setting are also unverified natively. All 402 automated checks pass (`node --test`, Node v22.23.0), including the four package checks; they cover every story at widths 1–160, executable usage text for every element and motion example, each example's plain-playback flag against its frames, finite previews completing at their duration helpers, autoplay on selection, the replay pause and the motion setting, the marker timeline against its README, and timer cleanup with a manual clock. The records below are for earlier versions and do not cover any of this.

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

Colors story, first published version, checked on the same versions. These records **predate the current COLORS page**, which renamed the collection to IndustrialOS colors, changed color ids, names, and roles, removed the earlier per-color labels and notes, and shortened the title notice; it is now story 36 of 37, after the second element set and the newer motions. **None of the real-PTY or Herdr checks below has been re-run against the current page.** Its current automated coverage is part of the current-version paragraph above.

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

## Herdr chrome colors verification (2026-10-09)

Node 22.23.0, macOS: `node --test` **388/388 passed** (387 before, plus the `HERDR_CHROME` check), including `package.test.mjs` **4/4**. `HERDR_CHROME` adds no module or export entry; status-bar's `test/footer-colors.test.ts` still passes **1/1**, since `SIGNAL_COLORS` is unchanged. Setting `signalOrange30` to `#4d1b00` failed the new check, then was restored. No storybook story or native Herdr check covers these values; the theme that uses them is recorded in [the Herdr contributing guide](../herdr/CONTRIBUTING.md#acid--orange-theme).

## Pi chrome colors verification (2026-10-22)

Node 22.23.0, macOS: `node --test` **403/403 passed**, including the new `PI_CHROME` check. `PI_CHROME` adds no module or export entry. Setting `bone` to `#e2dccc` failed the new check, then was restored. Status-bar's `test/footer-colors.test.ts` still passes **1/1** with the global Pi 1.3.0 host, since `SIGNAL_COLORS` is unchanged, and its strict compile-only `test/design-system-types.ts` passes with the added declaration. No storybook story or native Herdr check covers this value.

## Making a change

Follow the [repository workflow](../CONTRIBUTING.md#making-a-change) and the routes in this folder's [AGENTS.md](AGENTS.md). All elements and demos must be terminal-ready text, without a browser presentation layer; verify appearance, resizing, input, and repaint behavior in Herdr.

## Lunalee DS-1 foundation verification (2026-10-27)

Node v22.23.4, macOS; installed Pi 1.4.0; Herdr client/server 0.9.5, protocol 22. This covers the surface/palette, opt-in measured slots, label-plate measured text, lamp round poses and state-chip word form. It does not adopt the Lunalee app or extend motions.

- `node --test`: **422/422 passed**, including surface geometry/hash/blending/clearance/masks/NO_COLOR/invalid inputs, measured wide/combining/emoji/ZWJ slots and styles, slot injection/forged widths, and executable new story calls. Existing assertions remain; catalog-end expectations now include SURFACE. A separate baseline corpus made **47,388** old-default span/ANSI comparisons against `b2032310c47b747f7ba88f0cf8de6a70f91d6e19`, with no differences.
- Required plain CLI snapshots: showcase widths 120/100/80/48/40/23; storybook 120/80/48/24/12 at 24 rows, all exited 0. Synthetic full story snapshots and native text/ANSI readbacks are external evidence, not shipped assets.
- Strict declarations and compile-only public specimens passed with claude-interrupt's existing compiler, including a disposable root-package path specimen (not `any` shims). From the repository root, after claude-interrupt's documented development setup: `./pi/claude-interrupt/node_modules/.bin/tsc --noEmit --strict --module NodeNext --moduleResolution NodeNext --target ES2022 design-system/package-types.ts pi/status-bar/test/design-system-types.ts`. Add `$(find design-system -name '*.d.mts' -print)` to check every declaration. This adds no compiler dependency or build step to the DS.
- Existing claude-interrupt strict types and **34/34** tests, status-bar **135/135** tests and its compile-only specimen, and both isolated noninteractive RPC loads passed. The documented npm-global-root probe first pointed to an absent Volta host; status-bar was rerun successfully using the actual existing Pi installation. No host was installed to make it pass. Configuration/palette consumer checks passed: Herdr/whiteboard **22/22**, Pi theme **5/5**.
- **Native, injected input only:** a newly created, no-focus Herdr tab browsed all four surface views, all six new word states and four round lamp fixtures at 215×77 (initial host frame 214×77). Existing scan autoplay/pause/replay and motion off were exercised; the new surface remained static with motion off. Splitting/resizing only that created tab redrew the storybook at 52×77. `q` restored the exact pre-run `stty -g`; the created tab was closed. A tab watcher auto-created a Lunalee pane there; it received no input and was closed with the created tab. The supervisor confirmed existing panes were intact and no conversation data was lost.
- Root local-link/anchor, guide-map, exact CLAUDE import, whitespace and public-content reviews passed. No original palette or consumer runtime changed.

**Not run:** physical keyboard/pointer or Ghostty pixel/glyph/contrast review; native Esc/Ctrl-C, every mouse control and every older story/motion; Lunalee's ANSI/copy/search/selection/Kitty adapter, pinned git/frozen copied-app install or operational rollout; Mermaid rendering. Unit color math is not physical-display certification. All motion extensions are deferred to DS-2 by supervisor direction, alongside the elements that use them.

## Lunalee DS-2a chrome verification (2026-10-27)

Node v22.23.4, Bun 1.4.4, macOS, Herdr client/server 0.9.5 (protocol 22). Eight new chrome/meter families and four motions have synthetic public-API stories, declarations and package/root-path checks. Opt-in downward beacon, style-only draw-in, white latch, state-cell wipe/cycle and measured reveal retain existing defaults.

- Automated DS, declaration, old-default corpus and affected consumer results are recorded externally with the task's evidence; no Lunalee runtime adoption or release is implied. Every new family has widths 1–160 checks, with measured text and tiny-frame cases where applicable.
- **Bounded native injected-key check:** one new no-focus tab, only its returned root pane received input. All 57 new/extended story variants were browsed at an initial 214×77 frame; autoplay, pause/replay and motion off were exercised. A split/resize within that created tab repainted a narrow view. `q` restored identical `stty -g`; the created tab was closed, including the watcher's automatically created Lunalee pane, which received no input. ANSI/text readbacks are not physical-display screenshots or font certification.
- **Not run:** physical keyboard/pointer, Ghostty glyph/pixel/contrast or image-alpha inspection, native Esc/Ctrl-C/mouse-control matrix, Lunalee integration/copy/search/Kitty adapter, installation/rollout and Mermaid rendering. Tests do not establish those claims.

Corner-snap is intentionally a persistent state pose, with a 40-ms settling helper, by supervisor approval; it is not a finite-preview equality exception inferred by the implementer. See the [motion contract](motions/README.md#cornersnaplines-options-and-cornersnapsettling).

## Lunalee DS-2b content verification (2026-10-27)

Node v22.23.4, Bun 1.4.4, macOS; installed Pi 1.4.0; Herdr client/server 0.9.5, protocol 22. Five new content families (callout, document-block, sheet-card, desk-tray, operation-row) and two new motions (callout-entrance, phosphor-head) have public exports, colocated declarations/contracts/tests and synthetic executable-usage stories. The canonical surface palette adds missing code and dot-leader inks; existing values and 2a element/motion implementations are unchanged.

- **Automated:** full `node --test` **512/512 passed** after rebasing onto merged DS-2a (#38, `645d316`); strict NodeNext public specimens/declarations, required plain CLI snapshots and every new specimen at 120/80/48/24/12 widths are recorded in the external DS-2b evidence. Source-named checks cover widths 1–160, every supplied state, invalid input/injection, measured wide/combining/emoji/ZWJ slots, exact desk columns, table fallback value preservation, fixed operation duration, state cue protection and entrance boundary times. Existing assertions remain; the every-visible-variant mouse test uses a wider fixture viewport for the expanded tabs.
- **Consumers:** claude-interrupt strict types and 34/34, status-bar 135/135 against the actual existing host under `~/.local/lib/node_modules`, automations-monitor strict types and 56/56 (19,338 expectations). No consumer source, dependency or lock changed. No Lunalee runtime adoption, pinned install or release is implied.
- **Bounded native, injected input only:** the final rebased run used one new no-focus tab at 215×77, explicit returned root pane only. All 57 new story states were browsed/read back; autoplay, pause/replay, motion off, split/resize to 63×77 and q were exercised. Every capture was checked for its exact selected story and variant. Exact `stty -g` matched before/after; the created tab was closed, including the auto-created Lunalee pane, which received no input. Readback is terminal text/ANSI evidence, not a physical screenshot or font-width certification.
- **Not run:** physical keyboard/pointer or Ghostty pixel/glyph/contrast inspection; native Esc/Ctrl-C and every mouse control, image-alpha, Mermaid rendering, Lunalee parsing/composition/copy/search/selection/Kitty integration or operational installation. Final visual acceptance remains a maintainer decision.

### DS-2b review fixes

The Opus review's two P1s and visual/documentation notes were addressed together: fixed ^P state/updated columns and row fills/leaders; shared callout/subtitle geometry with stable revealed-count layout; safe misplaced motion targets and pre-120-ms timestamp hiding; the requested card/STACK/desk/document/operation inks, padding and dot spacing; and clickable overflow tab arrows at normal 120 columns. The 400-column test workaround is removed. The architecture inventory now names all DS-2a/2b motions. No palette value, dependency, old motion default or application behavior changed.

Automated evidence for the follow-up: **522/522** DS tests, strict public/declaration specimens, claude-interrupt types and **34/34**, status-bar **135/135** against the installed host, automations-monitor types and **56/56** (**19,338 expectations**). The new regressions check measured reveal centering/head positions, tiny/empty callouts and off-by-one targets, fixed list-column alignment/fills, each requested visual refinement and mouse-only tab-row reachability at 120 columns. Final outputs and exact commands are in the external DS-2b report's review-fixes section. **Not rerun:** native Herdr/physical display, Pi RPC loads, or Lunalee integration/install; previous native evidence remains historical, not certification of these changed frames.

## Droid header additions verification (2026-10-27)

Node v22.23.4, macOS; installed Pi 1.4.0. For the Pi droid header: `textGrid()` and `HEX_FONT` (hex `A`–`F` unit codes in the 3×5 pixel font, with a HEX UNIT story variant), the heavy junction glyphs `┣┫┻` in `GLYPHS`, and `PI_CHROME.lamp` `#ff5c00`. `FONT`, `numeralGrid` and `pixelNumeral` are unchanged; no module or export entry is added.

- `node --test`: **524/524 passed** (522 before, plus the hex text grid and heavy junction checks; the `PI_CHROME` and glyph checks were extended). The story's displayed example executes at every tested width, including its host fallback below 15 cells.
- Required plain CLI snapshots: showcase at 120/100/80/48/40/23 and storybook at 120/80/48/24/12 with 24 rows, all exited 0.
- Strict NodeNext declarations: `./pi/claude-interrupt/node_modules/.bin/tsc --noEmit --strict --module NodeNext --moduleResolution NodeNext --target ES2022 design-system/package-types.ts pi/status-bar/test/design-system-types.ts $(find design-system -name '*.d.mts' -print)` from the repository root, after claude-interrupt's `npm ci`: exit 0.
- Consumers: status-bar `npm test` **135/135** and `test/footer-colors.test.ts` **1/1** (`SIGNAL_COLORS` unchanged), Pi theme **5/5** against the installed Pi 1.4.0, Herdr configuration **20/20**, whiteboard palette **2/2**, claude-interrupt strict types and **34/34**.
- **Not run:** native Herdr or real-PTY checks of the new story variant, glyphs or color; physical glyph-width or contrast review.

## Notice-row wrap verification (2026-10-27)

Node v22.23.4, macOS. `noticeRow` gains opt-in `wrap` (word-wrapped headline hanging under the text after the glyph/plate prefix) and `inset` (right-edge cells kept clear), for Lunalee's service warnings. A WRAPPED story variant shows it; no module or export entry is added.

- `node --test`: **535/535 passed**, including exact 40/64/100-column rows, every width 1–160 keeping the inset clear, hard-broken long words, a plate prefix, measured wide/ZWJ graphemes with the clipped-row fallback, explicit defaults equal to the existing output, and invalid `wrap`/`inset`.
- An external corpus compared the default output with `9e57db6`'s `noticeRow` in **859** span-level comparisons (ASCII inputs at widths 1–160, measured slots at 2–60): no differences.
- Strict NodeNext declarations and `package-types.ts` (with a new `@ts-expect-error` for a non-numeric inset) passed with TypeScript 7.0.2 from the Lunalee worktree, because claude-interrupt's compiler was not installed in this worktree.
- Required plain CLI snapshots (showcase 120/100/80/48/40/23; storybook 120/80/48/24/12 at 24 rows) exited 0.
- **Not run:** native Herdr or real-PTY checks of the new variant; consumer suites (no consumer source changed).

## Dispatch dashboard primitives

Automated validation on Node 22.23.4: full `node --test` passes (432 checks), including dashboard widths 1–160, every source state, token resolution, inverse staleness, week mapping, empty trace/ticker, decoration clearance, deterministic motion/off and generated storybook usage. Showcase snapshots at 120/100/80/48/40/23 and storybook snapshots at 120/80/48/24/12 (24 rows) were generated and reviewed. The compact integer reuses pixel-numeral packing and selects the dashboard integer face for v20's exact strokes. Native dashboard rendering is validated in the dispatch-feed pane, separately from storybook-native verification; no new interactive storybook certification is implied.

Exact ambient-load follow-up: the shared geometry and glyph-decode projection match an independent literal v20 oracle at 18 times (all 118×54 glyphs/backgrounds and occupied-cell inks), including independent grid reach, staggered dot fade, registration arm growth/decode and the initial sweep. All 432 checks pass; the executable AMBIENT LOAD story is included. Existing storybook key-help rate-range assertion now reflects 25–400 ms frames. No new interactive storybook claim.

Rebase onto the measured-slot and survey work, with reuse in place of near-copies: the dashboard's bone and edge now alias `SURFACE_PALETTE.bone` and `.rule` (v20's exact values) instead of near matches; the dashboard integer face is `textGrid`'s `face: 'dashboard'` (the former `integerNumeral` was removed; 52 counts render identically); the type unit's hover snap is corner-snap's new `corners: 'heavy'` (the former `unitCorners` was removed); and CellGrid takes an optional host `measure` for measured text through `fitText`/`textSlot`. Main's existing tests are unchanged apart from added cases and the storybook rate-range assertion above. `node --test`: **567/567 passed**. Showcase 120/100/80/48/40/23 and storybook 120/80/48/24/12 (24 rows) plain snapshots exited 0. Consumer suites: droid-header `npm test` 30/30, automations-monitor `bun test` 56/56, dispatch-feed as recorded in its guide. **Not run:** native Herdr or real-PTY checks of the heavy corner-snap story.
## Board parts verification (2026-10-28)

Node v22.23.4, macOS. The automations monitor's locally drawn components move here: new `foundation/board-tones.mjs` (`BOARD_TONES`, `boardTone`, `CATEGORY_TONES`), `BOARD_INKS` in `signal-colors.mjs`, the glyphs `□◩▁▶↑↓–—` in `GLYPHS`, `fitText`'s opt-in `ellipsis: 'always'`, and six elements, each with README, declarations, tests, an exports entry and a story: section head, board marks, time lane, readout, event row and scroll rail. Opt-in extensions: the pixel numeral's tall face (`TALL_FONT`, `textGrid(…, { face: 'tall' })`), `tabRule`'s `inks` and `lead` plus `verticalRule`, the board popup's `popupFrame`, `popupTitleBar` and `popupBackdrop`, and `operationDetail`'s `align: 'right'` and `leaderInk`.

- `node --test`: **588/588 passed** (535 before). Every new function is exact-width at widths 1–160 (event row 1–120, title bar 1–100), rejects invalid input, and shows only curated glyphs; the new stories' displayed examples execute at every tested width.
- Default output is unchanged: a corpus run against `a6fd360` compared `fitText`, `fit`, `tabRule`, `operationDetail` (plain and measured), `popupHeader`, `popupFooter`, `textGrid`, `numeralLines`, `pixelNumeral`, `numeralAt`, `SIGNAL_COLORS` and `mixOver` in **6291** comparisons with **0** differences.
- Strict NodeNext declarations, with board-part specimens and three new `@ts-expect-error` cases in `package-types.ts`, exit 0 with TypeScript 7.0.2 from the automations monitor's locked install, because claude-interrupt's compiler was not installed in this worktree: `./herdr-plugins/automations-monitor/node_modules/.bin/tsc --noEmit --strict --module NodeNext --moduleResolution NodeNext --target ES2022 design-system/package-types.ts pi/status-bar/test/design-system-types.ts $(find design-system -name '*.d.mts' -print)`.
- Required plain CLI snapshots (showcase 120/100/80/48/40/23; storybook 120/80/48/24/12 at 24 rows) exited 0.
- Consumers: Herdr configuration `node --test` **20/20**, whiteboard palette **2/2**.
- **Not run:** status-bar, claude-interrupt, droid-header and Pi theme suites (no installs in this worktree; the corpus covers the unchanged defaults they use); native Herdr or real-PTY checks of the new stories; physical glyph-width or contrast review.

Rebase onto the dispatch dashboard (`8d35990`), with one part where two did the same job: the pixel numeral keeps main's face names and one face table, so the board face is `textGrid`'s `face: 'tall'` beside `instrument` and `dashboard` (the branch's former `small` name is gone; the monitor uses `instrument`, the same glyphs). `BOARD_INKS` now derives its values (`mixOver('primary', p)`, and `base` aliases `SIGNAL_COLORS.ghost`, as `DASHBOARD_INKS.rule` does) instead of restating them; a test pins the values. `laneLine` is removed, since only the storybook used it; the TIME LANE story places the pieces on a one-row `CellGrid`. The regression check now runs `for` lines and skips statements with no value. Kept separate, because the semantics differ: `DASHBOARD_INKS` (bone and survey-palette inks) and `BOARD_INKS` (white mixes); `eventRow` (one timestamped event) and `alertTicker` (v1 draws only the empty NO ALERTS row); `readoutBlock` (numbered label, tab rule, tall numeral, unit) and `typeUnit` or `planCounter` (a framed source card; three label–count pairs); `laneTrack` (runs as spans on a time axis) and `activityStrip` or `activityTrace` (bucketed counts); `CellGrid` and a host canvas (see the [conventions](../docs/conventions.md#design-system-components)).

- `node --test`: **619/619 passed** (567 on main; 53 added, one `laneLine` check removed).
- Default output against `origin/main`: the earlier corpus (**6291** comparisons) and a dashboard corpus (**5087**: every `textGrid` face and invalid face, `numeralLines`, `DASHBOARD_FONT`, `FONT`, `DASHBOARD_INKS`, `TYPE_COLORS`, `SIGNAL_COLORS`, `mixOver`, `fitText`, `CellGrid` plain and measured, `typeUnit` in every state, size and pose, `stalenessBar`, `planCounter`, `activityStrip`, `activityTrace`, `alertTicker` 1–160, `ambientField` and `leader`): no differences apart from invalid-face error messages, which name the new face (same error class). `GLYPHS` gains only `◩▁▶↑↓–—`.
- Dispatch feed: 1080 rendered frames (every source state, motion on and off, ten sizes, six times; spans, styles, hits and ANSI) are byte-identical to `origin/main`'s. Its `bun test` passes **26/26**, with seven more assertions than on main, one for each glyph its GLYPHS width test now also covers; typecheck, lint, format check and `test/pty_smoke.py` pass.
- The TIME LANE story's plain text is unchanged at widths 1–132, apart from the specimens where a label is left out (see the review fixes below).
- Strict NodeNext declarations exit 0 (TypeScript 7.0.2, as above). Showcase and storybook plain snapshots exit 0. Herdr configuration **20/20**, whiteboard palette **2/2**.
- **Not run:** the status-bar, claude-interrupt, droid-header and Pi theme suites cannot load their Pi host packages in this worktree. They fail identically on `origin/main` (status-bar 0/12, claude-interrupt 0/2, droid-header 6/9, theme 0/1), so they are not evidence either way. Native Herdr checks of the stories were not run.

Review fixes (2026-10-28):

- **Runs outside the lane.** `laneRun` returns `null` for a run that starts past the lane's last column, as it already did for one that ends before the first. Before, it returned pieces placed past the lane, and a labelled live run threw `RangeError` from `fitText` because its label had negative room. A new test covers runs past the right edge (with and without a head), wholly to the left, across either or both edges, and a headed run starting on the last column, for finished and live runs; it failed before the fix. An external sweep of the earlier `laneRun` against this one covered **21,048** runs: six widths from 1 to 40, six run kinds, and every `from` and `to` around both edges. It found **952** differences, every one a run the earlier version placed outside the lane (932) or threw for (20), and which now returns `null`.
- **Title bar under a measurer.** `popupTitleBar` places its parts left to right by measured width, so wide graphemes keep their cells and the close action keeps its last cell. A new test with a two-cell measurer failed before. An external corpus of **90,720** calls (mark and band, cut and uncut parts, a close action wider than the row, unmeasured and one-cell measured, both ellipsis modes, widths 1–60) matches the earlier output exactly.
- **Readout errors.** `readoutBlock` throws `RangeError` for an empty value or one outside the tall face; this is now in its README and test.
- **Storybook.** The examples guide names the six board stories. The TIME LANE story leaves out a label that would cover a bar, which happens in 30 of the 528 lane specimens at widths 1–132. Its other cells match a host that keeps a bar's colors under a label in every specimen, so the story shows no wrong colour.
- `node --test`: **621/621 passed**.

## Square lamp verification

Node v22.23.4, macOS. `lamp` adds opt-in `appearance: 'square'` with explicit host style, `■` for working/idle and `□` for unknown. Existing defaults and the burn-out implementation are unchanged.

- Focused `node --test elements/lamp/lamp.test.mjs motions/burn-out.test.mjs`: **17/17 passed**. Full `node --test`: **623/623 passed**, including public-package resolution, executable story usage and square story state cues. Checks cover one-cell shapes, static `lit`, transparent/explicit backgrounds, style errors and square burn-out phases, region, completion, motion-off and protected state roles.
- A 45-case corpus of existing default/glyph/field/solid/round output (all states, both lit values and explicit round styles) matched base `8cd0fc6` exactly. Simplification review retained one shared styled-appearance branch and no new abstraction or dependency.
- Required plain CLI snapshots (showcase 120/100/80/48/40/23; storybook 120/80/48/24/12 at 24 rows) exited 0 and were reviewed. All lamp specimens were also checked at 120/80/48/24/12/1 cells; square shapes survive the one-cell fallback.
- **Real PTY, injected keys only:** browsed all three square variants at 120×30, toggled motion off, resized to 48×24, and quit with `q` (exit 0). Full terminal settings matched before/after. This is text/lifecycle evidence, not Herdr or physical-display certification.
- Local Markdown links/anchors, guidance inventory, exact CLAUDE imports and whitespace/public-content reviews passed.
- **Not run:** strict declarations/public specimens (the documented consumer compiler is not installed in this worktree); native Herdr, physical glyph/contrast review, and Lunalee integration/pinned install. No standalone design-system lint/formatter command exists.

## Withdrawn sheet state verification

Node v22.23.4, macOS. `SHEET_STATES` and `SheetState` add settled `withdrawn ↷` in decorative ink. The question specimen explicitly supplies `read:true`; read/withdrawal lifecycle stays host-owned. The existing word-chip marker path is reused, with `↷` added to the curated one-cell glyph set. No palette value, dependency, export entry or existing state changes.

- Test-first focused checks failed before implementation (5 passed, 3 failed); focused sheet/cell checks then passed **25/25**. Full `node --test`: **626/626 passed**, including executable story usage, widths 1–160, measured slots, transparent read question styling and both withdrawn stories' plain cues.
- An external corpus against base `0e8ff92` passed **86,400** byte comparisons of structured spans, plain output and truecolor ANSI: all six existing states, widths 1–160, ASCII/measured rich text, every public sheet renderer, selected/hover/read flags and both card kinds. No differences. Simplification retained the shared preset/word-chip path with no new abstraction.
- Required plain CLI snapshots: showcase 120/100/80/48/40/23; storybook 120/80/48/24/12 at 24 rows, all exited 0 and were reviewed. Withdrawn word/question specimens were also reviewed at 120/80/48/24/12/1 cells; tiny widths retain the existing clipping contract, not a guarantee that the complete cue fits.
- **Real PTY, injected keys only:** navigated to the withdrawn question at 120×30, toggled motion off, resized to 48×24, and quit with `q` (exit 0). Exact terminal settings matched before/after. This is text/lifecycle evidence, not Herdr or physical-display certification.
- Local Markdown links/anchors, guidance inventory, exact CLAUDE imports, whitespace and public-content reviews passed.
- **Not run:** strict declarations/public specimens (no documented consumer compiler installed in this worktree); native Herdr, physical glyph/contrast review, consumer suites or Lunalee integration/pinned install. No standalone DS lint/formatter exists. Mermaid rendering was not run; no diagram changed.

## Sheet-card extension verification (2026-10-30)

Node v22.23.4, macOS. `cardState`, `cardHeading` and `sheetCard` accept caller presets; headings add a curated mark and text/measured kind. Cards add title readouts, an omitted action (`button:null`) and four-row info form (`footer:null`). Preset frame/hover/heading inks and word weight are independent of the state word's tone. `GLYPHS` adds `◐` and `✓`; no palette, dependency or export entry changes.

- **Test-first and automated:** all five initial extension checks failed before implementation. Final `node --test`: **635/635 passed**, including executable specimen calls, own/prototype-named state keys, invalid preset/readout styles and injection, measured wide/combining/ZWJ content, optional rows/actions, read/hover overrides, exact widths 1–160 and immutability. The first full run exposed two column-block tests that intentionally rejected these formerly uncurated glyphs; they now assert acceptance in spans/separators while retaining unsafe/uncurated rejection. Its README is updated; its runtime is unchanged.
- **Identity:** `node --test elements/sheet-card/sheet-card-identity.test.mjs`: **22,416/22,416 cases identical**, also included in the full suite. The frozen test-only pre-extension renderers are extracted from `82d8534310c2a0d76493ed7a2841d14672b04c20`; a separate source comparison confirmed only the documented extraction/import adjustments. The approved corpus checks serialized spans, plain text, truecolor ANSI and invalid-call error classes. Explicit-default and omitted-option equality is checked separately.
- **Types:** strict NodeNext public specimens and every `.d.mts` pass with the existing dispatch-feed worktree's TypeScript **7.1.0-beta**, without an install or new DS toolchain: `node "$TSC" --noEmit --strict --module NodeNext --moduleResolution NodeNext --target ES2022 design-system/package-types.ts pi/status-bar/test/design-system-types.ts $(find design-system -name '*.d.mts' -print)` from the repository root, with `TSC` pointing at that existing compiler. Positive/negative specimens cover custom states, rich preset codes/kinds, readouts, null action/footer and required measurers.
- **Snapshots:** required plain CLI showcase widths 120/100/80/48/40/23 and storybook 120/80/48/24/12 at 24 rows all exit 0 and were reviewed. Neutral-frame/hover/no-action specimens were also reviewed at 120/80/48/24/12/1 cells (18 frames). Tiny rows clip the tail as documented; they do not promise a complete action beyond the cell budget.
- **Real PTY, injected keys only:** three isolated storybook runs browse all three new variants at 120×30, verify motion off on a motion story, open/close help, resize to 48×24 and exit with `q` (0), Esc (0, with `NO_COLOR`) and Ctrl-C (130). Exact terminal settings match before/after; cursor, alternate-screen and 1000/1006 mouse modes are restored. The external harness initially expected a motion footer on a static component, where none is designed; it was corrected to verify motion-off on a motion story. No host change was needed.
- **Simplification/repository review:** existing state-chip, action-label and band layout paths are reused; no shim, new runtime module, renderer abstraction or dependency is introduced. The heading's historical single string-prefix span is retained for byte identity; measured kinds instead use `fitText` (the approved API table, unlike the reference shim's string interpolation, explicitly supports slots). Local Markdown links/anchors, unchanged guidance inventory, exact CLAUDE imports, whitespace and public-content checks pass.
- **Not run:** native Herdr, physical glyph/font/contrast review, consumer runtime suites or Lunalee integration/pinned install. `◐`'s ambiguous-width compatibility claim remains Herdr-only, based on the existing sidebar vocabulary, not these algorithmic rulers or PTYs. Mermaid rendering was not run; no diagram changed. No standalone DS lint/formatter exists.

## Crate banner verification (2026-10-31)

Node v22.23.4, macOS, Herdr client/server 0.9.5. New element `crate-banner` (`crateBanner(input, { width, form, measure })`, Lunalee's chat pane plate) with README, declarations, tests, an exports entry, a Lunalee planned-subpath entry and the CRATE BANNER story. Foundation additions are additive only: `®▦≡⟁` join `GLYPHS`, and `SURFACE_PALETTE.paperHair` `#dadada` is the one new color; the darker accent reuses `SIGNAL_COLORS.accent75` and paper the IndustrialOS `light-paper`. No existing value, default or export changes.

- **Mockup reproduction:** the approved browser mockup's own cell engine (`oneStroke('serialAligned', 'mark', 'barcode')`, run in Node outside the repository) was compared with the element at 60 and 40 columns for HOLD 0, 2 and 12 and no, one or both tools open: all **54** seven-row frames match in every cell's glyph and background, and in ink and weight for every non-space cell (a blank cell's ink is invisible and not compared). The mockup fixes its stroke columns for those two widths only; other widths use the documented relative geometry. `crate-banner.test.mjs` carries goldens from that oracle (text plus a per-cell color/weight code) at both widths, with the HOLD 0, BOARD open rows.
- **Automated:** `node --test`: **646/646 passed**. The new checks cover the goldens; hover, open, ready and disabled tools (shape cues, hover ignored when disabled, stable spans); every width 1–160 in both forms for four inputs, including long texts and a tool too wide to fit (exact width, plain equal to stripped color, curated glyphs only, tool spans inside the row and ending at their divider, no text on or under the stroke, the mark's blank cell kept); ellipsis cuts; HOLD 0/n/99+/unknown and the narrow clock drop; the compact shedding order at each boundary; barcode determinism; a host measurer with wide graphemes; optional ® and mark; and invalid input. The story's displayed calls execute in the regression suite.
- **Types:** strict NodeNext public specimens (with three new `@ts-expect-error` cases) and every `.d.mts` exit 0 with claude-interrupt's TypeScript 5.9.3 from an existing sibling worktree's install, run from this repository root with a temporary, git-ignored `node_modules/@industrial-os/design-system` symlink to `design-system/` (what the root `npm install` creates), removed afterwards: `"$TSC" --noEmit --strict --module NodeNext --moduleResolution NodeNext --target ES2022 design-system/package-types.ts pi/status-bar/test/design-system-types.ts $(find design-system -name '*.d.mts' -print)`.
- **Snapshots:** showcase 120/100/80/48/40/23 and storybook 120/80/48/24/12 at 24 rows exit 0; the CRATE BANNER story was also reviewed at 120×40, 48×24, 24×24 and 12×24.
- **Consumers (same symlink):** dispatch-feed `bun test` **26/26** (its measurer gives every curated glyph, the four new ones included, one cell); droid-header **30/30**, status-bar **138/138** and Pi theme **5/5** with the installed Pi host; Herdr configuration **20/20**.
- **Bounded native, injected input only:** one new no-focus tab; only its returned root pane received input. The storybook was browsed to CRATE BANNER and through all eight states at 246×77; each native text capture equals the pure layout frame for that state, and the ANSI readback contains the paper, hairline, darker-accent, acid, label and divider colors. `q` exited 0 with an identical `stty -g` before and after. The tab was closed, including a pane a tab watcher created in it, which received no input.
- **Simplification:** placement reuses `CellGrid` (measured graphemes) and `fitText` (cuts), colors are existing roles and values but one, tool spans come from the drawn items, and the compact form is one ladder of levels; the barcode generator stays in the element (one caller) and keeps the mockup's arithmetic so its bars match.
- **Not run:** a resize of the native pane; physical keyboard/pointer; physical glyph, font or contrast review, including whether `⟁` spills in the user's terminal and how `◢ ◤` and the bars join; claude-interrupt and automations-monitor suites (not installed in this worktree); Lunalee integration or a pinned install; Mermaid rendering (no diagram changed). No standalone DS lint/formatter exists.
