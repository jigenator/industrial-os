# Design

This is the visual and interaction language of every project in the repository: the design system, the Pi extensions, and the planned Herdr tooling. It holds only what they share. Each project's own design doc describes that project's experience and must agree with this one: [the design system](../design-system/docs/design.md), [claude-interrupt](../pi/claude-interrupt/docs/design.md), and [status-bar](../pi/status-bar/docs/design.md).

## Experience

Industrial OS should feel like a well-made instrument: precise, legible, deliberate, and immediately useful. Information has hierarchy without losing density. Labels are direct; values and actions matter more than ornament.

People using terminal interfaces in Herdr are the primary audience. The design system is a curated reference kit of polished elements, not a browser library or a complete application shell; the Pi extensions put the language to work inside Pi.

Every element and demo must render as terminal-ready text in a cell grid, with terminal-native colors and styles. Layout, borders, spacing, and motion must work through terminal output—not HTML, CSS, DOM positioning, canvas, images, or browser-only effects.

Avoid simulated telemetry, decorative noise over content, unnecessary chrome, and animation that implies work the application is not doing.

## Interaction and visual language

### Acid / Black

This is the selected default palette. The design system owns its values: [foundation/palette.mjs](../design-system/foundation/palette.mjs) is their source and where every role's value can be read. Until they import it, the Pi extensions mirror those values: [status-bar](../pi/status-bar/docs/design.md#palette-and-context-semantics), the first implementation of the style, declares every role in the `C` palette of `pi/status-bar/src/footer.ts`, and [claude-interrupt](../pi/claude-interrupt/docs/design.md) declares acid, black, white, decorative grey, and structural grey as constants in its source. This table defines what each role is for. The palette is not a shipped theme API or a blanket contrast certification.

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

To change a value, change `palette.mjs` first, then each extension that still mirrors it, each in its own commit; see [the decision](decisions/in-repo-design-system-package.md). If an extension's constant differs from `palette.mjs`, `palette.mjs` is correct. The check is a direct comparison of each extension's constants against `palette.mjs`, using this table only to map a constant to its role. All nine roles currently match status-bar's constants, and claude-interrupt's five constants match them. status-bar's colors beyond these roles (count tiers, mode inks, gauge zones, warm-up steps, and usage providers) are product colors, not roles; their source is [foundation/signal-colors.mjs](../design-system/foundation/signal-colors.mjs), and status-bar mirrors them under the same rule.

### Pi extensions

An extension renders inside Pi's transcript, footer, or widgets with Pi's own styling API, so it has no cell budget of its own and must stay within Pi's rendering rules: one row where Pi gives one row, clipped rather than wrapped, and never blocking streaming, input, or focus. claude-interrupt's **DIRECTIVE UPDATED** transcript marker is the first example here: an acid plate, a short ping of fixed bars, and a settled grey record, specified exactly in [its design](../pi/claude-interrupt/docs/design.md). [status-bar](../pi/status-bar/docs/design.md)'s framed footer with numbered plates and a context gauge is the reference the design system's elements model.

### Shape and composition

Use cell-aligned geometry, compact labels, clear readouts, and restrained numbered plates or calibration marks. Borders should organize content rather than consume every available cell. Do not require a particular proprietary font; work with the user's terminal font and declared glyph capabilities. The design system's element set and its specimens are in [its design](../design-system/docs/design.md).

### Motion

Motion is instrument detail, never data. A motion decorates already-rendered output at an explicit time; it does not supply or obscure values. Never veil a reading, a label, or a status message. Decoration leaves warning and critical cells alone unless a motion opts in for that use; an opted-in motion may tint, invert, or resize their glyphs, but every frame still shows the state's shape and word, never blanked, hidden on the field, or replaced. There is no frequency cap: a motion may repeat or flash at any rate, including flashes faster than three a second. In exchange, every motion has a motion-off state that settles it at once, and a project states each fast or flashing motion's rate in its design doc; no project claims photosensitivity or WCAG flash compliance unless it has checked it. Pulse implies activity, so use it only where a signal really is active. Do not use motion to suggest progress that is not happening. Bound every animation and dispose of its timers; where a host has no reduced-motion setting, keep the animation short and say so.

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

Herdr is the reference environment and optimization target. Each project records the Herdr version and scope it was checked against in its contributing guide. Broader compatibility and additional fallbacks remain open. Do not infer support from a browser reconstruction or assume a particular Herdr API.

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

An element entering any project in this repository needs:
1. A clear purpose, public usage contract, and appropriate state coverage.
2. Readable normal, narrow, and boundary layouts with explicit glyph/color assumptions.
3. Keyboard/focus behavior where interactive, plus a defined motion-off state.
4. A useful specimen and checks matching its claims.
5. Public-safe content and cleared redistribution rights for any included material.

Label specification-only, native rendering, automated PTY input, and actual Herdr verification accurately. Appearance evidence alone does not prove interaction, persistence, or application integration. Each project records its own verification in its contributing guide.

Open decisions shared by every project: any broader terminal support, including 256-color and ASCII-glyph fallbacks, and the project license. Each project's own open decisions are in its design doc.
