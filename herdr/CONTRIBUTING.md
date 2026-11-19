# Contributing

Follow the [repository workflow](../CONTRIBUTING.md) as well as this project's checks.

## Toolchain and setup

The maintained content is one herdr-app mod in plain JavaScript, `industrial-os` (the sidebar, the pane header in `plate/` and the Pi Reloader in `reloader/`, with a generated `ds/` copy of design-system files), a layout, a theme and a keys snippet in JSON. The checks use Node.js 22 with its standard library and the design-system package; there is no dependency or lockfile in this project, and `mods/package.json` only marks the mod's files as ES modules for Node. `stand-in/` is what Node loads in place of the app's own modules, so the tests can run the mod's drawing code ([parts](docs/parts.md#the-stand-in)). Run `npm install` once at the repository root so `@industrial-os/design-system` resolves; see [setup](../CONTRIBUTING.md#setup). `herdr-app check` needs an installed Herdr desktop app; it was last run with herdr-app 0.1.16.

The mod holds one generated copy of the design system: `mods/industrial-os/ds/`, the files its modules import (the pane header's elements and motions, and the sidebar's [vocabulary](../design-system/foundation/README.md#sidebar-vocabulary)), and `marks/*.svg`, the vocabulary's drawn marks as files. After changing the design system, run `node herdr/scripts/sync-design-system.mjs` from the repository root; it rewrites both and removes what no longer belongs. Steps 0 and 1 fail while they differ.

## Validation sequence

| Order | Directory | Command | Prerequisites/effects | Coverage |
| --- | --- | --- | --- | --- |
| 0 | repository root | `node herdr/scripts/sync-design-system.mjs --check` (after a design-system change, without `--check` to regenerate) | Node 22 and the root install (the marks come from the design-system package by name); reads `design-system/` and `herdr/mods/*/ds/` and `marks/`; writes only without `--check` | The mod's `ds/` is byte for byte the design system's files, exactly the import closure of the mod's files, and `marks/` exactly the vocabulary's drawn marks |
| 1 | `herdr/` | `node --test` | Root install; reads the mod's pure modules, `layouts/industrial-os.json`, `test/fixtures/`, `themes/acid-black.json` and the design system's sidebar vocabulary, and loads the mod's drawing code on `stand-in/`; no writes, no `hc` and no socket | One mod is every piece: the root view is the pane header or the Pi Reloader by its `part`, each gets Herdr's close, and the Pi Reloader starts only on its own commands; every file's imports, and which file may write or open a socket. Every sidebar part has a story, every story builds each of its states over time with no element id used twice, a story left stops its clocks, drawings are written without a folder listing and never during a check, and the sidebar's three blocks build the sample window (trees only: nothing is laid out or painted); label parsing and stale labels; every state, unknowns, caps, the finished rule, space aggregation and quiet ages; missions, units, ACTION REQUIRED, the agents view and the rail's lamps; the vocabulary copy and marks equal the design system; the map's world, cameras and frames; every drawing is a well-formed SVG; the layout differs from shipped `main` only in the listed changes, among them the pane header, the sidebar's three blocks and the frozen Lunalee column; the Pi Reloader's selection, protection, guard label and wire checks, and its reload and reset sequences against a simulated herdr-core and guard; the pane plate's units, strips, lighting, rows at 24–200 columns, keys and motion timeline, and `ds/` against the design system; every mod's imports; desktop theme values |
| 2 | `herdr/` | `herdr-app check mods/industrial-os` | Installed herdr-app; loads the mod once with empty in-memory state, in a hidden window; changes nothing in the running app. It writes `gpui-kit.d.ts` and `jsconfig.json` into the mod folder for editors, and `gpui-kit.d.ts` into `parts/`, `plate/` and `reloader/`; Git ignores them | Every file of the mod loads and the sidebar's list materializes: prints `check passed: mods/industrial-os`, exit 0. It passes no props, so only the list's empty state renders; the pane header and the Pi Reloader are drawn in step 2a |
| 2a | repository root | `node herdr/scripts/check-droid-plate.mjs` | Installed herdr-app; a state the runtime ends with `interrupted` is run again, up to three times, since a busy machine does that now and then; runs `herdr-app check --print-spec` on temporary copies of the mod whose root is the pane header alone and whose `herdr` import returns sample panes, then on one whose root is the Pi Reloader, unchanged; changes nothing in the running app | The Pi Reloader's empty window draws in the runtime (no Pi, nothing run). The plate composes and renders in herdr-app's runtime for thirteen sample states (Pi idle, working, needs you, done and before its label; an agent; a shell, a running command; unfocused, inactive, zoomed, 40 and 198 columns), with the header width and font advance given as 2x samples; fails unless every piece starts on a cell boundary and the bay ends on W − 3; prints the cells as placed and the compose, warm-frame and draw times. Not layout, paint, timers, motion or input |
| 2b | An [isolated app](#isolated-app) | Show the storybook and the sidebar there; `herdr-app shot` each changed story, `herdr-app status` for `errors` | A second Herdr with its own home and core; changes nothing in the running app or its files | How each part looks in each state, on invented data; the sidebar on the isolated app's own spaces. Not the operator's data, and no real pointer |
| 3 | Herdr app | Manual, by an operator: install as in the [README](README.md#install), switch to the layout, and watch Pi agents with the signals publication and other agents, and every pane plate state, lighting level, key and motion | Changes the live app's files and layout | Populated rendering, every state, clicks, agent order, ahead/behind, live clocks, the look |

Then follow the [repository-wide checks](../CONTRIBUTING.md#repository-wide-checks). Record every check as passed, failed, skipped or not run. Step 2 proves the mod loads, not how populated rows look or behave.

### Isolated app

A second Herdr that the running one never sees: its own app home (`HERDR_APP_HOME`) and its own core (`HC_SESSION`, with the state and config folders moved). Nothing under `~/.config/herdr-app` is read or written, and the running app keeps the keyboard. macOS, herdr-app 0.1.16 and herdr-core 0.1.21.

```sh
S=/tmp/herdr-iso
iso() { env -u HC_TERMINAL_SOCKET -u HC_SCOPE -u HC_TERMINAL_ID HERDR_APP_HOME=$S/app HC_SESSION=iso XDG_STATE_HOME=$S/state XDG_CONFIG_HOME=$S/config "$@"; }

# Install into the isolated home: the mod, and a layout that is the storybook alone.
mkdir -p $S/app/mods $S/app/layouts $S/app/themes $S/state $S/config
rsync -a --delete --exclude .gen --exclude gpui-kit.d.ts --exclude jsconfig.json mods/industrial-os/ $S/app/mods/industrial-os/
cp themes/acid-black.json $S/app/themes/
printf '%s\n' '{ "id": "root", "type": "row", "background": "canvas", "children": [ { "id": "book", "type": "block", "content": { "mod": "industrial-os", "props": { "part": "storybook" } } } ] }' > $S/app/layouts/storybook.json

# Start it behind the other windows, then drive it.
open -g -n -a /Applications/Herdr.app --env HERDR_APP_HOME=$S/app --env HC_SESSION=iso --env XDG_STATE_HOME=$S/state --env XDG_CONFIG_HOME=$S/config
iso herdr-app status                                  # wait until it answers
iso herdr-app do layout.switch '{"name":"storybook"}'
iso herdr-app do industrial-os.story-next             # turn the page
iso herdr-app shot /tmp/story.png
iso herdr-app status                                  # "errors" must be []

# Stop it: the app that holds the isolated socket, then the isolated core.
kill "$(lsof -t $S/app/herdr-app.sock | head -1)"
iso hc server stop
herdr-app status                                      # the running app: still answering, "errors": []
```

- Every `herdr-app` and `hc` command for it goes through `iso`. Without it the command reaches the running app. Never run `hc server stop` without it.
- Set `"theme": "acid-black"` in `$S/app/settings.json`; `iso herdr-app do overlay.close` dismisses the first start's welcome window; `$S/app/window.json` (`{ "state": "windowed", "bounds": [x, y, w, h] }`) places the window before the first start.
- For the sidebar and the pane header, also copy `layouts/industrial-os.json`, add a `lunalee` mod that draws nothing (the layout names it), and switch to `industrial-os`. Its spaces are the isolated core's own: `iso hc` makes them. `iso herdr-app do industrial-os.storybook` then opens the storybook as a window; a layout switch closes it. `iso herdr-app do mod.open '{"name":"industrial-os"}'` opens the Pi Reloader, in any layout; a Pi started there for it must be a throwaway one, with its own `--session-dir`, as in the [Pi Reloader record](#pi-reloader).
- Saving into `$S/app/mods/industrial-os` reloads the mod there, so re-running the `rsync` shows a change at once.
- What it cannot show: the operator's data, a real pointer or key press (commands are sent with `do`), and the first-start state of a real install. With the home outside the user's folder the mod cannot list `.gen/` ([limits](docs/architecture.md#limits-and-evolution)).

### Probe window

A way to see the sidebar with live data without touching the installed sidebar, layout or keys. It opens a window in the running app, so it needs the operator's word each time. To see the parts on invented data, use the [isolated app](#isolated-app) instead.

1. Copy `mods/industrial-os` to `~/.config/herdr-app/mods/io-probe`, without `.gen`.
2. In the copy: `mod.json` becomes `{ "place": "none", "title": "IO probe", "overlay": { "kind": "window", "width": 300, "height": 1000 } }`; in `parts/drawings.js`, `MOD` becomes `"mods/io-probe"`, and in `main.js` the default part `"all"` (`p.part ?? "all"`), which draws the three blocks in one view. `rail: true` in that default draws the rail forms.
3. `herdr-app check mods/io-probe`, then `herdr-app do mod.open '{"name":"io-probe"}'` (the same command closes it), `herdr-app shot <file>` and `herdr-app status` for `errors`.
4. Delete `~/.config/herdr-app/mods/io-probe`.

What it cannot show: the three blocks as separate layout blocks, a 76 px rail (the window is at least about 300 px wide), the window buttons over the plate, and anything under the pointer unless the copy is patched to pretend. While Herdr is not the front app the window does not redraw, so a shot then is stale.

The theme has its own manual step: install as in the [README](README.md#theme), then `herdr-app status` must show no `settings.error`, and `herdr-app shot` shows the sidebar, tab bar, a terminal and an agent's status in the theme. Changes the live app configuration.

## Making a change

Change the source first: a color, opacity, word or mark in the design system's sidebar vocabulary (then `node herdr/scripts/sync-design-system.mjs`), a label field in [the snapshot contract](../pi/signals-collector/docs/contract.md). Then change the pure module and its test, then the part in `parts/` and its story if what is drawn changes ([parts](docs/parts.md#adding-or-changing-a-part)), then `main.js` if what is placed, read or run changes; update [the design](docs/design.md), and run the sequence.

## Verification records

Record each run with its date, app version and results.

### Droid-plate pane header

2026-11-17, macOS, Node 22.23.4, herdr-app 0.1.16 (`herdr-app check`), branch `feat/sticky-droid-plate`. The approved sticky droid plate (mockup revision 7): the new `mods/droid-plate`, its `ds/` copy and `scripts/sync-design-system.mjs`, the layout's 130 px pane header, and the design-system additions it draws with (their record is in [design-system contributing](../design-system/CONTRIBUTING.md#sticky-droid-plate-additions-2026-11-17)).

- `node herdr/scripts/sync-design-system.mjs --check`: `ds copies match the design system` (20 files then; 21 with `glyph-shapes.mjs`, below).
- `cd herdr && node --test`: **59/59 passed**, 0 failed, skipped or cancelled: the 45 existing checks (the layout check now requires the `droid-plate` header at 130 px) and 14 droid-plate checks.
- `herdr-app check mods/droid-plate`: `check passed: herdr/mods/droid-plate` (empty state: no pane, so it draws nothing).
- `node herdr/scripts/check-droid-plate.mjs`: **all 12 states passed** in herdr-app's runtime; the first compose took 23–73 ms over three runs (in `init` here; in a task in the mod). The rows it printed were read for each state: unit, wordmark, serial, title block, strip and bay as the [design](docs/design.md#pane-plate) states.
- Runtime measurements with `herdr-app check` probes (not the mod): a render interrupted between 50 and 60 ms of work, `init` and a task between 500 and 700 ms; a 99-column plate composed in about 14 ms warm and 28 ms cold, a bank-switch frame in about 10 ms, a CRT boot frame in about 5–9 ms; the runtime has no `Intl` and no `structuredClone`.
- **Not run:** the live app. Install, the plate over real panes, alignment with the terminal's cells and fonts, the lighting levels, hover, keys, every motion, whether window activation redraws a pane header (the 500 ms fallback), whether T2's frames read as interruptible on a fast second click, and whether `close()` clears `io.droid-plate.v1` on a layout switch are all unverified.

### Droid-plate on the cell grid (live)

2026-11-17, macOS, Node 22.23.4, herdr-app 0.1.16, a 5120 × 2820 shot (2x, zoom 1), branch `feat/sticky-droid-plate`. After the operator installed the mod live, two defects showed: every Powerline cell of the peak was a `?` box, and the right title block was cut at the pane's edge, its barcode bars split between rows. Causes, measured in the app with a temporary probe build: the mod looked for a font named `JetBrainsMono NFM`, but `fonts()` lists `JetBrainsMono Nerd Font Mono`, so it drew in Herdr's JetBrains Mono, which has no Powerline glyphs; and it set each row as flowing text, whose glyphs advance 8.406 px while the terminal's cells are 8.5 px, the bar glyphs not filling their cells. Now every piece is placed on the measured grid and those glyphs are shapes (see [architecture](docs/architecture.md#droid-plate)). The operator authorized copying the mod into `~/.config/herdr-app/mods/droid-plate`, `herdr-app shot` and `herdr-app status`, nothing else; the installed copy equals the worktree's at the end.

- Measured: header 1684 px wide, the terminal 198 columns, a 64-character JetBrains Mono 14 probe 538 px (8.406 px), so the cell is ceil(8.406 × 2) ÷ 2 = 8.5 px.
- Live shot, device pixels: the plate starts at x 626; the barcode's last bar and the bay's ground both end at x 3958 = 626 + 196 × 17, the right edge of column W − 3 = 195; the `+` corner sits in column 197; the pane ends at 3994 (198 × 17 + 2, the 1 px remainder in the row's color). The peak is solid acid with straight edges and no `?` boxes; the barcode's bars run unbroken through both rows. `herdr-app status`: no errors.
- `cd herdr && node --test`: **61/61 passed**. `herdr-app check mods/droid-plate`: passed. `node herdr/scripts/check-droid-plate.mjs`: **all 13 states passed**, every piece on the grid and the bay ending on W − 3; at 198 columns the first compose took about 110–125 ms, a warm frame about 22 ms and the draw 7–15 ms in the runtime.
- **Not run:** a narrower pane live (the only shown tab has one pane, and switching was not authorized; narrower widths are covered by the tests and the 64- and 40-column runtime states); other display scales; hover, keys and motions live.

### Droid-plate review fixes and the grip-clear peak (live)

2026-11-17, macOS, Node 22.23.4, herdr-app 0.1.16, 5120 × 2820 shots (2x, zoom 1), branch `feat/sticky-droid-plate`. Fixes for every finding of the independent review, and the peak moved right of Herdr's drag grip. The operator authorized copying the mod into `~/.config/herdr-app/mods/droid-plate`, `herdr-app shot` and `herdr-app status`, with no focus change, tab switch or click; the installed copy equals the worktree's at the end.

- **Findings fixed, each with a regression test in `test/droid-plate.test.mjs` (or the design system's):** Unicode caller text drawn as `?` (unit-plate test, widths 1–160); a missing or malformed label keeps Herdr's WORKING or NEEDS YOU with no phase, question or clock (every Herdr status × four bad labels); label writes through `labels.js` (deferred, rejected and hung `hc`, terminal replacement, bounded retries, `close()` superseding); K4 deferred to the end of the playing motion, on the real `Scheduler` with a fake clock (no zero-delay loop, a fired deadline never re-armed, nothing left running after `stop()`); wide panes (198–4000 columns: 256 composed, the middle widened, every row tiled and the bay and barcode on W − 3); T2, H1 and the reveal native, with only the character-level motions on a timer.
- **Grip:** measured from the operator's screenshot, 56 × 36 device px at 2x, so 28 × 18 px. The peak's first cell is `ceil((W_px / 2 + 14) / cell) + 2`; it needs 80 columns (was 72).
- **Live, device pixels:** the 198-column pane (header x 626–3994, centre 2310, the grip's right edge 2338): the peak spans x 2379–2715, columns 103–122, 2.4 cells past the grip, dark and then lit with Pi working (`■ THINKING 00:17 esc steer`). A shot that caught the operator on a two-pane tab: both 98-column plates have the peak at columns 53–72, 2.06 cells past the grip, one dark and one lit. `herdr-app status`: no errors.
- **Live probe (temporary build, not the mod):** opacity transitions with per-bank delays on elements first drawn at 0, then at 1, animated in order and were not disturbed by redraws every 250 ms; an element that first appears at 1 does not animate; a width transition from a primed value animated.
- **A blank header seen once:** two shots 3 s and about 45 s after one hot reload showed the header's slot empty; a debug build (the same mod, errors drawn as text) then drew normally with no error and no stuck task, and every later shot of the real mod drew. The cause was not found. Render no longer starts the activation poll (the update task does), in case a timer started in render fails there.
- `cd herdr && node --test`: **66/66 passed**. `node herdr/scripts/sync-design-system.mjs --check`: match (21 files). `herdr-app check mods/droid-plate`: passed. `node herdr/scripts/check-droid-plate.mjs`: **all 20 states passed** (new: a 1200-column shell and Pi, a malformed label, a two-layer switch at 99 and 256 columns, a reveal, a CRT boot frame at 198); a cold compose is at most about 280 ms (a 256-column switch), a CRT boot frame 23–42 ms at 198 columns, a draw 7–23 ms.
- **Not run:** a real focus change, hover, hand-back or boot watched live (the motions' timing is from the tests and the probe); other display scales; the label on a layout switch.

### Sidebar redesign

2026-11-18, macOS, Node 22.23.4, herdr-app 0.1.16. The sidebar became the redesign: the crate plate with the map, ACTION REQUIRED, missions and agents views, the search bar and the rail, on the design system's new sidebar vocabulary. The probe window below changed the running app (a floating window, nothing installed) and was run with the operator's explicit authorization for this change.

- `cd herdr && node --test`: **56/56 passed**, 0 failed, skipped or cancelled; **55/55** after the ACT/MDL access decay, which the redesign no longer draws, was removed with its check at the operator's request.
- `cd design-system && node --test`: **676/676 passed**, including the new `foundation/sidebar-vocabulary.test.mjs` (6).
- `herdr-app check mods/industrial-os`: **`check passed: mods/industrial-os`, exit 0**. It passes no props, so it renders the list block's empty state only.
- **Probe window**, as in [the procedure](#probe-window), with the operator's live spaces (5 spaces, 6 panes, two Pi working): `herdr-app status` showed `errors: []` on every load. Seen in `herdr-app shot`: the plate with its readings, light band, map and crosshair; the shortcut strip; ACTION REQUIRED with one `DNE` row; the view ruler; bands, map windows with zones, tags and the dithered edge; tab titles; pane rows with marks, halos, ages and context; the search bar.
- Seen only in copies patched to pretend, because nothing moved the operator's pointer or focus: a focused Pi's open block; a pane under the scanner with its readout and the map bracketing it; a band's `+ NEW TAB` key; the hide grip opened; the white ruler pointer; the search bar hot; the agents view; the plate's crosshair on an ACTION REQUIRED unit; the rail forms, in a 298 px window.
- CPU, `top` on the Herdr process, percent of one core, rough: with the map at 30 frames a second about 35 open against 19 closed, 29 with the maps frozen and 23 with the marks frozen too. At the shipped 20 frames a second about 25 open against 16 to 19 closed. Other terminals were busy throughout.
- Found on the way: `line_height(17)` is a multiplier, not pixels (text landed 85 px low); the probe window does not redraw while Herdr is not the front app.
- **Installed**, at the operator's request, 15:21: the mod folder was replaced (the old one kept as `~/.config/herdr-app/industrial-os-mod.before-redesign-20261118-152126.tgz`), and in the installed layout only the `brand` and `sidebar-footer` blocks were changed in place, after a backup beside it, because that file carries a local edit this repository does not (the pane header is `droid-plate` at 130 px). `herdr-app status`: `errors: []`. `herdr-app shot`: the three blocks in the 304 px sidebar, five spaces with their maps, a live `SUB` pane with `01AU` and its spinner, `↓20`, the grip and the search bar. Herdr used about 35% of one core in front with it installed; no clean baseline was taken at that moment.
- Not run: whether the three blocks share state; the rail at 76 px; the macOS window buttons over the plate; real pointer hover, clicks, the pointer-following dots, ticker tape and scrolling; `industrial-os.fold` from a key; a state change's latch; `QNS`, `BLK`, `RUN` and unknown readings with live data (fixtures only); a machine name over 12 characters; a font other than `JetBrainsMono NFM`; the `.gen` folder past 1500 files.

### Sidebar details

2026-11-18, macOS, Node 22.23.4, herdr-app 0.1.16. Nine details the operator found missing against the mockup: the hide grip grows open; the search bar became a hint (typing in place and a flicker were built first, then removed at the operator's word, since Herdr's picker takes no text from another mod); the map is exposed (its light added back over itself) and its window brightens and dims in 200 ms; the ground's dots come up near the pointer and under a sweep; the gutter bars are lamps that pulse slowly (the first, static and three layers deep, was too harsh); nothing stops while another app is in front; the window buttons moved onto the plate's gutter (`traffic_lights` `[17, 10]`); the scanner's readout types in and is always lit. With them: the white gutter bar grows, the scanner fades in, `+ NEW TAB` opens and the rail's unfold strip fills. Every tooltip was removed at the operator's word.

- `cd herdr && node --test`: **57/57 passed** (58/58 after the third round), 2 of them new (the readout's frames; the ground's light).
- `cd design-system && node --test`: **676/676 passed**; the vocabulary gained `groundDotRest` and `sweep` and lost `search` and `searchHover`.
- `herdr-app check mods/industrial-os`: **`check passed`, exit 0**. Temporary copies with the default block forced to `top` and to `bottom` also passed `--print-spec`, showing the search hint and the grip's four transitions; the copies were deleted.
- **By hand, not kept:** every block rendered in Node against stand-ins for `gpui-kit`, `gpui-base` and `herdr` with invented spaces and panes, playing the pointer over every pane in both views, ACTION REQUIRED, the bands, the grip, the ground and the search hint, and the rail forms: no error, no id used twice, no tooltip, 29 to 41 ground dots lit, the readout drawn for each pane, and every pulse on a box rather than on an image.
- **The map's exposure** was set against the mockup in Chrome (the same drawings beside a mockup still), then seen in `herdr-app shot` of the installed sidebar: lit text, brighter zone dots. Also seen there: the gutter lamp, the resting ground, the sweep line at two heights 40 s apart, the search hint.
- **Installed** at the operator's choice ("install only", no probe window), 16:01, 16:06 and after the operator's second round: the mod folder replaced (the old one kept as `~/.config/herdr-app/industrial-os-mod.before-details-20261118-160143.tgz`) and `traffic_lights` changed in place in the installed layout after a backup beside it. `herdr-app status`: `errors: []` both times.
- **A hovered tag's status plate** burned out to pale yellow under exposure with crisp black print on it, which the operator saw as a harsh border. The plate is now drawn at 78% and its print is exposed with it; in Chrome it lands on about `#c0ff0d` with dark green print, as the mockup's does. Not seen in the live app.
- **After merging `main`** (the droid-plate pane header, zsh theme): `node --test` **80/80**; design-system **708/708**; `node herdr/scripts/sync-design-system.mjs --check` matches; `herdr-app check` passes for `industrial-os`, `pi-reloader` and `droid-plate`; `node herdr/scripts/check-droid-plate.mjs` all 20 states. The merged layout was not installed: the installed one already carries both changes.
- **Sixth round:** `00AU` on a pane at rest, the focused pane's bar two rows tall at most, the latch at `latch` strength, and the map and ground light at 30 frames a second (`FRAME_MS` 33) by the operator's choice. `node --test` **59/59**; design-system **676/676**.
- **Fifth round:** the search hint flickers with red and cyan fringes as the pointer reaches it (`flickerFrame`, `FLICKER_AT`; `fringeRed` and `fringeCyan` back in the vocabulary), and glass comes up behind it. `node --test` **59/59**, 1 new; design-system **676/676**. Not seen in the live app: it needs the pointer.
- **Fourth round:** the `CTX` light at 0.55 of the gutter bar's; a right click on a tab title opens Herdr's `menu` popup for that tab; the plate's camera pans to a new watched unit (`swing`, `beltAt`) instead of jumping; new rows come in after a fold or unfold as they go out (`eraseRows`, `typeRows` deleted). `node --test` **58/58**. In the Node stand-in the right click asked for `{ mod: "menu", kind: "popup", props: { tab: "tab", target: { id, space } } }`. Not seen in the live app: the menu, the pan and the unfold.
- **Third round:** the fold and unfold motion (`fold.js`, covers of ground over each block, a scan line), one sliding scanner per list in place of one per pane, and a stronger light on the `CTX` bar. `node --test` **58/58**, 1 new (the fold's timing, rows and scan line). In the Node stand-in: every step of both motions drew covers over all three blocks at both widths, a grip click ran `layout.resize` once and cleared its state, and the scanner kept one element while it moved between four panes. `⌘\` was bound to `industrial-os.fold` in the operator's keys.json (backup beside it).
- **Not run:** the fold and unfold in the live app, and whether the pane and the list body both receive a pointer move (the sliding scanner needs it; without it each pane shows its own still scanner, as before). Anything that needs the pointer or keyboard in the live app, since nothing moved the operator's: the grip growing, the readout typing, the scanner and bar coming up, the ground's light under the pointer, the lamps' pulse, the rail's strip and lens. The window buttons' new place (`herdr-app shot` does not capture them). Motion with another app in front. CPU with the ground's light: `top` showed 46 to 54 against 39 to 52 before, with other terminals busy both times, so no difference can be claimed.

### Sidebar parts and storybook

2026-11-18, macOS, Node 22.23.4, herdr-app 0.1.16, herdr-core 0.1.21, branch `feat/herdr-gpui-parts-storybook`. `main.js` (979 lines) was split into 21 files in `mods/industrial-os/parts/` and a 508-line `main.js` that places them; the storybook (`storybook.js`, `stories.js`, `sample.js`) and `stand-in/` were added ([decision](../docs/decisions/herdr-combined-mod.md)). No look was meant to change. The running app was not touched: everything seen was in an [isolated app](#isolated-app).

- `cd herdr && node --test`: **86/86 passed**, 0 failed, skipped or cancelled: the 80 existing checks (the import check rewritten for `parts/`) and 6 new ones in `test/industrial-os-parts.test.mjs`. Three of the new checks were each seen to fail with the thing they guard taken out, then restored: the storybook's `scoped` call ("no element named twice"), the readout's rest, and the writer going on without a folder listing.
- `herdr-app check mods/industrial-os`, `mods/droid-plate`, `mods/pi-reloader`: each `check passed`. `node herdr/scripts/sync-design-system.mjs --check`: `ds copies match the design system`. `node herdr/scripts/check-droid-plate.mjs`: `all 20 states passed`.
- **The sidebar draws what it drew before, by hand, not kept:** the mod at `origin/main` and the split mod were each loaded on the stand-in and put through one scripted session on the sample window (every element hovered in both views, every band shut and opened, focus moved to seven panes, a long machine name, overlong titles, seven more questions, unknown readings, an update, the fold to the rail and back frame by frame from the key and from the grip, an empty window, the probe's one-view forms, and every click and right click). **All 1754 drawn trees, the commands run and the overlays opened were equal**, hover and pressed styles included. Changing the lamp's period from 2800 to 2801 made 1361 trees differ, so the comparison sees a change. The stand-in records styles, ids, handlers and motions; it does not lay out or paint.
- **Isolated app, the storybook in a layout block:** all 19 stories shot with `herdr-app shot` after `industrial-os.story-next`, `herdr-app status` showing `errors: []` throughout. Seen: every specimen labelled and inside its box, marks, lit text with halos, glows, dot grids, the map on dark and on paper, the open grip, ACTION REQUIRED with its `+ 03 MORE`, the 22 pane-row states, the rail's forms. One specimen (`keyParts`) ran past its box and was widened.
- **Isolated app, the `industrial-os` layout:** the three blocks drew two spaces made there, a shell in each, with `errors: []`; `herdr-app do industrial-os.storybook` opened the window over it (`overlays: ["industrial-os"]`), with `CLOSE` in its header, and `industrial-os.story-next` turned its page. A layout switch closed it.
- Found on the way: herdr-app writes `gpui-kit.d.ts` into `parts/` too (now ignored); it refuses to list a folder outside the user's home by throwing at the call, which the drawings' writer did not catch, so with the isolated home in `/tmp` no drawing was ever written, at `origin/main` as well. The writer now goes on without the listing; 115 drawings were written there afterwards. `overlay.close` does not close a window: only the mod (`CLOSE`) or a layout switch does.
- **Review:** one independent reviewer read the whole diff and found no correctness defect and four smaller things, all fixed: ACTION REQUIRED worked out every row's place on each draw (now when the pointer reaches the row, as before the split); the storybook redrew a settled readout every 30 ms (now it steps for 1.2 s and rests until it types again, seen typing again in the isolated app); the stand-in took any `on_…` method and dropped pressed styles (now it knows four events and records them); the writer's fix had no check (now it has). The trees were compared again afterwards.
- **Afterwards, installed (2026-11-18, with the operator's word):** the merged mod was copied over the installed one, after a backup; `herdr-app check` passed on the installed folder, `herdr-app status` showed `errors: []`, and a shot showed the sidebar drawing the operator's five spaces. The storybook's window was not opened there.
- **Not run:** the operator's data beyond that shot, a real key press or pointer (hover styles, the ground's light, dragging the window, `CLOSE` clicked), the storybook's index scrolled in a short window, a theme other than Acid / Black, and a font other than `JetBrainsMono NFM`. Whether the sidebar looks the same in the app after the split was not compared pixel for pixel: the trees are equal and the isolated sidebar drew without errors.

### One mod

2026-11-18, macOS, Node 22.23.4, herdr-app 0.1.16, herdr-core 0.1.21, Pi 1.5.2, branch `feat/herdr-combined-mod`. The `droid-plate` and `pi-reloader` mods were moved into `mods/industrial-os/` as `plate/` and `reloader/`, each chosen by a `part` prop ([decision](../docs/decisions/herdr-combined-mod.md)). No look and no rule was meant to change. What changed in code: 14 `ds/` import paths in the plate's `model.js`, `motion.js` and `plate.js`, the two views' exports, the mark's path, the Pi Reloader's command names, the root view in `main.js`, `mod.json`, the layout's pane header and the keys snippet. `reloader.js`, the plate's `clock.js` and `labels.js`, and all of `ds/` moved byte for byte. The running app was not touched: everything seen was in an [isolated app](#isolated-app).

- `cd herdr && node --test`: **89/89 passed**, 0 failed, skipped or cancelled: the 86 before, with the import checks rewritten for one mod, 2 new ones in `test/industrial-os-root.test.mjs` and one for the import reader itself. Seen to fail with the thing it guards taken out, then restored: the Pi Reloader answering its old command names; the root not handing on Herdr's `close`; and the import check with `net` reached from `plate/view.js` by an import after a `;`, by `import{connect}from"net"`, by a re-export, by `import()` and by `import (`, and with `fs/promises` imported in a part.
- `herdr-app check mods/industrial-os`: **`check passed`, exit 0** (the sidebar's list; the check passes no props). `node herdr/scripts/sync-design-system.mjs --check`: `ds copies match the design system` (21 files; the imports are now found in any folder of the mod).
- `node herdr/scripts/check-droid-plate.mjs`: **`all 20 states passed`**, and the new last step, `pi-reloader: passed, the empty window drew in the runtime`; that step was seen to fail with an action's text changed. Its printed plates were compared with the same script at `origin/main`: all 20 states' cells and grid checks equal, apart from a wall-clock time one state prints.
- **That script is flaky, at `origin/main` too.** One state now and then ends `interrupted`: on the branch while composing in `init` (`pi-tool` once, `switching-wide` once, and one failure not captured), at `origin/main` in render (`pi-tool` once). Run in turn, 14 times each: `origin/main` failed once and the branch never; over every run made, `origin/main` failed 1 of 26 and the branch 3 of about 40, some of those while other work ran on the machine. In the runs that passed, compose and draw times are the same on both. A failed run passed when repeated. That is too few failures to tell the two trees apart, so the branch is not shown to be as steady as `origin/main`, only not shown to differ. Not fixed here.
- **The sidebar draws what it drew before:** the scripted session from the [parts record](#sidebar-parts-and-storybook), on the stand-in, at `origin/main` and on the branch: **all 1754 drawn trees, the commands run and the overlays opened were equal.**
- **Isolated app, the `industrial-os` layout, with only the one mod installed:** the sidebar's three blocks and the pane header drew (`TERM-ZSH` plates with folder, `READY` and the key bay), `errors: []`. `mod.open` with `industrial-os` opened the Pi Reloader's window (`IDLE OR DONE PI (0)`), and again closed it. With the storybook's window open as well (`overlays` listing two), `mod.open` closed only the Pi Reloader and so did `industrial-os.reloader-close`; `industrial-os.fold` folded the sidebar and closed neither. With no Pi there, `industrial-os.reloader-reload` showed `Nothing to do`. A layout switch closed the storybook's window.
- **Isolated app, one throwaway Pi:** a Pi started in the isolated core's shell through a function `pi() { command pi --no-extensions -e <checkout>/pi/reloader-guard/src/extension.ts --no-tools --no-mcp --no-skills --no-prompt-templates --no-context-files --no-themes --session-dir /tmp/herdr-iso/sessions "$@"; }`, given no prompt, so no model was called. Its pane header drew the droid's plate (`DRD-????`, `PI AGENT DROID`, Pi's key hints; no signals label there) and set `io.droid-plate.v1=1`. The window listed it `idle  guard`. `industrial-os.fold`, sent twice with the window open, started nothing: the guard's token was unchanged. `industrial-os.reloader-reload` reloaded it: a new port and token in `io.pi-reloader.v2`, Pi printed its reload line, and the window showed `Reload all Pi: Success`, `Reloaded: 1 · Skipped: 0 · Failed: 0`. Pi was then quit with ctrl-d and its guard label went. The hash of `~/.pi/agent/settings.json` and the count of `~/.pi/agent/sessions` were the same before and after; the session folder was empty and removed.
- **Isolated app, the label on a layout switch:** with the labels cleared by hand first, the shown pane's terminal got `io.droid-plate.v1=1` in the `industrial-os` layout and lost it on switching to another layout, so Herdr's `close` reaches the pane header through the root view. The three mods at `origin/main` did the same there.
- Before the move, a throwaway mod in the isolated app showed that a root view can make another view with `new` and hand it `init` and `render`, and that a layout's and `mod.json`'s `props` reach `props()`; `herdr-app check` passed and its windows were looked at. The outcomes were not written down then; the combined mod working as above is the record.
- **Review:** one independent reviewer read the whole staged diff, the changed files, the old tree and the evidence above, and ran nothing itself. It found no regression in the root view's hand-over or in which copy answers which command, and three smaller things, all fixed: the import check missed `import{connect}from"net"` and `import ("net")` (it now reads every `import` and `from` name however spaced, refuses what it cannot read, and has a check of its own); the upgrade steps did not spell out both installed folders, and one paragraph still gave the Pi Reloader's old command names; and this record first put every flaky failure in `init`, when the one at `origin/main` was in render. It asked that the upgrade, a reset, a draft and a busy Pi, real input and a run cut short be looked at by the operator before relying on it.
- **Afterwards, installed (2026-11-18, with the operator's word):** the upgrade in the [README](README.md#upgrading-from-three-mods), after a backup. The three installed mods and the installed layout equalled the repository's before this change, with no local edits. The merged mod was copied over the installed one, the layout replaced, `cmd-alt-r` in `keys.json` changed to `mod.open:industrial-os`, and the installed `droid-plate` and `pi-reloader` folders deleted. Then: `herdr-app check` passed on the installed folder; `herdr-app status` showed `errors: []` after each step; a shot showed the sidebar and, with the old folders gone, both pane headers of the shown tab, one lit and one dark, the working Pi's strip showing its tool, target and clock; the two shown Pi terminals carried `io.droid-plate.v1=1` and all six Pis kept their guard labels. The operator pressed `cmd-alt-r` and reported that the Pi Reloader's window opens.
- **Afterwards, one reader of the signals label (2026-11-18, branch `refactor/herdr-one-signals-reader`):** the pane header's own `plate/signals.js` was removed and its view now imports the mod's `signals.js`, which gained what only the plate read: the session ID, the tool's name and target in a phase, and `working` as true, false or unknown (it was false when unknown; the sidebar never read it). The `io.droid-plate.v1` name moved to `plate/labels.js`. `node --test`: **89/89**; each of the two changed readings was seen to fail checks of both pieces when put back as it was. `herdr-app check mods/industrial-os` passed. `check-droid-plate.mjs`: all 20 states and the Pi Reloader's window passed, the plates' cells equal to `origin/main`'s apart from one printed wall-clock time. The sidebar's 1754 trees on the stand-in were equal to `origin/main`'s. Not seen in an isolated app and not reviewed by a second reader. Installed the same day with the operator's word, after a backup: `herdr-app check` passed on the installed folder, `herdr-app status` showed `errors: []`, and a shot showed both pane headers of the shown tab, a working Pi's strip showing its tool.
- **Afterwards, one copy of everything (2026-11-19, branch `refactor/herdr-one-copy-mechanism`):** what the mod held twice now lives once.
  - The sidebar's vocabulary is read from the mod's `ds/` copy (`vocabulary.js` is one re-export line), and `sync-design-system.mjs` writes `marks/` too; `sync-vocabulary.mjs` is gone. `--check` was seen to name a changed mark and an extra one, and the sidebar test to fail on those and on a value added to `vocabulary.js`. The 32 mark files did not change.
  - One text cleaner and one hash, in `format.js`, for the sidebar and the pane header. The pane header's strip changes in two ways, both checked in `test/droid-plate.test.mjs` for a command, a question, a tool's target and a branch name: a bidi control is now removed (it was shown), and a control character that is not a line break or tab is removed (it became a space). The sidebar's cleaner now turns a line break or tab into a space and folds runs of spaces (it removed the break and kept the run).
  - Also once now: the SVG document helpers and the blur filter (`assets.js`, used by `map.js`; the documents drawn for fixed inputs were byte-equal before and after), the priority order and active codes (`missions.js`, used by `map.js`), the title-mark and path patterns (`format.js`), the signals label's name in `sample.js`, the plate's row count, and the readout's redraw timer (`startReadout` in `parts/scanner.js`, used by the sidebar and the storybook), and the scanner's corner bars (one list, `scopeBars`, and its two sizes, which the moving frame's corners use).
  - The import check lists what a piece may take from outside its folder as `SHARED`; `plate/model.js` importing the sidebar's `model.js` was seen to fail it.
  - `check-droid-plate.mjs` now repeats a state the runtime ends with `interrupted`, up to three times. A throwaway mod whose render spins for 300 ms was run three times and still failed; a missing folder failed after one run. A state that passes only on a repeat says so in its line: the repeat keeps the script usable, and is not proof that the first run's time was the machine's and not the plate's.
  - `node --test`: **89/89**. `design-system` `node --test`: 708/708. `herdr-app check mods/industrial-os` passed. `sync-design-system.mjs --check`: match (22 files, 32 marks). `check-droid-plate.mjs`: all 20 states and the Pi Reloader's window passed, the plates' cells equal to `origin/main`'s apart from one printed wall-clock time. The sidebar's 1754 trees on the stand-in were equal to `origin/main`'s.
  - Isolated app: the storybook's MARKS page drew every mark and sign in its colours, and the `industrial-os` layout drew the sidebar's three blocks for one space made there with two shells, `errors: []`. The pane headers there were too narrow to read, so their look rests on the cells above.
  - **Review:** one independent reviewer read the staged diff, the changed files and the evidence above, and ran nothing itself. No regression found; `addressSeed` keeps the old signed arithmetic and the new imports make no cycle. Three smaller things, all fixed: the sync script read the vocabulary by file path where the repository's rule is the package name; this record claimed checks of a question and a branch that only a command had (they are added, with a fixed vector for the address seed); and the moving scanner frame rebuilt the corner bars' sizes (now shared).
  - **Installed (2026-11-19, with the operator's word),** merged as PR #95: the installed mod equalled the previous `main` with no local edits, a backup was taken, and the 14 changed files were copied over it. Then the installed mod equalled `main`, `herdr-app check` passed on it, `herdr-app status` showed `errors: []`, and a shot showed the sidebar and both pane headers of the shown tab. In that shot an inline image a terminal drew covered the left of its pane's header; not traced.
- **Afterwards, one meaning per name (2026-11-19, branch `refactor/herdr-unambiguous-names`):** names the mod used for two different things now say which: `LAMP_GLYPH` (a rail lamp's mark) and `LAMP_PULSE` (its pulse), `monoAdvance` (a monospace character's width; the plate's `advance` steps its motion), `contextReading` (the context bar's text, zone and percent; `contextBar` is the part that draws it), `fieldSvg` (the list's dotted ground; `groundSvg` is a map belt's), `emptyPlateMemory` (the pane header's; `emptyMemory` is the sidebar's), `SIGNALS_LABEL` and `RELOADER_LABEL` (with `PLATE_LABEL`), and `paneStory` (a story helper; `paneState` is the sidebar's rule). No behaviour changed: `node --test` **89/89**, `herdr-app check` passed, the sidebar's 1754 trees and the plates' cells for 20 states equal to `origin/main`'s. Not seen in an app; no second reader.
- **Not run:** a reload or reset from the installed mod, and clicks, arrow keys and Esc in its window; a real click or key on an installed pane header; a layout switch with the Pi Reloader open; **Reset all Pi** from the combined mod, and a draft or a busy Pi skipped live (those sequences are `reloader.js`, unchanged, with its tests); a Pi with the signals label under the combined pane header; saving the installed mod during a run; how long a new pane's header takes to appear now that it loads the whole mod.

### Gutter bar waits for the scanner

2026-11-19, macOS, herdr-app 0.1.16, branch `fix/herdr-gutter-bar-follows-scanner`. A pane's white gutter bar turned on with the pane's hover event, before the scanner frame had arrived, and its light showed at full height before the bar grew. Now `main.js` records which pane each scanner is aimed at and when it has settled there (its 120 ms fade over, or its 170 ms slide, `SCANNER_FADE_MS` and `SCANNER_SLIDE_MS` in `parts/scanner.js`); the bar grows only then, and a pane the frame only passes over gets none. The bar's light now fades in with it.

- `cd herdr && node --test`: **89/89 passed**. `herdr-app check mods/industrial-os`: **`check passed`**. No check covers the timing.
- **Installed (2026-11-19, with the operator's word):** only the changed files differed from the installed mod; after copying, the installed mod equalled the branch and `herdr-app status` showed `errors: []`. The operator hovered the sidebar and approved the timing.
- **Not run:** the isolated app, a second reader, and the ACTION REQUIRED rows' bar looked at on its own.

### Flat panes

2026-11-17, macOS, Node 22.23.4, herdr-app 0.1.16: the layout's pane radius 0 and no border or focus outline, taken from the operator's installed layout, which has run this way. `cd herdr && node --test`: **45/45 passed**; the layout check now requires them. Not checked: how a person tells the focused pane apart without the outline.

### Sidebar header

2026-11-17, macOS, Node 22.23.4, herdr-app 0.1.16:

- `cd herdr && node --test`: **45/45 passed**, 0 failed, skipped or cancelled: the new droid-count check, and the layout check now requiring the `brand` block to be `industrial-os` with `props.brand` and the sidebar at 300 px.
- Mutations, restored: counting every non-idle agent as working failed 1; leaving subagents out of the droid count failed 1.
- `herdr-app check mods/industrial-os`: **`check passed: mods/industrial-os`, exit 0** (the sidebar; the check passes no props).
- The header, by hand: a temporary copy with `brand` forced on passed `herdr-app check --print-spec`, showing `INDUSTRIAL OS`, `◐00`, `search` and `sidebar-toggle`. The copy was deleted.
- Live, at the operator's request: the installed layout had local edits (terminal padding, pane radius and borders), so only its `brand` block was changed in place, after a backup; the mod's `.js` files were copied in. The first install drew the whole sidebar in the header: a mod's props come from `props()` in `herdr`, not `init`'s argument. Fixed. Then the badge and count overlapped the search button on the macOS width; the badge went to 11 px. `herdr-app status`: `errors: []`. `herdr-app shot`: `INDUSTRIAL OS`, `◐03` in the working color, search and toggle, no overlap, while three agents worked. The `◐` mark was then replaced by the `NN DRD` plate, which covered the search button at 268 px (measured: the sidebar renders at the layout's 268 px; the saved 299 px state does not apply to a non-resizable node). With the sidebar at 300 px in the repository and installed layouts: `05 DRD` matched two working agents plus three units shown in the sidebar, then `07 DRD`, with no overlap. Then, at the operator's request: the badge became `INDUSTRIAL-OS ®` and the count `⟁ NN`. Weight 800 in the sidebar's `JetBrains Mono` drew no heavier than regular; the installed `JetBrainsMono NFM` drew it bold. `⟁ 07 DRD` covered the search button by about 20 px, so `DRD` was dropped: `⟁ 07` fits with search and toggle clear. Only the glyph in that font on this Mac was seen; fallback fonts were not. `⟁` is not in JetBrainsMono NFM (checked with fontTools), so its fallback glyph stayed thin; it is now `mark.svg` (stroke 3 of 24) and the shot shows it as heavy as the digits. `®` was then dropped from the badge at the operator's request: too small at 11 px.
- Not run: clicks, window drag, the rail, and a count of zero in the live app.

### Pi Reloader

Contract version 2, 2026-11-17, macOS, Node 22.23.4, hc 0.1.20, Pi 1.5.2. herdr-app updated itself from 0.1.15 to 0.1.16 at 11:55, minutes before the live run, so the live part ran on 0.1.16. The live part changed the running app and was run with the operator's explicit authorization for this change, against the project rule above.

- `cd herdr && node --test`: **44/44 passed**, 0 failed, skipped or cancelled: 27 existing and 17 Pi Reloader checks.
- `herdr-app check mods/pi-reloader`: **`check passed: mods/pi-reloader`, exit 0**. `--print-spec` shows the empty state (`IDLE OR DONE PI (0)`, `No Pi agent here is idle or done.`).
- Guard checks: [reloader-guard record](../pi/reloader-guard/CONTRIBUTING.md#verification-records).
- **Live, isolated.** One throwaway space `reloader-test` with three tabs, each a zsh running Pi through a shell function `pi() { command pi --no-extensions -e <checkout>/pi/reloader-guard/src/extension.ts --no-tools --no-mcp --no-skills --no-prompt-templates --no-context-files --no-themes --model google/gemini-3.5-flash-lite --session-dir /tmp/reloader-v2/sessions "$@"; }`, so the restart line used the same function. Each Pi was given one harmless first prompt so that its session file existed, which left it `done`; two were then set idle by writing `herdr.seen=<turn>`, the value looking at them writes. Input to the test terminals was sent with `HC_TERMINAL_ID` unset, never a slash command. A copy of the mod was installed as `mods/pi-reloader-test`, identical to this folder except a `mod.json` with `overlay.props.only` set to the three addresses. It was opened with `herdr-app do mod.open --name pi-reloader-test` and driven only with `herdr-app do pi-reloader-test.reload|reset`. Before any action, the window listed only the three test terminals and its `Test scope` line, while the sidebar showed the operator's other Pi agents. Screenshots `01-open.png` to `08-final-reload.png` are kept outside the repository with the handoff.
  - Reload, with one idle Pi, one idle Pi holding the typed draft `draft text do not run`, and one Pi working on a prompt: the idle Pi got a new label token; the draft and the working Pi were skipped; the draft was still on screen. Window: `Reloaded: 1 · Skipped: 2 · Failed: 0`. A second reload with the final code reloaded an idle and a done Pi and skipped the draft.
  - Reset, with the same idle and draft Pis and the third Pi now done: the idle and done Pis were quit, the mod typed `pi --session '<file>'` into each shell, and each resumed Pi (new pid, same session file) answered. The draft was skipped and intact. Window: `Restarted: 2 · Skipped: 1 · Failed: 0`. Run twice; the first build also wrote `herdr.seen=<turn>` for Pis that were idle (an unchanged value), the second is the final code with no marking.
  - Read state: through every reload and reset herdr-core's `turn` stayed 2 on all three terminals. The idle Pi kept `herdr.seen` 2 and read `idle` in `herdr-app ls` after each action; the done Pi kept `herdr.seen` 0 and read `done`. A reload sent straight to the guard showed the same. The window's focused space, tab and pane (`lunalee-chat`) were the same in 70 samples taken every 0.5 s through both resets.
  - Before the right shell function was in place, one test terminal ran a plain `pi` with the operator's extensions and default model for the first prompt, `Reply with the single word ok.` It answered `ok` and used no tool. That terminal was killed, and its session folder `~/.pi/agent/sessions/--private-tmp-reloader-v2-cwd--` (one user and one assistant message) was removed.
  - Cleanup: the window was already closed when cleanup began, with the view moved to the `lunalee` space by something other than the test; the space was closed (`space.close` with `confirmed: true`) and its terminals removed; `mods/pi-reloader-test`, its empty `data/` folder and `/tmp/reloader-v2` were removed; no test Pi process remained, and the count of `~/.pi/agent/sessions` matched. Hashes of `~/.pi/agent/extensions/*`, herdr-app `keys.json`, `settings.json`, `layouts/*.json` and the installed `pi-reloader` mod matched the snapshot taken before the run. Shipped mods and `layouts/.state/industrial-os.json` changed with the app's 0.1.16 update at 11:55. `~/.pi/agent/settings.json` changed at 11:57:00, 24 seconds after the full-extension Pi above started; its extension list is unchanged, and the writer was not confirmed. herdr-app's own `seen.json` lists `pi-reloader-test`.
- Not run: the shipped key binding (the snippet was not merged), clicks and arrow keys (no pointer or OS keys were used), fish or a Pi that is its terminal's own program (simulated), a layout switch during a run, and another machine.
- Correction to the version 1 record: it said a restarted Pi showed `done`. That Pi was already done before its reset. A reset or reload does not advance the turn, so an idle Pi stays idle.

### Lunalee column

2026-11-12, macOS, Node 22.23.4, herdr-app 0.1.15:

- Root `npm install` in the fresh worktree: linked the design-system package, 0 vulnerabilities, no tracked change. Before it, `test/app-theme.test.mjs` failed to resolve the package.
- `cd herdr && node --test`: **27/27 passed**, 0 failed/skipped/cancelled. The layout check now requires the column, as `root`'s third child, to equal the frozen contract, and nothing else to differ from shipped `main`.
- Mutation checks, each restored: the column at 600 px failed 1; the block naming terminal `lunalee` failed 1.
- `herdr-app check mods/industrial-os`: **`check passed: mods/industrial-os`, exit 0**. It does not load the layout.
- `check-config.mjs`: not run; it was removed with the herdr-tui configuration.
- Not run: installing the layout, switching to it and the live look, with and without Lunalee. The Herdr behaviours in the [README](README.md#lunalee-column) were observed by Lunalee's slice-0 check, not here.

### Industrial OS sidebar mod

2026-11-12, macOS, Node 22.23.4, herdr-app 0.1.15, hc 0.1.20:

- `cd herdr && node --test`: **27/27 passed**, 0 failed/skipped/cancelled: 21 mod checks, 3 layout and mod-folder checks, 3 desktop theme checks.
- Mutation checks, each restored: RUN placed before SUB failed 1; an unknown count shown as a number failed 3; the sidebar width changed in the layout failed 1; the label accepted from a non-Pi terminal failed 2.
- `herdr-app check mods/industrial-os`: **`check passed: mods/industrial-os`, exit 0** (the empty state: `SPACES`, `No spaces.`, `AGENTS`, `No agent has reported a status.`).
- Populated rendering, by hand: a throwaway copy of the mod with its `herdr` import pointed at a fake module returning two spaces, a working Pi with every row, a Pi with a question and unknowns, and a blocked Claude agent, passed `herdr-app check --print-spec` with the expected text in every row. The same copy with an invalid builder call failed the check. The copy was deleted.
- Not run: installing the mod or layout, switching layout, the live look, clicks, agent order, ahead/behind lookups, timers and `localStorage` in the running app, and the signals publication itself (another change).

### Acid / Black desktop theme
2026-11-12, macOS, Herdr desktop 0.1.14, herdr-core 0.1.19.

- `cd herdr && node --test`: **18/18**: 11 sidebar, 4 Spaces and 3 new desktop theme checks. Mutation: `working` set to `#c0fe05` failed 1 of 3, restored.
- `cd herdr && node check-config.mjs`: spaces, sidebar and their merge **`config: ok`, exit 0**; the unknown-token copy **rejected, exit 1**.
- `cd design-system && node --test`: **669/669**, including the new `HERDR_TERMINAL` check. With `PI_HOST_ROOT` set to the installed Pi: `pi/theme` **5/5**, `pi/status-bar` `test/footer-colors.test.ts` **1/1**, `pi/droid-header` **39/39**.
- Live, with the operator's permission: copied into `~/.config/herdr-app/themes/`, `"theme": "acid-black"` set in `settings.json` (backed up first). `herdr-app status`: `errors: []`, no `*.error` file. `herdr-app shot`: black sidebar and chrome, the selected space on the surface, the Working header and spinner in acid, a white focus border.
- Not checked: the light appearance (the theme is dark only), other layouts (`terminals`, `win98` set their own themes), and the blocked and done colors on screen.

### herdr-tui configuration (removed)

These records are for the herdr-tui fragments `sidebar.toml` and `spaces.toml`, their parser script `check-config.mjs` and tests, and the herdr-tui Spaces plugin, all since removed with the move to the Herdr desktop app. They are kept as history; links to removed files are plain text.

2026-10-08, macOS, Node 22.23.0, Herdr 0.9.3:

- Step 1, `node --test`: **3 of 3 passed**. Mutation check: a non-palette color and an unknown token each made their test fail.
- Step 2, `herdr config check` on the fragment: **`config: ok`, exit 0**. The same check on copies merged by hand into the live-spike configuration and into Herdr's `--default-config` output, in a temporary directory: **`config: ok`, exit 0** for both. A malformed token entry in a copy was rejected with a parse error, showing the rows are validated.
- Step 3, interactive: **not run** for this file. The spike configuration it was derived from was checked live on 2026-10-08, adding only the `$bar_unk` row entry here.

#### Pi-only layout follow-up

2026-10-08, macOS, Node 22.23.0, installed Herdr 0.9.3:

- `node --test`: **5/5 passed**, no skipped/cancelled tests. Colors/tokens are checked inside `rows_by_agent.pi`; the regression requires no global `rows`, panel-wide `row_gap = 1`, and a decorative-grey non-bold `bar_idle`.
- `HERDR_CONFIG_PATH=<temporary copy of sidebar.toml> herdr config check`: **`config: ok`, exit 0**, read-only. No server contact or live configuration change.
- Root links/anchors, guide inventory, exact CLAUDE entrypoints, whitespace and publication checks passed. The architecture diagram renders with existing grok-mermaid 0.2.3, non-null art and no warnings.
- Interactive rendering/reload: **not run**. Merge only `rows_by_agent.pi` and panel-wide spacing; preserve any existing global `rows` and other agent overrides.

#### SUB state

2026-10-08, macOS, Node 22.23.0, installed Herdr 0.9.3:

- `node --test`: **6/6 passed**. The new check reads the g1 state codes from the token contract and requires WRK and SUB accent, BLK and QNS critical, DNE primary and IDL/UNK decorative; removing the SUB rule made it fail.
- `HERDR_CONFIG_PATH=<temporary copy of sidebar.toml> herdr config check`: **`config: ok`, exit 0**. The same on a temporary copy of `herdr --default-config` with the fragment merged by hand: **`config: ok`, exit 0**. Read-only; no server contact or live configuration change.
- Interactive rendering: **not run** for this change.

#### Spaces validation (the procedure then)

From `herdr/`, run `node --test` for both fragments. The Spaces check reads the
plugin contract's one full-key-list line, tests every custom key exactly once,
every color against design-system exports and global state-icon theme roles.

Then run `node check-config.mjs` from `herdr/`. It invokes installed Herdr 0.9.3's read-only parser, only on temporary copies:

1. `HERDR_CONFIG_PATH=<spaces-copy> herdr config check`.
2. `HERDR_CONFIG_PATH=<sidebar-copy> herdr config check`.
3. `HERDR_CONFIG_PATH=<merged-copy> herdr config check`: merge Spaces color keys
   into sidebar's existing theme.custom, then append ui.sidebar.spaces once.
4. `HERDR_CONFIG_PATH=<invalid-copy> herdr config check`: a malformed row entry
   must be rejected, not treated as a valid merge.

The README then explained installation order and the global theme
scope. Interactive/live Herdr validation is not authorized and is not run.

#### Spaces fragment

2026-10-08, macOS, Node 22.23.0, installed Herdr 0.9.3:

**Passed**

- Root `npm install`: linked the existing design-system package; no tracked
  manifest/lockfile change. This resolved an initial missing-package test run.
- `cd herdr && node --test`: **10/10 passed**, zero skipped/cancelled; six
  existing agents checks and four Spaces palette/key/role/zero-state checks.
- `cd herdr && node check-config.mjs`: invokes exactly
  `HERDR_CONFIG_PATH=<temporary-copy> herdr config check` on each case:
  - `spaces.toml` alone: **`config: ok`, exit 0**.
  - `sidebar.toml` alone: **`config: ok`, exit 0**.
  - Both merged into one theme.custom table: **`config: ok`, exit 0**.
  - Invalid built-in row token: **rejected, exit 1**, expected; diagnostic
    `unknown sidebar token`. This is a successful negative check, not a failure.
- Root links/anchors, guidance inventory, exact CLAUDE imports, whitespace and
  publication review passed. Existing grok-mermaid 0.2.3 rendered changed root,
  Herdr and Spaces diagrams with non-null art and no warnings.

**Failed (resolved):** initial `node --test` before the root install could not
resolve the design-system package. Final required checks have no failures.

**Skipped:** none of the authorized required checks.

**Not run:** interactive/live Herdr, installed plugin invocation, reload,
rendering with/without scrollbar, native navigation/order and other color
depths/fonts. The approved quiet-space git-only second-row exception and the
five theme keys' wider effects were verified from source, not live rendering.

#### Spaces review fixes

2026-10-08, macOS, Node 22.23.0, installed Herdr 0.9.3:

- `cd herdr && node --test`: **10/10 passed**, zero failures/skipped/cancelled;
  Spaces keys now require `sp_` prefixes as well as exact contract membership.
- `cd herdr && node check-config.mjs`: runs only
  `HERDR_CONFIG_PATH=<temporary-copy> herdr config check`:
  Spaces alone, sidebar alone, and one-table merge each **`config: ok`, exit 0**;
  invalid row copy **rejected, exit 1** expected.
- Root links/anchors, guide inventory, exact CLAUDE entrypoints, whitespace and
  manual publication review: **passed**. No live config or server was contacted.
- Live/interactive Herdr and installation/reload: **not run**. Merge `$sp_` keys
  with the updated reporter; old unprefixed frozen tokens are no longer read.
  The plugin's corrected protocol evidence
  replaces the initial fake-server compatibility assumption, not parser evidence.

#### Spaces isolated rendering

2026-10-08: merged agents and Spaces fragments passed `herdr config check` and
ran in an isolated Herdr 0.9.3 server with the Spaces plugin linked; a client
capture replayed in xterm.js matched the design, including quiet rows with the
Spaces scrollbar shown. The run found quiet rows one cell too wide; the plugin
now sizes them for 31 cells (see the
plugin record).
Live session merge and reload: **not run**.

#### ACT / MDL access decay

2026-10-09, macOS, Node 22.23.0, installed Herdr 0.9.3; source checked offline:

- `cd herdr && node --test`: **13/13 passed**, 0 failures/skipped/cancelled. New checks: `ACT and MDL variants follow the complete access-decay color ladder in their original rows`; `Pi layout and every configured row fit Herdr 0.9.3 limits (16 rows, 16 entries)`; `exactly one ACT alternative resolves at every stage, with unchanged text order and no empty-row gap`. Existing exported-color, contract-key, exactly-one-entry and unaffected-state/Spaces checks still pass.
- `cd herdr && node check-config.mjs` runs only read-only `HERDR_CONFIG_PATH=<temporary copy> herdr config check`: sidebar, Spaces and one-table merge each **config: ok, exit 0**; malformed control **rejected, exit 1** expected.
- Initial implementation's single 24-entry ACT row was **rejected**: `sidebar rows may contain at most 16 tokens`. Source `src/config/sidebar.rs` also caps layouts at 16 rows. Approved correction: ACT d0+d1 and d2+d3 alternatives, 12 entries each; MDL eight entries in one row; eight configured Pi rows. `src/ui/sidebar/tokens.rs::agent_rows` drops empty alternatives; `src/client/shell/agent_sidebar.rs` applies row_gap only between AgentRow pane blocks. No extra gap is introduced; this is source/model evidence, not live rendering.
- Mutation proof: changed `dir_d2` from structural to the still-exported secondary color; `node --test --test-name-pattern='^ACT and MDL variants' test/sidebar.test.mjs` **failed 1/1, exit 1** as expected. Restored the ladder before the final **13/13** run.
- Root package setup, changed local links/anchors, guidance inventory, exact CLAUDE entrypoints, `git diff --check`, `git diff --cached --check`, new-contributor and exact-file publication/import/color reviews: **passed**. No new dependency or palette value; production reporter still renders no colors.
- Live/interactive Pi/Herdr, config merge/reload, terminal rendering and Mermaid rendering: **not run**; existing diagrams unchanged. Inherited `HERDR_*` variables were unset before every shell/test/parser run; no live socket/configuration or global Pi files touched. No push, PR or Linear mutation.
- Adoption requires the updated complete Pi row override and reporter together; merge rows first so later-stage keys can render. Memory-only age resets on reload/restart. Existing full-report partial-state/backoff, visibility approximation and untested font/color-depth limitations remain.

#### Acid & Orange theme (herdr-tui, removed)

This record is for the herdr-tui `theme.toml` fragment and `HERDR_CHROME`, both since removed.

2026-10-09, macOS, Node 22.23.0, installed Herdr 0.9.3. Inherited `HERDR_*` variables were unset before every shell, test and parser run.

**Passed**

- `cd design-system && node --test`: **388/388**, 0 failed/skipped/cancelled, including `package.test.mjs` **4/4** and `foundation/*.test.mjs` **21/21**. The new foundation check: `HERDR_CHROME` is frozen lowercase, `signalOrange` equals `SIGNAL_COLORS.cld`, and `mixOver(signalOrange, 0.3)` is `signalOrange30` `#4d1c00`.
- `cd pi/status-bar && node --experimental-strip-types --test test/footer-colors.test.ts` with the global Pi host: **1/1**. `HERDR_CHROME` is kept out of `SIGNAL_COLORS`, whose every value status-bar maps to a footer alias.
- `cd herdr && node --test`: **18/18**, 0 failed/skipped/cancelled; 13 existing sidebar and Spaces checks and 5 new theme checks.
- `cd herdr && node check-config.mjs`: Spaces, sidebar, theme, sidebar+Spaces merge and all-three merge each **`config: ok`, exit 0**; malformed row copy and misspelled theme key copy each **rejected, exit 1**, expected.
- Mutation checks, each restored: a non-exported `overlay1`, a `yellow` duplicated into `theme.toml`, `panel_bg` set to the surface, `blue` removed, and a changed `sidebar_bg` in `sidebar.toml` each failed the theme tests (2, 3, 2, 3 and 1 of 5 failing); `signalOrange30` set to `#4d1b00` failed the foundation check.
- Root changed links and anchors, guidance inventory, exact CLAUDE entrypoints, `git diff --check`, `git diff --cached --check`, new-contributor and publication/private-path reviews. Existing grok-mermaid 0.2.3 rendered the changed root and Herdr diagrams with non-null art and no warnings.

**Failed:** none. **Skipped:** none.

**Live merge:** the same 11 keys were merged by hand into the operator's config; `herdr config check` printed **`config: ok`, exit 0**, and `herdr server reload-config` returned **`applied`** with no diagnostics.

**Not run:** an agent-observed check of the rendered theme, the mobile layout, and other color depths. What each key colors is from Herdr 0.9.3 source, not observation; contrast ratios are computed from the hex values.

#### Pane-name row

2026-10-15, macOS, Node 22.23.0, installed Herdr 0.9.3:

- `node --test`: **19/19 passed**, zero failures/skipped/cancelled. Row 5 uses pane instead of ev_act, with secondary label and decorative gutter, no decay or phase-target entry. The full 52-key contract, palette and native row limits still pass.
- `HERDR_CONFIG_PATH="$PWD/sidebar.toml" herdr config check`: **config: ok, exit 0**. `node check-config.mjs`: Spaces, sidebar, theme and both merges **config: ok**; invalid row and invalid theme controls **rejected as expected**. Only checkout/temporary configs read; no live server mutation.
- Initial `node --test`: **failed**, missing root design-system package link. Supervisor authorized the documented root `npm install` setup exception: one local package linked, zero vulnerabilities, no tracked manifest/lockfile changes. Final checks above pass.
- Changed local links/anchors, guidance inventory, exact CLAUDE imports, both whitespace checks, new-contributor/publication/color review and full-diff simplification **passed**. Palette values unchanged; the new pane entry uses the exported secondary role.
- Live merge/reload, interactive rendering/rename, other fonts/color depths and Mermaid rendering: **not run**. Diagrams unchanged; no renderer on PATH. Update the reporter and complete Pi row override together.

#### Manual flag

2026-10-15, macOS, Node 22.23.0, installed Herdr 0.9.3; every `HERDR_*` variable unset:

- Root `npm install` in the fresh worktree: linked the existing design-system package, 0 vulnerabilities, no tracked change.
- `node --test`: **20/20 passed**, 0 failed/skipped/cancelled. New: `row 1 draws the manual flag in critical red after the SPACE name and before the goal time`, which also requires the contract to define `flag`; the existing contract-key, one-entry-per-key, palette and 16-row/16-entry checks cover the 53-key list and the six-entry row 1. Mutation proof, each restored: a secondary-colored flag and a flag moved after `gt_off` each failed it.
- `HERDR_CONFIG_PATH="$PWD/sidebar.toml" herdr config check`: **config: ok, exit 0**. `node check-config.mjs`: Spaces, sidebar, theme and both merges **config: ok**; invalid row and theme controls **rejected, exit 1**, expected.
- Placement and spacing are from Herdr 0.9.3 source (`src/ui/sidebar/tokens.rs::separator`, `src/ui/sidebar.rs::resolved_token_spans`): ` · ` between custom tokens, full width when the row fits. Live merge/reload and rendering: **not run**. Update the reporter and the Pi row override together; an old fragment does not draw `flag`.

#### RUN state

2026-10-17, macOS, Node 22.23.0, installed Herdr 0.9.3; every `HERDR_*` variable unset:

- `node --test`: **20/20 passed**, 0 failed/skipped/cancelled. The updated contract-state check requires RUN to use the same accent rule as SUB; the 53 keys and native row limits remain unchanged.
- `HERDR_CONFIG_PATH=<temporary copy of sidebar.toml> herdr config check`: **config: ok, exit 0**. Only the temporary file was read; no live Herdr or configuration was contacted or changed.
- Live merge/reload and interactive rendering: **not run**. Reporter verification and review fixes are in the sidebar record.

#### Spaces state icon

2026-10-29, macOS, Node 22.23.4, installed Herdr 0.9.5; every `HERDR_*` variable unset for the parser:

- `node --test`: **20/20 passed**. The Spaces checks now require no `state_icon`, and a leading `$sp_panes` in decorative grey with `◐` accent, `×` critical and `✓` primary rules; the five global state-icon theme keys keep their roles.
- `node check-config.mjs`: Spaces, sidebar, theme and both merges **config: ok, exit 0**; invalid row (now replacing `$sp_panes`) and invalid theme controls **rejected, exit 1**, expected.
- Rendering in an isolated Herdr is in the Spaces record. Live merge/reload: **not run**. Update the plugin and this fragment together: an old fragment draws Herdr's icon before the new `◐ 05PN`, and a new fragment with an old plugin draws no icon.
