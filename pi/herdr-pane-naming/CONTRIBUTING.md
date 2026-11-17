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
PI_PACKAGE_DIR="$(realpath "$(command -v pi)" | sed 's|/dist/.*||')" node test/pi-load.mjs
```

1. Install the extension's locked runtime dependencies; review any lockfile diff rather than upgrading packages incidentally.
2. Run Node's test runner with a mocked `setTitle`, title models and TypeSafe transport. No network, credentials, live model calls or real terminal titles. Preference checks use temporary directories, never live settings.
3. Discover the existing installed host, not a newly installed global package. The real Pi loader uses a temporary `PI_CODING_AGENT_DIR`, so no real TypeSafe key is read; its network guard forbids calls. The probe checks commands, inert modes, fresh default-on, saved-off and saved-model behavior. It is not an interactive Herdr check. `$(npm root -g)` names the host only when `pi` was installed under the current npm's global prefix; with a version manager such as Volta it can name a folder without Pi.

Then run [repository-wide checks](../../CONTRIBUTING.md#repository-wide-checks) and, for packaging, the [isolated install check](../CONTRIBUTING.md#shared-toolchain-facts). Report each as passed, failed or not run. Do not change source or weaken tests to make a move pass.

Interactive validation is separate and requires an authorized disposable Herdr Desktop space plus privacy/cost consent. Load this checkout without changing global settings: `pi --no-extensions -e <checkout>/pi/herdr-pane-naming/index.ts` (with `-e` for pi-typesafe's extension if `/typesafe` is wanted). Confirm eligibility and a name change after delivered text/activity with `herdr-app ls`/`hc get <terminal>` and a `herdr-app shot`; then cooldown coalescing, off leaving the name, and cancellation/navigation not writing stale names. Never test against an existing work pane implicitly.

## Review and documentation

Trace `index.ts → models.ts`, every event caller and injected test seam before editing shared behavior. Preserve the command-free, target-free title write, title/PR validation and cancellation after awaits. Update the canonical usage/privacy contract in README, event/state contracts in architecture, output in design and engineering gaps in conventions. Map any new guide in AGENTS here and at the root. Keep tests offline and publication fixtures synthetic.

## Verification records

2026-10-19 move, macOS, Node 22.23.0, npm 10.9.8, installed Pi 1.2.0:

- `npm install`: passed, three local packages installed, zero audit vulnerabilities; no runtime/source/test changes.
- `npm test`: passed, **61/61**, zero failed/skipped/cancelled; expected experimental MockTimers warning only.
- Installed-Pi loader command above: passed, exit 0: `PASS: installed Pi loads; fresh profiles start on; saved off and saved model are honoured; no model tools or network.`
- Root peer exclusion and isolated clone/install evidence: [Pi contributing](../CONTRIBUTING.md#move-verification).
- Interactive Pi/Herdr, live Jev/title providers, real git-source install from a pushed branch, Windows and accessibility/appearance checks: **not run**. Local-clone simulation is not a published git install.

2026-11-17 Herdr Desktop port (branch `fix/desktop-pane-naming`), macOS, Node 22.23.4, npm 10.9.9, installed Pi 1.5.2, herdr-app 0.1.15, hc 0.1.20:

- Mechanism: Herdr Desktop's `herdr.d.ts` gives `panes()[i].title` as "the terminal's title (what the program set)"; `herdr-app commands` has `space.rename` and `tab.rename` but no terminal or pane rename; `hc --help` has no title setter. Pi 1.5.2's extension UI has `setTitle`, which writes OSC 0 with control characters replaced; Pi itself sets `π - [<session name> - ]<folder>` only on session bind, reload and session-name change.
- `npm install`: passed, zero audit vulnerabilities; the lockfile changed only for the 0.3.0 version.
- `npm test`: passed, **60/60**, zero failed/skipped/cancelled.
- Installed-Pi loader command above: passed, exit 0, same PASS line.
- Live, in one throwaway Desktop space `pane-naming-test` over a temporary folder: `pi --no-extensions -e <worktree>/pi/herdr-pane-naming/index.ts -e <worktree>/pi/droid-header/src/extension.ts`. Before the turn `hc get` showed the title `π - pane-naming-test`; after one `list the files here` turn it showed `Listing files`, and `herdr-app shot` showed the sidebar Agents row change from `π…` to `Lis…`. The space was then closed. It used the real TypeSafe key and title model (one Jev check and one title request), and Pi saved its session file in the real agent folder.
- Cooldown coalescing, off, navigation, a pushed git-source install, Windows and accessibility: **not run**.
