# Design

## Experience

Industrial OS should feel like a well-made instrument: precise, legible, deliberate, and immediately useful. Information has hierarchy without losing density. Labels are direct; values and actions matter more than ornament.

People using terminal interfaces in Herdr are the primary audience. The first delivery is a curated reference kit of polished elements, not a browser library or a complete application shell.

Every element and demo must render as terminal-ready text in a cell grid, with terminal-native colors and styles. Layout, borders, spacing, and motion must work through terminal output—not HTML, CSS, DOM positioning, canvas, images, or browser-only effects.

Avoid simulated telemetry, decorative noise over content, unnecessary chrome, and animation that implies work the application is not doing.

## Interaction and visual language

### Acid / Black

This is the selected default palette. Its color values are maintained once, in [foundation/palette.mjs](../foundation/palette.mjs). This table defines what each role is for. The palette is not a shipped theme API or a blanket contrast certification.

| Role (`palette.mjs` key) | Intended use |
| --- | --- |
| Field (`field`) | Main black background |
| Surface (`surface`) | Secondary fields and gauge tracks |
| Primary text (`primary`) | Values, readouts, and primary labels |
| Secondary text (`secondary`) | Supporting readable text |
| Accent (`accent`) | Acid-green emphasis and active signals |
| Decorative grey (`decorative`) | Nonessential instrument detail |
| Structural grey (`structural`) | Subtle plates and decorative rules |
| Warning (`warning`) | Warning emphasis with a text/state cue |
| Critical (`critical`) | Critical/error emphasis with a text/state cue |

Do not use decorative greys for essential control boundaries or readable small text without checking the actual contrast. Accent is not a substitute for a label; warning and critical states must remain understandable without color.

### IndustrialOS colors

