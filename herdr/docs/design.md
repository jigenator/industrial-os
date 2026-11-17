# Design

Industrial OS in the Herdr desktop app: the [sidebar](#sidebar) mod, the [pane plate](#pane-plate), [Lunalee's column](#lunalee-column), the [Pi Reloader](#pi-reloader) window and the [chrome theme](#theme), in the [shared language](../../docs/design.md).

The window is `sidebar | work | lunalee`: the sidebar on the left, Herdr's tabs, panes, Files/Changes panel and status bar in the middle, and Lunalee's column on the right edge.

Panes are flat: square corners, no border and no focus outline, at the operator's choice. The focused pane is not outlined: its [pane plate](#pane-plate) is lit while the others are dark, and for an agent's pane the sidebar's selected agent row marks it too.

## Lunalee column

One full-height column on the right, 580 px (64 terminal columns at font 14, zoom 1), resizable from its left edge between 420 and 900 px, on the chrome background. It is always in the layout; Industrial OS draws nothing in it. Lunalee's install supplies a 1 px `lunalee` mod block at the top, which draws nothing, and the `lunalee-chat` terminal below it. Without Lunalee, the column is a blank 1 px block over a blank terminal slot. What to do when the block disappears is in the [README](../README.md#lunalee-column).

## Sidebar header

The layout's `brand` block, at the top of the sidebar, is the same mod with `props.brand`, in place of Herdr's logo and name. The sidebar is 300 px, not shipped `main`'s 268, so the plates and both buttons fit beside the macOS window buttons:

```text
 INDUSTRIAL-OS  ⟁ 05              ⌕ ◧
```

| Part | Shows |
| --- | --- |
| Plate | `INDUSTRIAL-OS`, the maker as the design system's crate banner writes it but without `®`, which was too small to read at this size, at 11 px weight 800 in `JetBrainsMono NFM` (the plain `JetBrains Mono` the sidebar asks for drew no bold here; without that font the app falls back), accent foreground on accent, like the design system's label plate. Drawn by the mod: the plate element itself cannot reach a mod folder yet. |
| `⟁ NN` | Droids running, marked with `⟁`, the Industrial OS mark from the crate banner, drawn as `mark.svg` with a heavy stroke because no installed font has the glyph and a fallback glyph cannot be bolded (`DRD` was dropped so the header fits at 300 px): every agent the sidebar shows as working (Pi `WRK`, `SUB` or `RUN`, and other agents Herdr reports working; `QNS` and `BLK` outrank working and do not count) plus every Pi's subagents (units), including a `QNS` or `BLK` Pi's. Capped `99`. A plate in the count-plate style, in the badge's font and weight: `background` on `working` while above zero, `foreground` on `input` (the neutral plate) at zero. **An exception to unknown-is-never-zero, chosen by the operator:** a Pi whose units are unknown (no label, pi-subagents not answering, the moment a Pi starts or reloads) adds only itself if working, so the plate can undercount. |
| Buttons | Search opens the picker; the toggle narrows the sidebar to the rail and back, as Herdr's own header does. |

On the rail the plate, count and search hide; on macOS the window buttons fill the rail, so the toggle hides too, as in Herdr's header. Dragging the header moves the window.

## Sidebar

The `industrial-os` mod fills the main layout's sidebar lists with two sections, spaces then agents, in one scrolling block. It carries the information the herdr-tui agents sidebar and Spaces rows showed, with their rules, but not their geometry: no fixed 36-column fitting, no padding cells, no per-stage keys.

**Visual design is deferred.** This first version is plain text in the layout's monospace font with theme colors, so the information can be judged before a layout and visual treatment are chosen. Nothing here is a design decision beyond what is needed to be readable; the colors below are the herdr-tui roles carried over through `theme()` names.

### Spaces

One row per space, in Herdr's order. Click a row to show that space (`space.select`).

```text
◐ 03PN · industrial-os ↓7
  02AG · 05AU
○ 01PN · harness-engine · 3d
```

| Value | Meaning |
| --- | --- |
| State icon | The space's most urgent pane state in Herdr's order: `×` blocked, `✓` done, `◐` working, `○` idle, `·` unknown. A Pi showing `SUB` or `RUN` counts as working while Herdr reports it idle or done, because Herdr follows only Pi's root agent. Panes without an agent are unknown; a space without panes is unknown. |
| `NNPN` | Panes in the space's tabs (terminals and mod panes), capped `99PN`. |
| `NNAG` | Panes whose program reports an agent status, capped `99AG`. |
| `NNAU` | The sum of its Pi agents' units (subagents), capped `99AU`. No Pi is `00AU`; any Pi without known units (no label, or unknown) makes `??AU`. Other agents add nothing. |
| Name | Herdr's space name; the shown space is in the foreground color. |
| `↑N` / `↓N` | Commits ahead of and behind the upstream, from `git rev-list --left-right --count HEAD...@{upstream}` in the folder of the space's first terminal (else the space's folder), on its machine. Absent at zero, without an upstream, or outside a repository. |
| `Nd` | Quiet: the space is not shown and has had no activity for 48 hours or more. Floor days, capped `99d`. A quiet space drops its second row; ahead/behind stays. |

