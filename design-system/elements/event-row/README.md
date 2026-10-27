# Event row

One event as a row, modeled on the automations monitor: the board's event log (`log`) or a popup's event list (`detail`). The host formats the clock and chooses the words.

## Usage

```js
import { eventRow } from './event-row.mjs';
eventRow({ time: '09:41', tone: 'crit', verb: 'FAIL', ref: '1234', text: 'IMPLEMENT' }, { width: 35 });
// 09:41 █ FAIL  1234 IMPLEMENT
eventRow({ time: '09:41:07', tone: 'live', verb: 'CLAIM', ref: '1234' }, { width: 30, form: 'detail' });
// 09:41:07  CLAIM 1234
```

## Contract

`eventRow({ time, tone, verb, ref = '', text = '' }, { width, measure, form = 'log', ellipsis })` returns one line of exactly `width` cells. `tone` is a [board tone](../../foundation/README.md).

- **log:** the decorative clock, a state cell at column 6 in the tone's cell color, a five-cell verb at column 8 and, from column 14, the reference in primary and the subject in decorative, a cell apart. The verb takes its tone's ink in bold only for `crit` and `warn`; other verbs are plain secondary. Without a reference, the subject starts at column 14. The subject is cut first, then the reference.
- **detail:** the decorative clock, the bold verb at column 10 in its state ink (acid for `live`, critical, warning, otherwise secondary) and the reference in secondary at column 16.

Verbs are at most five cells. `ellipsis: 'always'` marks a one-cell cut with `…`. Blank cells carry no style.

## Errors and checks

A non-object event or non-string text throws `TypeError`; an unknown tone or form or an invalid width throws `RangeError`. Every width from 1 to 120 is exact in both forms. Run [event-row.test.mjs](event-row.test.mjs) with `node --test`, then the [full validation sequence](../../CONTRIBUTING.md#full-validation-sequence). The storybook's EVENT ROW story shows both forms.
