# Contributing

Follow the [repository workflow](../../CONTRIBUTING.md) and [project guide](AGENTS.md).

## Toolchain and setup

Use Node.js 22.19+ and npm. This is TypeScript ESM run by Pi/Node type stripping; TypeScript 5.9.3 checks `index.ts` with strict NodeNext/noEmit and `skipLibCheck`. Pi development packages are pinned to **1.0.0**, distinct from the installed **1.2.0** host used for the move's RPC load. No formatter, linter or build command is declared.

Pi supplies runtime peers. This extension has no runtime dependency and does not use the design system; its own tests need only the install below. Whole-monorepo installation also follows [root setup](../../CONTRIBUTING.md#setup).

## Full validation sequence

Run from `pi/session-recap/`:

```sh
npm ci
npm run check
```

`npm ci` preserves the imported lockfile and installs the pinned development host/compiler. `check` runs `npm run typecheck` (`tsc --noEmit`), then `npm test` (Node's runner with `--import ./tests/isolate-agent-dir.mjs`). Do not replace the isolation preloader: it sets `PI_CODING_AGENT_DIR` to an owned temporary directory before imports in every worker and removes it on exit. Model responses are local mocks, with no inference, real credentials or real transcripts. Retention probes instantiate the pinned interactive host without starting terminal rendering; they are not live TUI acceptance.

For focused iteration, use `npm run typecheck` or `node --import ./tests/isolate-agent-dir.mjs --test tests/<source>.test.mjs`. A focused run does not replace the complete sequence. Optional publication inspection is `npm pack --dry-run --json`; it does not install the extension.

Then run [repository-wide checks](../../CONTRIBUTING.md#repository-wide-checks). Packaging checks use the existing installed Pi with temporary agent/cwd directories as in [Pi contributing](../CONTRIBUTING.md#shared-toolchain-facts); no live settings are changed and no command that calls a model is executed. Report automated, installed-Pi load and interactive evidence separately.

Manual validation requires explicit authorization and privacy/cost consent: in a disposable Pi/Herdr TUI, verify a long-away return versus a short switch, idle fallback, deferred settlement, `/recap`/`detailed`, native autocomplete, both pickers (including Escape), keep On/Off in regular/fullscreen, resize/wrapping and reset/reload cleanup. Multi-client Herdr focus is a separate case, not inferred from source.

## Review and documentation

Trace projection → selection/auth → provider response → current-context check → UI. No generated text belongs in model history or settings. Preserve clean-stop filtering, safe error notifications, atomic preference merge/save, request/picker ownership and private-layout fallback. Keep the MIT license and provenance intact. Update user commands/privacy in README, flows/seams in architecture, presentation/focus in design and engineering gaps in conventions; map every guide here and at the root.

## Verification records

2026-10-19 move, macOS, Node 22.23.0, npm 10.9.8:

- `npm ci`: passed, 211 packages installed; deprecated node-domexception warning and **one inherited high-severity dev dependency advisory**. `npm audit --json` exited 1 for `brace-expansion` 5.0.9 inside the pinned Pi host's shrinkwrap (GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p, plus moderate GHSA-q2hr-2g5m-vwhr). No audit fix or pin/source/test change was made during this move.
- `npm run check`: passed, strict project typecheck plus **122/122 tests**, zero failed/skipped/cancelled; includes actual pinned Pi 1.0.0 loader/layout/autocomplete probes, with expected experimental MockTimers warnings.
- Installed Pi 1.2.0 whole-monorepo load and root peer exclusion: [Pi move verification](../CONTRIBUTING.md#move-verification). This proves loading/registration, not its interactive private layout on 1.2.0.
- Interactive Pi/Herdr, live providers, real git-source install from a pushed branch, Windows and accessibility/appearance: **not run**. The MIT LICENSE and imported CHANGELOG are unchanged.