Activity is: being shown; a change in its pane or agent count (a pane opened or closed, an agent detected); any pane working or blocked, Pi `SUB`/`RUN` included; any Pi reporting units. A space first seen has no history and starts at now, never an inferred old age; a clock step backwards clamps to now. Activity is remembered per mod copy and forgotten 30 days after a space is gone.

### Agents

One block per agent in Herdr's order (space, tab, pane). Click one to focus its pane (`pane.focus`); the list is the order for `agent.next` / `agent.prev` (`setAgentOrder`). The focused agent's row has the selected background.

A Pi agent whose terminal carries a valid `io.signals.v1` label gets a block:

```text
◐ WRK · release ● · 2h33m
  02AU · ━━━━━━━━─── 67% · CMP×18
  ACT · feat/sidebar* · #42
  MDL · opus-5.5/hi
  PNE · Updating sidebar · 12s
```

| Row | Shows |
| --- | --- |
| 1 | State code; the SPACE name (Active's basename while Herdr's is unknown); `●` while the session is flagged with `/flag`; the goal's time in pi-goal's format (`Ns`, `Nm`, `HhMm`), running while the goal is active. |
| 2 | Units `NNAU` (`??AU` unknown, capped `99AU`); context used as an 11-cell bar, lit = ceil(used × 11 / 100), and two-digit percent (`99%` means 99% or more; `─────────── --%` unknown); compactions `CMP×NN` (`CMP×??` unknown, capped). |
| 3 | `ACT`: the branch, with `*` when it has changes, exactly when status-bar's footer shows a branch (Git and GitHub known, HEAD on a branch); otherwise Active's directory as status-bar shows it (`~`, `~/name`, `/top/level`, `parent/current`). Then `#N` for an open PR or `#?` when the lookup is unavailable. |
| 4 | `MDL`: short model (`claude-` dropped, a trailing `-N-N` as `-N.N`), then `/` and the short thinking level (`off`, `mn`, `lo`, `md`, `hi`, `xh`, `mx`; others verbatim). |
| 5 | The first that applies: `ASK` and the pending question's text, with ` (+N)` for further questions; `RDY finished` and the time since the unseen work finished, else since the root agent last settled; `PNE` and the pane name, with the working phase's age while the root agent works. |

