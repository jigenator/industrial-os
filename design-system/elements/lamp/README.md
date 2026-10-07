# Lamp

The Thread Rail's root lamp from status-bar: one cell that says whether the root session is working, idle, or has not reported. It is a static cell; the working blink is a host's motion.

## Usage

```js
import { LAMP_BLINK, LAMP_DIM_STYLE, lamp } from './lamp.mjs';
lamp('working');   // █  acid on acid
lamp('idle');      //    a space on surface
lamp('unknown');   // ╱  decorative on surface
```

`lamp(state)` returns one span of exactly one cell.

| `state` | Plain text | Color | status-bar source |
| --- | --- | --- | --- |
| `working` | `█` | accent on accent: a bright filled acid cell | `lamp` with `activity.working` |
| `idle` | space | a dark filled `surface` cell | `lamp` without `working` |
| `unknown` | `╱` | decorative on `surface`, static hatch | `lamp` with no `activity` |

## States and cues

In color, working and idle differ by luminance: a bright filled acid cell against a dark surface cell, not by hue alone. In plain text they differ by shape: `█` against a space, and unknown is the hatched `╱`. status-bar has no word for this state and its blink is decorative, so neither the blink nor a word can be the only cue; place the lamp next to the bright ROOT plate, as the [thread rail](../thread-rail/README.md) does. Unknown is never drawn as idle or working.

## Motion

The element never blinks. status-bar blinks a working lamp 500 ms lit, then 300 ms dim, on its 50 ms decoration tick from the motion epoch (`lampOn`: lit while `tick % 16 < 10`). Only a working lamp blinks; idle and unknown are static. `/footer-motion off` holds the working lamp lit. `LAMP_BLINK` exports that cadence (`onMs`, `offMs`, `tickMs`) so a host can drive the blink motion with the same timing.

The dim frame is `LAMP_DIM_STYLE` (surface on surface): the working glyph `█` in the idle cell's color. In color it matches the footer's dim frame; in plain text it still reads `█`, so a blink never changes the plain-text state. Motion-off is the working cell, lit.

## Width and glyphs

Always one cell. Uses `█` and `╱` from the curated glyph set and the `accent`, `primary`, `surface` and `decorative` roles.

## Differences from status-bar

- The framed footer draws a working lamp as a space on acid, so its plain text is a space for both working and idle. Here a working lamp is `█` in acid on acid: the same color cell, and a distinct plain-text shape. (status-bar's minimal layout already uses `█` for a lit lamp.)
- status-bar's minimal layout draws an idle lamp as `█` in surface on surface; here idle is always a space on surface, so plain text tells it from working.

## Checks

[lamp.test.mjs](lamp.test.mjs): one cell per state, distinct plain-text shapes, exact truecolor output, the blink cadence and dim style, unknown distinct from the others, and invalid states.
