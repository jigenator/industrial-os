# State chip

The status-bar Tatsu entry part: a dim nonbold label, one field space and bold `<shape> <CODE>` in its state ink. A generic supplied-state display, not a status collector or check.

## Usage

```js
import { stateChip, stateChips } from './state-chip.mjs';
stateChip({ label: 'TCLI', state: 'behind', commitsBehind: 1, localChanges: true });
stateChips([
  { label: 'TCLI', state: 'behind', commitsBehind: 1 },
  { label: 'AWKS', state: 'current' },
], { width: 30 });
```

```text
TCLI ▲ UP×1   AWKS • OK
```

| Input/API | Contract | Default |
| --- | --- | --- |
| `stateChip(input, { preset, maxWidth })` | inline spans no wider than maxWidth | Tatsu preset |
| `label`, `state` | caller label string; own key in preset | required |
| `commitsBehind` | non-negative safe integer; only Tatsu behind appends `×N` | omitted: `UP` |
| `localChanges` | boolean; Tatsu behind/repair appends ` ◆ EDIT` | `false` |
| `preset` | state → `{ shape, code, tone }`; single curated/ASCII shape, safe caller code string and valid color | `TATSU_STATES` |
| `maxWidth` | integer 0–1000 or Infinity | Infinity |
| `stateChips(inputs, { width, preset })` | array of inputs → lines of exactly width (1–1000); empty inputs → `[]` | width required |
| `TATSU_STATES` | frozen preset table | exported reference |

## States

| State | Shape/code | Role |
| --- | --- | --- |
| `current` | `• OK` | accent |
| `behind` | `▲ UP`, or `▲ UP×N` | warning |
| `repair` | `▲ FIX` | warning |
| `local_changes` | `◆ EDIT` | warning |
| `missing` | `✕ MISS` | critical |
| `not_runnable` | `✕ NRUN` | critical |
| `unavailable` | `✕ UNAV` | critical |
| `checking` | `· CHK` | decorative |
| `inactive` | `· OFF` | decorative |

Combined behind/repair + localChanges uses the same warning role throughout (`▲ UP×1 ◆ EDIT`, `▲ FIX ◆ EDIT`). Shape and code carry meaning without color. Unknown/unavailable is not current; there is no success-shaped fallback. Custom presets do not gain Tatsu count/edit grammar. Use role names for warning/critical custom states so motions can recognise them.

## Width behavior

Natural part width is sanitized label length + one gap + shape + one gap + code length. `stateChip` clips to maxWidth without padding: at one cell only the label's first cell remains, and at zero it is empty. Reserve natural width to preserve the whole state.

`stateChips` separates parts with exactly three field cells and breaks only between parts that can fit a whole line. A part wider than the whole line is the necessary exception: it splits at inner spaces, or hard-splits an overlong word. It never loses nonspace characters, even at width 1. Parts after an oversized part begin a fresh line. All output lines are fitted, and the caller's text/data are unchanged.

## Glyph/color assumptions

[Foundation](../../foundation/README.md) owns the one-cell glyph and truecolor requirements. Labels use decorative grey, not bold. Tatsu state colors use roles; `•`, `▲`, `◆`, `✕`, `·`, `×` are curated glyphs. Caller labels/custom codes use `safeText`. Invalid state/count/width throws `RangeError`; invalid text, shape, color, flag or inputs-array throws `TypeError`. This pure renderer has no timers, I/O or stored baseline; hosts own warm-up, checking fade, beacon and latch.

## Differences from status-bar

Settled Tatsu parts and three-cell gaps model `footer.ts:24–37,1167–1180,1192–1203`. This element accepts any label and a custom preset; it does not parse provider messages, retain completed checks across refreshes, supply component order, or draw decorations. The inline piece may clip to maxWidth; the layout helper keeps full parts whenever possible, like the footer. Inactive is an explicit component state, not the footer's raw-provider fallback for an inactive snapshot.

## Checks

[state-chip.test.mjs](state-chip.test.mjs): exact full table/style snapshots, count/edit combinations, whole-part wrapping and oversized-width exception, controls/custom presets, invalid inputs, every state at widths 1–160, glyph allowlist and plain/color equivalence. From `design-system/`: `node --test elements/state-chip/state-chip.test.mjs`, then `node --test`. Automated evidence only, not Herdr appearance or accessibility certification.
