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

To blink it, apply the [blink motion](../../motions/README.md#blinklines-options) with `BLINK_PRESETS.lamp` to the lamp cell. The preset's `offStyle` equals `LAMP_DIM_STYLE`, so it dims this element's full block and status-bar's blank lit cell alike. The storybook's BLINK story does this.

## Width and glyphs

Always one cell. Default appearances use `█` and `╱` from the curated glyph set and the `accent`, `primary`, `surface` and `decorative` roles. Explicitly styled appearances use `●`/`○` or `■`/`□`, also curated one-cell glyphs.

## Host appearances

`lamp(state, { appearance = 'glyph', lit = true })` adds explicit display poses without time or state inference:

- `glyph` retains the original output; working with `lit: false` uses `LAMP_DIM_STYLE`.
- `field`: a known lamp is a space with primary-white foreground and accent/surface background (the framed footer's exact bytes).
- `solid`: a known lamp is `█` with foreground equal to that background (the minimal footer's exact bytes).
- Working takes accent only while `lit`; idle is always surface. Unknown always retains its hatch/style.

Invalid appearances throw `RangeError`; nonboolean `lit` throws `TypeError`. Defaults are unchanged. status-bar now consumes the field/solid appearances; the default plain-text shape differences below apply only to `glyph`.
### Round and square appearances

```js
lamp('working', { appearance: 'round', style: { fg: 'accent' } });  // ●
lamp('working', { appearance: 'square', style: { fg: 'accent' } }); // ■
lamp('unknown', { appearance: 'square', style: { fg: 'warning' } }); // □
```

| Appearance | Working / idle | Unknown |
| --- | --- | --- |
| `round` | `●` | `○` |
| `square` | `■` | `□` |

Both require an explicit style validated with `resolveStyle` (`TypeError` if missing or invalid); omitted background is transparent `'default'`, and an explicit background is preserved. Both are static even with `lit: false`; unknown is never idle. The host owns state colors and motion. Place meaningful words beside them, since working and idle share a shape: RX, TX, NO LINK, waiting, or a watch's state. In particular, a waiting notch never blinks. A style on `glyph`, `field`, or `solid` throws `RangeError`; old appearances/defaults are unchanged. The storybook uses synthetic round RX/TX/NO LINK/WAITING and square WORK/IDLE/UNKNOWN fixtures.

A square lamp's known-state `■` works directly with [burn-out](../../motions/README.md#burnoutlines-options-and-burnoutdurationoptions): it changes only foreground ink and preserves the glyph, background and style attributes. Hollow unknown `□` is not targeted. Supply the already-settled style; completion and motion-off restore that input. Warning/critical role cells remain exempt.

## Differences from status-bar

- The framed footer draws a working lamp as a space on acid, so its plain text is a space for both working and idle. Here a working lamp is `█` in acid on acid: the same color cell, and a distinct plain-text shape. (status-bar's minimal layout already uses `█` for a lit lamp.)
- status-bar's minimal layout draws an idle lamp as `█` in surface on surface; here idle is always a space on surface, so plain text tells it from working.

## Checks

[lamp.test.mjs](lamp.test.mjs): one cell per state/appearance, default plain-text shapes and exact truecolor output, the blink cadence and dim style, filled/hollow round and square glyphs, explicit style validation, transparent/explicit backgrounds, static `lit` behavior, unchanged defaults and invalid inputs. [burn-out.test.mjs](../../motions/burn-out.test.mjs) checks square lamps across burn phases, completion, motion-off, region and state-cue protection without mutating input.
