# Design-system engineering conventions

The [repository-wide conventions](../../docs/conventions.md) apply. This guide adds only the design system's own rules: its stack, its cell-measurement contract, and its rendering and performance rules. Placement and boundaries are in [architecture](architecture.md).

## Project profile

Plain Node.js 22 ES modules (`.mjs`) using only the standard library, with Markdown and Git. There is no package manifest, dependency, build step, formatter, linter, or type checker, and none should be added without a current need. Checks run with `node --test` from `design-system/`; commands are in [Contributing](../CONTRIBUTING.md).

Scope reviewed: `foundation/`, the four folders under `elements/`, `motions/`, and `examples/`, with their colocated tests, at the revision that moved these rules out of architecture. Herdr verification is recorded separately in Contributing.

## Module and dependency rules

**Rule:** elements import only `foundation/`; motions import only `foundation/`; elements never import motions; hosts in `examples/` import layouts, elements, motions, and the shared terminal host. The only cross-element import is the numbered panel's use of the label plate's public function.

**Example:** `elements/gauge/gauge.mjs` imports `foundation/cells.mjs` only; `motions/scan.mjs` imports `motions/frame.mjs`, which imports `foundation/cells.mjs`. **Reason:** a host change must not rewrite an element's value semantics. **Check:** review imports against the dependency diagram in [architecture](architecture.md#dependency-direction); no automated boundary check exists.

## Terminal text and dependencies

**Rule:** do not hand-roll Unicode cell measurement when the chosen runtime already provides it, and do not estimate widths the runtime cannot measure.

**Example:** Node 22 has no public cell-width API, so `foundation/cells.mjs` restricts display text to printable ASCII and shows every other code point as `?` instead of estimating widths. Structural glyphs come from one curated set of narrow or ambiguous-width characters. Shipped elements and demos must not depend on HTML, CSS, DOM, canvas, or image rendering; their presentation is terminal text and terminal-native styling. **Reason:** misaligned frames are worse than replaced text. **Check:** `foundation/cells.test.mjs` covers control characters, combining marks, wide glyphs, and emoji; the contract is in [foundation](../foundation/README.md#text-and-glyph-contract).

## Palette

**Rule:** `foundation/palette.mjs` is the design system's copy of the Acid / Black values, not their source. The Pi extensions are the authority; see [the decision](../../docs/decisions/extension-colors-take-precedence.md).

**Example:** `paint()` accepts only `ACID_BLACK` role names or literal `#RRGGBB` strings and throws on anything else. **Reason:** one place to change a value inside the design system, and no silent coercion. **Check:** `cells.test.mjs` covers every role and invalid styles; agreement with the extensions is a review comparison of their constants against `palette.mjs`.

## Performance and growth

**Rule:** bound rendering by the supplied dimensions, stop work when disposed, and separate decorative motion from truthful data updates. Measure before adding caches, workers, or new packages.

**Example:** gauge text must reflect the current value even if a decorative highlight is moving; scan and pulse change only styling, and no motion restyles warning or critical cells. The live showcase has no redraw timer and redraws only on resize or scrolling. The storybook runs one 67 ms interval only while a motion preview plays, and clears it on pause, completion, selection changes, and every exit path. Node's key decoder owns a brief timeout for standalone Esc. **Reason:** correctness and a responsive input loop. **Check:** width, motion, and lifecycle tests exist. Repaint measurements in Herdr have not been taken, and no workload baseline or performance defect has been established.

## Adoption gaps

- No automated import-boundary check; the dependency diagram is reviewed by hand. Next change: a small test walking imports, if a violation ever appears.
- No 256-color, 16-color, or ASCII-glyph fallback. Add one when a target terminal needs it; recorded as an open decision in [design](../../docs/design.md#verification-and-open-questions).
- The current COLORS page has not been re-checked natively in Herdr since its last change; see [Contributing](../CONTRIBUTING.md#storybook-verification-status).
