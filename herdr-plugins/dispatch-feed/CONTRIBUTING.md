# Contributing

Follow the [root workflow](../../CONTRIBUTING.md). Requires Bun 1.4.4, npm/Node 22
for the root design-system link/checks, Python 3 for PTY verification, and macOS.
Run root `npm install` once. No live engine or live Herdr is needed by tests.

## Validation sequence

From this directory:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun run format:check
bun test
python3 test/pty_smoke.py
```

The frozen install writes only this project's dependency directory; the lockfile
must not change. Typecheck is strict; lint is type-aware with no warnings. Tests
use fake records and a temporary Unix socket, never inherited service targets.
They cover decoder unknowns, all health states, inverse staleness, week mapping,
keys/actor/composite ids, add/cancel/conflict, add-list choice, snapshot
done/reopen, focus/new hold, read-only enforcement, offline retention/recovery,
bounded timeout/cancel, input fragmentation and motion-off. The PTY check runs the actual entrypoint against a
fake socket, tests add, hover/click, short/tiny resize, idle, q/Ctrl-C and exact
terminal restoration. It resolves the actual Bun executable before replacing
HOME so runtime-manager shims cannot prompt for unrelated trust.

Then run `cd ../../design-system && node --test`, its documented snapshot width
sequence, and the [repository checks](../../CONTRIBUTING.md#repository-wide-checks).

## Isolated Herdr check

Use the [Whiteboard isolation procedure](../whiteboard/CONTRIBUTING.md#isolated-herdr-check),
never live Herdr. Record SHA-256 of live config.toml/plugins.json before and after.
Every command starts `env -i` with temporary HOME/XDG config/state and an explicit
short throwaway HERDR_SOCKET_PATH. Link only a temporary plugin copy whose pane
command explicitly supplies a fake SOURCE_COLLECTOR_HOME and the resolved Bun
executable/worktree entrypoint. Do not rely on the host passing inherited env.
Start/stop only that server. Create a workspace, invoke open and open-tab, read
pane text and ANSI, attach a sized PTY client, dismiss welcome, exercise keys and
mouse through it, resize, quit and reopen. Stop owned children before cleanup.

## Visual check

Render fake data at 118×54 through the real pure renderer. An external HTML/canvas
capture harness can reconstruct those cells for headless Chrome comparison with
the approved card, but no browser presentation layer or screenshot belongs in
this repository. Keep evidence in the assignment's external evidence directory.
Compare layout/characters/colors and actual terminal interactions separately.
A permitted live-data check must use a read-only client sending get only; titles
and screenshots remain private. No act/look/refresh is authorized on live data.

## Verification record

Automated and native results are recorded after the validation run; none of the
old Whiteboard/Spaces records establishes this pane's support. No live Herdr
installation, physical pointer test, screen reader or broad compatibility claim
is made.

### Initial pane validation

macOS, Bun 1.4.4, Node 22.23.4, Herdr 0.9.5 (minimum manifest version 0.9.3).

**Passed**

- Frozen install (13 installs, no lockfile change), strict typecheck, type-aware
  lint with no warnings, format check; `bun test`: **17 passed, 282 assertions**.
  `bun audit`: no vulnerabilities reported. Pinned package manifests declare
  MIT for Bun types/Oxc tools and Apache-2.0 for TypeScript; no runtime dependency.
- `python3 test/pty_smoke.py`: **PTY SMOKE OK**. Three isolated executions: q and
  Ctrl-C with motion off, q with motion on. Fake socket, actor/input, bracketed
  paste normalized to one line without implicit submit, hover/click, idle versus
  animation scheduling, resize to 40×12 and 1×1, exact termios restoration and
  mouse/focus/paste/cursor/autowrap/alternate-screen reset bytes.
- Design system: **432/432 checks**, documented showcase/storybook width snapshots.
  Root link inventory/anchors and every CLAUDE entrypoint passed; source imports
  and publication contents reviewed; both whitespace checks passed. Root npm
  manifests and source-collector files are unchanged.
- External Chrome screenshots compare the approved card A and the 118×54 fixture,
  without the excluded rail. Iterated count face, five-unit spacing, neutral
  aliases, background gradient/grid contrast, list columns and footer hints.
  Screenshot paths remain only in the external assignment report, not in Git.
- Isolated Herdr, every command under env -i with temporary HOME/XDG/socket and a
  fake engine explicitly injected into a temporary manifest: link accepted;
  open created a right split; open-tab created a second tab. Attached 180×54
  client: typed add reached the fake engine, hover/click source filter worked,
  ANSI readback contained truecolor, resize from list-only to a stats layout
  repainted, m produced changing native ANSI frames and motion-off settled.
  Targeted q closed owned panes; reopening worked. Server/client/fake socket
  stopped. Live config.toml and plugins.json SHA-256 were unchanged.
- Authorized live engine inspection used a read-only client, get only: decoded
  five sources and 32 items and rendered a private cell snapshot. No live act,
  look or refresh, no live Herdr/config/registry write or installation.
- Small deterministic render measurement (118×54, ten fixture items, 120 frames):
  median 6.28 ms, p95 17.94 ms on the development machine. Not a large-source or
  terminal-throughput performance claim.

**Fixed during development**

The wire decoder was checked against Effect 4.0.6's actual serializer rather than
only a generic fake: typed failures are Cause arrays and void refresh may omit
result. Other regressions fixed compact/large-count clipping, stale recovery
messages, visible conflict feedback with preserved draft, source-removal/add
races, malformed mouse recovery and literal bracketed paste. The PTY's initial
runtime-manager shim trust prompt was avoided by resolving Bun before temporary
HOME. The isolated client needed welcome/initial settings dismissed before input.

**Host finding / not claimed**

After CLI open-tab, a client q closed the earlier split while the tab pane was
reported focused; explicit pane-targeted keys closed the intended new pane. This
matches the existing Whiteboard focus-discrepancy record; not fixed here. No live
Herdr use, physical pointer/font/keyboard or screen-reader certification, actual
macOS URL launch, GitHub plugin install/build, Linux, or Herdr 0.9.3 run. Mermaid
rendering was not run (no existing renderer available); diagram source reviewed.
Ambient load clocks are now the exact pure v20 projection, separately oracle-tested in the design system. Final taste/fidelity acceptance remains the maintainer's decision.

### Measured text and design-system reuse

macOS, Bun 1.4.4, Node 22.23.4, after rebasing onto the measured-slot work.

**Passed — automated:** frozen install (13 installs, no lockfile change), strict
typecheck, type-aware lint with no warnings, format check; `bun test`: **25
passed, 812 assertions**, including em dashes, curly quotes and accents shown as
themselves, a CJK title and an emoji/ZWJ title clipped on whole graphemes, ESC,
bidi and lone-surrogate titles shown as `?` without stopping the frame, aligned
STATUS columns in measured cells, the draft's measured tail with grapheme
Backspace, and wide-grapheme diff repaints. `python3 test/pty_smoke.py`: **PTY
SMOKE OK**. Design system 567/567.

**Visual:** the 118×54 fixture frame keeps identical text. Colors move to v20's
exact bone (#e6e2d3) and rule (#3a3f46), including the band rules' trailing dashes;
the dim bone follows. Small deterministic render measurement (118×54, 120 frames):
median 7.15 ms, p95 8.36 ms on the development machine; not a throughput claim.

**Not run:** isolated Herdr, physical terminals' emoji and ambiguous-width
rendering, which may differ from Bun's `stringWidth`.

### Source include list

2026-10-31, isolated macOS run, Bun 1.4.4:

- Passed: root npm setup/boundary checks, frozen install (no manifest/lockfile
  change), strict typecheck, type-aware lint, format check and `bun test`: 27
  tests, 867 assertions, no failures.
- Passed: `python3 test/pty_smoke.py`, including scoped initial/follow-up reads,
  flag-over-env precedence and explicitly named todo.add target, alongside its
  existing input/resize/idle/motion/exit/terminal-restoration checks.
- Fake-socket plain CLI tests cover no list, environment, trimmed/empty entries,
  duplicates, flag precedence including an empty flag, and missing flag values.
  Transport tests confirm repeated get scope and unchanged act/refresh payloads.
- Passed: scoped plain output against a temporary real engine with copied source
  fixtures; source statuses/items and plan/week counts agree with the RPC scope.
- Passed: design-system `node --test` (647 tests), documented showcase widths
  120/100/80/48/40/23 and storybook widths 120/80/48/24/12; root local-link/anchor,
  guidance inventory, CLAUDE import, whitespace and publication reviews.
- Not run: isolated/live Herdr, live engine, physical terminal or Mermaid render.
  No renderer/lifecycle behavior or diagram changed; no new host-support claim.
- Simplification pass: parse the list once at startup and attach it only at the
  existing transport get boundary, shared by interactive/plain modes. Shared the
  test subprocess helper. Read app.ts: every todo.add already names the checklist
  chosen from its snapshot; no engine-wide fallback is used or newly introduced.

### Done to-dos from the snapshot and named add target

macOS, Bun 1.4.4, Node 22.23.4, with the engine change that adds `doneAt` and
`todo.add` source.

**Passed — automated:** frozen install (13 installs, no lockfile change), strict
typecheck, type-aware lint with no warnings, format check; `bun test`: **26
passed, 822 assertions**. They cover `doneAt` decoded, absent and rejected when
not ISO; a snapshot done item rendered `× TODO [done] …` with DONE status and
dimmed title cells, still selected, `x` sending `todo.reopen` with its composite
key, and other triage refused until reopened; the add target as the only list,
the selected item's list among two, a calm refusal when the selection is in
neither, and no list at all, each with `source` sent and no key.
`python3 test/pty_smoke.py`: **PTY SMOKE OK**. Design system 567/567 and its
plain showcase/storybook width snapshots exited 0.

**Not run:** isolated Herdr and any live engine. End-of-day removal is the engine's
rule and is tested there by injected times; the pane only renders what it is given.
