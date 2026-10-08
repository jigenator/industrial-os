# Contributing

Follow the [root workflow](../../CONTRIBUTING.md). No build/install step for this
plugin: Node 22, `.mjs`, standard library only; Herdr manifest is its packaging
entry point. The separate Herdr config project's checks need the root-linked
design-system package. No live Herdr server or installed plugin is needed here.

## Validation sequence

| Order | Directory | Command/check | Effects and coverage |
| --- | --- | --- | --- |
| 1 | `herdr-plugins/spaces/` | `node --test` | Pure tokens/width/AU/activity/groups/order; fake Unix socket subscribe/read/report/diff/clear/TTL/failure/reconnect/exit; private lock/history; detached ensure EOF. Temporary directories/processes only. |
| 2 | `herdr/` | [Config validation sequence](../../herdr/CONTRIBUTING.md#spaces-validation) | Contract/colors tests and Herdr's read-only parser on isolated config copies. |
| 3 | Root | [Repository-wide checks](../../CONTRIBUTING.md#repository-wide-checks) | Links, inventory, entrypoints, whitespace and publication review. |
| 4 | Live Herdr | Interactive alignment, navigation/order and restart inspection | **Not authorized during development; not run.** Requires separately authorized operator installation/config merge. |

No `plugin link/install/enable`, server commands or workspace mutations against
a live socket are validation commands. Tests overwrite inherited Herdr target
environment with their own temporary socket and always stop owned children.
Timer injection accelerates tests without changing production constants.

## Verification records

Records are updated after final validation below; automated and live evidence
must remain separate. Tests model source shapes, not an installed plugin API
invocation. No renderer or third-party package is installed for checking.

### Spaces initial implementation

2026-10-08, macOS, Node 22.23.0; protocol authority Herdr 0.9.3:

**Passed**

- `cd herdr-plugins/spaces && node --test`: **20/20 passed**, zero failures,
  skipped or cancelled. Includes the canonical key list/manifest hook surface;
  wide/combining/emoji text and sanitization; AU unknowns/caps; quiet activity;
  worktree units, minute rate limit and no-fight signatures (including restart);
  fake NDJSON socket reports, TTL expiry retaining names, forced tick renewal,
  partial/error report full retry and 5–60 s retry arithmetic, torn/failed/stale
  reads, reconnect, handshake timeout and continuous-failure exit; concurrent
  stale/empty lock recovery, atomic history, and eight concurrent ensure hooks
  returning pipe EOF while one detached daemon stays subscribed.
- `cd herdr && node --test`: **10/10 passed**.
- `cd herdr && node check-config.mjs`: spaces, sidebar and merged temporary
  configs each **`config: ok`, exit 0**; deliberately invalid copy **rejected,
  exit 1**, expected. Executes only `HERDR_CONFIG_PATH=<temporary-copy> herdr
  config check` for the four cases; never a live server operation.
- Root local-link/anchor walkthrough script: **355 local links/anchors opened**;
  guide inventory/current map checked, all new guides mapped once; **10 CLAUDE
  entrypoints byte-exact**. Manual contributor/ownership/import/publication
  review: no cross-project source imports, no private paths/emails/secrets,
  copied assets or generated clutter in intended files.
- `git diff --check` and `git diff --cached --check`: **passed**.
- Existing local grok-mermaid 0.2.3, Node heredoc invoking `render` on the three
  changed architecture Mermaid blocks: non-null art, **no warnings** (root,
  Herdr config, Spaces). No renderer installed, no artifact uploaded.

**Failed (resolved during development)**

- Initial fake-socket teardown hooks removed temporary state before stopping
  owned children; cleanup ordering was corrected and final tests pass. An empty
  lock recovery contention branch was corrected and regression-tested.
- Initial Herdr checks lacked the root-linked design-system package; the
  documented root `npm install` resolved it without manifest/lockfile changes.

**Skipped:** none of the authorized required checks.

**Not run:** live/interactive Herdr, plugin link/install/enable or manifest
invocation in an installed plugin, real-session mutations/restart, Linux,
other terminal/font widths, latency/load and power-loss durability. None are
claimed from the fake-server or parser evidence.

Final hardening: an immediate pre-dispatch epoch fence covers async diagnostic
yields. The approved residual concurrent-focus race is documented: Herdr has
no conditional-move focus guard, but preserves active workspace ID. Final
`node --test` remains **20/20 passed**; no live validation added.

### Review fix round

2026-10-08, macOS, Node 22.23.0, Herdr 0.9.3; source authority tag `v0.9.3`.

**Correction:** the initial 20/20 result above was a passing local suite, not
proof of subscription compatibility. The fake server incorrectly accepted any
subscription and emitted dotted lifecycle names. The claim that those shapes
were derived correctly from Herdr was wrong. `Subscription` requires `pane_id`
for agent-status subscriptions; `EventKind` serializes lifecycle names in
snake_case. This round validates required fields, rejects the whole request
with `invalid_request`, emits snake_case lifecycle events, and maps them to one
internal dotted form. No live/installed-plugin evidence has been added.

**Passed**

- `cd herdr-plugins/spaces && node --test`: **30/30 passed** on each of three
  consecutive final runs, zero failures/skipped/cancelled. New regressions cover whole-request subscription rejection;
  snake_case rename/creation activity and recycled-ID label reset; busy status
  from pane.list; events every 10 ms while changed first-workspace reports are
  delayed, all workspaces reporting, health persistence and a subsequent clean
  sorting dispatch; tick config reload/disabled or missing plugin shutdown
  (including interruption of a long report pass); persistent pane-count partial
  reporting and transient mismatch single retry; PID-reuse-resistant control
  probes, concurrent stale recovery, macOS long-path fallback and CLI stop.
- Mutation checks in isolated temporary plugin copies: reverted B1, M1, M2,
  M3, m1 disable/config, m2 creation/reappearance, m2b liveness, m3 partial-read,
  and m4 key-prefix behavior each made its targeted regression fail (exit 1).
  Nits have no behavior to revert: the redundant quiet filter is removed, and
  the focused wording is corrected in the configuration design.
- `cd herdr && node --test`: **10/10 passed**.
- `cd herdr && node check-config.mjs`: temporary Spaces, sidebar and merged
  copies **`config: ok`, exit 0** each; invalid copy **rejected, exit 1** expected.
- Repository temporary walkthrough script: **982 local links/anchors passed**,
  **93 tracked guidance documents mapped**, **10 CLAUDE entrypoints byte-exact**.
  `git diff --check`, `git diff --cached --check` and manual publication/import
  review: **passed**. No Pi source changes, private paths, payloads, copied
  assets or generated files in the publication diff.

**Failed (resolved):** updated fixtures/expectations before fixes: **12 passed,
13 failed of 25**. An initial M3 mutation still passed because no-op events let
accepted diffs advance across reruns; the regression now also changes the first
workspace and proves the old epoch-aborting loop starves late workspaces. A
repeated full run then exposed the old stale-read test gate matching an earlier
`pane.list` call (**29/30 passed**); it now waits for the actual delayed old
snapshot before invalidating it. The final repeated results recorded here use that corrected gate.

**Skipped:** none of the authorized required checks.

**Not run:** live/interactive Herdr, install/link/enable, installed manifest
invocation, real-session mutations, Linux, native rendering/navigation, load
benchmarks or power-loss durability. Mermaid re-rendering was not run (no
diagram changes in this round; no local renderer found). Focus dispatch remains non-conditional;
missed creation with same-label/restart ID reuse can still inherit age. Older
PID-only daemons must be stopped before upgrade; update the `$sp_` fragment with
the reporter. No upgrade or live-state deletion was performed.
