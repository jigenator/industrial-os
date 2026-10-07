# Numbered panel

A bounded frame that gives a group of content a number, title, and optional meta note. The number is an accent [label plate](../label-plate/README.md).

## Usage

```js
import { numberedPanel, panelInnerWidth } from './numbered-panel.mjs';
const body = [[{ text: 'body', style: {} }]];            // caller-rendered lines, panelInnerWidth(40) = 36
numberedPanel({ number: 3, title: 'GAUGES', meta: '1/8-CELL FILL' }, body, { width: 40 });
```

```text
┌▐03▌ GAUGES ────────── 1/8-CELL FILL ─┐
│ body                                 │
└──────────────────────────────────────┘
```

- `number`: integer 0–99, shown with two digits. `title` and `meta`: strings.
- `width`: integer cells, 1–1000. `height`: optional total line count. It pads or clips the body so neighboring panels align.
- Returns lines that are each exactly `width` cells.

## Forms

| Width | Form | Body width |
| --- | --- | --- |
| 40 or more | Full: number plate in the top border, rails, corners | `width - 4` |
| Below 40 | Compact: numbered header rule only; no rails or bottom border | `width` |

When the header is short of space, the meta note is dropped first, then the title is truncated with `…`. Body lines wider than the panel are clipped. Callers should render the body at `panelInnerWidth(width)` so nothing is lost.

Corners use decorative grey and rails use structural grey. Neither carries meaning.

## Checks

[numbered-panel.test.mjs](numbered-panel.test.mjs): both forms, every width from 1 to 160, header priority, height, invalid input, and injection.
