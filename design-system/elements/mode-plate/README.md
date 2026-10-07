# Mode plate

A white inline mode body with black icon/title/slashes, saturated mode letters and one field gap at either side. Informational only: not a button or focusable control.

## Usage

```js
import { modePlate, pnytlPlate } from './mode-plate.mjs';
pnytlPlate('lite');                         // '  ⌑ PNYTL // LTE  '
pnytlPlate('lite', { active: true });       // '  • PNYTL // LTE  '
modePlate({ icon: '◆', title: 'LINK', code: 'ON', ink: 'accent' });
```

| Input/API | Contract | Default |
| --- | --- | --- |
| `modePlate({ icon, title, code, ink, active }, { maxWidth })` | inline spans, no wider than maxWidth | generic fields required |
| `icon` | one curated glyph or printable ASCII cell | `⌑` |
| `title`, `code` | caller strings, sanitized with `safeText` | required |
| `ink` | palette role or valid `#RRGGBB` | required |
| `active` | boolean explicit lit-icon frame; no blinking | `false` |
| `maxWidth` | integer 0–1000 or Infinity | Infinity |
| `pnytlPlate(state, { active, maxWidth })` | PNYTL preset with confirmed-enabled-mode light gating | state required |
| `PNYTL_MODES` | frozen preset `{ code, ink }` records | exported reference |

## States

| PNYTL state | Code | Mode ink |
| --- | --- | --- |
| `lite` | LTE | signal cobalt |
| `full` | FUL | signal violet |
| `ultra` | ULT | signal magenta |
| `review` | REV | signal teal |
| `off` | OFF | structural |
| `checking` | CHK | structural |
| `unknown` | UNK | structural |

No default mode is inferred. Unknown is not OFF. `pnytlPlate` lights only LTE/FUL/ULT/REV when `active: true`; OFF/CHK/UNK always retain `⌑`. The generic renderer honors its explicit light state directly. Lit is a pink `•` in the icon cell; other text/styles stay unchanged. The host, not this element, chooses blinking or a steady light.

## Width behavior

PNYTL has a primary-white 16-cell body (` ⌑ PNYTL // LTE `), plus two exterior field cells, exactly 18 total. Generic natural width is `title.length + code.length + 10` cells. `maxWidth` clips spans without padding. At one cell only the exterior gap remains; at zero it is empty. A clipped plate is incomplete, not an alternate mode; callers needing full meaning must reserve its natural width or wrap the whole piece. A host may `fitLine(piece, width)` to produce an exact-width line.

## Glyph/color assumptions

[Foundation](../../foundation/README.md) owns glyph and truecolor contracts. The body is primary white; icon/title/slashes are field black, bold. PNYTL inks and pink come only from `SIGNAL_COLORS`; structural is a role. Caller title/code controls and non-ASCII become `?`. Invalid text, icons, inks or flags throw `TypeError`; unknown presets and invalid maxWidth throw `RangeError`. This renderer has no timers, I/O or state.

## Differences from status-bar

Settled PNYTL and explicit lit-icon cells match `footer.ts:143–147,1153–1159`. The standalone generic renderer does not own producer status parsing, model-band placement, wrapping, mode-letter bursts or blinking. Inline clipping follows the DS bounded-piece contract; status-bar instead wraps complete plate text in its minimal layout. The generic API permits another icon/title/code/ink without changing the PNYTL preset.

## Checks

[mode-plate.test.mjs](mode-plate.test.mjs): exact seven-state snapshots/style table, 16/18-cell geometry, light gating, custom text sanitization, invalid inputs and widths 1–160 (also maxWidth 0), curated glyphs and plain/color equivalence. From `design-system/`: `node --test elements/mode-plate/mode-plate.test.mjs`, then `node --test`. No native Herdr verification claimed.