The pane name follows the shipped agents list: the tab's name when someone named it, else the terminal's title when it says something (not the program's name, a path or `user@host`); with several agents in one tab, each uses its own title. An automatic tab number is no name, and then row 5 is absent outside `ASK` and `RDY`.

#### States

The first that applies:

| Code | When | Color |
| --- | --- | --- |
| `× QNS` | The snapshot has a pending question | `blocked` |
| `× BLK` | Herdr reports blocked | `blocked` |
| `◐ WRK` | Herdr reports working | `working` |
| `◐ SUB` | Units ≥ 1 | `working` |
| `◐ RUN` | Background tasks ≥ 1 (unknown never selects RUN) | `working` |
| `✓ DNE` | Herdr reports done, or work finished unseen | `done` |
| `○ IDL` / `· UNK` | Herdr reports idle / anything else | `idle` / `unknown` |

**Work finished unseen.** Herdr makes `done` only from Pi's root agent. The block also shows `DNE` when units or background tasks fall from ≥ 1 to 0 between consecutive observations while Herdr does not report working and the agent is not seen. Seen means its tab is the shown tab of the shown space. Unknown counts, including a missing label, never count as zero, so a drop through unknown is no completion. Seeing it, Herdr working, or either count returning to ≥ 1 clears it.

**Access decay.** `ACT` and `MDL` alone fade by time since the agent was last accessed: seen, or showing `WRK`, `SUB` or `RUN` (`QNS` and `BLK` alone do not count; an unknown Herdr status stays fresh). The text never changes, only its color:

| Stage | Age | Labels | Values |
| --- | --- | --- | --- |
| 0 | < 1 h | `dim` | `muted`; a changed branch `ansi3` |
| 1 | ≥ 1 h | `input` | `dim` |
| 2 | ≥ 4 h | `border` | `input` |
| 3 | ≥ 1 d | `border` | `border` |

Both rules keep their state in the mod's `localStorage`, saved when it changes (timestamps alone at most once a minute), so they survive a reload of the mod or the app. Entries for agents gone 30 days are forgotten.

**Other agents.** An agent without a valid label (another program, or a Pi without the publication) is one line: Herdr's status as icon and word, the space and the title.

```text
× blocked · tooling · Fixing tests
```

**Label rules.** The label is the frozen `io.signals.v1` publication: SignalsSnapshot v1 without `usage`, plus `backgroundTasks` and `flag`. It counts only with `version` 1, on a live terminal whose agent status `app` is `pi`; otherwise it is stale and ignored. Each field is validated; a missing or malformed value is unknown, shown as `??`, `--%` or absent, never as zero or clean. Free text is cut to 200 code units, and terminal and bidi controls are removed.

### Colors and readability

Only `theme()` names, so the sidebar follows the theme (with Acid / Black, the herdr-tui roles): state icons and codes in `working`, `blocked`, `done`, `idle` and `unknown`; values in `muted`; labels, separators, ages and zero or unknown counts in `dim`; active units and an ok context bar in `working`, the bar in `ansi3` from 70% and `blocked` from 90%, `dim` for idle and unknown agents; the `/flag` dot and question text in `blocked`. Every state is readable without color: codes, icons, `*`, `●`, `??`, `--%` and `#?` carry it. Long names and titles are cut with an ellipsis by the row's width; a question wraps.

### Timing

Herdr's live data redraws the mod when it changes. A one-second data timer redraws only when a shown time would change: a running goal or age (each second under a minute, then each minute), an access-decay boundary, or a quiet boundary. No animation.

## Pane plate

The approved sticky droid plate (mockup revision 7, `sticky-droid-plate-mockup/gen.mjs`, outside this repository): a 130 px header over every pane, six plate rows of 18.5 px (the terminal's cell height at font 14) and a 19 px strip, drawn cell for cell on the terminal's column grid by the design system's [unit plate](../../design-system/elements/unit-plate/README.md), [status strip](../../design-system/elements/status-strip/README.md) and [keycap bay](../../design-system/elements/action-label/README.md). No divider and no title row. The plate says who is in the pane; the strip says what it is doing. The plate itself never takes a state color.

### Units

| Unit | Picked when | Plate |
| --- | --- | --- |
| Droid | The pane's agent app is `pi`, or Herdr's program table names Pi | `DRD-` and the session ID's last four hex digits; `S/N` the first eight of its last twelve; the barcode seeded from its last eight (`sessionUnit`, shared with the droid header); `⟁ PI AGENT DROID`, `HALDENN DYNAMICS`, the acid peak. No usable `io.signals.v1` label: `DRD-????`, `S/N ????-????`, the barcode seeded from the terminal address |
| Agent | Any other agent: Herdr's table marks the program as one, or it reports an app | `AGT-` and the first word of the app it reports (`claude-code` → `CLAUDE`), else of the program name; plain `AGT` when the wordmark would not fit whole or a letter has no glyph. `DIR` and the folder, a barcode seeded from the terminal address, `EXTERNAL AGENT`; empty title slot, no peak |
| Terminal | Everything else | `TERM-` and the basename of the terminal's argv[0] (`/bin/zsh -l` → `ZSH`, a login shell's `-` dropped), else plain `TERM`. `DIR` and the folder, `BRANCH` and the branch uppercased (`--` without one); empty title slot, no barcode, no peak |

Every title block is 16 columns, W − 18 … W − 3, so blocks and bays line up across panes. W is the header's width over the terminal's cell width, measured in the app, and every cell sits at its column times that width, so the plate lines up with the terminal under it. Below 56 columns the plate has no title block (the design system's threshold). Over 256 columns the plate is composed 256 columns wide and its middle widened to the pane: the cells from two before the title block move to the right edge, and the gap repeats the plain ground before them, so the title block, barcode and bay still end on W − 3 (herdr-app stops a task after 500–700 ms, and a plate costs it about 1 ms a column).

**The peak keeps clear of Herdr's grip.** Herdr's drag grip, a pill 28 × 18 px (measured at 2x: 56 × 36 device px), appears over the pane's top centre when the pointer reaches the top edge, over the plate. The droid's peak therefore starts right of it: its left-most painted cell is the first column at least the pane's centre plus 14 px (half the grip) plus 2 whole cells, and it still ends three cells before the 16-column title block (the design system's `unitPlate` option `peakFrom`; the droid header in a plain terminal keeps its centred peak). Where both cannot hold there is no peak:

| Columns (W) | Peak |
| --- | --- |
| Under 56 | No title block and no peak |
| 56–79 | Title block, no peak |
| 80–83 | 1-cell stroke (80 columns: cells 44–59) |
| 84–87 | 2-cell stroke (84 columns: 46–63) |
| 88 and over | 3-cell stroke (99 columns: 54–73; 198: 103–122) |
| Over about 418 | No peak: right of the grip it would fall in the widened middle |

Each threshold is one column later when the header's leftover fraction of a cell puts the grip's edge past a column boundary (an 80-column header 8.4 px over 80 cells has no peak). The unpinned centred peak appeared from 72 columns.

### Strip

The strip packs its segments from column 2 with a 3-cell gap and at least 3 clear cells before the bay; when a segment would drop, 2 and 2, then 2 and 1, are tried first; then the lowest-priority segment drops and a clipped text ends in `…`.

| State | Strip |
| --- | --- |
| Pi idle | `esc steer`, `ctrl+c clear`, `/ commands`, `! bash`, dropped from the right as the pane narrows |
| Pi working | `■ <PHASE>` (`THINKING`, `WRITING`, `WAITING`, or the tool's name, `BASH`), the tool's target, the phase's elapsed `mm:ss`, `esc steer` |
| Pi needs you | A black-on-critical `▲ NEEDS YOU` chip and the question, cut with `…` |
| Pi done (Herdr's unseen-finished `done`) | `● DONE`, `SETTLED hh:mm` when the label has the settle time, then the hints after `esc` |
| Pi starting | On the terminal plate, `▶ STARTING pi`, for 3 s or until the label arrives |
| Pi, label missing or malformed | Herdr's own status stands: `■ WORKING` and `esc steer` while Herdr says it works, the `▲ NEEDS YOU` chip alone while it is blocked, else idle's hints; never a phase, question or clock the label does not give. Herdr's blocked shows even when the label says idle |
| Agent | `○ READY`, `■ WORKING` and the time since herdr-core's status change (`status_ms`, when the terminal record has it) or since the mod saw it start working, `▲ NEEDS YOU`, `● DONE` |
| Terminal | `○ READY`; `▶ RUNNING <command> hh:mm:ss`, the foreground command's full argv (one `hc get` per program change; the program's name until it answers) and the time since the mod saw it start; `○ READY  PI EXITED hh:mm` after Pi hands back to the shell, until the next command |

Only what the mod can read is shown. Work already under way when the mod first looks (a command running, an agent working, at install or app start) has no clock, since its start is unknown; a Pi already running is not STARTING. There is no exit status (so no PASSED or FAILED), no reason Pi ended, nothing from other agents beyond their Herdr status. Unknown never shows as zero: a missing time is left out, a missing identity is `DRD-????`, `AGT` or `TERM`.

### Lighting and keys

| Level | When | Look |
| --- | --- | --- |
| Lit | The pane has focus and the window is active | Aluminium plate, frosted strip, the bay on `structural` |
| Standby | The pointer is over an unfocused plate | Graphite at the standby level, lit frost, the bay on `decorative50` |
| Dark | Every other pane, and every pane while the window is inactive | Graphite, the strip on `surface`, the bay on `decorative50` |

Status lamps (`■`, `▶`, `●` and the `NEEDS YOU` chip) keep their lit inks on a dark plate; `READY` dims. The values are the design system's `GRAPHITE_GROUND`, `PLATE_LIGHTING` and `BAY_INKS`. The bay is the title block's 16 columns: `[|][-][^][x]` centred, 2 + 3 + 3 + 3 + 3 + 2, its two end cells part of the end keys' click areas; a hovered key is filled white, a pressed one acid. `[^]` becomes `[v]` while the pane is zoomed. There is no move key: Herdr's grip, top-centre on hover, moves panes.

### Pane plate motion

| Motion | When | Rate |
| --- | --- | --- |
| T2 bank switch | Focus moves, or the window activates or deactivates | A layer at the new lighting over the old, its four vertical banks fading in left to right, 30 ms apart, 40 ms each: 130 ms. A second change mid-switch stacks another layer over both, which fades in from whatever they show (at most three layers) |
| H1 standby | The pointer enters or leaves an unfocused plate | The same layer with all four banks at once: 90 ms in, 120 ms out |
| CRT boot | Pi starts in the pane (the plate becomes a droid) | The design system's `crtBoot` over the `DRD-????` plate and strip, seeded from the terminal address, about 1.5 s |
| K5 serial roll | At the boot's end when the session is known, or when the label lands later | The serial's hex digits roll every 40 ms and lock left to right 50 ms apart from 120 ms, the unit's four wordmark digits on the odd steps; the pre-session barcode until the last lock (470 ms) |
| Reveal | Pi or an agent hands back to the shell | The terminal plate wipes in from the left under the outgoing plate, each outgoing row narrowing to the right edge, rows 60 ms apart, 540 ms each: 900 ms |
| Latch | The strip's state changes within one unit | The design system's `latch` on the status cells, 150 ms |
| K4 registration ghost | The focused, idle plate while the window is active | Every 20–60 s (seeded per plate), the wordmark prints once one cell right in acid, then one cell left in the darker acid, 50 ms each |

T2, H1 and the reveal are Herdr-native: the copy draws each new layer once at its start (opacity 0, or the outgoing row at full width) and once at its end 20 ms later, and Herdr's `.transition("opacity" | "width", { duration, delay })` animates between them without the script; the copy wakes once more when it ends, to drop what is covered. The motions that change characters, which no native transition can, draw frames on a timer at their own step, only while one plays: the CRT boot, the latch and K4 every 50 ms, K5 every 40 ms. Otherwise no timer runs but one wake for the next change the plate makes by itself (a clock's second, STARTING's end, the next ghost). A K4 ghost that falls due while another motion plays waits for it to end. A copy that is not shown stops its timers after two redraws that do not happen, and starts what is due when it is shown again. There is no reduced-motion setting: the plate always animates.

### Deviations from the mockup

- **The reveal's front is continuous.** Each outgoing row narrows with a native width transition, so for its 540 ms the front can cut a cell; the design system's `reveal` steps a whole cell at a time.
- **The peak sits right of centre.** The mockup centres it; Herdr's grip covers the centre (see Units).
- **Herdr's status stands in for a missing label.** The mockup always has the label; without one, a working or blocked Pi shows Herdr's WORKING or NEEDS YOU rather than idle.
- **One spacing rule for every strip.** The mockup's hints try 3/3, 2/2 and 2/1 again after each dropped hint, while its other states pick the tightest spacing once and keep it after a drop. The status strip retries for every state, so a strip that dropped a segment returns to the 3-cell gap when it fits: a working, needs-you or running strip that had to drop shows a 3-cell gap where the mockup shows 2 (seen at 72, 60, 52 and 48 columns). Hints match the mockup at every width.
- **No invented times.** Work already under way when the mod first looks has no clock, and a Pi already running is not STARTING; the mockup always shows both.
- **Shapes, not glyphs.** The mockup sets the plate as text. The mod places every cell on the terminal's measured cell grid and draws block elements, light lines and the peak's Powerline triangles as shapes, as Herdr's terminal draws them, so the barcode's bars and the wordmark's pixels fill their cells and the peak needs no Nerd Font; the triangles' edges step one device pixel at a time. `⟁` is the mod's `mark.svg`.

## Pi Reloader

A window over the layout, 620 × 460 px, opened and closed with `mod.open:pi-reloader` (the [keys snippet](../keys/pi-reloader.json) binds `cmd-alt-r`). It stays open while panes and tabs change underneath; only a layout switch closes it. Like the sidebar it is plain text in theme colors; its visual design is deferred.

From top to bottom:

- **Title** `Pi Reloader`, with `↑↓ Enter · Esc` on the right, or `running`.
- **Actions**: `Reload all Pi` and `Reset all Pi`; `>` and the `selected` background mark the selected one. Under them one line says what it does: reload is Pi's own reload and skips drafts; reset quits each Pi and resumes its session in the same shell.
- **Last run**, after a run: `<action>: Success`, `Nothing to do` or `Completed with errors` (in `blocked`); one line of counts, `Reloaded: 1 · Skipped: 2 · Failed: 0` (`Restarted` for a reset); then one line per Pi acted on with its reason, such as `t2n skipped (unsent draft left untouched)` or, in `blocked`, `t2p failed: guard unavailable; …`.
- **Idle or done Pi (n)**: one line per candidate, in Herdr's agent order: address, `idle` or `done`, `guard` or `NO GUARD` (in `blocked`), space / tab, title. Then `Not acted on:` with the busy and protected Pi counts. A test copy adds `Test scope: only …` in `blocked`.

While a run is going the actions give way to one `working` line, `Reset all Pi 1/3`, which counts settled attempts. Focus never moves, so the person can keep working; keys and Esc in the window do nothing until the summary, which returns the keyboard to the window.

**States.** `Success` means at least one Pi completed and nothing failed; `Nothing to do` that nothing completed or failed. Reload is complete only when the new runtime's guard answers; restart only when the resumed Pi on the same session file answers, idle or done. A Pi keeps the idle or done it had: neither action runs a prompt, so Herdr's read state does not change.

**Keys and commands.** `↑`/`k`, `↓`/`j`, `Enter`, `Esc`/`q`; clicking an action runs it. `pi-reloader.reload`, `pi-reloader.reset` and `pi-reloader.close` do the same from keys.json or `herdr-app do`.

## Theme

[themes/acid-black.json](../themes/acid-black.json) is the Herdr desktop app's
theme. It replaces the herdr-tui `theme.toml` fragment and keeps that theme's
roles where the desktop app has an equivalent: a black field, white focus and
buttons with black ink, and acid for work in progress. herdr-tui's
signal-orange chrome has no desktop counterpart and is dropped.
Color names are herdr-app's (`theme()` in `~/.config/herdr-app/herdr.d.ts`);
herdr-app derives any panel color a theme leaves unset, so the file sets every
name the shipped mods use.

| Name | Value | Role | What it colors |
| --- | --- | --- | --- |
| `background` | `#000000` | Field | Terminals and cards |
| `foreground` | `#ffffff` | Primary | Terminal text |
| `ansi` 0–15, `cursor`, `selection` | Terminal Basic Dark | `HERDR_TERMINAL` | Program colors, the terminal cursor and selection, as Ghostty showed them under herdr-tui |
| `canvas`, `chrome` | `#000000` | Field | Behind cards; sidebars and bars |
| `surface`, `popover`, `raised`, `selected` | `#1c1c1c` | Surface | Panels, menus, raised and selected rows (herdr-tui's `active_row_bg`) |
| `hover`, `border` | `#333333` | Ghost (signal color) | Hovered rows, borders and dividers |
| `input` | `#555555` | Structural | Input borders, a stronger border |
| `foreground` (panels), `muted`, `dim` | `#ffffff`, `#cfcfcf`, `#717171` | Primary, secondary, decorative | Panel text by emphasis |
| `accent`, `solid` | `#ffffff` | Primary | Focus, the primary button |
| `accent_foreground`, `solid_foreground` | `#000000` | Field | Ink on those controls |
| `working` | `#c0fe04` | Accent | Agents at work |
| `blocked` | `#f24723` | Critical | Agents that need the person |
| `done` | `#ffffff` | Primary | Finished while unseen |
| `idle`, `unknown` | `#717171` | Decorative | Quiet agents and unreported status |

These are the same state colors herdr-tui's agents sidebar used.

### Theme trade-offs

- `selected` and `raised` are both the surface, so hovering a selected row
  changes nothing; `hover` is the brighter ghost.
- Terminal selection keeps Terminal Basic Dark's blue rather than an Acid /
  Black role, so programs look as they did; panels use the same `selection`.
- `dim` `#717171` is 4.3:1 on black and 3.5:1 on the surface: it is for quiet
  secondary text, not for anything the person must read to act.

### Theme contrast

WCAG contrast ratios computed from the hex values, not measured on a display:

| Pair | Ratio |
| --- | --- |
| `dim` `#717171` on black / on `#1c1c1c` | 4.3:1 / 3.5:1 |
| White text on `selection` `#3f638a` | 6.2:1 |
| `blocked` `#f24723` on black | 5.7:1 |
| Black ink on acid `#c0fe04` | 17.4:1 |
| `border` `#333333` on black | 1.7:1, decorative only: edges and dividers |
