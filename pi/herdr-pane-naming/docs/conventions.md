# Engineering conventions

Follow [root conventions](../../../docs/conventions.md) and the [Pi guide](../../AGENTS.md). This project is TypeScript ESM for Node 22.19+, with types stripped at runtime; no build is required.

## Module and dependency rules

Keep lifecycle, file I/O and Herdr execution in `index.ts`; classification, title generation and parsing stay in `models.ts`. Production imports never cross another extension's boundary. Keep pi-typesafe in this manifest as well as the narrowly approved root dependency; it is not a general shared-dependency policy ([decision](../../../docs/decisions/pane-naming-root-dependency.md)). Do not bundle host Pi packages.

## Trust and state boundaries

- Validate preferences, Herdr JSON, terminal identity and title/PR output before acting. Model output may supply a title and allowed PRs, never a command or pane target. Check: malformed/hostile inputs in `test/naming.test.ts`.
- Preserve serialized writes and epoch/signal checks after asynchronous reads. Cancellation must not become a warning or a stale rename. Check: navigation, abort, deadline and late-result tests.
- Preference saves use same-directory exclusive temporary files and atomic rename with cleanup. Invalid/unreadable settings are not overwritten; `/pane-naming off` still stops this runtime even when saving fails. Check: atomic-write and invalid-preference tests.
- Diagnostics use source-controlled reasons or safe status/network codes. Never log raw SDK errors, rejected titles, request excerpts or keys. Check: `PRIVATE_MARKER` failure tests.

Privacy and billing bounds belong in [the README](../README.md#data-sharing-and-cost); never describe these excerpts as redacted or include private production fixtures in tests.

## Tests

Use injected classifiers/title functions and mocked Herdr/TypeSafe transport in `test/naming.test.ts`. The installed-Pi probe uses a temporary agent directory and prohibits network; no test writes live panes or reads real keys. Exact commands and toolchain evidence belong in [contributing](../CONTRIBUTING.md).

## Adoption gaps

| Gap | Current evidence | Next change and check |
| --- | --- | --- |
| No design-system or Acid / Black adoption | Plain Herdr label text and Pi notifications; no color constants | A separately scoped visual change must use exported tokens and check real host appearance |
| External services receive session excerpts | TypeSafe/Jev plus a Pi title model; no general redaction | Any privacy-policy change needs payload tests and explicit user-facing documentation |
| No static typecheck, formatter, linter or build | `npm test` strips types; no compiler dev dependency | Add tooling only in an approved change, with a reproducible check |
| pi-typesafe 0.9.1 peers target Pi <1 | Root suppresses peer installation; installed Pi 1.2.0 load is checked separately | Revisit on dependency/host updates; rerun clean root and load checks |
| No interactive Herdr/provider qualification | Mocked tests and offline loader only | Authorized disposable-pane check, recording real versions and costs |
| No license | No LICENSE or manifest license | Maintainer license decision before offering reuse |
