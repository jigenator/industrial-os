# Pi Signals Collector

One TUI-only, in-session data producer for Industrial OS displays. It collects Launch/agent-reported Active, Git/worktree/PR state, ROOT/settlement, current phase and pending question, model/thinking, context reserve/usage, selected-branch CMP, optional pi-subagents AU, validated private pi-goal records and optional CodexBar quota. It does not install a footer or write Herdr tokens.

## Install

Node.js 22.19+ and an installed Pi host are required (verified with Pi 1.0.4). Git, authenticated `gh`, CodexBar and pi-subagents are optional. Missing/failed collection means unknown/unavailable, never clean or zero. No collection runs in print/JSON/RPC child processes.

Select the collector alongside any displays in the one repository entry in Pi's `packages` array; see [Pi install](../README.md#install):

```json
{ "source": "git:github.com/jigenator/industrial-os", "extensions": ["pi/signals-collector/src/extension.ts", "pi/status-bar/src/extension.ts"] }
```

From a checkout, load for one invocation with `pi -e pi/signals-collector -e pi/status-bar` from the repository root after its `npm install` (the footer needs the linked design system). Either collector/display order works. Load the collector only once; configuring both local and git sources for it would duplicate it. This package has no local runtime install/dependencies.

`set_active_project({ path })` belongs here. It signals before a deliberate project/worktree move and again when switching back, not for incidental reads. Relative paths resolve from Launch. Successful `{ version: 1, path }` tool-result details restore unchanged on the selected session branch (including existing status-bar sessions). It changes only the display: never cwd, tool behavior or loaded instructions/resources. See [the decision](docs/decisions/agent-reported-active-workspace.md).

## Consumer guide

The [canonical v1 contract](docs/contract.md) contains the complete wire types, failure meanings and cache protocol. Use only Pi's event bus, never import this extension:

```ts
const off = pi.events.on("signals-collector:v1:snapshot", accept);
const offReady = pi.events.on("signals-collector:v1:ready", (ready) => {
  if (ready.version === 1 && ready.sessionId === ctx.sessionManager.getSessionId()) request();
});
function request() {
  let received = false;
  pi.events.emit("signals-collector:v1:request", { reply(snapshot) { received = true; accept(snapshot); } });
  if (!received) clearToUnknown();
}
request(); // after subscribing, on start; also on ready
// Dispose off()/offReady() on session/UI replacement or shutdown.
```

`accept` must validate version 1 and the **live** session ID, ignore unknown fields/stale samples, and sanitize raw bounded free text for its own sink. Absence means unknown, not zero/clean. Replies are synchronous and consumer-owned copies; do not retain a callback as a future subscription. Consumers format durations with their own clock, not a collector-formatted string.

Future panels/dashboards in the same Pi session use this contract. Add a signal in a cohesive collector module, extend the snapshot field and its boundary/contract tests; do not add a speculative registry/plugin system. Additive optional fields stay v1; remove/rename/meaning changes need v2 channels while retaining v1 until migration. A dashboard outside the Pi session is a concrete reason to revisit a daemon, not to create one now.

## Limits

- Git refresh is per session, every 15 seconds and after tools. PR lookup caches for 60 seconds per repository/branch. No render does I/O.
- CodexBar's parsed cache is machine-wide under `$XDG_CACHE_HOME/industrial-os/signals-collector/usage.json` (default `~/.cache`), atomic and mode 0600. Sessions watch its directory and contend on one exclusive lock; a winner fetches all three providers when the last round is five minutes old, others wait. Failures retain last good provider samples and are cached. No raw account/identity/output fields persist. The [contract](docs/contract.md#compatibility-and-limits) records the accepted simultaneous stale-taker extra-fetch race.
- AU is active work including pending/workflow containers, **not** an exact running-agent count. Optional RPC timeouts cannot cancel work already started inside its owner.
- pi-goal collection validates the inspected private 0.54.10 record on observed lifecycle/message/tool/input boundaries. An idle `/goal` command-only update can wait until another boundary. No general public goal-change event is claimed.
- Active can be stale if the agent forgets its declaration. No automatic tool-path inference, daemon or cross-session fleet/goal data.
- Live providers, interactive Pi/Herdr and Windows are unverified; automated fixtures are offline.

## Project guides

[AGENTS](AGENTS.md) · [Contributing](CONTRIBUTING.md) · [Mission](docs/mission.md) · [Architecture](docs/architecture.md) · [Conventions](docs/conventions.md) · [Design](docs/design.md) · [Contract](docs/contract.md)

No license has been selected; public visibility does not grant reuse. See [repository licensing](../../README.md#licensing).
