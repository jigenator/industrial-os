# Engineering conventions

## Project profile

Industrial OS is a public monorepo of independent projects that share one product and one visual language: today the terminal design system in `design-system/` and the Pi extensions in `pi/claude-interrupt/` and `pi/status-bar/`. The projects use different toolchains, and future ones may use different languages, so these rules are written to hold in every language. Rules that depend on a toolchain live in the project: the design system's in [its conventions](../design-system/docs/conventions.md), the Pi extensions' shared rules in [the Pi guide](../pi/AGENTS.md), and each extension's in its own conventions: [claude-interrupt](../pi/claude-interrupt/docs/conventions.md) and [status-bar](../pi/status-bar/docs/conventions.md).

Scope reviewed: the full source and test trees of the design system and claude-interrupt, every import statement in them, both of their manifests and test commands, the Git history of the move of claude-interrupt, and the existing guides, at the revision that introduced this version of the guide. pi-status-bar was read in its own repository as the reference for the visual style, not audited; when it moved into `pi/status-bar/`, its manifest, test command, imports, and guides were reviewed, not its full source. Herdr was not inspected. Rules marked proposed are targets, not a claim that the code already conforms.

## Engineering principles

| Rule | Real example/path | Reason | Check |
| --- | --- | --- | --- |
| Progressive disclosure: scan the root map, then read the project guide, then only the sections the task needs | [AGENTS.md](../AGENTS.md) routes design-system work to [its guide](../design-system/AGENTS.md) and extension work to [the Pi guide](../pi/AGENTS.md), which routes to the extension's own guide | A reader working in one project should not need the other project's manuals | Review check: trace an element change and an extension change from the root; neither needs the other project's guides |
| YAGNI: add a project, package, dependency, or root mechanism only for a current need | There is no root manifest, workspace, or test command; see [the decision](decisions/standalone-packages.md). `pi/claude-interrupt` has no runtime dependencies | Each project stays installable and testable on its own | Review check: name the current need for every dependency, adapter, or root addition |
| KISS: reuse the platform, the host, or a conforming module before writing a replacement | The design system uses Node's test runner and standard library; claude-interrupt uses the Pi host's width and color helpers rather than its own | Fewer moving parts to keep correct | Review check: compare the simplest correct alternative |
| Single source of truth: one canonical home per rule, command, and value | Commands live in each project's contributing guide; the visual language in [design](design.md); palette values in the extensions' constants with `design-system/foundation/palette.mjs` as a mirror ([decision](decisions/extension-colors-take-precedence.md)) | A rule change should not require editing parallel copies | Review check: change a rule and follow its links; repository-wide checks 2 and 3 |

## Module and dependency rules

**Rule:** no project imports another project's code. Inside a project, callers use the project's declared public entry points, never deep imports into another module's internals. No cycles, and no shared or `common` folder created to hide one.

**Example:** `design-system/elements/gauge/gauge.mjs` imports only `design-system/foundation/cells.mjs`; motions import only `foundation/`; hosts in `examples/` import layouts and elements. `pi/claude-interrupt/src/index.ts` imports Node and the host-provided Pi packages only. A Pi extension is installed from its own folder and must load with nothing outside it. **Reason:** each project stays independently installable, testable, and replaceable. **Check:** review each project's imports against its architecture; `grep -rn "from '\.\./\.\./" design-system pi/*/src` must find nothing that crosses a project root. No automated boundary check exists (proposed).

## Placement and naming

**Rule:** a top-level folder is a project and owns its language, manifest, lockfile, dependencies, commands, checks, guides, and license. Inside a project, group what changes together by capability, keep checks beside the behavior they verify or in the project's `test/`, and use descriptive kebab-case names. No `utils`, `helpers`, or `managers` collections.

