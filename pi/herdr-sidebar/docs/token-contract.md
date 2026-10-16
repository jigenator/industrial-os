# Herdr sidebar token contract

Status: current. This is the canonical copy of the token contract between this extension, which reports the tokens, and the [Herdr configuration](../../../herdr/README.md), whose rows render them. The geometry was frozen on 2026-10-08 for the parallel signals-collector and herdr-sidebar work and verified live in Herdr 0.9.3 that day. The approved follow-up uses context used and the Herdr SPACE label; the state follow-ups add `◐ SUB`, `◐ RUN` and the unseen-work `DNE` without new keys; the manual flag adds the one key `flag`. The collector snapshot contract is unchanged. Change it here first, then the builder in `src/tokens.ts`, then the rows in `herdr/sidebar.toml`; the checks in both projects read the key list below.

The snapshot fields named here (`snapshot.active`, `snapshot.question` and the rest) are the signals-collector's snapshot contract v1; [architecture](architecture.md#inputs) describes how this extension receives and validates it.

## Geometry

The sidebar is 36 columns; when the agent list scrolls, a scrollbar takes one column, leaving 34. Row 1 is indent 1 + `g1` (6 cells); rows 2+ are indent 3 + a 4-cell gutter token. Then Herdr's ` · ` separator (3 cells). That leaves a **24-cell text area**. A right-aligned value uses a **6-cell right slot**, padded on the left with U+2800; when a right value is present, the left value is fitted to exactly 15 cells (padded with U+2800, or cut to 14 + `…`). Without a right value the left value is cut to 24 cells (23 + `…`). Row 1's `flag` takes 4 of the project's cells (Herdr's ` · ` and `●`): the project is fitted to 11 cells beside a goal time, so the goal keeps its column, or cut to 20 cells (19 + `…`) without one.

Herdr trims ASCII whitespace but keeps U+2800, so every padding cell is U+2800. Widths are terminal cells (measured with Pi TUI's `visibleWidth`), not code units. Control characters are stripped before measuring.

## Row 1

- `g1`: `<icon> <CODE>` + one U+2800. The first state that applies, from `snapshot.question`, Herdr's `agent_status` for this pane (which tracks only Pi's root agent) and `snapshot.units`, plus the validated pi-background-tasks running count:
  1. question `× QNS`: `snapshot.question` is non-null.
  2. blocked `× BLK`: Herdr reports blocked.
  3. working `◐ WRK`: Herdr reports working; the main agent supersedes its subagents.
  4. subagents `◐ SUB`: `snapshot.units` ≥ 1 while Herdr reports idle, done or unknown.
  5. background tasks `◐ RUN`: at least one task is running in this session’s pi-background-tasks registry while Herdr reports idle, done or unknown and no subagents are active. Unknown background state never selects RUN.
  6. done `✓ DNE`: Herdr reports done, or the unseen-work-finished flag below is set.
  7. idle `○ IDL` or unknown `· UNK`: Herdr reports idle, or unknown or not yet read.
