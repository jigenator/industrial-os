# Section head

The board's section and group heading, modeled on the automations monitor: `■ TITLE  CC  ───────`.

## Usage

```js
import { sectionHead } from './section-head.mjs';
sectionHead({ title: 'PIPELINES', count: '07' }, { width: 40 });           // ■ PIPELINES  07  ─────────────────────
sectionHead({ title: 'NEEDS ATTENTION', count: '02', mark: 'critical' }, { width: 40 });
sectionHead({ title: 'EVENT LOG', count: 'PIPELINES' }, { width: 16 });   // ■ EVENT LOG  ───
```

## Contract

`sectionHead({ title, count = '', mark = 'primary' }, { width, measure, ellipsis })` returns one line of exactly `width` cells.

- The mark `■` takes `mark`: primary for a section, a state cell color for a group heading.
- The title is bold primary, cut with `…` to `width − 2` cells. `ellipsis: 'always'` marks a one-cell cut with `…` too (see [fitText](../../foundation/README.md)).
- The count, if any, is decorative, two cells after the title. It is dropped whole when it does not fit; it is never cut.
- The rule is `─` in `BOARD_INKS.faint`, two cells after the last text, to the edge. It needs three spare cells: the gap and at least one rule cell.
- Cells between the parts and any padding are blank spans with no style, so a host keeps its own background there.

## Width, errors and checks

Every width from 1 to 160 is exact. Strings use ASCII sanitizing unless `measure` is supplied ([measured text](../../foundation/README.md#measured-text-slots)). A non-object input, a non-string count or a non-text title throws `TypeError`; an invalid width throws `RangeError`; an unknown color throws `TypeError`.

Run [section-head.test.mjs](section-head.test.mjs) with `node --test`, then the [full validation sequence](../../CONTRIBUTING.md#full-validation-sequence). The storybook's SECTION HEAD story uses the public call with fixtures.
