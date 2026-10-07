# Design-system engineering conventions

The [repository-wide conventions](../../docs/conventions.md) apply. This guide adds only the design system's own rules: its stack, its cell-measurement contract, and its rendering and performance rules. Placement and boundaries are in [architecture](architecture.md).

## Project profile

Plain Node.js 22 ES modules (`.mjs`) using only the standard library, with Markdown and Git. There is no package manifest, dependency, build step, formatter, linter, or type checker, and none should be added without a current need. Checks run with `node --test` from `design-system/`; commands are in [Contributing](../CONTRIBUTING.md).

Scope reviewed: `foundation/`, the folders under `elements/`, `motions/`, and `examples/`, with their colocated tests, most recently when the second element set and the newer motions joined the storybook. Herdr verification is recorded separately in Contributing.

## Module and dependency rules

**Rule:** elements import `foundation/` and, where one element is built from others, those elements' public functions only, never their internals, and never in a cycle. Motions import only `foundation/` and `motions/frame.mjs`; elements never import motions, and motions never import elements. Hosts and stories in `examples/` import layouts, elements, motions, `foundation/`, and the shared terminal host. Compose an element from another only when it draws that element as a part, as the thread rail draws the lamp, label plate, and count plate; otherwise the caller composes them.

**Example:** `elements/gauge/gauge.mjs` imports `foundation/` only; `elements/thread-rail/thread-rail.mjs` imports `lamp()`, `labelPlate()`, and `countPlate()`; `motions/scan.mjs` imports `motions/frame.mjs`, which imports `foundation/cells.mjs`. The instrument frame takes caller-rendered plates instead of importing them. The current element-to-element edges are listed in [architecture](architecture.md#dependency-direction). **Reason:** a host change must not rewrite an element's value semantics, and a part's contract has one owner. **Check:** review imports against the dependency diagram in [architecture](architecture.md#dependency-direction); `motions/motions.test.mjs` checks that every motion imports only `./` and `../foundation/`. No automated check covers elements.

## Terminal text and dependencies

**Rule:** do not hand-roll Unicode cell measurement when the chosen runtime already provides it, and do not estimate widths the runtime cannot measure.

**Example:** Node 22 has no public cell-width API, so `foundation/cells.mjs` restricts display text to printable ASCII and shows every other code point as `?` instead of estimating widths. Structural glyphs come from one curated set of narrow or ambiguous-width characters. Shipped elements and demos must not depend on HTML, CSS, DOM, canvas, or image rendering; their presentation is terminal text and terminal-native styling. **Reason:** misaligned frames are worse than replaced text. **Check:** `foundation/cells.test.mjs` covers control characters, combining marks, wide glyphs, and emoji; the contract is in [foundation](../foundation/README.md#text-and-glyph-contract).

## Palette

**Rule:** `foundation/palette.mjs` is the design system's copy of the Acid / Black values, not their source. The Pi extensions are the authority; see [the decision](../../docs/decisions/extension-colors-take-precedence.md).

The same holds for `foundation/signal-colors.mjs`, the copy of status-bar's other product colors: elements and motions read those values from it rather than repeating a hex value, and state colors stay role names so motions can recognise warning and critical cells.

**Example:** `paint()` accepts only `ACID_BLACK` role names or literal `#RRGGBB` strings and throws on anything else. The count plate's pink tier is `SIGNAL_COLORS.pink`; its 5+ tier is the `critical` role. **Reason:** one place to change a value inside the design system, and no silent coercion. **Check:** `cells.test.mjs` covers every role and invalid styles; `signal-colors.test.mjs` covers the mirror's format and mixes; agreement with the extensions is a review comparison of their constants against `palette.mjs` and `signal-colors.mjs`.

## Performance and growth

**Rule:** bound rendering by the supplied dimensions, stop work when disposed, and separate decorative motion from truthful data updates. Measure before adding caches, workers, or new packages.

**Example:** gauge text must reflect the current value even if a decorative highlight is moving; scan and pulse change only styling, and no motion restyles warning or critical cells unless it opts in and keeps their cue. The live showcase has no redraw timer and redraws only on resize or scrolling. The storybook runs one interval only while a motion preview plays or a finished one-shot waits to replay, at the preview's own step (as fast as 40 ms) or 67 ms for continuous motions; it redraws nothing during the wait and clears the interval on pause, motion off, selecting a still story, the key list, and every exit path. Node's key decoder owns a brief timeout for standalone Esc. **Reason:** correctness and a responsive input loop. **Check:** width, motion, and lifecycle tests exist. Repaint measurements in Herdr have not been taken, including at the storybook's 40 and 50 ms intervals, and no workload baseline or performance defect has been established.

## Adoption gaps

- No automated import-boundary check for elements (motions have one in `motions.test.mjs`); the dependency diagram, including the element-to-element edges, is reviewed by hand. Next change: a small test walking imports, if a violation ever appears.
- No 256-color, 16-color, or ASCII-glyph fallback. Add one when a target terminal needs it; recorded as an open decision in [design](../../docs/design.md#verification-and-open-questions).
- The current COLORS page has not been re-checked natively in Herdr since its last change; see [Contributing](../CONTRIBUTING.md#storybook-verification-status).
- The second element set, the newer motions, the SIGNAL COLORS story, and the storybook's scrolling index and step-rate playback have automated checks only; see [Contributing](../CONTRIBUTING.md#storybook-verification-status).
