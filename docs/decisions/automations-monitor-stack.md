# The automations monitor runs on Bun and Effect

Status: current. Date: 2026-10-23; the stack was set by the maintainer when the plugin was commissioned. Applies the [plugin runtime decision](herdr-plugin-runtimes.md) to `herdr-plugins/automations-monitor/`. Supersedes the unmerged `feature/pipeline-floor` branch, which is left untouched.

## Problem

The monitor is an interactive, full-screen Herdr pane that runs a child process every few seconds, decodes a versioned JSON contract, polls without overlapping reads, and must restore the terminal and leave no `tatsu` process behind on every exit path, including signals and defects. The earlier pipeline-floor attempt, plain Node 22 with the standard library, carried that lifecycle in hand-written promise and timer code, and its terminal and process-teardown checks needed Python. The design system it draws with is JavaScript, so the monitor should stay in that ecosystem to import it.

## Choice

- **Bun 1.4.4** runs the TypeScript sources directly, with no bundle or emit step, and provides the pseudo-terminal used by the terminal check.
- **TypeScript 7.0.2**, strict, with `tsc --noEmit` as a required check.
- **Effect 4.0.6 and `@effect/platform-bun` 4.0.6** structure the program: Schema decodes the CLI's JSON; the `effect/process` child-process module gives each read a timeout, a process-group `SIGTERM` then `SIGKILL`, and an output cap; `Stream` and `Queue` poll with one read in flight, sleeping the interval after each read finishes; `Context` services and `Layer`s provide the reader and terminal; `Scope` restores the terminal on every exit; `BunRuntime.runMain` is the entry. The terminal service is the monitor's own rather than Effect's, because it needs SGR mouse reports, raw keys including a lone Esc, and synchronous restoration from signal and error handlers.
- All four packages are exact versions, locked in the plugin's own `bun.lock` and installed by the manifest's `[[build]]` `bun install --frozen-lockfile`.
- The design system is imported by package name through exported subpaths, resolved from the repository root's `node_modules`, and is not in the plugin's manifest.

It is the repository's second Bun and Effect project, after the [source collector](bun-effect-runtime.md), whose runtime exception covers only itself; this record is the monitor's own. The two share no code or lockfile. The source collector type-checks with the TypeScript 7.1 beta through Effect-patched tsgo; the monitor pins the stable 7.0.2 and plain `tsc`, by the maintainer's choice. It is the first Herdr plugin whose dependencies are installed from a lockfile at build time.

## Alternatives

- **Plain Node 22, standard library only (the pipeline-floor branch).** It follows the group default and needs no install, but it reimplements cancellation, scoped teardown, schema decoding and polling by hand, and needed Python for its PTY check. It stays unmerged as a reference.
- **Node 22 with Effect.** It keeps the default runtime, but needs a TypeScript loader or build for the strict TypeScript the stack calls for, and Node offers no built-in pseudo-terminal for the check.
- **Rust, as the whiteboard.** It could not import the design system and would mirror its colours, and the monitor has no need for a native binary.

## Consequences

- Herdr's `PATH` needs Bun 1.4.4, and `herdr plugin link` builds nothing, so a linked checkout runs `bun install --frozen-lockfile` itself; the pane says so when the dependencies are missing. A GitHub install runs the build but has no repository root, so it lacks the design-system package; a linked checkout is the supported install.
- `skipLibCheck` is on, because Effect 4.0.6's declarations reference a DOM-only type that TypeScript 7.0.2 cannot resolve without the DOM library.
- One design-system subpath used, `foundation/industrialos-colors`, ships no declaration; the plugin declares only what it reads in `types/`, rather than enabling `allowJs` over the design system's sources.
- Effect is a large dependency surface for one pane; upgrades are deliberate and re-run the full check sequence, including the terminal check.
- The [plugin group guide](../../herdr-plugins/AGENTS.md) and the plugin's [architecture](../../herdr-plugins/automations-monitor/docs/architecture.md) record how it applies.

## Revisit when

Herdr runs `[[build]]` on link or installs toolchains; the design system ships declarations for every subpath; a second plugin wants the same stack, which, with the source collector, would argue for one shared Bun and Effect convention; or Bun or Effect changes the child-process or runtime APIs this relies on.
