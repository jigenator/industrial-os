# Design

Industrial OS in the Herdr desktop app: the [sidebar](#sidebar) mod, [Lunalee's column](#lunalee-column), the [Pi Reloader](#pi-reloader) window and the [chrome theme](#theme), in the [shared language](../../docs/design.md).

The window is `sidebar | work | lunalee`: the sidebar on the left, Herdr's tabs, panes, Files/Changes panel and status bar in the middle, and Lunalee's column on the right edge.

Panes are flat: square corners, no border and no focus outline, at the operator's choice. The focused pane is not outlined; for an agent's pane, the sidebar's selected agent row marks it.

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
