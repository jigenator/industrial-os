# Design

## Experience

Industrial OS should feel like a well-made instrument: precise, legible, deliberate, and immediately useful. Information has hierarchy without losing density. Labels are direct; values and actions matter more than ornament.

Native terminal users are the primary audience. The first delivery is a curated reference kit of polished elements, not a browser library or a complete application shell.

Avoid simulated telemetry, decorative noise over content, unnecessary chrome, and animation that implies work the application is not doing.

## Interaction and visual language

### Acid / Black

This is the selected default palette. The values below describe the initial visual foundation, not a shipped theme API or a blanket contrast certification.

| Role | Value | Intended use |
| --- | --- | --- |
| Field | `#000000` | Main background |
| Surface | `#1c1c1c` | Secondary fields and tracks |
| Primary text | `#ffffff` | Values and primary labels |
| Secondary text | `#cfcfcf` | Supporting readable text |
| Accent | `#c0fe04` | Deliberate emphasis and active signals |
| Decorative grey | `#717171` | Nonessential instrument detail |
| Structural grey | `#555555` | Subtle plates and decorative rules |
| Warning | `#d79e52` | Warning emphasis with a text/state cue |
| Critical | `#f24723` | Critical/error emphasis with a text/state cue |

Do not use decorative greys for essential control boundaries or readable small text without checking the actual contrast. Accent is not a substitute for a label; warning and critical states must remain understandable without color.

### Shape and composition

Use cell-aligned geometry, compact labels, clear readouts, and restrained numbered plates or calibration marks. Borders should organize content rather than consume every available cell. Do not require a particular proprietary font; work with the user's terminal font and declared glyph capabilities.

Panels, gauges, status rows, and state markers are candidates for the first elements—not a completed component inventory. Each needs its own polished contract before entering the system.

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
- Browser semantics and screen-reader behavior do not automatically transfer to a terminal. Record the actual access methods tested; do not claim universal accessibility.

The initial terminal support matrix and fallback policy remain to be chosen.

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

Label specification-only, browser illustration, native rendering, automated PTY input, and physical-terminal verification accurately. Appearance evidence alone does not prove interaction, persistence, or application integration.

Current status: design rules only; no elements, accessibility certification, runtime tests, or performance measurements are claimed.

Open decisions: the first polished element set; specification-only versus an executable native specimen; first host/toolchain; terminal compatibility/fallback contract; and the project license.
