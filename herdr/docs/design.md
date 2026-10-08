# Design

The agents sidebar in Herdr, as this configuration draws it: layout "B", one block of up to seven rows per Pi pane, in the [shared language](../../docs/design.md). The extension's side, what each value means and when it is unknown, is in [herdr-sidebar's design](../../pi/herdr-sidebar/docs/design.md); the exact token values are in [the token contract](../../pi/herdr-sidebar/docs/token-contract.md).

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

## States

Every state is readable without color: the state code and shape in row 1 (`× QNS`, `× BLK`, `◐ WRK`, `◐ SUB`, `✓ DNE`, `○ IDL`, `· UNK`; `SUB` shares `WRK`'s shape and accent, and its code tells it apart), `*` on a changed branch, `--%`, `??` and `#?` for unknowns. Color adds emphasis only. The meanings are in [herdr-sidebar's design](../../pi/herdr-sidebar/docs/design.md#states).

## Accessibility and limits

- Ghost grey on black is deliberately faint, for paused or unavailable values; it is not used for anything that needs reading at a glance.
- Pi panes without herdr-sidebar show no Industrial OS rows; other agents retain their configured/default layouts.
- The collapsed and mobile sidebars keep Herdr's compact layouts.
- Checked: Herdr's parser accepts the file. Not checked: this file in a running Herdr, other color depths, or ambiguous-width glyph settings.
