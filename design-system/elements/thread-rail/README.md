# Thread rail

status-bar's Thread Rail: the root session's lamp, a blank separator, a bright `ROOT` plate, up to six unit marks and the exact **AU** (Active Units) badge. It shows what the caller reports; it reads no session state and never invents a count.

## Usage

```js
import { threadRail, threadRailPieces, threadRailSpans } from './thread-rail.mjs';
threadRail({ working: true, units: 3 }, { width: 40 });
threadRail({ working: false, units: 0 }, { width: 20 });
threadRail(undefined, { width: 40, align: 'right' });
threadRailPieces({ working: true, units: 3 }, { marks: false }); // pieces for a frame's header aside
```

```text
█  ROOT  █·█·█·······  03 AU             (40, working, 3 units)
   ROOT   00 AU                          (20, idle, 0 units: marks yielded)
           ╱  ROOT  ············   ? AU  (40, no activity, right-aligned)
```

| Function | Returns |
| --- | --- |
| `threadRail(activity, { width, align })` | lines of exactly `width` cells (1–1000); `align` is `'left'` (default) or `'right'` |
| `threadRailPieces(activity, { marks })` | the pieces, each an array of spans: lamp, ROOT, the marks (unless `marks: false`), the badge |
| `threadRailSpans(activity, { marks })` | the pieces joined by one field cell |

`activity` is `{ working, units }`: `working` a boolean, `units` a non-negative safe integer or `null`/`undefined` for unknown. `undefined` or `null` activity means the session has not reported.

## Pieces and states

| Piece | Cells | Contract |
| --- | --- | --- |
| Lamp | 1 | the [lamp](../lamp/README.md): `working`, `idle`, or `unknown` when activity is absent |
| ROOT | 6 | ` ROOT `, an accent slab [label plate](../label-plate/README.md); bright whether working or idle |
| Marks | 12 | six two-cell marks: `█·` (acid block, grey dot) for each active unit up to six, then `··`; settled pose |
| Badge | 7+ | the `units` [count plate](../count-plate/README.md): ` 03 AU `, ` 00 AU `, `  ? AU `, ` 120 AU ` |

Unknown units show `  ? AU` and no lit marks, distinct from confirmed ` 00 AU `. The marks are decoration capped at six; the badge is the exact count. AU is the caller's active-work total; it is not described here as a count of running agents.

## Width behavior

1. The full rail (29 cells for 0–99 units) on one line when it fits.
2. Otherwise the marks yield first: lamp, ROOT and badge on one line (16 cells).
3. Otherwise the lamp, ROOT and badge wrap onto further lines, one field cell apart where they share a line. A piece wider than the line is drawn at the line's width: ROOT truncates like a label plate (` RO… `, then `R`), and the badge drops its pads and then shows `#` cells, never partial digits.

At 1 cell the rail is three lines: `█`, `R`, `#`. Every line is exactly `width` cells.

## Motion

The element draws the settled frame. status-bar animates two parts, both on its 50 ms decoration tick from one motion epoch, and both stop with `/footer-motion off`:

- The working lamp blinks 500 ms lit / 300 ms dim; see the [lamp](../lamp/README.md#motion).
- Each visible unit mark shuttles its acid block between its two cells on its own period: mark `q` (0–5) shows `·█` instead of `█·` while `floor((tick + 3q) / (4 + (2q mod 5))) mod 2` is 1 (status-bar `markSide`). Motion-off is the settled `█·`.

Re-strikes and ghosts on ROOT and the badge are status-bar's ambient motion; they change styles only.

## Glyphs and colors

`█`, `·`, `╱` from the curated set; the accent, primary, secondary, surface, structural and decorative roles. Requires one-cell rendering of Ambiguous-width glyphs, like every element.

## Cross-element imports

This element imports the public functions of [lamp](../lamp/README.md) (`lamp`), [label plate](../label-plate/README.md) (`labelPlate`) and [count plate](../count-plate/README.md) (`countPlate`, `COUNT_PLATES`).

## Differences from status-bar

- **No anchors.** status-bar aligns ROOT's right edge to its context numeral's divider and the badge to its captions when those fit, which can widen the gap before the badge. The rail has no neighbors, so it left- or right-aligns as a unit; a frame can add the extra field cell to a piece (the [instrument frame](../instrument-frame/README.md) tests show how).
- **Narrow wrapping is by piece.** status-bar's minimal layout word-wraps the rail as text, which can split a plate's padding or `03 AU` across lines; here pieces stay whole until a single piece is wider than the line.
- **Marks in narrow layouts.** status-bar's minimal layout never draws marks; the standalone rail keeps them whenever the full rail fits.
- **Lamp shape.** A working lamp is `█` in acid on acid instead of a space on acid; see the [lamp](../lamp/README.md#differences-from-status-bar).
- **Invalid units throw** (`RangeError`) instead of reading as unknown, and a non-boolean `working` throws `TypeError`.

## Checks

[thread-rail.test.mjs](thread-rail.test.mjs): the full rail and its styles against status-bar's group, marks for 0–99 and unknown units, unknown never zero, exact large counts, the yielding order at named widths, every width from 1 to 160 in both alignments with plain/color equivalence, and invalid activity.