**Example:** `design-system/elements/gauge/` holds `README.md`, `gauge.mjs`, and `gauge.test.mjs`. `pi/claude-interrupt/` holds `src/`, `test/`, its manifest, and its guides. The required document set for a project is in [architecture](architecture.md#contracts-between-the-root-and-a-project). **Reason:** related changes remain local; a project can be moved in or out with its history. **Check:** every project has the document set; every guide appears in the root map (repository-wide check 2).

## Functions, APIs, and abstractions

**Rule:** explicit inputs and results, predictable side effects, and plain functions. Keep rendering pure and give time, size, and state to it as arguments; put I/O, clocks, timers, and host lifecycle in a host or adapter. Extract shared behavior only when two consumers need the same semantics.

**Example:** `gauge(input, { width })` returns lines and reads no state. `renderMarker(theme, width, outputPad, elapsed)` in `pi/claude-interrupt/src/index.ts` is a pure function of elapsed time; the extension's lifecycle code owns the timer and the Pi context. **Reason:** deterministic tests and hosts that can change without rewriting what they render. **Check:** each project's tests render without a terminal, a clock, or a host.

## Types and validation

**Rule:** validate dimensions, numeric ranges, external data, and display text at trust boundaries. Static types are not runtime validation. Preserve source data and sanitize only the display form.

**Example:** `design-system/foundation/cells.mjs` replaces every non-printable-ASCII code point with `?` and throws on invalid colors. claude-interrupt compiles with `strict` TypeScript, which checks its own code, not what the Pi host hands it at runtime; it checks queued input for attachments before acting. **Reason:** truthful, bounded output in a terminal. **Check:** design-system tests cover control characters, combining text, wide glyphs, and invalid values; the extension's tests cover attachment and empty-queue cases.

## Errors and diagnostics

**Rule:** distinguish unsupported capability, invalid input, and operational failure. Preserve the cause, report once at the owning boundary, and never return a success-shaped result for a failure. Redact private paths and payloads from anything published.

**Example:** the design-system hosts print the cause and exit 1 on a drawing error and exit 2 on invalid options. claude-interrupt falls through to Pi's native Escape when it cannot replay a queue faithfully, and restores text to the editor with a warning instead of silently dropping an attachment. **Reason:** people act on these signals. **Check:** each project's failure-path tests; review published diagnostics for private paths.

## State, I/O, and migrations

**Rule:** the host or adapter owns subscriptions, timers, writes, and disposal; it clears every timer on every exit path. Rendering consumes state and never persists it. No project has storage; define concurrency and migration rules only if one is introduced.

**Example:** the storybook runs one 67 ms interval only while a preview plays and clears it on pause, completion, and every exit. claude-interrupt's marker timer is cleared on a new Escape, session shutdown, reload, and session switch, and saved markers render settled without replaying. **Reason:** nothing keeps running or half-written after the user leaves. **Check:** lifecycle tests in each project.

## Tests

**Rule:** a deterministic runnable check beside nontrivial behavior: unit checks for layout and pure functions, contract checks for public behavior, integration checks at real host boundaries, and a small manual check in the real environment for what automation cannot prove. Report automated, isolated-PTY, Pi-load, and interactive Herdr evidence separately.

**Example:** `design-system/` runs `node --test` with widths 1 to 160 and stand-in terminal streams; `pi/claude-interrupt/` runs `tsc --noEmit`, Node's test runner with Pi's real extension loader, and a non-interactive Pi load check. Neither replaces an interactive check in Herdr. **Reason:** a screenshot cannot prove terminal interaction, and a passing suite cannot prove host compatibility. **Check:** each project's contributing sequence, then the [repository-wide checks](../CONTRIBUTING.md#repository-wide-checks); a skipped required check is not a pass.

## Dependencies and generated output

**Rule:** prefer the platform, the host, and already adopted dependencies. A Pi extension declares host-provided packages as `peerDependencies` with `*` and never bundles them. Commit each project's lockfile with its manifest. Verify a dependency's contract against documentation matching the version in use. Declare the source and regeneration command of any generated file; never edit one by hand.

**Example:** the design system has no dependencies; claude-interrupt's `package.json` lists Pi's packages as peers and pins them only as development dependencies. status-bar lists its peers but has no development dependencies or lockfile, because its tests use the globally installed Pi; that exception is recorded in [its conventions](../pi/status-bar/docs/conventions.md#adoption-gaps). **Reason:** avoid duplicate host classes, redistribution obligations, and silent drift. **Check:** review each manifest change for necessity, license, and version; the Pi load check catches a bundled host package.

## Performance and growth

**Rule:** bound work by the supplied dimensions, stop when disposed, and measure before adding a cache, worker, or service. No workload baseline exists for any project.

**Example:** the showcase redraws only on resize or a key; the marker redraws every 40 ms for three seconds and then runs no timer. **Reason:** a responsive input loop in a shared terminal. **Check:** lifecycle and timer tests; no repaint measurements have been taken in Herdr.

## Adoption gaps

- **Palette values are copied by hand** in three places: `pi/status-bar/src/footer.ts`, `pi/claude-interrupt/src/index.ts`, and `design-system/foundation/palette.mjs`. The authority is decided; the comparison is a manual review of each extension's constants against `palette.mjs`. Next change: when a value first changes, decide between a tested comparison and a generated file. Verify by the review comparison until then.
- **No automated cross-project boundary check.** The import rule is reviewed by hand. Next change: a small test that walks each project's imports, if a violation ever appears. Verify by running it in each project's sequence.
- **No continuous integration and no single repository command.** Each project's sequence is run by hand. Recorded in [the decision](decisions/standalone-packages.md). Next change: a root script calling each project's documented sequence, only when a CI gate is wanted.
- **Neither Pi extension has an interactive Pi or Herdr verification record** since its move; each one's automated suite and load check pass. Next change: run each interactive check and record it in that extension's contributing guide.
- **No project license** at the root; claude-interrupt carries MIT and status-bar has none. Open decision, recorded in architecture.
