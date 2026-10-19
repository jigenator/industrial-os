# Contributing

Follow the [repository workflow](../../CONTRIBUTING.md) and [project guide](AGENTS.md).

## Toolchain and setup

Use Node.js 22.19+, npm and an existing installed Pi for the loader check. Runtime code is TypeScript ESM with Node type stripping; no compiler, build, formatter or linter is declared. The package keeps its own manifest/lockfile and runtime pi-typesafe dependency. Pi host APIs are peers, not bundled dependencies.

For local-path use and monorepo packaging checks, first run [root setup](../../CONTRIBUTING.md#setup). Pi installs only root dependencies for a git source; the [dependency decision](../../docs/decisions/pane-naming-root-dependency.md) explains the root copy and peer suppression. Extension-local `npm install` below is for its independent test environment, not a git-install requirement.

## Full validation sequence

Run from `pi/herdr-pane-naming/`:

```sh
npm install
npm test
PI_PACKAGE_DIR="$(npm root -g)/@earendil-works/pi-coding-agent" node test/pi-load.mjs
```

1. Install the extension's locked runtime dependencies; review any lockfile diff rather than upgrading packages incidentally.
2. Run Node's test runner with mocked Herdr, title models and TypeSafe transport. No network, credentials, live model calls or live Herdr writes. Preference checks use temporary directories, never live settings.
3. Discover the existing installed host, not a newly installed global package. The real Pi loader uses a temporary `PI_CODING_AGENT_DIR`, so no real TypeSafe key is read; its network guard forbids calls. The probe checks commands, inert modes, fresh default-on, saved-off and saved-model behavior. It is not an interactive Herdr check.

Then run [repository-wide checks](../../CONTRIBUTING.md#repository-wide-checks) and, for packaging, the [isolated install check](../CONTRIBUTING.md#shared-toolchain-facts). Report each as passed, failed or not run. Do not change source or weaken tests to make a move pass.

Interactive validation is separate and requires an authorized disposable Herdr pane plus privacy/cost consent: confirm eligibility, a title change after delivered text/activity, cooldown coalescing, off preserving a manual label, and cancellation/navigation not writing stale names. Never test against an existing work pane implicitly.

## Review and documentation

Trace `index.ts → models.ts`, every event caller and injected test seam before editing shared behavior. Preserve CLI deadlines, pane/terminal validation, title/PR validation and cancellation after awaits. Update the canonical usage/privacy contract in README, event/state contracts in architecture, output in design and engineering gaps in conventions. Map any new guide in AGENTS here and at the root. Keep tests offline and publication fixtures synthetic.

## Verification records

2026-10-19 move, macOS, Node 22.23.0, npm 10.9.8, installed Pi 1.2.0:

- `npm install`: passed, three local packages installed, zero audit vulnerabilities; no runtime/source/test changes.
- `npm test`: passed, **61/61**, zero failed/skipped/cancelled; expected experimental MockTimers warning only.
- Installed-Pi loader command above: passed, exit 0: `PASS: installed Pi loads; fresh profiles start on; saved off and saved model are honoured; no model tools or network.`
- Root peer exclusion and isolated clone/install evidence: [Pi contributing](../CONTRIBUTING.md#move-verification).
- Interactive Pi/Herdr, live Jev/title providers, real git-source install from a pushed branch, Windows and accessibility/appearance checks: **not run**. Local-clone simulation is not a published git install.
