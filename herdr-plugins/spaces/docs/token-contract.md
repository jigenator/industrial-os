# Spaces token contract

Canonical contract for `industrial-os.spaces` and
[herdr/spaces.toml](../../../herdr/spaces.toml), targeting Herdr 0.9.3.

Full key list: `sp_panes sp_agents sp_au sp_name_active sp_name sp_name_stale sp_quiet` (7 keys).

## Values

| Key | Value | Lifetime |
| --- | --- | --- |
| `sp_panes` | `NNPN`, from authoritative `pane_count`, capped `99PN`; always present | 120 s TTL |
| `sp_agents` | `NNAG`, count of panes with any non-null `agent`, capped `99AG`; absent for quiet spaces | 120 s TTL |
| `sp_au` | Sum of Pi panes' `g2_au`/`g2_au0` as `NNAU`, capped `99AU`; no Pi → `00AU`; missing/unknown/malformed/conflicting Pi values → `??AU`; absent for quiet spaces | 120 s TTL |
| `sp_name_active` | Focused space's sanitized name, cut to 24 cells | No TTL |
| `sp_name` | Other non-quiet space's sanitized name, cut to 24 cells | No TTL |
| `sp_name_stale` | Quiet space's sanitized name, fitted to exactly 15 cells | No TTL |
| `sp_quiet` | Floor days since activity, capped `99d`, left-padded to 6 cells | 120 s TTL |

Herdr workspace keys share a namespace across reporters; the `sp_` prefix is
owned by this plugin. Exactly one name variant applies. Both AU variants present with the same value
count once; conflicting values are unknown. Other agents do not contribute AU.
The Pi reporter is a protocol consumer only, not a source import or behavior
change to [herdr-sidebar](../../../pi/herdr-sidebar/docs/token-contract.md).

Quiet spaces send only `$sp_panes`, `$sp_name_stale` and `$sp_quiet`, so their second row
drops **unless they are ahead or behind**: Herdr's independent built-in
`git_status` then leaves a second row containing only those counts. Herdr
suppresses git details for indented worktree children. No branch name is drawn.

## Geometry

36-column sidebar, sized for 34 cells with scrollbar. The state icon and `NNPN`
gutter leave 24 cells for row-1 text. Active/non-quiet names cut to 23 cells +
`…` when needed. Quiet text uses 15 + ` · ` + 6 cells: names pad with U+2800
on the right or cut to 14 + `…`; age pads with U+2800 on the left. A wide
cluster that cannot fit leaves U+2800 before the ellipsis so fitted labels still
occupy exactly 15 cells. Herdr strips ASCII whitespace but preserves U+2800.
The [configuration](../../../herdr/README.md#spaces) owns color, bold and rows.

## Text and width

Strip C0, DEL, C1 and bidi controls (U+061C, U+200E/F, U+202A–E,
U+2066–9), then trim before measurement. Segment using Node 22's
`Intl.Segmenter` grapheme clusters, never split a cluster. East Asian wide
ranges (Hangul, CJK, fullwidth and supplementary ideographs) take two cells;
other visible bases take one. Marks/format-only clusters take zero. Emoji
pictographs, regional flags and keycap clusters take two unless VS15 requests
text presentation. A combining/ZWJ cluster takes its base's width, not the sum
of component widths. Ambiguous-width characters use one cell.

This is an approximation: terminal Unicode versions, fonts, emoji/text defaults,
ambiguous-wide modes and uncommon scripts can differ. No universal wcwidth or
interactive glyph verification is claimed. Retained text is capped at 60 code
points plus fitting padding/ellipsis, below Herdr's 80-character value limit;
a single oversized cluster is omitted with `…`. A sanitized empty name uses
one U+2800 (15 for quiet), never an empty value that Herdr would clear.

## Activity and identity

Quiet = not focused and time since activity ≥ 48 hours. Activity is workspace
created; pane created/closed/agent detected; workspace, pane or tab focused;
being focused at a recompute; or any pane working/blocked in `pane.list` at a
recompute. Lifecycle wire names are snake_case and normalized to dotted internal
names at the transport boundary. The pane-scoped `pane.agent_status_changed`
subscription requires `pane_id` and is not subscribed; agent changes invalidate
reads through `pane.updated`, while busy status is read authoritatively.
`pane.updated` (including token updates), movement, renames and Git refresh
are not activity. First-seen workspace without history starts at
now; no inferred old age. An absent workspace's history is pruned after
30 days since last seen. A clock step backwards clamps history to now rather
than inventing a negative age.

History is partitioned by socket hash and keyed by stable public workspace ID:
Herdr 0.9.3 `persist/snapshot.rs` captures `id`, `persist/restore.rs` restores
it and reserves IDs, and `workspace.rs` defines the stable identity independently
of display order. Old snapshots with no ID receive a fresh ID and start at now.
Creation events reset activity even for a known ID. Within one daemon run,
a known ID that was absent in the previous validated read and returns with a
different label resets activity too. Labels are retained only in memory, never
persisted. Same-label reuse, reuse without an intervening absent read, or reuse
across daemon restarts while creation was missed can still inherit history;
this is not a globally unique session-generation identity.

## Reporting

`workspace.report_metadata` receives `workspace_id`, `source`, `tokens`, `seq`,
and optional `ttl_ms`. Source is always `industrial-os:spaces`; sequence is
`max(Date.now() * 1000, previous + 1)`. A report diffs against last accepted
state; first report, reconnect, report failure and each 30-second renewal send
every key set or explicitly `null`. Names are sent first in a no-TTL batch;
count/age keys use `ttl_ms = 120000`. Seven keys use at most four per request,
under Herdr's 16/request, 32/resource, 32-character key and 80-character value
limits (`app/api_helpers.rs`, `metadata_tokens.rs`, `app/api/workspaces.rs`).
One source consumes one of Herdr's 32 sequence-source slots.

Failures force a full retry with 5-second exponential backoff capped at 60
seconds; updates/ticks do not bypass it. An errored/timed-out report is never
accepted locally, even if Herdr may have applied it. The two batches are not a
transaction: the next accepted full report self-heals a partial application.
A backwards wall clock can make Herdr silently ignore reports until the old
sequence is passed; its stale-sequence success reply is indistinguishable.

Failed/invalid reads publish nothing new. Pane-count mismatches retry both lists
once; if still inconsistent, consistent workspaces publish while inconsistent
ones keep their previous tokens (TTL governs expiry). Ordering is skipped on a
partial read. An epoch change during reads discards them; after that fence, the
report loop completes even if events arrive, then a dirty rerun corrects values.
If stopped, count/age keys expire and no-TTL names freeze. Herdr does not persist workspace tokens across server
restart; the startup hook re-sends them. Shutdown intentionally sends no clear.
