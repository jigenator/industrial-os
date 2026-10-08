# Session signals have one collection owner

Status: current. Date: 2026-10-08; approved collector/display split. Source and offline tests implement this decision; live Pi/Herdr qualification is separate.

## Choice

`pi/signals-collector` owns collection per interactive Pi session: workspace/Git/PR, agent-reported Active/tool/restoration, native AU fleet, CMP, context settings/reserve, root/settlement/phase/question/model/thinking, validated private pi-goal records and CodexBar. `pi/status-bar` consumes its pushed/synchronously requested [v1 snapshot](../../pi/signals-collector/docs/contract.md) and owns footer rendering/motion plus Ponytail/Tatsu/background-task status observation. Future in-session panels/dashboards consume the same contract; no extension imports another extension.

Git/PR stay per session (15s/tool refresh; 60s repository/branch TTL). Only parsed CodexBar quota is machine-wide: an atomic private cache, directory watch and exclusive/stale lock share one refresh round between sessions. Non-TUI child processes collect/publish nothing. Session replacement/shutdown clean up owned resources and reject stale work. Displays without a collector show unknown, not zero/clean. Either collector/display load order works via subscribe/request/ready.

The collector alone resolves context reserve settings and computes snapshot percentage. Approved parity exception: status-bar keeps its existing pure arithmetic over live host tokens/window and collector reserve. Both architectures explain the formula and carry identical vector tables; policy changes update both, without cross-project imports. Live model/thinking/context/isIdle reads in the footer remain permitted.

## Alternatives

- **Keep a collector in each display:** duplicate subprocesses/state/policies and load-order failures. Rejected.
- **One daemon now:** unnecessary lifecycle/IPC/install complexity. Future dashboards outside Pi's in-process session are the concrete revisit condition.
- **Share Git/PR machine-wide too:** changes existing session ownership/cache semantics and is unnecessary for this slice. Rejected.
- **Import collector source in consumers:** violates independent-project boundaries and couples runtime loading. Rejected; small local DTOs describe only the wire contract.
- **Move all render-time host reads/arithmetic:** would widen pure renderer contracts and disrupt exact byte parity. The explicit bounded exception above preserves them.

## Consequences and revisit

Active's persisted details/tool name remain compatible with existing sessions; the [Active decision](../../pi/signals-collector/docs/decisions/agent-reported-active-workspace.md) moves to its owner. Usage cache writes only whitelisted parsed fields, never identity/raw output; failure rounds retain last good provider samples and prevent immediate retries by other sessions. Re-stat stale lock inode/mtime before unlink then retry wx; simultaneous stale takers can still cause an accepted extra round, with atomic writes preventing corruption. No takeover directory/provider registry/plugin system is added.

Private pi-goal 0.54.10 records are validated, not claimed as a released integration API. No public general goal-change event exists: idle command-only changes may wait for another observed boundary. Revisit if a verified public event/API becomes available. New signals belong in a collector module + snapshot field + tests. Additive optional fields remain v1; removing/renaming/meaning changes require v2 channels retaining v1 until migration. Revisit a daemon only for a concrete cross-session external consumer. Shared quota's stale-taker limitation/clock/watch/platform assumptions and actual interactive fidelity remain explicit validation gaps.
