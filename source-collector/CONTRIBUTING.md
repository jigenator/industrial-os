# Contributing

Follow the [root workflow](../CONTRIBUTING.md) and [agent guide](AGENTS.md).
Run all commands here, not from the repository root. No root install is needed.

## Toolchain and validation sequence

Bun 1.4.4; exact direct dependency versions are in package.json and bun.lock.
TypeScript 7.1.0-beta is the native checker. Bun's prepare step runs
`effect-tsgo patch` from @effect/tsgo 0.56.0; do not skip it. oxlint uses the pinned
oxlint-tsgolint type-aware engine. jq is an optional runtime prerequisite for jq
sources and is installed in the recorded test environment.

```sh
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun run format:check
bun test
bun bin/source-collector.ts check examples/sources/fake
bun bin/source-collector.ts check examples/sources/jq
bun bin/source-collector.ts check examples/sources/todo
```

Scripts expand to tsc --noEmit, oxlint --type-aware --deny-warnings,
oxfmt --check . and bun test. `bun run format` applies oxfmt; its config excludes
only the scratchpad Markdown fixture because inserting blank lines between its
metadata comments and items changes meaning. Do not format that fixture manually.
The lockfile is generated only by Bun install; deliberately changing a dependency
requires a non-frozen install, lockfile review and this full sequence again.

