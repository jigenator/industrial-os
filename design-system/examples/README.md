# Examples: storybook and showcase

Two terminal hosts compose the real elements and motions; the storybook also shows the foundation's color data. Neither is a released API or a framework.

| Entry point | What it is |
| --- | --- |
| `node examples/storybook.mjs` | Terminal storybook: browse each element by state, each motion by example, and the foundation colors by view, with usage and contract notes |
| `node examples/showcase.mjs` | The first four elements (numbered panel, label plate, gauge, status row) composed on one scrolling screen |

Commands, options, and exit codes are in [Contributing](../CONTRIBUTING.md#running-the-hosts). Commands run from `design-system/`, and the paths the storybook displays, such as `elements/gauge/README.md` and `foundation/signal-colors.mjs`, are relative to it.

## Browsing the storybook

The index has three numbered sections: **1 COMPONENTS**, one story per element; **2 MOTIONS**, one story per motion, then the composed MARKER TIMELINE; and **3 FOUNDATION**, COLORS and SIGNAL COLORS. Stories are numbered in index order. The selected story is marked `>` and also named in the panel header, so the selection never depends on color. Each story shows its states, examples, or views (the selected one in `[brackets]`, or `n/N` and the selected name when they do not fit), a specimen, the call that drew it, and the main contract rules, with a link to the owning README.

| Keys | Action |
| --- | --- |
| `j`/`k`, Down/Up, Tab/Shift-Tab | Next or previous story |
| `1`–`3` | Jump to the first story of a section |
| `l`/`h`, Right/Left | Next or previous state, example, or view |
| Space/PgDn, `b`/PgUp | Page the details |
| `p`, `r` | Pause or resume, or replay, a motion preview; neither works while motion is off |
| `o` | Turn motion off for the whole storybook, or on again |
| `?` | Show or hide every key; Esc also hides it |
| `q`, Esc | Quit; Ctrl-C quits from anywhere |

The footer always shows the hints that fit, and the visible line range when details overflow. When the index is taller than the screen, it scrolls to keep the selected story in view, and its first or last line says how many stories are out of view (`12 MORE ABOVE`); a full-height snapshot lists every story. Below 72 columns or 15 rows the index gives way to the panel header. When the panel cannot fit, one line names the story number and selected state. Nothing assumes a larger terminal than the one supplied.

### Left clicks

The live storybook opts into normal mouse tracking (DECSET 1000) with SGR cell reports (1006).
A cooperating terminal must forward `ESC [ < button ; column ; row M` / `m` with 1-based cell
coordinates; xterm's [mouse protocol](https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Mouse-Tracking)
is the reference, not a compatibility claim for every terminal or Herdr.

Unmodified left-button **presses** activate complete visible story index labels (in a scrolled index, the
rows in view; its `MORE` lines are inert), variant names,
and footer controls: previous/next story or variant, play/pause, replay, motion off or on, page down/back,
keys/close, and quit. Releases do not activate again. Right/middle buttons, modified clicks, wheel,
and motion reports are consumed without actions. There is no hover, drag, wheel navigation, or
configurable gesture layer. Usage code, specimens, help prose, line ranges, padding, and gaps are inert.
Disabled page controls (already at that edge), play/pause and replay while motion is off, and unavailable no-color playback do nothing.

Targets come from the same composition as the drawn labels, and are replaced on each repaint,
including help, paging, and resize. No clipped label is treated as a complete control. Narrow layouts
show shorter, separate key labels; short layouts may omit the index or tabs, and tiny sizes may offer
no click targets. **Every keyboard control above remains available**; use `?` for the key list.
Selecting a different story or variant uses the same reset, autoplay, and timer handling as keyboard navigation.

Only this live storybook enables 1000/1006. The showcase and snapshots do not change mouse modes.
The session disables both modes on keyboard or click quit, Esc, Ctrl-C, SIGINT/SIGTERM/SIGHUP,
process exit, and guarded failures, alongside restoring cursor, screen, and cooked input. No motion
tracking (1002/1003) or pixel-coordinate mode (1016) is enabled.

Node v22.23.0's key decoder emits the SGR prefix followed by separate characters. An example-local
accumulator consumes the packet, retaining at most 32 payload characters; invalid/overlong payloads
are discarded through their CSI final byte. It adds no timer. An unfinished report can consume ordinary
keys until that final byte; a new decoded escape sequence, standalone Esc, or Ctrl-C recovers immediately
(after Node's usual standalone-Esc delay). Non-SGR legacy reports are discarded, not clickable.

### Playback rate

Motion previews are labeled `DEMO` and framed as `DEMONSTRATION`. The storybook has one motion setting, on at start; the first story is a component, so nothing plays until a motion is selected. While motion is on, selecting a motion preview, by key, section digit, or click, plays it automatically from its start. A one-shot preview holds its last frame (`COMPLETE`) and replays from the start 1.5 s after it completes; a looping preview plays until paused. `p` pauses or resumes and `r` replays. `o` turns motion off for the whole storybook, from any story: every preview shows its stable, final view, no timer runs, later selections stay settled, and `p` and `r` do nothing. The footer reads `O MOTION OFF` or `O MOTION ON` for what `o` will do; pressing `o` again turns motion on and plays the current preview if it can. Opening the key list pauses a playing preview, or holds a waiting replay, and closing it resumes either; a preview you paused stays paused. Snapshots never play.

While a preview plays, the host runs one interval timer **at that motion's own step**, so a preview is not a slowed-down sample: the ping's 40 ms grid, the activity light's 50 ms toggle, a draw-in's 50 ms tick. Motions whose frames change continuously with time (scan, pulse, reveal) redraw every 67 ms, at most 15 frames a second. The `DEMO` line always shows the interval in use (`50 MS FRAMES`), with the elapsed time and the loop length or total duration. A terminal or timer that falls behind still shows the frame for the current time, never a frame from a slower clock.

The host runs that one timer only while a preview plays or, with motion on and the key list closed, while a finished one-shot waits to replay; during that wait it redraws nothing until the replay. Moving to a preview with a different step restarts the timer at the new step. The host stops the timer on pause, when motion is turned off, on selecting a still story or a preview that cannot play, when the key list opens, and on every exit path. A completed preview holds its last frame, at the end of its duration for the current width. For every finite motion except ping that equals the motion-off view; a completed ping keeps its bars gone, because its motion-off view (the input bars) is only the specimen before playback. The MARKER TIMELINE shows how a host drops the bar row. Seeded examples (restrike, ghost) show their seed in the generated call.

Fast and flashing examples say so in their notes and rules, such as the activity light (10 lit onsets a second) and the threshold flash (10 a second); [design](../docs/design.md#fast-and-flashing-motions) lists their rates. Without color, motions that change only styles look identical to motion off, so they do not play; those whose plain text changes still can, and a check confirms each example's flag against its frames.

### Marker timeline

The MARKER TIMELINE story composes claude-interrupt's whole DIRECTIVE UPDATED marker from three motions over the [transcript marker](../elements/transcript-marker/README.md#extension-timeline)'s pieces, because no single motion expresses it: `flash` with `FLASH_PRESETS.interrupt` on the live plate until `flashDuration`, then `wipe` settling the record plate (it shows the live style until 2800 ms); `ping` on the bars until `pingDuration` (1520 ms), after which the bar row is dropped; settled at 3000 ms. Its examples are outputPad 1 and 0. Motion-off is the settled record row with no bars. The regression checks compare every 20 ms of it against the timeline written from the transcript-marker README.

All element and motion values are labeled fixtures. The storybook reads nothing from the machine or any service.

### Colors

The COLORS story shows the IndustrialOS colors from [foundation](../foundation/README.md#industrialos-colors). It is a reference page, not a theme: the storybook itself stays Acid / Black, and the title notice reads `REFERENCE VALUES, NOT A THEME OR LIVE DATA` instead of the fixture notice. Its two views are:

- **PALETTE**: all 22 colors grouped by hue (lime, red/orange, magenta, violet/indigo, blue, mint, yellow, neutral). Each row has a swatch, the hex value, and the name, with the color's role on a wrapped line under it. A closing line gives the color and hue-group counts.
- **SHADES**: the five-step `shadeRamp()` of each color, as columns from 53 cells and one step per line below that. Only the `BASE` step is the listed color; the four other steps are marked `DERIVED`.

The SIGNAL COLORS story shows `SIGNAL_COLORS` from [foundation](../foundation/README.md#signal-colors) in one view, **BY USE**: count tiers and mode inks, gauge zone tracks, the lost segment, the checking fade, warm-up steps, and usage providers, each group with a note and each value with its swatch, hex, and key. A heading says the design system owns them and status-bar's `C` palette mirrors them, and that they are literal values, not Acid / Black roles, and separate from the IndustrialOS collection. Every displayed value is read from `foundation/signal-colors.mjs`; a key not yet grouped falls into an OTHER group rather than disappearing.

Swatches are full blocks with matching foreground and background. Hex values, names, and labels sit on the normal black field, so they stay readable whatever the swatch color, and every label reads the same in plain output, which adds a note that swatches show position only. Narrow widths stack the details and wrap long words instead of clipping them; every color, ramp step, and signal color is reachable by paging. Color views have no playback: `p`, `r`, and `o` do nothing, and no timer runs. No contrast or accessibility rating is claimed for any color.

## Reusing the system

Agents and applications use the same modules the storybook uses. Import paths are relative to the importing file; from `examples/`:

```js
import { numberedPanel, panelInnerWidth } from '../elements/numbered-panel/numbered-panel.mjs';
import { gauge } from '../elements/gauge/gauge.mjs';
import { statusRow } from '../elements/status-row/status-row.mjs';
import { scan } from '../motions/scan.mjs';
import { paint } from '../foundation/cells.mjs';

const width = 60;
const body = [
  ...gauge({ label: 'FILL', value: 42.5 }, { width: panelInnerWidth(width) }),
  ...statusRow({ label: 'DOOR', value: 'closed', status: 'success' }, { width: panelInnerWidth(width) }),
];
const frame = (time) => numberedPanel({ number: 1, title: 'BAY 04', meta: 'FIXTURE' }, scan(body, { time }), { width });
console.log(frame(1200).map((line) => paint(line, 'truecolor')).join('\n'));
```

- Renderers take values and an exact cell budget and return lines of `{ text, style }` spans; inline pieces such as plates return spans for the caller to place. Inputs, states, invalid-input errors, and narrow behavior are owned by each element README: [numbered panel](../elements/numbered-panel/README.md), [instrument frame](../elements/instrument-frame/README.md), [label plate](../elements/label-plate/README.md), [count plate](../elements/count-plate/README.md), [mode plate](../elements/mode-plate/README.md), [state chip](../elements/state-chip/README.md), [lamp](../elements/lamp/README.md), [status row](../elements/status-row/README.md), [gauge](../elements/gauge/README.md), [pixel numeral](../elements/pixel-numeral/README.md), [segment meter](../elements/segment-meter/README.md), [thread rail](../elements/thread-rail/README.md), and [transcript marker](../elements/transcript-marker/README.md).
- Motions decorate rendered lines at an explicit time. Parameters, defaults, presets, motion-off, and the host timer sketch are in [motions](../motions/README.md).
- Painting, color depth, and the text and glyph contract are in [foundation](../foundation/README.md).
- In the storybook, the usage text under each specimen is generated from the arguments that drew it. These are call fragments at that width; imports, variable declarations, and the explicit `time` value belong to your host. Curated glyphs appear as `\u` escapes so the text stays ASCII; a preset's values appear as a spread, such as `...FLASH_PRESETS.interrupt`.

## Module map

| File | Owns | Imports |
| --- | --- | --- |
| `storybook-stories.mjs` | The catalog in index order, `canPlay()`, and `motionParameters()` | Element, motion, and color stories; usage |
| `storybook-elements.mjs` | Element stories: titles, notes, state variants, and specimens from the real renderers | `foundation/`, elements, usage |
| `storybook-motions.mjs` | Motion stories (`motionStory()`), the composed marker timeline, and each example's redraw interval | `foundation/`, elements, motions, element stories' fixtures, usage |
| `storybook-colors.mjs` | The COLORS and SIGNAL COLORS stories: hue groups, palette rows, shade ramps, and signal colors by use | `foundation/` |
| `storybook-usage.mjs` | Usage text: `call()`, `literal()`, `code()`, and `spread()` build a call's source from its arguments | None |
| `storybook-layout.mjs` | Browsing state, `press()` actions, sections, the scrolling index, `advance()` and `playbackInterval()` for previews, and `composeStorybook()` frames | Stories, motion stories, `foundation/`, label plate, numbered panel |
| `storybook.mjs` | Options, snapshot, key bindings, playback clock, and the redraw timer | Layout, terminal host |
| `showcase-layout.mjs`, `showcase.mjs` | The all-at-once showcase composition and its host | Elements, terminal host |
| `terminal-mouse.mjs` | Bounded SGR report accumulator at the decoded-key seam; no key decoder or timer | None |
| `terminal-host.mjs` | Shared terminal session: size/color options, raw and alternate-screen modes, Node's key decoder, resize and signal listeners, one cleanup path | `foundation/`, terminal mouse, `node:readline`, `node:stream` |

Layout and stories are pure: the same state, size, color mode, and clock reading give the same frame. Only the hosts read the clock, start timers, write to the terminal, or listen for input.

`runTerminal()` takes `render({ columns, rows })`, `onKey(sequence, host)`, an optional `onClick({ column, row }, host)` to opt into cell mouse reporting, and an optional `onStop()`. It owns Ctrl-C (exit 130), SIGINT, SIGTERM, SIGHUP, resize, and drawing errors (exit 1 after cleanup). `host.redraw()`, `host.quit(code)`, and `host.guard(fn)` let a host react to keys and timers without managing terminal modes. Keys arrive as the `sequence` decoded by Node's stateful keypress decoder, not raw chunks. With `onClick`, mouse payloads are consumed before they can reach `onKey()`; only unmodified left presses inside the current viewport reach `onClick()`.

## Adding to the storybook

- **A state or example:** add a variant to the story's list in `storybook-elements.mjs` or `storybook-motions.mjs`, with a `name`, a one-line `note`, and the renderer inputs or motion options. Variant names are short uppercase words. Say a fast or flashing rate in the note.
- **A new element:** after its folder, README, and tests exist (see [architecture](../docs/architecture.md#where-the-next-change-belongs)), add one story with `element(id, fields)` in `storybook-elements.mjs`: a `title`, `summary`, a few contract `rules`, `variants`, and `specimen(variant, width)` returning `{ lines, calls, facts }`. Build `calls` with `call()` from the same values passed to the renderer; an inline piece can use `piece()`, which bounds it with the renderer's own `maxWidth` instead of cutting it. Then list it in `ELEMENT_STORIES`.
- **A new motion:** add it under `motions/` first, then use `motionStory()` in `storybook-motions.mjs` with its function name `fn`, its defaults, `duration(lines, options)` only for a finite motion, `loop(options)` only for a looping one, and `frame(options)`, its step in ms (omit it for a continuously changing motion). A variant's `region(lines)` targets cells found in its rendered body; `shown` gives the usage text a preset as `spread()`. Set `plainVisible` only when the frames change text; a check compares the flag with the frames.
- **A composed example:** when one motion cannot express an extension's sequence, write one story object with `kind: 'motion'` and its own `specimen`, `duration`, `loop`, and `frameMs`, as MARKER TIMELINE does, and check it against the element README's timeline.
- **Foundation data:** the color stories in `storybook-colors.mjs` have `kind: 'foundation'`, so they are indexed under FOUNDATION, their variants are labeled views, and they never play. Their specimens read `foundation/` exports; do not copy color values into examples.
- Specimens must use only real public functions and keep within the supplied width. Label element/motion values as fixtures; retain derivation and source labels for generated foundation values and for colors modeled on an extension. Do not add a parallel renderer, a registry, or a discovery CLI.

Checks: `storybook-layout.test.mjs` (every width 1–160 at short and unbounded heights, visible selection, the scrolling index's counts, real-renderer and motion equality, the new element states without color, navigation, paging, autoplay on every selection route, playback, the replay pause, the motion setting and its footer label, the key list's pause and resume, invalid input), `storybook-colors.test.mjs` (foundation placement, hue grouping of every color, BASE and DERIVED labels, swatch RGB and SGR, ramp columns and stacking, every signal color grouped once with its swatch and key, paging reach, plain fallback, executable usage), `storybook.test.mjs` (lifecycle, section keys, each preview's redraw interval and its restart on a step change, the replay wait without redraws, timer start and cleanup on every path, snapshots that never play, fragmented keys, resize, drawing failures, CLI), and `terminal-host.test.mjs` (the shared session). The regression suite executes every element and motion usage text against its specimen and the documented host sketch, checks each example's `plainVisible` flag against its frames, finite previews completing at their duration helper on the settled view, seeds in seeded calls, the marker timeline against the README, completed-reveal resizing, and complete-message preservation. Mouse checks also cover exact label extents, inert cells, all target classes and keyboard equivalence, fragmentation/coalescing, malformed/overlong input, stale resize geometry, and opt-in mode restoration. These checks use stand-in streams, the installed Node key decoder, and a manual clock. These unit checks do not establish terminal mouse forwarding. Actual Herdr frame, playback, and injected mouse-report checks are recorded separately in [Contributing](../CONTRIBUTING.md#storybook-verification-status), with physical-pointer testing explicitly unverified.
