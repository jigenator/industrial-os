# Session signals have one collection owner

Status: current, except its CodexBar quota part, which is superseded by [provider usage comes from configured source-collector sources](usage-via-source-collector.md) (2026-10-31). Date: 2026-10-08; approved collector/display split. Source and offline tests implement this decision; live Pi/Herdr qualification is separate.

## Choice

`pi/signals-collector` owns collection per interactive Pi session: workspace/Git/PR, agent-reported Active/tool/restoration, native AU fleet, CMP, context settings/reserve, root/settlement/phase/question/model/thinking, validated private pi-goal records and usage (originally CodexBar; now read from configured source-collector sources). `pi/status-bar` consumes its pushed/synchronously requested [v1 snapshot](../../pi/signals-collector/docs/contract.md) and owns footer rendering/motion plus Ponytail/Tatsu/background-task status observation. Future in-session panels/dashboards consume the same contract; no extension imports another extension.

Git inspection stays per session (15s/tool refresh). PR lookup for the same GitHub repository/branch now shares a bounded private atomic cache and exclusive/stale lock across interactive sessions, preserving its 60s freshness and existing result union. Explicit GitHub auth/config overrides conservatively bypass sharing and retain session-local caching; the [PR cache contract](../../pi/signals-collector/docs/contract.md#3-shared-github-pr-lookup) defines isolation and limits. Superseded: parsed CodexBar quota was machine-wide, with an atomic private cache, directory watch and exclusive/stale lock sharing one refresh round between sessions; usage now comes from configured source-collector sources. Non-TUI child processes collect/publish nothing. Session replacement/shutdown clean up owned resources and reject stale work. Displays without a collector show unknown, not zero/clean. Either collector/display load order works via subscribe/request/ready.

The collector alone resolves context reserve settings and computes snapshot percentage. Approved parity exception: status-bar keeps its existing pure arithmetic over live host tokens/window and collector reserve. Both architectures explain the formula and carry identical vector tables; policy changes update both, without cross-project imports. Live model/thinking/context/isIdle reads in the footer remain permitted.

## Alternatives

- **Keep a collector in each display:** duplicate subprocesses/state/policies and load-order failures. Rejected.
- **One daemon now:** unnecessary lifecycle/IPC/install complexity. Future dashboards outside Pi's in-process session are the concrete revisit condition.
- **Share all Git inspection machine-wide:** rejected; local worktree/Active inspection remains session-owned. The original rejection of shared PR lookup is superseded by the approved repository/branch-only consolidation; no daemon or other-session code changes are needed.
- **Import collector source in consumers:** violates independent-project boundaries and couples runtime loading. Rejected; small local DTOs describe only the wire contract.
- **Move all render-time host reads/arithmetic:** would widen pure renderer contracts and disrupt exact byte parity. The explicit bounded exception above preserves them.

## Consequences and revisit

Active's persisted details/tool name remain compatible with existing sessions; the [Active decision](../../pi/signals-collector/docs/decisions/agent-reported-active-workspace.md) moves to its owner. Superseded: the usage cache wrote only whitelisted parsed fields, retained last good provider samples on failure and accepted one extra round from simultaneous stale lock takers. No takeover directory/provider registry/plugin system is added.

Private pi-goal 0.54.10 records are validated, not claimed as a released integration API. No public general goal-change event exists: idle command-only changes may wait for another observed boundary. Revisit if a verified public event/API becomes available. New signals belong in a collector module + snapshot field + tests. Additive optional fields remain v1; removing/renaming/meaning changes require v2 channels retaining v1 until migration. Revisit a daemon only for a concrete cross-session external consumer. Actual interactive fidelity remains an explicit validation gap.
