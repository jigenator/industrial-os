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
| `markerPlate(state = 'record', { outputPad = 1 })` | one span: `outputPad` filled cells, then `DIRECTIVE UPDATED ` (19 or 18 cells) |
| `markerBars(bars = 'lit')` | 16 spans of one cell: bars at offsets `0, 1, 3, 5, 8, 11, 15` |
| `transcriptMarker({ plate = 'record', bars = 'off', outputPad = 1 }, { width })` | one line of exactly `width` cells |

`bars` is one state for all seven bars or an array of seven states. `outputPad` is Pi's configured `0` or `1`. Exported constants: `MARKER_LABEL`, `MARKER_BAR_OFFSETS`, `MARKER_SPAN`, `MARKER_PLATES`, `MARKER_BARS`, `MARKER_TIMELINE`.

## States

| Piece | State | Look | claude-interrupt source (`src/index.ts`) |
| --- | --- | --- | --- |
| Plate | `live` | field (black) bold lettering on accent (acid) | `livePlate` |
| Plate | `outline` | accent bold lettering, no fill | the unfilled flash frame (`outline`) |
| Plate | `record` | primary (white) bold lettering on structural `#555555` | `recordPlate` |
| Bar | `lit` | accent bold `│` | a bar after its launch |
| Bar | `ghost` | decorative `#717171` bold `│` | a bar in its grey phase (`ghost`) |
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

## Differences from claude-interrupt

- **Transparent cells sit on the field.** The extension leaves the outline lettering, the gap, the bars and the rest of the row on the terminal's default background, preserving transparency. The design system's line model has no default background, so those cells use `field` (black).
- **Light themes.** The extension swaps transparent acid ink for Pi's accent on light themes. The design system has no theme, so acid is always acid.
- **Exact width.** The extension returns `width - outputPad` cells and lets Pi pad; the element appends the `outputPad` blank cells itself.
- **No timing.** `renderMarker(theme, width, outputPad, elapsed)` computes the frame from elapsed time; here time belongs to motions and hosts, and the element exposes each piece's states.

## Checks

[transcript-marker.test.mjs](transcript-marker.test.mjs): every plate and bar state and both pads, the settled row, a composition of the pieces that reproduces claude-interrupt's literal 40-column timeline oracle frame by frame (flashes, both pings, the wipe at both pads), every width from 1 to 160 in every state with plain/color equivalence and blank right padding, and invalid states.