A separate reference collection of 22 named colors, with five-step derived shade ramps. Values live in [foundation](../foundation/README.md#industrialos-colors). It does not replace Acid / Black, add roles to it, or form a theme switch. Wherever a generated ramp step is shown, label it `DERIVED`, distinct from its `BASE` color. Put hex values and names on the normal field rather than on the swatch, and do not claim contrast or accessibility for any combination without checking it.

### Shape and composition

Use cell-aligned geometry, compact labels, clear readouts, and restrained numbered plates or calibration marks. Borders should organize content rather than consume every available cell. Do not require a particular proprietary font; work with the user's terminal font and declared glyph capabilities.

The selected first set is numbered panels, label plates, gauges, and status rows. Each has a first-pass contract and native implementation: [numbered panel](../elements/numbered-panel/README.md), [label plate](../elements/label-plate/README.md), [gauge](../elements/gauge/README.md), and [status row](../elements/status-row/README.md). `examples/showcase.mjs` composes them for refinement. They have a bounded [native Herdr verification baseline](../CONTRIBUTING.md#native-verification-baseline); final visual acceptance remains a maintainer decision.

### Motion

Motion is instrument detail, never data. The initial set is [scan, pulse, and reveal](../motions/README.md): pure decorations of already-rendered lines at an explicit time. Scan and pulse preserve characters. Reveal belongs only on nonessential decoration: compose complete readings, labels, and status messages outside it. Warning/critical foreground or background cells are exempt from all three transforms, but this does not protect an entire associated message. Repeating motions cycle at most 2.5 times a second (under the 3 Hz flashing limit). Pulse implies activity, so use it only where a signal really is active. Do not use motion to suggest progress that is not happening.

### Storybook

`examples/storybook.mjs` is the browsing surface for the system: an index of elements, motions, and the IndustrialOS colors, state, example, or view selection, a specimen from the real renderer or foundation data, its generated call, and key contract rules. Its keys and layout rules are in [examples](../examples/README.md). Motion previews are labeled demonstration playback, start with motion off, and play only on request. The COLORS story is static and never plays.

### Interaction and feedback

Common actions should be visible; secondary detail can be disclosed on demand. Never hide required inputs, errors, destructive consequences, or focus cues.

Separate focus, selection, active work, saved state, and historical state. A transient effect cannot be the only confirmation of an action. Do not steal the host editor's keystrokes or mouse behavior without an explicit interaction contract.

## Accessibility and platform behavior

- Define a usable keyboard path for every interactive element. Do not assume browser Tab/Space behavior exists in a native terminal host.
- Mouse support is optional and must not silently replace keyboard access.
- Use text, shape, or position as well as color for meaningful states. Check contrast in actual foreground/background combinations.
- Respect cell width, combining characters, wide glyphs, clipping, and resize. Specify a narrow-width outcome rather than pretending a larger screen exists.
- Support motion-off behavior without delaying or suppressing real data changes. Bound animation and dispose of its timers.
- State truecolor, color-depth, glyph, terminal-mode, and host prerequisites honestly. A tested fallback is different from an assumed one.
- Verify accessibility, input, focus, resizing, glyph alignment, and repaint behavior in Herdr. Record the actual access methods tested; do not claim universal accessibility.

Herdr is the reference environment and optimization target. Its tested version and capability baseline are recorded in [Contributing](../CONTRIBUTING.md#native-verification-baseline). Broader compatibility and additional fallbacks remain open. Do not infer support from a browser reconstruction or assume a particular Herdr API.

## UI states

Each element specifies the states that apply; omit irrelevant states rather than drawing decorative placeholders.

| State | Required meaning |
| --- | --- |
| Ready | Current authoritative data and available actions |
| Empty | No content, without implying a failed read succeeded |
| Unknown | A value is unavailable; never silently show zero |
| Working | Actual work is in progress; unrelated input remains usable where promised |
| Success | The operation reached its documented success boundary |
| Error | Clear failure and any safe recovery action; no false success |
| Disabled or unsupported | Explain the unavailable action/capability |
| Stale or offline | Distinguish last-known data from current data |

## Verification and open questions

### Polished-element acceptance

An element entering this repository needs:
1. A clear purpose, public usage contract, and appropriate state coverage.
2. Readable normal, narrow, and boundary layouts with explicit glyph/color assumptions.
3. Keyboard/focus behavior where interactive, plus a defined motion-off state.
4. A useful specimen and checks matching its claims.
5. Public-safe content and cleared redistribution rights for any included material.

Label specification-only, native rendering, automated PTY input, and actual Herdr verification accurately. Appearance evidence alone does not prove interaction, persistence, or application integration.

Current status: the four elements have native renderers with automated layout and contract checks. The three motions have deterministic frame checks, and `animate: false` is their motion-off state. The showcase and storybook pass automated checks of their live-view lifecycle, using stand-in terminal streams and, for storybook playback, a manual clock. The showcase is static. The storybook's motion previews default to motion off and run a bounded timer only while playing. The elements are not interactive; the storybook's keyboard path and optional left-click controls are defined by its host and [examples](../examples/README.md#left-clicks). Automated mouse checks are not proof of native Herdr mouse forwarding. This first pass requires 24-bit color, or falls back to plain text, and requires one-cell rendering of the curated glyphs; see [foundation](../foundation/README.md). Actual Herdr text/ANSI readback, scrolling, resizing, and exit cleanup have been checked for the showcase within the [documented scope](../CONTRIBUTING.md#native-verification-baseline). The storybook also has native Herdr frame, navigation, playback, and exit checks within its separate [verification scope](../CONTRIBUTING.md#storybook-verification-status). An earlier version of the storybook's COLORS story had isolated real-PTY checks and actual Herdr text/ANSI, paging, navigation, and cleanup checks, using injected mouse reports rather than a physical pointer; they have not been re-run against the current COLORS page. See the same verification scope. No accessibility certification, physical-pixel contrast assessment, or performance measurement is claimed.

Open decisions: visual refinements to the first four elements and the motions; any broader terminal support, including 256-color and ASCII-glyph fallbacks; and the project license.
