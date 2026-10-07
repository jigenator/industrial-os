# Status row

One aligned line of label, value, and state. The row displays the state the caller supplies. It performs no checks, makes no remote claims, and never invents a value.

## Usage

```js
import { statusRow } from './status-row.mjs';
statusRow({ label: 'DOOR', value: 'closed', status: 'success' }, { width: 48 });
statusRow({ label: 'LINK', value: null, status: 'unavailable' }, { width: 48 });
```

```text
DOOR       closed                        ● OK
LINK       --                            ? N/A
```

- `label`: string. `value`: string, or `null` when no value was supplied (shown as `--`).
- `status`: one of the states below. Anything else throws `RangeError`.
- Layout options: `width` (1–1000) and `labelWidth` (default 10). Returns one or two lines, each exactly `width` cells.

## States

| `status` | Shown | Color |
| --- | --- | --- |
| `neutral` | `○ INFO` | secondary |
| `success` | `● OK` | accent |
| `warning` | `▲ WARN` | warning |
| `error` | `✕ ERROR` | critical |
| `unavailable` | `? N/A` | secondary |

Every state has its own marker and word, so it reads the same without color. The state column is 7 cells wide and right-aligned to the row.

## Narrow behavior

The value column gets the remaining width and is truncated with `…`. When fewer than 6 value cells would remain, the row stacks: label and state on the first line, and the value indented on the second.

## Checks

[status-row.test.mjs](status-row.test.mjs): column alignment, distinct non-color cues, missing values, stacking, every width from 1 to 160, invalid states, and injection.
