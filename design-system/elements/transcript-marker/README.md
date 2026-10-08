# Transcript marker

claude-interrupt's **DIRECTIVE UPDATED** marker as static pieces: a bold plate, one blank cell, and a 16-cell span of seven stationary `│` bars. It records that a continuation was confirmed. It is a record, not a progress display and not a button. The element draws each state; the flashes, ping and wipe are motions applied by a host to each piece.

## Usage

```js
import { markerBars, markerPlate, transcriptMarker, MARKER_TIMELINE } from './transcript-marker.mjs';
transcriptMarker({}, { width: 40 });                                  // settled record row
transcriptMarker({ plate: 'live', bars: 'lit', outputPad: 0 }, { width: 40 });
markerPlate('outline', { outputPad: 1 });                              // spans, for a flash motion
markerBars(['lit', 'lit', 'ghost', 'off', 'off', 'off', 'off']);       // spans, for a ping motion
```

```text
 DIRECTIVE UPDATED                       (record, outputPad 1, width 40)
DIRECTIVE UPDATED  ││ │ │  │  │   │      (live, all bars lit, outputPad 0)
```

| Function | Returns |
| --- | --- |
| `markerPlate(state = 'record', { outputPad = 1, background })` | one span: `outputPad` filled cells, then `DIRECTIVE UPDATED ` (19 or 18 cells) |
| `markerBars(bars = 'lit', { background })` | 16 spans of one cell: bars at offsets `0, 1, 3, 5, 8, 11, 15` |
| `transcriptMarker({ plate = 'record', bars = 'off', outputPad = 1, background, padToWidth = true }, { width })` | one line of exactly `width` cells |

`background` optionally sets every unfilled cell's background (outline plate, bars, gaps and padding); filled live/record plates keep their approved pairs. Use `'default'` for terminal transparency, or a role/RGB for a host surface. Off bars and blank cells use default foreground when this option is set. The omitted option preserves existing field rendering. `padToWidth: false` returns only `width - outputPad` content cells so a host such as Pi owns right padding; the default still returns exactly `width` cells.

`bars` is one state for all seven bars or an array of seven states. `outputPad` is Pi's configured `0` or `1`. Exported constants: `MARKER_LABEL`, `MARKER_BAR_OFFSETS`, `MARKER_SPAN`, `MARKER_PLATES`, `MARKER_BARS`, `MARKER_TIMELINE`.

## States

| Piece | State | Look | claude-interrupt source (`src/index.ts`) |
| --- | --- | --- | --- |
| Plate | `live` | field (black) bold lettering on accent (acid) | `markerPlate("live")` |
| Plate | `outline` | accent bold lettering, no fill | `flash` interrupt preset |
| Plate | `record` | primary (white) bold lettering on structural `#555555` | `markerPlate("record")` |
| Bar | `lit` | accent bold `│` | `ping` after launch |
| Bar | `ghost` | decorative `#717171` bold `│` | `ping` grey phase |
| Bar | `off` | blank | before launch and after its grey phase |

The label is readable in every state; only the plate has a fill. The settled row, the element's default, is the record plate with no bars.

## Row geometry and width

The row is the plate, one blank cell, the bar span, then field. As in the extension, content is clipped to `width - outputPad` cells, and the last `outputPad` cells are blank, so the row is always exactly `width` cells and one row: it clips, it never wraps. At `outputPad: 1` and width 1 the row is a single blank cell; the label is cut from the right as the width shrinks.

## Extension timeline

Times are ms after the continuation starts (`MARKER_TIMELINE`); the plate changes on an 80 ms grid and the bars on a 40 ms grid. A host reproduces the marker by choosing piece states at time `m`:

- **Plate flashes:** `live` for 0–79, `outline` for 80–159, then `live` from 160 (`flashOff`, `flashOn`). Abrupt whole-plate changes, not a wipe.
- **Ping:** with `t = floor(m / 40) * 40`, bar `i` (0–6) is `lit` from `160 + 40i` (`pingLaunch`, `pingStagger`), `ghost` from `440 + 40i` (`ghostAt`) for 120 ms (`ghostFor`), then `off`. The first ping ends at 800. The ping plays once more 720 ms later (`pingRepeatAfter`): for `m >= 880`, use `m - 720`. Nothing moves; the bars are not progress.
- **Settle wipe:** from 2800 (`settleWipe`) the plate's rightmost cells become `record`, right to left: `recorded = min(n, ceil(((floor(m / 80) * 80 - 2800 + 80) * n) / 200))` for an `n`-cell plate, which is 8, 16 and 19 cells at 2800, 2880 and 2960 for `outputPad: 1` (8, 15 and 18 for `outputPad: 0`). From 3000 (`window`) the row is settled.

The extension redraws every 40 ms for those three seconds and then runs no timer. Saved markers render settled without replaying. Its two whole-plate flashes in the first 160 ms are a fast flash (two in 160 ms); state that rate wherever a host plays it, and settle at once (record plate, no bars) for motion-off. claude-interrupt itself has no motion-off control.

## Glyphs and colors

`│` from the curated set, and the accent, field, primary, structural and decorative roles, which match claude-interrupt's `acid`, `black`, `bone`, `darkGrey` and `grey` constants.

## Host integration

claude-interrupt now consumes these pieces by exported package subpath and composes `flash` (interrupt preset, `outlineBackground: 'default'`), `ping` (`offStyle` with default channels), and `wipe` on the plate and bars. Elements do not own time or import motions. Its lifecycle reads the redraw interval and completion window from `MARKER_TIMELINE`, and remains responsible for cancellation.

- **Transparency:** choose `background: 'default'` for the unfilled pieces. See the [foundation line model](../../foundation/README.md#line-model); explicit terminal defaults do not mean the black field.
- **Light themes:** the Pi adapter replaces transparent accent ink with the host's `accent` on light themes. Filled plate pairs are unchanged. The design system has no theme or Pi dependency.
- **Exact output:** `padToWidth: false` exposes the content-only static row. The animated host composes the pieces, pads to its content budget, translates spans to Pi style runs, then uses Pi's clipping helper, preserving byte-for-byte SGR at narrow widths as well as cell geometry.
- **Types:** colocated `.d.mts` declarations type the pieces and constants without adding a runtime module or export.

The default static/storybook element appearance and width contract are unchanged.

## Checks

[transcript-marker.test.mjs](transcript-marker.test.mjs): every plate and bar state and both pads, the settled row, a composition of the pieces that reproduces claude-interrupt's literal 40-column timeline oracle frame by frame (flashes, both pings, the wipe at both pads), every width from 1 to 160 in every state with plain/color equivalence and blank right padding, invalid states, transparent piece styles, and host-owned padding at every width 1–160. The extension separately compares original and migrated Pi output byte-for-byte across time, widths, pads, themes and color modes.
