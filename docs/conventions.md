# Engineering conventions

## Project profile

Industrial OS is a public, native-terminal-first design system, starting as a reference kit. The current stack is Markdown plus Git; no implementation language, framework, package manager, or runtime is selected.

Scope reviewed: the initial repository on unborn `main`, its root guidance and `docs/`, and a bounded read-only survey of prior design explorations. No application source was imported. These are target engineering rules, not a claim that a runtime already conforms.

## Engineering principles

| Rule | Real example/path | Reason | Check |
| --- | --- | --- | --- |
| Progressive disclosure: scan the guidance map, then read only applicable sections | [AGENTS.md](../AGENTS.md) routes visual work to design and boundary work to architecture | Relevant constraints stay discoverable without loading every document | Review check: trace an element change and a docs-only change |
| YAGNI: add machinery only for a current requirement | Architecture keeps element folders proposed; there is no empty package workspace | A design system does not need a framework before its first consumer | Review check: name the current need for every dependency, adapter, or abstraction |
| KISS: reuse conforming code, standard facilities, and the chosen host's facilities before writing replacements | CONTRIBUTING uses Git; no new docs toolchain is required | Fewer moving parts and less duplicated behavior | Review check: compare the simplest correct alternative |
| Single source of truth: maintain rules and commands once | Design owns visual rules; CONTRIBUTING owns command recipes; CLAUDE imports AGENTS | One change should not require synchronizing parallel manuals | Review check: follow references after changing a rule |

## Module and dependency rules

**Rule:** group an element's contract, behavior, specimen, and checks together; keep reusable layout independent of host I/O and lifecycle. Use declared public surfaces, not cross-element internal imports. No dependency cycles or catch-all shared package to hide them.

**Example:** the proposed gauge boundary in [architecture](architecture.md), not an existing module. **Reason:** a host change should not rewrite the gauge's value semantics. **Check:** review the first implementation's imports and callers; automated boundary checks are not implemented.

## Placement and naming

**Rule:** use descriptive kebab-case element names and cohesive capability folders; keep tests beside the behavior they verify. Do not create global `utils`, `helpers`, or `managers` collections.

**Example:** a future `elements/gauge/README.md` would own that element's contract; its language-specific filenames remain undecided. **Reason:** related changes remain local. **Check:** every new file has one clear capability and every guide appears in AGENTS.

## Functions, APIs, and abstractions

**Rule:** use explicit inputs/results and predictable side effects. Prefer plain functions; extract behavior only when consumers share its semantics, not merely similar code.

**Example:** a proposed gauge takes the caller's value and cell budget; it does not query application state itself. **Reason:** deterministic specimens and independent hosts. **Check:** review the call flow and test behavior without unrelated setup. Do not introduce factories, base classes, or extension registries without a current need.

## Types and validation

**Rule:** define public inputs, absent values, and compatibility expectations when code is introduced. Validate dimensions, numeric ranges, external data, and display text at trust boundaries; static types are not runtime validation.

**Example:** an unknown gauge value must not become zero. Untrusted label text must not inject terminal control sequences; preserve its source data and sanitize only the display representation. **Reason:** truthful, bounded output. **Check:** proposed boundary tests for unknown/invalid values, control characters, combining text, and wide glyphs. No type/schema tooling exists yet.

## Errors and diagnostics

**Rule:** distinguish unsupported capability, invalid input, and operational failure. Preserve useful cause/context; translate or log once at the owning boundary. Never return a success-shaped fallback for failed I/O.

**Example:** a future checklist must not display saved confirmation after its host rejects a write. **Reason:** users act on these signals. **Check:** proposed failure-path integration test; redact private paths and payloads from published diagnostics.

## State, I/O, and migrations

**Rule:** the caller owns application state and persistence. Rendering consumes state; interaction reports intent through the selected host contract. The host owns subscriptions, timers, writes, retries, and disposal.

**Example:** a control can request a toggle without pretending it has persisted it. **Reason:** elements remain reusable and do not create hidden file or model operations. **Check:** proposed focus/state and rejected-action tests. There is no storage schema today; define concurrency, recovery, and migration rules only if storage is actually introduced.

## Tests

**Rule:** put a deterministic runnable check beside nontrivial behavior. Use unit checks for layout, contract checks for public behavior, integration checks for host boundaries, and a small end-to-end check for critical native input.

**Example:** a future gauge needs boundary widths and unknown values; an interactive row also needs native focus/input checks. **Reason:** a screenshot cannot prove terminal interaction. **Check:** follow [CONTRIBUTING](../CONTRIBUTING.md); report browser illustration, rendered output, PTY automation, and physical-terminal testing as different evidence. None of these application checks exists yet.

## Dependencies and generated output

**Rule:** prefer the selected platform's facilities and already adopted dependencies; verify version-matched authoritative contracts before integrating. Do not hand-roll Unicode cell measurement when the chosen runtime already provides it.

**Example:** no browser emulator, font binary, or native toolkit is bundled in this repository. **Reason:** avoid accidental runtime coupling and redistribution obligations. **Check:** review each dependency's necessity, license, and supported version. Preserve required notices for copied code. Declare the source and regeneration command of any generated output before adding it; never edit generated files by hand.

## Performance and growth

**Rule:** bound rendering by the supplied dimensions, stop work when disposed, and separate decorative motion from truthful data updates. Measure before adding caches, workers, or new packages.

**Example:** gauge text must reflect the current value even if a decorative highlight is moving. **Reason:** correctness and a responsive input loop. **Check:** proposed width, lifecycle, and repaint measurements on the eventual native specimen. No workload baseline or performance defect has been established.

## Adoption gaps

- No executable elements or native test host exist. Next: approve one element and its support contract, then add the smallest specimen and runnable checks.
- Language, framework, support matrix, licensing, and public API policy remain open. Resolve only the decisions needed for the first specimen.
- Validation currently covers guidance, not runtime conformance. Replace proposed checks with actual commands as behavior is added.
- No source migration is required: this is a new repository. Existing experiments remain outside it; reference-code limitations are not defects in this repository.