Then run the [repository-wide checks](../CONTRIBUTING.md#repository-wide-checks).
There is no dashboard or Herdr-load check for this service. Never qualify it with
real source configs, account access, launchctl, service installation or writes to
live config/memory directories.

## Tests

All fixtures use fake data and temporary storage. The tests cover:

- config isolation, duplicates, strict schemas, relative/absolute/~/ roots and
  checklist paths under a temporary HOME;
- watched/idle timing, immediate overdue admission, 20 slots, no self-overlap,
  dropped ticks, exponential capped backoff and success reset using TestClock;
- command success/nonzero/invalid output, closed stdin, minimal env, jq and argv
  transforms, output caps, action argv and actual SIGTERM → SIGKILL escalation;
- scratchpad parsing, local timestamps, line-preserving done/reopen/add and
  concurrent-edit retry/conflict;
- Migrator up/down, unknown/newer schema refusal, run uniqueness/retention,
  interrupted history, diff/ledger rollback and shipped replay deduplication;
- ages/fresh/waiting/handled counts, null unknowns, civil week blocks and D5;
- real Unix JSON-RPC lines and typed CLI, source reload, auth clearing, disable,
  stale restart, single-instance refusal, engine-not-running and drain;
- bounded socket input, exact launchd bytes and mocked install/uninstall without
  starting anything or deleting runtime data.

The escalation test intentionally takes about ten seconds on a real native clock.
This is separate from virtual-clock scheduler evidence. Tests never invoke a real
service manager or network API.

## Foreground smoke

Use a copy so todo edits never touch the committed fixture. Resolve the real Bun
executable before changing HOME: a version-manager shim can otherwise reject its
untrusted config under a throwaway HOME. Keep the socket path short on macOS.

```sh
BUN=$(bun -e 'console.log(process.execPath)')
PROJECT=$PWD
SANDBOX=$(mktemp -d /tmp/sc-demo.XXXXXX)
cp -R examples "$SANDBOX/config"
mkdir -m 700 "$SANDBOX/runtime"
export HOME="$SANDBOX"
export PATH="$(dirname "$BUN"):/usr/bin:/bin"
export SOURCE_COLLECTOR_HOME="$SANDBOX/runtime"
export SOURCE_COLLECTOR_CONFIG="$SANDBOX/config"
"$BUN" "$PROJECT/bin/source-collector.ts" run >"$SANDBOX/out" 2>"$SANDBOX/log" &
ENGINE=$!
# Wait for feed.sock and initial source observations, then:
"$BUN" "$PROJECT/bin/source-collector.ts" get
"$BUN" "$PROJECT/bin/source-collector.ts" refresh fake
"$BUN" "$PROJECT/bin/source-collector.ts" todo done 'todo:2026-10-20 12:00:00#demo-session'
"$BUN" "$PROJECT/bin/source-collector.ts" get
"$BUN" "$PROJECT/bin/source-collector.ts" service stop
wait "$ENGINE"
```

This stop path uses RPC only, not launchctl. SIGTERM/SIGINT also drain. Use a
subshell for these exports if retaining the interactive shell's HOME/PATH matters.
Inspect then remove only the throwaway sandbox when finished.

## Verification record

2026-10-23, isolated local macOS run, Bun 1.4.4:

| Check                                                                                           | Result                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| bun install --frozen-lockfile                                                                   | Pass; 21 installed packages unchanged; Effect patch hash matched                                                                                          |
| bun run typecheck                                                                               | Pass; native TypeScript 7.1 beta through the Effect-patched executable                                                                                    |
| bun run lint                                                                                    | Pass; zero warnings/errors, type-aware checks enabled                                                                                                     |
| bun run format:check                                                                            | Pass; deliberate scratchpad exclusion above                                                                                                               |
| bun test                                                                                        | Pass: 36 tests, 0 failures, 0 skips; 177 assertions                                                                                                       |
| check fake / jq / todo                                                                          | Pass: validated fixed command output, real jq transform and two open checklist items                                                                      |
| Foreground smoke                                                                                | Pass: all three sources ok; 4 items → 3 after done; rev advanced; one you shipment; alerts []; refresh admitted; RPC stop drained, exit 0 and PID removed |
| Root links/map/CLAUDE/whitespace/publication review                                             | Pass; recorded with final integration checks                                                                                                              |
| Mermaid rendering                                                                               | Not run; no local renderer available                                                                                                                      |
| Live account sources, real launchd install/start/stop/uninstall, Herdr UI, online advisory scan | Not run; outside this task's allowed validation                                                                                                           |

An initial shell smoke attempt hit a version-manager shim trust error after HOME
changed. No trust setting was modified. Repeating with the resolved Bun executable
and a minimal PATH produced the successful smoke above. Earlier failed tests and
format checks found the optional-agent GNU syntax mismatch, stop acknowledgement
scope lifetime, and formatter-sensitive checklist fixture; the fixes are in the
final passing suite.

### Agent CLI and engine log follow-up

2026-10-23, isolated local macOS run, Bun 1.4.4:

| Check                                                                | Result                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun install --frozen-lockfile`                                      | Pass; 21 installs checked, no dependency changes; Effect patch hash matched                                                                                                                                                                                           |
| `bun run typecheck`                                                  | Pass                                                                                                                                                                                                                                                                  |
| `bun run lint`                                                       | Pass; type-aware, deny warnings                                                                                                                                                                                                                                       |
| `bun run format:check`                                               | Pass                                                                                                                                                                                                                                                                  |
| `bun test`                                                           | Pass; 39 tests, 0 failures, 342 assertions                                                                                                                                                                                                                            |
| `bun bin/source-collector.ts check examples/sources/fake`            | Pass; validated fixed fake output                                                                                                                                                                                                                                     |
| `bun bin/source-collector.ts check examples/sources/jq`              | Pass; real jq transform                                                                                                                                                                                                                                               |
| `bun bin/source-collector.ts check examples/sources/todo`            | Pass; two open checklist items, no writes                                                                                                                                                                                                                             |
| Foreground smoke                                                     | Pass; copied fixtures, temporary HOME/runtime/config only; JSON item listing, plan/pin/handled/look with agent session, clear/undo, refresh and todo done; lifecycle JSON in collector.log and foreground stderr; stdout clean; RPC stop drained, exit 0, PID removed |
| Root links/map/CLAUDE/whitespace/publication review                  | Pass; changed local links and anchors resolved, guidance inventory mapped, tracked CLAUDE imports exact; no private material or generated clutter                                                                                                                     |
| Mermaid rendering                                                    | Not run; no diagram changed                                                                                                                                                                                                                                           |
| Live engine/accounts, real launchd installation/start/stop, Herdr UI | Not run; deliberately outside authorized validation                                                                                                                                                                                                                   |

Focused tests additionally capture exact act requests for all five commands with
human, bare-agent and named-session attribution, plus pin off/handled undo;
invalid plan exits 2 without stdout, absent engine exits 1 for every new command.
Real socket integration reads back overlays and the look cursor, and confirms
JSON item lines round-trip multiline/control-bearing titles without emitting
terminal control bytes. Log tests verify
creation, 0600/0700 permissions, rotation order and count, append across reopens,
size caps/truncation and refusal of symlink destinations. Existing action argv
execution tests remain in the full suite; no live action was invoked.

Early focused checks found required-by-default Boolean flags and a narrowing
constraint in Argument.withSchema; explicit false defaults and handler-level
Plan decoding fixed both. Handler decoding also avoids Effect CLI's preexisting
parse-error auto-help on stdout for invalid plan values. Other parse failures can
still print help to stdout; that inherited CLI-wide behavior was not changed.

## Simplification review

Reviewed the full change against the assigned base. Removed one-use transport and
Schedule wrappers, made package.json the version source, shared command stream
capture with log truncation, and used the same scheduler admission for actions and
fetches. Snapshot reads now share one transaction; successful observations publish
items, status and run completion together. Used
Effect RPC. No adapter registry, generic service framework, queue, recovery engine,
root dependency or real account config was added. The final contract pass also
put checklist output through the same SourceOutput decoder as command output
and replaced its diagnostic raw-size placeholder with the actual file size.
