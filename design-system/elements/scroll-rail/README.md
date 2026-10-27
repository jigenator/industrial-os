# Scroll rail

A one-column scroll rail, modeled on the automations monitor's list: a faint `│` track with a heavy primary `┃` thumb sized to the visible share.

## Usage

```js
import { scrollRail } from './scroll-rail.mjs';
scrollRail({ total: 40, visible: 10, offset: 0 });    // ten one-cell lines, the thumb at the top
```

## Contract

`scrollRail({ total, visible, offset })` returns one line per visible row, each one cell wide. The thumb is `max(2, round(visible² / total))` cells long and starts `round(offset / (total − visible) × (visible − thumb))` cells down. When everything fits (`total <= visible`) it returns `[]`: there is nothing to scroll and no rail. The host places the column and owns scrolling.

## Errors and checks

`total` and `offset` are integers from 0 and `visible` from 1; the offset must leave the last row in view. Anything else throws `RangeError`. Run [scroll-rail.test.mjs](scroll-rail.test.mjs) with `node --test`, then the [full validation sequence](../../CONTRIBUTING.md#full-validation-sequence). The storybook's SCROLL RAIL story shows the top, middle and end.
