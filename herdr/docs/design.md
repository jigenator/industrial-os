# Design

The agents sidebar in Herdr, as this configuration draws it: layout "B", one block of up to seven rows per Pi pane, in the [shared language](../../docs/design.md). The extension's side, what each value means and when it is unknown, is in [herdr-sidebar's design](../../pi/herdr-sidebar/docs/design.md); the exact token values are in [the token contract](../../pi/herdr-sidebar/docs/token-contract.md). The [Spaces](#spaces) rows and the [chrome theme](#theme) follow.

## Layout B

```text
 ◐ WRK  · release        ·  2h33m
   02AU · ━━━━━━━━─── 67% · CMP×18
   ACT  · feat/sidebar*   ·    #42
   MDL  · opus-5.5/hi
   SH   · npm test        ·    12s
```

| Row | Gutter | Left value | Right slot |
| --- | --- | --- | --- |
| 1 | `g1` state | `proj` / `proj_idle` | `gt` / `gt_off` |
| 2 | `g2_au` / `g2_au0` | `bar` / `bar_warn` / `bar_crit` / `bar_idle` / `bar_unk` | `cmpx` |
| 3 | `g3` | `br` / `br_dirty` / `dir` | `prn` / `prn_off` |
| 4 | `g4` | `mthink` | |
| 5 | `g5` | `ev_act` / `ask_l1` / `ev_rdy_text` | `ph_age` |
| 6 | | `ask_l2` | |
| 7 | | `ask_l3` | |

Herdr draws ` · ` between present values and drops a row whose tokens are all absent, so most blocks are four or five rows; a pending question can take seven. The rows override only `[ui.sidebar.agents.rows_by_agent] pi`; global `rows` is not set, so other agents retain their own/default layouts. `row_gap = 1` is panel-wide and leaves one blank row between all agents, including non-Pi agents. IDL and UNK use a decorative-grey, non-bold `bar_idle` with unchanged shape/used percentage, regardless of zone. Unknown context always uses `bar_unk`. Row 1 names the Herdr SPACE (Active basename while unknown); row 2 shows context used, warning from 70% and critical from 90%, not remaining context.

## Width

The sidebar is locked at 36 columns (`sidebar_width`, `sidebar_min_width` and `sidebar_max_width`), because every token is cut and padded to fixed cells. The live check on 2026-10-08 found that when the agent list is longer than the sidebar, Herdr draws a scrollbar in the rightmost column, leaving 34. The contract's 24-cell text area is sized for that narrower case: with indent and gutter, row 1 and rows 2+ end at column 34, and the right slot stays aligned whether or not the scrollbar shows.

## Colors

Every color is a design-system value. Bold marks the readings that matter most.

| Role | Value | Used for |
| --- | --- | --- |
| Decorative | `#717171` | Gutters (`ACT`, `MDL`, phase codes), `IDL` and `UNK` states, `00AU`/`??AU`, IDL/UNK context bars, ages |
| Primary | `#ffffff` | The working SPACE name (bold), `DNE`, `finished` |
| Secondary | `#cfcfcf` | The idle SPACE name (bold), goal time, branch, directory, PR, model, phase target |
| Ghost (signal color) | `#333333` | A paused goal's time, `#?`, the unknown context bar |
| Accent | `#c0fe04` | `WRK`, `SUB`, the context bar, active units ≥ 1 (bold) |
| Warning | `#d79e52` | The context bar from 70% used, a branch with changes |
| Critical | `#f24723` | `QNS`, `BLK`, the context bar from 90% used (bold), the question text (bold) |
| Structural, violet, pink, critical | `#555555`, `#5200ff`, `#ff15bd`, `#f24723` | `CMP×00` and `CMP×??`; `01`–`02`; `03`–`04`; `05` and more; all bold |

The theme block sets the sidebar field black (`sidebar_bg`) and the focused and selected rows to the surface grey (`active_row_bg`, `selection_bg`).

## Access decay

ACT and MDL alone fade by time since last access, as
[the contract](../../pi/herdr-sidebar/docs/token-contract.md#act--mdl-access-decay)
defines. Visible panes and WRK/SUB refresh access; unknown stays d0.
`/reload` or Pi restart resets the memory-only timestamp.

| Stage | Age | Labels `g3`/`g4` | Values `br`/`dir`/`prn`/`mthink` | `br_dirty` | `prn_off` |
| --- | --- | --- | --- | --- | --- |
| d0 | < 1h | decorative `#717171` | secondary `#cfcfcf` | warning `#d79e52` | ghost `#333333` |
| d1 | ≥ 1h | structural `#555555` | decorative `#717171` | decorative `#717171` | ghost |
| d2 | ≥ 4h | ghost `#333333` | structural `#555555` | structural `#555555` | ghost |
| d3 | ≥ 1d | ghost `#333333` | ghost `#333333` | ghost `#333333` | ghost |

At d0 the unchanged base keys retain today's rendering. Later stages use
`_d1`/`_d2`/`_d3`; absent variants disappear with their separators.
Text, padding, width and the dirty star do not change. Everything on these
rows fades, including dirty-branch amber; Herdr's ` · ` stays theme overlay0.
The state/title/SPACE/goal, AU/context/CMP and phase/question/finished rows
never decay. Faint ACT/MDL values are historical detail, not a new state code.

Herdr 0.9.3 permits at most 16 configured entries per row, so the ACT logical
row has two mutually exclusive physical rows: d0+d1 and d2+d3 (12 entries
each). MDL has eight entries in one physical row. The Pi override has eight
configured rows but still at most seven rendered rows: Herdr drops empty rows
before rendering. There is no extra blank row or gap for the inactive ACT
alternative. Source: `src/ui/sidebar/tokens.rs::agent_rows` filters empties;
`src/client/shell/agent_sidebar.rs` applies `row_gap` between pane blocks,
not between configured token rows. Native parser checks and modeled row
resolution tests are recorded separately from live rendering evidence.

## States

Every state is readable without color: the state code and shape in row 1 (`× QNS`, `× BLK`, `◐ WRK`, `◐ SUB`, `✓ DNE`, `○ IDL`, `· UNK`; `SUB` shares `WRK`'s shape and accent, and its code tells it apart), `*` on a changed branch, `--%`, `??` and `#?` for unknowns. Color adds emphasis only. The meanings are in [herdr-sidebar's design](../../pi/herdr-sidebar/docs/design.md#states).

## Accessibility and limits

- Ghost grey on black is deliberately faint, for paused, unavailable or decayed ACT/MDL values; it is not used for anything that needs reading at a glance.
- Pi panes without herdr-sidebar show no Industrial OS rows; other agents retain their configured/default layouts.
- The collapsed and mobile sidebars keep Herdr's compact layouts.
- Checked: Herdr's parser accepts the file. Not checked: this file in a running Herdr, other color depths, or ambiguous-width glyph settings.

## Spaces

[spaces.toml](../spaces.toml) renders the
[plugin tokens](../../herdr-plugins/spaces/docs/token-contract.md):

```text
 ◐ 05PN · industrial-os
   03AG · 07AU ↓7
 × 01PN · tooling
   01AG · 02AU ↑2
 ○ 01PN · harness-engine… ·   2d
 ○ 02PN · general-purpose ·   3d
```

The same 36-column lock applies; space rows are sized for the 31 cells Herdr
gives them when a scrollbar shows. Row 1 uses Herdr's
state icon, pane-count gutter and name. Focused name is primary white/bold,
current names secondary/bold, quiet names and ages decorative grey. Row 2 uses
agent-count gutter, bold accent AU and built-in git_status (no branch name).
Zero counts become decorative, zero AU also loses bold. Unknown AU remains
`??AU`, never zero. Quiet names fit 15 cells with U+2800 padding; ages align
right in four cells. No motion or new keyboard/mouse behavior.

Quiet spaces (48 h or more, not focused) send only `$sp_panes`, `$sp_name_stale`
and `$sp_quiet`, so their second row drops **unless they are ahead or behind**.
Then Herdr's built-in git_status retains a second row with only those counts;
indented worktree children suppress git details. Quiet worktree families move
as units, oldest last, and re-sink when a space is created or closed. Other
units keep user order; otherwise unchanged quiet membership/order does not undo
a manual drag. Number keys follow position.
If the reporter stops, TTL counts/ages expire; names have no TTL and freeze.
Checked in an isolated Herdr 0.9.3 server rendered by xterm.js: rows, colors,
quiet collapse and age alignment with and without the scrollbar, and ordering.
Not checked: the user's own terminal, other fonts or ambiguous-width settings.

### Spaces theme scope

`state_icon` has no per-state style; `[theme.custom]` maps yellow to accent
working, red to critical blocked, teal to primary done, green to decorative
idle and overlay0 to decorative unknown/separators/header. These are **global**
theme keys, not Spaces-only colors. Source grep against Herdr 0.9.3
`palette.yellow/red/teal/green/overlay0` found these concrete wider effects:

- `client/shell.rs`: agent and workspace state icons across shell panels.
- `client/shell/endpoints.rs`: connecting/reconnecting yellow, online green,
  attention red and disabled overlay0 endpoint indicators.
- `client/shell/settings_overlay.rs`: installed green, update-available yellow
  and not-found overlay0 integration status markers.
- `client/shell/notifications.rs`, `endpoint_notices.rs`: needs-attention red,
  endpoint warning yellow, notification separators/borders/dim text overlay0.
- `client/shell/sidebar.rs`, `agent_sidebar.rs`, `endpoint_sidebar.rs`,
  `endpoint_agents.rs`, `tabs.rs`, `composition.rs`, `render.rs`, `mobile.rs`,
  `scroll.rs`: panel headings, separators, empty/secondary text, tabs, mobile
  presentation and chrome/scroll detail use overlay0; mobile close control red.
- `ui/sidebar.rs`: built-in git ahead green and behind red unless a token fg
  overrides them (Spaces overrides both with secondary).
- `ui/status.rs`: status border/online dot green and status indicator background
  yellow; `ui/scrollbar.rs`: scrollbar track/thumb detail overlay0;
  `ui/panes.rs`: inactive border/title detail overlay0.

Teal's direct state-color use is done state via `client/shell.rs`. Configured
custom token styles still override defaults. These consequences are intentional
for the approved palette mapping, not a claim of panel-local theming.

## Theme

[theme.toml](../theme.toml) sets the 11 `[theme.custom]` keys that the agents
and Spaces fragments leave unset, "Acid & Orange": white focus and selection on
a black field, acid detail and signal-orange secondary chrome. Herdr 0.9.3 has
exactly 19 keys (`src/config/theme.rs`, `CustomThemeColors`); with all three
fragments each is set once, so no color of the `[theme] name` base theme shows
and the name and `auto_switch` stay the user's. Herdr assigns each key on its
own: `accent` does not recolor `mauve` or `blue`
(`src/app/state.rs`). Uses below are from Herdr 0.9.3 source; paths are
relative to the Herdr repository.

| Key | Value | Role | What it colors |
| --- | --- | --- | --- |
| `accent` | `#ffffff` | Primary | Focused pane border and title (`ui/panes.rs`), active tab (`client/shell/tabs.rs`), selected menu, settings and navigator items and buttons, dialog and menu frames (`client/shell/overlays.rs`, `settings_overlay.rs`), mode badges (`client/shell/render.rs`), attention marks, the current copy-mode match |
| `panel_bg` | `#000000` | Field | Tab bar, mode bar, menus, dialogs and toasts; also the **text on colored controls**: Herdr uses `panel_bg` itself as the contrast ink (`client/shell.rs`, `ui/widgets.rs`) |
| `surface0` | `#1c1c1c` | Surface | Inactive tabs and tab arrows, inputs and Cancel buttons, inline code (`ui/release_notes.rs`), the settings divider |
| `surface1` | `#4d1c00` | Herdr chrome `signalOrange30`: 30% of the signal orange over the field | The other (non-current) copy-mode search matches (`client/shell/composition.rs`), a dragged Space, fenced code, navigator and picker dividers |
| `surface_dim` | `#333333` | Ghost (signal color) | The sidebar edge and the Spaces/Agents divider (`client/shell/render.rs`, `sidebar.rs`, `agent_sidebar.rs`), list and unfocused pane scrollbar tracks (`client/shell/scroll.rs`, `ui/scrollbar.rs`); the focused agent, Space and tab background in the mobile layout (`client/shell/mobile.rs`) |
| `overlay1` | `#ff5c00` | Herdr chrome `signalOrange`, the Marathon signal orange | Tab-bar status, hostname and clock segments, custom-label inactive tabs and enabled arrows (`client/shell/tabs.rs`), help and settings secondary text, the focused pane scrollbar thumb |
| `text` | `#ffffff` | Primary | Focused Space and agent names, dialog, menu and body text |
| `subtext0` | `#cfcfcf` | Secondary | Unfocused Space and agent names, dialog hints |
| `mauve` | `#c0fe04` | Accent | Focused Space branch and secondary tokens, help keybindings, the Resize mode badge background (black ink) |
| `blue` | `#c0fe04` | Accent | The finished-notification dot (`client/shell/notifications.rs`), the leading Done category in the mobile summary |
| `peach` | `#d79e52` | Warning | Stored but read by no Herdr 0.9.3 UI; set so no base value remains |

The sidebar fragment's `sidebar_bg`, `active_row_bg` and `selection_bg` and the
Spaces fragment's five state keys are unchanged; see
[Spaces theme scope](#spaces-theme-scope) for their wider effects.

### Theme trade-offs

- Acid is the working color (`yellow`). `mauve` and `blue` reuse it for chrome
  that does not mean working: branch tokens, help keys, the Resize badge and the
  finished dot. Each keeps its own shape or text, so state is never read from
  acid alone.
- The signal orange is close in hue to critical `#f24723`, so the finished dot
  stays acid rather than orange, apart from the red attention dot.
- Pane text selection is computed by Herdr from the terminal background, or
  from `panel_bg` when the terminal reports none (about `#474747` on black
  either way, `ui/panes.rs`); no key sets it directly; `selection_bg`
  is the sidebar cursor only.
- `panel_bg` must stay dark: it is the ink on white, acid and red controls.
- Programs in panes and the host terminal keep their own colors.

### Theme contrast

WCAG contrast ratios of the values, computed from the hex values, not measured
on a display:

| Pair | Ratio |
| --- | --- |
| `overlay1` `#ff5c00` on black / on `#1c1c1c` | 6.8:1 / 5.5:1 |
| Black ink on the acid Resize badge | 17.4:1 |
| White text on `surface1` `#4d1c00` | 14.2:1 |
| `surface_dim` `#333333` on black | 1.7:1, decorative only: edges, dividers and tracks |

Checked: the automated tests and Herdr's parser. Not checked: the theme in a
running Herdr, other color depths, or the mobile layout.
