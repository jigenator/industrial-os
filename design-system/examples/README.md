# Examples: storybook and showcase

Two terminal hosts compose the real elements and motions; the storybook also shows the IndustrialOS color data. Neither is a released API or a framework.

| Entry point | What it is |
| --- | --- |
| `node examples/storybook.mjs` | Terminal storybook: browse each element by state, each motion by example, and the IndustrialOS colors by view, with usage and contract notes |
| `node examples/showcase.mjs` | All four elements composed on one scrolling screen |

Commands, options, and exit codes are in [Contributing](../CONTRIBUTING.md#running-the-hosts). Commands run from `design-system/`, and the paths the storybook displays, such as `elements/gauge/README.md` and `foundation/industrialos-colors.mjs`, are relative to it.

## Browsing the storybook

The index lists the four elements under COMPONENTS, the three motions under MOTIONS, then story 8, COLORS, under FOUNDATION. The selected story is marked `>` and also named in the panel header, so the selection never depends on color. Each story shows its states, examples, or views (the selected one in `[brackets]`), a specimen, the call that drew it, and the main contract rules, with a link to the owning README.

| Keys | Action |
| --- | --- |
| `j`/`k`, Down/Up, Tab/Shift-Tab | Next or previous story |
| `1`–`8` | Jump to a story |
| `l`/`h`, Right/Left | Next or previous state, example, or view |
| Space/PgDn, `b`/PgUp | Page the details |
| `p`, `r`, `o` | Play or pause, replay, or turn off a motion preview |
| `?` | Show or hide every key; Esc also hides it |
| `q`, Esc | Quit; Ctrl-C quits from anywhere |

The footer always shows the hints that fit, and the visible line range when details overflow. Below 72 columns or 15 rows the index gives way to the panel header. When the panel cannot fit, one line names the story number and selected state. Nothing assumes a larger terminal than the one supplied.

### Left clicks

The live storybook opts into normal mouse tracking (DECSET 1000) with SGR cell reports (1006).
A cooperating terminal must forward `ESC [ < button ; column ; row M` / `m` with 1-based cell
coordinates; xterm's [mouse protocol](https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Mouse-Tracking)
is the reference, not a compatibility claim for every terminal or Herdr.

Unmodified left-button **presses** activate complete visible story index labels, variant names,
and footer controls: previous/next story or variant, play/pause, replay, motion off, page down/back,
keys/close, and quit. Releases do not activate again. Right/middle buttons, modified clicks, wheel,
and motion reports are consumed without actions. There is no hover, drag, wheel navigation, or
configurable gesture layer. Usage code, specimens, help prose, line ranges, padding, and gaps are inert.
Disabled page controls (already at that edge) and unavailable no-color playback do nothing.

Targets come from the same composition as the drawn labels, and are replaced on each repaint,
including help, paging, and resize. No clipped label is treated as a complete control. Narrow layouts
show shorter, separate key labels; short layouts may omit the index or tabs, and tiny sizes may offer
no click targets. **Every keyboard control above remains available**; use `?` for the key list.
Selecting a different story or variant uses the same reset and timer cleanup as keyboard navigation.

Only this live storybook enables 1000/1006. The showcase and snapshots do not change mouse modes.
The session disables both modes on keyboard or click quit, Esc, Ctrl-C, SIGINT/SIGTERM/SIGHUP,
process exit, and guarded failures, alongside restoring cursor, screen, and cooked input. No motion
tracking (1002/1003) or pixel-coordinate mode (1016) is enabled.

Node v22.23.0's key decoder emits the SGR prefix followed by separate characters. An example-local
accumulator consumes the packet, retaining at most 32 payload characters; invalid/overlong payloads
are discarded through their CSI final byte. It adds no timer. An unfinished report can consume ordinary
keys until that final byte; a new decoded escape sequence, standalone Esc, or Ctrl-C recovers immediately
(after Node's usual standalone-Esc delay). Non-SGR legacy reports are discarded, not clickable.

Motion previews are labeled `DEMO` and framed as `DEMONSTRATION`. They start with motion off: the stable, final view. While a preview plays, the host runs one interval timer at 67 ms (at most 15 frames a second). It stops the timer on pause, on completion of a reveal, on any story or example change, when the key list opens, and on every exit path. Without color, scan, pulse, and the dim reveal look identical to motion off, so they do not play; the blank reveal still can.

All element and motion values are labeled fixtures. The storybook reads nothing from the machine or any service.

### Colors

Story 8 shows the IndustrialOS colors from [foundation](../foundation/README.md#industrialos-colors). It is a reference page, not a theme: the storybook itself stays Acid / Black, and the title notice reads `REFERENCE VALUES, NOT A THEME OR LIVE DATA` instead of the fixture notice. Its two views are:

- **PALETTE**: all 22 colors grouped by hue (lime, red/orange, magenta, violet/indigo, blue, mint, yellow, neutral). Each row has a swatch, the hex value, and the name, with the color's role on a wrapped line under it. A closing line gives the color and hue-group counts.
- **SHADES**: the five-step `shadeRamp()` of each color, as columns from 53 cells and one step per line below that. Only the `BASE` step is the listed color; the four other steps are marked `DERIVED`.

Swatches are full blocks with matching foreground and background. Hex values, names, and labels sit on the normal black field, so they stay readable whatever the swatch color, and every label reads the same in plain output, which adds a note that swatches show position only. Narrow widths stack the details and wrap long words instead of clipping them; every color and ramp step is reachable by paging. Color views have no playback: `p`, `r`, and `o` do nothing, and no timer runs. No contrast or accessibility rating is claimed for any color.

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

- Renderers take values and an exact cell budget and return lines of `{ text, style }` spans. Inputs, states, invalid-input errors, and narrow behavior are owned by each element README: [numbered panel](../elements/numbered-panel/README.md), [label plate](../elements/label-plate/README.md), [gauge](../elements/gauge/README.md), and [status row](../elements/status-row/README.md).
- Motions decorate rendered lines at an explicit time. Parameters, defaults, motion-off, and the host timer sketch are in [motions](../motions/README.md).
- Painting, color depth, and the text and glyph contract are in [foundation](../foundation/README.md).
- In the storybook, the usage text under each specimen is generated from the arguments that drew it. These are call fragments at that width; imports, variable declarations, and the explicit `time` value belong to your host.

## Module map

| File | Owns | Imports |
| --- | --- | --- |
| `storybook-stories.mjs` | Story catalog: titles, notes, variants, and specimens from the real renderers and motions | `foundation/`, elements, motions, color story |
| `storybook-colors.mjs` | The COLORS story: hue groups, palette rows, and shade-ramp views of the IndustrialOS colors | `foundation/` |
| `storybook-layout.mjs` | Browsing state, `press()` actions, `advance()` for finite previews, and `composeStorybook()` frames | Stories, `foundation/`, label plate, numbered panel |
| `storybook.mjs` | Options, snapshot, key bindings, playback clock, and the redraw timer | Layout, terminal host |
| `showcase-layout.mjs`, `showcase.mjs` | The all-at-once showcase composition and its host | Elements, terminal host |
| `terminal-mouse.mjs` | Bounded SGR report accumulator at the decoded-key seam; no key decoder or timer | None |
| `terminal-host.mjs` | Shared terminal session: size/color options, raw and alternate-screen modes, Node's key decoder, resize and signal listeners, one cleanup path | `foundation/`, terminal mouse, `node:readline`, `node:stream` |

Layout and stories are pure: the same state, size, color mode, and clock reading give the same frame. Only the hosts read the clock, start timers, write to the terminal, or listen for input.

`runTerminal()` takes `render({ columns, rows })`, `onKey(sequence, host)`, an optional `onClick({ column, row }, host)` to opt into cell mouse reporting, and an optional `onStop()`. It owns Ctrl-C (exit 130), SIGINT, SIGTERM, SIGHUP, resize, and drawing errors (exit 1 after cleanup). `host.redraw()`, `host.quit(code)`, and `host.guard(fn)` let a host react to keys and timers without managing terminal modes. Keys arrive as the `sequence` decoded by Node's stateful keypress decoder, not raw chunks. With `onClick`, mouse payloads are consumed before they can reach `onKey()`; only unmodified left presses inside the current viewport reach `onClick()`.

## Adding to the storybook

- **A state or example:** add a variant to the story's list in `storybook-stories.mjs`, with a `name`, a one-line `note`, and the renderer inputs or motion options. Variant names are short uppercase words.
- **A new element:** after its folder, README, and tests exist (see [architecture](../docs/architecture.md#where-the-next-change-belongs)), add one story with `kind: 'component'`, its `module`, `contract`, a few contract `rules`, `variants`, and `specimen(variant, width)` returning `{ lines, calls, facts }`. Build `calls` with `call()` from the same values passed to the renderer.
- **A new motion:** add it under `motions/` first, then use `motionStory()`. Pass `duration` only for a finite motion, and set `plainVisible` on a variant only when its frames change text.
- **Foundation data:** the COLORS story in `storybook-colors.mjs` has `kind: 'foundation'`, so it is indexed under FOUNDATION, its variants are labeled views, and it never plays. Its specimen reads `foundation/` exports; do not copy color values into examples.
- Specimens must use only real public functions and keep within the supplied width. Label element/motion values as fixtures; retain derivation labels for generated foundation values. Do not add a parallel renderer, a registry, or a discovery CLI.

Checks: `storybook-layout.test.mjs` (every width 1–160 at short and unbounded heights, visible selection, real-renderer and motion equality, navigation, paging, playback, invalid input), `storybook-colors.test.mjs` (story 8 placement, hue grouping of every color, BASE and DERIVED labels, swatch RGB and SGR, ramp columns and stacking, paging reach for every color and step, plain fallback, executable usage), `storybook.test.mjs` (lifecycle, timer start and cleanup on every path, fragmented keys, resize, drawing failures, CLI), and `terminal-host.test.mjs` (the shared session). The regression suite also executes motion usage text and the documented host sketch, and checks completed-reveal resizing and complete-message preservation. Mouse checks also cover exact label extents, inert cells, all target classes and keyboard equivalence, fragmentation/coalescing, malformed/overlong input, stale resize geometry, and opt-in mode restoration. These checks use stand-in streams, the installed Node key decoder, and a manual clock. These unit checks do not establish terminal mouse forwarding. Actual Herdr frame, playback, and injected mouse-report checks are recorded separately in [Contributing](../CONTRIBUTING.md#storybook-verification-status), with physical-pointer testing explicitly unverified.
