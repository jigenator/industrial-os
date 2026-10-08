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
