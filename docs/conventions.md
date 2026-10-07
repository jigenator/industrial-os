# Engineering conventions

## Project profile

Industrial OS is a public monorepo for Pi and Herdr visualization, user experience, and tooling. Its packages today are the terminal-only design system in `design-system/`, starting as a reference kit, and the Pi extensions in `pi/`. These rules apply to every package. Rules that apply only to the design system—its stack, cell measurement, and rendering performance—are in [its architecture](../design-system/docs/architecture.md#design-system-engineering-rules). Rules that apply only to Pi extensions are in [their agent guide](../pi/AGENTS.md).

Scope reviewed: the repository's guidance and the design system's `foundation/`, `elements/`, `motions/`, and `examples/`, plus a bounded read-only survey of prior design explorations. No source was imported from those explorations. Rules marked proposed are targets, not a claim that the code already conforms.

## Engineering principles

| Rule | Real example/path | Reason | Check |
| --- | --- | --- | --- |
| Progressive disclosure: scan the guidance map, then read only applicable sections | [AGENTS.md](../AGENTS.md) routes design-system work to [its guide](../design-system/AGENTS.md), which routes visual work to design and boundary work to architecture | Relevant constraints stay discoverable without loading every document | Review check: trace an element change and a docs-only change |
| YAGNI: add machinery only for a current requirement | The showcase uses the Node standard library; there is no package workspace, renderer framework, or color fallback without a target that needs it | A design system does not need a framework before its first consumer | Review check: name the current need for every dependency, adapter, or abstraction |
| KISS: reuse conforming code, standard facilities, and the chosen host's facilities before writing replacements | CONTRIBUTING uses Git; no new docs toolchain is required | Fewer moving parts and less duplicated behavior | Review check: compare the simplest correct alternative |
| Single source of truth: maintain rules and commands once | Design owns visual rules; CONTRIBUTING owns command recipes; CLAUDE imports AGENTS | One change should not require synchronizing parallel manuals | Review check: follow references after changing a rule |

## Module and dependency rules

**Rule:** group an element's contract, behavior, specimen, and checks together; keep reusable layout independent of host I/O and lifecycle. Use declared public surfaces, not cross-element internal imports. No dependency cycles or catch-all shared package to hide them.

**Example:** `design-system/elements/gauge/gauge.mjs` imports only `design-system/foundation/cells.mjs`. Motions in `design-system/motions/` take the time as an argument and never read a clock. Terminal writes, listeners, clocks, and timers stay in the `design-system/examples/` hosts (see [architecture](../design-system/docs/architecture.md)). **Reason:** a host change should not rewrite the gauge's value semantics. **Check:** review imports and callers; automated boundary checks are not implemented.

## Placement and naming

**Rule:** use descriptive kebab-case element names and cohesive capability folders; keep tests beside the behavior they verify. Do not create global `utils`, `helpers`, or `managers` collections.

**Example:** `design-system/elements/gauge/` holds `README.md` (contract), `gauge.mjs`, and `gauge.test.mjs`. Shared cell behavior is the deliberately small `design-system/foundation/`, not a `utils` folder. **Reason:** related changes remain local. **Check:** every new file has one clear capability and every guide appears in AGENTS.

## Functions, APIs, and abstractions

**Rule:** use explicit inputs/results and predictable side effects. Prefer plain functions; extract behavior only when consumers share its semantics, not merely similar code.

**Example:** `gauge(input, { width })` takes the caller's value and cell budget and returns lines; it does not query application state itself. **Reason:** deterministic specimens and independent hosts. **Check:** review the call flow and test behavior without unrelated setup. Do not introduce factories, base classes, or extension registries without a current need.

## Types and validation

**Rule:** define public inputs, absent values, and compatibility expectations when code is introduced. Validate dimensions, numeric ranges, external data, and display text at trust boundaries; static types are not runtime validation.

**Example:** an unknown gauge value must not become zero. Untrusted label text must not inject terminal control sequences; preserve its source data and sanitize only the display representation. **Reason:** truthful, bounded output. **Check:** element and foundation tests cover unknown and invalid values, control characters, combining text, and wide glyphs. The foundation README states the bounded text contract. No type/schema tooling exists.

## Errors and diagnostics

**Rule:** distinguish unsupported capability, invalid input, and operational failure. Preserve useful cause/context; translate or log once at the owning boundary. Never return a success-shaped fallback for failed I/O.

**Example:** a future checklist must not display saved confirmation after its host rejects a write. **Reason:** users act on these signals. **Check:** proposed failure-path integration test; redact private paths and payloads from published diagnostics.

## State, I/O, and migrations

**Rule:** the caller owns application state and persistence. Rendering consumes state; interaction reports intent through the selected host contract. The host owns subscriptions, timers, writes, retries, and disposal.

**Example:** a control can request a toggle without pretending it has persisted it. **Reason:** elements remain reusable and do not create hidden file or model operations. **Check:** proposed focus/state and rejected-action tests. There is no storage schema today; define concurrency, recovery, and migration rules only if storage is actually introduced.

## Tests

**Rule:** put a deterministic runnable check beside nontrivial behavior. Use unit checks for layout, contract checks for public behavior, integration checks for host boundaries, and a small end-to-end check for critical native input.

**Example:** `gauge.test.mjs` checks every width from 1 to 160 and unknown values. `showcase.test.mjs` drives the live host with stand-in terminal streams. A future interactive row would also need native focus/input checks. **Reason:** a screenshot cannot prove terminal interaction. **Check:** follow [CONTRIBUTING](../CONTRIBUTING.md) and the package's contributing guide; report native rendered output, PTY automation, and actual Herdr testing as different evidence. Browser reconstructions do not establish native behavior.

## Dependencies and generated output

**Rule:** prefer the selected platform's facilities and already adopted dependencies; verify version-matched authoritative contracts before integrating.

**Example:** no browser emulator, font binary, or native toolkit is bundled in this repository. The design system's cell-measurement and terminal-rendering rules are in [its architecture](../design-system/docs/architecture.md#terminal-text-and-dependencies). **Reason:** avoid accidental runtime coupling and redistribution obligations. **Check:** review each dependency's necessity, license, and supported version. Preserve required notices for copied code. Declare the source and regeneration command of any generated output before adding it; never edit generated files by hand.

## Adoption gaps

- The design system's four elements and the showcase have a bounded [Herdr verification baseline](../design-system/CONTRIBUTING.md#native-verification-baseline). The motions and storybook also have automated, isolated real-PTY, and bounded native Herdr checks; see [their scope](../design-system/CONTRIBUTING.md#storybook-verification-status). Visual acceptance and refinement remain a maintainer decision; this is not a released API.
- Support matrix, licensing, and public API policy remain open. Resolve only the decisions the next change needs.
- Failure-path, focus, and rejected-action checks remain proposed until an interactive or storage-backed element exists. There is no formatter or linter. The only type checker is each Pi extension's `tsc --noEmit`.
- The design system needed no source migration. Pi extensions move in from their own repositories with their history and their documented limitations. Existing experiments remain outside the repository; reference-code limitations are not defects in this repository.
