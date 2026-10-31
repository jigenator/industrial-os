# Design-system design

The design system's own experience, within the repository-wide [design](../../docs/design.md), which owns the shared palette, motion rules, accessibility rules, UI states, and acceptance criteria. This doc adds what is specific to the design system: its element set, its reference and signal colors, its motions, and its storybook.

## Experience

The design system is a curated reference kit of polished terminal elements for Herdr, with a storybook to browse them and a showcase that composes them. It is a reference for the Pi extensions and the planned Herdr tooling, and a private package the repository's projects can import by name; both Pi extensions now consume exported subpaths through host adapters. Lunalee is the sole authorised outside consumer via pinned public root-package paths; see the [decision](../../docs/decisions/in-repo-design-system-package.md#lunalee-pinned-public-git-consumption).

## Elements

The first set is numbered panels, label plates, gauges, and status rows: [numbered panel](../elements/numbered-panel/README.md), [label plate](../elements/label-plate/README.md), [gauge](../elements/gauge/README.md), and [status row](../elements/status-row/README.md). `examples/showcase.mjs` composes them for refinement, and they have a bounded [native Herdr verification baseline](../CONTRIBUTING.md#native-verification-baseline).

The second set is modeled on the Pi extensions' own UI, so the extensions' look can be reused and refined here: the [instrument frame](../elements/instrument-frame/README.md) (status-bar's framed footer), [count plate](../elements/count-plate/README.md) (CMP and AU), [mode plate](../elements/mode-plate/README.md) (PNYTL), [state chip](../elements/state-chip/README.md) (Tatsu entries), [lamp](../elements/lamp/README.md) and [thread rail](../elements/thread-rail/README.md) (Thread Rail), [pixel numeral](../elements/pixel-numeral/README.md) (the context numeral), [segment meter](../elements/segment-meter/README.md) (USG quota), and claude-interrupt's [transcript marker](../elements/transcript-marker/README.md). The label plate gained status-bar's slab form and a bright tone, and the gauge opt-in context zones and a tick-free scale. Each README lists its differences from the extension. These elements have automated checks only; none has been checked natively in Herdr.

Modeled on herdr-sidebar's layout B: the [line meter](../elements/line-meter/README.md) (compact context-used bar) and [column block](../elements/column-block/README.md) (gutter, value, marks and right slot). Their contracts and differences from herdr-sidebar live in those READMEs. Automated checks only; native Herdr checks not run.

Modeled on the automations monitor's board: the [section head](../elements/section-head/README.md), [board marks](../elements/board-marks/README.md) (run outcomes, schedule marks, state cells, pointer and spine), the [time lane](../elements/time-lane/README.md) (axis, track, runs and NOW), [readouts](../elements/readout/README.md) (a tall-numeral block, its one-line form, slot strips, split bars and phase steps), the [event row](../elements/event-row/README.md) and the [scroll rail](../elements/scroll-rail/README.md). The pixel numeral gained the monitor's tall face, the tab rule board inks and a vertical rule, the popup header the board popup's frame, title bar and backdrop, and the operation row a right-aligned detail. The [board tones](../foundation/README.md#board-inks-and-tones) give each state its ink, cell and chip colors; history stays grey and category fills mark only live work. The monitor draws with these parts, and its frames were byte-identical before and after it moved onto them. Automated checks only; native Herdr checks of the storybook stories were not run.

The [crate banner](../elements/crate-banner/README.md) is Lunalee's chat pane header: a brushed-aluminium maker's plate (a per-cell cool-silver ground with a bright middle band and horizontal brushing, color only) with hairline rules that follow it, the division directly under the maker, one slanted acid stroke kept clear of the text, and a strip of tools, solid black or frosted (white at 10%) over the host's background when the host supplies it, whose ready, open and disabled states each have a lamp shape, with hover as a separate host flag. A one-row compact form sheds its parts by priority (maker, tools, HOLD, clock, then ®). Labels on the plate keep at least 4.5:1 at every width, and the frosted strip lifts its lamp and divider inks to keep 3:1 over a dark pane like Lunalee's. Its 60- and 40-column plates, in both strip modes, are checked cell for cell against the approved browser mockup; the native Herdr evidence is a bounded storybook check with injected input (see [Contributing](../CONTRIBUTING.md#crate-banner-aluminium-verification-2026-10-31)), with no physical glyph, font or contrast review.

Final visual acceptance of every element remains a maintainer decision.

## IndustrialOS colors

A separate reference collection of 22 named colors, with five-step derived shade ramps. Values live in [foundation](../foundation/README.md#industrialos-colors). It does not replace Acid / Black, add roles to it, or form a theme switch. Wherever a generated ramp step is shown, label it `DERIVED`, distinct from its `BASE` color. Put hex values and names on the normal field rather than on the swatch, and do not claim contrast or accessibility for any combination without checking it.

## Signal colors

The product colors status-bar uses beside the Acid / Black roles (count tiers, mode inks, zone tracks, the lost-segment grey, the check fade, warm-up steps, and provider inks) live in [foundation](../foundation/README.md#signal-colors), which is their source; status-bar now imports them through exported subpaths, under the same [color decision](../../docs/decisions/in-repo-design-system-package.md) as the roles. They are literal values, not roles, so they never mark a warning or critical cell: elements use role names for state colors. Wherever they are shown, say they are status-bar's product colors, not roles, and keep them apart from Acid / Black and the IndustrialOS collection.

Signal colors now also serve Herdr chrome: the [Herdr theme](../../herdr/theme.toml) restates roles, `SIGNAL_COLORS.ghost`, and the two [Herdr chrome colors](../foundation/README.md#herdr-chrome-colors) in `HERDR_CHROME`, the Marathon signal orange `#ff5c00` and its 30% mix over the field `#4d1c00`. They are a separate object because status-bar does not use them; the SIGNAL COLORS story does not show them.

The [Pi theme](../../pi/theme/industrial-os.json) likewise restates roles and signal colors, plus one [Pi chrome color](../foundation/README.md#pi-chrome-colors) in `PI_CHROME`: `bone` `#e2dccb`, the warm off-white of Pi's editor border. `PI_CHROME.lamp` `#ff5c00` is the Pi droid header's signal lamp, the Marathon signal orange in its own role. The SIGNAL COLORS story shows neither.

Usage sources select the [usage families](../foundation/README.md#usage-color-families) by exact token, independently of provider id or tag. Existing GPT/CLD/KMI lit, used and mid inks are unchanged; absent/unknown tokens use secondary-grey lit with its derived 20%/50% mixes. No additional provider brand mapping is implied.

## Motions

Thirty [motions](../motions/README.md) decorate already-rendered lines at an explicit time, under the shared [motion rules](../../docs/design.md#motion): scan, pulse, and reveal; the state and attention motions modeled on the extensions (draw-in, warm-up, latch, beacon, cycle, fade, blink, flash); and the signal, meter, and glitch motions (ping, wipe, fill-in, burn-out, edge pulse, restrike, ghost, nudge), plus dashboard decode, breathe, arrival-ping, ambient-sweep and ambient-load. `animate: false` is every motion's motion-off state. Warning and critical cells are exempt unless a motion opts in for a state cue (warm-up, latch, beacon, flash), and then every frame keeps the state's shape and word. This exemption protects cells, not an entire message. Motions that can hide or replace characters (reveal, draw-in, ghost, and the glyph motions) belong only on nonessential decoration; compose complete readings, labels, and status messages outside them.

### Fast and flashing motions

The shared motion rule has no frequency cap, and asks each project to state its fast or flashing rates. These are the design system's; no photosensitivity or WCAG flash compliance is claimed for any of them.

| Motion and use | Rate |
| --- | --- |
| blink, `activityLight` preset | Toggles every 50 ms on one cell: 10 lit onsets a second |
| flash, `threshold` preset | Three 50 ms white flashes, one every 100 ms: 10 a second for 300 ms |
| flash, `interrupt` preset, and the transcript marker's timeline | Two whole-plate changes in 160 ms |
| flash, `tag` and `polarity` presets | Two 100 ms inversions in 350 ms; one 100 ms swap |
| ping | Bars change on a 40 ms grid, 25 steps a second, for 1520 ms |
| latch | Locked 50 ms, inverted 100 ms, once |
| draw-in, fill-in, edge pulse, restrike, ghost, nudge, beacon | 50 ms steps (20 a second) during each event |

Rates for every motion, including the slow ones, are in each motion's section.

## Storybook

`examples/storybook.mjs` is the browsing surface for the system: an index of every element, every motion and one composed motion example, and the foundation colors; state, example, or view selection; a specimen from the real renderer, motion, or foundation data; its generated call; and key contract rules. Its keys and layout rules are in [examples](../examples/README.md). Motion previews are labeled demonstration playback. While the storybook-wide motion setting is on, which it is at start, selecting a motion preview plays it automatically, redrawn at the motion's own step, with the interval shown on screen ([playback rate](../examples/README.md#playback-rate)). A one-shot preview holds its last frame and replays 1.5 s after it completes; a looping preview plays until paused. `o` turns motion off for the whole storybook, settling every preview with no timer, and turns it on again. Snapshots never play. The color stories are static and never play. The storybook's keyboard path and optional left-click controls are defined by its host and [examples](../examples/README.md#left-clicks); the elements themselves are not interactive.

## Verification and open questions

Current status: every element has a native renderer with automated layout and contract checks, and every motion has deterministic frame checks. The showcase and storybook pass automated checks of their live-view lifecycle, using stand-in terminal streams and, for storybook playback, a manual clock. The showcase is static; the storybook's motion previews autoplay while its motion setting is on and run one bounded timer only while a preview plays or a finished one-shot waits to replay. Automated mouse checks are not proof of native Herdr mouse forwarding. This first pass requires 24-bit color, or falls back to plain text, and requires one-cell rendering of the curated glyphs; see [foundation](../foundation/README.md).

The native Herdr checks of the showcase, the storybook, and an earlier version of the COLORS story are recorded in [Contributing](../CONTRIBUTING.md#native-verification-baseline) with their exact scope. They predate the second element set, the sixteen new motions, the SIGNAL COLORS story, and the storybook's current index and playback, which have automated checks only. No accessibility certification, physical-pixel contrast assessment, or performance measurement is claimed.

Open decisions: visual refinements to every element and motion. Shared open decisions are in the [repository-wide design](../../docs/design.md#verification-and-open-questions).

## Survey surface and reuse extensions

The [foundation surface](../foundation/README.md#surface) supplies the current charcoal gradient, stable hashed minor/major dots and per-cell fill blending. It owns color values and compositing, not Lunalee's alpha configuration or ANSI/copy/image adapter. Plain/NO_COLOR has no floor or generated colors. The SURFACE story uses synthetic cells for clear, locked translucent, solid and NO_COLOR views. Round and square lamps require explicit style and adjacent state words; word chips put optional markers after supplied words. Existing defaults remain unchanged. Measured text is opt-in; no native Unicode or surface acceptance is inferred from unit checks.

## Survey chrome

The tab-rule, action-label, popup-header, notice-row, scope-meter, sounding-meter, feed-bezel and input-frame families own Lunalee chrome, not host layout/state/I/O. Popup headers have no ruler or leader; operations dividers are tab plus hairline. INPUT has no body background. The scope carrier is option A only, never numeric strength. Feed/image rectangles remain empty and immutable.

Scope carrier steps at 80 ms; reacquire and sounding/feed/corner poses use 40 ms. Downward beacon uses eight 80-ms steps. Draw-in's style mode uses six 40-ms steps; no characters hide. White latch retains the 50/150-ms boundaries. Corner snap is a persistent state pose: home off, spread after 40 ms while the host holds hover/focus. Detailed contracts and rates are in the motions guide. No photosensitivity certification is claimed.

## Survey content

Callouts mirror two survey corners and reuse timestamp leaders; continuations omit only the name. Document blocks own open spec tables (heavy header rule, no cage), rich text, visible URLs and surface code bands, never Markdown parsing. Sheet cards share supplied word states across headings, STACK and ^P; read removes the tint and brackets open. Desk pieces share the 1/3/5 column grid and W−2 right edge; the waiting notch is steady, critical plates solid, errors/confirmation words immediate. Operation rows reserve truthful duration columns and carry plain ▒/█/✕/·/▲ state shapes.

Callout entrance uses plot-in 900 ms (uneven 0/80/200/700/800/900 phases) or register 700 ms (0/80/160/600/700), displayed on a 40-ms host grid. No text moves. Phosphor-head colors only a host-supplied already-revealed grapheme; it does not implement reveal rate. Motion off settles both; plain keeps entrance glyphs without fade and has no phosphor head. No new timers, host controls, state/retention policy or Lunalee runtime adoption is included. Contracts live in each element README and the motions guide.
## Dashboard elements

Type units, plan counters, activity strips, braille traces, calm alert tickers and ambient fields use the existing line model. Their contracts live beside each element; all have storybook fixtures. Type colors are source identities, never urgency. Decode is the bounded, explicitly declared exception in the [shared motion rule](../../docs/design.md#motion); warning/critical cells remain exempt.
