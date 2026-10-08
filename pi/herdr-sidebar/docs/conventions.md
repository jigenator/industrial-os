# Engineering conventions

The [repository-wide conventions](../../../docs/conventions.md) and the [Pi guide](../../AGENTS.md) apply. This guide adds only this project's rules.

## Project profile

Pi Herdr Sidebar, in `pi/herdr-sidebar/`, is a TypeScript ESM Pi package for Node.js 22.19+, run by Node's type stripping. Runtime code is `src/extension.ts`, `src/tokens.ts`, `src/snapshot.ts`, `src/sender.ts` and `src/herdr-client.ts`. Pi supplies the host and TUI peers. Tests use Node's test runner against the globally installed Pi and a fake Herdr server.

Scope reviewed: the complete source and tests at the revision that added the project, Pi 1.0.4's installed extension types and event bus, and Herdr 0.9.3's source and socket documentation for every method used.

## Module and dependency rules

**Rule:** dependency direction is `extension → snapshot, tokens, sender, herdr-client`; `sender` takes a request function and imports only the key list and reply type; `tokens` imports only `snapshot` types, Node `path` and Pi TUI's `visibleWidth`; `snapshot` and `herdr-client` import no Pi module. **Reason:** the builder and sender stay testable without Pi or a socket. **Check:** review imports.

**Rule:** display only. The extension's inputs are the snapshot channels and Herdr's status for its own pane. It never spawns a process, reads a file, or writes anything except Herdr pane tokens and `herdr:blocked`. **Reason:** collection belongs to the signals-collector, once per session; a second collector would duplicate work and disagree. **Check:** `grep -n "child_process\|node:fs" src/*.ts` finds nothing.

**Rule:** the collector is another project, so its snapshot type is not imported; `src/snapshot.ts` restates the consumed subset and validates it. **Check:** review imports against the [snapshot inputs](architecture.md#inputs).

## Functions and state

**Rule:** `buildTokens` and `nextTokenChange` are pure functions of their input; the clock, home directory and Herdr state are arguments. **Check:** `test/tokens.test.ts` passes fixed times.

**Rule:** one runtime per session owns every subscription, connection and timer, and `dispose` releases them all on shutdown, reload and replacement. Asynchronous callbacks check that their runtime is still current. Timers are unref'd; the status socket is unref'd. **Check:** `test/extension.test.ts` asserts no request and no subscription after shutdown.

**Rule:** time-based values re-render only when their text would change, and at most once a second. **Check:** the timing case in `test/extension.test.ts`.

## Types and validation

**Rule:** the snapshot and every Herdr reply are untrusted. Malformed fields become unknown; text is stripped of terminal/bidi controls and trimmed before it is measured; every value is bounded in cells and characters. **Check:** `test/tokens.test.ts` malformed, hostile and budget cases.

## Errors and diagnostics

**Rule:** Herdr failures never reach Pi as errors or block it: every request has a deadline, shutdown has a total deadline, and nothing throws. A failure is still a failure: the sender records the cause and marks its state unsynced, and the status becomes unknown while the subscription is down. **Check:** `test/sender.test.ts`, `test/herdr-client.test.ts`.

## Tests

- `test/tokens.test.ts`: every rule of the token contract, the snapshot validation, and the key list read from [the contract](token-contract.md).
- `test/sender.test.ts` and `test/herdr-client.test.ts`: the modules against `test/fake-herdr.ts`.
- `test/extension.test.ts`: the real installed Pi loader, runner and event bus, a fake collector extension loaded before or after, and the fake Herdr server.
- `test/signals.test.ts`: both real collector/sidebar package load orders through Pi's loader, offline Git/gh/CodexBar fixtures, real usage/context shapes and lifecycle-to-token assertions. Test-only sibling package paths follow status-bar's composition precedent; production imports never cross project boundaries.

**Rule:** no test contacts a live Herdr. Each extension case sets the Herdr environment to the fake server and restores it. **Rule:** `test/fake-herdr.ts` models only behavior read in the Herdr source of the version in use, and cites it.

## Dependencies

No runtime or development dependency. Pi's packages are `"*"` peers, resolved in tests from the global installation through `PI_HOST_ROOT`, as in status-bar.

## Adoption gaps

| Gap | Evidence | Next change | Verification |
| --- | --- | --- | --- |
| No type check, formatter, linter or build | Tests run by type stripping; no compiler is installed for this project | Add a pinned compiler with a lockfile when the maintainer approves the tooling | Proposed; not implemented |
| No lockfile or development pin of Pi | Tests use the globally installed Pi, as status-bar does | Pin Pi as development dependencies in one reviewed change if a reproducible run is wanted | Record the installed Pi version with each run |
| No interactive Pi/Herdr record | The fake server and RPC load prove neither rendering nor Herdr's acceptance | Run the manual step in [contributing](../CONTRIBUTING.md#full-validation-sequence) | Manual; not run |
| No live collector/provider qualification | Real collector/sidebar composition is covered offline in both orders; this is not interactive/provider evidence | Run the manual step with live inputs when authorized | Manual; not run |
| No license | No `LICENSE` or `license` field | Resolve with the repository's open license decision | Review the manifest |
