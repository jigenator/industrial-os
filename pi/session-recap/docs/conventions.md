# Engineering conventions

Follow [root conventions](../../../docs/conventions.md) and the [Pi guide](../../AGENTS.md). This is TypeScript ESM, run by Pi/Node type stripping, with a strict NodeNext no-emit check. Host packages are wildcard peers, pinned to 1.0.0 only for development; no runtime dependency is bundled.

## Boundaries and state

- Use Pi's canonical session projection and latest persisted context edits, never raw session files to reconstruct deleted context. Detailed mode reprojects the active branch excluding summaries; check `tests/context.test.mjs` and `tests/detailed.test.mjs`.
- Keep recap text UI only: never append entries, send user/custom messages, change the main model or save generated text. Check no-write assertions and actual pinned-host retention tests.
- Preserve request/picker AbortController ownership and context-fingerprint checks. A late response or cancelled picker must not write or update a new session. Check lifecycle, projection-validation and global-model tests.
- Validate settings at the read/write boundary, reread after an awaited dialog, then write exclusively to a temporary file and rename atomically. Keep model/keep independent; failed saves are errors and preserve prior settings. Check `tests/global-model.test.mjs`.
- Show only safe HTTP/network failure reasons through Pi notifications, never raw provider messages or console output. Check `tests/truncated-response.test.mjs` and detailed failure cases.

## Tests and dependencies

Exact commands live in [contributing](../CONTRIBUTING.md). All model responses are local mocks; `tests/isolate-agent-dir.mjs` sets an owned temporary agent directory before imports in the runner and each worker. Do not remove that isolation or read real credentials/transcripts. Tests deliberately probe pinned host internals for UI layout; preserve their meaning rather than weakening assertions to accommodate a new host.

## Adoption gaps

| Gap | Evidence | Next change and verification |
| --- | --- | --- |
| No design-system or Acid / Black adoption | Pi theme accent/dim; native wrapped text, not shared plates | Separately approved visual migration through exported subpaths, then host appearance checks |
| Private Pi UI seam | Retention inspects container shape; tests deep-import pinned host files | Revisit when Pi offers a public transcript append seam; rerun retention tests on host upgrades |
| Development host differs from installed host | Suite pins 1.0.0; RPC load uses 1.2.0 | No claim that 1.2.0 interactive layout is qualified; separately test it before broad support claims |
| Sensitive provider input, no hard total input budget or extension deadline | Projected messages can contain images/tool excerpts; detailed mode covers the whole available branch | Any budgeting/privacy/timeout change needs explicit scope and regression coverage |
| No formatter, linter or build | Only no-emit typecheck and tests; library checks skipped by tsconfig | Add only for an approved need; keep check claims precise |
| No live Pi/Herdr/provider qualification for this move | Offline pinned-host tests and isolated installed-host RPC only | Authorized manual check with versions and privacy/cost consent |
