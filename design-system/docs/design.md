# Design-system design

The design system's own experience, within the repository-wide [design](../../docs/design.md), which owns the shared palette, motion rules, accessibility rules, UI states, and acceptance criteria. This doc adds what is specific to the design system: its element set, its reference colors, its motions, and its storybook.

## Experience

The design system is a curated reference kit of polished terminal elements for Herdr, with a storybook to browse them and a showcase that composes them. It is a reference for the Pi extensions and the planned Herdr tooling, not a library they import.

## Elements

The selected first set is numbered panels, label plates, gauges, and status rows. Each has a first-pass contract and native implementation: [numbered panel](../elements/numbered-panel/README.md), [label plate](../elements/label-plate/README.md), [gauge](../elements/gauge/README.md), and [status row](../elements/status-row/README.md). `examples/showcase.mjs` composes them for refinement. They have a bounded [native Herdr verification baseline](../CONTRIBUTING.md#native-verification-baseline); final visual acceptance remains a maintainer decision.

## IndustrialOS colors

A separate reference collection of 22 named colors, with five-step derived shade ramps. Values live in [foundation](../foundation/README.md#industrialos-colors). It does not replace Acid / Black, add roles to it, or form a theme switch. Wherever a generated ramp step is shown, label it `DERIVED`, distinct from its `BASE` color. Put hex values and names on the normal field rather than on the swatch, and do not claim contrast or accessibility for any combination without checking it.

## Motions

The initial set is [scan, pulse, and reveal](../motions/README.md): pure decorations of already-rendered lines at an explicit time, under the shared [motion rules](../../docs/design.md#motion). Scan and pulse preserve characters. Reveal belongs only on nonessential decoration: compose complete readings, labels, and status messages outside it. Warning/critical foreground or background cells are exempt from all three transforms, but this does not protect an entire associated message. `animate: false` is their motion-off state.

## Storybook

`examples/storybook.mjs` is the browsing surface for the system: an index of elements, motions, and the IndustrialOS colors, state, example, or view selection, a specimen from the real renderer or foundation data, its generated call, and key contract rules. Its keys and layout rules are in [examples](../examples/README.md). Motion previews are labeled demonstration playback, start with motion off, and play only on request. The COLORS story is static and never plays. The storybook's keyboard path and optional left-click controls are defined by its host and [examples](../examples/README.md#left-clicks); the elements themselves are not interactive.

## Verification and open questions

Current status: the four elements have native renderers with automated layout and contract checks. The three motions have deterministic frame checks. The showcase and storybook pass automated checks of their live-view lifecycle, using stand-in terminal streams and, for storybook playback, a manual clock. The showcase is static; the storybook's motion previews default to motion off and run a bounded timer only while playing. Automated mouse checks are not proof of native Herdr mouse forwarding. This first pass requires 24-bit color, or falls back to plain text, and requires one-cell rendering of the curated glyphs; see [foundation](../foundation/README.md). The native Herdr checks of the showcase, the storybook, and an earlier version of the COLORS story are recorded in [Contributing](../CONTRIBUTING.md#native-verification-baseline) with their exact scope; no accessibility certification, physical-pixel contrast assessment, or performance measurement is claimed.

Open decisions: visual refinements to the first four elements and the motions. Shared open decisions are in the [repository-wide design](../../docs/design.md#verification-and-open-questions).