- The unseen-work-finished flag is the sidebar's own unseen completion, because Herdr makes `done` only from the root agent. It is set when either `snapshot.units` or the background running count falls from ≥ 1 to 0 between consecutive known observations while Herdr does not report working and the pane is not known seen. Unknown counts never count as zero or create a completion. An unknown task count between running and zero loses that task completion, including any coincident subagent completion suppressed while the task was running. It is cleared when the pane is seen, Herdr reports working, or either count is ≥ 1; ongoing work in either source prevents a completion marker. Seen mirrors Herdr's rule: the pane's tab is the active tab of Herdr's focused workspace, from `pane.get` (`tab_id`) and `workspace.get` (`focused`, `active_tab_id`), re-resolved on `workspace.focused`, `tab.focused`, `pane.focused` and reconnect. Unknown visibility counts as not seen. [Architecture](architecture.md#seen-and-the-unseen-work-finished-flag) gives the sources and limits.
- `proj` (WRK/SUB/RUN/QNS/BLK/DNE) or `proj_idle` (IDL/UNK): the Herdr SPACE name (the pane's workspace `label`), with the full basename of `snapshot.active` only while the label is unknown. Resolve with `pane.get` → `workspace_id` → `workspace.get`; re-resolve on `workspace.renamed`, `workspace.updated`, `pane.moved` and reconnect.
- `flag`: `●` while this Pi session's manual reminder is set with `/flag`, otherwise absent. It comes after `proj`/`proj_idle` and before `gt`/`gt_off`, so Herdr separates it with its own ` · `; the project gives up those 4 cells as [geometry](#geometry) states. It is independent of `g1`: no state, focus, visibility, work, completion or age sets or clears it, and it never decays. Without a project it follows `g1`. The value is the latest valid saved flag on Pi's active session branch; [architecture](architecture.md#the-manual-flag) gives the persistence.
- `gt` (goal status active) or `gt_off` (any other goal status): pi-goal's own duration format (`<60s → Ns`, `<60m → Nm`, else `HhMm`) of `usedSeconds` plus, when active, `now − activeSince`. Right slot. Absent when `goal` is null.

## Row 2 (always all three present)

- `g2_au` (units ≥ 1) or `g2_au0` (units 0 or unknown): two-digit `NNAU`, capped at `99AU`; unknown is `??AU`.
- `bar` / `bar_warn` / `bar_crit` / `bar_idle` / `bar_unk`: 11-cell bar of context used, `━` lit and `─` unlit, lit = ceil(used × 11 / 100), then one space, then the used percent as two digits and `%`. used = max(0, min(99, floor(usedPercent))), so `99%` means 99% or more. Warning from 70% used and critical from 90% used. At the compaction budget the collector holds `usedPercent` at 100, giving a fully lit critical bar. IDL and UNK use `bar_idle` instead of a zone token, with identical text/shape in decorative grey (#717171), not bold. WRK, SUB, RUN, QNS, BLK and DNE keep the zone tokens. Unknown context: `bar_unk` = 11 × `─` + space + `--%`.
- `cmpx`: `CMP×NN`, two digits, capped at `CMP×99`; unknown `CMP×??`.

The [Spaces plugin](../../../herdr-plugins/spaces/docs/token-contract.md) consumes
`g2_au`/`g2_au0` from Pi pane tokens through Herdr’s socket API to aggregate
workspace AU. This is a read-only consumer; it changes neither this reporter
nor the collector contract.

## Row 3

- `g3`: `ACT` + U+2800.
- One of `br` (clean or unknown dirtiness), `br_dirty` (dirty, shown as `branch*`), or `dir`. Show the branch under exactly the condition status-bar's footer uses to show `⑂ branch`; otherwise `dir` is Active's `parent/current` path, as status-bar shows it.
- `prn`: `#N` for an open PR; `prn_off`: `#?` when the PR lookup is unavailable. Right slot. Absent for no PR, not applicable, or not looked up yet.

## Row 4

- `g4`: `MDL` + U+2800.
- `mthink`: short model name, then `/` and the short thinking level when the model reports thinking. Short model: drop a leading `claude-`, then turn a trailing `-N-N` into `-N.N` (`claude-opus-5-5` → `opus-5.5`). Thinking: off→`off`, minimal→`mn`, low→`lo`, medium→`md`, high→`hi`, xhigh→`xh`, max→`mx`.

## Row 5 and its continuation rows

The first applicable form wins: pending question, DNE finished marker, then known pane name. No label known means no pane-name row; there is no fallback. This row never access-decays.

- Question pending: `g5` = `ASK` + U+2800; `ask_l1`…`ask_l3` = the question text, plus ` (+N)` when `more > 0`, word-wrapped to 24 cells, at most 3 lines, the last cut with `…`. `ask_l2` and `ask_l3` start with 7 U+2800 so they align under the text column.
- State `DNE` (with a snapshot): `g5` = `RDY` + U+2800; `ev_rdy_text` = `finished`; `ph_age` = time since the unseen-work-finished flag was set when it is set, otherwise since `root.lastSettledAt` (absent when unknown).
- Otherwise, in every state including IDL/UNK: `g5` = `PNE` + U+2800; `pane` = the non-empty Herdr pane `label` from `pane.get` → `result.pane.label`, sanitized and fitted to the available width with `…` on truncation. `ph_age` = time since `phase.since`, in pi-goal's format, right slot, only while the snapshot has a working phase. Without a phase there is no right slot and the label has all 24 cells. Without a known label neither `g5`, `pane` nor phase age is reported. Phase codes, targets and fallback phase/tool text are not reported.

Re-read on `pane.updated` (wire `pane_updated`), reconnect and the existing 20-second renewal. Herdr 0.9.3's `pane.rename` emits no event, so an unannounced rename can lag by one renewal cycle, like an automatic SPACE label. Source: [rename handler](https://github.com/herdrdev/herdr/blob/v0.9.3/src/app/api/panes.rs#L1479-L1503); [event schema](https://github.com/herdrdev/herdr/blob/v0.9.3/src/api/schema/events.rs).

## ACT / MDL access decay

Rows 3 and 4 alone decay by time since last access: **d0 < 1 hour,
d1 ≥ 1 hour, d2 ≥ 4 hours, d3 ≥ 1 day**. Access means the pane is
visible (its tab is the active tab of the focused workspace) or row 1 shows
WRK, SUB or RUN; access refreshes continuously while either holds. QNS and BLK
alone do not count as work. Unknown visibility or Herdr status is never
guessed old: load starts at d0 and unknown inputs keep it at d0, refreshing
the conservative access baseline. Returning to known inactivity starts aging
from that baseline. The timestamp is memory only and resets on `/reload`,
Pi restart or session replacement.

The eight key families are `g3 br br_dirty dir prn prn_off g4 mthink`.
At d0 use the unchanged base key; at later stages use `<key>_d1`,
`<key>_d2` or `<key>_d3`. Exactly one variant of an applicable family
is set; all others are cleared. Absent values keep all variants absent.
Text, cell widths, padding and the dirty `*` are identical at every stage.
Only the key and its configured color change, including the amber dirty branch.
Rows 1, 2 and 5+ never decay. Colors are specified by
[the Herdr design](../../../herdr/docs/design.md#access-decay).
Herdr's configured-row limit is also 16 entries: ACT uses two mutually exclusive physical rows (d0+d1, d2+d3), each 12 entries, and empty rows are dropped without extra gaps; MDL uses one eight-entry row. The Pi layout has eight configured rows, within the 16-row limit.

Thresholds have one executable source, `DECAY_THRESHOLDS_MS` in
`src/tokens.ts`; the existing render timeout schedules the next boundary.

## Reporting

Every report sets the applicable keys and clears the rest of this list across bounded requests (clears first), so stale keys never linger. Herdr limits: 32 tokens per pane, 16 per request, 80 characters per value. The 53-key contract is not 53 stored tokens: at most 16 are simultaneously applicable (15 plus `flag`), and null clears remove stored keys. A full report is still four requests. Other reporters share the pane's 32-token budget.

Full key list: `g1 proj proj_idle flag gt gt_off g2_au g2_au0 bar bar_warn bar_crit bar_idle bar_unk cmpx g3 br br_dirty dir prn prn_off g4 mthink g5 pane ask_l1 ask_l2 ask_l3 ev_rdy_text ph_age g3_d1 br_d1 br_dirty_d1 dir_d1 prn_d1 prn_off_d1 g4_d1 mthink_d1 g3_d2 br_d2 br_dirty_d2 dir_d2 prn_d2 prn_off_d2 g4_d2 mthink_d2 g3_d3 br_d3 br_dirty_d3 dir_d3 prn_d3 prn_off_d3 g4_d3 mthink_d3` (53 keys).

## How the builder resolves what the contract leaves open

These follow from the rules above and are pinned by `test/tokens.test.ts`; they are this extension's reading, not additions to the contract.

- **No snapshot.** Without a collector, or before its first snapshot, the report is row 1's `g1` (and SPACE title when Herdr supplies it, and `flag` when set) and row 2's unknowns: `??AU`, `bar_unk` and `CMP×??`, plus PNE when the pane label is known (no age). Rows 3 and 4 report nothing rather than a guess. ASK and RDY remain inapplicable before the first snapshot, even when Herdr reports done.
- **Gutters follow their row.** `g3` and `g4` are reported only when their row has a value, so no label stands alone.
- **Sanitizing.** Control characters (C0, DEL and C1) and bidi controls (U+061C, U+200E/F, U+202A–U+202E, U+2066–U+2069) are removed and surrounding whitespace trimmed before a value is measured, so Herdr's own trim cannot shift alignment. In the question text, whitespace, including line breaks, separates words.
- **Cutting.** A cut keeps whole grapheme clusters. When a wide character does not fit before the `…`, the fitted 15-cell value pads with U+2800 before the `…`, so the `…` stays in the last cell. A cut segment also keeps at most 60 code points, so no value reaches Herdr's 80-character cap.
- **A right value over six cells,** such as a goal time of 100 hours or more or a PR number of seven digits, is cut to five cells and `…`.
- **Directory.** As status-bar shows it: `~` for home, `~/name` for a folder directly under home, the full path when the parent is the filesystem root (`/work/tatsu-cli`), otherwise `parent/current`.
- **A cut dirty branch keeps its `*`** after the `…`, so dirtiness never rests on color alone.
- **Short model.** `N` is one digit, so a dated ID such as `claude-sonnet-4-20250514` keeps its date. A thinking level outside the table is shown verbatim.
- **Phase age.** Only the age remains, beside a known pane name while the snapshot says the root agent is working with a phase. Question and finished rows take precedence.
